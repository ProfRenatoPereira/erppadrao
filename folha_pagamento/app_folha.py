# erppadrao - folha_pagamento/app_folha.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

folha_blueprint = Blueprint('folha_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@folha_blueprint.route('/folha_pagamento')
def pagina_folha():
    with open('folha_pagamento/folha.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@folha_blueprint.route('/api/folha/salvar', methods=['POST'])
def api_salvar_holerite():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livro_razonete_folha (
            id SERIAL PRIMARY KEY, equipe_id TEXT, funcionario_id INTEGER,
            funcionario_nome_suporte TEXT, salario_base REAL, horas_extras INTEGER,
            valor_horas_extras REAL, desconto_inss REAL, desconto_vt REAL,
            valor_liquido REAL, encargos_patronais REAL,
            UNIQUE(equipe_id, funcionario_id)
        )
    ''')
    
    cursor.execute('''
        INSERT INTO livro_razonete_folha (equipe_id, funcionario_id, funcionario_nome_suporte, 
        salario_base, horas_extras, valor_horas_extras, desconto_inss, desconto_vt, 
        valor_liquido, encargos_patronais)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (equipe_id, funcionario_id) DO UPDATE SET
            salario_base = EXCLUDED.salario_base,
            horas_extras = EXCLUDED.horas_extras,
            valor_horas_extras = EXCLUDED.valor_horas_extras,
            desconto_inss = EXCLUDED.desconto_inss,
            desconto_vt = EXCLUDED.desconto_vt,
            valor_liquido = EXCLUDED.valor_liquido,
            encargos_patronais = EXCLUDED.encargos_patronais
    ''', (id_equipe, dados['funcionario_id'], dados['funcionario_nome_suporte'], float(dados['salario_base']),
          int(dados['horas_extras']), float(dados['valor_horas_extras']), float(dados['desconto_inss']),
          float(dados['desconto_vt']), float(dados['valor_liquido']), float(dados['encargos_patronais'])))
          
    # Debita o valor total do desembolso (Custo Real de Empresa = Líquido + Descontos + Provisão) do Caixa de Giro Geral
    custo_liquido_caixa = float(dados['valor_liquido']) + float(dados['encargos_patronais'])
    cursor.execute('''
        INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
        VALUES (%s, 'financeiro_folha', %s, %s, 'DEBITO_HOLERITE')
    ''', (id_equipe, f"Liquidacao e Fechamento de Holerite: {dados['funcionario_nome_suporte']}", custo_liquido_caixa))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@folha_blueprint.route('/api/folha/listar', methods=['GET'])
def api_listar_holerites():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM livro_razonete_folha WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for line in linhas])

@folha_blueprint.route('/api/folha/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_holerite(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute('SELECT * FROM livro_razonete_folha WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    hol = cursor.fetchone()
    
    if hol:
        custo_estorno = float(hol['valor_liquido']) + float(hol['encargos_patronais'])
        cursor.execute('DELETE FROM livro_razonete_folha WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'financeiro_folha', %s, %s, 'ESTORNO_HOLERITE')
        ''', (id_equipe, f"Estorno Contabil de Holerite: {hol['funcionario_nome_suporte']}", -custo_estorno))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
