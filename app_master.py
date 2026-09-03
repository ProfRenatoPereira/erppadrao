# ==========================================================================
# TERADMAS ERP v2.6 - APP MASTER (NÚCLEO PRINCIPAL DA APLICAÇÃO)
# Servidor Flask central com roteamento para todos os módulos
# ==========================================================================
 
import os
from flask import Flask, session, jsonify, request, redirect, render_template_string
from datetime import timedelta
from whitenoise import WhiteNoise
 
# URL de conexão com Supabase (PostgreSQL)
URL_SUPABASE = os.environ.get(
    "DATABASE_URL", 
    "postgresql://postgres:senha_ficticia_anti_alunos@localhost:5432/postgres"
)
 
# Inicialização do aplicativo Flask
app = Flask(__name__, static_folder='static', static_url_path='/static')
 
# Configuração do WhiteNoise para servir arquivos estáticos
app.wsgi_app = WhiteNoise(
    app.wsgi_app, 
    root=os.path.join(os.path.dirname(__file__), 'static'), 
    prefix='static/'
)
 
# Configurações de sessão
app.secret_key = "®ψΣ_TERADMAS_CHAVE_SECRETA_PROFESSOR_RENATO"
app.permanent_session_lifetime = timedelta(days=7)
 
# Importação do gerenciador de métricas central
import GerenciadorCaixa
 
# ========== IMPORTAÇÃO DE BLUEPRINTS MODULARES ==========
try:
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
except ImportError as e:
    print(f"⚠️ Checklist ERP: Alguns módulos operam em modo contingência: {e}")
 
# ========== REGISTRO DE BLUEPRINTS (checagem de existência para segurança) ==========
if 'login_blueprint' in globals():
    app.register_blueprint(login_blueprint)
else:
    print("⚠️ login_blueprint não disponível; registrando em modo contingência.")

if 'configuracao_blueprint' in globals():
    app.register_blueprint(configuracao_blueprint)
if 'estrutura_blueprint' in globals():
    app.register_blueprint(estrutura_blueprint)
if 'maquinas_blueprint' in globals():
    app.register_blueprint(maquinas_blueprint)
if 'materiais_blueprint' in globals():
    app.register_blueprint(materiais_blueprint)
if 'processos_blueprint' in globals():
    app.register_blueprint(processos_blueprint)
if 'produtos_blueprint' in globals():
    app.register_blueprint(produtos_blueprint)
if 'precificacao_blueprint' in globals():
    app.register_blueprint(precificacao_blueprint)
if 'clientes_blueprint' in globals():
    app.register_blueprint(clientes_blueprint)
if 'vendas_blueprint' in globals():
    app.register_blueprint(vendas_blueprint)
if 'estoque_blueprint' in globals():
    app.register_blueprint(estoque_blueprint)
if 'financeiro_blueprint' in globals():
    app.register_blueprint(financeiro_blueprint)
if 'nota_fiscal_blueprint' in globals():
    app.register_blueprint(nota_fiscal_blueprint)
if 'rh_blueprint' in globals():
    app.register_blueprint(rh_blueprint)
if 'pcp_blueprint' in globals():
    app.register_blueprint(pcp_blueprint)
if 'orcamentos_blueprint' in globals():
    app.register_blueprint(orcamentos_blueprint)
if 'compras_blueprint' in globals():
    app.register_blueprint(compras_blueprint)
if 'producao_blueprint' in globals():
    app.register_blueprint(producao_blueprint)
if 'folha_blueprint' in globals():
    app.register_blueprint(folha_blueprint)
if 'manutencao_blueprint' in globals():
    app.register_blueprint(manutencao_blueprint)
if 'requisicoes_blueprint' in globals():
    app.register_blueprint(requisicoes_blueprint)
if 'roi_blueprint' in globals():
    app.register_blueprint(roi_blueprint)
 
# ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
 
@app.before_request
def verificar_fluxo_de_aula():
    """Middleware que valida sessão e autorização em cada request"""
    if request.path.startswith('/static') or request.path.startswith('/login') or request.path == '/logout':
        return

    if not session.get('logado'):
        if request.is_json:
            return jsonify({'status': 'erro', 'message': 'Sessão expirada'}), 401
        return redirect('/login')

    if session.get('professor_master'):
        return

    if not session.get('empresa_inicializada') and request.endpoint != 'configuracao_blueprint.api_inicializar_empresa':
        if not request.path.startswith('/configuracao'):
            if request.is_json:
                return jsonify({'status': 'erro', 'message': 'Empresa não inicializada'}), 400
            return redirect('/configuracao/inicializacao')
 
# ========== ROTAS PRINCIPAIS ==========
 
@app.route('/')
def rota_raiz_direta():
    """Rota raiz com redirecionamento inteligente"""
    if not session.get('logado'):
        return redirect('/login')
    
    if session.get('empresa_inicializada'):
        return redirect('/estrutura')
    else:
        return redirect('/configuracao/inicializacao')
 
@app.route('/grid')
def rota_contingencia_grid():
    """Rota de contingência para links residuais do front-end"""
    if not session.get('logado'):
        return redirect('/login')
    return redirect('/estrutura')
 
@app.route('/logout')
def rota_encerrar_turno():
    """Limpa a sessão atual do banco de dados na memória do servidor"""
    session.clear()
    return redirect('/login')
 
# ========== API DE MÉTRICAS GLOBAIS ==========
 
@app.route('/api/financeiro/metricas', methods=['GET'])
def api_global_metricas_calculadas():
    """Endpoint central de métricas consolidadas de toda a empresa"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Acesso negado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    departamento = request.args.get('dept', '')
    
    try:
        metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, departamento)
        return jsonify(metricas)
    except Exception as e:
        print(f"❌ Erro na API de métricas: {e}")
        return jsonify({'status': 'erro', 'message': str(e)}), 500
 
@app.route('/api/financeiro/kpis', methods=['GET'])
def api_kpis_resumidos():
    """Endpoint de*
