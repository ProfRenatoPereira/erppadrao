# ==========================================================================
# TERADMAS ERP v2.6
# ARQUIVO: configuracao/app_configuracao.py
# FUNÇÃO: Inicialização da empresa + preparação das quotas financeiras
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


configuracao_blueprint = Blueprint(
    'configuracao_blueprint',
    __name__
)


# ==========================================================================
# CONEXÃO CENTRAL
# ==========================================================================
# NÃO fechar diretamente uma conexão pertencente ao pool.
# A arquitetura definitiva utiliza GerenciadorCaixa.
# ==========================================================================

def obtener_conexao_master():
    from GerenciadorCaixa import obter_conexao_master

    return obter_conexao_master()


def liberar_conexao_master(conexao):
    from GerenciadorCaixa import liberar_conexao_master

    liberar_conexao_master(conexao)


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
        ) as arquivo:

            html = arquivo.read()

        return render_template_string(html)

    except FileNotFoundError:

        return (
            "Erro Crítico: Arquivo "
            "'inicializacao.html' não encontrado no servidor.",
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

        return (
            "console.error("
            "'Erro Crítico: arquivo inicializacao.js não encontrado.'"
            ");",
            404
        )


# ==========================================================================
# API — INICIALIZAÇÃO DA EMPRESA
# ==========================================================================
#
# FLUXO CORRETO:
#
# 1. estudante informa nome fantasia
# 2. estudante informa capital inicial
# 3. grava configuração da empresa
# 4. NÃO distribui automaticamente 40/30/30
# 5. utiliza public.quotas_departamentos
# 6. cria/atualiza as quotas da equipe
# 7. capital fica disponível para definição didática no Financeiro
# 8. redireciona para /financeiro
#
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
            'message': (
                'Não autenticado. '
                'Efetue o login novamente.'
            )
        }), 401

    dados = request.get_json(
        silent=True
    )

    if not dados:

        return jsonify({
            'status': 'erro',
            'message': 'Dados de requisição ausentes.'
        }), 400

    # ----------------------------------------------------------------------
    # TENANT
    # ----------------------------------------------------------------------

    id_equipe = session.get(
        'id_equipe',
        'equipe_alfa'
    )

    # ----------------------------------------------------------------------
    # NOME DA EMPRESA
    # ----------------------------------------------------------------------

    nome_empresa = str(
        dados.get(
            'nome_empresa',
            ''
        )
    ).strip()

    if not nome_empresa:

        return jsonify({
            'status': 'erro',
            'message': (
                'O nome fantasia da empresa '
                'não pode ficar em branco.'
            )
        }), 400

    # ----------------------------------------------------------------------
    # CAPITAL
    # ----------------------------------------------------------------------

    try:

        valor_capital = dados.get(
            'capital_total',
            0
        )

        capital_total = float(
            str(valor_capital)
            .replace(',', '.')
            .strip()
        )

    except (
        ValueError,
        TypeError
    ):

        return jsonify({
            'status': 'erro',
            'message': (
                'Formato de Capital Inicial inválido.'
            )
        }), 400

    if capital_total <= 0:

        return jsonify({
            'status': 'erro',
            'message': (
                'O capital total integralizado '
                'deve ser maior que zero.'
            )
        }), 400

    # ----------------------------------------------------------------------
    # CONEXÃO
    # ----------------------------------------------------------------------

    conexao = None
    cursor = None

    try:

        conexao = obtener_conexao_master()

        if not conexao:

            raise psycopg2.DatabaseError(
                'Não foi possível obter conexão com o banco.'
            )

        cursor = conexao.cursor()

        # ==================================================================
        # 1. CONFIGURAÇÃO DA EMPRESA
        # ==================================================================
        #
        # Mantemos config_simulacao porque o restante do ERP já utiliza
        # essa origem para recuperar capital_total e nome_empresa.
        #
        # ==================================================================

        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS public.config_simulacao (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT UNIQUE NOT NULL,
                nome_empresa TEXT NOT NULL,
                capital_total NUMERIC(18,2) NOT NULL DEFAULT 0,
                valor_aluguel NUMERIC(18,2) NOT NULL DEFAULT 0
            )
            '''
        )

        cursor.execute(
            '''
            INSERT INTO public.config_simulacao
                (
                    equipe_id,
                    nome_empresa,
                    capital_total
                )
            VALUES
                (
                    %s,
                    %s,
                    %s
                )
            ON CONFLICT (equipe_id)
            DO UPDATE SET
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total
            ''',
            (
                id_equipe,
                nome_empresa,
                capital_total
            )
        )

        # ==================================================================
        # 2. NÃO EXISTE MAIS DIVISÃO AUTOMÁTICA 40/30/30
        # ==================================================================
        #
        # A antiga lógica:
        #
        # máquinas  -> 40%
        # rh        -> 30%
        # materiais -> 30%
        #
        # foi removida.
        #
        # O orçamento deve nascer das QUOTAS DOS DEPARTAMENTOS.
        #
        # ==================================================================

        # ------------------------------------------------------------------
        # Verificação da estrutura real de quotas
        # ------------------------------------------------------------------

        cursor.execute(
            '''
            SELECT
                departamento_id,
                percentual,
                valor_quota
            FROM public.quotas_departamentos
            WHERE equipe_id = %s
            ORDER BY departamento_id
            ''',
            (id_equipe,)
        )

        quotas_existentes = cursor.fetchall()

        # ==================================================================
        # 3. PRIMEIRA INICIALIZAÇÃO DA EQUIPE
        # ==================================================================
        #
        # Se os 20 departamentos ainda não possuírem quota para a equipe,
        # criamos os registros com percentual ZERO.
        #
        # IMPORTANTE:
        # Não inventamos percentuais.
        #
        # O estudante poderá fazer a distribuição posteriormente no Financeiro.
        #
        # ==================================================================

        if not quotas_existentes:

            cursor.execute(
                '''
                SELECT
                    id,
                    nome
                FROM public.departamentos
                ORDER BY id
                '''
            )

            departamentos = cursor.fetchall()

            for departamento_id, nome_departamento in departamentos:

                cursor.execute(
                    '''
                    INSERT INTO public.quotas_departamentos
                        (
                            equipe_id,
                            departamento_id,
                            percentual,
                            valor_quota
                        )
                    VALUES
                        (
                            %s,
                            %s,
                            0,
                            0
                        )
                    ON CONFLICT
                        (
                            equipe_id,
                            departamento_id
                        )
                    DO NOTHING
                    ''',
                    (
                        id_equipe,
                        departamento_id
                    )
                )

        # ==================================================================
        # 4. GARANTE CONSISTÊNCIA DAS QUOTAS
        # ==================================================================
        #
        # O valor monetário é derivado do capital e do percentual.
        #
        # Não utilizamos uma tabela paralela
        # departamentos_orcamento.
        #
        # ==================================================================

        cursor.execute(
            '''
            UPDATE public.quotas_departamentos
            SET valor_quota =
                ROUND(
                    (
                        %s *
                        COALESCE(percentual, 0)
                        / 100
                    )::numeric,
                    2
                )
            WHERE equipe_id = %s
            ''',
            (
                capital_total,
                id_equipe
            )
        )

        # ==================================================================
        # 5. REMOVE A DEPENDÊNCIA DA ANTIGA TABELA DIDÁTICA
        # ==================================================================
        #
        # Não apagamos a tabela para não quebrar instalações antigas.
        #
        # Porém, ela deixa de ser a fonte oficial.
        #
        # Fonte oficial:
        #
        # public.quotas_departamentos
        #
        # ==================================================================

        # ==================================================================
        # 6. GARANTE O REGISTRO DE FLUXO DE CAIXA
        # ==================================================================

        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS public.fluxo_caixa (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT NOT NULL,
                departamento TEXT,
                descricao TEXT,
                valor NUMERIC(18,2),
                tipo TEXT
            )
            '''
        )

        # ==================================================================
        # 7. COMMIT ATÔMICO
        # ==================================================================

        conexao.commit()

        # ==================================================================
        # 8. ATUALIZA A SESSÃO
        # ==================================================================

        session['nome_empresa'] = nome_empresa.upper()

        session['capital_inicial'] = capital_total

        session['empresa_inicializada'] = True

        session.modified = True

        # ==================================================================
        # 9. RESPOSTA PARA O FRONT-END
        # ==================================================================
        #
        # O JS deverá redirecionar para /financeiro.
        #
        # Não mais para /grid -> /estrutura.
        #
        # ==================================================================

        return jsonify({
            'status': 'sucesso',
            'message': (
                'Empresa inicializada. '
                'Defina agora as quotas dos departamentos '
                'no Financeiro.'
            ),
            'redirect': '/financeiro',
            'equipe_id': id_equipe,
            'capital_total': capital_total
        })

    # ======================================================================
    # ERRO DE BANCO
    # ======================================================================

    except psycopg2.DatabaseError as erro:

        if conexao:

            try:
                conexao.rollback()
            except Exception:
                pass

        print(
            '❌ Erro crítico no banco de dados '
            f'durante inicialização: {erro}'
        )

        return jsonify({
            'status': 'erro',
            'message': (
                'Falha interna ao persistir a '
                'inicialização no Supabase.'
            )
        }), 500

    # ======================================================================
    # ERRO GERAL
    # ======================================================================

    except Exception as erro:

        if conexao:

            try:
                conexao.rollback()
            except Exception:
                pass

        print(
            '❌ Erro inesperado na inicialização: '
            f'{erro}'
        )

        return jsonify({
            'status': 'erro',
            'message': (
                'Erro inesperado durante a '
                'inicialização da empresa.'
            )
        }), 500

    # ======================================================================
    # LIBERAÇÃO DA CONEXÃO
    # ======================================================================

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
