# erppadrao - login/app_login.py
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib  # ⚡ Biblioteca nativa para criptografia SHA-256

login_blueprint = Blueprint('login_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

def criptografar_senha(senha_pura):
    """Transforma a senha em uma hash SHA-256 estável."""
    return hashlib.sha256(senha_pura.encode('utf-8')).hexdigest()

@login_blueprint.route('/login', methods=['GET', 'POST'])
def rota_login_autenticacao():
    if request.method == 'GET':
        if session.get('logado'):
            if session.get('professor_master'):
                return redirect('/professor_painel_secreto')
            return redirect('/grid')
        with open('login/login.html', 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
        
    dados = request.json
    id_equipe_input = dados.get('id_equipe', '').strip().lower()
    senha_input = dados.get('senha', '').strip()
    
    # 🔐 CHAVE MESTRE: Acesso do Professor mantido seguro em memória do servidor
    if id_equipe_input == "professor" and senha_input == "admin123":
        session.clear()
        session['logado'] = True
        session['id_equipe'] = 'professor'
        session['nome_empresa'] = 'PAINEL DE CONTROLE DOCENTE'
        session['professor_master'] = True
        return jsonify({'status': 'sucesso', 'redirecionar': '/professor_painel_secreto'})
        
    # Criptografa o que o aluno digitou para comparar com a hash do Supabase
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

@login_blueprint.route('/professor_painel_secreto')
def rota_painel_professor_html():
    if not session.get('logado') or not session.get('professor_master'):
        return redirect('/login')
    with open('login/professor_painel_secreto.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

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
    
    # Blinda as respostas JSON contra engenharia reversa no F12 dos alunos
    resposta_mascarada = []
    for l in linhas:
        item = dict(l)
        item['senha'] = "********"  # Mascara visualmente no painel do professor
        resposta_mascarada.append(item)
        
    return jsonify(resposta_mascarada)

@login_blueprint.route('/api/professor/salvar', methods=['POST'])
def api_professor_salvar_equipe():
    if not session.get('logado') or not session.get('professor_master'):
        return jsonify({'error': 'Acesso negado'}), 401
    dados = request.json
    
    # ⚡ Criptografa a nova senha informada pelo professor antes de gravar na nuvem
    senha_segura = criptografar_senha(dados['senha'])
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        INSERT INTO credenciais_equipes (equipe_id, senha, nome_empresa) VALUES (%s, %s, %s)
        ON CONFLICT (equipe_id) DO UPDATE SET senha = EXCLUDED.senha, nome_empresa = EXCLUDED.nome_empresa
    ''', (dados['equipe_id'], senha_segura, dados['nome_empresa']))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

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

@login_blueprint.route('/logout')
def rota_logout_estudantil():
    session.clear()
    return redirect('/login')
