# erppadrao - login/app_login.py
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib

login_blueprint = Blueprint('login_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

def criptografar_senha(senha_pura):
    """Gera hash SHA-256 pura via Python (independente de extensões do banco)."""
    return hashlib.sha256(senha_pura.encode('utf-8')).hexdigest()

# 📄 ROTA PARA ENTREGAR O HTML DE LOGIN
@login_blueprint.route('/login', methods=['GET'])
def rota_login_html():
    if session.get('logado'):
        if session.get('professor_master'):
            return redirect('/professor_painel_secreto')
        return redirect('/grid')
    with open('login/login.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

# ⚡ ROTA PARA ENTREGAR O JAVASCRIPT DE LOGIN (Resolve o erro 404 e ReferenceError)
@login_blueprint.route('/login/login.js', methods=['GET'])
def rota_login_js():
    with open('login/login.js', 'r', encoding='utf-8') as f:
        js_conteudo = f.read()
    # Envia com o Content-Type correto para o navegador aceitar a execução
    return js_conteudo, 200, {'Content-Type': 'application/javascript'}

# 🔐 ROTA LOGICIAL DE AUTENTICAÇÃO (MÉTODO POST)
@login_blueprint.route('/login', methods=['POST'])
def rota_login_autenticacao():
    dados = request.json
    if not dados:
        return jsonify({'status': 'erro', 'message': 'Dados não fornecidos.'}), 400

    id_equipe_input = dados.get('id_equipe', '').strip().lower()
    senha_input = dados.get('senha', '').strip()
    
    # 🔐 ACESSO MASTER DOCENTE
    if id_equipe_input == "professor" and senha_input == "admin123":
        session.clear()
        session['logado'] = True
        session['id_equipe'] = 'professor'
        session['nome_empresa'] = 'PAINEL DE CONTROLE DOCENTE'
        session['professor_master'] = True
        return jsonify({'status': 'sucesso', 'redirecionar': '/professor_painel_secreto'})
        
    senha_criptografada = criptografar_senha(senha_input)
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT * FROM credenciais_equipes WHERE equipe_id = %s AND senha = %s", (id_equipe_input, senha_criptografada))
    equipe_valida = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    
    if equipe_valida:
        session.clear()
        session.permanent = True
        session['logado'] = True
        session['id_equipe'] = equipe_valida['equipe_id']
        session['nome_empresa'] = equipe_valida['nome_empresa'].upper()
        return jsonify({'status': 'sucesso', 'redirecionar': '/grid'})
    else:
        return jsonify({'status': 'erro', 'message': 'Credenciais inválidas ou equipe não homologada.'}), 401

# 📄 ROTA PARA ENTREGAR O HTML DO PAINEL DO PROFESSOR
@login_blueprint.route('/professor_painel_secreto')
def rota_painel_professor_html():
    if not session.get('logado') or not session.get('professor_master'):
        return redirect('/login')
    with open('login/professor_painel_secreto.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

# 📊 API PROFESSOR: LISTAR EQUIPES
@login_blueprint.route('/api/professor/listar', methods=['GET'])
def api_professor_listar_equipes():
    if not session.get('logado') or not session.get('professor_master'):
        return jsonify({'error': 'Acesso negado'}), 401
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT id, equipe_id, nome_empresa FROM credenciais_equipes ORDER BY equipe_id ASC')
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    
    resposta_mascarada = []
    for l in linhas:
        item = dict(l)
        item['senha'] = "********"  
        resposta_mascarada.append(item)
        
    return jsonify(resposta_mascarada)

# 💾 API PROFESSOR: SALVAR/RESETAR EQUIPE
@login_blueprint.route('/api/professor/salvar', methods=['POST'])
def api_professor_salvar_equipe():
    if not session.get('logado') or not session.get('professor_master'):
        return jsonify({'error': 'Acesso negado'}), 401
        
    dados = request.json
    if not dados:
        return jsonify({'error': 'Dados ausentes'}), 400
        
    equipe_id = dados.get('equipe_id', '').strip().lower()
    senha_pura = dados.get('senha', '').strip()
    nome_empresa = dados.get('nome_empresa', '').strip()
    
    if not equipe_id or not senha_pura or not nome_empresa:
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
        
    senha_segura = criptografar_senha(senha_pura)
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        INSERT INTO credenciais_equipes (equipe_id, senha, nome_empresa) VALUES (%s, %s, %s)
        ON CONFLICT (equipe_id) DO UPDATE SET senha = EXCLUDED.senha, nome_empresa = EXCLUDED.nome_empresa
    ''', (equipe_id, senha_segura, nome_empresa))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

# 🗑️ API PROFESSOR: DELETAR EQUIPE
@login_blueprint.route('/api/professor/deletar/<int:id_reg>', methods=['DELETE'])
def api_professor_deletar_equipe(id_reg):
    if not session.get('logado') or not session.get('professor_master'):
        return jsonify({'error': 'Acesso negado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    cursor.execute('DELETE FROM credenciais_equipes WHERE id = %s', (id_reg,))
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

# 🚪 ROTA DE LOGOUT
@login_blueprint.route('/logout')
def rota_logout_estudantil():
    session.clear()
    return redirect('/login')
