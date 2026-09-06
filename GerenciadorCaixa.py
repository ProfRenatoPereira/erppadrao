# ==========================================================================
# TERADMAS ERP v2.6
# MOTOR FINANCEIRO CENTRAL - GerenciadorCaixa.py
#
# CORREÇÕES PRINCIPAIS:
# - Capital inicial vem de configuracao_equipes.capital_inicial
# - config_simulacao funciona como fonte complementar
# - Não utiliza mais capital fictício de R$ 5.000.000
# - Não utiliza mais custo fixo fictício de R$ 21.350
# - Corrige variável config não inicializada
# - Mantém isolamento por equipe
# - Mantém orçamento por departamento
# - Evita duplicação do capital no fluxo_caixa
# - Compatível com PostgreSQL / Supabase
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
# POOL DE CONEXÕES
# ==========================================================================

_connection_pool = None


def obter_pool_conexoes():
    """
    Cria e reutiliza um pool PostgreSQL.

    A conexão utiliza DATABASE_URL do ambiente.
    """

    global _connection_pool

    if _connection_pool is not None:
        return _connection_pool

    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        logger.error(
            "❌ DATABASE_URL não está configurada."
        )
        return None

    try:

        _connection_pool = SimpleConnectionPool(
            1,
            5,
            database_url
        )

        logger.info(
            "✅ Pool PostgreSQL criado com sucesso."
        )

        return _connection_pool

    except psycopg2.Error as erro:

        logger.error(
            f"❌ Erro ao criar pool PostgreSQL: {erro}"
        )

        _connection_pool = None

        return None


# ==========================================================================
# OBTÉM CONEXÃO
# ==========================================================================

def obter_conexao_master():
    """
    Obtém uma conexão do pool.
    """

    try:

        pool = obter_pool_conexoes()

        if not pool:
            return None

        return pool.getconn()

    except psycopg2.Error as erro:

        logger.error(
            f"❌ Erro ao obter conexão PostgreSQL: {erro}"
        )

        return None


# ==========================================================================
# DEVOLVE CONEXÃO AO POOL
# ==========================================================================

def liberar_conexao_master(conexao):
    """
    Devolve a conexão ao pool.
    """

    if not conexao:
        return

    try:

        pool = obter_pool_conexoes()

        if pool:

            pool.putconn(
                conexao,
                close=False
            )

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
# CONVERSÃO SEGURA DE VALORES
# ==========================================================================

def valor_float(valor, padrao=0.0):
    """
    Converte Decimal, int, float ou string para float.
    """

    if valor is None:
        return float(padrao)

    try:
        return float(valor)

    except (ValueError, TypeError):
        return float(padrao)


# ==========================================================================
# BUSCA CONFIGURAÇÃO DA EQUIPE
# ==========================================================================

