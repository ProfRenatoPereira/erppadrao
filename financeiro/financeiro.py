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
    
    # Cria o razão contábil se não existir no Supabase
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
    ''', (id_equipe, dados['cliente_id'], dados['cliente_nome_suporte'], dados['financeiro_descricao'],
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
    
    # Busca o título em aberto para processar a entrada física no caixa
    cursor.execute('SELECT * FROM razao_financeiro WHERE id = %s AND equipe_id = %s AND status_titulo = \'Aberto\'', (id_reg, id_equipe))
    titulo = cursor.fetchone()
    
    if titulo:
        # 1. Muda o status para Liquidado
        cursor.execute('UPDATE razao_financeiro SET status_titulo = \'Liquidado\' WHERE id = %s', (id_reg,))
        
        # 2. Injeta a entrada real positiva no caixa de giro (valor negativo para deduzir despesas no SUM geral)
        valor_recebimento = float(titulo['financeiro_valor'])
        descricao_caixa = f"Recebimento Duplicata FT-00{id_reg} - {titulo['financeiro_descricao']}"
        
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'financeiro', %s, %s, 'LIQUIDAÇÃO')
        ''', (id_equipe, descricao_caixa, -valor_recebimento))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
