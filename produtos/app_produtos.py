# erppadrao - produtos/app_produtos.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

produtos_blueprint = Blueprint('produtos_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@produtos_blueprint.route('/produtos')
def pagina_produtos():
    with open('produtos/produtos.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@produtos_blueprint.route('/api/produtos/salvar', methods=['POST'])
def api_salvar_produto():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de engenharia e catálogo de produtos finais se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS catalogo_produtos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_produto TEXT, 
            sku_produto TEXT, unidade_venda TEXT, insumo_id INTEGER, 
            insumo_name_suporte TEXT, quantidade_insumo_gasta REAL, 
            custo_ref_material REAL, custo_material_bom REAL,
            UNIQUE(equipe_id, sku_produto)
        )
    ''')

    if id_reg:
        cursor.execute('''
            UPDATE catalogo_produtos SET nome_produto=%s, sku_produto=%s, 
            unidade_venda=%s, insumo_id=%s, insumo_name_suporte=%s, 
            quantidade_insumo_gasta=%s, custo_ref_material=%s, custo_material_bom=%s 
            WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_produto'], dados['sku_produto'], dados['unidade_venda'], 
              dados['insumo_id'], dados['insumo_name_suporte'], dados['quantidade_insumo_gasta'], 
              dados['custo_ref_material'], dados['custo_material_bom'], id_reg, id_equipe))
    else:
        try:
            cursor.execute('''
                INSERT INTO catalogo_produtos (equipe_id, nome_produto, sku_produto, 
                unidade_venda, insumo_id, insumo_name_suporte, quantidade_insumo_gasta, 
                custo_ref_material, custo_material_bom)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados['nome_produto'], dados['sku_produto'], dados['unidade_venda'], 
                  dados['insumo_id'], dados['insumo_name_suporte'], dados['quantidade_insumo_gasta'], 
                  dados['custo_ref_material'], dados['custo_material_bom']))
        except psycopg2.IntegrityError:
            conexao.rollback()
            cursor.close()
            conexao.close()
            return jsonify({'status': 'erro', 'message': 'Este código SKU já está homologado no catálogo.'}), 400
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@produtos_blueprint.route('/api/produtos/listar', methods=['GET'])
def api_listar_produtos():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM catalogo_produtos WHERE equipe_id = %s ORDER BY sku_produto ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@produtos_blueprint.route('/api/produtos/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_produto_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM catalogo_produtos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    produto = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not produto: 
        return jsonify({'status': 'erro', 'message': 'Produto não localizado'}), 404
    return jsonify(dict(produto))

@produtos_blueprint.route('/api/produtos/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_produto(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM catalogo_produtos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
