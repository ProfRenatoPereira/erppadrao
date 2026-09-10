# TERADMAS ERP v2.6 - login.py
import os
import hashlib
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, render_template_string, session, jsonify, redirect

login_blueprint = Blueprint('login_blueprint', __name__)
logger = logging.getLogger(__name__)

@login_blueprint.route('/login/login.js', methods=['GET'])
def servir_login_js():
    """Entrega o JavaScript real do login no caminho usado pelo login.html."""
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'login.js')
    try:
        with open(caminho, 'r', encoding='utf-8') as arquivo:
            return arquivo.read(), 200, {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            }
    except FileNotFoundError:
        return "console.error('TERADMAS: login.js não encontrado.');", 404, {
            'Content-Type': 'application/javascript; charset=utf-8'
        }

def obter_conexao_master():
    import GerenciadorCaixa
    conexao = GerenciadorCaixa.obter_conexao_master()
    if conexao is None:
        raise RuntimeError("Não foi possível obter conexão com o banco.")
    return conexao

def liberar_conexao_master(conexao):
    if conexao is not None:
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)

def criptografar_senha(senha):
    return hashlib.sha256(str(senha or '').encode('utf-8')).hexdigest()

def verificar_empresa_inicializada(id_equipe):
    conexao = cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute('''SELECT 1 FROM config_simulacao WHERE equipe_id=%s AND capital_total IS NOT NULL AND capital_total>0 LIMIT 1''', (id_equipe,))
            if cursor.fetchone(): return True
        except psycopg2.Error:
            conexao.rollback()
        try:
            cursor.execute('''SELECT 1 FROM configuracao_equipes WHERE equipe_id=%s AND capital_inicial IS NOT NULL AND capital_inicial>0 LIMIT 1''', (id_equipe,))
            return bool(cursor.fetchone())
        except psycopg2.Error:
            conexao.rollback()
            return False
    except psycopg2.Error as erro:
        logger.error('Erro ao verificar inicialização de %s: %s', id_equipe, erro)
        return False
    finally:
        if cursor: cursor.close()
        liberar_conexao_master(conexao)

def professor_autorizado():
    return bool(session.get('logado') and session.get('professor_master'))

def erro_json(message, status):
    return jsonify({'status':'erro','message':message}), status

