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
# POOL GLOBAL
# ==========================================================================

_connection_pool = None
_pool_connection_ids = set()


def obter_pool_conexoes():
    """
    Cria e reutiliza o pool PostgreSQL.

    DATABASE_URL possui prioridade.
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

            logger.info(
                "Pool PostgreSQL criado com sucesso."
            )

        except psycopg2.Error as exc:

            logger.error(
                "Erro ao criar pool PostgreSQL: %s",
                exc
            )

            _connection_pool = None

    return _connection_pool


# ==========================================================================
# CONEXÃO
# ==========================================================================

def obter_conexao_master():
    """
    Obtém uma conexão do pool.

    Caso o pool não esteja disponível, tenta conexão direta
    utilizando DATABASE_URL.
    """

    try:

        pool = obter_pool_conexoes()

        if pool is not None:

            conexao = pool.getconn()

            _pool_connection_ids.add(
                id(conexao)
            )

            return conexao

        database_url = os.environ.get(
            "DATABASE_URL"
        )

        if database_url:

            return psycopg2.connect(
                database_url
            )

        raise psycopg2.DatabaseError(
            "DATABASE_URL não configurada."
        )

    except psycopg2.Error as exc:

        logger.error(
            "Erro ao obter conexão PostgreSQL: %s",
            exc
        )

        return None


def liberar_conexao_master(conexao):
    """
    Devolve corretamente a conexão ao pool
    ou fecha uma conexão direta.
    """

    if conexao is None:
        return

    conexao_id = id(conexao)

    try:

        if (
            conexao_id in _pool_connection_ids
            and _connection_pool is not None
        ):

            _pool_connection_ids.discard(
                conexao_id
            )

            _connection_pool.putconn(
                conexao
            )

        else:

            conexao.close()

    except Exception as exc:

        logger.warning(
            "Erro ao liberar conexão: %s",
            exc
        )

        try:
            conexao.close()
        except Exception:
            pass


# ==========================================================================
# UTILITÁRIOS
# ==========================================================================

def numero(valor, padrao=0.0):
    """
    Conversão segura para float.
    """

    try:

        if valor is None:
            return float(padrao)

        return float(valor)

    except (TypeError, ValueError):

        return float(padrao)


def rollback_seguro(conexao):
    """
    Executa rollback sem permitir que uma falha
    de rollback derrube o motor.
    """

    try:

        if conexao:
            conexao.rollback()

    except Exception:
        pass


def executar_soma(cursor, sql, parametros=()):
    """
    Executa uma consulta de soma.

    Estrutura inexistente:
        -> retorna 0

    Isso permite que os módulos sejam inicializados
    progressivamente sem quebrar todo o ERP.
    """

    try:

        cursor.execute(
            sql,
            parametros
        )

        resultado = cursor.fetchone()

        if not resultado:
            return 0.0

        return numero(
            resultado.get("total"),
            0.0
        )

    except (
        psycopg2.ProgrammingError,
        psycopg2.UndefinedTable,
        psycopg2.UndefinedColumn
    ) as exc:

        logger.info(
            "Estrutura ainda não disponível: %s",
            exc
        )

        rollback_seguro(
            cursor.connection
        )

        return 0.0

    except Exception as exc:

        logger.warning(
            "Erro em soma SQL: %s",
            exc
        )

        rollback_seguro(
            cursor.connection
        )

        return 0.0


def consultar_colunas(cursor, tabela):
    """
    Retorna as colunas existentes de uma tabela.

    Usado somente para compatibilidade durante
    a evolução do banco.
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

        rollback_seguro(
            cursor.connection
        )

        return set()


# ==========================================================================
# CAPITAL INICIAL / CONFIGURAÇÃO
# ==========================================================================

