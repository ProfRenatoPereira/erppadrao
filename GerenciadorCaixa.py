# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# REGRA FINANCEIRA CENTRAL:
#
# Capital de Giro =
#     Capital Inicial
#   + Resultado do Fluxo de Caixa
#   - Patrimônio Ativo Atual
#   - Custos Fixos Totais
#   - Custos Variáveis Totais
#
# O patrimônio é DINÂMICO:
# - aquisição -> aumenta patrimônio
# - exclusão -> diminui patrimônio
# - nova aquisição -> aumenta novamente
#
# Nenhum patrimônio excluído permanece armazenado no cálculo.
# ==========================================================================

import os
import logging
import psycopg2

from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


# ==========================================================================
# LOG
# ==========================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==========================================================================
# POOL GLOBAL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria e reutiliza o pool PostgreSQL.

    O DATABASE_URL do ambiente tem prioridade.
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
                minconn=1,
                maxconn=5,
                dsn=database_url
            )

            logger.info("✅ Pool PostgreSQL criado com sucesso")

        except psycopg2.Error as e:

            logger.error(
                f"❌ Erro ao criar pool PostgreSQL: {e}"
            )

            _connection_pool = None

    return _connection_pool


# ==========================================================================
# CONEXÃO
# ==========================================================================

def obter_conexao_master():
    """
    Obtém uma conexão do pool.
    """

    try:

        pool = obter_pool_conexoes()

        if pool:
            return pool.getconn()

        database_url = os.environ.get("DATABASE_URL")

        if database_url:
            return psycopg2.connect(database_url)

        raise psycopg2.DatabaseError(
            "DATABASE_URL não configurada."
        )

    except psycopg2.Error as e:

        logger.error(
            f"❌ Erro ao obter conexão PostgreSQL: {e}"
        )

        return None


