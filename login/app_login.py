# erppadrao - login/app_login.py
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

login_blueprint = Blueprint('login_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@login_blueprint.route('/login', methods=['GET', 'POST'])
def rota_login_autenticacao():
    # 1. TRATAMENTO DO TRÁFEGO GET: Renderiza a página física de login na tela
    if request.method == 'GET':
        if session.get('logado'):
            return redirect('/grid')
        with open('login/login.html', 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
        
    # 2. TRATAMENTO DO TRÁFEGO POST: Processa a validação AJAX enviada pela turma
    dados = request.json
    id_equipe_input = dados.get('id_equipe', '').strip().lower()
    senha_input = dados.get('senha', '').strip()
    
    # Validação do Painel de Controle Docente (Acesso Secreto do Professor)
    if id_equipe_input == "professor" and senha_input == "admin123":
        session.clear()
        session['logado'] = True
        session['id_equipe'] = 'professor'
        session['nome_empresa'] = 'PAINEL DE CONTROLE DOCENTE'
        session['professor_master'] = True
        return jsonify({'status': 'sucesso', 'redirecionar': '/professor_painel_secreto'})
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # Inicia a tabela de credenciais estudantis se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS credenciais_equipes (
            id SERIAL PRIMARY KEY, equipe_id TEXT UNIQUE, senha TEXT, nome_empresa TEXT
        )
    ''')
    
    # Injeta dados de teste coringa se a tabela estiver completamente vazia na primeira aula
    cursor.execute("SELECT COUNT(*) as total FROM credenciais_equipes")
    if cursor.fetchone()['total'] == 0:
        cursor.execute('''
            INSERT INTO credenciais_equipes (equipe_id, senha, nome_empresa) VALUES 
            ('equipe_alfa', 'alfa123', 'METALÚRGICA ALFA S.A.'),
            ('equipe_beta', 'beta123', 'CONFEITARIA BETA LTDA')
        ''')
        conexao.commit()

    # Executa a busca de segurança cruzando ID e Senha informados
    cursor.execute("SELECT * FROM credenciais_equipes WHERE equipe_id = %s AND senha = %s", (id_equipe_input, senha_input))
    equipe_valida = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    
    if equipe_valida:
        session.clear()
        session.permanent = True  # Ativa a capabilidade de 7 dias configurada no app_master
        session['logado'] = True
        session['id_equipe'] = equipe_valida['equipe_id']
        session['nome_empresa'] = equipe_valida['nome_empresa'].upper()
        return jsonify({'status': 'sucesso', 'redirecionar': '/grid'})
    else:
        return jsonify({'status': 'erro', 'message': 'Credenciais inválidas ou equipe não homologada.'}), 401

@login_blueprint.route('/logout')
def rota_logout_estudantil():
    session.clear()
    return redirect('/login')
