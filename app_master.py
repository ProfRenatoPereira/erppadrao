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
    print(f"⚠️ Aviso: Alguns módulos não puderam ser importados: {e}")

# ========== REGISTRO DE BLUEPRINTS ==========
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
# ========== MIDDLEWARE DE AUTENTICAÇÃO ==========

@app.before_request
def verificar_fluxo_de_aula():
    """Middleware que valida sessão e autorização em cada request"""
    # Libera arquivos estáticos e login
    if request.path.startswith('/static') or request.path.startswith('/login') or request.path == '/logout':
        return

    # Validação 1: Verificar se está logado
    if not session.get('logado'):
        if request.is_json:
            return jsonify({'status': 'erro', 'message': 'Sessão expirada'}), 401
        return redirect('/login')

    # Ignora travas para conta do professor
    if session.get('professor_master'):
        return

    # Validação 2: Verificar se empresa foi inicializada
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
# ========== API DE MÉTRICAS GLOBAIS ==========

@app.route('/api/financeiro/metricas', methods=['GET'])
def api_global_metricas_calculadas():
    """Endpoint central de métricas consolidadas de toda a empresa"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Acesso negado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    departamento = request.args.get('dept', '')
    
    try:
        # Executa motor de cálculo de métricas
        metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, departamento)
        return jsonify(metricas)
    except Exception as e:
        print(f"❌ Erro na API de métricas: {e}")
        return jsonify({'status': 'erro', 'message': str(e)}), 500

@app.route('/api/financeiro/kpis', methods=['GET'])
def api_kpis_resumidos():
    """Endpoint de KPIs simplificados para dashboard rápido"""
    if not session.get('logado'):
        return jsonify({'status': 'erro'}), 401
    
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe)
    
    # Retorna apenas os KPIs principais
    return jsonify({
        'capital_total': metricas.get('capital_total'),
        'patrimonio_ativo': metricas.get('patrimonio_ativo_total'),
        'custo_fixo': metricas.get('custo_fixo_geral_empresa'),
        'capital_disponivel': metricas.get('capital_disponivel_total')
    })
# ========== TRATAMENTO DE ERROS ==========

@app.errorhandler(404)
def erro_nao_encontrado(erro):
    """Tratador para rotas não encontradas"""
    if request.is_json:
        return jsonify({'status': 'erro', 'message': 'Recurso não encontrado'}), 404
    return render_template_string("""
        <h1>❌ Página não encontrada</h1>
        <p>O recurso solicitado não existe.</p>
        <a href="/">Voltar ao início</a>
    """), 404

@app.errorhandler(500)
def erro_servidor(erro):
    """Tratador para erros internos do servidor"""
    print(f"❌ ERRO 500: {erro}")
    if request.is_json:
        return jsonify({'status': 'erro', 'message': 'Erro interno do servidor'}), 500
    return render_template_string("""
        <h1>❌ Erro Interno</h1>
        <p>Ocorreu um erro ao processar sua solicitação.</p>
        <a href="/">Voltar ao início</a>
    """), 500

# ========== EXECUÇÃO DO SERVIDOR ==========

if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("DEBUG", "False").lower() == "true"
    
    print(f"🚀 Iniciando TERADMAS ERP v2.6")
    print(f"📍 Porta: {porta}")
    print(f"🔧 Debug: {debug_mode}")
    
    app.run(host='0.0.0.0', port=porta, debug=debug_mode)
