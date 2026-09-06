# ==========================================================================
# TERADMAS ERP v2.6
# ARQUIVO: configuracao/app_configuracao.py
#
# RESPONSABILIDADE:
# - Constituição da empresa/equipe
# - Registro do capital inicial
#
# NÃO RESPONSABILIDADE:
# - Distribuição de quotas
# - Criação de departamentos
# - Definição automática de percentuais
#
# Fluxo:
# Constituição → Financeiro → Quotas → Setores
# ==========================================================================

import os

from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    redirect
)

import psycopg2

import GerenciadorCaixa


configuracao_blueprint = Blueprint(
    'configuracao_blueprint',
    __name__
)


# ==========================================================================
# ROTA HTML
# ==========================================================================

@configuracao_blueprint.route(
    '/configuracao/inicializacao',
    methods=['GET']
)
def rota_inicializacao_html():

    if not session.get('logado'):
        return redirect('/login')

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
        ) as f:

            html = f.read()

        return render_template_string(html)

    except FileNotFoundError:

        return (
            "Erro Crítico: Arquivo "
            "'inicializacao.html' não encontrado "
            "no servidor.",
            404
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
        ) as f:

            js_conteudo = f.read()

        return (
            js_conteudo,
            200,
            {
                'Content-Type':
                    'application/javascript'
            }
        )

    except FileNotFoundError:

        return (
            "console.error("
            "'Erro Crítico: Arquivo "
            "inicializacao.js não encontrado.'"
            ");",
            404
        )


# ==========================================================================
# API DE CONSTITUIÇÃO DA EMPRESA
# ==========================================================================

@configuracao_blueprint.route(
    '/api/configuracao/inicializar',
    methods=['POST']
)
def api_inicializar_empresa():

    # ----------------------------------------------------------------------
    # AUTENTICAÇÃO
    # ----------------------------------------------------------------------

    if not session.get('logado'):

        return jsonify({
            'status': 'erro',
            'message':
                'Não autenticado. '
                'Efetue o login novamente.'
        }), 401

    dados = request.get_json(
        silent=True
    )

    if not dados:

        return jsonify({
            'status': 'erro',
            'message':
                'Dados de requisição ausentes.'
        }), 400

    # ----------------------------------------------------------------------
    # TENANT
    # ----------------------------------------------------------------------

    id_equipe = session.get(
        'id_equipe',
        'equipe_alfa'
    )

    # ----------------------------------------------------------------------
    # NOME
    # ----------------------------------------------------------------------

    nome_empresa = str(
        dados.get('nome_empresa', '')
    ).strip()

    if not nome_empresa:

        return jsonify({
            'status': 'erro',
            'message':
                'O nome da empresa simulada '
                'não pode ficar em branco.'
        }), 400

    # ----------------------------------------------------------------------
    # CAPITAL
    # ----------------------------------------------------------------------

    try:

        capital_total = float(
            str(
                dados.get(
                    'capital_total',
                    0
                )
            )
            .replace(',', '.')
            .strip()
        )

    except (ValueError, TypeError):

        return jsonify({
            'status': 'erro',
            'message':
                'Formato de Capital Inicial inválido.'
        }), 400

    if capital_total <= 0:

        return jsonify({
            'status': 'erro',
            'message':
                'O capital total integralizado '
                'deve ser maior que zero.'
        }), 400

    # ----------------------------------------------------------------------
    # CONEXÃO PELO GERENCIADOR CENTRAL
    # ----------------------------------------------------------------------

    conexao = None
    cursor = None

    try:

        conexao = (
            GerenciadorCaixa
            .obter_conexao_master()
        )

        if not conexao:

            return jsonify({
                'status': 'erro',
                'message':
                    'Não foi possível obter conexão '
                    'com o banco de dados.'
            }), 500

        cursor = conexao.cursor()

        # ------------------------------------------------------------------
        # CONFIGURAÇÃO DA SIMULAÇÃO
        #
        # A tabela continua sendo a fonte da constituição.
        # ------------------------------------------------------------------

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config_simulacao (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT UNIQUE,
                nome_empresa TEXT,
                capital_total NUMERIC(18,2),
                valor_aluguel NUMERIC(18,2) DEFAULT 0
            )
        """)

        cursor.execute("""
            INSERT INTO config_simulacao (
                equipe_id,
                nome_empresa,
                capital_total
            )
            VALUES (%s, %s, %s)
            ON CONFLICT (equipe_id)
            DO UPDATE SET
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total
        """, (
            id_equipe,
            nome_empresa,
            capital_total
        ))

        # ------------------------------------------------------------------
        # IMPORTANTE:
        #
        # NÃO criar departamentos_orcamento.
        # NÃO gerar 40/30/30.
        # NÃO inserir quotas aqui.
        #
        # O Financeiro será responsável pela alocação.
        # ------------------------------------------------------------------

        conexao.commit()

        # ------------------------------------------------------------------
        # SESSÃO
        # ------------------------------------------------------------------

        session['nome_empresa'] = (
            nome_empresa.upper()
        )

        session['capital_inicial'] = (
            capital_total
        )

        session['empresa_inicializada'] = True

        # Marca que a etapa de quotas ainda deverá
        # ser tratada pelo Financeiro.
        session['quotas_configuradas'] = False

        return jsonify({
            'status': 'sucesso',
            'message':
                'Empresa constituída. '
                'Encaminhando para o Financeiro.'
        })

    except psycopg2.DatabaseError as e:

        if conexao:
            conexao.rollback()

        print(
            "Erro crítico no banco de dados "
            f"Supabase: {e}"
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Falha interna ao persistir '
                'dados no banco de dados.'
        }), 500

    except Exception as e:

        if conexao:
            conexao.rollback()

        print(
            "Erro inesperado na inicialização: "
            f"{e}"
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Falha inesperada durante '
                'a inicialização.'
        }), 500

    finally:

        if cursor:
            cursor.close()

        # --------------------------------------------------------------
        # DEVOLVE AO POOL.
        #
        # Não usar conexao.close() aqui.
        # --------------------------------------------------------------

        if conexao:
            GerenciadorCaixa.liberar_conexao_master(
                conexao
            )
