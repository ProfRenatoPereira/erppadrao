# erppadrao - materiais/app_materiais.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

materiais_blueprint = Blueprint('materiais_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@materiais_blueprint.route('/materiais')
def pagina_materiais():
    with open('materiais/materiais.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@materiais_blueprint.route('/api/materiais/salvar', methods=['POST'])
def api_salvar_material():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de almoxarifado/insumos se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ativos_materiais (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_material TEXT, 
            unidade_medida TEXT, classe_abc TEXT, quantidade_estoque REAL, 
            preco_unitario REAL, estoque_seguranca REAL, fornecedor_nome TEXT
        )
    ''')

    if id_reg:
        cursor.execute('''
            UPDATE ativos_materiais SET nome_material=%s, unidade_medida=%s, classe_abc=%s, 
            quantidade_estoque=%s, preco_unitario=%s, estoque_seguranca=%s, fornecedor_nome=%s 
            WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_material'], dados['unidade_medida'], dados['classe_abc'], 
              dados['quantidade_estoque'], dados['preco_unitario'], dados['estoque_seguranca'], 
              dados['fornecedor_nome'], id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO ativos_materiais (equipe_id, nome_material, unidade_medida, classe_abc, 
            quantidade_estoque, preco_unitario, estoque_seguranca, fornecedor_nome)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados['nome_material'], dados['unidade_medida'], dados['classe_abc'], 
              dados['quantidade_estoque'], dados['preco_unitario'], dados['estoque_seguranca'], 
              dados['fornecedor_nome']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@materiais_blueprint.route('/api/materiais/listar', methods=['GET'])
def api_listar_materiais():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM ativos_materiais WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@materiais_blueprint.route('/api/materiais/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_material_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM ativos_materiais WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    material = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not material: 
        return jsonify({'status': 'erro', 'message': 'Insumo não localizado'}), 404
    return jsonify(dict(material))

@materiais_blueprint.route('/api/materiais/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_material(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM ativos_materiais WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
