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


login_blueprint = Blueprint(
    'login_blueprint',
    __name__
)

logger = logging.getLogger(__name__)


# ==========================================================================
# CONEXÃO CENTRAL COM O SUPABASE
# ==========================================================================

def obter_conexao_master():
    """
    Usa a DATABASE_URL central do ERP.

    Não depende de uma segunda configuração de banco.
    """
    database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        raise RuntimeError(
            'DATABASE_URL não configurada no ambiente.'
        )

    return psycopg2.connect(database_url)


# ==========================================================================
# SEGURANÇA DE SENHA
# ==========================================================================

def criptografar_senha(senha):
    """
    Mantém compatibilidade com as credenciais armazenadas
    atualmente em credenciais_equipes usando SHA-256.
    """
    texto = str(senha or '')

    return hashlib.sha256(
        texto.encode('utf-8')
    ).hexdigest()


# ==========================================================================
# RESPOSTA JSON PADRONIZADA
# ==========================================================================

def erro_json(message, status=400):
    return jsonify({
        'status': 'erro',
        'message': message
    }), status


# ==========================================================================
# VERIFICAÇÃO DE EMPRESA INICIALIZADA
# ==========================================================================

def verificar_empresa_inicializada(id_equipe):

    conexao = None
    cursor = None

    try:
        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        # --------------------------------------------------------------
        # PRIMEIRA FONTE: config_simulacao
        # --------------------------------------------------------------

        try:

            cursor.execute(
                """
                SELECT 1
                FROM config_simulacao
                WHERE equipe_id = %s
                  AND capital_total IS NOT NULL
                  AND capital_total > 0
                LIMIT 1
                """,
                (str(id_equipe),)
            )

            if cursor.fetchone():
                return True

        except psycopg2.Error:

            conexao.rollback()

        # --------------------------------------------------------------
        # SEGUNDA FONTE: configuracao_equipes
        # --------------------------------------------------------------

        try:

            cursor.execute(
                """
                SELECT 1
                FROM configuracao_equipes
                WHERE equipe_id = %s
                  AND capital_inicial IS NOT NULL
                  AND capital_inicial > 0
                LIMIT 1
                """,
                (str(id_equipe),)
            )

            if cursor.fetchone():
                return True

        except psycopg2.Error:

            conexao.rollback()

        return False

    except Exception as erro:

        logger.error(
            'Erro ao verificar inicialização da equipe %s: %s',
            id_equipe,
            erro
        )

        return False

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


# ==========================================================================
# AUTORIZAÇÃO DO PROFESSOR
# ==========================================================================

def professor_autorizado():

    return bool(
        session.get('logado')
        and session.get('professor_master')
    )


# ==========================================================================
# LOGIN
# ==========================================================================

