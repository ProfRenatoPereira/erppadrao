# ==========================================================================
# TERADMAS ERP v2.6
# MASTER.PY
#
# CAMADA CENTRAL DE INTEGRAÇÃO
#
# Responsabilidades:
#
#   HTML / JS
#        ↓
#      master.py
#        ↓
# GerenciadorCaixa.py
#        ↓
#    PostgreSQL
#
# O master NÃO calcula patrimônio, capital de giro ou custos.
# Ele apenas:
#
#   - identifica a equipe/empresa autenticada;
#   - recebe parâmetros;
#   - chama o motor financeiro;
#   - devolve JSON padronizado;
#   - fornece informações básicas da empresa;
#   - mantém uma interface comum para todas as pastas.
#
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
# LOG
# ==========================================================================

logging.basicConfig(
    level=logging.INFO
)

logger = logging.getLogger(__name__)


# ==========================================================================
# APLICAÇÃO
# ==========================================================================

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "teradmas-chave-local"
)


# ==========================================================================
# CONFIGURAÇÃO
# ==========================================================================

APP_VERSION = "2.6"

NOME_SISTEMA = "TERADMAS ERP"

NOME_ERP = "ERP PADRÃO"


# ==========================================================================
# AUXILIARES
# ==========================================================================

def obter_id_equipe():
    """
    Obtém a equipe atualmente conectada.

    Prioridade:

        1. sessão
        2. parâmetro da requisição

    Em produção, a sessão/autenticação deve ser a fonte principal.

    O parâmetro equipe_id é mantido para compatibilidade
    durante o desenvolvimento e testes.
    """

    equipe_id = session.get("equipe_id")

    if equipe_id:
        return equipe_id

    equipe_id = request.args.get(
        "equipe_id"
    )

    if equipe_id:
        return equipe_id

    equipe_id = request.form.get(
        "equipe_id"
    )

    return equipe_id


# --------------------------------------------------------------------------
# Departamento
# --------------------------------------------------------------------------

def obter_departamento():
    """
    Obtém o departamento atualmente visualizado.
    """

    departamento = request.args.get(
        "departamento"
    )

    if not departamento:
        departamento = request.form.get(
            "departamento"
        )

    if not departamento:
        return None

    return (
        str(departamento)
        .strip()
        .lower()
    )


# --------------------------------------------------------------------------
# Conversão segura
# --------------------------------------------------------------------------

def converter_id_equipe(valor):
    """
    Converte equipe_id para inteiro quando possível.

    Mantém strings quando o sistema eventualmente utilizar
    identificadores não numéricos.
    """

    if valor is None:
        return None

    try:
        return int(valor)

    except (TypeError, ValueError):

        return str(valor).strip()


# ==========================================================================
# RESPOSTA PADRÃO
# ==========================================================================

def resposta_sucesso(
    dados=None,
    **extras
):
    """
    Padroniza respostas JSON.
    """

    resposta = {

        "sucesso": True,

        "sistema": NOME_SISTEMA,

        "erp": NOME_ERP,

        "versao": APP_VERSION

    }

    if dados is not None:

        resposta.update(dados)

    resposta.update(
        extras
    )

    return jsonify(
        resposta
    )


def resposta_erro(
    mensagem,
    status=400
):
    """
    Padroniza respostas de erro.
    """

    return jsonify({

        "sucesso": False,

        "sistema": NOME_SISTEMA,

        "erp": NOME_ERP,

        "versao": APP_VERSION,

        "erro": mensagem

    }), status


# ==========================================================================
# IDENTIFICAÇÃO DA EMPRESA
# ==========================================================================

@app.route(
    "/api/empresa",
    methods=["GET"]
)
def api_empresa():
    """
    Retorna a identificação básica da empresa.

    Não duplica dados financeiros.

    Os dados financeiros continuam vindo do
    GerenciadorCaixa.py.
    """

    equipe_id = obter_id_equipe()

    if not equipe_id:

        return resposta_erro(
            "Equipe não identificada.",
            401
        )

    equipe_id = converter_id_equipe(
        equipe_id
    )

    return resposta_sucesso({

        "equipe_id": equipe_id,

        "nome_empresa": (
            session.get(
                "nome_empresa",
                "GRUPO ACADÊMICO"
            )
        )

    })


# ==========================================================================
# MÉTRICAS FINANCEIRAS
# ==========================================================================

