# erppadrao - manutencao/app_manutencao.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

manutencao_blueprint = Blueprint('manutencao_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@manutencao_blueprint.route('/manutencao')
def pagina_manutencao():
    with open('manutencao/manutencao.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@manutencao_blueprint.route('/api/manutencao/abrir', methods=['POST'])
def api_abrir_os():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Cria o livro de registros de Ordens de Serviço técnico-industriais se não existir no Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livro_manutencao_os (
            id SERIAL PRIMARY KEY, equipe_id TEXT, maquina_id INTEGER,
            maquina_nome_suporte TEXT, mnt_descricao TEXT, mnt_tipo TEXT,
            mnt_custo_pecas REAL, mnt_tempo_parada REAL, mnt_data TEXT,
            status_os TEXT DEFAULT 'Aberta'
        )
    ''')
    
    cursor.execute('''
        INSERT INTO livro_manutencao_os (equipe_id, maquina_id, maquina_nome_suporte, 
        mnt_descricao, mnt_tipo, mnt_custo_pecas, mnt_tempo_parada, mnt_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['maquina_id'], dados['maquina_nome_suporte'], dados['mnt_descricao'],
          dados['mnt_tipo'], float(dados['mnt_custo_pecas']), float(dados['mnt_tempo_parada']), dados['mnt_data']))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@manutencao_blueprint.route('/api/manutencao/listar', methods=['GET'])
def api_listar_chamados():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    cursor.execute('SELECT * FROM livro_manutencao_os WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@manutencao_blueprint.route('/api/manutencao/finalizar/<int:id_reg>', methods=['POST'])
def api_finalizar_os_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # Busca a OS em aberto para computar e debitar as despesas no Caixa Geral
    cursor.execute('SELECT * FROM livro_manutencao_os WHERE id = %s AND equipe_id = %s AND status_os = \'Aberta\'', (id_reg, id_equipe))
    chamado = cursor.fetchone()
    
    if chamado:
        # 1. Altera status da OS para Finalizada
        cursor.execute('UPDATE livro_manutencao_os SET status_os = \'Finalizada\' WHERE id = %s', (id_reg,))
        
        # 2. CONTABILIDADE DE ATIVOS: Deduz os custos de manutenção diretamente do Caixa de Giro da simulação
        custo_pecas = float(chamado['mnt_custo_pecas'])
        descricao_caixa = f"Liquidação de OS Mnt #{id_reg} - Peças Ativo {chamado['maquina_nome_suporte']}"
        
        cursor.execute('''
            INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
            VALUES (%s, 'manutencao', %s, %s, 'DEBITO_MANUTENÇÃO')
        ''', (id_equipe, descricao_caixa, custo_pecas))
        
        # 3. CRONOANÁLISE ADICIONAL: Injeta o tempo de parada no horômetro geral do ativo mecânico
        cursor.execute('UPDATE ativos_maquinas SET horas_trabalhadas = horas_trabalhadas + %s WHERE id = %s', (float(chamado['mnt_tempo_parada']), chamado['maquina_id']))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})
