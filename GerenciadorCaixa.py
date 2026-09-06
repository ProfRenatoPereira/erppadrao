# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# PRINCÍPIOS:
# 1. Conexão exclusivamente pelo pool central.
# 2. Conexão obtida com obter_conexao_master()
#    deve ser devolvida com liberar_conexao_master().
# 3. public.quotas_departamentos é a fonte oficial das quotas.
# 4. Capital disponível:
#
#       CAPITAL INICIAL
#       + RECEITAS
#       - DESPESAS
#
# 5. Nenhuma divisão automática 40/30/30.
# 6. Os setores passam a consumir a quota persistida no Supabase.
# ==========================================================================

import os
import logging
import psycopg2

from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor


# ==========================================================================
# LOG
# ==========================================================================

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)


# ==========================================================================
# POOL CENTRAL
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria ou retorna o pool central de conexões PostgreSQL.

    O pool é único para o processo da aplicação.
    """

    global _connection_pool

    if _connection_pool is not None:
        return _connection_pool

    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        try:
            from app_master import URL_SUPABASE
            database_url = URL_SUPABASE
        except Exception:
            database_url = None

    if not database_url:
        logger.error(
            "❌ DATABASE_URL/URL_SUPABASE não encontrada."
        )
        return None

    try:
        _connection_pool = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=database_url
        )

        logger.info(
            "✅ Pool central PostgreSQL/Supabase criado."
        )

        return _connection_pool

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Falha ao criar pool PostgreSQL: {erro}"
        )
        return None


def obter_conexao_master():
    """
    Obtém uma conexão do pool central.

    IMPORTANTE:
    Quem obtiver a conexão deve obrigatoriamente devolvê-la
    através de liberar_conexao_master().
    """

    try:
        pool = obter_pool_conexoes()

        if pool is None:
            logger.error(
                "❌ Pool central indisponível."
            )
            return None

        conexao = pool.getconn()

        if conexao is None:
            logger.error(
                "❌ Pool não forneceu conexão."
            )
            return None

        return conexao

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Erro ao obter conexão do pool: {erro}"
        )
        return None


def liberar_conexao_master(conexao):
    """
    Devolve a conexão ao pool.

    Não utiliza conexao.close() em condições normais.
    """

    if conexao is None:
        return

    try:
        pool = obter_pool_conexoes()

        if pool is not None:
            pool.putconn(conexao)
            return

        # Somente contingência caso o pool não exista.
        conexao.close()

    except Exception as erro:
        logger.warning(
            f"⚠️ Erro ao devolver conexão ao pool: {erro}"
        )

        # Se a conexão não pôde ser devolvida ao pool,
        # o fechamento é permitido para evitar vazamento.
        try:
            conexao.close()
        except Exception:
            pass


# ==========================================================================
# CONVERSÃO SEGURA
# ==========================================================================

def _float_seguro(valor, padrao=0.0):
    """
    Converte valores PostgreSQL/JSON para float sem derrubar o motor.
    """

    if valor is None:
        return padrao

    try:
        return float(valor)
    except (ValueError, TypeError):
        return padrao


# ==========================================================================
# IDENTIFICAÇÃO DAS COLUNAS DA TABELA DE QUOTAS
# ==========================================================================

def _obter_colunas_quotas(cursor):
    """
    Lê a estrutura real de public.quotas_departamentos.

    Não pressupõe nomes de colunas que não foram informados no
    checkpoint arquitetural.
    """

    try:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'quotas_departamentos'
            ORDER BY ordinal_position
            """
        )

        registros = cursor.fetchall()

        return {
            registro["column_name"]
            for registro in registros
        }

    except Exception as erro:
        logger.warning(
            f"⚠️ Não foi possível inspecionar quotas_departamentos: {erro}"
        )

        return set()


# ==========================================================================
# LEITURA DAS QUOTAS OFICIAIS
# ==========================================================================

