# erppadrao - materiais/app_materiais.py - PARTE 1 DE 3
import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

materiais_blueprint = Blueprint('materiais_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@materiais_blueprint.route('/materiais', methods=['GET'])
def pagina_materiais():
    if not session.get('logado'): return redirect('/login')
    if not session.get('empresa_inicializada'): return redirect('/configuracao/inicializacao')
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'materiais.html')
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f: html = f.read()
        return render_template_string(html)
    except FileNotFoundError: return "Erro Crítico: Arquivo 'materiais.html' oculto.", 404

@materiais_blueprint.route('/materiais/materiais.js', methods=['GET'])
def rota_materiais_js():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'materiais.js')
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f: js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError: return "console.error('Script offline.');", 404
# erppadrao - materiais/app_materiais.py - PARTE 2 DE 3

@materiais_blueprint.route('/api/materiais/listar', methods=['GET'])
def api_listar_materiais():
    if not session.get('logado'): return jsonify([]), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # MIGRATION DDL INJETADA: Cria a tabela física homologada com suporte dimensional real
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS erp_materiais (
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT, 
                nome_material TEXT, 
                codigo_sku TEXT,
                categoria TEXT,
                unidade_medida TEXT, 
                preco_unitario REAL, 
                coeficiente_refugo REAL, 
                lead_time_entrega INTEGER, 
                estoque_seguranca REAL,
                fornecedor_padrao TEXT,
                especificacao_tecnica TEXT,
                dim_diametro TEXT,
                dim_espessura TEXT,
                dim_comprimento REAL,
                custo_total_integrado REAL
            )
        ''');
        conexao.commit()
        
        cursor.execute('SELECT * FROM erp_materiais WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        return jsonify(cursor.fetchall())
    except psycopg2.DatabaseError: return jsonify([]), 200
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# erppadrao - materiais/app_materiais.py - PARTE 3 DE 3

@materiais_blueprint.route('/api/materiais/salvar', methods=['POST'])
def api_salvar_material():
    if not session.get('logado'): return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json or {}
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        nome_mat = dados.get('nome_material', '').strip()
        cod_sku = dados.get('codigo_sku', '').strip()
        cat_mat = dados.get('categoria', '').strip()
        un_medida = dados.get('unidade_medida', 'kg')
        espec = dados.get('especificacao_tecnica', '').strip()
        forn_padrao = dados.get('fornecedor_padrao', '').strip()
        
        preco_un = float(str(dados.get('preco_unitario', 0)).replace(',', '.').strip())
        estoque_seg = float(str(dados.get('estoque_seguranca', 0)).replace(',', '.').strip())
        refugo_pad = float(str(dados.get('coeficiente_refugo', 0)).replace(',', '.').strip())
        l_time = int(dados.get('lead_time_entrega', 0))

        # Atributos geométricos sanitizados para balanço de massa volumétrica
        dim_diametro = dados.get('dim_diametro', '0')
        dim_espessura = dados.get('dim_espessura', '0')
        dim_comprimento = float(str(dados.get('dim_comprimento', 0)).replace(',', '.').strip())
        custo_total_integrado = float(str(dados.get('custo_total_integrado', 0)).replace(',', '.').strip())

        if not nome_mat: return "Erro: Nome do material é obrigatório.", 400

        if id_reg:
            cursor.execute('''
                UPDATE erp_materiais SET 
                    nome_material=%s, codigo_sku=%s, categoria=%s, unidade_medida=%s, preco_unitario=%s,
                    estoque_seguranca=%s, lead_time_entrega=%s, fornecedor_padrao=%s, 
                    coeficiente_refugo=%s, especificacao_tecnica=%s, dim_diametro=%s,
                    dim_espessura=%s, dim_comprimento=%s, custo_total_integrado=%s
                WHERE id=%s AND equipe_id=%s
            ''', (nome_mat, cod_sku, cat_mat, un_medida, preco_un, estoque_seg, l_time, forn_padrao, refugo_pad, espec, dim_diametro, dim_espessura, dim_comprimento, custo_total_integrado, id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO erp_materiais (
                    equipe_id, nome_material, codigo_sku, categoria, unidade_medida, preco_unitario,
                    estoque_seguranca, lead_time_entrega, fornecedor_padrao, coeficiente_refugo, especificacao_tecnica,
                    dim_diametro, dim_espessura, dim_comprimento, custo_total_integrado
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, nome_mat, cod_sku, cat_mat, un_medida, preco_un, estoque_seg, l_time, forn_padrao, refugo_pad, espec, dim_diametro, dim_espessura, dim_comprimento, custo_total_integrado))

        conexao.commit()
        return jsonify({'status': 'sucesso'}), 200
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro transacional ao salvar material: {e}")
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@materiais_blueprint.route('/api/materiais/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_material_id(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM erp_materiais WHERE id = %s AND equipe_id = %s', (id_reg, session.get('id_equipe', 'equipe_alfa')))
        m = cursor.fetchone()
        return jsonify(dict(m)) if m else (jsonify({'status': 'erro'}), 404)
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@materiais_blueprint.route('/api/materiais/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_material(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        cursor.execute('DELETE FROM erp_materiais WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        conexao.commit()
        return jsonify({'status': 'removido'}), 200
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro transacional ao deletar material: {e}")
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
