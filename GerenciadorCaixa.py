# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# REGRA FINANCEIRA:
#
# CAPITAL DE GIRO =
#
#     CAPITAL INICIAL
#   + RESULTADO OPERACIONAL DO FLUXO
#   - PATRIMÔNIO ATIVO ATUAL
#   - CUSTOS FIXOS ATUAIS
#   - CUSTOS VARIÁVEIS ATUAIS
#
# REGRAS:
#
# 1. Cada equipe possui seus próprios dados através de equipe_id.
#
# 2. Patrimônio é DINÂMICO:
#       aquisição  -> aumenta
#       exclusão    -> diminui
#       aquisição   -> aumenta novamente
#
# 3. Patrimônio excluído NÃO permanece no cálculo.
#
# 4. Aquisição de ativo não é receita operacional.
#
# 5. Aluguel/condomínio são custos, não patrimônio.
#
# 6. Nenhum valor patrimonial é fixado neste arquivo.
#
# 7. O capital inicial vem da configuração da equipe.
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


def obter_pool_conexoes():
    """
    Cria e reutiliza o pool PostgreSQL.
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
                "✅ Pool PostgreSQL criado com sucesso"
            )

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
    Obtém uma conexão PostgreSQL.
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
# CONVERSÃO NUMÉRICA
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


# ==========================================================================
# ROLLBACK SEGURO
# ==========================================================================

def rollback_seguro(conexao):
    """
    Executa rollback sem quebrar o motor.
    """

    try:

        if conexao:
            conexao.rollback()

    except Exception:
        pass


# ==========================================================================
# VERIFICAÇÃO DE COLUNAS
# ==========================================================================

def obter_colunas_tabela(cursor, tabela):
    """
    Retorna as colunas existentes em uma tabela.

    Isso permite que o motor trabalhe com pequenas diferenças
    entre versões dos módulos.
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

        registros = cursor.fetchall()

        return {
            str(r["column_name"]).lower()
            for r in registros
        }

    except Exception:

        rollback_seguro(cursor.connection)

        return set()


# ==========================================================================
# CAPITAL INICIAL
# ==========================================================================

