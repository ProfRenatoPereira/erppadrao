# erppadrao - financeiro/app_financeiro.py
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
        # Return connection to pool
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        try:
            if conexao:
                conexao.rollback()
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
            
            # Inserir como entrada positiva (convenção: entrada = valor positivo)
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

# erppadrao - financeiro/app_financeiro.py (Trecho Corrigido de Salvamento de Quotas)

@financeiro_blueprint.route('/api/financeiro/quota', methods=['POST'])
def api_salvar_quota_setorial():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    try:
        dados = request.json
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        depto = dados.get('departamento_id')
        porcentagem = float(dados.get('porcentagem_quota', 0))
        
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        # Garante a criação com a CONSTRAINT composta explicita
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
        conexao.close()
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        # Previne o erro 500 caso o banco esteja travado, retornando o log para o JS ler
        return jsonify({'status': 'erro', 'message': str(e)}), 200

    except Exception as e:
        try:
            if conexao:
                conexao.rollback()
                import GerenciadorCaixa
                GerenciadorCaixa.liberar_conexao_master(conexao)
        except Exception:
            pass
        return jsonify({'status': 'erro', 'message': str(e)}), 500

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
                porcentagem_quota REAL, UNIQUE(equipe_id, departamento_id)
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
                porcentagem_quota REAL, UNIQUE(equipe_id, departamento_id)
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


        # 5. Calcula Capital Disponível (Capital Total - Soma exata dos Valores Calculados em Dinheiro)
        try:
            # Substitui a matemática percentual volátil pela soma limpa do dinheiro retido no Supabase
            cursor.execute("""
                SELECT COALESCE(SUM(valor_calculado), 0.00) 
                FROM public.quotas_departamentos 
                WHERE equipe_id = %s
            """, (str(id_equipe),))
            res_q = cursor.fetchone()
            
            # Garante a extração correta independente do tipo retornado pelo driver psycopg2
            valor_quotas_reservadas = float(res_q[0]) if res_q and res_q[0] is not None else 0.00
            
            # Fallback de segurança caso a sua coluna física ainda armazene apenas as porcentagens (ex: 50.0)
            if valor_quotas_reservadas < 100.0 and valor_quotas_reservadas > 0:
                valor_quotas_reservadas = (valor_quotas_reservadas / 100.0) * capital_total
            
            capital_disponivel = capital_total - valor_quotas_reservadas
            if capital_disponivel < 0:
                capital_disponivel = 0.00
        except Exception:
            # Garante que o fallback mantenha o Capital Total íntegro sem zerar o card visual
            capital_disponivel = capital_total
