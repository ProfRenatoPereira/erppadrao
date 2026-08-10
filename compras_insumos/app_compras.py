# erppadrao - compras/app_compras.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

compras_blueprint = Blueprint('compras_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@compras_blueprint.route('/compras')
def pagina_compras():
    with open('compras/compras.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@compras_blueprint.route('/api/compras/salvar', methods=['POST'])
def api_salvar_compra():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    valor_lote_total = float(dados['compras_preco']) * int(dados['compras_quantidade'])
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registro_compras_suprimentos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, compras_termo_busca TEXT,
            compras_consumo_eletrico REAL, compras_consumo_gases REAL,
            compras_consumo_agua REAL, compras_potencia REAL,
            compras_avanco TEXT, compras_quantidade INTEGER, compras_preco REAL
        )
    ''')
    
    cursor.execute('''
        INSERT INTO registro_compras_suprimentos (equipe_id, compras_termo_busca, 
        compras_consumo_eletrico, compras_consumo_gases, compras_consumo_agua, 
        compras_potencia, compras_avanco, compras_quantidade, compras_preco)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['compras_termo_busca'], dados['compras_consumo_eletrico'],
          dados['compras_consumo_gases'], dados['compras_consumo_agua'], dados['compras_potencia'],
          dados['compras_avanco'], int(dados['compras_quantidade']), float(dados['compras_preco'])))
          
    # Realiza o débito imediato no Caixa Operacional da equipe
    cursor.execute('''
        INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
        VALUES (%s, 'compras', %s, %s, 'DEBITO_AQUISICAO')
    ''', (id_equipe, f"Aquisição de Lote: {dados['compras_termo_busca']}", valor_lote_total))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@compras_blueprint.route('/api/compras/listar', methods=['GET'])
def api_listar_compras():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM registro_compras_suprimentos WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@compras_blueprint.route('/api/compras/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_compra(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # Seleciona para estornar o valor de caixa correspondente
    cursor.execute('SELECT * FROM registro_compras_suprimentos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    compra = cursor.fetchone()
    
    if compra:
        valor_estorno = float(compra['compras_preco']) * int(compra['compras_quantidade'])
        cursor.execute('DELETE FROM registro_compras_suprimentos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'compras', %s, %s, 'ESTORNO_AQUISICAO')
        ''', (id_equipe, f"Estorno de Compra: {compra['compras_termo_busca']}", -valor_estorno))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