@login_blueprint.route('/login', methods=['GET','POST'])
def rota_login_autenticacao():
    diretorio = os.path.dirname(os.path.abspath(__file__))
    if request.method == 'GET':
        if session.get('logado'):
            if session.get('professor_master'): return redirect('/professor_painel_secreto')
            return redirect('/configuracao/inicializacao')
        try:
            with open(os.path.join(diretorio,'login.html'),'r',encoding='utf-8') as arquivo:
                return render_template_string(arquivo.read())
        except FileNotFoundError:
            return "Erro Crítico: arquivo 'login.html' não encontrado.", 404

    dados = request.get_json(silent=True) or {}
    id_equipe = str(dados.get('id_equipe','')).strip().lower()
    senha = str(dados.get('senha','')).strip()
    if not id_equipe or not senha: return erro_json('Informe a equipe e a senha.',400)

    master_id = os.environ.get('PROFESSOR_MASTER_ID','professor').strip().lower()
    master_senha = os.environ.get('PROFESSOR_MASTER_SENHA','admin123')
    if id_equipe == master_id and senha == master_senha:
        session.clear(); session.permanent=True
        session.update({'logado':True,'id_equipe':'professor','nome_empresa':'PAINEL DE CONTROLE DOCENTE','professor_master':True,'empresa_inicializada':True})
        return jsonify({'status':'sucesso','redirecionar':'/professor_painel_secreto'})

    conexao = cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''SELECT equipe_id, senha, nome_empresa FROM credenciais_equipes WHERE LOWER(TRIM(equipe_id))=%s LIMIT 1''',(id_equipe,))
        equipe = cursor.fetchone()
    except psycopg2.Error as erro:
        logger.error('Erro de banco no login de %s: %s',id_equipe,erro)
        return erro_json('Falha de comunicação com o banco de dados.',503)
    finally:
        if cursor: cursor.close()
        liberar_conexao_master(conexao)

    if not equipe or str(equipe.get('senha') or '') != criptografar_senha(senha):
        return erro_json('Credenciais inválidas ou equipe não homologada.',401)

    id_real = equipe.get('equipe_id') or id_equipe
    nome_empresa = str(equipe.get('nome_empresa') or '').strip()
    inicializada = verificar_empresa_inicializada(id_real)
    session.clear(); session.permanent=True
    session.update({'logado':True,'id_equipe':id_real,'nome_empresa':nome_empresa.upper(),'empresa_inicializada':inicializada,'professor_master':False})
    return jsonify({'status':'sucesso','redirecionar':'/configuracao/inicializacao','empresa_inicializada':inicializada})

@login_blueprint.route('/professor_painel_secreto')
def rota_painel_professor_html():
    if not professor_autorizado(): return redirect('/login')
    caminho=os.path.join(os.path.dirname(os.path.abspath(__file__)),'professor_painel_secreto.html')
    try:
        with open(caminho,'r',encoding='utf-8') as arquivo: return render_template_string(arquivo.read())
    except FileNotFoundError: return "Erro Crítico: arquivo 'professor_painel_secreto.html' não encontrado.",404

@login_blueprint.route('/api/professor/listar',methods=['GET'])
def api_professor_listar_equipes():
    if not professor_autorizado(): return jsonify({'error':'Acesso negado'}),401
    conexao=cursor=None
    try:
        conexao=obter_conexao_master(); cursor=conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT id,equipe_id,nome_empresa FROM credenciais_equipes ORDER BY equipe_id ASC')
        return jsonify([dict(x) for x in cursor.fetchall()])
    except psycopg2.Error as erro:
        logger.error('Erro ao listar equipes: %s',erro); return jsonify({'error':'Falha ao consultar equipes.'}),500
    finally:
        if cursor: cursor.close()
        liberar_conexao_master(conexao)

@login_blueprint.route('/api/professor/salvar',methods=['POST'])
def api_professor_salvar_equipe():
    if not professor_autorizado(): return jsonify({'error':'Acesso negado'}),401
    dados=request.get_json(silent=True) or {}
    equipe_id=str(dados.get('equipe_id','')).strip().lower(); senha=str(dados.get('senha','')).strip(); nome=str(dados.get('nome_empresa','')).strip()
    if not equipe_id: return jsonify({'error':'O ID da equipe é obrigatório.'}),400
    if not senha: return jsonify({'error':'A senha é obrigatória.'}),400
    if not nome: return jsonify({'error':'O nome da empresa é obrigatório.'}),400
    conexao=cursor=None
    try:
        conexao=obter_conexao_master(); cursor=conexao.cursor()
        cursor.execute('''INSERT INTO credenciais_equipes(equipe_id,senha,nome_empresa) VALUES(%s,%s,%s) ON CONFLICT(equipe_id) DO UPDATE SET senha=EXCLUDED.senha,nome_empresa=EXCLUDED.nome_empresa''',(equipe_id,criptografar_senha(senha),nome))
        conexao.commit(); return jsonify({'status':'sucesso'})
    except psycopg2.Error as erro:
        if conexao: conexao.rollback()
        logger.error('Erro ao salvar equipe %s: %s',equipe_id,erro); return jsonify({'error':'Falha ao salvar equipe no banco de dados.'}),500
    finally:
        if cursor: cursor.close()
        liberar_conexao_master(conexao)

@login_blueprint.route('/api/professor/deletar/<int:id_reg>',methods=['DELETE'])
def api_professor_deletar_equipe(id_reg):
    if not professor_autorizado(): return jsonify({'error':'Acesso negado'}),401
    conexao=cursor=None
    try:
        conexao=obter_conexao_master(); cursor=conexao.cursor(); cursor.execute('DELETE FROM credenciais_equipes WHERE id=%s',(id_reg,))
        if cursor.rowcount==0: conexao.rollback(); return jsonify({'error':'Equipe não encontrada.'}),404
        conexao.commit(); return jsonify({'status':'sucesso'})
    except psycopg2.Error as erro:
        if conexao: conexao.rollback()
        logger.error('Erro ao excluir equipe %s: %s',id_reg,erro); return jsonify({'error':'Falha ao excluir equipe.'}),500
    finally:
        if cursor: cursor.close()
        liberar_conexao_master(conexao)

@login_blueprint.route('/logout')
def rota_logout_estudantil():
    session.clear(); return redirect('/login')
