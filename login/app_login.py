# ==========================================================================
# TERADMAS ERP v2.6 - AUTENTICAÇÃO E CONTROLE DE EQUIPES
# ARQUIVO: login/app_login.py
# ==========================================================================

import os
import hashlib
import logging

import psycopg2
from psycopg2.extras import RealDictCursor

from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    redirect
)

login_blueprint = Blueprint('login_blueprint', __name__)

logger = logging.getLogger(__name__)


# ==========================================================================
# CONEXÃO CENTRAL COM O SUPABASE
# ==========================================================================

def obter_conexao_master():
    """
    Utiliza exatamente a mesma URL de banco definida pelo app_master.
    """
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)


# ==========================================================================
# SEGURANÇA DE SENHA
# ==========================================================================

def criptografar_senha(senha_pura):
    """
    Mantém compatibilidade com as senhas atualmente armazenadas
    na tabela credenciais_equipes utilizando SHA-256.
    """
    if senha_pura is None:
        senha_pura = ''

    return hashlib.sha256(
        senha_pura.encode('utf-8')
    ).hexdigest()


# ==========================================================================
# VERIFICA SE A EMPRESA JÁ FOI INICIALIZADA
# ==========================================================================

def verificar_empresa_inicializada(id_equipe):
    """
    Consulta primeiro config_simulacao, que é a tabela criada pela
    inicialização atual do ERP.

    Também mantém compatibilidade com configuracao_equipes caso
    exista capital inicial registrado somente nessa tabela.
    """

    conexao = None
    cursor = None

    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        # --------------------------------------------------------------
        # 1. TABELA PRINCIPAL DA NOVA INICIALIZAÇÃO
        # --------------------------------------------------------------
        try:
            cursor.execute(
                """
                SELECT id
                FROM config_simulacao
                WHERE equipe_id = %s
                  AND capital_total IS NOT NULL
                  AND capital_total > 0
                LIMIT 1
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:
                return True

        except psycopg2.ProgrammingError:
            # Tabela pode ainda não existir
            conexao.rollback()

        # --------------------------------------------------------------
        # 2. COMPATIBILIDADE COM configuracao_equipes
        # --------------------------------------------------------------
        try:
            cursor.execute(
                """
                SELECT id
                FROM configuracao_equipes
                WHERE equipe_id = %s
                  AND capital_inicial IS NOT NULL
                  AND capital_inicial > 0
                LIMIT 1
                """,
                (id_equipe,)
            )

            registro = cursor.fetchone()

            if registro:
                return True

        except psycopg2.ProgrammingError:
            conexao.rollback()

        return False

    except psycopg2.Error as erro:
        logger.error(
            "Erro ao verificar inicialização da equipe %s: %s",
            id_equipe,
            erro
        )

        return False

    finally:
        if cursor:
            cursor.close()

        if conexao:
            conexao.close()


# ==========================================================================
# LOGIN
# ==========================================================================

@login_blueprint.route('/login', methods=['GET', 'POST'])
def rota_login_autenticacao():

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    # ----------------------------------------------------------------------
    # GET
    # ----------------------------------------------------------------------

    if request.method == 'GET':

        if session.get('logado'):

            if session.get('professor_master'):
                return redirect('/professor_painel_secreto')

            if session.get('empresa_inicializada'):
                return redirect('/estrutura')

            return redirect('/configuracao/inicializacao')

        caminho_login_html = os.path.join(
            diretorio_atual,
            'login.html'
        )

        try:
            with open(
                caminho_login_html,
                'r',
                encoding='utf-8'
            ) as arquivo:

                html = arquivo.read()

            return render_template_string(html)

        except FileNotFoundError:

            return (
                "Erro Crítico: Arquivo 'login.html' não encontrado "
                "no diretório do módulo.",
                404
            )

    # ----------------------------------------------------------------------
    # POST
    # ----------------------------------------------------------------------

    dados = request.get_json(silent=True)

    if not dados:
        return jsonify({
            'status': 'erro',
            'message': 'Dados não fornecidos.'
        }), 400

    id_equipe_input = str(
        dados.get('id_equipe', '')
    ).strip().lower()

    senha_input = str(
        dados.get('senha', '')
    ).strip()

    if not id_equipe_input or not senha_input:
        return jsonify({
            'status': 'erro',
            'message': 'Informe a equipe e a senha.'
        }), 400

    # ======================================================================
    # ACESSO MASTER DO PROFESSOR
    # ======================================================================
    #
    # Mantido para compatibilidade com o sistema atual.
    # Recomenda-se posteriormente mover essas credenciais para variáveis
    # de ambiente.
    # ======================================================================

    master_id = os.environ.get(
        'PROFESSOR_MASTER_ID',
        'professor'
    ).strip().lower()

    master_senha = os.environ.get(
        'PROFESSOR_MASTER_SENHA',
        'admin123'
    )

    if (
        id_equipe_input == master_id
        and senha_input == master_senha
    ):

        session.clear()

        session.permanent = True

        session['logado'] = True
        session['id_equipe'] = 'professor'
        session['nome_empresa'] = 'PAINEL DE CONTROLE DOCENTE'
        session['professor_master'] = True
        session['empresa_inicializada'] = True

        return jsonify({
            'status': 'sucesso',
            'redirecionar': '/professor_painel_secreto'
        })

    # ======================================================================
    # AUTENTICAÇÃO DA EQUIPE
    # ======================================================================

    senha_criptografada = criptografar_senha(
        senha_input
    )

    conexao = None
    cursor = None
    equipe_valida = None

    try:

        conexao = obter_conexao_master()

        if not conexao:
            return jsonify({
                'status': 'erro',
                'message': 'Não foi possível conectar ao banco de dados.'
            }), 503

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        cursor.execute(
            """
            SELECT
                id,
                equipe_id,
                senha,
                nome_empresa
            FROM credenciais_equipes
            WHERE LOWER(TRIM(equipe_id)) = %s
              AND senha = %s
            LIMIT 1
            """,
            (
                id_equipe_input,
                senha_criptografada
            )
        )

        equipe_valida = cursor.fetchone()

    except psycopg2.Error as erro:

        logger.error(
            "Erro de banco durante autenticação da equipe %s: %s",
            id_equipe_input,
            erro
        )

        return jsonify({
            'status': 'erro',
            'message': 'Falha de comunicação com o banco de dados.'
        }), 503

    finally:

        if cursor:
            cursor.close()

        if conexao:
            conexao.close()

    # ======================================================================
    # CREDENCIAIS INVÁLIDAS
    # ======================================================================

    if not equipe_valida:

        return jsonify({
            'status': 'erro',
            'message': 'Credenciais inválidas ou equipe não homologada.'
        }), 401

    # ======================================================================
    # LOGIN VÁLIDO
    # ======================================================================

    id_equipe_real = (
        equipe_valida.get('equipe_id')
        or id_equipe_input
    )

    nome_empresa_credencial = (
        equipe_valida.get('nome_empresa')
        or ''
    ).strip()

    # ----------------------------------------------------------------------
    # Verifica se essa equipe já passou pela inicialização financeira
    # ----------------------------------------------------------------------

    empresa_inicializada = verificar_empresa_inicializada(
        id_equipe_real
    )

    # ----------------------------------------------------------------------
    # Monta a sessão
    # ----------------------------------------------------------------------

    session.clear()
    session.permanent = True

    session['logado'] = True
    session['id_equipe'] = id_equipe_real
    session['nome_empresa'] = (
        nome_empresa_credencial.upper()
        if nome_empresa_credencial
        else ''
    )
    session['empresa_inicializada'] = empresa_inicializada
    session['professor_master'] = False

    logger.info(
        "Login realizado: equipe=%s | empresa_inicializada=%s",
        id_equipe_real,
        empresa_inicializada
    )

    # ======================================================================
    # REDIRECIONAMENTO CORRETO
    # ======================================================================

    if empresa_inicializada:

        return jsonify({
            'status': 'sucesso',
            'redirecionar': '/grid'
        })

    return jsonify({
        'status': 'sucesso',
        'redirecionar': '/configuracao/inicializacao'
    })


# ==========================================================================
# PAINEL SECRETO DO PROFESSOR
# ==========================================================================

@login_blueprint.route('/professor_painel_secreto')
def rota_painel_professor_html():

    if (
        not session.get('logado')
        or not session.get('professor_master')
    ):
        return redirect('/login')

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_painel_html = os.path.join(
        diretorio_atual,
        'professor_painel_secreto.html'
    )

    try:

        with open(
            caminho_painel_html,
            'r',
            encoding='utf-8'
        ) as arquivo:

            html = arquivo.read()

        return render_template_string(html)

    except FileNotFoundError:

        return (
            "Erro Crítico: Arquivo "
            "'professor_painel_secreto.html' não encontrado.",
            404
        )


# ==========================================================================
# LISTAGEM DAS EQUIPES PELO PROFESSOR
# ==========================================================================

@login_blueprint.route(
    '/api/professor/listar',
    methods=['GET']
)
def api_professor_listar_equipes():

    if (
        not session.get('logado')
        or not session.get('professor_master')
    ):
        return jsonify({
            'error': 'Acesso negado'
        }), 401

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        cursor.execute(
            """
            SELECT
                id,
                equipe_id,
                nome_empresa
            FROM credenciais_equipes
            ORDER BY equipe_id ASC
            """
        )

        linhas = cursor.fetchall()

    except psycopg2.Error as erro:

        logger.error(
            "Erro ao listar equipes: %s",
            erro
        )

        return jsonify({
            'error': 'Falha ao consultar equipes.'
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            conexao.close()

    resposta = []

    for linha in linhas:

        item = dict(linha)

        # Nunca retorna a senha verdadeira.
        item['senha'] = '********'

        resposta.append(item)

    return jsonify(resposta)


# ==========================================================================
# CRIAÇÃO / ATUALIZAÇÃO DE EQUIPE PELO PROFESSOR
# ==========================================================================

@login_blueprint.route(
    '/api/professor/salvar',
    methods=['POST']
)
def api_professor_salvar_equipe():

    if (
        not session.get('logado')
        or not session.get('professor_master')
    ):
        return jsonify({
            'error': 'Acesso negado'
        }), 401

    dados = request.get_json(silent=True)

    if not dados:

        return jsonify({
            'error': 'Dados ausentes'
        }), 400

    equipe_id = str(
        dados.get('equipe_id', '')
    ).strip().lower()

    senha_pura = str(
        dados.get('senha', '')
    ).strip()

    nome_empresa = str(
        dados.get('nome_empresa', '')
    ).strip()

    if not equipe_id:
        return jsonify({
            'error': 'O ID da equipe é obrigatório.'
        }), 400

    if not senha_pura:
        return jsonify({
            'error': 'A senha é obrigatória.'
        }), 400

    if not nome_empresa:
        return jsonify({
            'error': 'O nome da empresa é obrigatório.'
        }), 400

    senha_segura = criptografar_senha(
        senha_pura
    )

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        if not conexao:
            return jsonify({
                'error': 'Banco de dados indisponível.'
            }), 503

        cursor = conexao.cursor()

        cursor.execute(
            """
            INSERT INTO credenciais_equipes
                (
                    equipe_id,
                    senha,
                    nome_empresa
                )
            VALUES
                (%s, %s, %s)

            ON CONFLICT (equipe_id)
            DO UPDATE SET
                senha = EXCLUDED.senha,
                nome_empresa = EXCLUDED.nome_empresa
            """,
            (
                equipe_id,
                senha_segura,
                nome_empresa
            )
        )

        conexao.commit()

    except psycopg2.Error as erro:

        if conexao:
            conexao.rollback()

        logger.error(
            "Erro ao salvar equipe %s: %s",
            equipe_id,
            erro
        )

        return jsonify({
            'error': 'Falha ao salvar equipe no banco de dados.'
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            conexao.close()

    return jsonify({
        'status': 'sucesso'
    })


# ==========================================================================
# EXCLUSÃO DE EQUIPE
# ==========================================================================

@login_blueprint.route(
    '/api/professor/deletar/<int:id_reg>',
    methods=['DELETE']
)
def api_professor_deletar_equipe(id_reg):

    if (
        not session.get('logado')
        or not session.get('professor_master')
    ):
        return jsonify({
            'error': 'Acesso negado'
        }), 401

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        if not conexao:
            return jsonify({
                'error': 'Banco de dados indisponível.'
            }), 503

        cursor = conexao.cursor()

        cursor.execute(
            """
            DELETE FROM credenciais_equipes
            WHERE id = %s
            """,
            (id_reg,)
        )

        if cursor.rowcount == 0:

            conexao.rollback()

            return jsonify({
                'error': 'Equipe não encontrada.'
            }), 404

        conexao.commit()

    except psycopg2.Error as erro:

        if conexao:
            conexao.rollback()

        logger.error(
            "Erro ao excluir equipe ID %s: %s",
            id_reg,
            erro
        )

        return jsonify({
            'error': 'Falha ao excluir equipe.'
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexao:
            conexao.close()

    return jsonify({
        'status': 'sucesso'
    })


# ==========================================================================
# LOGOUT
# ==========================================================================

@login_blueprint.route('/logout')
def rota_logout_estudantil():

    session.clear()

    return redirect('/login')