def obter_configuracao_equipe(cursor, id_equipe):
    """
    Obtém a configuração financeira da equipe.

    PRIORIDADE:

    1. configuracao_equipes.capital_inicial
    2. config_simulacao.capital_total

    Isso é importante porque o Supabase atual do TERADMAS
    possui o capital em:

        configuracao_equipes
            equipe_id
            capital_inicial

    """

    configuracao = {
        "capital_total": 0.0,
        "nome_empresa": "GRUPO ACADÊMICO",
        "valor_aluguel": 0.0,
        "origem_capital": None
    }

    # ----------------------------------------------------------------------
    # 1. FONTE PRINCIPAL:
    #    configuracao_equipes.capital_inicial
    # ----------------------------------------------------------------------

    try:

        cursor.execute(
            """
            SELECT
                equipe_id,
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

                configuracao["capital_total"] = (
                    valor_float(capital)
                )

                configuracao["origem_capital"] = (
                    "configuracao_equipes"
                )

                logger.info(
                    "💰 Capital encontrado em "
                    f"configuracao_equipes: "
                    f"equipe={id_equipe} "
                    f"capital={configuracao['capital_total']:.2f}"
                )

    except psycopg2.Error as erro:

        logger.warning(
            "⚠️ Não foi possível consultar "
            f"configuracao_equipes: {erro}"
        )

        try:
            cursor.connection.rollback()
        except Exception:
            pass

    # ----------------------------------------------------------------------
    # 2. FONTE COMPLEMENTAR:
    #    config_simulacao
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

        registro_simulacao = cursor.fetchone()

        if registro_simulacao:

            nome_empresa = registro_simulacao.get(
                "nome_empresa"
            )

            if nome_empresa:
                configuracao["nome_empresa"] = str(
                    nome_empresa
                ).strip()

            configuracao["valor_aluguel"] = valor_float(
                registro_simulacao.get(
                    "valor_aluguel"
                )
            )

            # Somente usa config_simulacao se
            # configuracao_equipes não possuir capital.
            if configuracao["capital_total"] <= 0:

                capital_simulacao = (
                    registro_simulacao.get(
                        "capital_total"
                    )
                )

                if capital_simulacao is not None:

                    configuracao["capital_total"] = (
                        valor_float(
                            capital_simulacao
                        )
                    )

                    configuracao["origem_capital"] = (
                        "config_simulacao"
                    )

                    logger.info(
                        "💰 Capital encontrado em "
                        f"config_simulacao: "
                        f"equipe={id_equipe} "
                        f"capital={configuracao['capital_total']:.2f}"
                    )

    except psycopg2.Error as erro:

        logger.warning(
            "⚠️ Não foi possível consultar "
            f"config_simulacao: {erro}"
        )

        try:
            cursor.connection.rollback()
        except Exception:
            pass

    return configuracao


# ==========================================================================
# MÉTRICAS FINANCEIRAS PRINCIPAIS
# ==========================================================================

def calcular_metricas_totais_equipe(
    id_equipe,
    departamento_atual=None
):
    """
    Calcula as métricas financeiras consolidadas da equipe.

    Retorna:

    - capital_total
    - capital_disponivel_total
    - capital_disponivel_departamento
    - patrimônio
    - custos fixos
    - custos variáveis
    - métricas isoladas do departamento
    """

    if not id_equipe:

        logger.error(
            "❌ calcular_metricas_totais_equipe recebeu "
            "id_equipe vazio."
        )

        return {
            "status": "erro",
            "nome_empresa": "EQUIPE NÃO IDENTIFICADA",
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

    id_equipe = str(id_equipe).strip()

    conexao = obter_conexao_master()

    if not conexao:

        return {
            "status": "erro",
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
            "erro": "Conexão com banco de dados indisponível"
        }

    cursor = None

    try:

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # ==================================================================
        # 1. CONFIGURAÇÃO DA EMPRESA
        # ==================================================================

        configuracao = obter_configuracao_equipe(
            cursor,
            id_equipe
        )

        capital_total = valor_float(
            configuracao.get(
                "capital_total"
            )
        )

        nome_empresa = (
            configuracao.get(
                "nome_empresa"
            )
            or "GRUPO ACADÊMICO"
        )

        valor_aluguel_global = valor_float(
            configuracao.get(
                "valor_aluguel"
            )
        )

        # ==================================================================
        # 2. FLUXO DE CAIXA
        # ==================================================================

        total_movimentacoes_fluxo = 0.0

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
                """,
                (id_equipe,)
            )

            resultado_fluxo = cursor.fetchone()

            if resultado_fluxo:

                total_movimentacoes_fluxo = valor_float(
                    resultado_fluxo.get(
                        "total"
                    )
                )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro ao consultar fluxo_caixa: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 3. ACUMULADORES
        # ==================================================================

        patrimonio_ativo_total = 0.0

        custo_fixo_total_global = 0.0

        custo_variavel_total_global = 0.0

        patrimonio_isolado_setor = 0.0

        custo_fixo_isolado_setor = 0.0

        custo_variavel_isolado_setor = 0.0

        # ==================================================================
        # 4. IMÓVEIS
        # ==================================================================

        imob_aluguel_setor = 0.0

        imob_condo_setor = 0.0

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
                    ) AS condo

                FROM imoveis_simulacao

                WHERE equipe_id = %s
                """,
                (id_equipe,)
            )

            res_imob = cursor.fetchone()

            if res_imob:

                imob_aluguel_setor = valor_float(
                    res_imob.get(
                        "aluguel"
                    )
                )

                imob_condo_setor = valor_float(
                    res_imob.get(
                        "condo"
                    )
                )

                # O imóvel entra como ativo conforme
                # a lógica existente do ERP.
                patrimonio_ativo_total += (
                    imob_aluguel_setor
                )

                if departamento_atual == "estrutura":

                    patrimonio_isolado_setor += (
                        imob_aluguel_setor
                    )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em imoveis_simulacao: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 5. MÁQUINAS
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
                  AND UPPER(departamento) = 'PRODUCAO'
                """,
                (id_equipe,)
            )

            total_producao = valor_float(
                cursor.fetchone().get(
                    "total"
                )
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

            total_estrutura = valor_float(
                cursor.fetchone().get(
                    "total"
                )
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

            total_utensilios = valor_float(
                cursor.fetchone().get(
                    "total"
                )
            )

            patrimonio_ativo_total += (
                total_producao
                + total_estrutura
                + total_utensilios
            )

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

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em erp_maquinas: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 6. MATERIAIS / ALMOXARIFADO
        # ==================================================================

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

            res_mat = cursor.fetchone()

            if res_mat:

                total_materiais = valor_float(
                    res_mat.get(
                        "total"
                    )
                )

                patrimonio_ativo_total += (
                    total_materiais
                )

                if departamento_atual == "materiais":

                    patrimonio_isolado_setor += (
                        total_materiais
                    )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em ativos_materials: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 7. CUSTOS FIXOS - IMÓVEL
        # ==================================================================

        custo_fixo_total_global += (
            imob_aluguel_setor
            + imob_condo_setor
        )

        if departamento_atual == "estrutura":

            custo_fixo_isolado_setor += (
                imob_aluguel_setor
                + imob_condo_setor
            )

        # ==================================================================
        # 8. FOLHA CLT
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

            res_rh_global = cursor.fetchone()

            if res_rh_global:

                custo_fixo_total_global += (
                    valor_float(
                        res_rh_global.get(
                            "total"
                        )
                    )
                )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em folha_funcionarios: {erro}"
            )

            try:
                conexao.rollback()
            except Exception:
                pass

        # ==================================================================
        # 9. ESTRUTURA RH
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

            res_rh_imob = cursor.fetchone()

            if res_rh_imob:

                rh_setor_valor = valor_float(
                    res_rh_imob.get(
                        "total"
                    )
                )

                custo_fixo_total_global += (
                    rh_setor_valor
                )

                if departamento_atual == "estrutura":

                    custo_fixo_isolado_setor += (
                        rh_setor_valor
                    )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em estrutura_rh: {erro}"
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

            res_folha_var = cursor.fetchone()

            if res_folha_var:

                valor_variavel_folha = valor_float(
                    res_folha_var.get(
                        "total"
                    )
                )

                custo_variavel_total_global += (
                    valor_variavel_folha
                )

                if departamento_atual in (
                    "rh",
                    "folha_pagamento"
                ):

                    custo_variavel_isolado_setor += (
                        valor_variavel_folha
                    )

        except psycopg2.Error as erro:

            logger.warning(
                f"⚠️ Erro em livro_razonete_folha: {erro}"
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
                        COALESCE(
                            orcamento_liberado,
                            0
                        ) AS orcamento

                    FROM departamentos_orcamento

                    WHERE equipe_id = %s
                      AND LOWER(departamento) =
                          LOWER(%s)

                    LIMIT 1
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                dept_orc = cursor.fetchone()

                if dept_orc:

                    orcamento_liberado_setor = (
                        valor_float(
                            dept_orc.get(
                                "orcamento"
                            )
                        )
                    )

            except psycopg2.Error as erro:

                logger.warning(
                    "⚠️ Erro em "
                    f"departamentos_orcamento: {erro}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

            # --------------------------------------------------------------
            # GASTOS DO SETOR
            # --------------------------------------------------------------

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
                      AND LOWER(
                          COALESCE(
                              departamento,
                              ''
                          )
                      ) = LOWER(%s)
                    """,
                    (
                        id_equipe,
                        departamento_atual
                    )
                )

                res_gastos = cursor.fetchone()

                if res_gastos:

                    gastos_especificos_setor = (
                        valor_float(
                            res_gastos.get(
                                "total"
                            )
                        )
                    )

            except psycopg2.Error as erro:

                logger.warning(
                    "⚠️ Erro ao consultar gastos "
                    f"do setor: {erro}"
                )

                try:
                    conexao.rollback()
                except Exception:
                    pass

        # ==================================================================
        # 12. CAPITAL DISPONÍVEL
        # ==================================================================
        #
        # capital_total
        #     + entradas
        #     - saídas
        #
        # O fluxo_caixa deve utilizar:
        #
        #     valor positivo = entrada
        #     valor negativo = saída
        #
        # O capital inicial NÃO é inserido novamente no fluxo_caixa.
        #
        # Portanto não ocorre duplicação do capital.
        # ==================================================================

        capital_disponivel_total = (
            capital_total
            + total_movimentacoes_fluxo
        )

        # Se houver aluguel global explicitamente
        # configurado em config_simulacao e ele ainda
        # não tiver sido registrado no fluxo, mantém
        # a compatibilidade com a regra anterior.
        #
        # Porém, não descontamos automaticamente o valor
        # do imóvel aqui se ele já estiver registrado no
        # fluxo_caixa, evitando duplicidade.
        #
        # A partir desta versão o fluxo_caixa é a fonte
        # efetiva das movimentações.
        #
        # Portanto:
        # capital disponível = capital + fluxo.

        capital_disponivel_departamento = (
            orcamento_liberado_setor
            + (
                -gastos_especificos_setor
                if gastos_especificos_setor > 0
                else gastos_especificos_setor
            )
        )

        # ==================================================================
        # 13. PROTEÇÃO CONTRA SALDOS NEGATIVOS NA INTERFACE
        # ==================================================================

        capital_disponivel_total = max(
            0.0,
            capital_disponivel_total
        )

        capital_disponivel_departamento = max(
            0.0,
            capital_disponivel_departamento
        )

        # ==================================================================
        # 14. RESULTADO FINAL
        # ==================================================================

        resultado = {

            "status": "sucesso",

            "nome_empresa": str(
                nome_empresa
            ).upper(),

            "capital_total": round(
                capital_total,
                2
            ),

            "capital_disponivel_total": round(
                capital_disponivel_total,
                2
            ),

            "capital_disponivel_departamento": round(
                capital_disponivel_departamento,
                2
            ),

            "patrimonio_ativo_total": round(
                patrimonio_ativo_total,
                2
            ),

            "custo_fixo_total": round(
                custo_fixo_total_global,
                2
            ),

            "custo_variavel_total": round(
                custo_variavel_total_global,
                2
            ),

            "custo_fixo_geral_empresa": round(
                custo_fixo_total_global,
                2
            ),

            "patrimonio_isolado_setor": round(
                patrimonio_isolado_setor,
                2
            ),

            "custo_fixo_isolado_setor": round(
                custo_fixo_isolado_setor,
                2
            ),

            "custo_variavel_isolado_setor": round(
                custo_variavel_isolado_setor,
                2
            ),

            # Informações auxiliares para diagnóstico.
            "equipe_id": id_equipe,

            "origem_capital": (
                configuracao.get(
                    "origem_capital"
                )
            ),

            "movimentacoes_fluxo": round(
                total_movimentacoes_fluxo,
                2
            ),

            "orcamento_departamento": round(
                orcamento_liberado_setor,
                2
            ),

            "gastos_departamento": round(
                gastos_especificos_setor,
                2
            )
        }

        logger.info(
            "📊 MÉTRICAS | "
            f"equipe={id_equipe} | "
            f"capital={capital_total:.2f} | "
            f"disponível={capital_disponivel_total:.2f} | "
            f"patrimônio={patrimonio_ativo_total:.2f} | "
            f"fixo={custo_fixo_total_global:.2f} | "
            f"variável={custo_variavel_total_global:.2f}"
        )

        return resultado

    except Exception as erro:

        logger.exception(
            "❌ Erro crítico no Motor de Métricas:"
        )

        try:

            if conexao:
                conexao.rollback()

        except Exception:
            pass

        return {

            "status": "erro",

            "nome_empresa":
                "ERRO DE PROCESSAMENTO",

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