def obter_configuracao_empresa(
    cursor,
    id_equipe
):
    """
    Obtém a configuração principal da empresa.

    Retorna:

        capital_total
        nome_empresa
        valor_aluguel
        config_encontrada
    """

    capital_total = 5000000.00

    nome_empresa = (
        "GRUPO ACADÊMICO"
    )

    valor_aluguel = 0.0

    config_encontrada = False

    # ------------------------------------------------------------------
    # CONFIGURAÇÃO PRINCIPAL
    # ------------------------------------------------------------------

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

            config_encontrada = True

            capital_total = numero(
                config.get("capital_total"),
                capital_total
            )

            nome_empresa = (
                config.get("nome_empresa")
                or nome_empresa
            )

            valor_aluguel = numero(
                config.get("valor_aluguel"),
                0.0
            )

    except Exception:

        rollback_seguro(
            cursor.connection
        )

        config = None

    # ------------------------------------------------------------------
    # COMPATIBILIDADE COM ESTRUTURAS ANTIGAS
    # ------------------------------------------------------------------

    if not config_encontrada:

        tabelas_capital = [

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

        for tabela, coluna in tabelas_capital:

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

                rollback_seguro(
                    cursor.connection
                )

    return (
        capital_total,
        nome_empresa,
        valor_aluguel
    )


# ==========================================================================
# PATRIMÔNIO - IMÓVEIS
# ==========================================================================

def obter_patrimonio_imoveis(
    cursor,
    id_equipe
):
    """
    Calcula somente o valor patrimonial atual dos imóveis.

    Aluguel e condomínio NÃO são patrimônio.

    Se a estrutura possuir uma coluna de aquisição,
    ela será utilizada.

    Retorna:

        patrimonio
        aluguel
        condominio
    """

    patrimonio = 0.0
    aluguel = 0.0
    condominio = 0.0

    colunas = consultar_colunas(
        cursor,
        "imoveis_simulacao"
    )

    if not colunas:

        return (
            patrimonio,
            aluguel,
            condominio
        )

    # ------------------------------------------------------------------
    # VALOR PATRIMONIAL
    # ------------------------------------------------------------------

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

        patrimonio = executar_soma(
            cursor,
            f"""
            SELECT
                COALESCE(
                    SUM({coluna_ativo}),
                    0
                ) AS total
            FROM imoveis_simulacao
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

    # ------------------------------------------------------------------
    # ALUGUEL
    # ------------------------------------------------------------------

    if "valor_aluguel" in colunas:

        aluguel = executar_soma(
            cursor,
            """
            SELECT
                COALESCE(
                    SUM(valor_aluguel),
                    0
                ) AS total
            FROM imoveis_simulacao
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

    # ------------------------------------------------------------------
    # CONDOMÍNIO
    # ------------------------------------------------------------------

    if "valor_condominio" in colunas:

        condominio = executar_soma(
            cursor,
            """
            SELECT
                COALESCE(
                    SUM(valor_condominio),
                    0
                ) AS total
            FROM imoveis_simulacao
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

    return (
        patrimonio,
        aluguel,
        condominio
    )


# ==========================================================================
# MOTOR FINANCEIRO CENTRAL
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Calcula a situação financeira atual da empresa.

    ----------------------------------------------------------------------
    CONCEITO CENTRAL
    ----------------------------------------------------------------------

    CAPITAL INICIAL
        valor disponibilizado na criação da empresa.

    FLUXO DE CAIXA
        dinheiro efetivamente movimentado.

    PATRIMÔNIO
        ativos existentes atualmente.

    CUSTOS
        indicadores administrativos.

    ----------------------------------------------------------------------
    REGRA DO CAIXA
    ----------------------------------------------------------------------

        CAIXA ATUAL =
            CAPITAL INICIAL
            + FLUXO LÍQUIDO

    ----------------------------------------------------------------------
    REGRA DO PATRIMÔNIO
    ----------------------------------------------------------------------

        PATRIMÔNIO ATUAL =
            imóveis atuais
            + máquinas atuais
            + estoque atual
            + demais ativos atuais

    ----------------------------------------------------------------------
    IMPORTANTE
    ----------------------------------------------------------------------

    Custos NÃO são subtraídos novamente do caixa.

    Se um pagamento já foi lançado em fluxo_caixa:

        salário -> saída
        aluguel -> saída
        compra -> saída
        fornecedor -> saída

    o dinheiro já foi reduzido pelo fluxo.

    Subtrair novamente o custo produziria dupla contagem.

    ----------------------------------------------------------------------
    """

    conexao = obter_conexao_master()

    # ==================================================================
    # ESTADO PADRÃO
    # ==================================================================

    capital_total = 5000000.00

    nome_empresa = (
        "GRUPO ACADÊMICO"
    )

    valor_aluguel_global = 0.0

    # ------------------------------------------------------------------
    # CAIXA
    # ------------------------------------------------------------------

    total_movimentacoes_fluxo = 0.0
    total_entradas_fluxo = 0.0
    total_saidas_fluxo = 0.0

    # ------------------------------------------------------------------
    # PATRIMÔNIO
    # ------------------------------------------------------------------

    patrimonio_imoveis = 0.0
    patrimonio_maquinas = 0.0
    patrimonio_materiais = 0.0

    patrimonio_ativo_total = 0.0

    # ------------------------------------------------------------------
    # CUSTOS
    # ------------------------------------------------------------------

    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0

    # ------------------------------------------------------------------
    # SETOR
    # ------------------------------------------------------------------

    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    # ------------------------------------------------------------------
    # ORÇAMENTO
    # ------------------------------------------------------------------

    orcamento_liberado_setor = 0.0
    gastos_especificos_setor = 0.0

    # ==================================================================
    # SEM CONEXÃO
    # ==================================================================

    if not conexao:

        logger.error(
            "Falha ao obter conexão com banco de dados."
        )

        return {

            "nome_empresa": (
                "MODO SEGURANÇA"
            ),

            "capital_total": (
                capital_total
            ),

            "capital_disponivel_total": (
                0.0
            ),

            "capital_disponivel_departamento": (
                0.0
            ),

            "patrimonio_ativo_total": (
                0.0
            ),

            "custo_fixo_total": (
                0.0
            ),

            "custo_variavel_total": (
                0.0
            ),

            "custo_fixo_geral_empresa": (
                0.0
            ),

            "patrimonio_isolado_setor": (
                0.0
            ),

            "custo_fixo_isolado_setor": (
                0.0
            ),

            "custo_variavel_isolado_setor": (
                0.0
            ),

            "total_movimentacoes_fluxo": (
                0.0
            ),

            "total_entradas_fluxo": (
                0.0
            ),

            "total_saidas_fluxo": (
                0.0
            ),

            "patrimonio_imoveis": (
                0.0
            ),

            "patrimonio_maquinas": (
                0.0
            ),

            "patrimonio_materiais": (
                0.0
            ),

            "erro": (
                "Conexão com banco de dados indisponível"
            )
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==============================================================
        # 1. EMPRESA / CAPITAL INICIAL
        # ==============================================================

        (
            capital_total,
            nome_empresa,
            valor_aluguel_global
        ) = obter_configuracao_empresa(
            cursor,
            id_equipe
        )

        # ==============================================================
        # 2. FLUXO DE CAIXA
        # ==============================================================

        total_movimentacoes_fluxo = executar_soma(
            cursor,

            """
            SELECT
                COALESCE(
                    SUM(valor),
                    0
                ) AS total
            FROM fluxo_caixa
            WHERE equipe_id = %s
            """,

            (id_equipe,)
        )

        # ==============================================================
        # 3. ENTRADAS
        # ==============================================================

        total_entradas_fluxo = executar_soma(
            cursor,

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

        # ==============================================================
        # 4. SAÍDAS
        # ==============================================================

        total_saidas_fluxo = executar_soma(
            cursor,

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

        # ==============================================================
        # 5. IMÓVEIS
        # ==============================================================

        (
            patrimonio_imoveis,
            aluguel_imoveis,
            condominio_imoveis
        ) = obter_patrimonio_imoveis(
            cursor,
            id_equipe
        )

        patrimonio_ativo_total += (
            patrimonio_imoveis
        )

        # Aluguel e condomínio são custos.
        # Não entram como patrimônio.

        custo_fixo_total_global += (
            aluguel_imoveis
            + condominio_imoveis
        )

        valor_aluguel_global = (
            aluguel_imoveis
        )

        if departamento_atual == "estrutura":

            patrimonio_isolado_setor += (
                patrimonio_imoveis
            )

            custo_fixo_isolado_setor += (
                aluguel_imoveis
                + condominio_imoveis
            )

        # ==============================================================
        # 6. MÁQUINAS
        # ==============================================================

        patrimonio_maquinas = executar_soma(
            cursor,

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

        patrimonio_ativo_total += (
            patrimonio_maquinas
        )

        # ==============================================================
        # 7. MATERIAIS / ESTOQUE
        # ==============================================================

        patrimonio_materiais = executar_soma(
            cursor,

            """
            SELECT
                COALESCE(
                    SUM(
                        COALESCE(
                            quantidade_estoque,
                            0
                        )
                        *
                        COALESCE(
                            preco_unitario,
                            0
                        )
                    ),
                    0
                ) AS total
            FROM ativos_materials
            WHERE equipe_id = %s
            """,

            (id_equipe,)
        )

        patrimonio_ativo_total += (
            patrimonio_materiais
        )

        if departamento_atual == "materiais":

            patrimonio_isolado_setor += (
                patrimonio_materiais
            )

        # ==============================================================
        # 8. MÁQUINAS POR DEPARTAMENTO
        # ==============================================================

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

            registros = cursor.fetchall()

            for registro in registros:

                departamento = (
                    str(
                        registro.get(
                            "departamento"
                        )
                        or ""
                    )
                    .strip()
                    .lower()
                )

                total = numero(
                    registro.get(
                        "total"
                    ),
                    0.0
                )

                if (
                    departamento_atual
                    == "estrutura"
                    and departamento
                    == "estrutura"
                ):

                    patrimonio_isolado_setor += (
                        total
                    )

                elif (
                    departamento_atual
                    in (
                        "maquinas",
                        "producao"
                    )
                    and departamento
                    == "producao"
                ):

                    patrimonio_isolado_setor += (
                        total
                    )

        except Exception as exc:

            rollback_seguro(
                conexao
            )

            logger.warning(
                "Erro ao separar máquinas por setor: %s",
                exc
            )

        # ==============================================================
        # 9. FOLHA CLT
        # ==============================================================

        folha_fixa = executar_soma(
            cursor,

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

        custo_fixo_total_global += (
            folha_fixa
        )

        # ==============================================================
        # 10. RH / ESTRUTURA
        # ==============================================================

        rh_setor_valor = executar_soma(
            cursor,

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

        custo_fixo_total_global += (
            rh_setor_valor
        )

        if departamento_atual == "estrutura":

            custo_fixo_isolado_setor += (
                rh_setor_valor
            )

        # ==============================================================
        # 11. CUSTOS VARIÁVEIS DA FOLHA
        # ==============================================================

        folha_variavel = executar_soma(
            cursor,

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

        custo_variavel_total_global += (
            folha_variavel
        )

        if departamento_atual in (
            "rh",
            "folha_pagamento"
        ):

            custo_variavel_isolado_setor += (
                folha_variavel
            )

        # ==============================================================
        # 12. ORÇAMENTO DO DEPARTAMENTO
        # ==============================================================

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

                resultado = (
                    cursor.fetchone()
                )

                if resultado:

                    orcamento_liberado_setor = (
                        numero(
                            resultado.get(
                                "orcamento_liberado"
                            ),
                            0.0
                        )
                    )

            except Exception:

                rollback_seguro(
                    conexao
                )

        # ==============================================================
        # 13. GASTOS ESPECÍFICOS DO DEPARTAMENTO
        # ==============================================================

        if departamento_atual:

            gastos_especificos_setor = (
                executar_soma(
                    cursor,

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
            )

        # ==============================================================
        # 14. NORMALIZAÇÃO
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
        # 15. CAIXA ATUAL
        # ==============================================================

        caixa_atual = (
            capital_total
            + total_movimentacoes_fluxo
        )

        # ==============================================================
        # 16. CAPITAL DISPONÍVEL
        # ==============================================================

        # A disponibilidade financeira é o caixa atual.
        #
        # Não descontamos patrimônio aqui porque a compra do patrimônio
        # já deverá ter produzido uma saída no fluxo de caixa.
        #
        # Exemplo:
        #
        # Capital = R$ 5.000.000
        # Compra máquina = R$ 100.000
        #
        # fluxo = -100.000
        # caixa = 4.900.000
        # patrimônio = 100.000
        #
        # Não podemos fazer:
        #
        # 5.000.000 - 100.000 - 100.000
        #
        # pois isso descontaria a mesma compra duas vezes.

        capital_disponivel_total = max(
            0.0,
            caixa_atual
        )

        # ==============================================================
        # 17. CAPITAL DISPONÍVEL DO DEPARTAMENTO
        # ==============================================================

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            - max(
                0.0,
                gastos_especificos_setor
            )
        )

        capital_disponivel_departamento = max(
            0.0,
            capital_disponivel_departamento
        )

        # ==============================================================
        # 18. LOG DE AUDITORIA
        # ==============================================================

        logger.info(
            "=================================================="
        )

        logger.info(
            "MOTOR FINANCEIRO TERADMAS"
        )

        logger.info(
            "Equipe: %s",
            id_equipe
        )

        logger.info(
            "Empresa: %s",
            nome_empresa
        )

        logger.info(
            "Capital inicial: R$ %,.2f",
            capital_total
        )

        logger.info(
            "Entradas: R$ %,.2f",
            total_entradas_fluxo
        )

        logger.info(
            "Saídas: R$ %,.2f",
            total_saidas_fluxo
        )

        logger.info(
            "Fluxo líquido: R$ %,.2f",
            total_movimentacoes_fluxo
        )

        logger.info(
            "Caixa atual: R$ %,.2f",
            caixa_atual
        )

        logger.info(
            "Patrimônio atual: R$ %,.2f",
            patrimonio_ativo_total
        )

        logger.info(
            "Custos fixos: R$ %,.2f",
            custo_fixo_total_global
        )

        logger.info(
            "Custos variáveis: R$ %,.2f",
            custo_variavel_total_global
        )

        logger.info(
            "Disponibilidade financeira: R$ %,.2f",
            capital_disponivel_total
        )

        logger.info(
            "=================================================="
        )

        # ==============================================================
        # 19. RETORNO
        # ==============================================================

        return {

            # ----------------------------------------------------------
            # EMPRESA
            # ----------------------------------------------------------

            "nome_empresa": (
                str(nome_empresa).upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            # ----------------------------------------------------------
            # CAPITAL
            # ----------------------------------------------------------

            "capital_total": (
                capital_total
            ),

            "capital_inicial": (
                capital_total
            ),

            # ----------------------------------------------------------
            # CAIXA
            # ----------------------------------------------------------

            "caixa_atual": (
                caixa_atual
            ),

            "capital_disponivel_total": (
                capital_disponivel_total
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

            # ----------------------------------------------------------
            # PATRIMÔNIO
            # ----------------------------------------------------------

            "patrimonio_ativo_total": (
                patrimonio_ativo_total
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

            # ----------------------------------------------------------
            # CUSTOS
            # ----------------------------------------------------------

            "custo_fixo_total": (
                custo_fixo_total_global
            ),

            "custo_variavel_total": (
                custo_variavel_total_global
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total_global
            ),

            # ----------------------------------------------------------
            # ALUGUEL
            # ----------------------------------------------------------

            "valor_aluguel_global": (
                valor_aluguel_global
            ),

            # ----------------------------------------------------------
            # SETOR
            # ----------------------------------------------------------

            "patrimonio_isolado_setor": (
                max(
                    0.0,
                    patrimonio_isolado_setor
                )
            ),

            "custo_fixo_isolado_setor": (
                max(
                    0.0,
                    custo_fixo_isolado_setor
                )
            ),

            "custo_variavel_isolado_setor": (
                max(
                    0.0,
                    custo_variavel_isolado_setor
                )
            ),

            # ----------------------------------------------------------
            # ORÇAMENTO
            # ----------------------------------------------------------

            "orcamento_liberado_setor": (
                orcamento_liberado_setor
            ),

            "gastos_especificos_setor": (
                gastos_especificos_setor
            ),

            "capital_disponivel_departamento": (
                capital_disponivel_departamento
            )
        }

    # ==================================================================
    # ERRO CRÍTICO
    # ==================================================================

    except Exception as exc:

        logger.error(
            "Erro crítico no Motor de Métricas de Caixa: %s",
            exc
        )

        rollback_seguro(
            conexao
        )

        return {

            "nome_empresa": (
                "MODO SEGURANÇA"
            ),

            "capital_total": (
                capital_total
            ),

            "capital_inicial": (
                capital_total
            ),

            "caixa_atual": (
                0.0
            ),

            "capital_disponivel_total": (
                0.0
            ),

            "capital_disponivel_departamento": (
                0.0
            ),

            "patrimonio_ativo_total": (
                0.0
            ),

            "custo_fixo_total": (
                0.0
            ),

            "custo_variavel_total": (
                0.0
            ),

            "custo_fixo_geral_empresa": (
                0.0
            ),

            "patrimonio_isolado_setor": (
                0.0
            ),

            "custo_fixo_isolado_setor": (
                0.0
            ),

            "custo_variavel_isolado_setor": (
                0.0
            ),

            "erro": str(exc)
        }

    # ==================================================================
    # FINALIZAÇÃO
    # ==================================================================

    finally:

        if cursor is not None:

            try:
                cursor.close()
            except Exception:
                pass

        liberar_conexao_master(
            conexao
        )
