# erppadrao - app_master.py - PARTE 1 DE 3
import os
from flask import Flask, session, jsonify, request, redirect, render_template_string
from datetime import timedelta
from whitenoise import WhiteNoise

URL_SUPABASE = os.environ.get(
    "DATABASE_URL", 
    "postgresql://postgres:senha_ficticia_anti_alunos@localhost:5432/postgres"
)

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Acoplamento estrutural do WhiteNoise para servir os assets estáticos WCAG
app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(os.path.dirname(__file__), 'static'), prefix='static/')

app.secret_key = "®ψΣ_TERADMAS_CHAVE_SECRETA_PROFESSOR_RENATO"
app.permanent_session_lifetime = timedelta(days=7)

# Importação nativa do gerenciador de métricas e livro caixa unificado
import GerenciadorCaixa
# erppadrao - app_master.py - PARTE 2 DE 3
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

# Amarração dos barramentos modulares ao servidor do Render
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
# erppadrao - app_master.py - PARTE 3 DE 3

@app.before_request
def verificar_fluxo_de_aula():
    # Libera de forma irrestrita os arquivos estáticos e fluxos de autenticação
    if request.path.startswith('/static') or request.path.startswith('/login') or request.path == '/logout':
        return

    # Validação 1: Barramento de login ativo na sessão do Flask
    if not session.get('logado'):
        if request.is_json:
            return jsonify({'status': 'erro', 'message': 'Sessão encerrada por inatividade.'}), 401
        return redirect('/login')

    # Ignora travas lineares para a conta administrativa do docente
    if session.get('professor_master'):
        return

    # Validação 2: Impede o avanço para qualquer módulo caso a empresa não tenha fundado o capital
    if not session.get('empresa_inicializada') and request.endpoint != 'configuracao_blueprint.api_inicializar_empresa':
        if not request.path.startswith('/configuracao'):
            if request.is_json:
                return jsonify({'status': 'erro', 'message': 'A empresa precisa ser inicializada primeiro.'}), 400
            return redirect('/configuracao/inicializacao')


@app.route('/')
def rota_raiz_direta():
    if not session.get('logado'):
        return redirect('/login')
    
    # Redirecionamento linear baseado no estado contábil real do grupo
    if session.get('empresa_inicializada'):
        return redirect('/estrutura')
    else:
        return redirect('/configuracao/inicializacao')


@app.route('/grid')
def rota_contingencia_grid():
    # 🎯 CONTINGÊNCIA DE ROTAS: Captura links residuais do front-end e desvia com segurança para Estrutura
    if not session.get('logado'):
        return redirect('/login')
    return redirect('/estrutura')


@app.route('/api/financeiro/metricas', methods=['GET'])
def api_global_metricas_calculadas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Acesso negado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    departamento = request.args.get('dept', '')
    
    # Executa a query síncrona lendo a tabela config_simulacao e o livro de fluxo_caixa
    metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, departamento)
    return jsonify(metricas)


if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=porta, debug=True)
