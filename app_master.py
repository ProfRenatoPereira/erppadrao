# ==========================================================================
# TERADMAS ERP v2.6
# MASTER.PY
#
# CAMADA CENTRAL DE ORQUESTRAÇÃO DO ERP PADRÃO
# ==========================================================================

import os
import logging

from flask import (
    Flask,
    jsonify,
    request,
    session
)

from GerenciadorCaixa import (
    calcular_metricas_totais_equipe
)

# ==========================================================================
# CONFIGURAÇÃO DO SISTEMA
# ==========================================================================

APP_VERSION = "2.6"
NOME_SISTEMA = "TERADMAS ERP"
NOME_ERP = "ERP PADRÃO"

# ==========================================================================
# SISTEMA DE LOGS
# ==========================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ==========================================================================
# INSTÂNCIA DO FLASK
# ==========================================================================

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "teradmas-chave-local"
)
# ==========================================================================
# IDENTIDADE DA EQUIPE
# ==========================================================================

def obter_id_equipe():
    equipe_id = session.get("equipe_id")
    if equipe_id is not None:
        return equipe_id

    equipe_id = request.args.get("equipe_id")
    if equipe_id:
        return equipe_id

    equipe_id = request.form.get("equipe_id")
    if equipe_id:
        return equipe_id

    return None


def normalizar_id_equipe(valor):
    if valor is None:
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        valor = str(valor).strip()
        return valor if valor else None


# ==========================================================================
# GESTÃO DE EMPRESA E DEPARTAMENTOS
# ==========================================================================

def obter_nome_empresa():
    nome = session.get("nome_empresa")
    if nome:
        return str(nome).strip()
    return "GRUPO ACADÊMICO"


def obter_departamento():
    departamento = request.args.get("departamento")
    if not departamento:
        departamento = request.form.get("departamento")
    if not departamento:
        return None
    return str(departamento).strip().lower() or None


# ==========================================================================
# PADRONIZAÇÃO DE RESPOSTAS
# ==========================================================================

def resposta_sucesso(dados=None, **extras):
    resposta = {
        "sucesso": True,
        "sistema": NOME_SISTEMA,
        "erp": NOME_ERP,
        "versao": APP_VERSION
    }
    if dados:
        resposta.update(dados)
    if extras:
        resposta.update(extras)
    return jsonify(resposta)


def resposta_erro(mensagem, status=400):
    return jsonify({
        "sucesso": False,
        "sistema": NOME_SISTEMA,
        "erp": NOME_ERP,
        "versao": APP_VERSION,
        "erro": str(mensagem)
    }), status


# ==========================================================================
# CONTEXTO OPERACIONAL
# ==========================================================================

def obter_contexto_operacional():
    equipe_id = normalizar_id_equipe(obter_id_equipe())
    departamento = obter_departamento()
    return {
        "equipe_id": equipe_id,
        "nome_empresa": obter_nome_empresa(),
        "departamento": departamento
    }


def exigir_equipe():
    equipe_id = normalizar_id_equipe(obter_id_equipe())
    if equipe_id is None:
        logger.warning("Operação recusada: equipe não identificada.")
        return None, resposta_erro("Equipe não identificada.", 401)
    return equipe_id, None
# ==========================================================================
# API — CONTEXTO
# ==========================================================================

@app.route("/api/contexto", methods=["GET"])
def api_contexto():
    contexto = obter_contexto_operacional()
    return resposta_sucesso(contexto)


# ==========================================================================
# API — EMPRESA
# ==========================================================================

@app.route("/api/empresa", methods=["GET"])
def api_empresa():
    equipe_id, erro = exigir_equipe()
    if erro:
        return erro
    return resposta_sucesso({
        "equipe_id": equipe_id,
        "nome_empresa": obter_nome_empresa()
    })


# ==========================================================================
# API — MÉTRICAS (MOTOR FINANCEIRO EXTERNO)
# ==========================================================================

@app.route("/api/metrics", methods=["GET"])
def api_metrics():
    equipe_id, erro = exigir_equipe()
    if erro:
        return erro

    departamento = obter_departamento()
    logger.info("Métricas solicitadas | equipe=%s | departamento=%s", equipe_id, departamento)

    try:
        metricas = calcular_metricas_totais_equipe(
            id_equipe=equipe_id,
            departamento_atual=departamento
        )

        if not isinstance(metricas, dict):
            logger.error("GerenciadorCaixa retornou tipo inválido.")
            return resposta_erro("Motor financeiro retornou resposta inválida.", 500)

        return resposta_sucesso(metricas, equipe_id=equipe_id, departamento=departamento)

    except Exception as exc:
        logger.exception("Erro no endpoint /api/metrics")
        return resposta_erro("Erro ao carregar as métricas financeiras.", 500)
# ==========================================================================
# API — RESUMO FINANCEIRO
# ==========================================================================

