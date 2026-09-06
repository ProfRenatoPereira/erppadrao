# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# VERSÃO REVISADA
#
# CORREÇÕES PRINCIPAIS:
# 1. Capital inicial vem prioritariamente de config_simulacao.
# 2. Fallback para configuracao_equipes.capital_inicial.
# 3. Não utiliza capital fictício de R$ 5.000.000,00.
# 4. Não utiliza custo fixo fictício de R$ 21.350,00.
# 5. fluxo_caixa NÃO é mais somado cegamente.
# 6. Entradas aumentam o caixa.
# 7. Saídas diminuem o caixa.
# 8. Gastos por departamento consideram somente saídas.
# 9. Receitas não são tratadas como despesas.
# 10. valor_aluguel da configuração não é subtraído novamente do caixa,
#     evitando dupla contabilização.
# 11. Mantém compatibilidade com os módulos existentes do ERP.
# 12. Retorna métricas globais e métricas isoladas do departamento.
# ==========================================================================

import os
import logging
import psycopg2

from decimal import Decimal
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor


# ==========================================================================
# LOG
# ==========================================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


# ==========================================================================
# POOL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria e mantém um pool de conexões PostgreSQL.

    A DATABASE_URL é obtida do ambiente.
    """

    global _connection_pool

    if _connection_pool is not None:
        return _connection_pool

    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        logger.error(
            "❌ DATABASE_URL não configurada no ambiente."
        )
        return None

    try:

        _connection_pool = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=database_url
        )

        logger.info(
            "✅ Pool de conexões PostgreSQL criado."
        )

        return _connection_pool

    except psycopg2.Error as erro:

        logger.error(
            f"❌ Erro ao criar pool PostgreSQL: {erro}"
        )

        _connection_pool = None

        return None


def obter_conexao_master():
    """
    Obtém uma conexão do pool.
    """

    try:

        pool = obter_pool_conexoes()

        if pool:

            return pool.getconn()

        database_url = os.environ.get(
            "DATABASE_URL"
        )

        if database_url:

            return psycopg2.connect(
                database_url
            )

        return None

    except psycopg2.Error as erro:

        logger.error(
            f"❌ Erro ao obter conexão PostgreSQL: {erro}"
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

            pool.putconn(conexao)

        else:

            conexao.close()

    except Exception as erro:

        logger.warning(
            f"⚠️ Erro ao devolver conexão ao pool: {erro}"
        )

        try:
            conexao.close()
        except Exception:
            pass


# ==========================================================================
# AUXILIARES
# ==========================================================================

def decimal_para_float(valor):
    """
    Converte Decimal, inteiro ou float para float seguro.
    """

    if valor is None:
        return 0.0

    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


def tabela_existe(cursor, tabela):
    """
    Verifica se uma tabela existe no schema public.
    """

    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = %s
        ) AS existe
        """,
        (tabela,)
    )

    resultado = cursor.fetchone()

    return bool(
        resultado and resultado["existe"]
    )


