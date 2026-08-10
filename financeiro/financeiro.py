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