@app.route("/api/resumo", methods=["GET"])
def api_resumo():
    equipe_id, erro = exigir_equipe()
    if erro:
        return erro

    try:
        metricas = calcular_metricas_totais_equipe(id_equipe=equipe_id)
        return resposta_sucesso({
            "equipe_id": equipe_id,
            "nome_empresa": metricas.get("nome_empresa", obter_nome_empresa()),
            "capital_total": metricas.get("capital_total", 0.0),
            "capital_disponivel_total": metricas.get("capital_disponivel_total", 0.0),
            "patrimonio_ativo_total": metricas.get("patrimonio_ativo_total", 0.0),
            "custo_fixo_total": metricas.get("custo_fixo_total", 0.0),
            "custo_variavel_total": metricas.get("custo_variavel_total", 0.0)
        })
    except Exception:
        logger.exception("Erro no endpoint /api/resumo")
        return resposta_erro("Erro ao carregar o resumo da empresa.", 500)


# ==========================================================================
# API — DIAGNÓSTICO E SAÚDE DO CONTAINNER
# ==========================================================================

@app.route("/api/status", methods=["GET"])
def api_status():
    return resposta_sucesso({
        "status": "online",
        "arquitetura": "ERP PADRÃO",
        "multiempresa": True,
        "motor_financeiro": "GerenciadorCaixa.py",
        "frontend_metricas": "metrics.js"
    })


@app.route("/api/health", methods=["GET"])
def api_health():
    return resposta_sucesso({"status": "ok"})
# ==========================================================================
# COMPATIBILIDADE E LEGADO
# ==========================================================================

@app.route("/api/metrics/<int:equipe_id>", methods=["GET"])
def api_metrics_compatibilidade(equipe_id):
    departamento = obter_departamento()
    try:
        metricas = calcular_metricas_totais_equipe(id_equipe=equipe_id, departamento_atual=departamento)
        if not isinstance(metricas, dict):
            return resposta_erro("Motor financeiro retornou resposta inválida.", 500)
        return resposta_sucesso(metricas, equipe_id=equipe_id, departamento=departamento)
    except Exception:
        logger.exception("Erro no endpoint compatível de métricas.")
        return resposta_erro("Erro ao carregar as métricas financeiras.", 500)


# ==========================================================================
# 1º PASSO: INTERFACE DE INICIALIZAÇÃO (ADIÇÃO DE CAPITAL)
# ==========================================================================

@app.route("/configuracao/inicializacao", methods=["GET"])
def rota_inicializacao_html():
    """
    Interface obrigatória pós-login para as equipes aportarem o capital inicial.
    """
    if not session.get("logado"):
        from flask import redirect
        return redirect("/login")
        
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inicializacao.html")
    try:
        from flask import render_template_string
        with open(caminho, "r", encoding="utf-8") as arquivo:
            return render_template_string(arquivo.read())
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'inicializacao.html' não encontrado na raiz.", 404


# ==========================================================================
# 2º PASSO: INTERFACE DO FINANCEIRO (DISTRIBUIÇÃO DE QUOTAS)
# ==========================================================================

@app.route("/financeiro", methods=["GET"])
def rota_financeiro_html():
    """
    Interface do Departamento Financeiro acessada após a empresa ser inicializada.
    """
    if not session.get("logado"):
        from flask import redirect
        return redirect("/login")

    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), "financeiro.html")
    try:
        from flask import render_template_string
        with open(caminho, "r", encoding="utf-8") as arquivo:
            return render_template_string(arquivo.read())
    except FileNotFoundError:
        return "Erro Crítico: Interface 'financeiro.html' não encontrada na raiz.", 404


# ==========================================================================
# REGISTRO DE ROTAS EXTERNAS (BLUEPRINT DE LOGIN)
# ==========================================================================

from login.app_login import login_blueprint
app.register_blueprint(login_blueprint)


# ==========================================================================
# TRATAMENTO DE ERROS HTTP E EXECUÇÃO DO FLASK
# ==========================================================================

@app.errorhandler(404)
def erro_404(_erro):
    return resposta_erro("Recurso não encontrado.", 404)

@app.errorhandler(405)
def erro_405(_erro):
    return resposta_erro("Método não permitido.", 405)

@app.errorhandler(500)
def erro_500(_erro):
    logger.exception("Erro interno do servidor.")
    return resposta_erro("Erro interno do servidor.", 500)


if __name__ == "__main__":
    porta = int(os.environ.get("PORT", 5000))
    logger.info("==================================================")
    logger.info("%s | %s v%s", NOME_SISTEMA, NOME_ERP, APP_VERSION)
    logger.info("Porta Ativa: %s | Host: 0.0.0.0", porta)
    logger.info("==================================================")
    
    app.run(host="0.0.0.0", port=porta, debug=False)