def _ler_quotas_departamentos(cursor, id_equipe):
    """
    Lê as quotas persistidas para a equipe.

    A tabela oficial é:

        public.quotas_departamentos

    Chave:

        UNIQUE (equipe_id, departamento_id)

    O método tenta reconhecer automaticamente colunas comuns
    de percentual e valor monetário, sem alterar a estrutura do banco.
    """

    colunas = _obter_colunas_quotas(cursor)

    if not colunas:
        return {
            "existente": False,
            "registros": [],
            "percentual_total": 0.0,
            "valor_total": 0.0
        }

    if "equipe_id" not in colunas or "departamento_id" not in colunas:
        logger.error(
            "❌ quotas_departamentos não possui equipe_id/departamento_id."
        )

        return {
            "existente": False,
            "registros": [],
            "percentual_total": 0.0,
            "valor_total": 0.0
        }

    # ----------------------------------------------------------------------
    # Detecta possíveis nomes de percentual
    # ----------------------------------------------------------------------

    candidatos_percentual = [
        "percentual",
        "percentual_quota",
        "percentual_capital",
        "porcentagem",
        "porcentual",
        "percent"
    ]

    coluna_percentual = next(
        (
            coluna
            for coluna in candidatos_percentual
            if coluna in colunas
        ),
        None
    )

    # ----------------------------------------------------------------------
    # Detecta possíveis nomes de valor monetário
    # ----------------------------------------------------------------------

    candidatos_valor = [
        "valor",
        "valor_quota",
        "valor_cota",
        "valor_alocado",
        "valor_liberado",
        "quota_valor",
        "orcamento_liberado"
    ]

    coluna_valor = next(
        (
            coluna
            for coluna in candidatos_valor
            if coluna in colunas
        ),
        None
    )

    campos = [
        "departamento_id"
    ]

    if coluna_percentual:
        campos.append(coluna_percentual)

    if coluna_valor:
        campos.append(coluna_valor)

    campos_sql = ", ".join(
        f'"{campo}"'
        for campo in campos
    )

    try:
        cursor.execute(
            f"""
            SELECT {campos_sql}
            FROM public.quotas_departamentos
            WHERE equipe_id = %s
            ORDER BY departamento_id
            """,
            (id_equipe,)
        )

        registros_brutos = cursor.fetchall()

    except psycopg2.Error as erro:
        logger.warning(
            f"⚠️ Falha ao ler public.quotas_departamentos: {erro}"
        )

        return {
            "existente": True,
            "registros": [],
            "percentual_total": 0.0,
            "valor_total": 0.0
        }

    registros = []

    percentual_total = 0.0
    valor_total = 0.0

    for registro in registros_brutos:

        percentual = 0.0
        valor = 0.0

        if coluna_percentual:
            percentual = _float_seguro(
                registro.get(coluna_percentual)
            )

        if coluna_valor:
            valor = _float_seguro(
                registro.get(coluna_valor)
            )

        registros.append(
            {
                "departamento_id": registro.get("departamento_id"),
                "percentual": percentual,
                "valor": valor
            }
        )

        percentual_total += percentual
        valor_total += valor

    return {
        "existente": True,
        "registros": registros,
        "percentual_total": percentual_total,
        "valor_total": valor_total
    }


# ==========================================================================
# CAPITAL INICIAL
# ==========================================================================

def _ler_configuracao_empresa(cursor, id_equipe):
    """
    Obtém o capital inicial e o nome da empresa.

    Fonte principal:

        config_simulacao

    Mantém fallback para estruturas antigas do ERP.
    """

    capital_total = 0.0
    valor_aluguel_global = 0.0
    nome_empresa = "GRUPO ACADÊMICO"

    config = None

    # ----------------------------------------------------------------------
    # Fonte oficial atual
    # ----------------------------------------------------------------------

    try:
        cursor.execute(
            """
            SELECT
                nome_empresa,
                capital_total,
                valor_aluguel
            FROM public.config_simulacao
            WHERE equipe_id = %s
            LIMIT 1
            """,
            (id_equipe,)
        )

        config = cursor.fetchone()

    except psycopg2.Error:
        config = None

    if config:
        capital_total = _float_seguro(
            config.get("capital_total")
        )

        valor_aluguel_global = _float_seguro(
            config.get("valor_aluguel")
        )

        nome_empresa = (
            config.get("nome_empresa")
            or nome_empresa
        )

        return (
            capital_total,
            valor_aluguel_global,
            nome_empresa
        )

    # ----------------------------------------------------------------------
    # Fallbacks de versões anteriores
    # ----------------------------------------------------------------------

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
                SELECT "{coluna}" AS valor
                FROM public."{tabela}"
                WHERE equipe_id = %s
                LIMIT 1
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:
                capital_total = _float_seguro(
                    registro.get("valor")
                )

                if capital_total > 0:
                    logger.info(
                        f"ℹ️ Capital recuperado de "
                        f"{tabela}.{coluna}"
                    )
                    break

        except psycopg2.Error:
            continue

    return (
        capital_total,
        valor_aluguel_global,
        nome_empresa
    )


