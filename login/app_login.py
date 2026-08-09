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
