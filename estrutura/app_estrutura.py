# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
# PARTE 1 DE 3 - AMBIENTE DE BLUEPRINT E INJEÇÃO NATIVA DE INTERFACE
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

# Definição oficial do ambiente modular isolado para Engenharia Imobiliária
estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    """Recupera a string de conexão unificada via URL_SUPABASE importada de app_master"""
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@estrutura_blueprint.route('/estrutura', methods=['GET'])
def pagina_estrutura():
    """Injeta e renderiza a interface HTML síncrona com tratamento WCAG e matriz de 5 KPIs"""
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
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
# PARTE 2 DE 3 - ENDPOINTS DE CONSULTA COM VARIÁVEIS DIRETAS SINCRONIZADAS
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
        linhas = cursor.fetchall()
        
        return jsonify([dict(linha) for linha in linhas])
        
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro ao listar imóveis: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro interno ao processar dados no banco.'}), 500
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
        linhas = cursor.fetchall()
        
        # 🛠️ RESOLUÇÃO DE CRASH: Corrigido o loop iterador para evitar NameError de strings e arrays
        return jsonify([dict(linha) for linha in linhas])
        
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro ao listar colaboradores de suporte: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro ao ler quadro de funcionários.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
# PARTE 3 DE 3 - PERSISTÊNCIA TRANSAÇÃO WRITE/UPDATE/DELETE COM ISOLAMENTO
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['POST'])
def api_imoveis_salvar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    if not dados: return jsonify({'status': 'erro', 'message': 'Dados ausentes'}), 400
        
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
            ''', (dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, 
                  valor_condominio, dados.get('obs_contrato'), id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO imoveis_simulacao (equipe_id, tipo_imovel, regiao, area_util, valor_aluguel, valor_condominio, obs_contrato, nome_empresa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, 
                  valor_condominio, dados.get('obs_contrato'), nome_empresa))
                  
        # Atualização reativa e síncrona do somatório de custos fixos imobiliários
        cursor.execute('''
            UPDATE config_simulacao 
            SET valor_aluguel = (SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) FROM imoveis_simulacao WHERE equipe_id = %s)
            WHERE equipe_id = %s
        ''', (id_equipe, id_equipe))
        
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro ao salvar imóvel: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao processar persistência imobiliária.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh', methods=['POST'])
def api_rh_salvar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    if not dados: return jsonify({'status': 'erro', 'message': 'Dados ausentes'}), 400
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    id_rh = dados.get('id')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        salario_base = float(str(dados.get('salario_base', 0)).replace(',', '.').strip())
        quantidade = int(dados.get('quantidade', 1))
        subtotal = salario_base * quantidade
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        if id_rh:
            cursor.execute('''
                UPDATE estrutura_rh SET nome=%s, cargo=%s, salario_base=%s, quantidade=%s, subtotal=%s
                WHERE id=%s AND equipe_id=%s
            ''', (dados.get('nome'), dados.get('cargo'), salario_base, quantidade, subtotal, id_rh, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO estrutura_rh (equipe_id, nome, cargo, salario_base, quantidade, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('nome'), dados.get('cargo'), salario_base, quantidade, subtotal))
            
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro ao salvar colaborador: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha ao registrar colaborador na folha fixa.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/imoveis/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_imovel(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            
            # Recalcula e decrementa o teto de custos imobiliários após a rescisão do contrato
            cursor.execute('''
                UPDATE config_simulacao 
                SET valor_aluguel = (SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) FROM imoveis_simulacao WHERE equipe_id = %s)
                WHERE equipe_id = %s
            ''', (id_equipe, id_equipe))
            
            conexao.commit()
            return jsonify({'status': 'removido'})
        else:
            cursor.execute('SELECT * FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            imovel = cursor.fetchone()
            if not imovel: return jsonify({'status': 'erro', 'message': 'Registro imobiliário não localizado.'}), 404
            return jsonify(dict(imovel))
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro operacional em imóvel individual: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha na operação transacional imobiliária.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_rh(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM estrutura_rh WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        else:
            cursor.execute('SELECT * FROM estrutura_rh WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            colaborador = cursor.fetchone()
            if not colaborador: return jsonify({'status': 'erro', 'message': 'Colaborador não localizado.'}), 404
            return jsonify(dict(colaborador))
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro operacional em RH individual: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha ao processar operação de desligamento.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
