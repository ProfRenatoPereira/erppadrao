# erppadrao - financeiro/app_financeiro.py (PARTE 1 DE 4)
from flask import Blueprint, request, render_template_string, session, jsonify, send_from_directory
from psycopg2.extras import RealDictCursor
import os

financeiro_blueprint = Blueprint('financeiro_blueprint', __name__)

def obter_conexao_master():
    """
    Delegates connection handling to the central GerenciadorCaixa to use the shared pool
    and consistent configuration (DATABASE_URL).
    """
    try:
        # Import locally to avoid circular import at module import time
        import GerenciadorCaixa
        conexao = GerenciadorCaixa.obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco via GerenciadorCaixa")
        return conexao
    except Exception as e:
        raise

@financeiro_blueprint.route('/financeiro')
def pagina_financeiro():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    with open('financeiro/financeiro.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@financeiro_blueprint.route('/financeiro/financeiro.js')
def servir_js_financeiro():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(diretorio_atual, 'financeiro.js', mimetype='application/javascript')
# erppadrao - financeiro/app_financeiro.py (PARTE 2 DE 4)

@financeiro_blueprint.route('/api/financeiro/faturar', methods=['POST'])
def api_faturar_titulo():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        dados = request.json
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
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
        ''', (str(id_equipe), int(dados.get('cliente_id', 0) or 0), dados.get('cliente_nome_suporte'), dados.get('financeiro_descricao'),
              float(dados.get('financeiro_valor', 0.0) or 0.0), dados.get('financeiro_condicao'), dados.get('financeiro_data')))
              
        conexao.commit()
        cursor.close()
        
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        try:
            if conexao:
                conexao.rollback()
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'status': 'erro', 'message': str(e)}), 500

@financeiro_blueprint.route('/api/financeiro/listar', methods=['GET'])
def api_listar_titulos():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS razao_financeiro (
                id SERIAL PRIMARY KEY, equipe_id TEXT, cliente_id INTEGER,
                cliente_nome_suporte TEXT, financeiro_descricao TEXT,
                financeiro_valor REAL, financeiro_condicao TEXT,
                financeiro_data TEXT, status_titulo TEXT DEFAULT 'Aberto'
            )
        ''')
        
        cursor.execute('SELECT * FROM razao_financeiro WHERE equipe_id = %s ORDER BY id DESC', (str(id_equipe),))
        linhas = cursor.fetchall()
        
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify([dict(linha) for linha in linhas]), 200
    except Exception as e:
        try:
            if conexao:
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'status': 'erro', 'message': str(e)}), 500
# erppadrao - financeiro/app_financeiro.py (PARTE 3 DE 4)

@financeiro_blueprint.route('/api/financeiro/liquidar/<int:id_reg>', methods=['POST'])
def api_liquidar_titulo_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS razao_financeiro (
                id SERIAL PRIMARY KEY, equipe_id TEXT, cliente_id INTEGER,
                cliente_nome_suporte TEXT, financeiro_descricao TEXT,
                financeiro_valor REAL, financeiro_condicao TEXT,
                financeiro_data TEXT, status_titulo TEXT DEFAULT 'Aberto'
            )
        ''')
        
        cursor.execute("SELECT * FROM razao_financeiro WHERE id = %s AND equipe_id = %s AND status_titulo = 'Aberto'", (int(id_reg), str(id_equipe)))
        titulo = cursor.fetchone()
        
        if titulo:
            cursor.execute("UPDATE razao_financeiro SET status_titulo = 'Liquidado' WHERE id = %s", (int(id_reg),))
            
            valor_recebimento = float(titulo['financeiro_valor'] or 0)
            descricao_caixa = f"Recebimento Duplicata FT-00{id_reg} - {titulo.get('financeiro_descricao', '')}"
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS fluxo_caixa (
                    id SERIAL PRIMARY KEY, equipe_id TEXT, departamento TEXT,
                    descricao TEXT, valor REAL, tipo TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
                )
            ''')
            
            cursor.execute('''
                INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
                VALUES (%s, 'financeiro', %s, %s, 'LIQUIDAÇÃO')
            ''', (str(id_equipe), descricao_caixa, valor_recebimento))
            
        conexao.commit()
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        try:
            if conexao:
                conexao.rollback()
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'status': 'erro', 'message': str(e)}), 500

