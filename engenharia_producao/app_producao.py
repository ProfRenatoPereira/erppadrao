# erppadrao - engenharia_producao/app_producao.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

producao_blueprint = Blueprint('producao_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@producao_blueprint.route('/engenharia_producao')
def pagina_producao():
    with open('engenharia_producao/producao.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@producao_blueprint.route('/api/producao/emitir', methods=['POST'])
def api_emitir_op_producao():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ordens_producao (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_id INTEGER,
            produto_sku_suporte TEXT, pcp_quantidade INTEGER,
            pcp_prioridade TEXT, pcp_data_limite TEXT, status_op TEXT DEFAULT 'Em Andamento'
        )
    ''')
    
    # EXPLOSÃO DA ARVORE DE COMPONENTES (BOM)
    cursor.execute('SELECT * FROM catalogo_produtos WHERE id = %s AND equipe_id = %s', (dados['produto_id'], id_equipe))
    produto = cursor.fetchone()
    
    if produto:
        insumo_id = produto['insumo_id']
        qtd_necessaria = float(produto['quantidade_insumo_gasta']) * int(dados['pcp_quantidade'])
        
        # Valida se há saldo no Almoxarifado (Fase 5)
        cursor.execute('SELECT quantidade_estoque FROM ativos_materiais WHERE id = %s AND equipe_id = %s', (insumo_id, id_equipe))
        material = cursor.fetchone()
        
        if not material or float(material['quantidade_estoque']) < qtd_necessaria:
            cursor.close()
            conexao.close()
            return jsonify({'status': 'erro', 'message': f"Almoxarifado desabastecido! Requer {qtd_necessaria} un de insumos, mas o saldo está baixo."}), 400
            
        # Baixa física automatizada de matérias-primas
        cursor.execute('UPDATE ativos_materiais SET quantidade_estoque = quantidade_estoque - %s WHERE id = %s', (qtd_necessaria, insumo_id))
    
    cursor.execute('''
        INSERT INTO ordens_producao (equipe_id, produto_id, produto_sku_suporte, pcp_quantidade, pcp_prioridade, pcp_data_limite)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['produto_id'], dados['produto_sku_suporte'], dados['pcp_quantidade'], dados['pcp_prioridade'], dados['pcp_data_limite']))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@producao_blueprint.route('/api/producao/listar', methods=['GET'])
def api_listar_ops_producao():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM ordens_producao WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@producao_blueprint.route('/api/producao/finalizar/<int:id_reg>', methods=['POST'])
def api_finalizar_op_producao(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute('SELECT * FROM ordens_producao WHERE id = %s AND equipe_id = %s AND status_op = \'Em Andamento\'', (id_reg, id_equipe))
    op = cursor.fetchone()
    
    if op:
        cursor.execute('UPDATE ordens_producao SET status_op = \'Finalizado\' WHERE id = %s', (id_reg,))
        
        # Abastecimento automático no Inventário de Acabados (Fase 8)
        cursor.execute('SELECT * FROM inventario_acabados WHERE produto_id = %s AND equipe_id = %s', (op['produto_id'], id_equipe))
        estoque = cursor.fetchone()
        
        if estoque:
            cursor.execute('UPDATE inventario_acabados SET quantidade_fisica = quantidade_fisica + %s WHERE id = %s', (op['pcp_quantidade'], estoque['id']))
        else:
            cursor.execute('SELECT nome_produto, custo_material_bom FROM catalogo_produtos WHERE id = %s', (op['produto_id'],))
            prod_ref = cursor.fetchone()
            nome_p = prod_ref['nome_produto'] if prod_ref else 'Item Final'
            custo_ref = prod_ref['custo_material_bom'] if prod_ref else 0.0
            
            cursor.execute('''
                INSERT INTO inventario_acabados (equipe_id, produto_id, sku_suporte, nome_produto_suporte, quantidade_fisica, localizacao_armazem, custo_fabrica_ref, lote_minimo_alerta)
                VALUES (%s, %s, %s, %s, %s, 'Depósito Central PCP', %s, 10)
            ''', (id_equipe, op['produto_id'], op['produto_sku_suporte'], nome_p, op['pcp_quantidade'], custo_ref))
            
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
