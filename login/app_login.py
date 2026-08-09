# login/app_login.py
from flask import Blueprint, request, render_template_string, session, redirect

login_blueprint = Blueprint('login_blueprint', __name__)

# Banco de dados pedagógico de credenciais por equipes de trabalho
EQUIPES_PERMITIDAS = {
    "equipe_alfa": "teradmas2026",
    "equipe_beta": "teradmas2026",
    "equipe_gama": "teradmas2026",
    "admin": "admin123"
}

@login_blueprint.route('/login', methods=['POST'])
def processar_login_equipe():
    usuario = request.form.get('usuario', '').strip().lower()
    senha = request.form.get('senha', '')
    
    if usuario in EQUIPES_PERMITIDAS and EQUIPES_PERMITIDAS[usuario] == str(senha):
        # Consolida a segurança e o isolamento de chaves
        session['logado'] = True
        session['id_equipe'] = usuario
        session['nome_empresa'] = usuario.replace('_', ' ').upper()
        return redirect('/')
    else:
        # Devolve o erro didático diretamente para a tela de login
        with open('login/login.html', 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html, erro="Credenciais Inválidas! Chave de acesso recusada pelo sistema.")
# ... (mantenha o código anterior de processar_login_equipe) ...

@login_blueprint.route('/professor_painel_secreto')
def painel_secreto_professor():
    # Rota secreta de contingência
    with open('login/professor_painel_secreto.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@login_blueprint.route('/api/professor/senhas', methods=['GET'])
def api_listar_senhas_professor():
    # Expõe o dicionário de senhas atual para auditoria em tempo real do docente
    return jsonify(EQUIPES_PERMITIDAS)

@login_blueprint.route('/api/professor/resetar-senha', methods=['POST'])
def api_resetar_senha_equipe():
    dados = request.json
    usuario = dados.get('usuario')
    nova_senha = dados.get('nova_senha')
    
    if usuario in EQUIPES_PERMITIDAS:
        # Altera a senha em tempo de execução
        EQUIPES_PERMITIDAS[usuario] = str(nova_senha)
        return jsonify({'status': 'sucesso'})
    return jsonify({'status': 'erro'}), 400

@login_blueprint.route('/login/forçar-acesso')
def forcar_acesso_contingencia():
    usuario = request.args.get('usuario')
    if usuario in EQUIPES_PERMITIDAS:
        session['logado'] = True
        session['id_equipe'] = usuario
        session['nome_empresa'] = usuario.replace('_', ' ').upper()
        return redirect('/')
    return "Equipe não localizada.", 404
