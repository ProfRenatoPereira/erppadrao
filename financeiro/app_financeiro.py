# erppadrao - financeiro/app_financeiro.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

financeiro_blueprint = Blueprint('financeiro_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@financeiro_blueprint.route('/financeiro')
def pagina_financeiro():
    if not session.get('logado'):
        # Redireciona de forma segura se o token de turno expirou
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    with open('financeiro/financeiro.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@financeiro_blueprint.route('/api/financeiro/faturar', methods=['POST'])
def api_faturar_titulo():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Cria a estrutura do razão no banco Supabase se ainda não houver
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS razao_financeiro (
            id SERIAL PRIMARY KEY, equipe_id TEXT, cliente_id INTEGER,
            cliente_nome_suporte TEXT, financeiro_descricao TEXT,
            financeiro_valor REAL, financeiro_condicao TEXT,
            financeiro_data TEXT, status_titulo TEXT DEFAULT 'Aberto'
        )
    ''')
    
    cursor.execute('''
        INSERT INTO razao_financeiro (equipe_id, cliente_id, cliente_nome_suporte, 
        financeiro_descricao, financeiro_valor, financeiro_condicao, financeiro_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, int(dados['cliente_id']), dados['cliente_nome_suporte'], dados['financeiro_descricao'],
          float(dados['financeiro_valor']), dados['financeiro_condicao'], dados['financeiro_data']))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@financeiro_blueprint.route('/api/financeiro/listar', methods=['GET'])
def api_listar_titulos():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM razao_financeiro WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@financeiro_blueprint.route('/api/financeiro/liquidar/<int:id_reg>', methods=['POST'])
def api_liquidar_titulo_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute('SELECT * FROM razao_financeiro WHERE id = %s AND equipe_id = %s AND status_titulo = \'Aberto\'', (id_reg, id_equipe))
    titulo = cursor.fetchone()
    
    if titulo:
        cursor.execute('UPDATE razao_financeiro SET status_titulo = \'Liquidado\' WHERE id = %s', (id_reg,))
        
        valor_recebimento = float(titulo['financeiro_valor'])
        descricao_caixa = f"Recebimento Duplicata FT-00{id_reg} - {titulo['financeiro_descricao']}"
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fluxo_caixa (
                id SERIAL PRIMARY KEY, equipe_id TEXT, departamento TEXT,
                descricao TEXT, valor REAL, tipo TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'financeiro', %s, %s, 'LIQUIDAÇÃO')
        ''', (id_equipe, descricao_caixa, -valor_recebimento))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

# =========================================================================
# LÓGICA DE INTEGRAÇÃO DAS MÉTRICAS REATIVAS (UNIFICAÇÃO COM FUNDAÇÃO DE CAPITAL)
# =========================================================================

@financeiro_blueprint.route('/api/financeiro/metrics', methods=['GET'])
def api_obter_metrics_totais():
    """Calcula e retorna os valores dos cards do topo unificando com o capital inicial"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # 1. Captura o Capital de Fundação direto da tabela de equipes vinculada
    capital_inicial = 0.0
    try:
        cursor.execute('SELECT capital_inicial FROM configuracao_equipes WHERE equipe_id = %s', (id_equipe,))
        reg_conf = cursor.fetchone()
        if reg_conf:
            capital_inicial = float(reg_conf['capital_inicial'])
    except Exception:
        pass

    # 2. Consolida o Faturamento total bruto com base em liquidações físicas em caixa
    faturamento_consolidado = 0.0
    fluxo_movimentado = 0.0
    
    try:
        cursor.execute('SELECT financeiro_valor FROM razao_financeiro WHERE equipe_id = %s AND status_titulo = \'Liquidado\'', (id_equipe,))
        titulos_pagos = cursor.fetchall()
        for t in titulos_pagos:
            faturamento_consolidado += float(t['financeiro_valor'])
            
        cursor.execute('SELECT valor FROM fluxo_caixa WHERE equipe_id = %s', (id_equipe,))
        movimentacoes = cursor.fetchall()
        for m in movimentacoes:
            # Multiplicado por -1 devido à inversão de sinal padronizada do caixa original
            fluxo_movimentado += (float(m['valor']) * -1)
    except Exception:
        pass
        
    capital_total_disponivel = capital_inicial + fluxo_movimentado
    
    cursor.close()
    conexao.close()
    return jsonify({
        'capital_total': capital_total_disponivel,
        'faturamento_consolidado': faturamento_consolidado
    })

@financeiro_blueprint.route('/api/financeiro/quota', methods=['POST'])
def api_salvar_quota_setorial():
    """Grava as alocações em porcentagem das 20 rotas funcionais ativas"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    depto = dados.get('departamento_id')
    porcentagem = float(dados.get('porcentagem_quota', 0))
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quotas_departamentos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, departamento_id TEXT,
            porcentagem_quota REAL, UNIQUE(equipe_id, departamento_id)
        )
    ''')
    
    cursor.execute('''
        INSERT INTO quotas_departamentos (equipe_id, departamento_id, porcentagem_quota)
        VALUES (%s, %s, %s)
        ON CONFLICT (equipe_id, departamento_id) 
        DO UPDATE SET porcentagem_quota = EXCLUDED.porcentagem_quota
    ''', (id_equipe, depto, porcentagem))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@financeiro_blueprint.route('/api/financeiro/quota/<string:depto_id>', methods=['GET'])
def api_buscar_quota_depto(depto_id):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute('SELECT porcentagem_quota FROM quotas_departamentos WHERE equipe_id = %s AND departamento_id = %s', (id_equipe, depto_id))
        registro = cursor.fetchone()
        if registro:
            return jsonify(dict(registro)), 200
    except Exception:
        pass
        
    cursor.close()
    conexao.close()
    return jsonify({'porcentagem_quota': 0}), 200

@financeiro_blueprint.route('/api/financeiro/quotas/summary', methods=['GET'])
def api_obter_resumo_quotas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute('SELECT departamento_id, porcentagem_quota FROM quotas_departamentos WHERE equipe_id = %s AND porcentagem_quota > 0 ORDER BY porcentagem_quota DESC', (id_equipe,))
        linhas = cursor.fetchall()
        return jsonify([dict(l) for l in linhas]), 200
    except Exception:
        return jsonify([]), 200
    finally:
        cursor.close()
        conexao.close()
