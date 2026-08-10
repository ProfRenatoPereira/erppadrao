# erppadrao - vendas/app_vendas.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

vendas_blueprint = Blueprint('vendas_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@vendas_blueprint.route('/vendas')
def pagina_vendas():
    with open('vendas/vendas.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@vendas_blueprint.route('/api/vendas/faturar', methods=['POST'])
def api_faturar_pedido():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    valor_liquido = float(dados.get('venda_valor_total', 0))
    descricao_transacao = f"Faturamento Ref. Pedido SKU {dados.get('produto_sku_suporte')}"
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # 1. Inicia a tabela de faturamento e carteira de pedidos comerciais se não existir
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registro_vendas (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_id INTEGER,
            produto_sku_suporte TEXT, cliente_id INTEGER, cliente_nome_suporte TEXT,
            venda_quantidade INTEGER, venda_desconto REAL, venda_obs_logistica TEXT,
            venda_valor_total REAL
        )
    ''')
    
    # 2. Grava a Nota Fiscal no Banco de Dados
    cursor.execute('''
        INSERT INTO registro_vendas (equipe_id, produto_id, produto_sku_suporte, 
        cliente_id, cliente_nome_suporte, venda_quantidade, venda_desconto, 
        venda_obs_logistica, venda_valor_total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['produto_id'], dados['produto_sku_suporte'], dados['cliente_id'],
          dados['cliente_nome_suporte'], dados['venda_quantidade'], dados['venda_desconto'],
          dados['venda_obs_logistica'], valor_liquido))
          
    # 3. ABORDAGEM TRABALHISTA/FINANCEIRA: Realiza a Entrada de Receita Comercial
    # Tipo 'RECEITA' entra subtraindo do total_gasto no GerenciadorCaixa (valor negativo para o SUM diminuir os gastos)
    cursor.execute('''
        INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
        VALUES (%s, 'vendas', %s, %s, 'RECEITA')
    ''', (id_equipe, descricao_transacao, -valor_liquido))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@vendas_blueprint.route('/api/vendas/listar', methods=['GET'])
def api_listar_vendas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM registro_vendas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@vendas_blueprint.route('/api/vendas/estornar/<int:id_reg>', methods=['DELETE'])
def api_estornar_venda(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # Localiza a venda para saber o valor exato a ser retirado do caixa de giro
    cursor.execute('SELECT * FROM registro_vendas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    venda = cursor.fetchone()
    
    if venda:
        descricao_estorno = f"Estorno Legal Ref. NF-00{id_reg}"
        # Deleta a Nota Fiscal do histórico
        cursor.execute('DELETE FROM registro_vendas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        # Insere uma contrapartida de débito no caixa para anular o ganho anterior
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'vendas', %s, %s, 'ESTORNO')
        ''', (id_equipe, descricao_estorno, float(venda['venda_valor_total'])))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