@app.route(
    "/api/metrics",
    methods=["GET"]
)
def api_metrics():
    """
    Endpoint principal utilizado pelo metrics.js.

    O master recebe a identificação da equipe
    e delega TODO o cálculo ao GerenciadorCaixa.py.
    """

    equipe_id = obter_id_equipe()

    if not equipe_id:

        logger.warning(
            "⚠️ /api/metrics solicitado sem equipe_id"
        )

        return resposta_erro(
            "Equipe não identificada.",
            401
        )


    equipe_id = converter_id_equipe(
        equipe_id
    )


    departamento = obter_departamento()


    logger.info(
        "📊 Solicitação de métricas | "
        f"Equipe={equipe_id} | "
        f"Departamento={departamento}"
    )


    try:

        metricas = (
            calcular_metricas_totais_equipe(
                id_equipe=equipe_id,
                departamento_atual=departamento
            )
        )


        if not isinstance(
            metricas,
            dict
        ):

            raise RuntimeError(
                "Motor financeiro retornou resposta inválida."
            )


        return resposta_sucesso(
            metricas,
            equipe_id=equipe_id,
            departamento=departamento
        )


    except Exception as erro:

        logger.exception(
            "❌ Erro ao obter métricas financeiras"
        )

        return resposta_erro(
            str(erro),
            500
        )


# ==========================================================================
# RESUMO DA EMPRESA
# ==========================================================================

@app.route(
    "/api/resumo",
    methods=["GET"]
)
def api_resumo():
    """
    Endpoint simplificado para páginas que precisam
    carregar o painel inicial.

    Utiliza o mesmo motor financeiro.

    NÃO existe um segundo cálculo.
    """

    equipe_id = obter_id_equipe()

    if not equipe_id:

        return resposta_erro(
            "Equipe não identificada.",
            401
        )


    equipe_id = converter_id_equipe(
        equipe_id
    )


    try:

        metricas = (
            calcular_metricas_totais_equipe(
                id_equipe=equipe_id
            )
        )


        return resposta_sucesso({

            "equipe_id": equipe_id,

            "nome_empresa":
                metricas.get(
                    "nome_empresa",
                    "GRUPO ACADÊMICO"
                ),

            "capital_total":
                metricas.get(
                    "capital_total",
                    0
                ),

            "capital_disponivel_total":
                metricas.get(
                    "capital_disponivel_total",
                    0
                ),

            "patrimonio_ativo_total":
                metricas.get(
                    "patrimonio_ativo_total",
                    0
                ),

            "custo_fixo_total":
                metricas.get(
                    "custo_fixo_total",
                    0
                ),

            "custo_variavel_total":
                metricas.get(
                    "custo_variavel_total",
                    0
                )

        })


    except Exception as erro:

        logger.exception(
            "❌ Erro no resumo da empresa"
        )

        return resposta_erro(
            str(erro),
            500
        )


# ==========================================================================
# STATUS DO ERP
# ==========================================================================

@app.route(
    "/api/status",
    methods=["GET"]
)
def api_status():
    """
    Verificação simples de funcionamento.
    """

    return resposta_sucesso({

        "status": "online",

        "motor_financeiro":
            "GerenciadorCaixa.py",

        "arquitetura":
            "ERP PADRÃO",

        "multiempresa": True,

        "versao": APP_VERSION

    })


# ==========================================================================
# CONTEXTO DA SESSÃO
# ==========================================================================

@app.route(
    "/api/contexto",
    methods=["GET"]
)
def api_contexto():
    """
    Retorna o contexto operacional atual.

    A página pode usar isso para saber:

        - qual equipe está logada;
        - qual empresa está sendo operada;
        - qual departamento está aberto.

    """

    equipe_id = obter_id_equipe()

    departamento = obter_departamento()


    return resposta_sucesso({

        "equipe_id":
            converter_id_equipe(
                equipe_id
            )
            if equipe_id
            else None,

        "nome_empresa":
            session.get(
                "nome_empresa"
            ),

        "departamento":
            departamento

    })


# ==========================================================================
# TRATAMENTO GLOBAL DE ERROS
# ==========================================================================

@app.errorhandler(404)
def erro_404(erro):

    return resposta_erro(
        "Recurso não encontrado.",
        404
    )


@app.errorhandler(405)
def erro_405(erro):

    return resposta_erro(
        "Método não permitido.",
        405
    )


@app.errorhandler(500)
def erro_500(erro):

    logger.exception(
        "❌ Erro interno do servidor"
    )

    return resposta_erro(
        "Erro interno do servidor.",
        500
    )


# ==========================================================================
# EXECUÇÃO
# ==========================================================================

if __name__ == "__main__":

    porta = int(
        os.environ.get(
            "PORT",
            5000
        )
    )


    logger.info(
        "=================================================="
    )

    logger.info(
        f"🚀 {NOME_SISTEMA}"
    )

    logger.info(
        f"📦 {NOME_ERP}"
    )

    logger.info(
        f"🔢 Versão {APP_VERSION}"
    )

    logger.info(
        "💰 Motor: GerenciadorCaixa.py"
    )

    logger.info(
        "🏢 Arquitetura: multiempresa"
    )

    logger.info(
        "=================================================="
    )


    app.run(
        host="0.0.0.0",
        port=porta,
        debug=False
    )