@login_blueprint.route(
    '/login',
    methods=['GET', 'POST']
)
def rota_login_autenticacao():

    diretorio = os.path.dirname(
        os.path.abspath(__file__)
    )

    # ------------------------------------------------------------------
    # GET /login
    # ------------------------------------------------------------------

    if request.method == 'GET':

        if session.get('logado'):

            if session.get('professor_master'):

                return redirect(
                    '/professor_painel_secreto'
                )

            # ----------------------------------------------------------
            # IMPORTANTE:
            #
            # NÃO redirecionar automaticamente para /grid.
            #
            # A rota /grid não existe no master atualmente e estava
            # causando exatamente o 404 mostrado no navegador.
            #
            # A página operacional disponível e conhecida pelo contrato
            # atual é a inicialização quando ainda não há capital.
            # ----------------------------------------------------------

            if session.get('empresa_inicializada'):

                destino = (
                    os.environ.get(
                        'ERP_HOME_ROUTE',
                        '/financeiro'
                    ).strip()
                )

                if destino:
                    return redirect(destino)

            return redirect(
                '/configuracao/inicializacao'
            )

        # --------------------------------------------------------------
        # CARREGA login/login.html
        # --------------------------------------------------------------

        caminho_login = os.path.join(
            diretorio,
            'login.html'
        )

        try:

            with open(
                caminho_login,
                'r',
                encoding='utf-8'
            ) as arquivo:

                return render_template_string(
                    arquivo.read()
                )

        except FileNotFoundError:

            logger.error(
                "Arquivo login.html não encontrado: %s",
                caminho_login
            )

            return (
                "Erro Crítico: arquivo "
                "'login.html' não encontrado.",
                404
            )

    # ------------------------------------------------------------------
    # POST /login
    # ------------------------------------------------------------------

    dados = request.get_json(
        silent=True
    ) or {}

    id_equipe = str(
        dados.get(
            'id_equipe',
            ''
        )
    ).strip().lower()

    senha = str(
        dados.get(
            'senha',
            ''
        )
    ).strip()

    if not id_equipe:

        return erro_json(
            'Informe o identificador da equipe.',
            400
        )

    if not senha:

        return erro_json(
            'Informe a senha.',
            400
        )

    # ------------------------------------------------------------------
    # ACESSO DO PROFESSOR MASTER
    # ------------------------------------------------------------------

    master_id = os.environ.get(
        'PROFESSOR_MASTER_ID',
        'professor'
    ).strip().lower()

    master_senha = os.environ.get(
        'PROFESSOR_MASTER_SENHA',
        'admin123'
    )

    if (
        id_equipe == master_id
        and senha == master_senha
    ):

        session.clear()

        session.permanent = True

        session.update({
            'logado': True,
            'id_equipe': 'professor',
            'nome_empresa': 'PAINEL DE CONTROLE DOCENTE',
            'professor_master': True,
            'empresa_inicializada': True
        })

        return jsonify({
            'status': 'sucesso',
            'redirecionar':
                '/professor_painel_secreto'
        }), 200

    # ------------------------------------------------------------------
    # CONSULTA DA EQUIPE
    # ------------------------------------------------------------------

    conexao = None
    cursor = None
    equipe = None

    try:

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        cursor.execute(
            """
            SELECT
                equipe_id,
                senha,
                nome_empresa
            FROM credenciais_equipes
            WHERE LOWER(TRIM(equipe_id)) = %s
            LIMIT 1
            """,
            (id_equipe,)
        )

        equipe = cursor.fetchone()

    except psycopg2.Error as erro:

        logger.error(
            'Erro de banco no login da equipe %s: %s',
            id_equipe,
            erro
        )

        return erro_json(
            'Falha de comunicação com o banco de dados.',
            503
        )

    except Exception as erro:

        logger.error(
            'Erro inesperado no login da equipe %s: %s',
            id_equipe,
            erro
        )

        return erro_json(
            'Erro interno durante a autenticação.',
            500
        )

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

    # ------------------------------------------------------------------
    # VALIDAÇÃO DA CREDENCIAL
    # ------------------------------------------------------------------

    senha_banco = ''

    if equipe:

        senha_banco = str(
            equipe.get('senha') or ''
        )

    senha_informada = criptografar_senha(
        senha
    )

    if (
        not equipe
        or senha_banco != senha_informada
    ):

        return erro_json(
            'Credenciais inválidas ou equipe não homologada.',
            401
        )

    # ------------------------------------------------------------------
    # EQUIPE AUTENTICADA
    # ------------------------------------------------------------------

    id_real = str(
        equipe.get('equipe_id')
        or id_equipe
    ).strip()

    nome_empresa = str(
        equipe.get('nome_empresa')
        or ''
    ).strip()

    inicializada = verificar_empresa_inicializada(
        id_real
    )

    # ------------------------------------------------------------------
    # CRIAÇÃO DA SESSÃO
    # ------------------------------------------------------------------

    session.clear()

    session.permanent = True

    session.update({
        'logado': True,
        'id_equipe': id_real,
        'nome_empresa': nome_empresa.upper(),
        'empresa_inicializada': inicializada,
        'professor_master': False
    })

    # ------------------------------------------------------------------
    # DESTINO APÓS LOGIN
    #
    # Não existe mais /grid como destino fixo.
    #
    # ERP_HOME_ROUTE pode ser configurada no Render se o módulo
    # principal tiver uma rota diferente.
    # ------------------------------------------------------------------

    if inicializada:

        destino = os.environ.get(
            'ERP_HOME_ROUTE',
            '/financeiro'
        ).strip()

        if not destino:
            destino = '/financeiro'

    else:

        destino = (
            '/configuracao/inicializacao'
        )

    return jsonify({
        'status': 'sucesso',
        'redirecionar': destino
    }), 200