def coluna_existe(cursor, tabela, coluna):
    """
    Verifica se uma coluna existe.
    """

    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        ) AS existe
        """,
        (tabela, coluna)
    )

    resultado = cursor.fetchone()

    return bool(
        resultado and resultado["existe"]
    )


# ==========================================================================
# INTERPRETAÇÃO DO TIPO DO FLUXO DE CAIXA
# ==========================================================================

def classificar_movimento(tipo):
    """
    Normaliza o campo 'tipo' do fluxo_caixa.

    Retorna:

        'entrada'
        'saida'
        'desconhecido'

    O sistema aceita diferentes nomenclaturas que podem existir
    nos módulos do ERP.
    """

    if tipo is None:
        return "desconhecido"

    texto = str(tipo).strip().lower()

    texto = (
        texto
        .replace("á", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ú", "u")
    )

    tipos_entrada = {
        "entrada",
        "receita",
        "receitas",
        "credito",
        "crédito",
        "recebimento",
        "recebimentos",
        "faturamento",
        "venda",
        "vendas",
        "recebido",
        "in",
        "income"
    }

    tipos_saida = {
        "saida",
        "saída",
        "despesa",
        "despesas",
        "debito",
        "débito",
        "pagamento",
        "pagamentos",
        "gasto",
        "gastos",
        "compra",
        "compras",
        "custo",
        "custos",
        "out",
        "expense"
    }

    if texto in tipos_entrada:
        return "entrada"

    if texto in tipos_saida:
        return "saida"

    # Compatibilidade com strings compostas.
    if any(
        palavra in texto
        for palavra in (
            "entrada",
            "receita",
            "recebimento",
            "faturamento",
            "venda"
        )
    ):
        return "entrada"

    if any(
        palavra in texto
        for palavra in (
            "saida",
            "despesa",
            "pagamento",
            "gasto",
            "compra",
            "custo"
        )
    ):
        return "saida"

    return "desconhecido"


# ==========================================================================
# LEITURA DO CAPITAL DA EMPRESA
# ==========================================================================

def obter_configuracao_empresa(
    cursor,
    id_equipe
):
    """
    Recupera nome da empresa e capital inicial.

    ORDEM DE PRIORIDADE:

    1. config_simulacao.capital_total
    2. configuracao_equipes.capital_inicial

    Não utiliza valores fictícios.
    """

    nome_empresa = "EMPRESA NÃO CONFIGURADA"
    capital_total = 0.0

    # ----------------------------------------------------------------------
    # PRIMEIRA FONTE: config_simulacao
    # ----------------------------------------------------------------------

    if tabela_existe(
        cursor,
        "config_simulacao"
    ):

        try:

            cursor.execute(
                """
                SELECT
                    nome_empresa,
                    capital_total
                FROM config_simulacao
                WHERE equipe_id = %s
                LIMIT 1
                """,
                (id_equipe,)
            )

            config = cursor.fetchone()

            if config:

                nome_empresa = (
                    config.get("nome_empresa")
                    or nome_empresa
                )

                capital = config.get(
                    "capital_total"
                )

                if capital is not None:

                    capital_total = decimal_para_float(
                        capital
                    )

                    if capital_total > 0:

                        logger.info(
                            "ℹ️ Capital obtido de "
                            "config_simulacao.capital_total "
                            f"para equipe {id_equipe}: "
                            f"R$ {capital_total:,.2f}"
                        )

                        return (
                            nome_empresa,
                            capital_total
                        )

        except Exception as erro:

            logger.warning(
                "⚠️ Falha ao consultar "
                f"config_simulacao: {erro}"
            )


    # ----------------------------------------------------------------------
    # SEGUNDA FONTE: configuracao_equipes
    # ----------------------------------------------------------------------

    if tabela_existe(
        cursor,
        "configuracao_equipes"
    ):

        try:

            if coluna_existe(
                cursor,
                "configuracao_equipes",
                "capital_inicial"
            ):

                cursor.execute(
                    """
                    SELECT
                        capital_inicial
                    FROM configuracao_equipes
                    WHERE equipe_id = %s
                    LIMIT 1
                    """,
                    (id_equipe,)
                )

                registro = cursor.fetchone()

                if registro:

                    capital = registro.get(
                        "capital_inicial"
                    )

                    if capital is not None:

                        capital_total = decimal_para_float(
                            capital
                        )

                        logger.info(
                            "ℹ️ Capital obtido de "
                            "configuracao_equipes."
                            "capital_inicial: "
                            f"R$ {capital_total:,.2f}"
                        )

        except Exception as erro:

            logger.warning(
                "⚠️ Falha ao consultar "
                f"configuracao_equipes: {erro}"
            )


    return (
        nome_empresa,
        capital_total
    )


# ==========================================================================
# LEITURA DO FLUXO DE CAIXA
# ==========================================================================

def obter_movimentacoes_fluxo(
    cursor,
    id_equipe,
    departamento=None
):
    """
    Lê o fluxo de caixa separando:

        entradas
        saídas
        saldo líquido

    IMPORTANTE:

    Não utiliza simplesmente SUM(valor).

    Cada lançamento é classificado pelo campo 'tipo'.
    """

    entradas = 0.0
    saidas = 0.0
    desconhecidos = 0.0

    if not tabela_existe(
        cursor,
        "fluxo_caixa"
    ):
        return {
            "entradas": 0.0,
            "saidas": 0.0,
            "desconhecidos": 0.0,
            "saldo": 0.0
        }


    try:

        if departamento:

            cursor.execute(
                """
                SELECT
                    valor,
                    tipo
                FROM fluxo_caixa
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (
                    id_equipe,
                    departamento
                )
            )

        else:

            cursor.execute(
                """
                SELECT
                    valor,
                    tipo
                FROM fluxo_caixa
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )


        registros = cursor.fetchall()


        for registro in registros:

            valor = abs(
                decimal_para_float(
                    registro.get("valor")
                )
            )

            classificacao = classificar_movimento(
                registro.get("tipo")
            )

            if classificacao == "entrada":

                entradas += valor

            elif classificacao == "saida":

                saidas += valor

            else:

                # Compatibilidade com lançamentos antigos:
                #
                # Se o tipo não puder ser identificado,
                # NÃO alteramos o caixa automaticamente.
                #
                # Isso evita transformar um lançamento ambíguo
                # em receita ou despesa indevidamente.
                desconhecidos += valor


    except Exception as erro:

        logger.warning(
            "⚠️ Erro ao ler fluxo_caixa: "
            f"{erro}"
        )


    return {
        "entradas": entradas,
        "saidas": saidas,
        "desconhecidos": desconhecidos,
        "saldo": entradas - saidas
    }


# ==========================================================================
# MOTOR CENTRAL DE MÉTRICAS
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Motor financeiro central do TERADMAS ERP.

    Calcula:

    - capital inicial
    - capital disponível
    - patrimônio ativo
    - custos fixos
    - custos variáveis
    - orçamento departamental
    - gastos departamentais
    - métricas isoladas
    """

    if not id_equipe:

        return {
            "status": "erro",
            "message": "Equipe não identificada.",
            "nome_empresa": "EMPRESA NÃO CONFIGURADA",
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
            "erro": "Equipe não identificada"
        }


    conexao = obter_conexao_master()

    if not conexao:

        return {
            "status": "erro",
            "message": "Banco de dados indisponível.",
            "nome_empresa": "BANCO INDISPONÍVEL",
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
            "erro": "Conexão com banco indisponível"
        }


    cursor = None


    # ======================================================================
    # ACUMULADORES
    # ======================================================================

    nome_empresa = "EMPRESA NÃO CONFIGURADA"

    capital_total = 0.0

    capital_disponivel_total = 0.0

    patrimonio_ativo_total = 0.0

    custo_fixo_total_global = 0.0

    custo_variavel_total_global = 0.0

    patrimonio_isolado_setor = 0.0

    custo_fixo_isolado_setor = 0.0

    custo_variavel_isolado_setor = 0.0

    entradas_fluxo = 0.0

    saidas_fluxo = 0.0

    movimentacoes_desconhecidas = 0.0


    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )


        # ==================================================================
        # 1. CONFIGURAÇÃO DA EMPRESA
        # ==================================================================

        (
            nome_empresa,
            capital_total
        ) = obter_configuracao_empresa(
            cursor,
            id_equipe
        )


        # ==================================================================
        # 2. FLUXO DE CAIXA GLOBAL
        # ==================================================================

        fluxo_global = obter_movimentacoes_fluxo(
            cursor,
            id_equipe
        )

        entradas_fluxo = fluxo_global[
            "entradas"
        ]

        saidas_fluxo = fluxo_global[
            "saidas"
        ]

        movimentacoes_desconhecidas = fluxo_global[
            "desconhecidos"
        ]


        # ==================================================================
        # 3. PATRIMÔNIO IMOBILIÁRIO
        # ==================================================================

        imob_aluguel = 0.0

        imob_condominio = 0.0


        if tabela_existe(
            cursor,
            "imoveis_simulacao"
        ):

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            SUM(valor_aluguel),
                            0
                        ) AS aluguel,

                        COALESCE(
                            SUM(valor_condominio),
                            0
                        ) AS condominio

                    FROM imoveis_simulacao

                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

                resultado = cursor.fetchone()

                if resultado:

                    imob_aluguel = decimal_para_float(
                        resultado.get("aluguel")
                    )

                    imob_condominio = decimal_para_float(
                        resultado.get("condominio")
                    )

                    patrimonio_ativo_total += (
                        imob_aluguel
                    )

                    if (
                        departamento_atual
                        and departamento_atual.lower()
                        == "estrutura"
                    ):

                        patrimonio_isolado_setor += (
                            imob_aluguel
                        )

            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em imoveis_simulacao: "
                    f"{erro}"
                )


        # ==================================================================
        # 4. MÁQUINAS
        # ==================================================================

        if tabela_existe(
            cursor,
            "erp_maquinas"
        ):

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
                      AND UPPER(departamento) = 'PRODUCAO'
                    """,
                    (id_equipe,)
                )

                producao = decimal_para_float(
                    cursor.fetchone()["total"]
                )


                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            SUM(preco_compra),
                            0
                        ) AS total

                    FROM erp_maquinas

                    WHERE equipe_id = %s
                      AND UPPER(departamento) = 'ESTRUTURA'
                    """,
                    (id_equipe,)
                )

                estrutura = decimal_para_float(
                    cursor.fetchone()["total"]
                )


                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            SUM(preco_compra),
                            0
                        ) AS total

                    FROM erp_maquinas

                    WHERE equipe_id = %s
                      AND UPPER(departamento) = 'UTENSILIOS'
                    """,
                    (id_equipe,)
                )

                utensilios = decimal_para_float(
                    cursor.fetchone()["total"]
                )


                patrimonio_ativo_total += (
                    producao
                    + estrutura
                    + utensilios
                )


                if departamento_atual:

                    departamento_normalizado = (
                        str(departamento_atual)
                        .strip()
                        .lower()
                    )

                    if (
                        departamento_normalizado
                        == "estrutura"
                    ):

                        patrimonio_isolado_setor += (
                            estrutura
                        )

                    elif departamento_normalizado in (
                        "maquinas",
                        "producao"
                    ):

                        patrimonio_isolado_setor += (
                            producao
                        )

                    elif departamento_normalizado in (
                        "utensilios",
                    ):

                        patrimonio_isolado_setor += (
                            utensilios
                        )


            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em erp_maquinas: "
                    f"{erro}"
                )


        # ==================================================================
        # 5. MATERIAIS / ESTOQUE
        # ==================================================================

        if tabela_existe(
            cursor,
            "ativos_materials"
        ):

            try:

                cursor.execute(
                    """
                    SELECT
                        COALESCE(
                            SUM(
                                quantidade_estoque
                                * preco_unitario
                            ),
                            0
                        ) AS total

                    FROM ativos_materials

                    WHERE equipe_id = %s
                    """,
                    (id_equipe,)
                )

                resultado = cursor.fetchone()

                total_materiais = decimal_para_float(
                    resultado["total"]
                    if resultado
                    else 0
                )


                patrimonio_ativo_total += (
                    total_materiais
                )


                if (
                    departamento_atual
                    and str(
                        departamento_atual
                    ).strip().lower()
                    == "materiais"
                ):

                    patrimonio_isolado_setor += (
                        total_materiais
                    )


            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em ativos_materials: "
                    f"{erro}"
                )


        # ==================================================================
        # 6. CUSTO FIXO - IMÓVEIS
        # ==================================================================

        custo_fixo_total_global += (
            imob_aluguel
            + imob_condominio
        )


        if (
            departamento_atual
            and str(
                departamento_atual
            ).strip().lower()
            == "estrutura"
        ):

            custo_fixo_isolado_setor += (
                imob_aluguel
                + imob_condominio
            )


        # ==================================================================
        # 7. FOLHA DE FUNCIONÁRIOS
        # ==================================================================

        if tabela_existe(
            cursor,
            "folha_funcionarios"
        ):

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

                folha_total = decimal_para_float(
                    resultado["total"]
                    if resultado
                    else 0
                )

                custo_fixo_total_global += (
                    folha_total
                )

            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em folha_funcionarios: "
                    f"{erro}"
                )


        # ==================================================================
        # 8. RH DE ESTRUTURA
        # ==================================================================

        if tabela_existe(
            cursor,
            "estrutura_rh"
        ):

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

                rh_total = decimal_para_float(
                    resultado["total"]
                    if resultado
                    else 0
                )

                custo_fixo_total_global += (
                    rh_total
                )


                if (
                    departamento_atual
                    and str(
                        departamento_atual
                    ).strip().lower()
                    == "estrutura"
                ):

                    custo_fixo_isolado_setor += (
                        rh_total
                    )


            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em estrutura_rh: "
                    f"{erro}"
                )


        # ==================================================================
        # 9. CUSTOS VARIÁVEIS DA FOLHA
        # ==================================================================

        if tabela_existe(
            cursor,
            "livro_razonete_folha"
        ):

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

                variavel_folha = decimal_para_float(
                    resultado["total"]
                    if resultado
                    else 0
                )

                custo_variavel_total_global += (
                    variavel_folha
                )


                if departamento_atual:

                    departamento_normalizado = (
                        str(
                            departamento_atual
                        ).strip().lower()
                    )

                    if departamento_normalizado in (
                        "rh",
                        "folha_pagamento"
                    ):

                        custo_variavel_isolado_setor += (
                            variavel_folha
                        )


            except Exception as erro:

                logger.warning(
                    "⚠️ Erro em "
                    f"livro_razonete_folha: {erro}"
                )


        # ==================================================================
        # 10. ORÇAMENTO DO DEPARTAMENTO
        # ==================================================================

        orcamento_liberado_setor = 0.0

        gastos_especificos_setor = 0.0

        entradas_setor = 0.0

        saidas_setor = 0.0


        if departamento_atual:

            if tabela_existe(
                cursor,
                "departamentos_orcamento"
            ):

                try:

                    cursor.execute(
                        """
                        SELECT
                            COALESCE(
                                orcamento_liberado,
                                0
                            ) AS orcamento

                        FROM departamentos_orcamento

                        WHERE equipe_id = %s
                          AND LOWER(departamento)
                              = LOWER(%s)

                        LIMIT 1
                        """,
                        (
                            id_equipe,
                            departamento_atual
                        )
                    )

                    resultado = cursor.fetchone()

                    if resultado:

                        orcamento_liberado_setor = (
                            decimal_para_float(
                                resultado["orcamento"]
                            )
                        )

                except Exception as erro:

                    logger.warning(
                        "⚠️ Erro em "
                        "departamentos_orcamento: "
                        f"{erro}"
                    )


            # --------------------------------------------------------------
            # Fluxo específico do setor
            # --------------------------------------------------------------

            fluxo_setor = obter_movimentacoes_fluxo(
                cursor,
                id_equipe,
                departamento_atual
            )

            entradas_setor = fluxo_setor[
                "entradas"
            ]

            saidas_setor = fluxo_setor[
                "saidas"
            ]

            gastos_especificos_setor = (
                saidas_setor
            )


        # ==================================================================
        # 11. CAPITAL DISPONÍVEL
        # ==================================================================
        #
        # REGRA CORRETA:
        #
        # capital disponível =
        # capital inicial
        # + entradas efetivas
        # - saídas efetivas
        #
        # Não subtraímos novamente aluguel da config_simulacao.
        #
        # O aluguel somente reduz o caixa quando houver um lançamento
        # financeiro de saída correspondente no fluxo_caixa.
        #
        # ==================================================================

        capital_disponivel_total = (
            capital_total
            + entradas_fluxo
            - saidas_fluxo
        )


        # ------------------------------------------------------------------
        # Saldo departamental
        # ------------------------------------------------------------------

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            + entradas_setor
            - saidas_setor
        )


        # ==================================================================
        # 12. PROTEÇÃO CONTRA RESULTADOS NEGATIVOS
        # ==================================================================

        # O caixa disponível pode ser zero, mas não exibimos valor negativo
        # no dashboard principal.

        capital_disponivel_dashboard = max(
            0.0,
            capital_disponivel_total
        )

        capital_disponivel_departamento_dashboard = max(
            0.0,
            capital_disponivel_departamento
        )


        # ==================================================================
        # 13. RETORNO COMPLETO
        # ==================================================================

        return {

            "status": "sucesso",

            "nome_empresa": (
                str(nome_empresa).upper()
                if nome_empresa
                else "EMPRESA NÃO CONFIGURADA"
            ),

            # --------------------------------------------------------------
            # CAPITAL
            # --------------------------------------------------------------

            "capital_total": capital_total,

            "capital_disponivel_total":
                capital_disponivel_dashboard,

            "capital_disponivel_departamento":
                capital_disponivel_departamento_dashboard,

            # --------------------------------------------------------------
            # FLUXO DE CAIXA
            # --------------------------------------------------------------

            "entradas_fluxo_total":
                entradas_fluxo,

            "saidas_fluxo_total":
                saidas_fluxo,

            "saldo_fluxo_total":
                entradas_fluxo - saidas_fluxo,

            "movimentacoes_fluxo_nao_classificadas":
                movimentacoes_desconhecidas,

            # --------------------------------------------------------------
            # PATRIMÔNIO
            # --------------------------------------------------------------

            "patrimonio_ativo_total":
                patrimonio_ativo_total,

            "patrimonio_isolado_setor":
                patrimonio_isolado_setor,

            # --------------------------------------------------------------
            # CUSTOS
            # --------------------------------------------------------------

            "custo_fixo_total":
                custo_fixo_total_global,

            "custo_fixo_geral_empresa":
                custo_fixo_total_global,

            "custo_variavel_total":
                custo_variavel_total_global,

            "custo_fixo_isolado_setor":
                custo_fixo_isolado_setor,

            "custo_variavel_isolado_setor":
                custo_variavel_isolado_setor,

            # --------------------------------------------------------------
            # ORÇAMENTO
            # --------------------------------------------------------------

            "orcamento_liberado_departamento":
                orcamento_liberado_setor,

            "gastos_departamento":
                gastos_especificos_setor,

            "entradas_departamento":
                entradas_setor,

            "saidas_departamento":
                saidas_setor,

            # --------------------------------------------------------------
            # CONTROLE
            # --------------------------------------------------------------

            "id_equipe":
                id_equipe,

            "departamento":
                departamento_atual
        }


    except Exception as erro:

        logger.exception(
            "❌ Erro crítico no Motor de Métricas: "
            f"{erro}"
        )

        if conexao:

            try:
                conexao.rollback()
            except Exception:
                pass


        return {

            "status": "erro",

            "nome_empresa":
                "ERRO DE PROCESSAMENTO",

            "capital_total":
                0.0,

            "capital_disponivel_total":
                0.0,

            "capital_disponivel_departamento":
                0.0,

            "patrimonio_ativo_total":
                0.0,

            "custo_fixo_total":
                0.0,

            "custo_variavel_total":
                0.0,

            "custo_fixo_geral_empresa":
                0.0,

            "patrimonio_isolado_setor":
                0.0,

            "custo_fixo_isolado_setor":
                0.0,

            "custo_variavel_isolado_setor":
                0.0,

            "erro":
                str(erro)
        }


    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            liberar_conexao_master(
                conexao
            )
