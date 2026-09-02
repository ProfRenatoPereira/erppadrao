# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# VERSÃO ATUALIZADA: ISOLAMENTO ENTRE UTENSÍLIOS (MOD 2) E MÁQUINAS (MOD 7)
# ==========================================================================

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def obter_conexao_master():
    """Recupera a string de conexão unificada cadastrada no app_master ou env."""
    try:
        from app_master import URL_SUPABASE
        return psycopg2.connect(URL_SUPABASE)
    except (ImportError, AttributeError):
        url_fallback = os.environ.get("DATABASE_URL")
        if url_fallback:
            return psycopg2.connect(url_fallback)
        raise psycopg2.DatabaseError("Não foi possível ler as credenciais do banco no ambiente atual.")

def calcular_metricas_totais_equipe(id_equipe, departamento_atual=None):
    """
    Motor central que calcula o balanço patrimonial e despesas correntes,
    separando rigidamente os utensílios de suporte das máquinas industriais.
    """
    conexao = obter_conexao_master()
    cursor = None
    
    capital_total = 5000000.00
    valor_aluguel_global = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    total_gasto_fluxo = 0.0
    
    patrimonio_ativo_total = 0.0
    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0
    
    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. Parâmetros estáveis da fundação do negócio
        try:
            cursor.execute("SELECT nome_empresa, capital_total, valor_aluguel FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
            config = cursor.fetchone()
            if config:
                capital_total = float(config['capital_total'] or 5000000.00)
                valor_aluguel_global = float(config['valor_aluguel'] or 0)
                nome_empresa = config['nome_empresa']
        except Exception as e:
            print(f"Aviso: config_simulacao indisponível: {e}")
            if conexao: conexao.rollback()

        # 2. Somatório histórico de movimentações no Livro de Caixa
        try:
            cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s", (id_equipe,))
            resultado_fluxo = cursor.fetchone()
            if resultado_fluxo and resultado_fluxo['total']:
                total_gasto_fluxo = float(resultado_fluxo['total'])
        except Exception as e:
            print(f"Aviso: fluxo_caixa indisponível: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # 🏢 SEÇÃO 01: PATRIMÔNIO ATIVO (IMÓVEIS, UTENSÍLIOS E MÁQUINAS)
        # ==================================================================
        
        # A) Módulo Imobiliário (Tabela: imoveis_simulacao)
        imob_aluguel_setor = 0.0
        imob_condo_setor = 0.0
        try:
            cursor.execute("SELECT COALESCE(SUM(valor_aluguel), 0) as aluguel, COALESCE(SUM(valor_condominio), 0) as condo FROM imoveis_simulacao WHERE equipe_id = %s", (id_equipe,))
            res_imob = cursor.fetchone()
            if res_imob:
                imob_aluguel_setor = float(res_imob['aluguel'] or 0)
                imob_condo_setor = float(res_imob['condo'] or 0)
                patrimonio_ativo_total += imob_aluguel_setor
                if departamento_atual == 'estrutura':
                    patrimonio_isolado_setor += imob_aluguel_setor
        except Exception as e:
            print(f"Aviso: imoveis_simulacao: {e}")
            if conexao: conexao.rollback()

        # B) Diferenciação de Ativos / Máquinas / Utensílios (Tabela: erp_maquinas)
        try:
            # Puxa o patrimônio consolidado de toda a empresa (Máquinas + Utensílios)
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s", (id_equipe,))
            res_maq = cursor.fetchone()
            if res_maq and res_maq['total']:
                patrimonio_ativo_total += float(res_maq['total'])
                
            # Filtro Isolado Módulo 02: Puxa apenas Utensílios de Suporte Predial
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s AND departamento = 'UTENSILIOS'", (id_equipe,))
            res_utensilios = cursor.fetchone()
            if res_utensilios and res_utensilios['total'] and departamento_atual == 'estrutura':
                patrimonio_isolado_setor += float(res_utensilios['total'])

            # Filtro Isolado Módulo 07: Puxa apenas Máquinas Industriais de Produção
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s AND departamento = 'PRODUCAO'", (id_equipe,))
            res_producao = cursor.fetchone()
            if res_producao and res_producao['total'] and departamento_atual == 'maquinas':
                patrimonio_isolado_setor += float(res_producao['total'])
        except Exception as e:
            print(f"Aviso: erp_maquinas: {e}")
            if conexao: conexao.rollback()
        # ==================================================================
        # 🏢 SEÇÃO 02: ESTRUTURAÇÃO E RATEIO DE CUSTOS FIXOS (SOMA MATRICIAL)
        # ==================================================================
        
        # PASSO 1: Ocupação imobiliária (Aluguel Global + Locações Específicas do Setor)
        custo_fixo_total_global = valor_aluguel_global + imob_aluguel_setor + imob_condo_setor
        if departamento_atual == 'estrutura':
            custo_fixo_isolado_setor = imob_aluguel_setor + imob_condo_setor

        # PASSO 2: Folha de funcionários CLT ativa da administração (Tabela: folha_funcionarios)
        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh_global = cursor.fetchone()
            if res_rh_global and res_rh_global['total']:
                custo_fixo_total_global += float(res_rh_global['total'])
        except Exception as e:
            print(f"Aviso: folha_funcionarios: {e}")
            if conexao: conexao.rollback()

        # PASSO 3: Suporte predial e refeitório específico do Módulo 02 (Tabela: estrutura_rh)
        try:
            cursor.execute("SELECT COALESCE(SUM(subtotal), 0) as total FROM estrutura_rh WHERE equipe_id = %s", (id_equipe,))
            res_rh_imob = cursor.fetchone()
            if res_rh_imob:
                rh_setor_valor = float(res_rh_imob['total'] or 0)
                custo_fixo_total_global += rh_setor_valor
                if departamento_atual == 'estrutura':
                    custo_fixo_isolado_setor += rh_setor_valor
        except Exception as e:
            print(f"Aviso: estrutura_rh: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # ⚡ SEÇÃO 03: CONSOLIDAÇÃO DE CUSTOS VARIÁVEIS GLOBAIS
        # ==================================================================
        try:
            cursor.execute("SELECT SUM(COALESCE(encargos_patronais, 0) + COALESCE(valor_horas_extras, 0)) as total FROM livro_razonete_folha WHERE equipe_id = %s", (id_equipe,))
            res_folha_var = cursor.fetchone()
            if res_folha_var and res_folha_var['total']:
                custo_variavel_total_global += float(res_folha_var['total'])
                if departamento_atual == 'rh' or departamento_atual == 'folha_pagamento':
                    custo_variavel_isolado_setor += float(res_folha_var['total'])
        except Exception as e:
            print(f"Aviso: Falha controlada ao ler livro_razonete_folha: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # 📊 SEÇÃO 04: BALANÇO DE FLUXO DE CAIXA E DISPONIBILIDADE
        # ==================================================================
        capital_disponivel_total = capital_total - total_gasto_fluxo - valor_aluguel_global

        return {
            'nome_empresa': nome_empresa.upper(),
            'capital_total': capital_total,
            'capital_disponivel_total': max(0.0, capital_disponivel_total),
            
            # Métricas Consolidadas Universais (Toda a Empresa)
            'patrimonio_ativo_total': patrimonio_ativo_total,
            'custo_fixo_geral_empresa': custo_fixo_total_global,
            'custo_variavel_total': custo_variavel_total_global,
            
            # Métricas Isoladas Específicas do Setor Requisitante
            'patrimonio_isolado_setor': patrimonio_isolado_setor,
            'custo_fixo_isolado_setor': custo_fixo_isolado_setor,
            'custo_variavel_isolado_setor': custo_variavel_isolado_setor
        }

    except Exception as e:
        print(f"Erro Crítico no Motor de Métricas de Caixa: {e}")
        return {
            'nome_empresa': "MODO SEGURANÇA", 
            'capital_total': 5000000.00, 'capital_disponivel_total': 0.0,
            'patrimonio_ativo_total': 0.0, 'custo_fixo_geral_empresa': 21350.00, 'custo_variavel_total': 0.0,
            'patrimonio_isolado_setor': 0.0, 'custo_fixo_isolado_setor': 0.0, 'custo_variavel_isolado_setor': 0.0
        }

    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
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
    """Endpoint de KPIs simplificados para dashboard rápido"""
    if not session.get('logado'):
        return jsonify({'status': 'erro'}), 401
    
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe)
    
    return jsonify({
        'capital_total': metricas.get('capital_total'),
        'patrimonio_ativo': metricas.get('patrimonio_ativo_total'),
        'custo_fixo': metricas.get('custo_fixo_geral_empresa'),
        'capital_disponivel': metricas.get('capital_disponivel_total')
    })

# ========== TRATAMENTO DE ERROS ==========

@app.errorhandler(404)
def erro_nao_encontrado(erro):
    if request.is_json:
        return jsonify({'status': 'erro', 'message': 'Recurso não encontrado'}), 404
    return render_template_string("""
        <h1>❌ Página não encontrada</h1>
        <p>O recurso solicitado não existe no sistema TERADMAS.</p>
        <a href="/">Voltar ao início</a>
    """), 404

@app.errorhandler(500)
def erro_servidor(erro):
    print(f"❌ ERRO 500: {erro}")
    if request.is_json:
        return jsonify({'status': 'erro', 'message': 'Erro interno do servidor'}), 500
    return render_template_string("""
        <h1>❌ Erro Interno</h1>
        <p>Ocorreu um erro crítico ao processar no servidor.</p>
        <a href="/">Voltar ao início</a>
    """), 500

# ========== EXECUÇÃO DO SERVIDOR ==========

if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("DEBUG", "False").lower() == "true"
    
    print(f"🚀 Servidor Central TERADMAS ERP v2.6 Ativo")
    app.run(host='0.0.0.0', port=porta, debug=debug_mode)
