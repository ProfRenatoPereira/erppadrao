# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
# ARQUIVO: app_estrutura.py - PARTE 1 DE 4 (ARQUITETURA DE TOPO E VIEWS)
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

# Definição oficial do ambiente modular isolado para Engenharia Imobiliária e Custos
estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    """Recupera a string de conexão unificada via URL_SUPABASE importada de app_master"""
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

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
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
# ARQUIVO: app_estrutura.py - PARTE 2 DE 4 (ENDPOINTS DE LEITURA E CONSULTA)
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['GET'])
def api_imoveis_listar():
    """Lista todos os contratos imobiliários associados à equipe logada na sessão"""
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
        print(f"Erro ao listar imóveis: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro interno ao processar dados no banco.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas', methods=['GET'])
def api_maquinas_listar():
    """Carrega o inventário de equipamentos alocados na tabela oficial da engenharia (Módulo 07)"""
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
        
        cursor.execute("SELECT * FROM erp_maquinas WHERE equipe_id = %s AND departamento = 'ESTRUTURA' ORDER BY id DESC", (id_equipe,))
        return jsonify(cursor.fetchall())
        
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro ao listar máquinas: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro ao ler inventário de ativos.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh', methods=['GET'])
def api_rh_listar():
    """Recupera a folha fixa de colaboradores e suporte do setor predial logado"""
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
        print(f"Erro ao listar colaboradores de suporte: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro ao ler quadro de funcionários.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
# ARQUIVO: app_estrutura.py - PARTE 3 DE 4 (PERSISTÊNCIA E OPERAÇÕES POST)
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['POST'])
def api_imoveis_salvar():
    """Salva ou edita contratos imobiliários atualizando reativamente o teto orçamentário geral"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
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
            ''', (dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, 
                  valor_condominio, dados.get('obs_contrato'), id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO imoveis_simulacao (equipe_id, tipo_imovel, regiao, area_util, valor_aluguel, valor_condominio, obs_contrato, nome_empresa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('tipo_imovel'), dados.get('regiao'), area_util, valor_aluguel, 
                  valor_condominio, dados.get('obs_contrato'), nome_empresa))
                  
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro ao salvar imóvel: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao processar persistência.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas', methods=['POST'])
def api_maquinas_salvar():
    """Registra novos maquinários industriais alocando o departamento estrito ESTRUTURA (Módulo 07)"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        preco_compra = float(str(dados.get('preco', 0)).replace(',', '.').strip())
        potencia_watts = float(str(dados.get('potencia', 0)).replace(',', '.').strip())
        consumo_gas_m3 = float(str(dados.get('gas', 0)).replace(',', '.').strip())
        consumo_agua_m3 = float(str(dados.get('agua', 0)).replace(',', '.').strip())
        taxa_depreciacao = float(str(dados.get('depreciacao', 0)).replace(',', '.').strip())
        custo_minuto_maquina = float(str(dados.get('custo_minuto', 0)).replace(',', '.').strip())
        
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        cursor.execute('''
            INSERT INTO erp_maquinas (
                equipe_id, nome_equipamento, departamento, preco_compra, 
                potencia_watts, consumo_gas_m3, consumo_agua_m3, taxa_depreciacao, custo_minuto_maquina
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, dados.get('nome'), 'ESTRUTURA', preco_compra, 
              potencia_watts, consumo_gas_m3, consumo_agua_m3, taxa_depreciacao, custo_minuto_maquina))
              
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro ao salvar maquina: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao processar persistência de ativos.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: cursor.close()

@estrutura_blueprint.route('/api/estrutura/rh', methods=['POST'])
def api_rh_salvar():
    """Grava e recalcula as provisões da folha de pagamento de pessoal do setor imobiliário"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
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
            cursor.execute('''
                UPDATE estrutura_rh SET nome=%s, cargo=%s, salario_base=%s, quantidade=%s, subtotal=%s
                WHERE id=%s AND equipe_id=%s
            ''', (dados.get('nome'), dados.get('cargo'), salario_base, quantidade, (salario_base * quantidade), id_rh, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO estrutura_rh (equipe_id, nome, cargo, salario_base, quantidade, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados.get('nome'), dados.get('cargo'), salario_base, quantidade, (salario_base * quantidade)))
            
        conexao.commit()
        return jsonify({'status': 'sucesso'})
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro ao salvar colaborador: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha ao registrar colaborador na folha fixa.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
# ARQUIVO: app_estrutura.py - PARTE 4 DE 4 (OPERAÇÕES CRUD E MOTOR DE TAXAS)
# ==========================================================================

@estrutura_blueprint.route('/api/estrutura/imoveis/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_imovel(id_reg):
    """Retorna dados de um imóvel ou executa a sua rescisão contratual transacional no banco"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        else:
            cursor.execute('SELECT * FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/rh/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_rh(id_reg):
    """Busca ou desliga colaboradores da equipe atual com controle de isolamento de dados"""
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
            return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/maquinas/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_maquina(id_reg):
    """Busca ou remove ativos industriais da tabela erp_maquinas"""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        if request.method == 'DELETE':
            cursor.execute('DELETE FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            conexao.commit()
            return jsonify({'status': 'removido'})
        else:
            cursor.execute('SELECT * FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            return jsonify(dict(cursor.fetchone()) or {})
    except psycopg2.DatabaseError:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()

@estrutura_blueprint.route('/api/estrutura/metricas', methods=['GET'])
def api_modulo_local_metricas():
    """Motor contábil unificado mapeado para evitar colisões de escopo com as chamadas de app_master"""
    if not session.get('logado'): 
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', session.get('nome_grupo', 'GRUPO DIDÁTICO')).upper()
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. Recupera Aluguel e Condomínio Isolados do Setor
        cursor.execute('SELECT COALESCE(SUM(valor_aluguel), 0) as total_aluguel, COALESCE(SUM(valor_condominio), 0) as total_condo FROM imoveis_simulacao WHERE equipe_id = %s', (id_equipe,))
        imob_dados = cursor.fetchone()
        c_aluguel = imob_dados['total_aluguel']
        c_condo = imob_dados['total_condo']
        
        # 2. Recupera Subtotal dos Funcionários de Apoio do Setor
        cursor.execute('SELECT COALESCE(SUM(subtotal), 0) as total_rh FROM estrutura_rh WHERE equipe_id = %s', (id_equipe,))
        c_rh = cursor.fetchone()['total_rh']
        
        # 3. Métricas de Máquinas específicas deste Setor (ESTRUTURA)
        cursor.execute('''
            SELECT COALESCE(SUM(preco_compra), 0) as pat, COALESCE(SUM(potencia_watts), 0) as w, COALESCE(SUM(consumo_gas_m3), 0) as g,
            COALESCE(SUM(consumo_agua_m3), 0) as a, COALESCE(SUM(custo_minuto_maquina), 0) as cmm FROM erp_maquinas WHERE equipe_id = %s AND departamento = 'ESTRUTURA'
        ''', (id_equipe,))
        m_setor = cursor.fetchone()
        
        # 4. Somatório de Patrimônios e CMM Globais (Todos os setores da Empresa)
        cursor.execute("SELECT COALESCE(SUM(preco_compra), 0) as pat_global, COALESCE(SUM(custo_minuto_maquina), 0) as cmm_global FROM erp_maquinas WHERE equipe_id = %s", (id_equipe,))
        m_global = cursor.fetchone()
        
        # 5. Somatório de Custos Fixos e Pessoal Globais de todos os outros departamentos
        cursor.execute("SELECT COALESCE(SUM(subtotal), 0) as total_rh_global FROM estrutura_rh WHERE equipe_id = %s", (id_equipe,))
        rh_global = cursor.fetchone()['total_rh_global']
        
        cursor.execute('SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) as imob_global FROM imoveis_simulacao WHERE equipe_id = %s', (id_equipe,))
        imob_global = cursor.fetchone()['imob_global']
        
        # Consolidação de Fixo local somando a Provisão Imóvel Próprio conforme exigido
        c_provisao = c_aluguel + c_condo
        c_fixo_setor = c_aluguel + c_condo + c_rh + c_provisao
        
        # Consolidação Global somando os Custos Fixos acumulados + valor fixo simulado de suporte
        c_fixo_global_todos_setores = imob_global + rh_global + imob_global + 21350.00
        c_var_setor = (m_setor['w'] * 0.00075) + (m_setor['g'] * 4.50) + (m_setor['a'] * 8.20)
        
        return jsonify({
            'nome_empresa': nome_empresa,
            'capital_total': 5000000.00,
            'aluguel_bruto_setor': c_aluguel,
            'condominio_bruto_setor': c_condo,
            'provisao_setor': c_provisao,
            'subtotal_fixado_rh': c_rh,
            'patrimonio_isolado_setor': m_setor['pat'],
            'patrimonio_ativo_total': m_global['pat_global'],
            'custo_fixo_isolado_setor': c_fixo_setor,
            'custo_fixo_total': c_fixo_global_todos_setores,
            'custo_variavel_isolado_setor': c_var_setor,
            'custo_variavel_total': c_var_setor + 500.00,
            'watts_consumidos': int(m_setor['w']),
            'gas_consumido': float(m_setor['g']),
            'agua_consumido': float(m_setor['a']),
            'custo_minuto_setor': float(m_setor['cmm']),
            'custo_minuto_global': float(m_global['cmm_global'])
        })
    except psycopg2.DatabaseError as e:
        print(f"Erro no motor contábil local do servidor: {e}")
        return jsonify({'status': 'erro'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
