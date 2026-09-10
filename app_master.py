# ============================================================================
# TERADMAS ERP v2.6 - MASTER / ENTRYPOINT FLASK
# Arquivo: master.py
#
# Correções desta versão:
# - registra os Blueprints do ERP de forma centralizada;
# - mantém compatibilidade com módulos que importam "app_master";
# - corrige /login, /grid e /financeiro;
# - não cria nem exige static/login.js físico: a rota faz a ponte para
#   login/login.js;
# - usa caminhos absolutos baseados no diretório do projeto;
# - preserva a sessão da equipe e o fluxo login -> inicialização -> financeiro;
# - não contém CSS de páginas do ERP.
# ============================================================================

import importlib
import logging
import os
import sys
from pathlib import Path

from flask import Flask, jsonify, redirect, request, send_from_directory, session


# ============================================================================
# IDENTIDADE DO MÓDULO
# ============================================================================
# Os módulos antigos usam "from app_master import URL_SUPABASE".
# Quando o Render executa "master.py", o módulo é carregado como __main__.
# Este alias evita que os módulos filhos procurem um segundo app_master.py.
sys.modules.setdefault("app_master", sys.modules[__name__])


# ============================================================================
# CAMINHOS E CONFIGURAÇÃO
# ============================================================================
BASE_DIR = Path(__file__).resolve().parent

URL_SUPABASE = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("SUPABASE_DB_URL")
    or os.environ.get("POSTGRES_URL")
)

SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("FLASK_SECRET_KEY")
if not SECRET_KEY:
    # Não é segredo de produção: serve somente como fallback para não impedir
    # a inicialização. No Render, recomenda-se definir SECRET_KEY.
    SECRET_KEY = "TERADMAS-ERP-v2.6-session-fallback"


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("teradmas.master")


# ============================================================================
# APLICAÇÃO
# ============================================================================
app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    static_url_path="/static",
)

app.config.update(
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 7,
)


# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

def resposta_erro(mensagem, status=404):
    return jsonify(
        {
            "erp": "TERADMAS",
            "erro": mensagem,
            "sistema": "TERADMAS ERP",
            "sucesso": False,
            "versao": "2.6",
        }
    ), status


def usuario_logado():
    return bool(session.get("logado"))


def professor_logado():
    return bool(
        session.get("logado")
        and session.get("professor_master")
    )


def caminho_seguro(*partes):
    """Monta caminho absoluto relativo à raiz do projeto."""
    return BASE_DIR.joinpath(*partes)


# ============================================================================
# ROTA RAIZ
# ============================================================================

@app.route("/", methods=["GET"])
def rota_raiz():
    if professor_logado():
        return redirect("/professor_painel_secreto")

    if usuario_logado():
        return redirect("/configuracao/inicializacao")

    return redirect("/login")


# ============================================================================
# LOGOUT CENTRAL
# ============================================================================

@app.route("/logout", methods=["GET"])
def rota_logout():
    session.clear()
    return redirect("/login")


# ============================================================================
# COMPATIBILIDADE: /static/login.js
# ============================================================================
#
# O projeto NÃO possui static/login.js. O login verdadeiro está em:
#     login/login.js
#
# O HTML antigo pode continuar usando /static/login.js sem gerar 404.
# Nenhum arquivo duplicado é criado.
#
@app.route("/static/login.js", methods=["GET"])
def servir_login_js_compatibilidade():
    diretorio_login = caminho_seguro("login")
    arquivo_login_js = diretorio_login / "login.js"

    if not arquivo_login_js.is_file():
        return (
            "console.error('TERADMAS: login/login.js não encontrado.');",
            404,
            {"Content-Type": "application/javascript; charset=utf-8"},
        )

    return send_from_directory(
        str(diretorio_login),
        "login.js",
        mimetype="application/javascript",
        max_age=0,
    )


# ============================================================================
# REGISTRO DOS BLUEPRINTS
# ============================================================================
#
# Os módulos podem ser organizados em pastas, por exemplo:
#     login/app_login.py
#     configuracao/app_configuracao.py
#     financeiro/app_financeiro.py
#
# O registro é feito por descoberta controlada. Assim, acrescentar um módulo
# app_*.py com uma variável *_blueprint não exige editar novamente este master.
#

MODULOS_PRIORITARIOS = [
    "login.app_login",
    "configuracao.app_configuracao",
    "financeiro.app_financeiro",
]

MODULOS_IGNORADOS = {
    "master.py",
    "app_master.py",
    "GerenciadorCaixa.py",
}



def iterar_modulos_app():
    """Retorna módulos app_*.py existentes no projeto, sem duplicá-los."""
    encontrados = []
    vistos = set()

    # Primeiro: módulos que formam o núcleo e que conhecemos explicitamente.
    for nome in MODULOS_PRIORITARIOS:
        arquivo = BASE_DIR / Path(nome.replace(".", "/") + ".py")
        if arquivo.is_file() and nome not in vistos:
            encontrados.append(nome)
            vistos.add(nome)

    # Depois: demais app_*.py das pastas de primeiro nível.
    for arquivo in sorted(BASE_DIR.glob("*/app_*.py")):
        if arquivo.name in MODULOS_IGNORADOS:
            continue

        pasta = arquivo.parent.name
        nome_modulo = f"{pasta}.{arquivo.stem}"

        if nome_modulo not in vistos:
            encontrados.append(nome_modulo)
            vistos.add(nome_modulo)

    # Compatibilidade caso algum app_*.py esteja na raiz.
    for arquivo in sorted(BASE_DIR.glob("app_*.py")):
        if arquivo.name in MODULOS_IGNORADOS:
            continue

        nome_modulo = arquivo.stem
        if nome_modulo not in vistos:
            encontrados.append(nome_modulo)
            vistos.add(nome_modulo)

    return encontrados



