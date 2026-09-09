# ==========================================================================
# TERADMAS ERP v2.6
# MASTER.PY
#
# CAMADA CENTRAL DE ORQUESTRAÇÃO DO ERP PADRÃO
#
# Arquitetura:
#
#       USUÁRIO / EQUIPE
#              │
#              ▼
#       HTML + JavaScript
#              │
#              ▼
#           master.py
#              │
#       ┌──────┴──────┐
#       ▼             ▼
#  contexto       GerenciadorCaixa.py
#                       │
#                       ▼
#                  PostgreSQL
#
# PRINCÍPIO CENTRAL
#
# O MASTER NÃO É MOTOR DE CÁLCULO.
#
# Ele somente:
#
#   1. identifica a equipe;
#   2. identifica a empresa;
#   3. identifica o departamento;
#   4. recebe requisições das páginas;
#   5. encaminha para o módulo responsável;
#   6. padroniza as respostas;
#   7. mantém a arquitetura comum do ERP.
#
# A lógica financeira pertence exclusivamente ao
# GerenciadorCaixa.py.
#
# OBJETIVO DO ERP PADRÃO
#
# O sistema deve ser CORINGA:
#
#   indústria
#   comércio
#   serviços
#   agronegócio
#   logística
#   tecnologia
#   etc.
#
# O tipo de negócio não deve ser codificado no master.
#
# Cada equipe possui sua própria empresa e seus próprios dados.
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
# CONFIGURAÇÃO
# ==========================================================================

APP_VERSION = "2.6"

NOME_SISTEMA = "TERADMAS ERP"

NOME_ERP = "ERP PADRÃO"

# ==========================================================================
# LOG
# ==========================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger(__name__)

# ==========================================================================
# FLASK
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
    """
    Retorna a equipe atualmente responsável pela operação.

    Ordem de prioridade:

        1. sessão autenticada;
        2. parâmetro GET;
        3. parâmetro POST.

    A sessão deve ser a fonte normal em produção.

    equipe_id por requisição existe apenas para compatibilidade
    com testes e desenvolvimento.
    """

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
    """
    Normaliza o identificador sem obrigar a arquitetura
    a trabalhar exclusivamente com números.
    """

    if valor is None:
        return None

    try:
        return int(valor)
    except (TypeError, ValueError):
        valor = str(valor).strip()

        return valor if valor else None


# ==========================================================================
# EMPRESA
# ==========================================================================

def obter_nome_empresa():
    """
    Obtém o nome da empresa da sessão.

    O nome definitivo pode futuramente vir de uma tabela
    central de empresas sem alterar as páginas.
    """

    nome = session.get("nome_empresa")

    if nome:
        return str(nome).strip()

    return "GRUPO ACADÊMICO"


# ==========================================================================
# DEPARTAMENTO
# ==========================================================================

def obter_departamento():
    """
    Identifica o departamento atualmente aberto.

    Não existe lista fixa de departamentos aqui.

    Isso é proposital: o ERP deve permanecer genérico.
    """

    departamento = request.args.get("departamento")

    if not departamento:
        departamento = request.form.get("departamento")

    if not departamento:
        return None

    departamento = str(
        departamento
    ).strip().lower()

    return departamento or None


# ==========================================================================
# RESPOSTAS PADRONIZADAS
# ==========================================================================

def resposta_sucesso(dados=None, **extras):
    """
    Cria uma resposta JSON uniforme para todas as páginas.
    """

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
    """
    Cria uma resposta JSON uniforme de erro.
    """

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
    """
    Monta o contexto comum utilizado pelas páginas.

    Nenhum cálculo financeiro é realizado aqui.
    """

    equipe_id = normalizar_id_equipe(
        obter_id_equipe()
    )

    departamento = obter_departamento()

    return {
        "equipe_id": equipe_id,
        "nome_empresa": obter_nome_empresa(),
        "departamento": departamento
    }


def exigir_equipe():
    """
    Garante que uma operação empresarial esteja vinculada
    a uma equipe.

    Retorna:

        (equipe_id, None)

    ou:

        (None, resposta_de_erro)
    """

    equipe_id = normalizar_id_equipe(
        obter_id_equipe()
    )

    if equipe_id is None:

        logger.warning(
            "Operação recusada: equipe não identificada."
        )

        return (
            None,
            resposta_erro(
                "Equipe não identificada.",
                401
            )
        )

    return equipe_id, None
# ==========================================================================
# API — CONTEXTO
# ==========================================================================

@app.route(
    "/api/contexto",
    methods=["GET"]
)
def api_contexto():
    """
    Retorna o contexto da operação.

    Utilizado pelas páginas para saber:

        equipe
        empresa
        departamento

    Não consulta métricas.
    Não calcula valores.
    """

    contexto = obter_contexto_operacional()

    return resposta_sucesso(
        contexto
    )


# ==========================================================================
# API — EMPRESA
# ==========================================================================

@app.route(
    "/api/empresa",
    methods=["GET"]
)
def api_empresa():
    """
    Retorna a identidade da empresa atualmente operada.
    """

    equipe_id, erro = exigir_equipe()

    if erro:
        return erro

    return resposta_sucesso({

        "equipe_id":
            equipe_id,

        "nome_empresa":
            obter_nome_empresa()

    })


# ==========================================================================
# API — MÉTRICAS
# ==========================================================================

