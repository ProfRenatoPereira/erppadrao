# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE ATIVOS (MÁQUINAS)
# app_maquinas.py
#
# VERSÃO INTEGRADA AO MOTOR FINANCEIRO CENTRAL
#
# REGRAS:
# - Conexão exclusivamente por GerenciadorCaixa.
# - Nunca fechar diretamente conexão devolvida pelo pool.
# - Isolamento por equipe_id vindo da sessão.
# - Máquinas físicas continuam classificadas como PRODUCAO em erp_maquinas.
# - O orçamento do módulo vem da quota oficial "maquinas" em
#   quotas_departamentos.
# - A quota é calculada sobre o CAPITAL INICIAL.
# - O saldo de aquisição é:
#       valor_da_quota - patrimonio_atual_do_setor
# - Não existe regra fixa de 40%, R$ 5 milhões ou R$ 2 milhões.
# - Não cria lançamentos financeiros automaticamente ao cadastrar uma máquina.
# - Pesquisa técnica de equipamentos pode utilizar Google Custom Search API.
# - A chave da API Google permanece exclusivamente no servidor.
# ==========================================================================

import os
import json
import logging
import urllib.parse
import urllib.request
import urllib.error

from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    redirect,
)

from psycopg2.extras import RealDictCursor

from GerenciadorCaixa import (
    obter_conexao_master,
    liberar_conexao_master,
)


logger = logging.getLogger(__name__)

maquinas_blueprint = Blueprint("maquinas_blueprint", __name__)


# ==========================================================================
# CONTEXTO / SEGURANÇA
# ==========================================================================

def equipe_atual():
    """
    Retorna exclusivamente o tenant definido pela sessão.

    Nenhum ID de equipe recebido pelo navegador é utilizado para
    selecionar dados de outro tenant.
    """
    return str(session.get("id_equipe", "equipe_alfa"))


def autenticado():
    """Verifica se o usuário está autenticado."""
    return bool(session.get("logado"))


def empresa_inicializada():
    """Verifica se a equipe já realizou a constituição do negócio."""
    return bool(session.get("empresa_inicializada"))


# ==========================================================================
# BANCO - ESTRUTURA DA TABELA
# ==========================================================================

