# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL
# ARQUIVO: GerenciadorCaixa.py
#
# REVISÃO:
# - Capital inicial lido dinamicamente do Supabase
# - Capital de giro global desconta patrimônio consolidado
# - Capital de giro global desconta custos fixos consolidados
# - Capital de giro global desconta custos variáveis consolidados
# - Mantida separação entre métricas globais e departamentais
# - Pool PostgreSQL reutilizável
# - Compatibilidade com tabelas legadas
# ==========================================================================

import os
import logging

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


# ==========================================================================
# CONFIGURAÇÃO DE LOG
# ==========================================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


# ==========================================================================
# POOL DE CONEXÕES POSTGRESQL / SUPABASE
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Retorna o pool global de conexões PostgreSQL.

    O DATABASE_URL deve ser fornecido pelo ambiente de produção
    (Supabase/Render/etc.).
    """

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
                1,
                5,
                database_url
            )

            logger.info(
                "✅ Pool de conexões PostgreSQL criado com sucesso"
            )

        except psycopg2.Error as e:

            logger.error(
                f"❌ Erro ao criar pool de conexões: {e}"
            )

            _connection_pool = None

    return _connection_pool


# ==========================================================================
# OBTENÇÃO DE CONEXÃO
# ==========================================================================

def obter_conexao_master():
    """
    Obtém uma conexão do pool.

    Se o pool não puder ser criado, tenta uma conexão direta.
    """

    try:

        pool = obter_pool_conexoes()

        if pool:

            return pool.getconn()

        database_url = os.environ.get("DATABASE_URL")

        if database_url:

            return psycopg2.connect(database_url)

        raise psycopg2.DatabaseError(
            "Não foi possível localizar DATABASE_URL."
        )

    except psycopg2.Error as e:

        logger.error(
            f"❌ Erro ao obter conexão PostgreSQL: {e}"
        )

        return None


# ==========================================================================
# DEVOLUÇÃO DA CONEXÃO AO POOL
# ==========================================================================

def liberar_conexao_master(conexao):
    """
    Devolve a conexão ao pool.

    Caso não exista pool ou ocorra algum problema,
    a conexão é encerrada diretamente.
    """

    if not conexao:
        return

    try:

        pool = obter_pool_conexoes()

        if pool:

            try:

                pool.putconn(conexao)

            except Exception:

                try:
                    conexao.close()
                except Exception:
                    pass

        else:

            try:
                conexao.close()
            except Exception:
                pass

    except Exception as e:

        logger.warning(
            f"⚠️ Erro ao liberar conexão: {e}"
        )

        try:
            conexao.close()
        except Exception:
            pass


# ==========================================================================
# MÉTODO PRINCIPAL DO MOTOR FINANCEIRO
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Calcula as métricas financeiras consolidadas da equipe.

    PRINCIPAL REGRA FINANCEIRA:

        CAPITAL DE GIRO DISPONÍVEL
        =
        CAPITAL INICIAL
        + MOVIMENTAÇÕES LÍQUIDAS DO FLUXO
        - PATRIMÔNIO
        - CUSTOS FIXOS
        - CUSTOS VARIÁVEIS

    As métricas patrimoniais e de custos são consolidadas
    para toda a empresa.

    Quando departamento_atual é informado, também são
    calculados os indicadores isolados daquele setor.
    """

    conexao = obter_conexao_master()

    cursor = None

    # ======================================================================
    # VALORES PADRÃO DE SEGURANÇA
    # ======================================================================

    capital_total = 0.0

    valor_aluguel_global = 0.0

    nome_empresa = "GRUPO ACADÊMICO"

    total_movimentacoes_fluxo = 0.0

    # ======================================================================
    # ACUMULADORES GLOBAIS
    # ======================================================================

    patrimonio_ativo_total = 0.0

    custo_fixo_total_global = 0.0

    custo_variavel_total_global = 0.0

    # ======================================================================
    # ACUMULADORES DO DEPARTAMENTO
    # ======================================================================

    patrimonio_isolado_setor = 0.0

    custo_fixo_isolado_setor = 0.0

    custo_variavel_isolado_setor = 0.0

    orcamento_liberado_setor = 0.0

    gastos_especificos_setor = 0.0

    # ======================================================================
    # FALLBACK DE SEGURANÇA
    # ======================================================================

    if not conexao:

        logger.error(
            "❌ Falha ao obter conexão com banco de dados"
        )

        return {
            "nome_empresa": "MODO SEGURANÇA",
            "capital_total": 0.0,
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

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==================================================================
        # 1. CAPITAL INICIAL / CONFIGURAÇÃO DA EMPRESA
        # ==================================================================

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

                capital_total = float(
                    config.get("capital_total") or 0
                )

                valor_aluguel_global = float(
                    config.get("valor_aluguel") or 0
                )

                nome_empresa = (
                    config.get("nome_empresa")
                    or nome_empresa
                )

                logger.info(
                    "✅ Capital inicial obtido de "
                    "config_simulacao: %.2f",
                    capital_total
                )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela config_simulacao indisponível. "
                "Será utilizado fallback."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro ao consultar config_simulacao: {e}"
            )

        # ==================================================================
        # 2. FALLBACK PARA TABELAS DE CONFIGURAÇÃO LEGADAS
        # ==================================================================

        if not config:

            tabelas_teste = [

                (
                    "configuracao_equipes",
                    "capital_inicial",
                    "equipe_id"
                ),

                (
                    "configuracao_equipes",
                    "capital_social",
                    "equipe_id"
                ),

                (
                    "inicializacao_negocio",
                    "capital_inicial",
                    "equipe_id"
                ),

                (
                    "inicializacao_negocio",
                    "capital_social",
                    "equipe_id"
                )
            ]

            for tabela, coluna, coluna_filtro in tabelas_teste:

                try:

                    cursor.execute(
                        f"""
                        SELECT {coluna} AS valor
                        FROM {tabela}
                        WHERE {coluna_filtro} = %s
                        LIMIT 1
                        """,
                        (id_equipe,)
                    )

                    reg = cursor.fetchone()

                    if reg and reg.get("valor") is not None:

                        capital_total = float(
                            reg["valor"]
                        )

                        logger.info(
                            "ℹ️ Capital inicial obtido de "
                            f"{tabela}.{coluna}: "
                            f"{capital_total:.2f}"
                        )

                        break

                except Exception:

                    conexao.rollback()

                    continue

        # ==================================================================
        # 3. FLUXO DE CAIXA
        # ==================================================================
        #
        # Regra:
        #
        # valor positivo = entrada
        # valor negativo = saída
        #
        # O SUM(valor) representa a movimentação líquida.
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(valor), 0) AS total
                FROM fluxo_caixa
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado_fluxo = cursor.fetchone()

            if resultado_fluxo:

                total_movimentacoes_fluxo = float(
                    resultado_fluxo.get("total") or 0
                )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela fluxo_caixa indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro ao consultar fluxo_caixa: {e}"
            )

        # ==================================================================
        # 4. PATRIMÔNIO - IMÓVEIS
        # ==================================================================

        imob_aluguel_setor = 0.0

        imob_condo_setor = 0.0

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(valor_aluguel), 0) AS aluguel,
                    COALESCE(SUM(valor_condominio), 0) AS condo
                FROM imoveis_simulacao
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            res_imob = cursor.fetchone()

            if res_imob:

                imob_aluguel_setor = float(
                    res_imob.get("aluguel") or 0
                )

                imob_condo_setor = float(
                    res_imob.get("condo") or 0
                )

                # Mantida a regra existente do ERP:
                # valor de aluguel cadastrado no módulo imobiliário
                # participa do indicador patrimonial/faturamento ativo.

                patrimonio_ativo_total += (
                    imob_aluguel_setor
                )

                if departamento_atual == "estrutura":

                    patrimonio_isolado_setor += (
                        imob_aluguel_setor
                    )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela imoveis_simulacao indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro em imoveis_simulacao: {e}"
            )

        # ==================================================================
        # 5. PATRIMÔNIO - MÁQUINAS DE PRODUÇÃO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (
                    id_equipe,
                    "PRODUCAO"
                )
            )

            total_producao = float(
                cursor.fetchone().get("total") or 0
            )

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (
                    id_equipe,
                    "ESTRUTURA"
                )
            )

            total_estrutura = float(
                cursor.fetchone().get("total") or 0
            )

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (
                    id_equipe,
                    "UTENSILIOS"
                )
            )

            total_utensilios = float(
                cursor.fetchone().get("total") or 0
            )

            # Consolidação patrimonial global.

            patrimonio_ativo_total += (
                total_producao
                + total_estrutura
                + total_utensilios
            )

            # Isolamento departamental.

            if departamento_atual == "estrutura":

                patrimonio_isolado_setor += (
                    total_estrutura
                )

            elif departamento_atual in (
                "maquinas",
                "producao"
            ):

                patrimonio_isolado_setor += (
                    total_producao
                )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela erp_maquinas indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro ao consultar erp_maquinas: {e}"
            )

        # ==================================================================
        # 6. PATRIMÔNIO - MATERIAIS / ALMOXARIFADO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
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

            res_mat = cursor.fetchone()

            if res_mat:

                total_materiais = float(
                    res_mat.get("total") or 0
                )

                patrimonio_ativo_total += (
                    total_materiais
                )

                if departamento_atual == "materiais":

                    patrimonio_isolado_setor += (
                        total_materiais
                    )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela ativos_materials indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro em ativos_materials: {e}"
            )

        # ==================================================================
        # 7. CUSTOS FIXOS - IMOBILIÁRIO
        # ==================================================================

        custo_fixo_total_global = (
            imob_aluguel_setor
            + imob_condo_setor
        )

        if departamento_atual == "estrutura":

            custo_fixo_isolado_setor = (
                imob_aluguel_setor
                + imob_condo_setor
            )

        # ==================================================================
        # 8. CUSTOS FIXOS - FOLHA CLT
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(salario_base), 0) AS total
                FROM folha_funcionarios
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            res_rh_global = cursor.fetchone()

            if res_rh_global:

                total_folha = float(
                    res_rh_global.get("total") or 0
                )

                custo_fixo_total_global += (
                    total_folha
                )

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_fixo_isolado_setor += (
                        total_folha
                    )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela folha_funcionarios indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro em folha_funcionarios: {e}"
            )

        # ==================================================================
        # 9. CUSTOS FIXOS - ESTRUTURA / RH
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(subtotal), 0) AS total
                FROM estrutura_rh
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            res_rh_imob = cursor.fetchone()

            if res_rh_imob:

                rh_setor_valor = float(
                    res_rh_imob.get("total") or 0
                )

                custo_fixo_total_global += (
                    rh_setor_valor
                )

                if departamento_atual == "estrutura":

                    custo_fixo_isolado_setor += (
                        rh_setor_valor
                    )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela estrutura_rh indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro em estrutura_rh: {e}"
            )

        # ==================================================================
        # 10. CUSTOS VARIÁVEIS - FOLHA / ENCARGOS / HORAS EXTRAS
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
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

            res_folha_var = cursor.fetchone()

            if res_folha_var:

                total_variavel_folha = float(
                    res_folha_var.get("total") or 0
                )

                custo_variavel_total_global += (
                    total_variavel_folha
                )

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_variavel_isolado_setor += (
                        total_variavel_folha
                    )

        except psycopg2.ProgrammingError:

            conexao.rollback()

            logger.info(
                "ℹ️ Tabela livro_razonete_folha indisponível."
            )

        except Exception as e:

            conexao.rollback()

            logger.warning(
                f"⚠️ Erro em livro_razonete_folha: {e}"
            )

        # ==================================================================
        # 11. ORÇAMENTO DO DEPARTAMENTO
        # ==================================================================

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        orcamento_liberado
                    FROM departamentos_orcamento
                    WHERE equipe_id = %s
                      AND departamento = %s
                    LIMIT 1
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                dept_orc = cursor.fetchone()

                if dept_orc:

                    orcamento_liberado_setor = float(
                        dept_orc.get(
                            "orcamento_liberado"
                        ) or 0
                    )

            except psycopg2.ProgrammingError:

                conexao.rollback()

                logger.info(
                    "ℹ️ Tabela departamentos_orcamento "
                    f"indisponível para {departamento_atual}"
                )

            except Exception as e:

                conexao.rollback()

                logger.warning(
                    "⚠️ Erro em departamentos_orcamento: "
                    f"{e}"
                )

        # ==================================================================
        # 12. GASTOS ESPECÍFICOS DO DEPARTAMENTO
        # ==================================================================

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(valor), 0) AS total
                    FROM fluxo_caixa
                    WHERE equipe_id = %s
                      AND departamento = %s
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                res_gastos = cursor.fetchone()

                if res_gastos:

                    gastos_especificos_setor = float(
                        res_gastos.get("total") or 0
                    )

            except psycopg2.ProgrammingError:

                conexao.rollback()

                logger.info(
                    "ℹ️ Tabela fluxo_caixa indisponível "
                    f"para {departamento_atual}"
                )

            except Exception as e:

                conexao.rollback()

                logger.warning(
                    f"⚠️ Erro ao filtrar fluxo_caixa: {e}"
                )

        # ==================================================================
        # 13. CAPITAL DE GIRO GLOBAL - CORREÇÃO PRINCIPAL
        # ==================================================================
        #
        # Antes:
        #
        # capital_total
        # + fluxo
        # - aluguel
        #
        # Isso fazia com que patrimônio e demais custos não fossem
        # retirados do capital disponível.
        #
        # Agora:
        #
        # CAPITAL INICIAL
        # + MOVIMENTAÇÃO LÍQUIDA
        # - PATRIMÔNIO
        # - CUSTO FIXO
        # - CUSTO VARIÁVEL
        #
        # ==================================================================

        capital_disponivel_total = (
            capital_total
            + total_movimentacoes_fluxo
            - patrimonio_ativo_total
            - custo_fixo_total_global
            - custo_variavel_total_global
        )

        # O painel financeiro não apresenta disponibilidade negativa.
        # Os valores reais de patrimônio/custos continuam preservados
        # nas métricas correspondentes.

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        # ==================================================================
        # 14. CAPITAL DISPONÍVEL DO DEPARTAMENTO
        # ==================================================================

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            - gastos_especificos_setor
        )

        capital_disponivel_departamento = max(
            0.0,
            capital_disponivel_departamento
        )

        # ==================================================================
        # 15. LOG DE AUDITORIA FINANCEIRA
        # ==================================================================

        logger.info(
            "📊 MÉTRICAS FINANCEIRAS | "
            "Equipe=%s | "
            "Capital=%.2f | "
            "Fluxo=%.2f | "
            "Patrimônio=%.2f | "
            "Custos Fixos=%.2f | "
            "Custos Variáveis=%.2f | "
            "Capital de Giro=%.2f",
            id_equipe,
            capital_total,
            total_movimentacoes_fluxo,
            patrimonio_ativo_total,
            custo_fixo_total_global,
            custo_variavel_total_global,
            capital_disponivel_total
        )

        # ==================================================================
        # 16. RETORNO DA API
        # ==================================================================

        return {

            # --------------------------------------------------------------
            # IDENTIFICAÇÃO
            # --------------------------------------------------------------

            "nome_empresa": (
                nome_empresa.upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            # --------------------------------------------------------------
            # CAPITAL
            # --------------------------------------------------------------

            "capital_total": capital_total,

            "capital_disponivel_total": (
                capital_disponivel_total
            ),

            "capital_disponivel_departamento": (
                capital_disponivel_departamento
            ),

            # --------------------------------------------------------------
            # PATRIMÔNIO
            # --------------------------------------------------------------

            "patrimonio_ativo_total": (
                patrimonio_ativo_total
            ),

            # --------------------------------------------------------------
            # CUSTOS FIXOS
            # --------------------------------------------------------------

            "custo_fixo_total": (
                custo_fixo_total_global
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total_global
            ),

            # --------------------------------------------------------------
            # CUSTOS VARIÁVEIS
            # --------------------------------------------------------------

            "custo_variavel_total": (
                custo_variavel_total_global
            ),

            # --------------------------------------------------------------
            # MÉTRICAS ISOLADAS DO SETOR
            # --------------------------------------------------------------

            "patrimonio_isolado_setor": (
                patrimonio_isolado_setor
            ),

            "custo_fixo_isolado_setor": (
                custo_fixo_isolado_setor
            ),

            "custo_variavel_isolado_setor": (
                custo_variavel_isolado_setor
            )
        }

    except Exception as e:

        logger.exception(
            "❌ Erro crítico no Motor de Métricas de Caixa"
        )

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

            "erro": str(e)
        }

    finally:

        # --------------------------------------------------------------
        # FECHAMENTO DO CURSOR
        # --------------------------------------------------------------

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        # --------------------------------------------------------------
        # DEVOLUÇÃO DA CONEXÃO AO POOL
        # --------------------------------------------------------------

        if conexao:

            liberar_conexao_master(conexao)
