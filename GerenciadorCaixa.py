# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL
# GerenciadorCaixa.py
#
# REGRA CENTRAL
#
# A empresa possui:
#
#   CAPITAL INICIAL
#       valor definido na inicialização da empresa/equipe.
#
#   CAIXA
#       resultado das movimentações financeiras efetivamente lançadas.
#
#   PATRIMÔNIO
#       somente os ativos que EXISTEM atualmente.
#
#   CUSTOS FIXOS / VARIÁVEIS
#       indicadores gerenciais.
#       Não são descontados novamente do caixa quando já registrados
#       como saída em fluxo_caixa.
#
# PRINCÍPIO:
#
#   CAIXA ATUAL =
#       CAPITAL INICIAL
#       + ENTRADAS
#       - SAÍDAS
#
#   PATRIMÔNIO ATUAL =
#       ativos existentes neste momento
#
#   DISPONIBILIDADE FINANCEIRA =
#       CAIXA ATUAL
#
# Portanto:
#
#   aquisição de máquina
#       -> saída de caixa
#       -> máquina entra no patrimônio
#
#   exclusão/venda/baixa da máquina
#       -> máquina deixa de compor o patrimônio
#       -> eventual entrada/saída financeira é registrada no fluxo
#
# O patrimônio NÃO é histórico.
#
# ==========================================================================

# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL
# GerenciadorCaixa.py
#
# PRIMEIRA BASE DE REORGANIZAÇÃO:
# - empresa isolada por equipe
# - capital inicial separado do caixa
# - caixa separado do patrimônio
# - patrimônio representa somente ativos atuais
# - custos não são subtraídos duas vezes
# ==========================================================================

import os
import logging

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_connection_pool = None
_pool_connection_ids = set()


def obter_pool_conexoes():
    """Cria e reutiliza o pool PostgreSQL."""
    global _connection_pool

    if _connection_pool is None:
        database_url = os.environ.get("DATABASE_URL")

        if not database_url:
            database_url = (
                "postgresql://postgres:"
                "senha_ficticia_anti_alunos"
                "@localhost:5432/postgres"
            )

        try:
            _connection_pool = SimpleConnectionPool(
                minconn=1,
                maxconn=5,
                dsn=database_url
            )
            logger.info("Pool PostgreSQL criado com sucesso.")

        except psycopg2.Error as exc:
            logger.error("Erro ao criar pool PostgreSQL: %s", exc)
            _connection_pool = None

    return _connection_pool


def obter_conexao_master():
    """Obtém conexão do pool ou, em último caso, conexão direta."""
    try:
        pool = obter_pool_conexoes()

        if pool is not None:
            conexao = pool.getconn()
            _pool_connection_ids.add(id(conexao))
            return conexao

        database_url = os.environ.get("DATABASE_URL")

        if database_url:
            return psycopg2.connect(database_url)

        raise psycopg2.DatabaseError(
            "DATABASE_URL não configurada."
        )

    except psycopg2.Error as exc:
        logger.error("Erro ao obter conexão PostgreSQL: %s", exc)
        return None


def liberar_conexao_master(conexao):
    """Libera corretamente conexão do pool ou conexão direta."""
    if conexao is None:
        return

    conexao_id = id(conexao)

    try:
        if (
            conexao_id in _pool_connection_ids
            and _connection_pool is not None
        ):
            _pool_connection_ids.discard(conexao_id)
            _connection_pool.putconn(conexao)
        else:
            conexao.close()

    except Exception as exc:
        logger.warning("Erro ao liberar conexão: %s", exc)
        try:
            conexao.close()
        except Exception:
            pass


def numero(valor, padrao=0.0):
    """Converte Decimal/None/string numérica para float."""
    try:
        if valor is None:
            return float(padrao)
        return float(valor)
    except (TypeError, ValueError):
        return float(padrao)


def rollback_seguro(conexao):
    try:
        conexao.rollback()
    except Exception:
        pass


def executar_soma(cursor, sql, parametros=()):
    """Executa uma soma SQL; estrutura inexistente retorna zero."""
    try:
        cursor.execute(sql, parametros)
        resultado = cursor.fetchone()

        if not resultado:
            return 0.0

        return numero(resultado.get("total"), 0.0)

    except (psycopg2.ProgrammingError,
            psycopg2.UndefinedTable,
            psycopg2.UndefinedColumn) as exc:
        logger.info("Estrutura não disponível: %s", exc)
        rollback_seguro(cursor.connection)
        return 0.0

    except Exception as exc:
        logger.warning("Erro em soma SQL: %s", exc)
        rollback_seguro(cursor.connection)
        return 0.0


