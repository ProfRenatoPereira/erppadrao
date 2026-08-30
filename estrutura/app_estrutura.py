# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
# ARQUIVO: app_estrutura.py - VERSÃO COMPLETA INTEGRADA
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

# Inicialização do Blueprint do Módulo Imobiliário e Estrutura
estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    """Recupera a string de conexão unificada via URL_SUPABASE importada do módulo master"""
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@estrutura_blueprint.route('/estrutura', methods=['GET'])
def pagina_estrutura():
    """Renderiza a interface HTML síncrona validando a persistência de sessão da equipe"""
    if not session.get('logado') or not session.get('id_equipe'):
        return redirect('/login')
        
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'estrutura.html')
    
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'estrutura.html' não encontrado no diretório.", 404

@estrutura_blueprint.route('/estrutura/estrutura.js', methods=['GET'])
def rota_estrutura_js():
    """Injeta nativamente o script estático do cliente com o cabeçalho mime-type correto"""
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'estrutura.js')
    
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript; charset=utf-8'}
    except FileNotFoundError:
        return "console.error('Erro Crítico: Script estrutura.js ausente do servidor.');", 404
@estrutura_blueprint.route('/api/auth/sessao_atual', methods=['GET'])
def api_sessao_atual_verificar():
    """Valida o estado transacional e as credenciais ativas da sessão"""
    if not session.get('logado'):
        return jsonify({'status': 'desconectado'}), 401
    return jsonify({
        'id_equipe': session.get('id_equipe', 'equipe_alfa'),
        'nome_empresa': session.get('nome_empresa', session.get('nome_grupo', 'GRUPO DIDÁTICO')).upper()
    }), 200

# ========== ENDPOINTS GET (LISTAGENS) ==========

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
        return jsonify(cursor.fetchall())
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
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
        cursor.execute("SELECT * FROM erp_maquinas WHERE equipe_id = %s AND departamento = %s ORDER BY id DESC", (id_equipe, 'ESTRUTURA'))
        return jsonify(cursor.fetchall())
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@blueprint.route('/api/estrutura/rh', methods=['GET'])
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
        return jsonify(cursor.fetchall())
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ========== ENDPOINTS POST (SALVAMENTO / ATUALIZAÇÃO) ==========

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['POST'])
def api_imoveis_salvar():
    if not session.get('logado'): 
        return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', 'GRUPO DIDÁTICO').upper()
    id_reg = dados.get('id')
    conexao = obter_conexao_master()
    cursor = None
    try:
        valor_aluguel = float(str(dados.get('valor_aluguel', 0)).replace(',', '.').strip())
        valor_condominio = float(str(dados.get('valor_condominio', 0)).replace(',', '.').strip())
        area_util = float(str(dados.get('area_util', 0)).replace(',', '.').strip())
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if id_reg:
            cursor.execute('''
                UPDATE imoveis_simulacao SET tipo_imovel=%s, regiao=%s, area_util=%s, 
                valor_aluguel=%s, valor_condominio=%s, obs_contrato=%s WHERE id=%s AND equipe_id=%s
            ''', (dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, valor_condominio, dados.get('obs_contrato'), id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO imoveis_simulacao (equipe_id, tipo_imovel, regiao, area_util, valor_aluguel, valor_condominio, obs_contrato, nome_empresa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, valor_condominio, dados.get('obs_contrato'), nome_empresa))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except Exception as err:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas', methods=['POST'])
def api_maquinas_salvar():
    if not session.get('logado'): 
        return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        preco_compra = float(str(dados.get('preco_compra', 0)).replace(',', '.').strip())
        watts_consumo = float(str(dados.get('watts_consumo', 0)).replace(',', '.').strip())
        gas_consumo = float(str(dados.get('gas_consumo', 0)).replace(',', '.').strip())
        agua_consumo = float(str(dados.get('agua_consumo', 0)).replace(',', '.').strip())
        depreciacao_anos = int(dados.get('depreciacao_anos', 10))
        custo_minuto = float(str(dados.get('custo_minuto', 0)).replace(',', '.').strip())
        
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            INSERT INTO erp_maquinas (equipe_id, nome_equipamento, departamento, preco_compra, potencia_watts, consumo_gas_m3, consumo_agua_m3, taxa_depreciacao, custo_minuto_maquina) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados.get('nome_equipamento'), 'ESTRUTURA', preco_compra, watts_consumo, gas_consumo, agua_consumo, depreciacao_anos, custo_minuto))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except Exception as err:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
@estrutura_blueprint.route('/api/estrutura/rh', methods=['POST'])
def api_rh_salvar():
    if not session.get('logado'): 
        return jsonify({'status': 'erro'}), 401
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    id_rh = dados.get('id')
    conexao = obter_conexao_master()
    cursor = None
    try:
        salario_base = float(str(dados.get('salario_base', 0)).replace(',', '.').strip())
        quantidade = int(dados.get('quantidade', 1))
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if id_rh:
            cursor.execute('UPDATE estrutura_rh SET nome=%s, cargo=%s, salario_base=%s, quantidade=%s, subtotal=%s WHERE id=%s AND equipe_id=%s',
                           (dados.get('nome'), dados.get('cargo'), salario_base, quantidade, (salario_base * quantity), id_rh, id_equipe))
        else:
            cursor.execute('INSERT INTO estrutura_rh (equipe_id, nome, cargo, salario_base, quantidade, subtotal) VALUES (%s, %s, %s, %s, %s, %s)',
                           (id_equipe, dados.get('nome'), dados.get('cargo'), salario_base, quantity, (salario_base * quantity)))
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except Exception as err:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro', 'message': str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

# ========== ENDPOINTS INDIVIDUAL CRUD (GET / DELETE) ==========

@estrutura_blueprint.route('/api/estrutura/imoveis/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_imovel(id_reg):
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        cursor.execute('SELECT * FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        row = cursor.fetchone()
        return jsonify(dict(row) if row else {})
    except Exception as e:
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_rh(id_reg):
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
        row = cursor.fetchone()
        return jsonify(dict(row) if row else {})
    except Exception as e:
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_maquina(id_reg):
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
        row = cursor.fetchone()
        return jsonify(dict(row) if row else {})
    except Exception as e:
        return jsonify({'status': 'erro', 'message': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/cargos_disponiveis', methods=['GET'])
def api_cargos_disponiveis_listar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    catalogo_cargos = [
        {'cargo': 'Zelador', 'salario': 2017.32},
        {'cargo': 'Auxiliar de Serviços Gerais', 'salario': 1850.00},
        {'cargo': 'Eletricista Predial', 'salario': 2850.00},
        {'cargo': 'Técnico de Manutenção Industrial', 'salario': 3400.00},
        {'cargo': 'Vigilante Patrimonial', 'salario': 2300.00}
    ]
    return jsonify(catalogo_cargos), 200
