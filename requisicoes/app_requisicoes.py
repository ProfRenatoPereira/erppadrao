# erppadrao - requisicoes/app_requisicoes.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

requisicoes_blueprint = Blueprint('requisicoes_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@requisicoes_blueprint.route('/requisicoes')
def pagina_requisicoes():
    with open('requisicoes/requisicoes.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@requisicoes_blueprint.route('/api/requisicoes/lancar', methods=['POST'])
def api_lancar_requisicao():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livro_requisicoes_internas (
            id SERIAL PRIMARY KEY, equipe_id TEXT, material_id INTEGER,
            material_nome_suporte TEXT, req_quantidade REAL,
            req_destino TEXT, req_solicitante TEXT, status_req TEXT DEFAULT 'Pendente'
        )
    ''')
    
    cursor.execute('''
        INSERT INTO livro_requisicoes_internas (equipe_id, material_id, material_nome_suporte, 
        req_quantidade, req_destino, req_solicitante)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['material_id'], dados['material_nome_suporte'],
          float(dados['req_quantidade']), dados['req_destino'], dados['req_solicitante']))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@requisicoes_blueprint.route('/api/requisicoes/listar', methods=['GET'])
def api_listar_requisicoes():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM livro_requisicoes_internas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@requisicoes_blueprint.route('/api/requisicoes/atender/<int:id_reg>', methods=['POST'])
def api_atender_requisicao(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # Localiza a requisição pendente para processar o abatimento do Almoxarifado
    cursor.execute('SELECT * FROM livro_requisicoes_internas WHERE id = %s AND equipe_id = %s AND status_req = \'Pendente\'', (id_reg, id_equipe))
    req = cursor.fetchone()
    
    if req:
        # Puxa o saldo atual da matéria-prima correspondente na tabela de materiais (Fase 5)
        cursor.execute('SELECT quantidade_estoque FROM ativos_materiais WHERE id = %s AND equipe_id = %s', (req['material_id'], id_equipe))
        material = cursor.fetchone()
        
        if not material or float(material['quantidade_estoque']) < float(req['req_quantidade']):
            cursor.close()
            conexao.close()
            return jsonify({'status': 'erro', 'message': 'Saldo insuficiente no Almoxarifado para atender o volume solicitado.'}), 400
            
        # 1. Realiza o abatimento automático no estoque físico do Almoxarifado
        cursor.execute('UPDATE ativos_materiais SET quantidade_estoque = quantidade_estoque - %s WHERE id = %s', (float(req['req_quantidade']), req['material_id']))
        
        # 2. Transforma o status da requisição para Atendida
        cursor.execute('UPDATE livro_requisicoes_internas SET status_req = \'Atendida\' WHERE id = %s', (id_reg,))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