def consultar_colunas(cursor, tabela):
    """
    Consulta as colunas existentes.

    Serve para manter compatibilidade durante a evolução do banco,
    sem transformar campos futuros em dependências obrigatórias.
    """
    try:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
            """,
            (tabela,)
        )
        return {
            str(row["column_name"]).lower()
            for row in cursor.fetchall()
        }

    except Exception:
        rollback_seguro(cursor.connection)
        return set()


def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Calcula a situação financeira ATUAL da empresa da equipe.

    PRINCÍPIOS:

    CAPITAL INICIAL
        vem da configuração da equipe.

    CAIXA
        é determinado pelas movimentações efetivamente registradas
        em fluxo_caixa.

    PATRIMÔNIO
        é determinado pelo estado atual dos ativos.

    CUSTOS
        são indicadores gerenciais. Não devem ser subtraídos novamente
        quando já foram lançados como saídas no fluxo de caixa.

    Assim evitamos a dupla contagem que ocorria quando o mesmo gasto
    aparecia simultaneamente no fluxo e no cálculo de custos.
    """

    conexao = obter_conexao_master()

    # ------------------------------------------------------------------
    # ESTADO PADRÃO
    # ------------------------------------------------------------------

    capital_total = 5000000.00
    nome_empresa = "GRUPO ACADÊMICO"

    valor_aluguel_global = 0.0

    total_movimentacoes_fluxo = 0.0
    total_entradas_fluxo = 0.0
    total_saidas_fluxo = 0.0

    patrimonio_imoveis = 0.0
    patrimonio_maquinas = 0.0
    patrimonio_materiais = 0.0
    patrimonio_ativo_total = 0.0

    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0

    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    orcamento_liberado_setor = 0.0
    gastos_especificos_setor = 0.0

    if not conexao:
        return {
            "nome_empresa": "MODO SEGURANÇA",
            "capital_total": capital_total,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,
            "patrimonio_ativo_total": 0.0,
            "custo_fixo_total": 0.0,
            "custo_variavel_total": 0.0,
            "custo_fixo_geral_empresa": 0.0,
            "patrimonio_isolado_setor": 0.0,
            "custo_fixo_isolado_setor": 0.0,
            "custo_variavel_isolado_setor": 0.0,
            "erro": "Conexão com banco de dados indisponível"
        }

    cursor = None

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        # ==============================================================
        # 1. CAPITAL INICIAL / EMPRESA
        # ==============================================================

        config = None

        try:
            cursor.execute(
                """
                SELECT
                    nome_empresa,
                    capital_total,
                    valor_aluguel
                FROM config_simulacao
                WHERE equipe_id = %s
                LIMIT 1
                """,
                (id_equipe,)
            )

            config = cursor.fetchone()

            if config:
                capital_total = numero(
                    config.get("capital_total"),
                    capital_total
                )

                valor_aluguel_global = numero(
                    config.get("valor_aluguel"),
                    0.0
                )

                nome_empresa = (
                    config.get("nome_empresa")
                    or nome_empresa
                )

        except Exception:
            rollback_seguro(conexao)

        # Compatibilidade com estruturas de inicialização já existentes.
        if not config:
            tabelas_capital = [
                ("configuracao_equipes", "capital_inicial"),
                ("configuracao_equipes", "capital_social"),
                ("inicializacao_negocio", "capital_inicial"),
                ("inicializacao_negocio", "capital_social"),
            ]

            for tabela, coluna in tabelas_capital:
                try:
                    cursor.execute(
                        f"""
                        SELECT {coluna} AS valor
                        FROM {tabela}
                        WHERE equipe_id = %s
                        LIMIT 1
                        """,
                        (id_equipe,)
                    )

                    registro = cursor.fetchone()

                    if (
                        registro
                        and registro.get("valor") is not None
                    ):
                        capital_total = numero(
                            registro.get("valor"),
                            capital_total
                        )
                        break

                except Exception:
                    rollback_seguro(conexao)

        # ==============================================================
        # 2. FLUXO DE CAIXA
        # ==============================================================

        total_movimentacoes_fluxo = executar_soma(
            cursor,
            """
            SELECT COALESCE(SUM(valor), 0) AS total
            FROM fluxo_caixa
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        total_entradas_fluxo = executar_soma(
            cursor,
            """
            SELECT COALESCE(
                SUM(
                    CASE
                        WHEN valor > 0 THEN valor
                        ELSE 0
                    END
                ),
                0
            ) AS total
            FROM fluxo_caixa
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        total_saidas_fluxo = executar_soma(
            cursor,
            """
            SELECT COALESCE(
                SUM(
                    CASE
                        WHEN valor < 0 THEN ABS(valor)
                        ELSE 0
                    END
                ),
                0
            ) AS total
            FROM fluxo_caixa
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        # ==============================================================
        # 3. IMÓVEIS
        # ==============================================================
        #
        # ALUGUEL E CONDOMÍNIO NÃO SÃO PATRIMÔNIO.
        #
        # Patrimônio imobiliário somente será calculado se a tabela
        # realmente possuir uma coluna de aquisição/valor do ativo.
        # ==============================================================

        try:
            colunas = consultar_colunas(
                cursor,
                "imoveis_simulacao"
            )

            coluna_ativo = next(
                (
                    coluna
                    for coluna in (
                        "valor_aquisicao",
                        "valor_compra",
                        "preco_compra",
                        "valor_imovel",
                        "valor_patrimonio"
                    )
                    if coluna in colunas
                ),
                None
            )

            if coluna_ativo:
                patrimonio_imoveis = executar_soma(
                    cursor,
                    f"""
                    SELECT COALESCE(SUM({coluna_ativo}), 0) AS total
                    FROM imoveis_simulacao
                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

            if "valor_aluguel" in colunas:
                valor_aluguel_global = executar_soma(
                    cursor,
                    """
                    SELECT COALESCE(SUM(valor_aluguel), 0) AS total
                    FROM imoveis_simulacao
                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

            custo_condominio = 0.0

            if "valor_condominio" in colunas:
                custo_condominio = executar_soma(
                    cursor,
                    """
                    SELECT COALESCE(SUM(valor_condominio), 0) AS total
                    FROM imoveis_simulacao
                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

            custo_fixo_total_global += (
                valor_aluguel_global
                + custo_condominio
            )

            patrimonio_ativo_total += patrimonio_imoveis

            if departamento_atual == "estrutura":
                patrimonio_isolado_setor += patrimonio_imoveis
                custo_fixo_isolado_setor += (
                    valor_aluguel_global
                    + custo_condominio
                )

        except Exception as exc:
            rollback_seguro(conexao)
            logger.warning(
                "Erro em imoveis_simulacao: %s",
                exc
            )

        # ==============================================================
        # 4. MÁQUINAS
        # ==============================================================

        patrimonio_maquinas = executar_soma(
            cursor,
            """
            SELECT COALESCE(SUM(preco_compra), 0) AS total
            FROM erp_maquinas
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        patrimonio_ativo_total += patrimonio_maquinas

        # ==============================================================
        # 5. MATERIAIS / ESTOQUE
        # ==============================================================

        patrimonio_materiais = executar_soma(
            cursor,
            """
            SELECT COALESCE(
                SUM(
                    COALESCE(quantidade_estoque, 0)
                    *
                    COALESCE(preco_unitario, 0)
                ),
                0
            ) AS total
            FROM ativos_materials
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        patrimonio_ativo_total += patrimonio_materiais

        if departamento_atual == "materiais":
            patrimonio_isolado_setor += patrimonio_materiais

        # ==============================================================
        # 6. MÁQUINAS POR DEPARTAMENTO
        # ==============================================================

        try:
            cursor.execute(
                """
                SELECT
                    departamento,
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                GROUP BY departamento
                """,
                (id_equipe,)
            )

            for registro in cursor.fetchall():
                departamento = (
                    str(registro.get("departamento") or "")
                    .strip()
                    .lower()
                )

                total = numero(
                    registro.get("total"),
                    0.0
                )

                if departamento_atual == "estrutura":
                    if departamento == "estrutura":
                        patrimonio_isolado_setor += total

                elif departamento_atual in ("maquinas", "producao"):
                    if departamento == "producao":
                        patrimonio_isolado_setor += total

        except Exception as exc:
            rollback_seguro(conexao)
            logger.warning(
                "Erro ao separar máquinas por setor: %s",
                exc
            )

        # ==============================================================
        # 7. FOLHA - CUSTO FIXO
        # ==============================================================

        folha_fixa = executar_soma(
            cursor,
            """
            SELECT COALESCE(SUM(salario_base), 0) AS total
            FROM folha_funcionarios
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        custo_fixo_total_global += folha_fixa

        # ==============================================================
        # 8. RH DA ESTRUTURA
        # ==============================================================

        rh_setor_valor = executar_soma(
            cursor,
            """
            SELECT COALESCE(SUM(subtotal), 0) AS total
            FROM estrutura_rh
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        custo_fixo_total_global += rh_setor_valor

        if departamento_atual == "estrutura":
            custo_fixo_isolado_setor += rh_setor_valor

        # ==============================================================
        # 9. CUSTOS VARIÁVEIS DA FOLHA
        # ==============================================================

        folha_variavel = executar_soma(
            cursor,
            """
            SELECT COALESCE(
                SUM(
                    COALESCE(encargos_patronais, 0)
                    +
                    COALESCE(valor_horas_extras, 0)
                ),
                0
            ) AS total
            FROM livro_razonete_folha
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        custo_variavel_total_global += folha_variavel

        if departamento_atual in ("rh", "folha_pagamento"):
            custo_variavel_isolado_setor += folha_variavel

        # ==============================================================
        # 10. ORÇAMENTO DO DEPARTAMENTO
        # ==============================================================

        if departamento_atual:
            try:
                cursor.execute(
                    """
                    SELECT COALESCE(
                        orcamento_liberado,
                        0
                    ) AS orcamento_liberado
                    FROM departamentos_orcamento
                    WHERE equipe_id = %s
                      AND departamento = %s
                    LIMIT 1
                    """,
                    (id_equipe, departamento_atual)
                )

                resultado = cursor.fetchone()

                if resultado:
                    orcamento_liberado_setor = numero(
                        resultado.get("orcamento_liberado"),
                        0.0
                    )

            except Exception:
                rollback_seguro(conexao)

        # ==============================================================
        # 11. GASTOS ESPECÍFICOS DO SETOR
        # ==============================================================

        if departamento_atual:
            gastos_especificos_setor = executar_soma(
                cursor,
                """
                SELECT COALESCE(SUM(valor), 0) AS total
                FROM fluxo_caixa
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (id_equipe, departamento_atual)
            )

        # ==============================================================
        # 12. NORMALIZAÇÃO
        # ==============================================================

        patrimonio_ativo_total = max(
            0.0,
            patrimonio_ativo_total
        )

        custo_fixo_total_global = max(
            0.0,
            custo_fixo_total_global
        )

        custo_variavel_total_global = max(
            0.0,
            custo_variavel_total_global
        )

        # ==============================================================
        # 13. CAPITAL DISPONÍVEL
        # ==============================================================
        #
        # O fluxo de caixa já representa as entradas e saídas monetárias.
        # Portanto, não subtraímos novamente os custos que já estejam
        # representados nesse fluxo.
        #
        # O patrimônio atual representa recursos convertidos em ativos.
        #
        # Esta é a primeira versão corrigida do motor. A fórmula original
        # do projeto será refinada após conferirmos como cada módulo lança
        # seus custos no fluxo_caixa.
        # ==============================================================

        capital_disponivel_total = (
            capital_total
            + total_movimentacoes_fluxo
            - patrimonio_ativo_total
        )

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        # ==============================================================
        # 14. CAPITAL DISPONÍVEL DO DEPARTAMENTO
        # ==============================================================

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            - max(0.0, gastos_especificos_setor)
        )

        capital_disponivel_departamento = max(
            0.0,
            capital_disponivel_departamento
        )

        # ==============================================================
        # 15. RETORNO
        # ==============================================================

        return {
            "nome_empresa": (
                str(nome_empresa).upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            "capital_total": capital_total,

            "capital_disponivel_total": (
                capital_disponivel_total
            ),

            "capital_disponivel_departamento": (
                capital_disponivel_departamento
            ),

            "patrimonio_ativo_total": (
                patrimonio_ativo_total
            ),

            "custo_fixo_total": (
                custo_fixo_total_global
            ),

            "custo_variavel_total": (
                custo_variavel_total_global
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total_global
            ),

            "patrimonio_isolado_setor": (
                max(0.0, patrimonio_isolado_setor)
            ),

            "custo_fixo_isolado_setor": (
                max(0.0, custo_fixo_isolado_setor)
            ),

            "custo_variavel_isolado_setor": (
                max(0.0, custo_variavel_isolado_setor)
            ),

            "total_movimentacoes_fluxo": (
                total_movimentacoes_fluxo
            ),

            "total_entradas_fluxo": (
                total_entradas_fluxo
            ),

            "total_saidas_fluxo": (
                total_saidas_fluxo
            ),

            "patrimonio_imoveis": (
                patrimonio_imoveis
            ),

            "patrimonio_maquinas": (
                patrimonio_maquinas
            ),

            "patrimonio_materiais": (
                patrimonio_materiais
            ),

            "valor_aluguel_global": (
                valor_aluguel_global
            )
        }

    except Exception as exc:
        logger.error(
            "Erro crítico no Motor de Métricas de Caixa: %s",
            exc
        )

        rollback_seguro(conexao)

        return {
            "nome_empresa": "MODO SEGURANÇA",
            "capital_total": capital_total,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,
            "patrimonio_ativo_total": 0.0,
            "custo_fixo_total": 0.0,
            "custo_variavel_total": 0.0,
            "custo_fixo_geral_empresa": 0.0,
            "patrimonio_isolado_setor": 0.0,
            "custo_fixo_isolado_setor": 0.0,
            "custo_variavel_isolado_setor": 0.0,
            "erro": str(exc)
        }

    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass

        liberar_conexao_master(conexao)
