# ==========================================================================
# TERADMAS ERP v2.6
# GERENCIADORCAIXA.PY - MOTOR FINANCEIRO CENTRAL
# ==========================================================================
#
# RESPONSABILIDADES:
#   1. Ler o capital inicial da equipe.
#   2. Ler receitas e despesas reais do fluxo financeiro.
#   3. Calcular o CAPITAL DE GIRO.
#   4. Ler as QUOTAS reais salvas no Supabase.
#   5. Calcular a disponibilidade global e por departamento.
#   6. Consolidar patrimônio e custos dos módulos reais do ERP.
#
# REGRA CENTRAL:
#   CAPITAL DE GIRO =
#       CAPITAL INICIAL
#       + RECEITAS
#       - DESPESAS
#
# QUOTAS NÃO SÃO DESPESAS.
# Elas representam a distribuição/alocação interna do capital.
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
# POOL CENTRAL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria e mantém o pool central de conexões PostgreSQL/Supabase.

    IMPORTANTE:
    Nenhum módulo deve criar seu próprio pool.
    """

    global _connection_pool

    if _connection_pool is None:

        database_url = os.environ.get("DATABASE_URL")

        if not database_url:
            logger.error(
                "❌ DATABASE_URL não configurada no ambiente."
            )
            return None

        try:
            _connection_pool = SimpleConnectionPool(
                1,
                5,
                database_url
            )

            logger.info(
                "✅ Pool central PostgreSQL/Supabase criado."
            )

        except psycopg2.Error as erro:
            logger.error(
                f"❌ Erro ao criar pool PostgreSQL: {erro}"
            )
            return None

    return _connection_pool


def obter_conexao_master():
    """
    Retira uma conexão do pool central.

    A conexão NÃO deve ser fechada pelo módulo consumidor.
    Deve ser devolvida através de liberar_conexao_master().
    """

    pool = obter_pool_conexoes()

    if not pool:
        return None

    try:
        return pool.getconn()

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Erro ao obter conexão do pool: {erro}"
        )
        return None


def liberar_conexao_master(conexao):
    """
    Devolve a conexão ao pool central.

    Nunca utilizar conexao.close() como fluxo normal.
    """

    if not conexao:
        return

    pool = obter_pool_conexoes()

    if not pool:
        logger.warning(
            "⚠️ Pool indisponível ao devolver conexão."
        )
        return

    try:
        pool.putconn(conexao)

    except Exception as erro:
        logger.error(
            f"❌ Erro ao devolver conexão ao pool: {erro}"
        )


# ==========================================================================
# UTILITÁRIOS
# ==========================================================================

def _float(valor):
    """
    Conversão segura para valores monetários.
    """

    try:
        return float(valor or 0)
    except (ValueError, TypeError):
        return 0.0


def _tabela_existe(cursor, tabela):
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

    return bool(resultado and resultado["existe"])


# ==========================================================================
# CAPITAL INICIAL
# ==========================================================================

def obter_capital_inicial(cursor, id_equipe):
    """
    Recupera o capital inicial da equipe.

    A fonte principal é config_simulacao, criada pela inicialização.

    Não existe mais capital artificial de R$ 5 milhões ou R$ 10 milhões
    como valor operacional.
    """

    capital = 0.0
    nome_empresa = "GRUPO ACADÊMICO"

    if not _tabela_existe(cursor, "config_simulacao"):
        return capital, nome_empresa

    cursor.execute(
        """
        SELECT
            nome_empresa,
            capital_total
        FROM public.config_simulacao
        WHERE equipe_id = %s
        LIMIT 1
        """,
        (id_equipe,)
    )

    registro = cursor.fetchone()

    if registro:

        capital = _float(
            registro.get("capital_total")
        )

        nome_empresa = (
            registro.get("nome_empresa")
            or nome_empresa
        )

    return capital, nome_empresa


# ==========================================================================
# FLUXO DE CAIXA
# ==========================================================================

def obter_movimentacao_financeira(cursor, id_equipe):
    """
    Lê o fluxo real da equipe.

    REGRA:

        RECEITA  -> aumenta o caixa
        DESPESA  -> reduz o caixa

    O método não considera a simples soma de 'valor', porque isso poderia
    inverter despesas caso algum módulo grave despesas como valores positivos.

    Também suporta o cenário em que valores de despesas já estejam negativos.
    """

    receitas = 0.0
    despesas = 0.0

    if not _tabela_existe(cursor, "fluxo_caixa"):
        return receitas, despesas

    cursor.execute(
        """
        SELECT
            COALESCE(tipo, '') AS tipo,
            COALESCE(valor, 0) AS valor
        FROM public.fluxo_caixa
        WHERE equipe_id = %s
        """,
        (id_equipe,)
    )

    registros = cursor.fetchall()

    tipos_receita = {
        "receita",
        "entrada",
        "credito",
        "crédito",
        "faturamento",
        "venda"
    }

    tipos_despesa = {
        "despesa",
        "saida",
        "saída",
        "debito",
        "débito",
        "pagamento",
        "custo"
    }

    for registro in registros:

        valor = _float(
            registro.get("valor")
        )

        tipo = str(
            registro.get("tipo") or ""
        ).strip().lower()

        if tipo in tipos_receita:

            # Receita positiva aumenta o caixa.
            receitas += abs(valor)

        elif tipo in tipos_despesa:

            # Despesa positiva ou negativa representa saída.
            despesas += abs(valor)

        else:

            # Compatibilidade com registros antigos:
            # positivo = entrada
            # negativo = saída
            if valor >= 0:
                receitas += valor
            else:
                despesas += abs(valor)

    return receitas, despesas


# ==========================================================================
# QUOTAS DOS DEPARTAMENTOS
# ==========================================================================

def obter_quotas_equipe(cursor, id_equipe):
    """
    Recupera as quotas reais da equipe.

    Tabela física:
        public.quotas_departamentos

    Chave:
        UNIQUE (equipe_id, departamento_id)

    ATENÇÃO:
    Este método NÃO cria percentuais.
    Este método NÃO inventa departamentos.
    Este método apenas lê o que foi definido pelos estudantes/professor
    e salvo no Supabase.
    """

    quotas = []
    total_quotas = 0.0

    if not _tabela_existe(cursor, "quotas_departamentos"):
        return quotas, total_quotas

    cursor.execute(
        """
        SELECT *
        FROM public.quotas_departamentos
        WHERE equipe_id = %s
        ORDER BY departamento_id
        """,
        (id_equipe,)
    )

    registros = cursor.fetchall()

    for registro in registros:

        # Compatibilidade com diferentes nomes possíveis da coluna
        valor = (
            registro.get("valor_quota")
            if registro.get("valor_quota") is not None
            else registro.get("quota_valor")
        )

        if valor is None:
            valor = registro.get("valor")

        if valor is None:
            valor = registro.get("dotacao")

        valor = _float(valor)

        percentual = registro.get("percentual")

        if percentual is None:
            percentual = registro.get("percentual_quota")

        percentual = _float(percentual)

        departamento_id = registro.get(
            "departamento_id"
        )

        quota = {
            "departamento_id": departamento_id,
            "valor": valor,
            "percentual": percentual
        }

        quotas.append(quota)

        total_quotas += valor

    return quotas, total_quotas


def obter_quota_departamento(
    cursor,
    id_equipe,
    departamento_id
):
    """
    Recupera a dotação de um departamento específico.
    """

    if not _tabela_existe(
        cursor,
        "quotas_departamentos"
    ):
        return 0.0

    cursor.execute(
        """
        SELECT *
        FROM public.quotas_departamentos
        WHERE equipe_id = %s
          AND departamento_id = %s
        LIMIT 1
        """,
        (
            id_equipe,
            departamento_id
        )
    )

    registro = cursor.fetchone()

    if not registro:
        return 0.0

    valor = registro.get("valor_quota")

    if valor is None:
        valor = registro.get("quota_valor")

    if valor is None:
        valor = registro.get("valor")

    if valor is None:
        valor = registro.get("dotacao")

    return _float(valor)


# ==========================================================================
# PATRIMÔNIO - MÁQUINAS
# ==========================================================================

def obter_patrimonio_maquinas(
    cursor,
    id_equipe,
    departamento_atual=None
):
    """
    Fonte física:

        public.ativos_maquinas

    Campos contábeis:
        preco_compra
        depreciacao_mes
        valor_residual
        custo_mod_min
        jornada
        turnos
        ativo_imobilizado
        custo_minuto_maquina
    """

    total = 0.0

    if not _tabela_existe(
        cursor,
        "ativos_maquinas"
    ):
        return total

    if departamento_atual:
        cursor.execute(
            """
            SELECT
                COALESCE(
                    SUM(preco_compra),
                    0
                ) AS total
            FROM public.ativos_maquinas
            WHERE equipe_id = %s
              AND LOWER(COALESCE(departamento, ''))
                  = LOWER(%s)
            """,
            (
                id_equipe,
                departamento_atual
            )
        )
    else:
        cursor.execute(
            """
            SELECT
                COALESCE(
                    SUM(preco_compra),
                    0
                ) AS total
            FROM public.ativos_maquinas
            WHERE equipe_id = %s
            """,
            (id_equipe,)
        )

    registro = cursor.fetchone()

    if registro:
        total = _float(
            registro.get("total")
        )

    return total


# ==========================================================================
# PATRIMÔNIO - MATERIAIS
# ==========================================================================

def obter_patrimonio_materiais(
    cursor,
    id_equipe
):
    """
    Fonte física:

        public.ativos_materials
    """

    if not _tabela_existe(
        cursor,
        "ativos_materials"
    ):
        return 0.0

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

    return _float(
        registro.get("total")
        if registro
        else 0
    )


# ==========================================================================
# CUSTO IMOBILIÁRIO
# ==========================================================================

def obter_custo_imobiliario(
    cursor,
    id_equipe
):
    """
    Fonte física:

        public.contratos_imobiliarios

    Campo:
        custo_locacao
    """

    if not _tabela_existe(
        cursor,
        "contratos_imobiliarios"
    ):
        return 0.0

    cursor.execute(
        """
        SELECT
            COALESCE(
                SUM(custo_locacao),
                0
            ) AS total
        FROM public.contratos_imobiliarios
        WHERE equipe_id = %s
        """,
        (id_equipe,)
    )

    registro = cursor.fetchone()

    return _float(
        registro.get("total")
        if registro
        else 0
    )


# ==========================================================================
# CUSTO DE RH
# ==========================================================================

def obter_custo_rh(
    cursor,
    id_equipe
):
    """
    Fonte física:

        public.folha_funcionarios

    Campo financeiro definido pelo checkpoint:

        subtotal_oneroso
    """

    if not _tabela_existe(
        cursor,
        "folha_funcionarios"
    ):
        return 0.0

    cursor.execute(
        """
        SELECT
            COALESCE(
                SUM(subtotal_oneroso),
                0
            ) AS total
        FROM public.folha_funcionarios
        WHERE equipe_id = %s
        """,
        (id_equipe,)
    )

    registro = cursor.fetchone()

    return _float(
        registro.get("total")
        if registro
        else 0
    )


# ==========================================================================
# CUSTO DOS PROCESSOS
# ==========================================================================

def obter_custo_processos(
    cursor,
    id_equipe
):
    """
    Fonte:

        public.engenharia_processos

    O banco já possui trigger de cálculo automático.

    Portanto o GerenciadorCaixa NÃO recria a fórmula do trigger.
    Ele apenas lê o resultado persistido.
    """

    if not _tabela_existe(
        cursor,
        "engenharia_processos"
    ):
        return 0.0

    cursor.execute(
        """
        SELECT
            COALESCE(
                SUM(
                    COALESCE(
                        custo_direto_operacao_unidade,
                        0
                    )
                ),
                0
            ) AS total
        FROM public.engenharia_processos
        WHERE equipe_id = %s
        """,
        (id_equipe,)
    )

    registro = cursor.fetchone()

    return _float(
        registro.get("total")
        if registro
        else 0
    )


# ==========================================================================
# MOTOR CENTRAL DE MÉTRICAS
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Motor financeiro central do TERADMAS.

    Retorna simultaneamente:

        capital_total
        receitas_total
        despesas_total
        capital_giro
        total_quotas
        capital_disponivel_total
        capital_disponivel_departamento
        patrimonio_ativo_total
        custos fixos
        custos variáveis
        quotas da equipe
    """

    conexao = obter_conexao_master()

    if not conexao:

        return {
            "status": "erro",
            "erro": "Conexão com banco de dados indisponível",
            "capital_total": 0.0,
            "receitas_total": 0.0,
            "despesas_total": 0.0,
            "capital_giro": 0.0,
            "total_quotas": 0.0,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,
            "patrimonio_ativo_total": 0.0,
            "custo_fixo_geral_empresa": 0.0,
            "custo_variavel_total": 0.0,
            "quotas_departamentos": []
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==============================================================
        # 1. CAPITAL INICIAL
        # ==============================================================

        capital_total, nome_empresa = (
            obter_capital_inicial(
                cursor,
                id_equipe
            )
        )

        # ============================================================== 
        # 2. RECEITAS E DESPESAS
        # ==============================================================

        receitas_total, despesas_total = (
            obter_movimentacao_financeira(
                cursor,
                id_equipe
            )
        )

        # ============================================================== 
        # 3. CAPITAL DE GIRO
        # ==============================================================

        capital_giro = (
            capital_total
            + receitas_total
            - despesas_total
        )

        # ============================================================== 
        # 4. QUOTAS REAIS
        # ==============================================================

        quotas, total_quotas = (
            obter_quotas_equipe(
                cursor,
                id_equipe
            )
        )

        # ============================================================== 
        # 5. QUOTA DO DEPARTAMENTO
        # ==============================================================

        quota_departamento = 0.0

        if departamento_atual:

            quota_departamento = (
                obter_quota_departamento(
                    cursor,
                    id_equipe,
                    departamento_atual
                )
            )

        # ============================================================== 
        # 6. CAPITAL DISPONÍVEL GLOBAL
        # ==============================================================

        # A quota representa capital já destinado aos setores.
        #
        # Portanto:
        #
        # capital disponível =
        # capital de giro - total das dotações
        #
        # Nunca usamos quotas como despesa.

        capital_disponivel_total = (
            capital_giro
            - total_quotas
        )

        # ============================================================== 
        # 7. CAPITAL DISPONÍVEL DO DEPARTAMENTO
        # ==============================================================

        # Neste ponto a quota representa o orçamento disponível
        # para aquele departamento.
        #
        # O consumo efetivo deverá ser registrado no fluxo financeiro.
        #
        gastos_departamento = 0.0

        if departamento_atual and _tabela_existe(
            cursor,
            "fluxo_caixa"
        ):

            cursor.execute(
                """
                SELECT
                    COALESCE(tipo, '') AS tipo,
                    COALESCE(valor, 0) AS valor
                FROM public.fluxo_caixa
                WHERE equipe_id = %s
                  AND departamento = %s
                """,
                (
                    id_equipe,
                    departamento_atual
                )
            )

            movimentos_dept = cursor.fetchall()

            for movimento in movimentos_dept:

                valor = _float(
                    movimento.get("valor")
                )

                tipo = str(
                    movimento.get("tipo") or ""
                ).strip().lower()

                if tipo in {
                    "despesa",
                    "saida",
                    "saída",
                    "debito",
                    "débito",
                    "pagamento",
                    "custo"
                }:
                    gastos_departamento += abs(valor)

                elif tipo not in {
                    "receita",
                    "entrada",
                    "credito",
                    "crédito",
                    "faturamento",
                    "venda"
                } and valor < 0:

                    gastos_departamento += abs(valor)

        capital_disponivel_departamento = (
            quota_departamento
            - gastos_departamento
        )

        # ============================================================== 
        # 8. PATRIMÔNIO
        # ==============================================================

        patrimonio_maquinas = (
            obter_patrimonio_maquinas(
                cursor,
                id_equipe
            )
        )

        patrimonio_materiais = (
            obter_patrimonio_materiais(
                cursor,
                id_equipe
            )
        )

        patrimonio_ativo_total = (
            patrimonio_maquinas
            + patrimonio_materiais
        )

        # ============================================================== 
        # 9. CUSTOS FIXOS
        # ==============================================================

        custo_imobiliario = (
            obter_custo_imobiliario(
                cursor,
                id_equipe
            )
        )

        custo_rh = (
            obter_custo_rh(
                cursor,
                id_equipe
            )
        )

        custo_fixo_geral_empresa = (
            custo_imobiliario
            + custo_rh
        )

        # ============================================================== 
        # 10. CUSTO VARIÁVEL / PROCESSOS
        # ==============================================================

        custo_processos = (
            obter_custo_processos(
                cursor,
                id_equipe
            )
        )

        # ============================================================== 
        # 11. MÉTRICAS ISOLADAS
        # ==============================================================

        patrimonio_isolado_setor = 0.0
        custo_fixo_isolado_setor = 0.0
        custo_variavel_isolado_setor = 0.0

        if departamento_atual:

            departamento_normalizado = (
                str(departamento_atual)
                .strip()
                .lower()
            )

            if departamento_normalizado in {
                "maquinas",
                "produção",
                "producao"
            }:

                patrimonio_isolado_setor = (
                    obter_patrimonio_maquinas(
                        cursor,
                        id_equipe,
                        departamento_atual
                    )
                )

            elif departamento_normalizado in {
                "materiais",
                "almoxarifado"
            }:

                patrimonio_isolado_setor = (
                    patrimonio_materiais
                )

            elif departamento_normalizado in {
                "estrutura",
                "imobiliario",
                "imobiliário"
            }:

                custo_fixo_isolado_setor = (
                    custo_imobiliario
                )

            elif departamento_normalizado in {
                "rh",
                "recursos_humanos",
                "recursos humanos",
                "folha_pagamento"
            }:

                custo_fixo_isolado_setor = (
                    custo_rh
                )

            elif departamento_normalizado in {
                "processos",
                "engenharia"
            }:

                custo_variavel_isolado_setor = (
                    custo_processos
                )

        # ============================================================== 
        # 12. PROTEÇÃO CONTRA RESULTADO NEGATIVO ARTIFICIAL
        # ==============================================================

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        capital_disponivel_departamento = max(
            0.0,
            capital_disponivel_departamento
        )

        # ============================================================== 
        # 13. RESPOSTA CENTRAL
        # ==============================================================

        return {

            "status": "sucesso",

            "nome_empresa": (
                nome_empresa.upper()
                if nome_empresa
                else "GRUPO ACADÊMICO"
            ),

            # ----------------------------------------------------------
            # CAPITAL
            # ----------------------------------------------------------

            "capital_total": capital_total,

            "receitas_total": receitas_total,

            "despesas_total": despesas_total,

            "capital_giro": capital_giro,

            # ----------------------------------------------------------
            # QUOTAS
            # ----------------------------------------------------------

            "total_quotas": total_quotas,

            "quotas_departamentos": quotas,

            "quota_departamento": (
                quota_departamento
                if departamento_atual
                else 0.0
            ),

            # ----------------------------------------------------------
            # DISPONIBILIDADE
            # ----------------------------------------------------------

            "capital_disponivel_total":
                capital_disponivel_total,

            "capital_disponivel_departamento":
                capital_disponivel_departamento,

            "gastos_departamento":
                gastos_departamento,

            # ----------------------------------------------------------
            # PATRIMÔNIO
            # ----------------------------------------------------------

            "patrimonio_ativo_total":
                patrimonio_ativo_total,

            "patrimonio_isolado_setor":
                patrimonio_isolado_setor,

            # ----------------------------------------------------------
            # CUSTOS
            # ----------------------------------------------------------

            "custo_fixo_total":
                custo_fixo_geral_empresa,

            "custo_fixo_geral_empresa":
                custo_fixo_geral_empresa,

            "custo_fixo_isolado_setor":
                custo_fixo_isolado_setor,

            "custo_variavel_total":
                custo_processos,

            "custo_variavel_isolado_setor":
                custo_variavel_isolado_setor
        }

    except Exception as erro:

        logger.exception(
            "❌ Erro crítico no motor financeiro: %s",
            erro
        )

        try:
            conexao.rollback()
        except Exception:
            pass

        return {
            "status": "erro",
            "erro": str(erro),
            "capital_total": 0.0,
            "receitas_total": 0.0,
            "despesas_total": 0.0,
            "capital_giro": 0.0,
            "total_quotas": 0.0,
            "capital_disponivel_total": 0.0,
            "capital_disponivel_departamento": 0.0,
            "patrimonio_ativo_total": 0.0,
            "custo_fixo_geral_empresa": 0.0,
            "custo_variavel_total": 0.0,
            "quotas_departamentos": []
        }

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        # ==============================================================
        # DEVOLVE AO POOL
        # ==============================================================
        #
        # NÃO fazer:
        #
        #     conexao.close()
        #
        # porque esta conexão pertence ao pool central.
        #
        liberar_conexao_master(conexao)


# ==========================================================================
# FIM DO GERENCIADORCAIXA.PY
# ==========================================================================
