# TERADMAS ERP v2.6 - master.py

import os
import sys
import logging
from datetime import timedelta
from flask import Flask, jsonify, redirect

# Compatibilidade: módulos existentes importam URL_SUPABASE de app_master.
sys.modules.setdefault("app_master", sys.modules[__name__])

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("TERADMAS.master")

URL_SUPABASE = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("SUPABASE_DB_URL")
    or os.environ.get("URL_SUPABASE")
)

app = Flask(__name__)
app.config["SECRET_KEY"] = (
    os.environ.get("SECRET_KEY")
    or os.environ.get("FLASK_SECRET_KEY")
    or "TERADMAS-ERP-v2.6-session-key"
)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)
app.config["JSON_AS_ASCII"] = False


def registrar_blueprint(modulo, nomes_blueprint):
    try:
        mod = __import__(modulo, fromlist=["*"])
    except Exception as erro:
        logger.warning("Módulo %s não registrado: %s", modulo, erro)
        return False

    for nome in nomes_blueprint:
        bp = getattr(mod, nome, None)
        if bp is not None:
            try:
                app.register_blueprint(bp)
                logger.info("Blueprint registrado: %s <- %s", nome, modulo)
                return True
            except ValueError as erro:
                logger.warning("Blueprint %s não registrado: %s", nome, erro)
                return False

    return False


# O LOGIN É REGISTRADO PRIMEIRO.
login_registrado = (
    registrar_blueprint("login.app_login", ("login_blueprint",))
    or registrar_blueprint("login", ("login_blueprint",))
)

registrar_blueprint(
    "configuracao.app_configuracao",
    ("configuracao_blueprint",),
)

registrar_blueprint(
    "financeiro.app_financeiro",
    ("financeiro_blueprint",),
)

# Módulos existentes são registrados somente se possuírem o Blueprint esperado.
MODULOS_OPERACIONAIS = (
    ("estrutura", ("estrutura_blueprint",)),
    ("orcamentos", ("orcamentos_blueprint",)),
    ("rh", ("rh_blueprint",)),
    ("folha_pagamento", ("folha_pagamento_blueprint",)),
    ("requisicoes", ("requisicoes_blueprint",)),
    ("maquinas", ("maquinas_blueprint",)),
    ("materiais", ("materiais_blueprint",)),
    ("processos", ("processos_blueprint",)),
    ("produtos", ("produtos_blueprint",)),
    ("manutencao", ("manutencao_blueprint",)),
    ("precificacao", ("precificacao_blueprint",)),
    ("compras_insumos", ("compras_insumos_blueprint",)),
    ("pcp", ("pcp_blueprint",)),
    ("engenharia_producao", ("engenharia_producao_blueprint",)),
    ("estoque", ("estoque_blueprint",)),
    ("nota_fiscal", ("nota_fiscal_blueprint",)),
    ("clientes", ("clientes_blueprint",)),
    ("vendas", ("vendas_blueprint",)),
    ("roi", ("roi_blueprint",)),
)

for modulo, nomes in MODULOS_OPERACIONAIS:
    registrar_blueprint(modulo, nomes)


@app.route("/", methods=["GET"])
def rota_raiz():
    return redirect("/login")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "sucesso": True,
        "erp": "TERADMAS",
        "sistema": "TERADMAS ERP",
        "versao": "2.6",
        "login_registrado": bool(login_registrado),
    }), 200


@app.errorhandler(404)
def erro_404(_erro):
    return jsonify({
        "erp": "TERADMAS",
        "erro": "Recurso não encontrado.",
        "sistema": "TERADMAS ERP",
        "sucesso": False,
        "versao": "2.6",
    }), 404


@app.errorhandler(405)
def erro_405(_erro):
    return jsonify({
        "erp": "TERADMAS",
        "erro": "Método HTTP não permitido.",
        "sistema": "TERADMAS ERP",
        "sucesso": False,
        "versao": "2.6",
    }), 405


application = app


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