def obter_capital_inicial(
    cursor,
    id_equipe
):
    """
    Busca o capital inicial da equipe.

    Não existe capital patrimonial fixado aqui.
    """

    capital_padrao = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    valor_aluguel = 0.0

    # ----------------------------------------------------------------------
    # PRIMEIRA FONTE
    # ----------------------------------------------------------------------

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

        registro = cursor.fetchone()

        if registro:

            capital_padrao = numero(
                registro.get("capital_total"),
                capital_padrao
            )

            nome_empresa = (
                registro.get("nome_empresa")
                or nome_empresa
            )

            valor_aluguel = numero(
                registro.get("valor_aluguel"),
                0.0
            )

            return (
                capital_padrao,
                nome_empresa,
                valor_aluguel
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.info(
            f"ℹ️ config_simulacao não utilizada: {e}"
        )

    # ----------------------------------------------------------------------
    # FALLBACKS
    # ----------------------------------------------------------------------

    fontes = [

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

    for tabela, coluna in fontes:

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

                    capital_padrao = numero(
                        valor,
                        capital_padrao
                    )

                    logger.info(
                        f"💰 Capital inicial: "
                        f"R$ {capital_padrao:,.2f}"
                    )

                    break

        except Exception:

            rollback_seguro(cursor.connection)

            continue

    return (
        capital_padrao,
        nome_empresa,
        valor_aluguel
    )


# ==========================================================================
# PATRIMÔNIO - IMÓVEIS
# ==========================================================================

def calcular_patrimonio_imoveis(
    cursor,
    id_equipe
):
    """
    Calcula o patrimônio imobiliário REALMENTE EXISTENTE.

    IMPORTANTE:
    aluguel e condomínio NÃO são patrimônio.

    Caso a tabela represente contratos de aluguel e não imóveis
    adquiridos, ela não entra no patrimônio.
    """

    patrimonio = 0.0
    custo_fixo = 0.0

    try:

        colunas = obter_colunas_tabela(
            cursor,
            "imoveis_simulacao"
        )

        if not colunas:
            return patrimonio, custo_fixo

        # ------------------------------------------------------------------
        # Tenta encontrar uma coluna que represente valor do imóvel.
        # ------------------------------------------------------------------

        coluna_patrimonio = None

        candidatos = [
            "valor_imovel",
            "valor_compra",
            "preco_compra",
            "valor_aquisicao",
            "valor",
            "preco"
        ]

        for coluna in candidatos:

            if coluna in colunas:

                coluna_patrimonio = coluna
                break

        # ------------------------------------------------------------------
        # Custos de aluguel/condomínio
        # ------------------------------------------------------------------

        coluna_aluguel = (
            "valor_aluguel"
            if "valor_aluguel" in colunas
            else None
        )

        coluna_condominio = (
            "valor_condominio"
            if "valor_condominio" in colunas
            else None
        )

        # ------------------------------------------------------------------
        # PATRIMÔNIO
        # ------------------------------------------------------------------

        if coluna_patrimonio:

            cursor.execute(
                f"""
                SELECT
                    COALESCE(
                        SUM({coluna_patrimonio}),
                        0
                    ) AS total
                FROM imoveis_simulacao
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:

                patrimonio = numero(
                    registro.get("total"),
                    0.0
                )

        # ------------------------------------------------------------------
        # CUSTOS
        # ------------------------------------------------------------------

        expressao_custo = []

        if coluna_aluguel:
            expressao_custo.append(
                f"COALESCE({coluna_aluguel}, 0)"
            )

        if coluna_condominio:
            expressao_custo.append(
                f"COALESCE({coluna_condominio}, 0)"
            )

        if expressao_custo:

            cursor.execute(
                f"""
                SELECT
                    COALESCE(
                        SUM(
                            {' + '.join(expressao_custo)}
                        ),
                        0
                    ) AS total
                FROM imoveis_simulacao
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:

                custo_fixo = numero(
                    registro.get("total"),
                    0.0
                )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular imóveis: {e}"
        )

    return (
        max(0.0, patrimonio),
        max(0.0, custo_fixo)
    )


# ==========================================================================
# PATRIMÔNIO - MÁQUINAS
# ==========================================================================

def calcular_patrimonio_maquinas(
    cursor,
    id_equipe
):
    """
    Soma somente as máquinas que EXISTEM atualmente.
    """

    patrimonio = 0.0
    por_departamento = {}

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
                    registro.get("departamento")
                    or ""
                )
                .strip()
                .lower()
            )

            valor = numero(
                registro.get("total"),
                0.0
            )

            patrimonio += valor

            por_departamento[departamento] = (
                por_departamento.get(
                    departamento,
                    0.0
                )
                + valor
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular máquinas: {e}"
        )

    return (
        max(0.0, patrimonio),
        por_departamento
    )


# ==========================================================================
# PATRIMÔNIO - MATERIAIS
# ==========================================================================

def calcular_patrimonio_materiais(
    cursor,
    id_equipe
):
    """
    Calcula o estoque atual.

    Se o estudante excluir o estoque,
    a soma retorna automaticamente para zero.
    """

    patrimonio = 0.0

    try:

        cursor.execute(
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

        registro = cursor.fetchone()

        if registro:

            patrimonio = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular materiais: {e}"
        )

    return max(0.0, patrimonio)


# ==========================================================================
# CUSTO FIXO - FOLHA
# ==========================================================================

def calcular_custo_fixo_folha(
    cursor,
    id_equipe
):
    """
    Soma os salários atuais da equipe.
    """

    total = 0.0

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

        registro = cursor.fetchone()

        if registro:

            total = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular folha: {e}"
        )

    return max(0.0, total)


# ==========================================================================
# CUSTO FIXO - RH ESTRUTURA
# ==========================================================================

def calcular_custo_fixo_rh(
    cursor,
    id_equipe
):
    """
    Soma os custos atuais do RH da estrutura.
    """

    total = 0.0

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

        registro = cursor.fetchone()

        if registro:

            total = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular RH estrutura: {e}"
        )

    return max(0.0, total)


# ==========================================================================
# CUSTOS VARIÁVEIS
# ==========================================================================

