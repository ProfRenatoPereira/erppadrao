# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE ATIVOS (MÁQUINAS)
# APP PYTHON - PARTE 1 DE 3: CONFIGURAÇÃO DE BLUEPRINT E PAGINAÇÃO
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

maquinas_blueprint = Blueprint('maquinas_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@maquinas_blueprint.route('/maquinas', methods=['GET'])
def pagina_maquinas():
    if not session.get('logado'): return redirect('/login')
    if not session.get('empresa_inicializada'): return redirect('/configuracao/inicializacao')
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'maquinas.html')
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f: html = f.read()
        return render_template_string(html)
    except FileNotFoundError: return "Erro Crítico: Arquivo 'maquinas.html' oculto.", 404

@maquinas_blueprint.route('/maquinas/maquinas.js', methods=['GET'])
def rota_maquinas_js():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'maquinas.js')
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f: js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError: return "console.error('Script offline.');", 404
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE ATIVOS (MÁQUINAS)
# APP PYTHON - PARTE 2 DE 3: LISTAGEM E MIGRATION SÍNCRONA SUPABASE
# ==========================================================================

@maquinas_blueprint.route('/api/maquinas/listar', methods=['GET'])
def api_listar_maquinas():
    if not session.get('logado'): return jsonify([]), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. Garante a existência da estrutura base da tabela erp_maquinas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS erp_maquinas (
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT
            )
        ''')
        conexao.commit()
        
        # 2. Injeta as colunas dinâmicas em conformidade com o dicionário Javascript
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS nome_equipamento TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS potencia REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS consumo_eletrico REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS consumo_agua REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS consumo_gases REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS velocidade TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS avanco TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS frequencia_manutencao INTEGER;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS preco_compra REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS depreciacao_mensal REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS valor_venda_final REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS operador_nome TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS custo_minuto_operador REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS custo_minuto_maquina REAL;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS jornada_semanal TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS turnos_trabalho TEXT;")
        cursor.execute("ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS is_patrimonio BOOLEAN;")
        conexao.commit()
        
        # 3. Retorna a listagem indexada por equipe
        cursor.execute('SELECT * FROM erp_maquinas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        return jsonify(cursor.fetchall())
    except psycopg2.DatabaseError as e:
        print(f"[TERADMAS DB ATIVOS ERROR] Erro na readequação estrutural: {e}")
        return jsonify([]), 200
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE ATIVOS (MÁQUINAS)
# APP PYTHON - PARTE 3 DE 3: PERSISTÊNCIA CRUD E SISTEMA DE EXCLUSÃO
# ==========================================================================

@maquinas_blueprint.route('/api/maquinas/salvar', methods=['POST'])
def api_salvar_maquina():
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()

        nome_eq = dados.get('nome_equipamento', '').strip()
        if not nome_eq: return jsonify({'status': 'erro', 'message': 'Nome obrigatório'}), 400

        pot = float(dados.get('potencia', 0))
        c_ele = float(dados.get('consumo_eletrico', 0))
        c_agu = float(dados.get('consumo_agua', 0))
        c_gas = float(dados.get('consumo_gases', 0))
        vel = str(dados.get('velocidade', '')).strip()
        avc = str(dados.get('avanco', '')).strip()
        frq = int(dados.get('frequencia_manutencao', 0))
        prc = float(dados.get('preco_compra', 0))
        dep = float(dados.get('depreciacao_mensal', 0))
        rsd = float(dados.get('valor_venda_final', 0))
        op_n = dados.get('operador_nome', '').strip()
        c_op = float(dados.get('custo_minuto_operador', 0))
        c_mq = float(dados.get('custo_minuto_maquina', 0))
        jor = str(dados.get('jornada_semanal', '44')).strip()
        tur = str(dados.get('turnos_trabalho', '1')).strip()
        isp = bool(dados.get('is_patrimonio', True))

        if id_reg:
            cursor.execute('''
                UPDATE erp_maquinas SET 
                    nome_equipamento=%s, potencia=%s, consumo_eletrico=%s, consumo_agua=%s, consumo_gases=%s,
                    velocidade=%s, avanco=%s, frequencia_manutencao=%s, preco_compra=%s, depreciacao_mensal=%s,
                    valor_venda_final=%s, operador_nome=%s, custo_minuto_operador=%s, custo_minuto_maquina=%s,
                    jornada_semanal=%s, turnos_trabalho=%s, is_patrimonio=%s
                WHERE id=%s AND equipe_id=%s
            ''', (nome_eq, pot, c_ele, c_agu, c_gas, vel, avc, frq, prc, dep, rsd, op_n, c_op, c_mq, jor, tur, isp, id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO erp_maquinas (
                    equipe_id, nome_equipamento, potencia, consumo_eletrico, consumo_agua, consumo_gases,
                    velocidade, avanco, frequencia_manutencao, preco_compra, depreciacao_mensal,
                    valor_venda_final, operador_nome, custo_minuto_operador, custo_minuto_maquina,
                    jornada_semanal, turnos_trabalho, is_patrimonio
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, nome_eq, pot, c_ele, c_agu, c_gas, vel, avc, frq, prc, dep, rsd, op_n, c_op, c_mq, jor, tur, isp))
            
        conexao.commit()
        return jsonify({'status': 'sucesso'}), 200
    except Exception as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@maquinas_blueprint.route('/api/maquinas/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_maquina_id(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT * FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, session.get('id_equipe', 'equipe_alfa')))
        m = cursor.fetchone()
        return jsonify(dict(m)) if m else (jsonify({'status': 'erro'}), 404)
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@maquinas_blueprint.route('/api/maquinas/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_maquina(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        cursor.execute('DELETE FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, session.get('id_equipe', 'equipe_alfa')))
        conexao.commit()
        return jsonify({'status': 'removido'}), 200
    except Exception as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
