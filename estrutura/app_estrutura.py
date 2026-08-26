# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
# ARQUIVO: estrutura.py - PARTE 1 DE 3 (AMBIENTE E RENDERIZADORES)
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

# Definição oficial do ambiente modular isolado para Engenharia Imobiliária e Ativos
estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    """Recupera a string de conexão unificada via URL_SUPABASE importada de app_master"""
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@blueprint_route_maquinas = '''
# TERADMAS ERP v2.6 - SEGURANÇA E ECONOMIA DE DADOS ATIVA
'''

@estrutura_blueprint.route('/estrutura', methods=['GET'])
def pagina_estrutura():
    """Injeta e renderiza a interface HTML síncrona com tratamento WCAG e matriz de KPIs"""
    if not session.get('logado'):
        return redirect('/login')
        
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'estrutura.html')
    
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'estrutura.html' não encontrado no ecossistema de servidores.", 404

@estrutura_blueprint.route('/estrutura/estrutura.js', methods=['GET'])
def rota_estrutura_js():
    """Injeta nativamente o script do cliente com motores de Cap Rate, IGPM e tratamento transacional"""
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'estrutura.js')
    
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript; charset=utf-8'}
    except FileNotFoundError:
        return "console.error('Erro Crítico: Script estrutural estrutura.js ausente ou corrompido.');", 404
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
# ARQUIVO: estrutura.py - PARTE 2 DE 3 (ENDPOINTS DE CONSULTA E REMOÇÃO)
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['GET'])
def api_imoveis_listar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS imoveis_simulacao (
                id SERIAL PRIMARY KEY, equipe_id TEXT, tipo_imovel TEXT, regiao TEXT, 
                area_util REAL, valor_aluguel REAL, valor_condominio REAL, obs_contrato TEXT, nome_empresa TEXT
            )
        ''')
        conexao.commit()
        cursor.execute('SELECT * FROM imoveis_simulacao WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        return jsonify([dict(linha) for linha in cursor.fetchall()])
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh', methods=['GET'])
def api_rh_listar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS estrutura_rh (
                id SERIAL PRIMARY KEY, equipe_id TEXT, nome TEXT, cargo TEXT, 
                salario_base REAL, quantidade INTEGER, subtotal REAL
            )
        ''')
        conexao.commit()
        cursor.execute('SELECT * FROM estrutura_rh WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        return jsonify([dict(linha) for linha in cursor.fetchall()])
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@blueprint_route_maquinas = '/api/estrutura/maquinas'
@estrutura_blueprint.route('/api/estrutura/maquinas', methods=['GET'])
def api_maquinas_listar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS erp_maquinas (
                id SERIAL PRIMARY KEY, equipe_id TEXT, nome_equipamento TEXT, departamento TEXT,
                preco_compra REAL, potencia_watts REAL, consumo_gas_m3 REAL, consumo_agua_m3 REAL,
                taxa_depreciacao REAL, custo_minuto_maquina REAL
            )
        ''')
        conexao.commit()
        cursor.execute('SELECT * FROM erp_maquinas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        return jsonify([dict(linha) for linha in cursor.fetchall()])
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/imoveis/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_imovel(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            cursor.execute('''
                UPDATE config_simulacao SET valor_aluguel = (SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) 
                FROM imoveis_simulacao WHERE equipe_id = %s) WHERE equipe_id = %s
            ''', (id_equipe, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        cursor.execute('SELECT * FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@blueprint_route_delete_extensoes = 'indiv_rh_maquinas'
@estrutura_blueprint.route('/api/estrutura/rh/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_rh(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM estrutura_rh WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        cursor.execute('SELECT * FROM estrutura_rh WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_maquina(id_reg):
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        cursor.execute('SELECT * FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
# ARQUIVO: estrutura.py - PARTE 3 DE 3 (GRAVAÇÃO E MOTORES DE CÁLCULO)
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['POST'])
def api_imoveis_salvar():
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', 'GRUPO DIDÁTICO').upper()
    id_reg = dados.get('id')
    conexao = obter_conexao_master()
    cursor = None
    try:
        v_aluguel = float(str(dados.get('valor_aluguel', 0)).replace(',', '.').strip())
        v_condominio = float(str(dados.get('valor_condominio', 0)).replace(',', '.').strip())
        area = float(str(dados.get('area_util', 0)).replace(',', '.').strip())
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if id_reg:
            cursor.execute('''
                UPDATE imoveis_simulacao SET tipo_imovel=%s, regiao=%s, area_util=%s, 
                valor_aluguel=%s, valor_condominio=%s, obs_contrato=%s WHERE id=%s AND equipe_id=%s
            ''', (dados.get('tipo_imovel'), dados.get('regiao'), area, v_aluguel, v_condominio, dados.get('obs_contrato'), id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO imoveis_simulacao (equipe_id, tipo_imovel, regiao, area_util, valor_aluguel, valor_condominio, obs_contrato, nome_empresa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('tipo_imovel'), dados.get('regiao'), area, v_aluguel, v_condominio, dados.get('obs_contrato'), nome_empresa))
        cursor.execute('''
            UPDATE config_simulacao SET valor_aluguel = (SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) 
            FROM imoveis_simulacao WHERE equipe_id = %s) WHERE equipe_id = %s
        ''', (id_equipe, id_equipe))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError):
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh', methods=['POST'])
def api_rh_salvar():
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    id_rh = dados.get('id')
    conexao = obter_conexao_master()
    cursor = None
    try:
        base = float(str(dados.get('salario_base', 0)).replace(',', '.').strip())
        qtd = int(dados.get('quantidade', 1))
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if id_rh:
            cursor.execute('''
                UPDATE estrutura_rh SET nome=%s, cargo=%s, salario_base=%s, quantidade=%s, subtotal=%s WHERE id=%s AND equipe_id=%s
            ''', (dados.get('nome'), dados.get('cargo'), base, qtd, (base * qtd), id_rh, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO estrutura_rh (equipe_id, nome, cargo, salario_base, quantidade, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('nome'), dados.get('cargo'), base, qtd, (base * qtd)))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError):
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas', methods=['POST'])
def api_maquinas_salvar():
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        prc = float(str(dados.get('preco', 0)).replace(',', '.').strip())
        wts = float(str(dados.get('potencia', 0)).replace(',', '.').strip())
        gas = float(str(dados.get('gas', 0)).replace(',', '.').strip())
        agu = float(str(dados.get('agua', 0)).replace(',', '.').strip())
        dep = float(str(dados.get('depreciacao', 0)).replace(',', '.').strip())
        cmin = float(str(dados.get('custo_minuto', 0)).replace(',', '.').strip())
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            INSERT INTO erp_maquinas (equipe_id, nome_equipamento, departamento, preco_compra, potencia_watts, consumo_gas_m3, consumo_agua_m3, taxa_depreciacao, custo_minuto_maquina)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados.get('nome'), 'ESTRUTURA', prc, wts, gas, agu, dep, cmin))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError):
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/financeiro/metricas', methods=['GET'])
def api_financeiro_metricas():
    if not session.get('logado'): return jsonify({'status': 'erro'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', 'GRUPO DIDÁTICO').upper()
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) as imob FROM imoveis_simulacao WHERE equipe_id = %s', (id_equipe,))
        c_imovel = cursor.fetchone()['imob']
        cursor.execute('SELECT COALESCE(SUM(subtotal), 0) as total_rh FROM estrutura_rh WHERE equipe_id = %s', (id_equipe,))
        c_rh = cursor.fetchone()['total_rh']
        cursor.execute('''
            SELECT COALESCE(SUM(preco_compra), 0) as pat, COALESCE(SUM(potencia_watts), 0) as w, COALESCE(SUM(consumo_gas_m3), 0) as g,
            COALESCE(SUM(consumo_agua_m3), 0) as a, COALESCE(SUM(custo_minuto_maquina), 0) as cmm FROM erp_maquinas WHERE equipe_id = %s
        ''', (id_equipe,))
        m = cursor.fetchone()
        c_fixo = c_imovel + c_rh
        c_var = (m['w'] * 0.00075) + (m['g'] * 4.50) + (m['a'] * 8.20)
        return jsonify({
            'nome_empresa': nome_empresa, 'capital_total': 5000000.00, 'saldo_infraestrutura_setor': 2000000.00 - m['pat'],
            'patrimonio_isolado_setor': m['pat'], 'patrimonio_ativo_total': m['pat'], 'custo_fixo_isolado_setor': c_fixo,
            'custo_fixo_total': c_fixo + 21350.00, 'custo_variavel_isolado_setor': c_var, 'custo_variavel_total': c_var + 500.00,
            'tempo_amortizacao_real': "120 meses", 'cap_rate_calculado': "0.55% a.m.", 'watts_consumidos': int(m['w']),
            'gas_consumido': float(m['g']), 'agua_consumido': float(m['a']), 'custo_minuto_setor': float(m['cmm'])
        })
    except psycopg2.DatabaseError: return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