def garantir_tabela_maquinas(cursor):
    """
    Garante somente a estrutura técnica necessária para o CRUD de máquinas.

    A tabela pode ser compartilhada com outros módulos. Por isso,
    esta rotina adiciona apenas as colunas necessárias ao cadastro.

    Não cria:
      - quotas;
      - lançamentos financeiros;
      - orçamento automático;
      - distribuição percentual;
      - patrimônio fictício.
    """

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS erp_maquinas (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento TEXT DEFAULT 'PRODUCAO'
        )
        """
    )

    colunas = {
        "nome_equipamento": "TEXT",
        "potencia": "REAL",
        "consumo_eletrico": "REAL",
        "consumo_agua": "REAL",
        "consumo_gases": "REAL",
        "velocidade": "TEXT",
        "avanco": "TEXT",
        "frequencia_manutencao": "INTEGER",
        "preco_compra": "REAL",
        "depreciacao_mensal": "REAL",
        "valor_venda_final": "REAL",
        "operador_nome": "TEXT",
        "custo_minuto_operador": "REAL",
        "custo_minuto_maquina": "REAL",
        "jornada_semanal": "TEXT",
        "turnos_trabalho": "TEXT",
        "is_patrimonio": "BOOLEAN",
    }

    for nome, tipo in colunas.items():
        cursor.execute(
            f"""
            ALTER TABLE erp_maquinas
            ADD COLUMN IF NOT EXISTS {nome} {tipo}
            """
        )


# ==========================================================================
# CONVERSÃO NUMÉRICA
# ==========================================================================

def numero(dados, campo, padrao=0.0):
    """
    Converte números recebidos do JavaScript.

    Aceita:
      100
      100.50
      "100"
      "100.50"
      ""

    Não deixa erro de conversão derrubar silenciosamente o servidor.
    """

    valor = dados.get(campo, padrao)

    if valor in (None, ""):
        return float(padrao)

    if isinstance(valor, str):
        valor = valor.strip()

        # Compatibilidade com valores brasileiros:
        # 1.234,56 -> 1234.56
        if "," in valor and "." in valor:
            valor = valor.replace(".", "").replace(",", ".")
        elif "," in valor:
            valor = valor.replace(",", ".")

    try:
        return float(valor)
    except (TypeError, ValueError):
        return float(padrao)


# ==========================================================================
# PÁGINA PRINCIPAL
# ==========================================================================

@maquinas_blueprint.route("/maquinas", methods=["GET"])
def pagina_maquinas():

    if not autenticado():
        return redirect("/login")

    if not empresa_inicializada():
        return redirect("/configuracao/inicializacao")

    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(
        diretorio_atual,
        "maquinas.html",
    )

    try:
        with open(
            caminho_html,
            "r",
            encoding="utf-8",
        ) as arquivo:
            html = arquivo.read()

        return render_template_string(html)

    except FileNotFoundError:
        return (
            "Erro Crítico: Arquivo 'maquinas.html' não encontrado.",
            404,
        )

    except Exception as erro:
        logger.exception(
            "Erro ao renderizar máquinas: %s",
            erro,
        )

        return (
            "Erro ao carregar o módulo de máquinas.",
            500,
        )


# ==========================================================================
# JAVASCRIPT
# ==========================================================================

@maquinas_blueprint.route(
    "/maquinas/maquinas.js",
    methods=["GET"],
)
def rota_maquinas_js():

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_js = os.path.join(
        diretorio_atual,
        "maquinas.js",
    )

    try:
        with open(
            caminho_js,
            "r",
            encoding="utf-8",
        ) as arquivo:
            js_conteudo = arquivo.read()

        return (
            js_conteudo,
            200,
            {
                "Content-Type":
                    "application/javascript; charset=utf-8"
            },
        )

    except FileNotFoundError:
        return (
            "console.error('Script de máquinas não encontrado.');",
            404,
            {
                "Content-Type":
                    "application/javascript; charset=utf-8"
            },
        )


# ==========================================================================
# ORÇAMENTO DO MÓDULO
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/orcamento",
    methods=["GET"],
)
def api_orcamento_maquinas():
    """
    Ponte Financeiro -> Máquinas.

    Fonte:

      capital inicial
        config_simulacao.capital_total

      quota de máquinas
        quotas_departamentos.departamento_id = 'maquinas'

      patrimônio atual
        erp_maquinas
        departamento = 'PRODUCAO'
        is_patrimonio = TRUE

    Regra:

      valor_quota =
          capital_inicial * porcentagem_quota / 100

      saldo_aquisicao =
          valor_quota - patrimonio_atual
    """

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
            }
        ), 401

    conexao = None
    cursor = None

    try:

        id_equipe = equipe_atual()

        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError(
                "Não foi possível obter conexão com o banco."
            )

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ------------------------------------------------------------------
        # 1. CAPITAL INICIAL
        # ------------------------------------------------------------------

        cursor.execute(
            """
            SELECT capital_total
            FROM config_simulacao
            WHERE equipe_id = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (id_equipe,),
        )

        config = cursor.fetchone()

        capital_inicial = float(
            (config or {}).get("capital_total") or 0
        )

        # ------------------------------------------------------------------
        # 2. QUOTA OFICIAL DE MÁQUINAS
        # ------------------------------------------------------------------

        cursor.execute(
            """
            SELECT
                COALESCE(
                    porcentagem_quota,
                    0
                ) AS porcentagem_quota
            FROM quotas_departamentos
            WHERE equipe_id = %s
              AND LOWER(
                    TRIM(departamento_id)
                  ) = 'maquinas'
            LIMIT 1
            """,
            (id_equipe,),
        )

        quota = cursor.fetchone()

        porcentagem_quota = float(
            (quota or {}).get(
                "porcentagem_quota"
            ) or 0
        )

        porcentagem_quota = max(
            0.0,
            min(
                100.0,
                porcentagem_quota,
            ),
        )

        # ------------------------------------------------------------------
        # 3. VALOR DA QUOTA
        #
        # SEMPRE sobre o capital inicial.
        #
        # Não usar capital disponível/giro como base.
        # ------------------------------------------------------------------

        valor_quota = (
            capital_inicial
            * porcentagem_quota
            / 100.0
        )

        # ------------------------------------------------------------------
        # 4. GARANTE ESTRUTURA
        # ------------------------------------------------------------------

        garantir_tabela_maquinas(cursor)

        # ------------------------------------------------------------------
        # 5. PATRIMÔNIO ATUAL
        # ------------------------------------------------------------------

        cursor.execute(
            """
            SELECT
                COALESCE(
                    SUM(
                        COALESCE(
                            preco_compra,
                            0
                        )
                    ),
                    0
                ) AS patrimonio_atual
            FROM erp_maquinas
            WHERE equipe_id = %s
              AND departamento = 'PRODUCAO'
              AND COALESCE(
                    is_patrimonio,
                    TRUE
                  ) = TRUE
            """,
            (id_equipe,),
        )

        patrimonio = cursor.fetchone()

        patrimonio_atual = float(
            (patrimonio or {}).get(
                "patrimonio_atual"
            ) or 0
        )

        # ------------------------------------------------------------------
        # 6. SALDO DA QUOTA
        # ------------------------------------------------------------------

        saldo_aquisicao = max(
            0.0,
            valor_quota - patrimonio_atual,
        )

        conexao.commit()

        return jsonify(
            {
                "status": "sucesso",
                "equipe_id": id_equipe,

                "capital_inicial": round(
                    capital_inicial,
                    2,
                ),

                "porcentagem_quota": round(
                    porcentagem_quota,
                    2,
                ),

                "valor_quota": round(
                    valor_quota,
                    2,
                ),

                "patrimonio_atual": round(
                    patrimonio_atual,
                    2,
                ),

                "saldo_aquisicao": round(
                    saldo_aquisicao,
                    2,
                ),
            }
        ), 200

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "Erro ao carregar orçamento de máquinas: %s",
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível carregar "
                    "o orçamento de Máquinas.",
                "erro": str(erro),
            }
        ), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# LISTAGEM
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/listar",
    methods=["GET"],
)
def api_listar_maquinas():

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
            }
        ), 401

    conexao = None
    cursor = None

    try:

        id_equipe = equipe_atual()

        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError(
                "Não foi possível obter conexão com o banco."
            )

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabela_maquinas(cursor)

        conexao.commit()

        cursor.execute(
            """
            SELECT *
            FROM erp_maquinas
            WHERE equipe_id = %s
              AND (
                    departamento = 'PRODUCAO'
                    OR departamento IS NULL
                  )
            ORDER BY id DESC
            """,
            (id_equipe,),
        )

        registros = cursor.fetchall()

        return jsonify(
            [dict(registro) for registro in registros]
        ), 200

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "Erro ao listar máquinas: %s",
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível listar as máquinas.",
                "dados": [],
            }
        ), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# SALVAR
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/salvar",
    methods=["POST"],
)
def api_salvar_maquina():

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
            }
        ), 401

    if not empresa_inicializada():
        return jsonify(
            {
                "status": "erro",
                "message":
                    "A empresa ainda não foi inicializada.",
            }
        ), 403

    dados = request.get_json(
        silent=True
    ) or {}

    id_reg = dados.get("id")

    id_equipe = equipe_atual()

    nome_eq = str(
        dados.get(
            "nome_equipamento",
            "",
        ) or ""
    ).strip()

    if not nome_eq:
        return jsonify(
            {
                "status": "erro",
                "message":
                    "Nome do equipamento é obrigatório.",
            }
        ), 400

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError(
                "Não foi possível obter conexão com o banco."
            )

        cursor = conexao.cursor()

        garantir_tabela_maquinas(cursor)

        # ------------------------------------------------------------------
        # DADOS TÉCNICOS
        # ------------------------------------------------------------------

        pot = numero(
            dados,
            "potencia",
        )

        c_ele = numero(
            dados,
            "consumo_eletrico",
        )

        c_agu = numero(
            dados,
            "consumo_agua",
        )

        c_gas = numero(
            dados,
            "consumo_gases",
        )

        vel = str(
            dados.get(
                "velocidade",
                "",
            ) or ""
        ).strip()

        avc = str(
            dados.get(
                "avanco",
                "",
            ) or ""
        ).strip()

        try:
            frq = int(
                dados.get(
                    "frequencia_manutencao",
                    0,
                ) or 0
            )
        except (
            TypeError,
            ValueError,
        ):
            frq = 0

        prc = numero(
            dados,
            "preco_compra",
        )

        dep = numero(
            dados,
            "depreciacao_mensal",
        )

        rsd = numero(
            dados,
            "valor_venda_final",
        )

        # ------------------------------------------------------------------
        # OPERADOR / CUSTO
        # ------------------------------------------------------------------

        op_n = str(
            dados.get(
                "operador_nome",
                "",
            ) or ""
        ).strip()

        c_op = numero(
            dados,
            "custo_minuto_operador",
        )

        c_mq = numero(
            dados,
            "custo_minuto_maquina",
        )

        jor = str(
            dados.get(
                "jornada_semanal",
                "44",
            ) or "44"
        ).strip()

        tur = str(
            dados.get(
                "turnos_trabalho",
                "1",
            ) or "1"
        ).strip()

        # ------------------------------------------------------------------
        # PATRIMÔNIO
        # ------------------------------------------------------------------

        isp = dados.get(
            "is_patrimonio",
            True,
        )

        if isinstance(isp, str):

            isp = isp.lower() in (
                "true",
                "1",
                "sim",
                "yes",
            )

        else:
            isp = bool(isp)

        # ------------------------------------------------------------------
        # CLASSIFICAÇÃO FÍSICA
        #
        # A página é Máquinas.
        #
        # A quota é "maquinas".
        #
        # O ativo físico produtivo continua sendo PRODUCAO.
        # ------------------------------------------------------------------

        departamento = "PRODUCAO"

        # ==================================================================
        # ATUALIZAÇÃO
        # ==================================================================

        if id_reg:

            try:
                id_reg_int = int(id_reg)
            except (
                TypeError,
                ValueError,
            ):

                return jsonify(
                    {
                        "status": "erro",
                        "message":
                            "Identificador da máquina inválido.",
                    }
                ), 400

            cursor.execute(
                """
                UPDATE erp_maquinas
                SET
                    nome_equipamento = %s,
                    potencia = %s,
                    consumo_eletrico = %s,
                    consumo_agua = %s,
                    consumo_gases = %s,
                    velocidade = %s,
                    avanco = %s,
                    frequencia_manutencao = %s,
                    preco_compra = %s,
                    depreciacao_mensal = %s,
                    valor_venda_final = %s,
                    operador_nome = %s,
                    custo_minuto_operador = %s,
                    custo_minuto_maquina = %s,
                    jornada_semanal = %s,
                    turnos_trabalho = %s,
                    is_patrimonio = %s,
                    departamento = %s
                WHERE id = %s
                  AND equipe_id = %s
                  AND (
                        departamento = 'PRODUCAO'
                        OR departamento IS NULL
                      )
                """,
                (
                    nome_eq,
                    pot,
                    c_ele,
                    c_agu,
                    c_gas,
                    vel,
                    avc,
                    frq,
                    prc,
                    dep,
                    rsd,
                    op_n,
                    c_op,
                    c_mq,
                    jor,
                    tur,
                    isp,
                    departamento,
                    id_reg_int,
                    id_equipe,
                ),
            )

            if cursor.rowcount == 0:

                conexao.rollback()

                return jsonify(
                    {
                        "status": "erro",
                        "message":
                            "Máquina não encontrada "
                            "para esta equipe.",
                    }
                ), 404

        # ==================================================================
        # NOVO CADASTRO
        # ==================================================================

        else:

            cursor.execute(
                """
                INSERT INTO erp_maquinas (
                    equipe_id,
                    nome_equipamento,
                    potencia,
                    consumo_eletrico,
                    consumo_agua,
                    consumo_gases,
                    velocidade,
                    avanco,
                    frequencia_manutencao,
                    preco_compra,
                    depreciacao_mensal,
                    valor_venda_final,
                    operador_nome,
                    custo_minuto_operador,
                    custo_minuto_maquina,
                    jornada_semanal,
                    turnos_trabalho,
                    is_patrimonio,
                    departamento
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    id_equipe,
                    nome_eq,
                    pot,
                    c_ele,
                    c_agu,
                    c_gas,
                    vel,
                    avc,
                    frq,
                    prc,
                    dep,
                    rsd,
                    op_n,
                    c_op,
                    c_mq,
                    jor,
                    tur,
                    isp,
                    departamento,
                ),
            )

        # ------------------------------------------------------------------
        # IMPORTANTE:
        #
        # Não gerar fluxo financeiro aqui.
        #
        # O cadastro do ativo não é automaticamente uma liquidação
        # financeira.
        # ------------------------------------------------------------------

        conexao.commit()

        return jsonify(
            {
                "status": "sucesso",
                "message":
                    "Máquina salva com sucesso.",
            }
        ), 200

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "Erro ao salvar máquina: %s",
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível salvar a máquina.",
                "erro": str(erro),
            }
        ), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# BUSCAR POR ID
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/buscar/<int:id_reg>",
    methods=["GET"],
)
def api_buscar_maquina_id(id_reg):

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
            }
        ), 401

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError(
                "Não foi possível obter conexão com o banco."
            )

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        cursor.execute(
            """
            SELECT *
            FROM erp_maquinas
            WHERE id = %s
              AND equipe_id = %s
              AND (
                    departamento = 'PRODUCAO'
                    OR departamento IS NULL
                  )
            LIMIT 1
            """,
            (
                id_reg,
                equipe_atual(),
            ),
        )

        maquina = cursor.fetchone()

        if not maquina:

            return jsonify(
                {
                    "status": "erro",
                    "message":
                        "Máquina não encontrada.",
                }
            ), 404

        return jsonify(
            dict(maquina)
        ), 200

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "Erro ao buscar máquina %s: %s",
            id_reg,
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível buscar a máquina.",
                "erro": str(erro),
            }
        ), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# DELETAR
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/deletar/<int:id_reg>",
    methods=["DELETE"],
)
def api_deletar_maquina(id_reg):

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
            }
        ), 401

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError(
                "Não foi possível obter conexão com o banco."
            )

        cursor = conexao.cursor()

        cursor.execute(
            """
            DELETE FROM erp_maquinas
            WHERE id = %s
              AND equipe_id = %s
              AND (
                    departamento = 'PRODUCAO'
                    OR departamento IS NULL
                  )
            """,
            (
                id_reg,
                equipe_atual(),
            ),
        )

        if cursor.rowcount == 0:

            conexao.rollback()

            return jsonify(
                {
                    "status": "erro",
                    "message":
                        "Máquina não encontrada.",
                }
            ), 404

        conexao.commit()

        return jsonify(
            {
                "status": "removido",
                "message":
                    "Máquina removida com sucesso.",
            }
        ), 200

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "Erro ao deletar máquina %s: %s",
            id_reg,
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível remover a máquina.",
                "erro": str(erro),
            }
        ), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# PESQUISA GOOGLE
# ==========================================================================
#
# O navegador chama:
#
#   GET /api/maquinas/pesquisar_google?q=nome do equipamento
#
# A chave NÃO vai para o navegador.
#
# O servidor utiliza:
#
#   GOOGLE_API_KEY
#   GOOGLE_CSE_ID
#
# configurados no ambiente do Render.
#
# API utilizada:
#
#   Google Programmable Search / Custom Search JSON API
#
# Não cadastramos automaticamente nenhum resultado como patrimônio.
# A pesquisa apenas fornece informação técnica para auxiliar o aluno.
# ==========================================================================

def pesquisar_google_servidor(consulta):
    """
    Executa pesquisa no Google Custom Search API.

    Retorna somente informações públicas retornadas pelo Google.

    Não inventa marca, modelo ou característica técnica.
    """

    api_key = os.getenv(
        "GOOGLE_API_KEY",
        "",
    ).strip()

    cse_id = os.getenv(
        "GOOGLE_CSE_ID",
        "",
    ).strip()

    if not api_key or not cse_id:
        raise RuntimeError(
            "Pesquisa Google não configurada no servidor. "
            "Defina GOOGLE_API_KEY e GOOGLE_CSE_ID."
        )

    consulta = str(
        consulta or ""
    ).strip()

    if not consulta:
        return []

    # Limite para impedir consultas exageradamente grandes.
    consulta = consulta[:300]

    parametros = {
        "key": api_key,
        "cx": cse_id,
        "q": consulta,
        "num": 10,
        "hl": "pt-BR",
        "gl": "br",
        "safe": "active",
    }

    url = (
        "https://www.googleapis.com/customsearch/v1?"
        + urllib.parse.urlencode(parametros)
    )

    requisicao = urllib.request.Request(
        url,
        headers={
            "User-Agent":
                "TERADMAS-ERP/2.6",
            "Accept":
                "application/json",
        },
        method="GET",
    )

    try:

        with urllib.request.urlopen(
            requisicao,
            timeout=12,
        ) as resposta:

            conteudo = resposta.read().decode(
                "utf-8"
            )

            dados = json.loads(
                conteudo
            )

    except urllib.error.HTTPError as erro:

        corpo = ""

        try:
            corpo = erro.read().decode(
                "utf-8",
                errors="ignore",
            )
        except Exception:
            pass

        logger.error(
            "Google Custom Search HTTP %s: %s",
            erro.code,
            corpo,
        )

        if erro.code == 403:
            raise RuntimeError(
                "Google recusou a pesquisa. "
                "Verifique GOOGLE_API_KEY, "
                "GOOGLE_CSE_ID e as permissões da API."
            )

        raise RuntimeError(
            "Google retornou erro HTTP "
            f"{erro.code}."
        )

    except urllib.error.URLError as erro:

        logger.exception(
            "Erro de comunicação com Google: %s",
            erro,
        )

        raise RuntimeError(
            "Não foi possível consultar o Google."
        )

    except json.JSONDecodeError:

        raise RuntimeError(
            "A resposta do Google não pôde ser interpretada."
        )

    itens = dados.get(
        "items",
        [],
    )

    resultados = []

    for item in itens:

        titulo = str(
            item.get(
                "title",
                "",
            ) or ""
        ).strip()

        descricao = str(
            item.get(
                "snippet",
                "",
            ) or ""
        ).strip()

        link = str(
            item.get(
                "link",
                "",
            ) or ""
        ).strip()

        display_link = str(
            item.get(
                "displayLink",
                "",
            ) or ""
        ).strip()

        if not titulo and not descricao:
            continue

        resultados.append(
            {
                "titulo": titulo,
                "descricao": descricao,
                "link": link,
                "fonte": display_link,
            }
        )

    return resultados


@maquinas_blueprint.route(
    "/api/maquinas/pesquisar_google",
    methods=["GET"],
)
def api_pesquisar_google():

    if not autenticado():
        return jsonify(
            {
                "status": "erro",
                "message": "Não autenticado.",
                "resultados": [],
            }
        ), 401

    if not empresa_inicializada():
        return jsonify(
            {
                "status": "erro",
                "message":
                    "A empresa ainda não foi inicializada.",
                "resultados": [],
            }
        ), 403

    consulta = str(
        request.args.get(
            "q",
            "",
        ) or ""
    ).strip()

    if len(consulta) < 2:
        return jsonify(
            {
                "status": "erro",
                "message":
                    "Informe o nome do equipamento.",
                "resultados": [],
            }
        ), 400

    try:

        resultados = pesquisar_google_servidor(
            consulta
        )

        return jsonify(
            {
                "status": "sucesso",
                "consulta": consulta,
                "resultados": resultados,
                "total": len(resultados),
            }
        ), 200

    except Exception as erro:

        logger.exception(
            "Erro na pesquisa Google de máquinas: %s",
            erro,
        )

        return jsonify(
            {
                "status": "erro",
                "message":
                    "Não foi possível realizar "
                    "a pesquisa no Google.",
                "erro": str(erro),
                "resultados": [],
            }
        ), 503


# ==========================================================================
# HEALTH CHECK DO MÓDULO
# ==========================================================================

@maquinas_blueprint.route(
    "/api/maquinas/status",
    methods=["GET"],
)
def api_status_maquinas():

    configurado_google = bool(
        os.getenv(
            "GOOGLE_API_KEY",
            "",
        ).strip()
        and
        os.getenv(
            "GOOGLE_CSE_ID",
            "",
        ).strip()
    )

    return jsonify(
        {
            "status": "sucesso",
            "modulo": "maquinas",
            "autenticado": autenticado(),
            "empresa_inicializada":
                empresa_inicializada(),
            "pesquisa_google_configurada":
                configurado_google,
        }
    ), 200
