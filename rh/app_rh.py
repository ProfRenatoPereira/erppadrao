# erppadrao - rh/app_rh.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

rh_blueprint = Blueprint('rh_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@rh_blueprint.route('/rh')
def pagina_rh():
    with open('rh/rh.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@rh_blueprint.route('/api/rh/salvar', methods=['POST'])
def api_salvar_funcionario():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folha_funcionarios (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_colaborador TEXT,
            cargo_funcao TEXT, salario_base REAL, horas_extras INTEGER, desconto_vt TEXT
        )
    ''')

    custo_total_empresa = float(dados['salario_base']) * 1.28 + (float(dados['horas_extras']) * ((float(dados['salario_base'])/220)*1.5))

    if id_reg:
        cursor.execute('''
            UPDATE folha_funcionarios SET nome_colaborador=%s, cargo_funcao=%s, salario_base=%s, 
            horas_extras=%s, desconto_vt=%s WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_colaborador'], dados['cargo_funcao'], dados['salario_base'], 
              dados['horas_extras'], dados['desconto_vt'], id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO folha_funcionarios (equipe_id, nome_colaborador, cargo_funcao, salario_base, horas_extras, desconto_vt)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados['nome_colaborador'], dados['cargo_funcao'], dados['salario_base'], dados['horas_extras'], dados['desconto_vt']))
        
        # Debita a provisão salarial inicial no fluxo de caixa geral do erppadrao
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'rh', %s, %s, 'PROVISAO_MOD')
        ''', (id_equipe, f"Admissão de Colaborador {dados['nome_colaborador']}", custo_total_empresa))

    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@rh_blueprint.route('/api/rh/listar', methods=['GET'])
def api_listar_funcionarios():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM folha_funcionarios WHERE equipe_id = %s ORDER BY nome_colaborador ASC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@rh_blueprint.route('/api/rh/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_funcionario_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM folha_funcionarios WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    func = cursor.fetchone()
    cursor.close()
    conexao.close()
    return jsonify(dict(func) if func else {'status': 'erro'})

@rh_blueprint.route('/api/rh/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_funcionario(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    cursor.execute('DELETE FROM folha_funcionarios WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