def calcular_custos_variaveis(
    cursor,
    id_equipe
):
    """
    Encargos patronais + horas extras.
    """

    total = 0.0

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

        registro = cursor.fetchone()

        if registro:

            total = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular custos variáveis: {e}"
        )

    return max(0.0, total)


# ==========================================================================
# IDENTIFICAÇÃO DE MOVIMENTAÇÃO PATRIMONIAL
# ==========================================================================

def movimento_patrimonial(descricao):
    """
    Identifica lançamentos de fluxo relacionados à aquisição,
    estoque ou patrimônio.

    Esses movimentos NÃO são receitas operacionais.

    A finalidade é impedir que uma aquisição patrimonial
    gere dinheiro artificial no capital de giro.
    """

    if not descricao:
        return False

    texto = (
        str(descricao)
        .strip()
        .lower()
    )

    palavras_patrimoniais = [

        "aquisição",
        "aquisicao",

        "compra",

        "comprado",

        "comprada",

        "máquina",
        "maquina",

        "máquinas",
        "maquinas",

        "imóvel",
        "imovel",

        "imóveis",
        "imoveis",

        "patrimônio",
        "patrimonio",

        "ativo",

        "estoque",

        "almoxarifado",

        "material",

        "materiais",

        "equipamento",

        "equipamentos"
    ]

    return any(
        palavra in texto
        for palavra in palavras_patrimoniais
    )


# ==========================================================================
# FLUXO OPERACIONAL
# ==========================================================================

def calcular_fluxo_operacional(
    cursor,
    id_equipe
):
    """
    Calcula somente o resultado operacional do fluxo.

    IMPORTANTE:

    O fluxo pode conter registros históricos de aquisição
    de ativos.

    Esses registros não podem ser considerados receita.

    O patrimônio atual é obtido diretamente das tabelas
    atuais de ativos.
    """

    total_operacional = 0.0
    total_entradas = 0.0
    total_saidas = 0.0

    try:

        colunas = obter_colunas_tabela(
            cursor,
            "fluxo_caixa"
        )

        if not colunas:
            return (
                total_operacional,
                total_entradas,
                total_saidas
            )

        # --------------------------------------------------------------
        # Descobrir coluna textual disponível.
        # --------------------------------------------------------------

        coluna_descricao = None

        candidatos = [

            "descricao",
            "descrição",
            "historico",
            "histórico",
            "observacao",
            "observação",
            "tipo",
            "categoria",
            "natureza"
        ]

        for coluna in candidatos:

            if coluna.lower() in colunas:

                coluna_descricao = coluna.lower()

                break

        # --------------------------------------------------------------
        # Sem coluna textual:
        #
        # usa fluxo integral.
        #
        # A recomendação estrutural é que aquisições patrimoniais
        # sejam registradas com uma natureza/categoria patrimonial.
        # --------------------------------------------------------------

        if not coluna_descricao:

            cursor.execute(
                """
                SELECT
                    COALESCE(
                        SUM(valor),
                        0
                    ) AS liquido,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN valor > 0
                                THEN valor
                                ELSE 0
                            END
                        ),
                        0
                    ) AS entradas,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN valor < 0
                                THEN ABS(valor)
                                ELSE 0
                            END
                        ),
                        0
                    ) AS saidas

                FROM fluxo_caixa

                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:

                total_operacional = numero(
                    registro.get("liquido"),
                    0.0
                )

                total_entradas = numero(
                    registro.get("entradas"),
                    0.0
                )

                total_saidas = numero(
                    registro.get("saidas"),
                    0.0
                )

            return (
                total_operacional,
                total_entradas,
                total_saidas
            )

        # --------------------------------------------------------------
        # Com descrição:
        #
        # lê os lançamentos individualmente.
        # --------------------------------------------------------------

        cursor.execute(
            f"""
            SELECT
                valor,
                {coluna_descricao} AS descricao
            FROM fluxo_caixa
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registros = cursor.fetchall()

        for registro in registros:

            valor = numero(
                registro.get("valor"),
                0.0
            )

            descricao = registro.get(
                "descricao"
            )

            # ----------------------------------------------------------
            # Aquisição patrimonial não é receita operacional.
            # ----------------------------------------------------------

            if movimento_patrimonial(descricao):

                logger.info(
                    "🏦 Movimento patrimonial "
                    "ignorado no resultado operacional: "
                    f"{descricao} = R$ {valor:,.2f}"
                )

                continue

            # ----------------------------------------------------------
            # Movimento operacional normal.
            # ----------------------------------------------------------

            total_operacional += valor

            if valor > 0:

                total_entradas += valor

            elif valor < 0:

                total_saidas += abs(valor)

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro ao calcular fluxo operacional: {e}"
        )

    return (
        total_operacional,
        total_entradas,
        total_saidas
    )


