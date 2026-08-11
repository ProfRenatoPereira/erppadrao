# erppadrao - app_master.py
import os
from flask import Flask, session, jsonify, request
from datetime import timedelta

# ⚡ CREDENCIAIS UNIFICADAS DE CONEXÃO COM O SUPABASE (POSTGRESQL)
# Substitua pela sua string real fornecida no painel do Supabase
URL_SUPABASE = "postgresql://postgres:sua_senha_secreta@db.supabase.co:5432/postgres"

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Configurações de Segurança e Persistência de Sessão de Aula para Aula
app.secret_key = "®ψΣ_TERADMAS_CHAVE_SECRETA_PROFESSOR_RENATO"
app.permanent_session_lifetime = timedelta(days=7)  # Mantém o aluno logado por 7 dias

# Importação dos Componentes do Core de Regras de Negócio e Caixa Geral
import GerenciadorCaixa

# IMPORTAÇÃO DOS BLUEPRINTS DE CADA DEPARTAMENTO DESENVOLVIDO
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
# Continuação de erppadrao - app_master.py

# REGISTRO DE BLUEPRINTS NO CORE DO SERVIDOR FLASK
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

# ROTA DA VIEW DA INTERFACE DE SELEÇÃO PRINCIPAL (GRID DASHBOARD)
@app.route('/grid')
@app.route('/')
def rota_principal_grid():
    if not session.get('logado'):
        from flask import redirect
        return redirect('/login')
    
    # Renderiza o painel master de navegação integrada (Módulos)
    with open('static/grid.html', 'r', encoding='utf-8') as f:
        html = f.read()
    from flask import render_template_string
    return render_template_string(html)

# ⚡ ENDPOINT GLOBAL AJAX REST: COLETOR DE MÉTRICAS CROSS-CHECKING DO TOPBOARD
@app.route('/api/financeiro/metricas', methods=['GET'])
def api_global_metricas_calculadas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Acesso negado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    departamento = request.args.get('dept', '')
    
    # Executa o cálculo consolidado através do Gerenciador de Caixa Core
    metricas = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, departamento)
    return jsonify(metricas)

# CLÁUSULA EXECUTÁVEL DO SERVIDOR DE AULA
if __name__ == '__main__':
    # Roda localmente na porta padrão 5000, ou herda as chaves de ambiente do Render/Heroku
    porta = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=porta, debug=True)
