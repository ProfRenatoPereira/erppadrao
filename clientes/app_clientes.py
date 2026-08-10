# erppadrao - clientes/app_clientes.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

clientes_blueprint = Blueprint('clientes_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@clientes_blueprint.route('/clientes')
def pagina_clientes():
    with open('clientes/clientes.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@clientes_blueprint.route('/api/clientes/salvar', methods=['POST'])
def api_salvar_cliente():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de CRM/Clientes se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS carteira_clientes (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_cliente TEXT, 
            tipo_pessoa TEXT, regiao_cliente TEXT, limite_credito REAL, 
            frequencia_demanda TEXT, contato_cliente TEXT
        )
    ''')

    if id_reg:
        cursor.execute('''
            UPDATE carteira_clientes SET nome_cliente=%s, tipo_pessoa=%s, regiao_cliente=%s, 
            limite_credito=%s, frequencia_demanda=%s, contato_cliente=%s 
            WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_cliente'], dados['tipo_pessoa'], dados['regiao_cliente'], 
              dados['limite_credito'], dados['frequencia_demanda'], dados['contato_cliente'], 
              id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO carteira_clientes (equipe_id, nome_cliente, tipo_pessoa, regiao_cliente, 
            limite_credito, frequencia_demanda, contato_cliente)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados['nome_cliente'], dados['tipo_pessoa'], dados['regiao_cliente'], 
              dados['limite_credito'], dados['frequencia_demanda'], dados['contato_cliente']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@clientes_blueprint.route('/api/clientes/listar', methods=['GET'])
def api_listar_clientes():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM carteira_clientes WHERE equipe_id = %s ORDER BY nome_cliente ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@clientes_blueprint.route('/api/clientes/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_cliente_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM carteira_clientes WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    cliente = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not cliente: 
        return jsonify({'status': 'erro', 'message': 'Cliente não localizado'}), 404
    return jsonify(dict(cliente))

@clientes_blueprint.route('/api/clientes/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_cliente(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM carteira_clientes WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
