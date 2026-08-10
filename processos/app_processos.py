# erppadrao - processos/app_processos.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

processos_blueprint = Blueprint('processos_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@processos_blueprint.route('/processos')
def pagina_processos():
    with open('processos/processos.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@processos_blueprint.route('/api/processos/salvar', methods=['POST'])
def api_salvar_processo():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de engenharia de processos (Roteiro e Cronoanálise) no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS engenharia_processos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_operacao TEXT, 
            maquina_id INTEGER, maquina_name_suporte TEXT, tempo_setup REAL, 
            tempo_operacao REAL, custo_ref_maquina REAL, sequencia_op INTEGER, 
            custo_total_operacao REAL
        )
    ''')

    if id_reg:
        cursor.execute('''
            UPDATE engenharia_processos SET nome_operacao=%s, maquina_id=%s, 
            maquina_name_suporte=%s, tempo_setup=%s, tempo_operacao=%s, 
            custo_ref_maquina=%s, sequencia_op=%s, custo_total_operacao=%s 
            WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_operacao'], dados['maquina_id'], dados['maquina_nome_suporte'], 
              dados['tempo_setup'], dados['tempo_operacao'], dados['custo_ref_maquina'], 
              dados['sequencia_op'], dados['custo_total_operacao'], id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO engenharia_processos (equipe_id, nome_operacao, maquina_id, 
            maquina_name_suporte, tempo_setup, tempo_operacao, custo_ref_maquina, 
            sequencia_op, custo_total_operacao)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados['nome_operacao'], dados['maquina_id'], dados['maquina_nome_suporte'], 
              dados['tempo_setup'], dados['tempo_operacao'], dados['custo_ref_maquina'], 
              dados['sequencia_op'], dados['custo_total_operacao']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@processos_blueprint.route('/api/processos/listar', methods=['GET'])
def api_listar_processos():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    # Ordena sequencialmente pelas fases operacionais informadas pelos estudantes (Ex: Op 10, Op 20...)
    cursor.execute('SELECT * FROM engenharia_processos WHERE equipe_id = %s ORDER BY sequencia_op ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@processos_blueprint.route('/api/processos/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_processo_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM engenharia_processos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    processo = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not processo: 
        return jsonify({'status': 'erro', 'message': 'Operação não localizada'}), 404
    return jsonify(dict(processo))

@processos_blueprint.route('/api/processos/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_processo(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM engenharia_processos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