def registrar_blueprints():
    registrados = []

    for nome_modulo in iterar_modulos_app():
        try:
            modulo = importlib.import_module(nome_modulo)
        except Exception as erro:
            # Um módulo opcional quebrado não deve derrubar /login nem /financeiro.
            logger.exception(
                "Falha ao importar módulo %s. O restante do ERP continuará carregando.",
                nome_modulo,
            )
            continue

        candidatos = []
        for nome_atributo in dir(modulo):
            if not nome_atributo.endswith("_blueprint"):
                continue

            objeto = getattr(modulo, nome_atributo, None)
            if objeto is None:
                continue

            # Flask Blueprint possui os atributos abaixo.
            if hasattr(objeto, "register") and hasattr(objeto, "name"):
                candidatos.append((nome_atributo, objeto))

        for nome_atributo, blueprint in candidatos:
            if blueprint.name in app.blueprints:
                logger.warning(
                    "Blueprint %s já registrado; ignorando duplicata (%s).",
                    blueprint.name,
                    nome_atributo,
                )
                continue

            try:
                app.register_blueprint(blueprint)
                registrados.append(blueprint.name)
                logger.info(
                    "Blueprint registrado: %s <- %s.%s",
                    blueprint.name,
                    nome_modulo,
                    nome_atributo,
                )
            except Exception:
                logger.exception(
                    "Falha ao registrar blueprint %s do módulo %s.",
                    nome_atributo,
                    nome_modulo,
                )

    return registrados


# O registro acontece antes das rotas de fallback abaixo.
BLUEPRINTS_REGISTRADOS = registrar_blueprints()


# ============================================================================
# /GRID - PONTO DE ENTRADA DA EMPRESA
# ============================================================================
#
# O /grid é mantido apenas como compatibilidade com módulos legados.
# O fluxo oficial de equipe é login -> inicialização -> financeiro.
#

if "/grid" not in [regra.rule for regra in app.url_map.iter_rules()]:

    @app.route("/grid", methods=["GET"])
    def rota_grid_master():
        if not usuario_logado():
            return redirect("/login")

        if professor_logado():
            return redirect("/professor_painel_secreto")

        if not session.get("empresa_inicializada"):
            return redirect("/configuracao/inicializacao")

        # O financeiro é o primeiro painel operacional consolidado já
        # disponível neste núcleo. Assim /grid não fica quebrado enquanto
        # o módulo específico de grid não existir.
        return redirect("/financeiro")


# ============================================================================
# /FINANCEIRO - GARANTIA DO PONTO DE ENTRADA
# ============================================================================
#
# O /financeiro verdadeiro pertence a financeiro/app_financeiro.py.
# Esta checagem NÃO substitui a rota do blueprint. Ela só registra uma rota
# de compatibilidade caso o arquivo/módulo financeiro não tenha sido carregado.
#

if "/financeiro" not in [regra.rule for regra in app.url_map.iter_rules()]:

    @app.route("/financeiro", methods=["GET"])
    def rota_financeiro_fallback():
        if not usuario_logado():
            return redirect("/login")

        return resposta_erro(
            "Módulo financeiro não foi registrado no servidor.",
            500,
        )


# ============================================================================
# DIAGNÓSTICO SEM EXPOR SEGREDOS
# ============================================================================

@app.route("/health", methods=["GET"])
def healthcheck():
    return jsonify(
        {
            "status": "ok",
            "sistema": "TERADMAS ERP",
            "versao": "2.6",
            "blueprints": sorted(BLUEPRINTS_REGISTRADOS),
            "database_configurada": bool(URL_SUPABASE),
        }
    ), 200


@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify(
        {
            "status": "sucesso",
            "sistema": "TERADMAS ERP",
            "versao": "2.6",
            "logado": usuario_logado(),
            "id_equipe": session.get("id_equipe") if usuario_logado() else None,
            "empresa_inicializada": bool(session.get("empresa_inicializada")),
            "professor_master": professor_logado(),
            "blueprints": sorted(BLUEPRINTS_REGISTRADOS),
        }
    ), 200


# ============================================================================
# TRATAMENTO DE 404
# ============================================================================

@app.errorhandler(404)
def erro_404(_erro):
    return resposta_erro("Recurso não encontrado.", 404)


@app.errorhandler(500)
def erro_500(_erro):
    # O Flask já registra o traceback no servidor. Não expor detalhes internos
    # ao navegador.
    return resposta_erro("Erro interno do servidor.", 500)


# ============================================================================
# INFORMAÇÃO DE STARTUP
# ============================================================================

logger.info("TERADMAS ERP v2.6 inicializado.")
logger.info("Diretório base: %s", BASE_DIR)
logger.info("DATABASE_URL configurada: %s", bool(URL_SUPABASE))
logger.info("Blueprints ativos: %s", ", ".join(sorted(BLUEPRINTS_REGISTRADOS)) or "nenhum")


# ============================================================================
# EXECUÇÃO LOCAL / RENDER
# ============================================================================

if __name__ == "__main__":
    porta = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"

    app.run(
        host=host,
        port=porta,
        debug=debug,
    )
