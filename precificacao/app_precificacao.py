# erppadrao - precificacao/app_precificacao.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

precificacao_blueprint = Blueprint('precificacao_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@precificacao_blueprint.route('/precificacao')
def pagina_precificacao():
    with open('precificacao/precificacao.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@precificacao_blueprint.route('/api/precificacao/salvar', methods=['POST'])
def api_salvar_precificacao():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    produto_id = dados.get('produto_id')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de controladoria e engenharia fiscal se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS controladoria_precos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_id INTEGER,
            sku_produto_suporte TEXT, nome_produto_suporte TEXT, custo_direto_base REAL,
            impostos_venda REAL, comissoes_venda REAL, margem_lucro REAL,
            markup_calculado REAL, preco_venda_sugerido REAL,
            UNIQUE(equipe_id, produto_id)
        )
    ''')

    # Sistema opera com substituição em ON CONFLICT para manter um preço único por SKU/Equipe
    cursor.execute('''
        INSERT INTO controladoria_precos (equipe_id, produto_id, sku_produto_suporte, 
        nome_produto_suporte, custo_direto_base, impostos_venda, comissoes_venda, 
        margem_lucro, markup_calculado, preco_venda_sugerido)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (equipe_id, produto_id) DO UPDATE SET
            sku_produto_suporte = EXCLUDED.sku_produto_suporte,
            nome_produto_suporte = EXCLUDED.nome_produto_suporte,
            custo_direto_base = EXCLUDED.custo_direto_base,
            impostos_venda = EXCLUDED.impostos_venda,
            comissoes_venda = EXCLUDED.comissoes_venda,
            margem_lucro = EXCLUDED.margem_lucro,
            markup_calculado = EXCLUDED.markup_calculado,
            preco_venda_sugerido = EXCLUDED.preco_venda_sugerido
    ''', (id_equipe, produto_id, dados['sku_produto_suporte'], dados['nome_produto_suporte'],
          dados['custo_direto_base'], dados['impostos_venda'], dados['comissoes_venda'],
          dados['margem_lucro'], dados['markup_calculado'], dados['preco_venda_sugerido']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@precificacao_blueprint.route('/api/precificacao/listar', methods=['GET'])
def api_listar_precificacoes():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM controladoria_precos WHERE equipe_id = %s ORDER BY sku_produto_suporte ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@precificacao_blueprint.route('/api/precificacao/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_precificacao(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM controladoria_precos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
