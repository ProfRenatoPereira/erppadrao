# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO DE CONFIGURAÇÃO / INICIALIZAÇÃO
# ARQUIVO: configuracao/app_configuracao.py
#
# CORREÇÕES:
# - Usa a mesma DATABASE_URL do app_master
# - Garante criação/atualização das tabelas necessárias
# - Corrige leitura quando config_simulacao já existe
# - Evita variável "config" não inicializada
# - Valida id_equipe
# - Persiste corretamente capital_total por equipe
# - Inicializa orçamento setorial
# - Inicializa fluxo_caixa
# - Mantém sessão sincronizada após a fundação
# ==========================================================================

import os
import logging
from decimal import Decimal, InvalidOperation

import psycopg2
from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    redirect
)

# --------------------------------------------------------------------------
# LOG
# --------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# BLUEPRINT
# --------------------------------------------------------------------------

configuracao_blueprint = Blueprint(
    'configuracao_blueprint',
    __name__
)


# ==========================================================================
# CONEXÃO CENTRAL
# ==========================================================================

def obtener_conexao_master():
    """
    Utiliza exatamente a mesma DATABASE_URL configurada no ambiente
    do app_master.
    """

    try:
        database_url = os.environ.get("DATABASE_URL")

        if not database_url:
            logger.error(
                "❌ DATABASE_URL não está configurada no ambiente."
            )
            return None

        conexao = psycopg2.connect(database_url)

        return conexao

    except psycopg2.Error as erro:
        logger.error(
            f"❌ Erro ao conectar ao PostgreSQL/Supabase: {erro}"
        )
        return None


# ==========================================================================
# GARANTIA DA ESTRUTURA DO BANCO
# ==========================================================================