# ==========================================================================
# PAINEL DO PROFESSOR
# ==========================================================================

@login_blueprint.route(
    '/professor_painel_secreto',
    methods=['GET']
)
def rota_painel_professor_html():

    if not professor_autorizado():

        return redirect('/login')

    caminho = os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        'professor_painel_secreto.html'
    )

    try:

        with open(
            caminho,
            'r',
            encoding='utf-8'
        ) as arquivo:

            return render_template_string(
                arquivo.read()
            )

    except FileNotFoundError:

        return (
            "Erro Crítico: arquivo "
            "'professor_painel_secreto.html' "
            "não encontrado.",
            404
        )


# ==========================================================================
# API - LISTAR EQUIPES
# ==========================================================================

@login_blueprint.route(
    '/api/professor/listar',
    methods=['GET']
)
def api_professor_listar_equipes():

    if not professor_autorizado():

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

        equipes = cursor.fetchall()

        return jsonify([
            dict(equipe)
            for equipe in equipes
        ]), 200

    except psycopg2.Error as erro:

        logger.error(
            'Erro ao listar equipes: %s',
            erro
        )

        return jsonify({
            'error':
                'Falha ao consultar equipes.'
        }), 500

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


# ==========================================================================
# API - SALVAR / ATUALIZAR EQUIPE
# ==========================================================================

@login_blueprint.route(
    '/api/professor/salvar',
    methods=['POST']
)
def api_professor_salvar_equipe():

    if not professor_autorizado():

        return jsonify({
            'error': 'Acesso negado'
        }), 401

    dados = request.get_json(
        silent=True
    ) or {}

    equipe_id = str(
        dados.get(
            'equipe_id',
            ''
        )
    ).strip().lower()

    senha = str(
        dados.get(
            'senha',
            ''
        )
    ).strip()

    nome_empresa = str(
        dados.get(
            'nome_empresa',
            ''
        )
    ).strip()

    if not equipe_id:

        return jsonify({
            'error':
                'O ID da equipe é obrigatório.'
        }), 400

    if not senha:

        return jsonify({
            'error':
                'A senha é obrigatória.'
        }), 400

    if not nome_empresa:

        return jsonify({
            'error':
                'O nome da empresa é obrigatório.'
        }), 400

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

        cursor = conexao.cursor()

        senha_segura = criptografar_senha(
            senha
        )

        cursor.execute(
            """
            INSERT INTO credenciais_equipes
                (
                    equipe_id,
                    senha,
                    nome_empresa
                )
            VALUES
                (
                    %s,
                    %s,
                    %s
                )
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

        return jsonify({
            'status': 'sucesso'
        }), 200

    except psycopg2.Error as erro:

        if conexao:

            try:
                conexao.rollback()
            except Exception:
                pass

        logger.error(
            'Erro ao salvar equipe %s: %s',
            equipe_id,
            erro
        )

        return jsonify({
            'error':
                'Falha ao salvar equipe no banco de dados.'
        }), 500

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


# ==========================================================================
# API - EXCLUIR EQUIPE
# ==========================================================================

@login_blueprint.route(
    '/api/professor/deletar/<int:id_reg>',
    methods=['DELETE']
)
def api_professor_deletar_equipe(id_reg):

    if not professor_autorizado():

        return jsonify({
            'error': 'Acesso negado'
        }), 401

    conexao = None
    cursor = None

    try:

        conexao = obter_conexao_master()

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
                'error':
                    'Equipe não encontrada.'
            }), 404

        conexao.commit()

        return jsonify({
            'status': 'sucesso'
        }), 200

    except psycopg2.Error as erro:

        if conexao:

            try:
                conexao.rollback()
            except Exception:
                pass

        logger.error(
            'Erro ao excluir equipe ID %s: %s',
            id_reg,
            erro
        )

        return jsonify({
            'error':
                'Falha ao excluir equipe.'
        }), 500

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


# ==========================================================================
# LOGOUT
# ==========================================================================

@login_blueprint.route(
    '/logout',
    methods=['GET']
)
def rota_logout_estudantil():

    session.clear()

    return redirect('/login')