# ==========================================================================
# FLUXO DE CAIXA
# ==========================================================================

def _ler_fluxo_caixa(cursor, id_equipe):
    """
    Calcula o fluxo financeiro real.

    Regra:

        RECEITAS = entradas
        DESPESAS = saídas

        SALDO DO FLUXO =
            RECEITAS - DESPESAS

    O código reconhece tanto tipos textuais quanto sinais numéricos.

    Isso evita o erro conceitual de simplesmente somar todas as linhas.
    """

    receitas = 0.0
    despesas = 0.0

    try:
        cursor.execute(
            """
            SELECT
                tipo,
                COALESCE(SUM(valor), 0) AS total
            FROM public.fluxo_caixa
            WHERE equipe_id = %s
            GROUP BY tipo
            """,
            (id_equipe,)
        )

        registros = cursor.fetchall()

    except psycopg2.Error:
        logger.info(
            "ℹ️ public.fluxo_caixa ainda não disponível."
        )

        return {
            "receitas": 0.0,
            "despesas": 0.0,
            "saldo": 0.0
        }

    for registro in registros:

        tipo = str(
            registro.get("tipo") or ""
        ).strip().lower()

        total = _float_seguro(
            registro.get("total")
        )

        # --------------------------------------------------------------
        # Entradas / receitas
        # --------------------------------------------------------------

        if tipo in {
            "receita",
            "receitas",
            "entrada",
            "entradas",
            "credito",
            "crédito",
            "venda",
            "faturamento",
            "recebimento",
            "recebimentos"
        }:

            receitas += abs(total)

        # --------------------------------------------------------------
        # Saídas / despesas
        # --------------------------------------------------------------

        elif tipo in {
            "despesa",
            "despesas",
            "saida",
            "saída",
            "saidas",
            "saídas",
            "debito",
            "débito",
            "pagamento",
            "pagamentos",
            "custo"
        }:

            despesas += abs(total)

        # --------------------------------------------------------------
        # Tipos desconhecidos:
        #
        # Preserva o sinal do valor.
        #
        # positivo = entrada
        # negativo = saída
        # --------------------------------------------------------------

        else:

            if total >= 0:
                receitas += total
            else:
                despesas += abs(total)

    saldo = receitas - despesas

    return {
        "receitas": receitas,
        "despesas": despesas,
        "saldo": saldo
    }


# ==========================================================================
# DESPESAS FIXAS
# ==========================================================================

def _calcular_custos(cursor, id_equipe):
    """
    Consolida os custos já existentes no ERP.
    """

    custo_fixo = 0.0
    custo_variavel = 0.0

    # ----------------------------------------------------------------------
    # Imóveis
    # ----------------------------------------------------------------------

    imob_aluguel = 0.0
    imob_condominio = 0.0

    try:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(valor_aluguel), 0) AS aluguel,
                COALESCE(SUM(valor_condominio), 0) AS condominio
            FROM public.imoveis_simulacao
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            imob_aluguel = _float_seguro(
                registro.get("aluguel")
            )

            imob_condominio = _float_seguro(
                registro.get("condominio")
            )

            custo_fixo += (
                imob_aluguel +
                imob_condominio
            )

    except psycopg2.Error:
        pass

    # ----------------------------------------------------------------------
    # Folha
    # ----------------------------------------------------------------------

    try:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(subtotal_oneroso), 0) AS total
            FROM public.folha_funcionarios
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            custo_fixo += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:

        # Compatibilidade com versões onde existe salario_base
        try:
            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(salario_base), 0) AS total
                FROM public.folha_funcionarios
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:
                custo_fixo += _float_seguro(
                    registro.get("total")
                )

        except psycopg2.Error:
            pass

    # ----------------------------------------------------------------------
    # Estrutura RH
    # ----------------------------------------------------------------------

    try:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(subtotal), 0) AS total
            FROM public.estrutura_rh
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            custo_fixo += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:
        pass

    # ----------------------------------------------------------------------
    # Variáveis da folha
    # ----------------------------------------------------------------------

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
            FROM public.livro_razonete_folha
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            custo_variavel += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:
        pass

    return {
        "custo_fixo": custo_fixo,
        "custo_variavel": custo_variavel,
        "aluguel": imob_aluguel,
        "condominio": imob_condominio
    }