# ==========================================================================
# ORÇAMENTO DO DEPARTAMENTO
# ==========================================================================

def calcular_orcamento_departamento(
    cursor,
    id_equipe,
    departamento
):
    """
    Orçamento atualmente liberado para o departamento.
    """

    if not departamento:
        return 0.0

    total = 0.0

    try:

        cursor.execute(
            """
            SELECT
                COALESCE(
                    orcamento_liberado,
                    0
                ) AS total

            FROM departamentos_orcamento

            WHERE equipe_id = %s
              AND departamento = %s

            LIMIT 1
            """,
            (
                id_equipe,
                departamento
            )
        )

        registro = cursor.fetchone()

        if registro:

            total = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro no orçamento do setor: {e}"
        )

    return max(0.0, total)


# ==========================================================================
# GASTOS DO DEPARTAMENTO
# ==========================================================================

def calcular_gastos_departamento(
    cursor,
    id_equipe,
    departamento
):
    """
    Calcula movimentação líquida do departamento.
    """

    if not departamento:
        return 0.0

    total = 0.0

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
                departamento
            )
        )

        registro = cursor.fetchone()

        if registro:

            total = numero(
                registro.get("total"),
                0.0
            )

    except Exception as e:

        rollback_seguro(cursor.connection)

        logger.warning(
            f"⚠️ Erro nos gastos do departamento: {e}"
        )

    return total