@financeiro_blueprint.route('/api/financeiro/quota', methods=['POST'])
def api_salvar_quota_setorial():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        dados = request.json
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        depto = dados.get('departamento_id')
        porcentagem = float(dados.get('porcentagem_quota', 0))
        
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quotas_departamentos (
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT NOT NULL, 
                departamento_id TEXT NOT NULL,
                porcentagem_quota REAL,
                CONSTRAINT unique_equipe_depto UNIQUE (equipe_id, departamento_id)
            )
        ''')
        
        cursor.execute('''
            INSERT INTO quotas_departamentos (equipe_id, departamento_id, porcentagem_quota)
            VALUES (%s, %s, %s)
            ON CONFLICT (equipe_id, departamento_id) 
            DO UPDATE SET porcentagem_quota = EXCLUDED.porcentagem_quota
        ''', (str(id_equipe), str(depto), porcentagem))
        
        conexao.commit()
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        try:
            if conexao:
                conexao.rollback()
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'status': 'erro', 'message': str(e)}), 500
# erppadrao - financeiro/app_financeiro.py (PARTE 4 DE 4)

@financeiro_blueprint.route('/api/financeiro/quota/<string:depto_id>', methods=['GET'])
def api_buscar_quota_depto(depto_id):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quotas_departamentos (
                id SERIAL PRIMARY KEY, equipe_id TEXT, departamento_id TEXT,
                porcentagem_quota REAL, CONSTRAINT unique_equipe_depto_get UNIQUE(equipe_id, departamento_id)
            )
        ''')
        
        cursor.execute('SELECT porcentagem_quota FROM quotas_departamentos WHERE equipe_id = %s AND departamento_id = %s', (str(id_equipe), str(depto_id)))
        registro = cursor.fetchone()
        
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        
        if registro:
            return jsonify(dict(registro)), 200
        return jsonify({'porcentagem_quota': 0}), 200
    except Exception as e:
        try:
            if conexao:
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'porcentagem_quota': 0}), 200

@financeiro_blueprint.route('/api/financeiro/quotas/summary', methods=['GET'])
def api_obter_resumo_quotas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS quotas_departamentos (
                id SERIAL PRIMARY KEY, equipe_id TEXT, departamento_id TEXT,
                porcentagem_quota REAL, CONSTRAINT unique_equipe_depto_sum UNIQUE(equipe_id, departamento_id)
            )
        ''')
        
        cursor.execute('SELECT departamento_id, porcentagem_quota FROM quotas_departamentos WHERE equipe_id = %s AND porcentagem_quota > 0 ORDER BY porcentagem_quota DESC', (str(id_equipe),))
        linhas = cursor.fetchall()
        
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify([dict(l) for l in linhas]), 200
    except Exception:
        try:
            if conexao:
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify([]), 200

@financeiro_blueprint.route('/api/financeiro/metricas', methods=['GET'])
def api_obter_metrics_totais():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    try:
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS configuracao_equipes (
                id SERIAL PRIMARY KEY, equipe_id TEXT NOT NULL UNIQUE,
                capital_inicial REAL NOT NULL DEFAULT 0.00
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fluxo_caixa (
                id SERIAL PRIMARY KEY, equipe_id TEXT, departamento TEXT,
                descricao TEXT, valor REAL, tipo TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        capital_fundacao = 0.0
        cursor.execute('SELECT capital_inicial FROM configuracao_equipes WHERE equipe_id = %s', (str(id_equipe),))
        reg_conf = cursor.fetchone()
        if reg_conf:
            capital_fundacao = float(reg_conf['capital_inicial'] or 0)

        faturamento_bruto = 0.0
        fluxo_movimentado = 0.0
        
        cursor.execute("SELECT financeiro_valor FROM razao_financeiro WHERE equipe_id = %s AND status_titulo = 'Liquidado'", (str(id_equipe),))
        titulos_pagos = cursor.fetchall()
        for t in titulos_pagos:
            faturamento_bruto += float(t['financeiro_valor'] or 0)
            
        cursor.execute('SELECT valor FROM fluxo_caixa WHERE equipe_id = %s', (str(id_equipe),))
        movimentacoes = cursor.fetchall()
        for m in movimentacoes:
            fluxo_movimentado += float(m['valor'] or 0)
            
        capital_disponivel_total = capital_fundacao + fluxo_movimentado
        
        custo_fixo_geral = 0.0
        cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s AND tipo = 'CUSTO_FIXO'", (str(id_equipe),))
        res_custo = cursor.fetchone()
        if res_custo and res_custo['total']:
            custo_fixo_geral = float(res_custo['total'])
            
        cursor.close()
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        
        return jsonify({
            'capital_total': capital_fundacao,
            'capital_disponivel_total': capital_disponivel_total,
            'patrimonio_ativo_total': faturamento_bruto,
            'custo_fixo_geral_empresa': custo_fixo_geral,
            'custo_variavel_total': 0.0
        }), 200
    except Exception as e:
        try:
            if conexao:
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({
            'capital_total': 0.0,
            'capital_disponivel_total': 0.0,
            'patrimonio_ativo_total': 0.0,
            'custo_fixo_geral_empresa': 0.0,
            'custo_variavel_total': 0.0
        }), 200