# ==========================================================================
# PATRIMÔNIO
# ==========================================================================

def _calcular_patrimonio(cursor, id_equipe):
    """
    Soma os ativos já existentes no ecossistema.
    """

    patrimonio = 0.0

    # ----------------------------------------------------------------------
    # Máquinas
    #
    # Usa public.ativos_maquinas como fonte física definida no checkpoint.
    # ----------------------------------------------------------------------

    try:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(preco_compra), 0) AS total
            FROM public.ativos_maquinas
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            patrimonio += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:
        # Compatibilidade com instalação antiga
        try:
            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(preco_compra), 0) AS total
                FROM public.erp_maquinas
                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:
                patrimonio += _float_seguro(
                    registro.get("total")
                )

        except psycopg2.Error:
            pass

    # ----------------------------------------------------------------------
    # Materiais
    # ----------------------------------------------------------------------

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
            FROM public.ativos_materials
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            patrimonio += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:
        pass

    # ----------------------------------------------------------------------
    # Imóveis
    # ----------------------------------------------------------------------

    try:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(valor_aluguel), 0) AS total
            FROM public.imoveis_simulacao
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

        registro = cursor.fetchone()

        if registro:
            patrimonio += _float_seguro(
                registro.get("total")
            )

    except psycopg2.Error:
        pass

    return patrimonio