def garantir_estrutura_configuracao(cursor):
    """
    Cria as tabelas utilizadas pela inicialização.

    Também adiciona colunas ausentes em instalações antigas.
    Isso evita que uma tabela antiga provoque erro silencioso.
    """

    # ----------------------------------------------------------------------
    # CONFIGURAÇÃO PRINCIPAL DA EMPRESA
    # ----------------------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS config_simulacao (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT UNIQUE NOT NULL,
            nome_empresa TEXT NOT NULL DEFAULT 'GRUPO ACADÊMICO',
            capital_total NUMERIC(18,2) NOT NULL DEFAULT 0,
            valor_aluguel NUMERIC(18,2) NOT NULL DEFAULT 0
        )
    """)

    # ----------------------------------------------------------------------
    # MIGRAÇÃO DE INSTALAÇÕES ANTIGAS
    # ----------------------------------------------------------------------

    cursor.execute("""
        ALTER TABLE config_simulacao
        ADD COLUMN IF NOT EXISTS nome_empresa TEXT
    """)

    cursor.execute("""
        ALTER TABLE config_simulacao
        ADD COLUMN IF NOT EXISTS capital_total NUMERIC(18,2)
    """)

    cursor.execute("""
        ALTER TABLE config_simulacao
        ADD COLUMN IF NOT EXISTS valor_aluguel NUMERIC(18,2)
    """)

    # Corrige registros antigos que tenham NULL.
    cursor.execute("""
        UPDATE config_simulacao
        SET nome_empresa = 'GRUPO ACADÊMICO'
        WHERE nome_empresa IS NULL
    """)

    cursor.execute("""
        UPDATE config_simulacao
        SET capital_total = 0
        WHERE capital_total IS NULL
    """)

    cursor.execute("""
        UPDATE config_simulacao
        SET valor_aluguel = 0
        WHERE valor_aluguel IS NULL
    """)

    # ----------------------------------------------------------------------
    # ORÇAMENTO DOS DEPARTAMENTOS
    # ----------------------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS departamentos_orcamento (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento TEXT NOT NULL,
            orcamento_liberado NUMERIC(18,2) NOT NULL DEFAULT 0,
            UNIQUE(equipe_id, departamento)
        )
    """)

    # ----------------------------------------------------------------------
    # FLUXO DE CAIXA
    # ----------------------------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fluxo_caixa (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento TEXT,
            descricao TEXT,
            valor NUMERIC(18,2) NOT NULL DEFAULT 0,
            tipo TEXT
        )
    """)


# ==========================================================================
# ROTA HTML
# ==========================================================================

@configuracao_blueprint.route(
    '/configuracao/inicializacao',
    methods=['GET']
)
def rota_inicializacao_html():

    # ----------------------------------------------------------------------
    # AUTENTICAÇÃO
    # ----------------------------------------------------------------------

    if not session.get('logado'):
        return redirect('/login')

    # ----------------------------------------------------------------------
    # LOCALIZAÇÃO DO HTML
    # ----------------------------------------------------------------------

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_html = os.path.join(
        diretorio_atual,
        'inicializacao.html'
    )

    try:

        with open(
            caminho_html,
            'r',
            encoding='utf-8'
        ) as arquivo:

            html = arquivo.read()

        return render_template_string(html)

    except FileNotFoundError:

        logger.error(
            "❌ inicializacao.html não encontrado."
        )

        return (
            "Erro Crítico: Arquivo "
            "'inicializacao.html' não encontrado no servidor.",
            404
        )

    except Exception as erro:

        logger.exception(
            "❌ Erro ao carregar inicializacao.html."
        )

        return (
            f"Erro ao carregar a tela de inicialização: {erro}",
            500
        )


# ==========================================================================
# ROTA JAVASCRIPT
# ==========================================================================

@configuracao_blueprint.route(
    '/configuracao/inicializacao.js',
    methods=['GET']
)
def rota_inicializacao_js():

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_js = os.path.join(
        diretorio_atual,
        'inicializacao.js'
    )

    try:

        with open(
            caminho_js,
            'r',
            encoding='utf-8'
        ) as arquivo:

            js_conteudo = arquivo.read()

        return (
            js_conteudo,
            200,
            {
                'Content-Type':
                'application/javascript; charset=utf-8'
            }
        )

    except FileNotFoundError:

        logger.error(
            "❌ inicializacao.js não encontrado."
        )

        return (
            "console.error("
            "'Erro Crítico: inicializacao.js não encontrado.'"
            ");",
            404,
            {
                'Content-Type':
                'application/javascript; charset=utf-8'
            }
        )

    except Exception as erro:

        logger.exception(
            "❌ Erro ao carregar inicializacao.js."
        )

        return (
            f"console.error({repr(str(erro))});",
            500,
            {
                'Content-Type':
                'application/javascript; charset=utf-8'
            }
        )


# ==========================================================================
# API - INICIALIZAÇÃO DA EMPRESA
# ==========================================================================

@configuracao_blueprint.route(
    '/api/configuracao/inicializar',
    methods=['POST']
)
def api_inicializar_empresa():

    # ----------------------------------------------------------------------
    # 1. AUTENTICAÇÃO
    # ----------------------------------------------------------------------

    if not session.get('logado'):

        return jsonify({
            'status': 'erro',
            'message':
                'Não autenticado. Efetue o login novamente.'
        }), 401

    # ----------------------------------------------------------------------
    # 2. IDENTIFICAÇÃO DA EQUIPE
    # ----------------------------------------------------------------------

    id_equipe = session.get('id_equipe')

    if not id_equipe:

        logger.error(
            "❌ Tentativa de inicialização sem id_equipe na sessão."
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Identificação da equipe não encontrada na sessão.'
        }), 400

    id_equipe = str(id_equipe).strip()

    if not id_equipe:

        return jsonify({
            'status': 'erro',
            'message':
                'ID da equipe inválido.'
        }), 400

    # ----------------------------------------------------------------------
    # 3. LEITURA DO JSON
    # ----------------------------------------------------------------------

    try:
        dados = request.get_json(silent=True)
    except Exception:
        dados = None

    if not isinstance(dados, dict):

        return jsonify({
            'status': 'erro',
            'message':
                'Dados de requisição ausentes ou inválidos.'
        }), 400

    # ----------------------------------------------------------------------
    # 4. NOME DA EMPRESA
    # ----------------------------------------------------------------------

    nome_empresa = str(
        dados.get('nome_empresa', '')
    ).strip()

    if not nome_empresa:

        return jsonify({
            'status': 'erro',
            'message':
                'O nome da empresa simulada não pode ficar em branco.'
        }), 400

    if len(nome_empresa) > 200:

        return jsonify({
            'status': 'erro',
            'message':
                'O nome da empresa possui mais de 200 caracteres.'
        }), 400

    # ----------------------------------------------------------------------
    # 5. CAPITAL INICIAL
    # ----------------------------------------------------------------------

    capital_recebido = dados.get(
        'capital_total',
        0
    )

    try:

        # Aceita:
        # 500000
        # 500000.00
        # "500000.00"
        # "500000,00"

        capital_texto = str(
            capital_recebido
        ).strip().replace(',', '.')

        capital_total = Decimal(
            capital_texto
        )

    except (
        InvalidOperation,
        ValueError,
        TypeError
    ):

        return jsonify({
            'status': 'erro',
            'message':
                'Formato de Capital Inicial inválido.'
        }), 400

    # ----------------------------------------------------------------------
    # 6. VALIDAÇÃO DO CAPITAL
    # ----------------------------------------------------------------------

    if capital_total <= Decimal('0'):

        return jsonify({
            'status': 'erro',
            'message':
                'O capital total integralizado deve ser maior que zero.'
        }), 400

    # O HTML utiliza min="10000".
    if capital_total < Decimal('10000'):

        return jsonify({
            'status': 'erro',
            'message':
                'O capital social mínimo para iniciar a empresa é de R$ 10.000,00.'
        }), 400

    # Evita valores absurdamente grandes.
    if capital_total > Decimal('9999999999999999.99'):

        return jsonify({
            'status': 'erro',
            'message':
                'O capital informado excede o limite permitido.'
        }), 400

    # Padronização monetária.
    capital_total = capital_total.quantize(
        Decimal('0.01')
    )

    # ----------------------------------------------------------------------
    # 7. ABERTURA DA CONEXÃO
    # ----------------------------------------------------------------------

    conexao = obtener_conexao_master()

    if not conexao:

        return jsonify({
            'status': 'erro',
            'message':
                'Não foi possível conectar ao banco de dados.'
        }), 500

    cursor = None

    try:

        cursor = conexao.cursor()

        # ------------------------------------------------------------------
        # 8. GARANTE A ESTRUTURA DO BANCO
        # ------------------------------------------------------------------

        garantir_estrutura_configuracao(
            cursor
        )

        # ------------------------------------------------------------------
        # 9. GRAVA CONFIGURAÇÃO DA EMPRESA
        # ------------------------------------------------------------------
        #
        # IMPORTANTE:
        # O conflito é resolvido pelo equipe_id.
        # Assim cada equipe possui sua própria empresa/capital.
        # ------------------------------------------------------------------

        cursor.execute(
            """
            INSERT INTO config_simulacao (
                equipe_id,
                nome_empresa,
                capital_total,
                valor_aluguel
            )
            VALUES (
                %s,
                %s,
                %s,
                %s
            )
            ON CONFLICT (equipe_id)
            DO UPDATE SET
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total
            RETURNING
                id,
                equipe_id,
                nome_empresa,
                capital_total,
                valor_aluguel
            """,
            (
                id_equipe,
                nome_empresa,
                capital_total,
                Decimal('0')
            )
        )

        configuracao_gravada = cursor.fetchone()

        if not configuracao_gravada:

            raise RuntimeError(
                'O banco não confirmou a gravação da configuração.'
            )

        # ------------------------------------------------------------------
        # 10. DISTRIBUIÇÃO DO CAPITAL
        # ------------------------------------------------------------------
        #
        # 40% Máquinas
        # 30% RH
        # 30% Materiais
        #
        # Total = 100%
        # ------------------------------------------------------------------

        valor_maquinas = (
            capital_total * Decimal('0.40')
        ).quantize(Decimal('0.01'))

        valor_rh = (
            capital_total * Decimal('0.30')
        ).quantize(Decimal('0.01'))

        # O terceiro valor recebe a diferença para evitar
        # qualquer problema de arredondamento.
        valor_materiais = (
            capital_total
            - valor_maquinas
            - valor_rh
        ).quantize(Decimal('0.01'))

        orcamentos = [

            (
                id_equipe,
                'maquinas',
                valor_maquinas
            ),

            (
                id_equipe,
                'rh',
                valor_rh
            ),

            (
                id_equipe,
                'materiais',
                valor_materiais
            )
        ]

        cursor.executemany(
            """
            INSERT INTO departamentos_orcamento (
                equipe_id,
                departamento,
                orcamento_liberado
            )
            VALUES (
                %s,
                %s,
                %s
            )
            ON CONFLICT (
                equipe_id,
                departamento
            )
            DO UPDATE SET
                orcamento_liberado =
                    EXCLUDED.orcamento_liberado
            """,
            orcamentos
        )

        # ------------------------------------------------------------------
        # 11. GARANTE O FLUXO DE CAIXA
        # ------------------------------------------------------------------

        # A tabela já foi criada em garantir_estrutura_configuracao.
        #
        # Não inserimos o capital novamente no fluxo_caixa.
        #
        # Isso é importante para não ocorrer:
        #
        # CAPITAL + CAPITAL
        #
        # no cálculo do saldo disponível.
        # ------------------------------------------------------------------

        # ------------------------------------------------------------------
        # 12. CONFIRMA TODA A TRANSAÇÃO
        # ------------------------------------------------------------------

        conexao.commit()

        # ------------------------------------------------------------------
        # 13. ATUALIZA A SESSÃO
        # ------------------------------------------------------------------

        session['nome_empresa'] = (
            nome_empresa.upper()
        )

        session['capital_inicial'] = float(
            capital_total
        )

        session['empresa_inicializada'] = True

        session['id_equipe'] = id_equipe

        # Garante persistência da alteração da sessão.
        session.modified = True

        logger.info(
            "✅ Empresa inicializada: "
            f"equipe={id_equipe} | "
            f"nome={nome_empresa} | "
            f"capital={capital_total}"
        )

        # ------------------------------------------------------------------
        # 14. RESPOSTA PARA O JAVASCRIPT
        # ------------------------------------------------------------------

        return jsonify({
            'status': 'sucesso',
            'message':
                'Empresa inicializada com sucesso.',
            'dados': {
                'equipe_id': id_equipe,
                'nome_empresa':
                    nome_empresa.upper(),
                'capital_total':
                    float(capital_total),
                'orcamentos': {
                    'maquinas':
                        float(valor_maquinas),
                    'rh':
                        float(valor_rh),
                    'materiais':
                        float(valor_materiais)
                }
            }
        }), 200

    # ----------------------------------------------------------------------
    # ERRO DE BANCO
    # ----------------------------------------------------------------------

    except psycopg2.Error as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "❌ Erro PostgreSQL durante inicialização."
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Falha interna ao persistir os dados no banco de dados.'
        }), 500

    # ----------------------------------------------------------------------
    # ERRO DE APLICAÇÃO
    # ----------------------------------------------------------------------

    except Exception as erro:

        if conexao:
            conexao.rollback()

        logger.exception(
            "❌ Erro crítico durante inicialização."
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Erro interno ao inicializar a empresa.'
        }), 500

    # ----------------------------------------------------------------------
    # FECHAMENTO
    # ----------------------------------------------------------------------

    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            try:
                conexao.close()
            except Exception:
                pass
