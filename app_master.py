# erppadrao - app_master.py - PARTE 1 DE 3
import os
from flask import Flask, session, jsonify, request, redirect, render_template_string
from datetime import timedelta
from whitenoise import WhiteNoise

# ⚡ BLINDAGEM CONTRA ALUNOS: O Python lê a chave de forma invisível no Render.
URL_SUPABASE = os.environ.get(
    "DATABASE_URL", 
    "postgresql://postgres:senha_ficticia_anti_alunos@localhost:5432/postgres"
)

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Ativação do WhiteNoise para servir os arquivos estáticos locais de forma direta
app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(os.path.dirname(__file__), 'static'), prefix='static/')

# Configurações de Segurança e Persistência de Sessão de Aula para Aula
app.secret_key = "®ψΣ_TERADMAS_CHAVE_SECRETA_PROFESSOR_RENATO"
app.permanent_session_lifetime = timedelta(days=7)

# Importação dos Componentes do Core de Regras de Negócio e Caixa Geral
import GerenciadorCaixa

# IMPORTAÇÃO DOS BLUEPRINTS DE CADA DEPARTAMENTO DO SIMULADOR
from login.app_login import login_blueprint
from configuracao.app_configuracao import configuracao_blueprint
from estrutura.app_estrutura import estrutura_blueprint
from maquinas.app_maquinas import maquinas_blueprint
from materiais.app_materiais import materiais_blueprint
from processos.app_processos import processos_blueprint
from produtos.app_produtos import produtos_blueprint
from precificacao.app_precificacao import precificacao_blueprint
from clientes.app_clientes import clientes_blueprint
from vendas.app_vendas import vendas_blueprint
from estoque.app_estoque import estoque_blueprint
from financeiro.app_financeiro import financeiro_blueprint
from nota_fiscal.app_nota_fiscal import nota_fiscal_blueprint
from rh.app_rh import rh_blueprint
from pcp.app_pcp import pcp_blueprint
from orcamentos.app_orcamentos import orcamentos_blueprint
from compras_insumos.app_compras import compras_blueprint
from engenharia_producao.app_producao import producao_blueprint
from folha_pagamento.app_folha import folha_blueprint
from manutencao.app_manutencao import manutencao_blueprint
from requisicoes.app_requisicoes import requisicoes_blueprint
from roi.app_roi import roi_blueprint
# erppadrao - app_master.py - PARTE 2 DE 3

# REGISTRO DAS MALHAS TÉCNICAS NO SERVIDOR CENTRAL FLASK
app.register_blueprint(login_blueprint)
app.register_blueprint(configuracao_blueprint)
app.register_blueprint(estrutura_blueprint)
app.register_blueprint(maquinas_blueprint)
app.register_blueprint(materiais_blueprint)
app.register_blueprint(processos_blueprint)
app.register_blueprint(produtos_blueprint)
app.register_blueprint(precificacao_blueprint)
app.register_blueprint(clientes_blueprint)
app.register_blueprint(vendas_blueprint)
app.register_blueprint(estoque_blueprint)
app.register_blueprint(financeiro_blueprint)
app.register_blueprint(nota_fiscal_blueprint)
app.register_blueprint(rh_blueprint)
app.register_blueprint(pcp_blueprint)
app.register_blueprint(orcamentos_blueprint)
app.register_blueprint(compras_blueprint)
app.register_blueprint(producao_blueprint)
app.register_blueprint(folha_blueprint)
app.register_blueprint(manutencao_blueprint)
app.register_blueprint(requisicoes_blueprint)
app.register_blueprint(roi_blueprint)

# 🛡️ MIDDLEWARE DE BARREIRA: Segurança de fluxo e proteção de estado sem loops de redirecionamento
@app.before_request
def verificar_fluxo_de_aula():
    # 1. Liberação irrestrita para caminhos de arquivos estáticos, rotas de login e rota de logout
    if request.path.startswith('/static') or request.path.startswith('/login') or request.path == '/logout':
        return

    # 2. Bloqueio de Autenticação Geral: Se não houver token de sessão ativo, manda para o login
    if not session.get('logado'):
        if request.is_json:
            return jsonify({'status': 'erro', 'message': 'Sessão encerrada por inatividade.'}), 401
        return redirect('/login')

    # Professor master tem passe livre para inspecionar qualquer rota do sistema
    if session.get('professor_master'):
        return

    # 3. Bloqueio de Inicialização: Se a equipe não preencheu o capital, barra o fluxo e manda para configuração
    if not session.get('empresa_inicializada') and request.endpoint != 'configuracao_blueprint.api_inicializar_empresa':
        if not request.path.startswith('/configuracao'):
            if request.is_json:
                return jsonify({'status': 'erro', 'message': 'A empresa precisa ser inicializada primeiro.'}), 400
            return redirect('/configuracao/inicializacao')
# erppadrao - app_master.py - PARTE 3 DE 3

# 🌟 CORREÇÃO DO FLUXO INICIAL: Remove a dependência do arquivo 'grid.html' inexistente
@app.route('/grid')
@app.route('/')
def rota_principal_grid():
    if not session.get('logado'):
        return redirect('/login')
        
    # Se o grupo já estiver logado e a empresa inicializada, envia direto para o Módulo Imobiliário
    if session.get('empresa_inicializada'):
        return redirect('/estrutura')
    else:
        return redirect('/configuracao/inicializacao')

# ENDPOINT GLOBAL AJAX REST: COLETOR DE MÉTRICAS CROSS-CHECKING DO TOPBOARD
@app.route('/api/financeiro/metricas', methods=['GET'])
def api_global_metricas_calculadas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Acesso negado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    departamento = request.args.get('dept', '')
    
    metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, departamento)
    return jsonify(metricas)

# CLÁUSULA OPERACIONAL PARA DEPLOY LINUX NO RENDER
if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=porta, debug=True)
