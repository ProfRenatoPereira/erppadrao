# erppadrao - estoque/app_estoque.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

estoque_blueprint = Blueprint('estoque_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@estoque_blueprint.route('/estoque')
def pagina_estoque():
    with open('estoque/estoque.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@estoque_blueprint.route('/api/estoque/salvar', methods=['POST'])
def api_salvar_estoque():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    produto_id = dados.get('produto_id')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de inventário físico de produtos acabados se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventario_acabados (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_id INTEGER,
            sku_suporte TEXT, nome_produto_suporte TEXT, quantidade_fisica REAL, 
            localizacao_armazem TEXT, custo_fabrica_ref REAL, lote_minimo_alerta REAL,
            UNIQUE(equipe_id, produto_id)
        )
    ''')

    # Utiliza ON CONFLICT para manter uma única posição de prateleira e saldo físico consolidado por SKU
    cursor.execute('''
        INSERT INTO inventario_acabados (equipe_id, produto_id, sku_suporte, 
        nome_produto_suporte, quantidade_fisica, localizacao_armazem, 
        custo_fabrica_ref, lote_minimo_alerta)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (equipe_id, produto_id) DO UPDATE SET
            sku_suporte = EXCLUDED.sku_suporte,
            nome_produto_suporte = EXCLUDED.nome_produto_suporte,
            quantidade_fisica = EXCLUDED.quantidade_fisica,
            localizacao_armazem = EXCLUDED.localizacao_armazem,
            custo_fabrica_ref = EXCLUDED.custo_fabrica_ref,
            lote_minimo_alerta = EXCLUDED.lote_minimo_alerta
    ''', (id_equipe, produto_id, dados['sku_suporte'], dados['nome_produto_suporte'],
          dados['quantidade_fisica'], dados['localizacao_armazem'], 
          dados['custo_fabrica_ref'], dados['lote_minimo_alerta']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@estoque_blueprint.route('/api/estoque/listar', methods=['GET'])
def api_listar_estoque():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM inventario_acabados WHERE equipe_id = %s ORDER BY sku_suporte ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for line in linhas])

@estoque_blueprint.route('/api/estoque/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_estoque_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM inventario_acabados WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    estoque = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not estoque: 
        return jsonify({'status': 'erro', 'message': 'Posição não localizada'}), 404
    return jsonify(dict(estoque))

@estoque_blueprint.route('/api/estoque/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_estoque(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    # Força a zeragem física do saldo em vez de remover o registro, mantendo a integridade do catálogo
    cursor.execute('UPDATE inventario_acabados SET quantidade_fisica = 0 WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
