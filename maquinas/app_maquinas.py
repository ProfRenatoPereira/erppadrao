# erppadrao - maquinas/app_maquinas.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

maquinas_blueprint = Blueprint('maquinas_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@maquinas_blueprint.route('/maquinas')
def pagina_maquinas():
    with open('maquinas/maquinas.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@maquinas_blueprint.route('/api/maquinas/salvar', methods=['POST'])
def api_salvar_maquina():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a tabela de engenharia de ativos expandida se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ativos_maquinas (
            id SERIAL PRIMARY KEY, equipe_id TEXT, nome_equipamento TEXT, potencia REAL,
            consumo_eletrico REAL, consumo_agua REAL, consumo_gases REAL, velocidade TEXT,
            avanco TEXT, comprimento_max REAL, diametro_max REAL, frequencia_manutencao INTEGER,
            horas_trabalhadas INTEGER, preco_compra REAL, depreciacao_mensal REAL, valor_venda_final REAL,
            operador_nome TEXT, custo_minuto_operador REAL, custo_minuto_maquina REAL
        )
    ''')

    if id_reg:
        cursor.execute('''
            UPDATE ativos_maquinas SET nome_equipamento=%s, potencia=%s, consumo_eletrico=%s, 
            consumo_agua=%s, consumo_gases=%s, velocidade=%s, avanco=%s, comprimento_max=%s, 
            diametro_max=%s, frequencia_manutencao=%s, horas_trabalhadas=%s, preco_compra=%s, 
            depreciacao_mensal=%s, valor_venda_final=%s, operador_nome=%s, custo_minuto_operador=%s, 
            custo_minuto_maquina=%s WHERE id=%s AND equipe_id=%s
        ''', (dados['nome_equipamento'], dados['potencia'], dados['consumo_eletrico'], 
              dados['consumo_agua'], dados['consumo_gases'], dados['velocidade'], dados['avanco'], 
              dados['comprimento_max'], dados['diametro_max'], dados['frequencia_manutencao'], 
              dados['horas_trabalhadas'], dados['preco_compra'], dados['depreciacao_mensal'], 
              dados['valor_venda_final'], dados['operador_nome'], dados['custo_minuto_operador'], 
              dados['custo_minuto_maquina'], id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO ativos_maquinas (equipe_id, nome_equipamento, potencia, consumo_eletrico, 
            consumo_agua, consumo_gases, velocidade, avanco, comprimento_max, diametro_max, 
            frequencia_manutencao, horas_trabalhadas, preco_compra, depreciacao_mensal, 
            valor_venda_final, operador_nome, custo_minuto_operador, custo_minuto_maquina)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados['nome_equipamento'], dados['potencia'], dados['consumo_eletrico'], 
              dados['consumo_agua'], dados['consumo_gases'], dados['velocidade'], dados['avanco'], 
              dados['comprimento_max'], dados['diametro_max'], dados['frequencia_manutencao'], 
              dados['horas_trabalhadas'], dados['preco_compra'], dados['depreciacao_mensal'], 
              dados['valor_venda_final'], dados['operador_nome'], dados['custo_minuto_operador'], 
              dados['custo_minuto_maquina']))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
@maquinas_blueprint.route('/api/maquinas/listar', methods=['GET'])
def api_listar_maquinas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM ativos_maquinas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@maquinas_blueprint.route('/api/maquinas/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_maquina_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM ativos_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    maquina = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not maquina: 
        return jsonify({'status': 'erro', 'message': 'Ativo não localizado'}), 404
    return jsonify(dict(maquina))

@maquinas_blueprint.route('/api/maquinas/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_maquina(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM ativos_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
