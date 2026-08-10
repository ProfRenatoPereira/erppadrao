# erppadrao - orcamentos/app_orcamentos.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

orcamentos_blueprint = Blueprint('orcamentos_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@orcamentos_blueprint.route('/orcamentos')
def pagina_orcamentos():
    with open('orcamentos/orcamentos.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@orcamentos_blueprint.route('/api/orcamentos/salvar', methods=['POST'])
def api_salvar_orcamento():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS propostas_orcamentos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_id INTEGER,
            sku_suporte TEXT, cliente_id INTEGER, cliente_nome_suporte TEXT,
            quantidade INTEGER, total_proposto REAL
        )
    ''')
    
    cursor.execute('''
        INSERT INTO propostas_orcamentos (equipe_id, produto_id, sku_suporte, cliente_id, cliente_nome_suporte, quantidade, total_proposto)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['produto_id'], dados['sku_suporte'], dados['cliente_id'], dados['cliente_nome_suporte'], int(dados['quantidade']), float(dados['total_proposto'])))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@orcamentos_blueprint.route('/api/orcamentos/listar', methods=['GET'])
def api_listar_orcamentos():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM propostas_orcamentos WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@orcamentos_blueprint.route('/api/orcamentos/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_orcamento(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    cursor.execute('DELETE FROM propostas_orcamentos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