def liberar_conexao_master(conexao):
    """
    Devolve a conexão ao pool.
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
# CONVERSÃO SEGURA PARA FLOAT
# ==========================================================================

def numero(valor, padrao=0.0):
    """
    Converte valores PostgreSQL/Decimal para float com segurança.
    """

    try:

        if valor is None:
            return float(padrao)

        return float(valor)

    except (TypeError, ValueError):

        return float(padrao)


# ==========================================================================
# CONSULTA SEGURA DE SOMA
# ==========================================================================

def executar_soma(cursor, sql, parametros=()):
    """
    Executa uma soma SQL.

    Se a tabela/coluna ainda não existir, retorna 0.
    Isso permite que o ERP continue funcionando durante
    a inicialização dos módulos.
    """

    try:

        cursor.execute(sql, parametros)

        resultado = cursor.fetchone()

        if not resultado:
            return 0.0

        return numero(resultado.get("total"), 0.0)

    except psycopg2.ProgrammingError as e:

        logger.info(
            f"ℹ️ Estrutura ainda não disponível: {e}"
        )

        try:
            cursor.connection.rollback()
        except Exception:
            pass

        return 0.0

    except Exception as e:

        logger.warning(
            f"⚠️ Erro em soma SQL: {e}"
        )

        try:
            cursor.connection.rollback()
        except Exception:
            pass

        return 0.0


# ==========================================================================
# MOTOR FINANCEIRO CENTRAL
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Calcula todas as métricas financeiras da empresa.

    IMPORTANTE:

    O patrimônio é calculado a partir do ESTADO ATUAL das tabelas.

    Portanto:

        comprar máquina
            -> patrimônio aumenta

        excluir máquina
            -> patrimônio diminui

        comprar novamente
            -> patrimônio aumenta novamente

    O cálculo não mantém patrimônio histórico artificialmente.
    """

    conexao = obter_conexao_master()

    # ----------------------------------------------------------------------
    # VALORES PADRÃO
    # ----------------------------------------------------------------------

    capital_total = 5000000.00
    nome_empresa = "GRUPO ACADÊMICO"

    valor_aluguel_global = 0.0

    # Fluxo de caixa
    total_movimentacoes_fluxo = 0.0

    # Entradas e saídas separadas
    total_entradas_fluxo = 0.0
    total_saidas_fluxo = 0.0

    # ----------------------------------------------------------------------
    # PATRIMÔNIO
    # ----------------------------------------------------------------------

    patrimonio_imoveis = 0.0
    patrimonio_maquinas = 0.0
    patrimonio_materiais = 0.0

    patrimonio_ativo_total = 0.0

    # ----------------------------------------------------------------------
    # CUSTOS
    # ----------------------------------------------------------------------

    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0

    # ----------------------------------------------------------------------
    # MÉTRICAS DO DEPARTAMENTO
    # ----------------------------------------------------------------------

    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    # ----------------------------------------------------------------------
    # ORÇAMENTO
    # ----------------------------------------------------------------------

    orcamento_liberado_setor = 0.0
    gastos_especificos_setor = 0.0

    # ----------------------------------------------------------------------
    # SE NÃO HOUVER CONEXÃO
    # ----------------------------------------------------------------------

    if not conexao:

        logger.error(
            "❌ Falha ao obter conexão com banco de dados"
        )

        return {
            "nome_empresa": "MODO SEGURANÇA",
            "capital_total": capital_total,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,

            "patrimonio_ativo_total": 0.0,

            "custo_fixo_total": 21350.00,
            "custo_variavel_total": 0.0,
            "custo_fixo_geral_empresa": 21350.00,

            "patrimonio_isolado_setor": 0.0,
            "custo_fixo_isolado_setor": 0.0,
            "custo_variavel_isolado_setor": 0.0,

            "erro": "Conexão com banco de dados indisponível"
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==================================================================
        # 1. CAPITAL INICIAL
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

                logger.info(
                    f"💰 Capital inicial encontrado em "
                    f"config_simulacao: R$ {capital_total:,.2f}"
                )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ config_simulacao indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em config_simulacao: {e}"
            )

        # ==================================================================
        # 2. FALLBACK PARA CAPITAL INICIAL
        # ==================================================================

        if not config:

            tabelas_capital = [

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

            for tabela, coluna, coluna_filtro in tabelas_capital:

                try:

                    cursor.execute(
                        f"""
                        SELECT
                            {coluna} AS valor
                        FROM {tabela}
                        WHERE {coluna_filtro} = %s
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

                        logger.info(
                            f"💰 Capital inicial obtido de "
                            f"{tabela}.{coluna}: "
                            f"R$ {capital_total:,.2f}"
                        )

                        break

                except Exception:

                    try:
                        conexao.rollback()
                    except Exception:
                        pass

                    continue

        # ==================================================================
        # 3. FLUXO DE CAIXA
        # ==================================================================
        #
        # valor positivo = entrada
        # valor negativo = saída
        #
        # O resultado líquido é mantido para preservar
        # faturamentos e demais movimentações financeiras.
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

                total_movimentacoes_fluxo = numero(
                    resultado_fluxo.get("total"),
                    0.0
                )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ Tabela fluxo_caixa indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em fluxo_caixa: {e}"
            )

        # ==================================================================
        # 4. ENTRADAS DO FLUXO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN valor > 0
                                THEN valor
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

            resultado = cursor.fetchone()

            if resultado:

                total_entradas_fluxo = numero(
                    resultado.get("total"),
                    0.0
                )

        except Exception:

            try:
                conexao.rollback()
            except Exception:
                pass

            total_entradas_fluxo = 0.0

        # ==================================================================
        # 5. SAÍDAS DO FLUXO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN valor < 0
                                THEN ABS(valor)
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

            resultado = cursor.fetchone()

            if resultado:

                total_saidas_fluxo = numero(
                    resultado.get("total"),
                    0.0
                )

        except Exception:

            try:
                conexao.rollback()
            except Exception:
                pass

            total_saidas_fluxo = 0.0

        # ==================================================================
        # 6. PATRIMÔNIO - IMÓVEIS
        # ==================================================================
        #
        # ATENÇÃO:
        # Aqui usamos somente o que EXISTE atualmente na tabela.
        #
        # Se o estudante excluir um imóvel:
        #   -> ele desaparece da soma.
        #
        # Se adquirir outro:
        #   -> ele entra automaticamente.
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(valor_aluguel), 0) AS aluguel,
                    COALESCE(SUM(valor_condominio), 0) AS condominio
                FROM imoveis_simulacao
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado = cursor.fetchone()

            if resultado:

                patrimonio_imoveis = numero(
                    resultado.get("aluguel"),
                    0.0
                )

                condo_imoveis = numero(
                    resultado.get("condominio"),
                    0.0
                )

                # Patrimônio conforme estrutura atual
                patrimonio_ativo_total += patrimonio_imoveis

                # Custo fixo atual
                custo_fixo_total_global += (
                    patrimonio_imoveis
                    + condo_imoveis
                )

                if departamento_atual == "estrutura":

                    patrimonio_isolado_setor += (
                        patrimonio_imoveis
                    )

                    custo_fixo_isolado_setor += (
                        patrimonio_imoveis
                        + condo_imoveis
                    )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ Tabela imoveis_simulacao indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em imoveis_simulacao: {e}"
            )

        # ==================================================================
        # 7. PATRIMÔNIO - MÁQUINAS
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(preco_compra),
                        0
                    ) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado = cursor.fetchone()

            if resultado:

                patrimonio_maquinas = numero(
                    resultado.get("total"),
                    0.0
                )

                patrimonio_ativo_total += (
                    patrimonio_maquinas
                )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ Tabela erp_maquinas indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em erp_maquinas: {e}"
            )

        # ==================================================================
        # 8. PATRIMÔNIO - MATERIAIS / ALMOXARIFADO
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

            resultado = cursor.fetchone()

            if resultado:

                patrimonio_materiais = numero(
                    resultado.get("total"),
                    0.0
                )

                patrimonio_ativo_total += (
                    patrimonio_materiais
                )

                if departamento_atual == "materiais":

                    patrimonio_isolado_setor += (
                        patrimonio_materiais
                    )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ Tabela ativos_materials indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em ativos_materials: {e}"
            )

        # ==================================================================
        # 9. MÁQUINAS POR DEPARTAMENTO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    departamento,
                    COALESCE(
                        SUM(preco_compra),
                        0
                    ) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                GROUP BY departamento
                """,
                (id_equipe,)
            )

            maquinas_departamentos = cursor.fetchall()

            for registro in maquinas_departamentos:

                departamento = (
                    str(
                        registro.get("departamento")
                        or ""
                    )
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

                elif departamento_atual in (
                    "maquinas",
                    "producao"
                ):

                    if departamento == "producao":

                        patrimonio_isolado_setor += total

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro ao separar máquinas por setor: {e}"
            )

        # ==================================================================
        # 10. FOLHA CLT - CUSTO FIXO
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(salario_base),
                        0
                    ) AS total
                FROM folha_funcionarios
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado = cursor.fetchone()

            if resultado:

                custo_fixo_total_global += numero(
                    resultado.get("total"),
                    0.0
                )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ folha_funcionarios indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em folha_funcionarios: {e}"
            )

        # ==================================================================
        # 11. RH DA ESTRUTURA
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(subtotal),
                        0
                    ) AS total
                FROM estrutura_rh
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado = cursor.fetchone()

            if resultado:

                rh_setor_valor = numero(
                    resultado.get("total"),
                    0.0
                )

                custo_fixo_total_global += (
                    rh_setor_valor
                )

                if departamento_atual == "estrutura":

                    custo_fixo_isolado_setor += (
                        rh_setor_valor
                    )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ estrutura_rh indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em estrutura_rh: {e}"
            )

        # ==================================================================
        # 12. CUSTOS VARIÁVEIS DA FOLHA
        # ==================================================================

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(
                            COALESCE(
                                encargos_patronais,
                                0
                            )
                            +
                            COALESCE(
                                valor_horas_extras,
                                0
                            )
                        ),
                        0
                    ) AS total
                FROM livro_razonete_folha
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            resultado = cursor.fetchone()

            if resultado:

                custo_variavel_total_global += numero(
                    resultado.get("total"),
                    0.0
                )

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_variavel_isolado_setor += numero(
                        resultado.get("total"),
                        0.0
                    )

        except psycopg2.ProgrammingError:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.info(
                "ℹ️ livro_razonete_folha indisponível."
            )

        except Exception as e:

            try:
                conexao.rollback()
            except Exception:
                pass

            logger.warning(
                f"⚠️ Erro em livro_razonete_folha: {e}"
            )

        # ==================================================================
        # 13. ORÇAMENTO DO DEPARTAMENTO
        # ==================================================================

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            orcamento_liberado,
                            0
                        ) AS orcamento_liberado
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

                resultado = cursor.fetchone()

                if resultado:

                    orcamento_liberado_setor = numero(
                        resultado.get(
                            "orcamento_liberado"
                        ),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as e:

                try:
                    conexao.rollback()
                except Exception:
                    pass

                logger.warning(
                    f"⚠️ Erro em departamentos_orcamento: {e}"
                )

        # ==================================================================
        # 14. GASTOS ESPECÍFICOS DO SETOR
        # ==================================================================

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            SUM(valor),
                            0
                        ) AS total
                    FROM fluxo_caixa
                    WHERE equipe_id = %s
                      AND departamento = %s
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                resultado = cursor.fetchone()

                if resultado:

                    gastos_especificos_setor = numero(
                        resultado.get("total"),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as e:

                try:
                    conexao.rollback()
                except Exception:
                    pass

                logger.warning(
                    f"⚠️ Erro ao consultar gastos do setor: {e}"
                )

        # ==================================================================
        # 15. NORMALIZAÇÃO DOS VALORES
        # ==================================================================

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

        # ==================================================================
        # 16. REGRA CENTRAL DO CAPITAL DE GIRO
        # ==================================================================
        #
        # A empresa começa com o CAPITAL INICIAL.
        #
        # O patrimônio adquirido não é dinheiro disponível:
        # ele passa a representar ativo da empresa.
        #
        # Portanto:
        #
        # CAPITAL DE GIRO =
        #
        # capital inicial
        # + resultado líquido do caixa
        # - patrimônio atual
        # - custos fixos
        # - custos variáveis
        #
        # ==================================================================

        capital_disponivel_total = (
            capital_total
            + total_movimentacoes_fluxo
            - patrimonio_ativo_total
            - custo_fixo_total_global
            - custo_variavel_total_global
        )

        # ------------------------------------------------------------------
        # O aluguel global não é mais subtraído separadamente aqui.
        #
        # Ele já está dentro de custo_fixo_total_global.
        #
        # Isso evita DUPLICIDADE.
        # ------------------------------------------------------------------

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        # ==================================================================
        # 17. CAPITAL DISPONÍVEL DO DEPARTAMENTO
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
        # 18. LOG DE AUDITORIA
        # ==================================================================

        logger.info(
            "=================================================="
        )

        logger.info(
            "📊 MOTOR FINANCEIRO TERADMAS"
        )

        logger.info(
            f"Equipe: {id_equipe}"
        )

        logger.info(
            f"Capital inicial: "
            f"R$ {capital_total:,.2f}"
        )

        logger.info(
            f"Fluxo líquido: "
            f"R$ {total_movimentacoes_fluxo:,.2f}"
        )

        logger.info(
            f"Patrimônio atual: "
            f"R$ {patrimonio_ativo_total:,.2f}"
        )

        logger.info(
            f"Custo fixo: "
            f"R$ {custo_fixo_total_global:,.2f}"
        )

        logger.info(
            f"Custo variável: "
            f"R$ {custo_variavel_total_global:,.2f}"
        )

        logger.info(
            f"Capital de giro: "
            f"R$ {capital_disponivel_total:,.2f}"
        )

        logger.info(
            "=================================================="
        )

        # ==================================================================
        # 19. RETORNO FINAL
        # ==================================================================

        return {

            "nome_empresa": (
                nome_empresa.upper()
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

            # --------------------------------------------------------------
            # PATRIMÔNIO
            # --------------------------------------------------------------

            "patrimonio_ativo_total": (
                patrimonio_ativo_total
            ),

            # --------------------------------------------------------------
            # CUSTOS
            # --------------------------------------------------------------

            "custo_fixo_total": (
                custo_fixo_total_global
            ),

            "custo_variavel_total": (
                custo_variavel_total_global
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total_global
            ),

            # --------------------------------------------------------------
            # SETOR
            # --------------------------------------------------------------

            "patrimonio_isolado_setor": (
                patrimonio_isolado_setor
            ),

            "custo_fixo_isolado_setor": (
                custo_fixo_isolado_setor
            ),

            "custo_variavel_isolado_setor": (
                custo_variavel_isolado_setor
            ),

            # --------------------------------------------------------------
            # DADOS AUXILIARES
            # --------------------------------------------------------------

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
            )
        }

    except Exception as e:

        logger.error(
            "❌ Erro crítico no Motor de Métricas de Caixa: "
            f"{e}"
        )

        try:
            conexao.rollback()
        except Exception:
            pass

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

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            liberar_conexao_master(conexao)