# ==========================================================================
# MÉTRICA CENTRAL
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    MOTOR FINANCEIRO CENTRAL DO TERADMAS.

    Fórmula principal:

        capital_disponivel_total =
            capital_total
            + receitas
            - despesas

    As quotas NÃO são tratadas como despesas.

    Quota é uma alocação interna do capital para os departamentos.
    """

    conexao = obter_conexao_master()

    if not conexao:

        return {
            "status": "erro",
            "nome_empresa": "MODO SEGURANÇA",
            "capital_total": 0.0,
            "receitas_total": 0.0,
            "despesas_total": 0.0,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,
            "patrimonio_ativo_total": 0.0,
            "custo_fixo_total": 0.0,
            "custo_variavel_total": 0.0,
            "custo_fixo_geral_empresa": 0.0,
            "quotas": [],
            "erro": "Conexão com banco indisponível"
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==================================================================
        # 1. CONFIGURAÇÃO DA EMPRESA
        # ==================================================================

        (
            capital_total,
            valor_aluguel_global,
            nome_empresa
        ) = _ler_configuracao_empresa(
            cursor,
            id_equipe
        )

        # ==================================================================
        # 2. FLUXO FINANCEIRO REAL
        # ==================================================================

        fluxo = _ler_fluxo_caixa(
            cursor,
            id_equipe
        )

        receitas_total = fluxo["receitas"]
        despesas_fluxo = fluxo["despesas"]

        # ==================================================================
        # 3. CUSTOS ESTRUTURAIS
        # ==================================================================

        custos = _calcular_custos(
            cursor,
            id_equipe
        )

        custo_fixo_total = custos["custo_fixo"]
        custo_variavel_total = custos["custo_variavel"]

        # ==================================================================
        # 4. PATRIMÔNIO
        # ==================================================================

        patrimonio_total = _calcular_patrimonio(
            cursor,
            id_equipe
        )

        # ==================================================================
        # 5. QUOTAS OFICIAIS
        # ==================================================================

        quotas = _ler_quotas_departamentos(
            cursor,
            id_equipe
        )

        # ==================================================================
        # 6. CAPITAL DISPONÍVEL
        # ==================================================================
        #
        # AQUI ESTÁ A CORREÇÃO PRINCIPAL.
        #
        # Quota NÃO reduz o capital disponível.
        #
        # Ela somente determina quanto do capital disponível está
        # reservado/alocado para cada departamento.
        #
        # O caixa real é:
        #
        # capital inicial + receitas - despesas
        #
        # ==================================================================

        capital_disponivel_total = (
            capital_total
            + receitas_total
            - despesas_fluxo
        )

        # Nunca deixa o indicador visual entrar em valor negativo.
        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        # ==================================================================
        # 7. QUOTA DO SETOR
        # ==================================================================

        capital_disponivel_departamento = 0.0
        quota_percentual_departamento = 0.0
        quota_valor_departamento = 0.0

        if departamento_atual:

            departamento_texto = str(
                departamento_atual
            ).strip()

            for quota in quotas["registros"]:

                departamento_id = str(
                    quota.get("departamento_id")
                ).strip()

                if departamento_id == departamento_texto:

                    quota_percentual_departamento = (
                        quota.get("percentual") or 0.0
                    )

                    quota_valor_departamento = (
                        quota.get("valor") or 0.0
                    )

                    break

            # --------------------------------------------------------------
            # Se a tabela possui percentual, calcula dinamicamente a quota
            # sobre o capital disponível atual.
            # --------------------------------------------------------------

            if quota_percentual_departamento > 0:

                capital_disponivel_departamento = (
                    capital_disponivel_total
                    *
                    quota_percentual_departamento
                    /
                    100.0
                )

            # --------------------------------------------------------------
            # Caso exista somente valor persistido, usa o valor.
            # --------------------------------------------------------------

            elif quota_valor_departamento > 0:

                capital_disponivel_departamento = (
                    quota_valor_departamento
                )

        # ==================================================================
        # 8. RETORNO UNIFICADO
        # ==================================================================

        return {

            "status": "sucesso",

            # --------------------------------------------------------------
            # Empresa
            # --------------------------------------------------------------

            "nome_empresa": (
                nome_empresa.upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            # --------------------------------------------------------------
            # Caixa
            # --------------------------------------------------------------

            "capital_total": capital_total,

            "receitas_total": receitas_total,

            "despesas_total": despesas_fluxo,

            "saldo_fluxo_caixa": (
                receitas_total -
                despesas_fluxo
            ),

            "capital_disponivel_total": (
                capital_disponivel_total
            ),

            # --------------------------------------------------------------
            # Quotas
            # --------------------------------------------------------------

            "quotas": quotas["registros"],

            "quotas_percentual_total": (
                quotas["percentual_total"]
            ),

            "quotas_valor_total": (
                quotas["valor_total"]
            ),

            "quota_percentual_departamento": (
                quota_percentual_departamento
            ),

            "quota_valor_departamento": (
                quota_valor_departamento
            ),

            "capital_disponivel_departamento": (
                max(
                    0.0,
                    capital_disponivel_departamento
                )
            ),

            # --------------------------------------------------------------
            # Patrimônio
            # --------------------------------------------------------------

            "patrimonio_ativo_total": (
                patrimonio_total
            ),

            # --------------------------------------------------------------
            # Custos
            # --------------------------------------------------------------

            "custo_fixo_total": (
                custo_fixo_total
            ),

            "custo_variavel_total": (
                custo_variavel_total
            ),

            "custo_fixo_geral_empresa": (
                custo_fixo_total
            )
        }

    except Exception as erro:

        logger.exception(
            "❌ Erro crítico no Motor Financeiro TERADMAS"
        )

        try:
            conexao.rollback()
        except Exception:
            pass

        return {

            "status": "erro",

            "nome_empresa": "MODO SEGURANÇA",

            "capital_total": 0.0,

            "receitas_total": 0.0,

            "despesas_total": 0.0,

            "saldo_fluxo_caixa": 0.0,

            "capital_disponivel_total": 0.0,

            "capital_disponivel_departamento": 0.0,

            "patrimonio_ativo_total": 0.0,

            "custo_fixo_total": 0.0,

            "custo_variavel_total": 0.0,

            "custo_fixo_geral_empresa": 0.0,

            "quotas": [],

            "erro": str(erro)
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


# ==========================================================================
# FUNÇÃO AUXILIAR PARA OBTER SOMENTE AS QUOTAS
# ==========================================================================

def obter_quotas_equipe(id_equipe):
    """
    API interna para módulos financeiros/didáticos que precisem
    consultar somente a matriz de quotas.
    """

    conexao = obter_conexao_master()

    if not conexao:
        return []

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        resultado = _ler_quotas_departamentos(
            cursor,
            id_equipe
        )

        return resultado["registros"]

    except Exception as erro:

        logger.error(
            f"❌ Erro ao obter quotas da equipe: {erro}"
        )

        return []

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


# ==========================================================================
# FECHAMENTO CONTROLADO DO POOL
# ==========================================================================

def fechar_pool_conexoes():
    """
    Deve ser utilizado somente no encerramento controlado da aplicação.
    """

    global _connection_pool

    if _connection_pool is not None:

        try:
            _connection_pool.closeall()

            logger.info(
                "🔒 Pool central PostgreSQL encerrado."
            )

        except Exception as erro:

            logger.warning(
                f"⚠️ Erro ao encerrar pool: {erro}"
            )

        finally:

            _connection_pool = None
