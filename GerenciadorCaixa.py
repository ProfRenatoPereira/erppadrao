# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL
# ARQUIVO: GerenciadorCaixa.py
#
# REVISÃO:
# - Capital inicial vem da configuração real da equipe
# - Capital de giro NÃO pode ultrapassar o capital disponível
# - Patrimônio ativo é descontado do capital de giro
# - Custos fixos são descontados do capital de giro
# - Custos variáveis são descontados do capital de giro
# - Fluxo de caixa é considerado como movimentação financeira
# - Evita desconto duplicado de aluguel
# - Mantém métricas globais e métricas isoladas por departamento
# ==========================================================================

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import logging


# ==========================================================================
# LOGGING
# ==========================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==========================================================================
# POOL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria ou reutiliza o pool de conexões PostgreSQL.
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

            return None

    return _connection_pool


def obter_conexao_master():
    """
    Obtém uma conexão do pool.
    """

    try:

        pool = obter_pool_conexoes()

        if pool:

            conexao = pool.getconn()

            if conexao:
                return conexao

        database_url = os.environ.get("DATABASE_URL")

        if database_url:
            return psycopg2.connect(database_url)

        raise psycopg2.DatabaseError(
            "Não foi possível obter credenciais do banco."
        )

    except psycopg2.Error as e:

        logger.error(
            f"❌ Erro ao obter conexão: {e}"
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
# FUNÇÃO AUXILIAR
# ==========================================================================

def _float_seguro(valor, padrao=0.0):
    """
    Converte qualquer valor numérico para float com segurança.
    """

    try:

        if valor is None:
            return padrao

        return float(valor)

    except (ValueError, TypeError):

        return padrao


# ==========================================================================
# MOTOR CENTRAL DE MÉTRICAS
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Motor financeiro central do TERADMAS ERP.

    REGRA PRINCIPAL DO CAPITAL DE GIRO:

        Capital de Giro =
            Capital Inicial
            + Entradas/Saídas Financeiras
            - Patrimônio Ativo
            - Custos Fixos
            - Custos Variáveis

    Portanto:

        capital_disponivel_total <= capital_total

    quando não houver entradas líquidas superiores ao capital inicial.

    O patrimônio representa capital já imobilizado.
    Os custos representam recursos já consumidos/comprometidos.
    """

    conexao = obter_conexao_master()
    cursor = None

    # ======================================================================
    # VALORES PADRÃO
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
    # ACUMULADORES ISOLADOS
    # ======================================================================

    patrimonio_isolado_setor = 0.0

    custo_fixo_isolado_setor = 0.0

    custo_variavel_isolado_setor = 0.0

    # ======================================================================
    # RETORNO DE SEGURANÇA CASO NÃO HAJA BANCO
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
        # 1. CONFIGURAÇÃO DA EMPRESA
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

                capital_total = _float_seguro(
                    config.get("capital_total"),
                    0.0
                )

                valor_aluguel_global = _float_seguro(
                    config.get("valor_aluguel"),
                    0.0
                )

                nome_empresa = (
                    config.get("nome_empresa")
                    or nome_empresa
                )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ config_simulacao ainda não disponível."
            )

            # Limpa erro pendente da transação
            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro ao consultar config_simulacao: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 2. FALLBACK PARA CONFIGURACAO_EQUIPES
        # ==================================================================

        if not config or capital_total <= 0:

            tabelas_fallback = [

                (
                    "configuracao_equipes",
                    "capital_inicial"
                ),

                (
                    "configuracao_equipes",
                    "capital_social"
                ),

                (
                    "inicializacao_negocio",
                    "capital_inicial"
                ),

                (
                    "inicializacao_negocio",
                    "capital_social"
                )
            ]

            for tabela, coluna in tabelas_fallback:

                try:

                    cursor.execute(
                        f"""
                        SELECT
                            {coluna} AS valor
                        FROM {tabela}
                        WHERE equipe_id = %s
                        LIMIT 1
                        """,
                        (id_equipe,)
                    )

                    registro = cursor.fetchone()

                    if registro:

                        valor = registro.get("valor")

                        if valor is not None:

                            capital_lido = _float_seguro(
                                valor,
                                0.0
                            )

                            if capital_lido > 0:

                                capital_total = capital_lido

                                logger.info(
                                    f"ℹ️ Capital inicial obtido de "
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
        #
        # valor positivo = entrada
        # valor negativo = saída
        #
        # IMPORTANTE:
        # O fluxo entra como movimentação financeira.
        # Patrimônio e custos também são descontados abaixo.
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

                total_movimentacoes_fluxo = _float_seguro(
                    resultado_fluxo.get("total"),
                    0.0
                )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela fluxo_caixa indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro ao consultar fluxo_caixa: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

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

                imob_aluguel_setor = _float_seguro(
                    res_imob.get("aluguel"),
                    0.0
                )

                imob_condo_setor = _float_seguro(
                    res_imob.get("condo"),
                    0.0
                )

                # O aluguel/contrato é considerado custo fixo.
                # NÃO adicionamos aluguel como patrimônio.
                if departamento_atual == "estrutura":

                    custo_fixo_isolado_setor += (
                        imob_aluguel_setor
                        + imob_condo_setor
                    )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela imoveis_simulacao indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro em imoveis_simulacao: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 5. MÁQUINAS
        # ==================================================================

        total_producao = 0.0
        total_estrutura = 0.0
        total_utensilios = 0.0

        try:

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (id_equipe, "PRODUCAO")
            )

            registro = cursor.fetchone()

            total_producao = _float_seguro(
                registro.get("total") if registro else 0,
                0.0
            )

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (id_equipe, "ESTRUTURA")
            )

            registro = cursor.fetchone()

            total_estrutura = _float_seguro(
                registro.get("total") if registro else 0,
                0.0
            )

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM erp_maquinas
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (id_equipe, "UTENSILIOS")
            )

            registro = cursor.fetchone()

            total_utensilios = _float_seguro(
                registro.get("total") if registro else 0,
                0.0
            )

            patrimonio_ativo_total += (
                total_producao
                + total_estrutura
                + total_utensilios
            )

            if departamento_atual == "estrutura":

                patrimonio_isolado_setor += total_estrutura

            elif departamento_atual in (
                "maquinas",
                "producao"
            ):

                patrimonio_isolado_setor += total_producao

            elif departamento_atual == "utensilios":

                patrimonio_isolado_setor += total_utensilios

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela erp_maquinas indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro em erp_maquinas: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 6. MATERIAIS / ALMOXARIFADO
        #
        # Aceita tanto ativos_materiais quanto ativos_materials.
        # ==================================================================

        materiais_total = 0.0

        tabela_materiais_encontrada = False

        for tabela_materiais in (
            "ativos_materiais",
            "ativos_materials"
        ):

            try:

                cursor.execute(
                    f"""
                    SELECT
                        COALESCE(
                            SUM(
                                quantidade_estoque
                                * preco_unitario
                            ),
                            0
                        ) AS total
                    FROM {tabela_materiais}
                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

                res_mat = cursor.fetchone()

                if res_mat:

                    materiais_total = _float_seguro(
                        res_mat.get("total"),
                        0.0
                    )

                tabela_materiais_encontrada = True

                break

            except Exception:

                try:
                    conexao.rollback()
                except Exception:
                    pass

                continue

        if tabela_materiais_encontrada:

            patrimonio_ativo_total += materiais_total

            if departamento_atual == "materiais":

                patrimonio_isolado_setor += materiais_total

        # ==================================================================
        # 7. CONSOLIDAÇÃO DOS CUSTOS FIXOS
        #
        # Aluguel + condomínio
        # ==================================================================

        custo_fixo_imobiliario = (
            imob_aluguel_setor
            + imob_condo_setor
        )

        custo_fixo_total_global += custo_fixo_imobiliario

        # ==================================================================
        # 8. FOLHA CLT
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

                folha_total = _float_seguro(
                    res_rh_global.get("total"),
                    0.0
                )

                custo_fixo_total_global += folha_total

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_fixo_isolado_setor += folha_total

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela folha_funcionarios indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro em folha_funcionarios: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 9. RH / ESTRUTURA
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

                rh_setor_valor = _float_seguro(
                    res_rh_imob.get("total"),
                    0.0
                )

                custo_fixo_total_global += rh_setor_valor

                if departamento_atual == "estrutura":

                    custo_fixo_isolado_setor += rh_setor_valor

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela estrutura_rh indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro em estrutura_rh: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 10. CUSTOS VARIÁVEIS DA FOLHA
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

                folha_variavel = _float_seguro(
                    res_folha_var.get("total"),
                    0.0
                )

                custo_variavel_total_global += folha_variavel

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_variavel_isolado_setor += folha_variavel

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela livro_razonete_folha indisponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as e:

            logger.warning(
                f"⚠️ Erro em livro_razonete_folha: {e}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 11. ORÇAMENTO DO DEPARTAMENTO
        # ==================================================================

        orcamento_liberado_setor = 0.0

        gastos_especificos_setor = 0.0

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        orcamento_liberado
                    FROM departamentos_orcamento
                    WHERE equipe_id = %s
                      AND departamento = %s
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                dept_orc = cursor.fetchone()

                if dept_orc:

                    orcamento_liberado_setor = _float_seguro(
                        dept_orc.get("orcamento_liberado"),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                logger.info(
                    "ℹ️ departamentos_orcamento indisponível."
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as e:

                logger.warning(
                    f"⚠️ Erro em departamentos_orcamento: {e}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            # ==============================================================
            # FLUXO ESPECÍFICO DO DEPARTAMENTO
            # ==============================================================

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

                    gastos_especificos_setor = _float_seguro(
                        res_gastos.get("total"),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                logger.info(
                    "ℹ️ fluxo_caixa indisponível para setor."
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as e:

                logger.warning(
                    f"⚠️ Erro ao filtrar fluxo_caixa: {e}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

        # ==================================================================
        # 12. CÁLCULO CORRETO DO CAPITAL DE GIRO
        # ==================================================================
        #
        # ANTES:
        #
        # capital_total
        # + fluxo
        # - aluguel
        #
        # PROBLEMA:
        # Patrimônio, custos fixos e variáveis não eram descontados.
        #
        # AGORA:
        #
        # CAPITAL DE GIRO =
        #
        # capital_total
        # + movimentações financeiras
        # - patrimônio ativo
        # - custos fixos
        # - custos variáveis
        #
        # O aluguel já está dentro dos custos fixos.
        # Portanto NÃO é descontado novamente.
        # ======================================================================

        capital_disponivel_bruto = (
            capital_total
            + total_movimentacoes_fluxo
            - patrimonio_ativo_total
            - custo_fixo_total_global
            - custo_variavel_total_global
        )

        # Nunca permitir capital de giro negativo na interface.
        capital_disponivel_total = max(
            0.0,
            capital_disponivel_bruto
        )

        # ==================================================================
        # 13. CAPITAL DISPONÍVEL DO DEPARTAMENTO
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
        # 14. LOG DE AUDITORIA
        # ==================================================================

        logger.info(
            "📊 MÉTRICAS FINANCEIRAS - EQUIPE %s | "
            "Capital: R$ %.2f | "
            "Fluxo: R$ %.2f | "
            "Patrimônio: R$ %.2f | "
            "Custos Fixos: R$ %.2f | "
            "Custos Variáveis: R$ %.2f | "
            "Capital de Giro: R$ %.2f",
            id_equipe,
            capital_total,
            total_movimentacoes_fluxo,
            patrimonio_ativo_total,
            custo_fixo_total_global,
            custo_variavel_total_global,
            capital_disponivel_total
        )

        # ==================================================================
        # 15. RETORNO FINAL
        # ==================================================================

        return {

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
            # ISOLAMENTO POR SETOR
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
            # DADOS AUXILIARES DE AUDITORIA
            # --------------------------------------------------------------

            "movimentacoes_fluxo_caixa": (
                total_movimentacoes_fluxo
            ),

            "valor_aluguel_global": (
                valor_aluguel_global
            ),

            "capital_disponivel_bruto": (
                capital_disponivel_bruto
            )
        }

    # ======================================================================
    # ERRO GLOBAL
    # ======================================================================

    except Exception as e:

        logger.error(
            f"❌ Erro crítico no Motor de Métricas de Caixa: {e}"
        )

        try:
            conexao.rollback()
        except Exception:
            pass

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

            "movimentacoes_fluxo_caixa": 0.0,

            "valor_aluguel_global": 0.0,

            "capital_disponivel_bruto": 0.0,

            "erro": str(e)
        }

    # ======================================================================
    # LIMPEZA
    # ======================================================================

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            liberar_conexao_master(conexao)
