# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# REGRA PATRIMONIAL:
# --------------------------------------------------------------------------
# O patrimônio NÃO é um saldo acumulado.
#
# Ele é recalculado diretamente das tabelas atuais do Supabase a cada
# requisição. Portanto:
#
#   NOVO ATIVO      -> aumenta patrimônio
#   ALTERAÇÃO       -> atualiza patrimônio
#   EXCLUSÃO        -> reduz patrimônio
#
# REGRA DO CAPITAL DE GIRO:
#
#   CAPITAL INICIAL
#   + FLUXO DE CAIXA LÍQUIDO
#   - PATRIMÔNIO ATUAL
#   - CUSTOS FIXOS
#   - CUSTOS VARIÁVEIS
#   = CAPITAL DISPONÍVEL / CAPITAL DE GIRO
#
# IMPORTANTE:
# O aluguel/condomínio não é patrimônio.
# Ele é custo operacional.
#
# ==========================================================================

import os
import logging

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


# ==========================================================================
# LOGGING
# ==========================================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


# ==========================================================================
# POOL GLOBAL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria ou retorna o pool global de conexões PostgreSQL.

    O DATABASE_URL deve ser fornecido pelo ambiente de produção
    (Supabase/Render/etc.).
    """

    global _connection_pool

    if _connection_pool is not None:
        return _connection_pool

    database_url = os.environ.get("DATABASE_URL")

    # Fallback apenas para desenvolvimento local.
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

        logger.info("✅ Pool de conexões PostgreSQL criado com sucesso.")

        return _connection_pool

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Erro ao criar pool de conexões PostgreSQL: {erro}"
        )

        _connection_pool = None

        return None


def obter_conexao_master():
    """
    Obtém uma conexão disponível do pool.
    """

    try:
        pool = obter_pool_conexoes()

        if pool:
            return pool.getconn()

        database_url = os.environ.get("DATABASE_URL")

        if database_url:
            return psycopg2.connect(database_url)

        raise psycopg2.DatabaseError(
            "DATABASE_URL não configurada no ambiente."
        )

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Erro ao obter conexão com PostgreSQL: {erro}"
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

    except Exception as erro:

        logger.warning(
            f"⚠️ Erro ao liberar conexão: {erro}"
        )

        try:
            conexao.close()
        except Exception:
            pass


# ==========================================================================
# AUXILIARES
# ==========================================================================

def numero_seguro(valor, padrao=0.0):
    """
    Converte valores numéricos vindos do PostgreSQL para float
    sem permitir None ou valores inválidos.
    """

    try:

        if valor is None:
            return float(padrao)

        return float(valor)

    except (TypeError, ValueError):

        return float(padrao)


def executar_soma(cursor, sql, parametros):
    """
    Executa uma consulta SUM e retorna 0 quando a tabela/registro
    não existir.

    Isso permite que módulos opcionais do ERP não derrubem o
    painel financeiro.
    """

    try:

        cursor.execute(sql, parametros)

        resultado = cursor.fetchone()

        if not resultado:
            return 0.0

        valor = resultado.get("total", 0)

        return numero_seguro(valor)

    except psycopg2.ProgrammingError:

        # Tabela/coluna inexistente.
        try:
            cursor.connection.rollback()
        except Exception:
            pass

        return 0.0

    except psycopg2.Error as erro:

        logger.warning(
            f"⚠️ Falha em consulta de soma: {erro}"
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
    Consolida todas as métricas financeiras e patrimoniais da equipe.

    ----------------------------------------------------------------------
    FONTE DA VERDADE
    ----------------------------------------------------------------------

    O Supabase é a fonte da verdade.

    O patrimônio é calculado novamente a cada chamada desta função.

    Portanto, se o estudante:

        - cadastrar uma máquina;
        - editar uma máquina;
        - excluir uma máquina;
        - alterar estoque;
        - excluir material;

    o valor apresentado pelo painel será recalculado na próxima consulta.

    ----------------------------------------------------------------------
    PATRIMÔNIO
    ----------------------------------------------------------------------

    patrimônio_ativo_total =
        máquinas produção
      + máquinas estrutura
      + máquinas utensílios
      + materiais/estoque
      + demais ativos efetivamente cadastrados em tabelas patrimoniais

    ----------------------------------------------------------------------
    CAPITAL DE GIRO
    ----------------------------------------------------------------------

    capital_disponivel_total =
        capital_total
      + fluxo_caixa_liquido
      - patrimonio_ativo_total
      - custo_fixo_total_global
      - custo_variavel_total_global

    """

    conexao = obter_conexao_master()

    cursor = None

    # ----------------------------------------------------------------------
    # VALORES SEGUROS DE PARTIDA
    # ----------------------------------------------------------------------

    capital_total = 5_000_000.00

    nome_empresa = "GRUPO ACADÊMICO"

    valor_aluguel_global = 0.0

    total_movimentacoes_fluxo = 0.0

    # ----------------------------------------------------------------------
    # PATRIMÔNIO GLOBAL
    # ----------------------------------------------------------------------

    patrimonio_maquinas_producao = 0.0

    patrimonio_maquinas_estrutura = 0.0

    patrimonio_maquinas_utensilios = 0.0

    patrimonio_materiais = 0.0

    patrimonio_outros_ativos = 0.0

    patrimonio_ativo_total = 0.0

    # ----------------------------------------------------------------------
    # CUSTOS GLOBAIS
    # ----------------------------------------------------------------------

    custo_fixo_total_global = 0.0

    custo_variavel_total_global = 0.0

    # ----------------------------------------------------------------------
    # MÉTRICAS ISOLADAS
    # ----------------------------------------------------------------------

    patrimonio_isolado_setor = 0.0

    custo_fixo_isolado_setor = 0.0

    custo_variavel_isolado_setor = 0.0

    # ----------------------------------------------------------------------
    # ORÇAMENTO SETORIAL
    # ----------------------------------------------------------------------

    orcamento_liberado_setor = 0.0

    gastos_especificos_setor = 0.0

    # ==========================================================================
    # SEM CONEXÃO
    # ==========================================================================

    if not conexao:

        logger.error(
            "❌ Falha ao obter conexão com banco de dados."
        )

        return {
            "nome_empresa": "MODO SEGURANÇA",

            "capital_total": 5_000_000.00,

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

    # ==========================================================================
    # PROCESSAMENTO
    # ==========================================================================

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ======================================================================
        # 1. CAPITAL INICIAL / CONFIGURAÇÃO DA EMPRESA
        # ======================================================================

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

                capital_total = numero_seguro(
                    config.get("capital_total"),
                    capital_total
                )

                valor_aluguel_global = numero_seguro(
                    config.get("valor_aluguel"),
                    0.0
                )

                nome_empresa = (
                    config.get("nome_empresa")
                    or nome_empresa
                )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ config_simulacao não disponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as erro:

            logger.warning(
                f"⚠️ Erro ao consultar config_simulacao: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ======================================================================
        # 1.1 FALLBACK PARA configuracao_equipes
        # ======================================================================

        if not config:

            tabelas_fallback = [

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

            for tabela, coluna, coluna_filtro in tabelas_fallback:

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

                    registro = cursor.fetchone()

                    if registro:

                        valor = registro.get("valor")

                        if valor is not None:

                            capital_total = numero_seguro(
                                valor,
                                capital_total
                            )

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

        # ======================================================================
        # 2. FLUXO DE CAIXA
        # ======================================================================
        #
        # Convenção adotada:
        #
        # valor > 0 = entrada
        # valor < 0 = saída
        #
        # O SUM representa o resultado líquido do fluxo.
        #
        # ======================================================================

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

                total_movimentacoes_fluxo = numero_seguro(
                    resultado_fluxo.get("total"),
                    0.0
                )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela fluxo_caixa não disponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as erro:

            logger.warning(
                f"⚠️ Erro ao consultar fluxo_caixa: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ======================================================================
        # 3. PATRIMÔNIO - MÁQUINAS DE PRODUÇÃO
        # ======================================================================

        patrimonio_maquinas_producao = executar_soma(
            cursor,

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

        # ======================================================================
        # 4. PATRIMÔNIO - MÁQUINAS DE ESTRUTURA
        # ======================================================================

        patrimonio_maquinas_estrutura = executar_soma(
            cursor,

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

        # ======================================================================
        # 5. PATRIMÔNIO - UTENSÍLIOS
        # ======================================================================

        patrimonio_maquinas_utensilios = executar_soma(
            cursor,

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

        # ======================================================================
        # 6. PATRIMÔNIO - MATERIAIS / ESTOQUE
        # ======================================================================
        #
        # O estoque atual é:
        #
        # quantidade atual x preço unitário atual
        #
        # Se o estudante excluir um material, ele deixa de fazer parte da soma.
        #
        # ======================================================================

        patrimonio_materiais = executar_soma(
            cursor,

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

        # ======================================================================
        # 7. CONSOLIDAÇÃO DINÂMICA DO PATRIMÔNIO
        # ======================================================================
        #
        # ATENÇÃO:
        #
        # Não existe incremento acumulativo aqui.
        #
        # O total é reconstruído a partir do que EXISTE atualmente no banco.
        #
        # ======================================================================

        patrimonio_ativo_total = (
            patrimonio_maquinas_producao
            + patrimonio_maquinas_estrutura
            + patrimonio_maquinas_utensilios
            + patrimonio_materiais
            + patrimonio_outros_ativos
        )

        # ======================================================================
        # 8. PATRIMÔNIO ISOLADO DO SETOR
        # ======================================================================

        if departamento_atual:

            departamento_normalizado = (
                str(departamento_atual)
                .strip()
                .lower()
            )

            if departamento_normalizado in (
                "producao",
                "produção",
                "maquinas",
                "máquinas"
            ):

                patrimonio_isolado_setor = (
                    patrimonio_maquinas_producao
                )

            elif departamento_normalizado == "estrutura":

                patrimonio_isolado_setor = (
                    patrimonio_maquinas_estrutura
                )

            elif departamento_normalizado in (
                "utensilios",
                "utensílios"
            ):

                patrimonio_isolado_setor = (
                    patrimonio_maquinas_utensilios
                )

            elif departamento_normalizado in (
                "materiais",
                "almoxarifado",
                "estoque"
            ):

                patrimonio_isolado_setor = (
                    patrimonio_materiais
                )

        # ======================================================================
        # 9. CUSTOS FIXOS - ALUGUEL E CONDOMÍNIO
        # ======================================================================
        #
        # IMPORTANTE:
        #
        # Aluguel NÃO entra em patrimônio.
        #
        # Ele entra somente em custo fixo.
        #
        # ======================================================================

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

            resultado_imob = cursor.fetchone()

            if resultado_imob:

                imob_aluguel_setor = numero_seguro(
                    resultado_imob.get("aluguel"),
                    0.0
                )

                imob_condo_setor = numero_seguro(
                    resultado_imob.get("condo"),
                    0.0
                )

        except psycopg2.ProgrammingError:

            logger.info(
                "ℹ️ Tabela imoveis_simulacao não disponível."
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        except Exception as erro:

            logger.warning(
                f"⚠️ Erro em imoveis_simulacao: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ======================================================================
        # CUSTO FIXO IMOBILIÁRIO
        # ======================================================================

        custo_fixo_total_global = (
            imob_aluguel_setor
            + imob_condo_setor
        )

        if departamento_atual:

            departamento_normalizado = (
                str(departamento_atual)
                .strip()
                .lower()
            )

            if departamento_normalizado == "estrutura":

                custo_fixo_isolado_setor += (
                    imob_aluguel_setor
                    + imob_condo_setor
                )

        # ======================================================================
        # 10. FOLHA DE FUNCIONÁRIOS
        # ======================================================================

        total_folha_funcionarios = executar_soma(
            cursor,

            """
            SELECT
                COALESCE(SUM(salario_base), 0) AS total
            FROM folha_funcionarios
            WHERE equipe_id = %s
            """,

            (id_equipe,)
        )

        custo_fixo_total_global += (
            total_folha_funcionarios
        )

        # ======================================================================
        # 11. RH DE ESTRUTURA
        # ======================================================================

        rh_estrutura = executar_soma(
            cursor,

            """
            SELECT
                COALESCE(SUM(subtotal), 0) AS total
            FROM estrutura_rh
            WHERE equipe_id = %s
            """,

            (id_equipe,)
        )

        custo_fixo_total_global += rh_estrutura

        if departamento_atual:

            departamento_normalizado = (
                str(departamento_atual)
                .strip()
                .lower()
            )

            if departamento_normalizado == "estrutura":

                custo_fixo_isolado_setor += rh_estrutura

        # ======================================================================
        # 12. CUSTOS VARIÁVEIS DA FOLHA
        # ======================================================================

        custo_variavel_folha = executar_soma(
            cursor,

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

        custo_variavel_total_global += (
            custo_variavel_folha
        )

        if departamento_atual:

            departamento_normalizado = (
                str(departamento_atual)
                .strip()
                .lower()
            )

            if departamento_normalizado in (
                "rh",
                "folha_pagamento",
                "folha",
                "recursos_humanos"
            ):

                custo_variavel_isolado_setor += (
                    custo_variavel_folha
                )

        # ======================================================================
        # 13. ORÇAMENTO DO DEPARTAMENTO
        # ======================================================================

        if departamento_atual:

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(orcamento_liberado, 0)
                            AS orcamento_liberado
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

                dept_orcamento = cursor.fetchone()

                if dept_orcamento:

                    orcamento_liberado_setor = numero_seguro(
                        dept_orcamento.get(
                            "orcamento_liberado"
                        ),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                logger.info(
                    f"ℹ️ departamentos_orcamento não disponível "
                    f"para {departamento_atual}."
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as erro:

                logger.warning(
                    f"⚠️ Erro no orçamento de "
                    f"{departamento_atual}: {erro}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            # ==============================================================
            # GASTOS DO SETOR
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

                resultado_gastos = cursor.fetchone()

                if resultado_gastos:

                    gastos_especificos_setor = numero_seguro(
                        resultado_gastos.get("total"),
                        0.0
                    )

            except psycopg2.ProgrammingError:

                logger.info(
                    f"ℹ️ fluxo_caixa sem filtro setorial "
                    f"disponível para {departamento_atual}."
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            except Exception as erro:

                logger.warning(
                    f"⚠️ Erro ao calcular gastos do setor: {erro}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

        # ======================================================================
        # 14. CAPITAL DE GIRO / CAPITAL DISPONÍVEL
        # ======================================================================
        #
        # ESTA É A CORREÇÃO PRINCIPAL.
        #
        # O patrimônio existente atualmente é debitado do capital.
        #
        # Também são descontados os custos fixos e variáveis.
        #
        # NÃO descontamos novamente valor_aluguel_global aqui,
        # porque aluguel já está dentro de custo_fixo_total_global.
        #
        # ======================================================================

        capital_disponivel_total = (
            capital_total
            + total_movimentacoes_fluxo
            - patrimonio_ativo_total
            - custo_fixo_total_global
            - custo_variavel_total_global
        )

        # ======================================================================
        # 15. CAPITAL DISPONÍVEL DO SETOR
        # ======================================================================

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            - gastos_especificos_setor
        )

        # ======================================================================
        # 16. PROTEÇÃO CONTRA VALORES NEGATIVOS NO PAINEL
        # ======================================================================

        capital_disponivel_total_exibicao = max(
            0.0,
            capital_disponivel_total
        )

        capital_disponivel_departamento_exibicao = max(
            0.0,
            capital_disponivel_departamento
        )

        # ======================================================================
        # 17. LOG DE AUDITORIA
        # ======================================================================

        logger.info(
            "📊 MÉTRICAS CONSOLIDADAS | "
            f"Equipe={id_equipe} | "
            f"Capital=R$ {capital_total:,.2f} | "
            f"Fluxo líquido=R$ {total_movimentacoes_fluxo:,.2f} | "
            f"Patrimônio=R$ {patrimonio_ativo_total:,.2f} | "
            f"Custo fixo=R$ {custo_fixo_total_global:,.2f} | "
            f"Custo variável=R$ {custo_variavel_total_global:,.2f} | "
            f"Giro=R$ {capital_disponivel_total_exibicao:,.2f}"
        )

        # ======================================================================
        # 18. RETORNO PARA O FLASK / METRICS.JS
        # ======================================================================

        return {

            # --------------------------------------------------------------
            # EMPRESA
            # --------------------------------------------------------------

            "nome_empresa": (
                str(nome_empresa).upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            # --------------------------------------------------------------
            # CAPITAL
            # --------------------------------------------------------------

            "capital_total": capital_total,

            "capital_disponivel_total": (
                capital_disponivel_total_exibicao
            ),

            "capital_disponivel_departamento": (
                capital_disponivel_departamento_exibicao
            ),

            # --------------------------------------------------------------
            # PATRIMÔNIO GLOBAL
            # --------------------------------------------------------------

            "patrimonio_ativo_total": (
                patrimonio_ativo_total
            ),

            # Detalhamento patrimonial
            "patrimonio_maquinas_producao": (
                patrimonio_maquinas_producao
            ),

            "patrimonio_maquinas_estrutura": (
                patrimonio_maquinas_estrutura
            ),

            "patrimonio_maquinas_utensilios": (
                patrimonio_maquinas_utensilios
            ),

            "patrimonio_materiais": (
                patrimonio_materiais
            ),

            "patrimonio_outros_ativos": (
                patrimonio_outros_ativos
            ),

            # --------------------------------------------------------------
            # CUSTOS
            # --------------------------------------------------------------

            "custo_fixo_total": (
                custo_fixo_total_global
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total_global
            ),

            "custo_variavel_total": (
                custo_variavel_total_global
            ),

            # --------------------------------------------------------------
            # MÉTRICAS ISOLADAS
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

            "fluxo_caixa_liquido": (
                total_movimentacoes_fluxo
            ),

            "valor_aluguel_global": (
                valor_aluguel_global
            ),

            "orcamento_liberado_setor": (
                orcamento_liberado_setor
            ),

            "gastos_especificos_setor": (
                gastos_especificos_setor
            ),

            # --------------------------------------------------------------
            # MEMÓRIA DE CÁLCULO
            # --------------------------------------------------------------

            "memoria_calculo": {

                "capital_inicial": capital_total,

                "fluxo_caixa_liquido": (
                    total_movimentacoes_fluxo
                ),

                "patrimonio_total": (
                    patrimonio_ativo_total
                ),

                "custos_fixos": (
                    custo_fixo_total_global
                ),

                "custos_variaveis": (
                    custo_variavel_total_global
                ),

                "capital_disponivel": (
                    capital_disponivel_total_exibicao
                )
            }
        }

    # ==========================================================================
    # ERRO CRÍTICO
    # ==========================================================================

    except Exception as erro:

        logger.exception(
            "❌ Erro crítico no Motor de Métricas de Caixa."
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

            "fluxo_caixa_liquido": 0.0,

            "erro": str(erro)
        }

    # ==========================================================================
    # LIBERAÇÃO DOS RECURSOS
    # ==========================================================================

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            liberar_conexao_master(conexao)