# ==========================================================================
# MOTOR PRINCIPAL
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Motor financeiro central da equipe.

    TODAS as consultas utilizam equipe_id.

    Não há valores patrimoniais históricos.
    Não há patrimônio fixado.
    Não há patrimônio acumulado artificialmente.
    """

    conexao = obter_conexao_master()

    # ----------------------------------------------------------------------
    # VALORES INICIAIS
    # ----------------------------------------------------------------------

    capital_total = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    valor_aluguel_global = 0.0

    # Fluxo
    total_movimentacoes_fluxo = 0.0
    total_entradas_fluxo = 0.0
    total_saidas_fluxo = 0.0

    # Patrimônio
    patrimonio_imoveis = 0.0
    patrimonio_maquinas = 0.0
    patrimonio_materiais = 0.0

    patrimonio_ativo_total = 0.0

    # Custos
    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0

    # Setor
    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    # Orçamento
    orcamento_liberado_setor = 0.0
    gastos_especificos_setor = 0.0

    # ----------------------------------------------------------------------
    # SEM CONEXÃO
    # ----------------------------------------------------------------------

    if not conexao:

        logger.error(
            "❌ Banco de dados indisponível."
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

            "total_movimentacoes_fluxo": 0.0,

            "total_entradas_fluxo": 0.0,

            "total_saidas_fluxo": 0.0,

            "patrimonio_imoveis": 0.0,

            "patrimonio_maquinas": 0.0,

            "patrimonio_materiais": 0.0,

            "erro": "Conexão com banco indisponível"
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==================================================================
        # 1. CAPITAL INICIAL DA EQUIPE
        # ==================================================================

        (
            capital_total,
            nome_empresa,
            valor_aluguel_global
        ) = obter_capital_inicial(
            cursor,
            id_equipe
        )

        capital_total = max(
            0.0,
            numero(
                capital_total,
                0.0
            )
        )

        # ==================================================================
        # 2. FLUXO OPERACIONAL
        # ==================================================================

        (
            total_movimentacoes_fluxo,
            total_entradas_fluxo,
            total_saidas_fluxo
        ) = calcular_fluxo_operacional(
            cursor,
            id_equipe
        )

        # ==================================================================
        # 3. PATRIMÔNIO ATUAL - IMÓVEIS
        # ==================================================================

        (
            patrimonio_imoveis,
            custo_imoveis
        ) = calcular_patrimonio_imoveis(
            cursor,
            id_equipe
        )

        patrimonio_ativo_total += (
            patrimonio_imoveis
        )

        custo_fixo_total_global += (
            custo_imoveis
        )

        # ==================================================================
        # 4. PATRIMÔNIO ATUAL - MÁQUINAS
        # ==================================================================

        (
            patrimonio_maquinas,
            maquinas_departamentos
        ) = calcular_patrimonio_maquinas(
            cursor,
            id_equipe
        )

        patrimonio_ativo_total += (
            patrimonio_maquinas
        )

        # ==================================================================
        # 5. PATRIMÔNIO ATUAL - MATERIAIS
        # ==================================================================

        patrimonio_materiais = (
            calcular_patrimonio_materiais(
                cursor,
                id_equipe
            )
        )

        patrimonio_ativo_total += (
            patrimonio_materiais
        )

        # ==================================================================
        # 6. FOLHA
        # ==================================================================

        custo_folha = (
            calcular_custo_fixo_folha(
                cursor,
                id_equipe
            )
        )

        custo_fixo_total_global += (
            custo_folha
        )

        # ==================================================================
        # 7. RH ESTRUTURA
        # ==================================================================

        custo_rh = (
            calcular_custo_fixo_rh(
                cursor,
                id_equipe
            )
        )

        custo_fixo_total_global += (
            custo_rh
        )

        # ==================================================================
        # 8. CUSTOS VARIÁVEIS
        # ==================================================================

        custo_variavel_total_global = (
            calcular_custos_variaveis(
                cursor,
                id_equipe
            )
        )

        # ==================================================================
        # 9. PATRIMÔNIO ISOLADO DO SETOR
        # ==================================================================

        setor = (
            str(
                departamento_atual
                or ""
            )
            .strip()
            .lower()
        )

        if setor == "materiais":

            patrimonio_isolado_setor += (
                patrimonio_materiais
            )

        elif setor in (
            "maquinas",
            "máquinas",
            "producao",
            "produção"
        ):

            patrimonio_isolado_setor += (
                maquinas_departamentos.get(
                    "producao",
                    0.0
                )
            )

        elif setor == "estrutura":

            patrimonio_isolado_setor += (
                maquinas_departamentos.get(
                    "estrutura",
                    0.0
                )
            )

            patrimonio_isolado_setor += (
                patrimonio_imoveis
            )

            custo_fixo_isolado_setor += (
                custo_imoveis
            )

            custo_fixo_isolado_setor += (
                custo_rh
            )

        # ==================================================================
        # 10. CUSTO FIXO ISOLADO DO SETOR
        # ==================================================================

        if setor in (
            "rh",
            "folha_pagamento",
            "folha pagamento"
        ):

            custo_fixo_isolado_setor += (
                custo_folha
            )

        # ==================================================================
        # 11. CUSTO VARIÁVEL ISOLADO
        # ==================================================================

        if setor in (
            "rh",
            "folha_pagamento",
            "folha pagamento"
        ):

            custo_variavel_isolado_setor = (
                custo_variavel_total_global
            )

        # ==================================================================
        # 12. ORÇAMENTO DO SETOR
        # ==================================================================

        if departamento_atual:

            orcamento_liberado_setor = (
                calcular_orcamento_departamento(
                    cursor,
                    id_equipe,
                    departamento_atual
                )
            )

            gastos_especificos_setor = (
                calcular_gastos_departamento(
                    cursor,
                    id_equipe,
                    departamento_atual
                )
            )

        # ==================================================================
        # 13. NORMALIZAÇÃO
        # ==================================================================

        patrimonio_ativo_total = max(
            0.0,
            numero(
                patrimonio_ativo_total,
                0.0
            )
        )

        custo_fixo_total_global = max(
            0.0,
            numero(
                custo_fixo_total_global,
                0.0
            )
        )

        custo_variavel_total_global = max(
            0.0,
            numero(
                custo_variavel_total_global,
                0.0
            )
        )

        # ==================================================================
        # 14. REGRA CENTRAL
        # ==================================================================
        #
        # AQUI ESTÁ A CORREÇÃO PRINCIPAL.
        #
        # Um patrimônio existente reduz o capital disponível.
        #
        # Mas excluir um patrimônio NÃO cria receita.
        #
        # Portanto não usamos nenhuma variável histórica de patrimônio.
        #
        # Exemplo:
        #
        # Capital inicial       = 10.000.000
        # Patrimônio atual      = 1.770.000
        #
        # Capital disponível    = 8.230.000
        #
        # Se o aluno excluir tudo:
        #
        # Patrimônio atual      = 0
        #
        # Capital disponível    = 10.000.000
        #
        # NUNCA:
        #
        # 11.453.500
        #
        # ==================================================================

        capital_disponivel_total = (

            capital_total

            + total_movimentacoes_fluxo

            - patrimonio_ativo_total

            - custo_fixo_total_global

            - custo_variavel_total_global
        )

        # ==================================================================
        # 15. PROTEÇÃO
        # ==================================================================

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        # ==================================================================
        # 16. CAPITAL DO DEPARTAMENTO
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
        # 17. LOG DE AUDITORIA
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
            f"Entradas operacionais: "
            f"R$ {total_entradas_fluxo:,.2f}"
        )

        logger.info(
            f"Saídas operacionais: "
            f"R$ {total_saidas_fluxo:,.2f}"
        )

        logger.info(
            f"Resultado operacional: "
            f"R$ {total_movimentacoes_fluxo:,.2f}"
        )

        logger.info(
            f"Patrimônio imóveis: "
            f"R$ {patrimonio_imoveis:,.2f}"
        )

        logger.info(
            f"Patrimônio máquinas: "
            f"R$ {patrimonio_maquinas:,.2f}"
        )

        logger.info(
            f"Patrimônio materiais: "
            f"R$ {patrimonio_materiais:,.2f}"
        )

        logger.info(
            f"Patrimônio TOTAL ATUAL: "
            f"R$ {patrimonio_ativo_total:,.2f}"
        )

        logger.info(
            f"Custos fixos atuais: "
            f"R$ {custo_fixo_total_global:,.2f}"
        )

        logger.info(
            f"Custos variáveis atuais: "
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
        # 18. RETORNO
        # ==================================================================

        return {

            "nome_empresa": (
                str(
                    nome_empresa
                    or "GRUPO ACADÊMICO"
                ).upper()
            ),

            "capital_total": (
                capital_total
            ),

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

            "patrimonio_imoveis": (
                patrimonio_imoveis
            ),

            "patrimonio_maquinas": (
                patrimonio_maquinas
            ),

            "patrimonio_materiais": (
                patrimonio_materiais
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
            # FLUXO
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

            # --------------------------------------------------------------
            # AUXILIARES
            # --------------------------------------------------------------

            "valor_aluguel_global": (
                valor_aluguel_global
            )
        }

    except Exception as e:

        logger.error(
            "❌ Erro crítico no Motor Financeiro: "
            f"{e}"
        )

        rollback_seguro(conexao)

        return {

            "nome_empresa": "MODO SEGURANÇA",

            "capital_total": capital_total,

            "capital_disponivel_total": 0.0,

            "capital_disponivel_departamento": 0.0,

            "patrimonio_ativo_total": 0.0,

            "patrimonio_imoveis": 0.0,

            "patrimonio_maquinas": 0.0,

            "patrimonio_materiais": 0.0,

            "custo_fixo_total": 0.0,

            "custo_variavel_total": 0.0,

            "custo_fixo_geral_empresa": 0.0,

            "patrimonio_isolado_setor": 0.0,

            "custo_fixo_isolado_setor": 0.0,

            "custo_variavel_isolado_setor": 0.0,

            "total_movimentacoes_fluxo": 0.0,

            "total_entradas_fluxo": 0.0,

            "total_saidas_fluxo": 0.0,

            "erro": str(e)
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