@app.route(
    "/api/metrics",
    methods=["GET"]
)
def api_metrics():
    """
    Endpoint central utilizado pelo metrics.js.

    IMPORTANTE:

    O master NÃO calcula nenhuma métrica.

    Ele apenas entrega ao GerenciadorCaixa.py:

        equipe_id
        departamento

    e devolve o resultado.
    """

    equipe_id, erro = exigir_equipe()

    if erro:
        return erro

    departamento = obter_departamento()

    logger.info(
        "Métricas solicitadas | equipe=%s | departamento=%s",
        equipe_id,
        departamento
    )

    try:

        metricas = calcular_metricas_totais_equipe(
            id_equipe=equipe_id,
            departamento_atual=departamento
        )

        if not isinstance(metricas, dict):

            logger.error(
                "GerenciadorCaixa retornou tipo inválido."
            )

            return resposta_erro(
                "Motor financeiro retornou resposta inválida.",
                500
            )

        return resposta_sucesso(
            metricas,
            equipe_id=equipe_id,
            departamento=departamento
        )

    except Exception as exc:

        logger.exception(
            "Erro no endpoint /api/metrics"
        )

        return resposta_erro(
            "Erro ao carregar as métricas financeiras.",
            500
        )
# ==========================================================================
# API — RESUMO
# ==========================================================================

@app.route(
    "/api/resumo",
    methods=["GET"]
)
def api_resumo():
    """
    Retorna o resumo financeiro da empresa.

    IMPORTANTE:

    Não existe fórmula financeira diferente aqui.

    O resumo utiliza o mesmo motor de métricas.

    Isso impede que uma página apresente um capital diferente
    daquele apresentado por outra.
    """

    equipe_id, erro = exigir_equipe()

    if erro:
        return erro

    try:

        metricas = calcular_metricas_totais_equipe(
            id_equipe=equipe_id
        )

        return resposta_sucesso({

            "equipe_id":
                equipe_id,

            "nome_empresa":
                metricas.get(
                    "nome_empresa",
                    obter_nome_empresa()
                ),

            "capital_total":
                metricas.get(
                    "capital_total",
                    0.0
                ),

            "capital_disponivel_total":
                metricas.get(
                    "capital_disponivel_total",
                    0.0
                ),

            "patrimonio_ativo_total":
                metricas.get(
                    "patrimonio_ativo_total",
                    0.0
                ),

            "custo_fixo_total":
                metricas.get(
                    "custo_fixo_total",
                    0.0
                ),

            "custo_variavel_total":
                metricas.get(
                    "custo_variavel_total",
                    0.0
                )

        })

    except Exception:

        logger.exception(
            "Erro no endpoint /api/resumo"
        )

        return resposta_erro(
            "Erro ao carregar o resumo da empresa.",
            500
        )


# ==========================================================================
# API — STATUS
# ==========================================================================

@app.route(
    "/api/status",
    methods=["GET"]
)
def api_status():
    """
    Diagnóstico básico do ERP.
    """

    return resposta_sucesso({

        "status":
            "online",

        "arquitetura":
            "ERP PADRÃO",

        "multiempresa":
            True,

        "motor_financeiro":
            "GerenciadorCaixa.py",

        "frontend_metricas":
            "metrics.js"

    })


# ==========================================================================
# API — SAÚDE
# ==========================================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def api_health():
    """
    Endpoint mínimo para verificar se o servidor Flask
    está respondendo.

    Não acessa o banco e não executa cálculos.
    """

    return resposta_sucesso({

        "status":
            "ok"

    })
# ==========================================================================
# COMPATIBILIDADE
# ==========================================================================

@app.route(
    "/api/metrics/<int:equipe_id>",
    methods=["GET"]
)
def api_metrics_compatibilidade(equipe_id):
    """
    Compatibilidade com páginas antigas que eventualmente
    chamem:

        /api/metrics/12

    A lógica continua sendo a mesma.

    O cálculo permanece exclusivamente no GerenciadorCaixa.py.
    """

    departamento = obter_departamento()

    logger.info(
        "Métricas compatibilidade | equipe=%s | departamento=%s",
        equipe_id,
        departamento
    )

    try:

        metricas = calcular_metricas_totais_equipe(
            id_equipe=equipe_id,
            departamento_atual=departamento
        )

        if not isinstance(metricas, dict):

            return resposta_erro(
                "Motor financeiro retornou resposta inválida.",
                500
            )

        return resposta_sucesso(
            metricas,
            equipe_id=equipe_id,
            departamento=departamento
        )

    except Exception:

        logger.exception(
            "Erro no endpoint compatível de métricas."
        )

        return resposta_erro(
            "Erro ao carregar as métricas financeiras.",
            500
        )


# ==========================================================================
# REGISTRO DE ROTAS EXTERNAS (BLUEPRINTS)
# ==========================================================================

# Substitua 'login_blueprint_file' pelo nome do arquivo python que contém seu login
from login_blueprint_file import login_blueprint
app.register_blueprint(login_blueprint)


# ==========================================================================
# ERROS HTTP
# ==========================================================================

@app.errorhandler(404)
def erro_404(_erro):

    return resposta_erro(
        "Recurso não encontrado.",
        404
    )


@app.errorhandler(405)
def erro_405(_erro):

    return resposta_erro(
        "Método não permitido.",
        405
    )


@app.errorhandler(500)
def erro_500(_erro):

    logger.exception(
        "Erro interno do servidor."
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
        "%s", NOME_SISTEMA
    )

    logger.info(
        "%s", NOME_ERP
    )

    logger.info(
        "Versão: %s",
        APP_VERSION
    )

    logger.info(
        "Arquitetura: multiempresa"
    )

    logger.info(
        "Motor financeiro: GerenciadorCaixa.py"
    )

    logger.info(
        "=================================================="
    )

    app.run(
        host="0.0.0.0",
        port=porta,
        debug=False
    )
