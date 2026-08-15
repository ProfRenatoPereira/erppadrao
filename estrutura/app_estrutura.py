# erppadrao - estrutura/app_estrutura.py - PARTE 1 DE 3
import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@estrutura_blueprint.route('/estrutura', methods=['GET'])
def pagina_estrutura():
    if not session.get('logado'):
        return redirect('/login')
        
    # 🌟 CORREÇÃO DE AMBIENTE: Localização dinâmica absoluta para o arquivo HTML
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'estrutura.html')
    
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'estrutura.html' não encontrado no servidor.", 404

@estrutura_blueprint.route('/estrutura/estrutura.js', methods=['GET'])
def rota_estrutura_js():
    # 🌟 CORREÇÃO DE AMBIENTE: Localização dinâmica absoluta para o arquivo JS
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'estrutura.js')
    
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "console.error('Erro Crítico: Arquivo estrutura.js não encontrado.');", 404
# erppadrao - estrutura/app_estrutura.py - PARTE 2 DE 3

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['GET'])
def api_imoveis_listar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        # Garante a existência da tabela parametrizada com a coluna estável nome_empresa
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


@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['POST'])
def api_imoveis_salvar():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    if not dados:
        return jsonify({'status': 'erro', 'message': 'Dados ausentes'}), 400
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', 'GRUPO DIDÁTICO').upper()
    id_reg = dados.get('id')
    
    conexao = obter_conexao_master()
    cursor = None
    
    try:
        # Tratamento e tipagem segura das variáveis de custo fixo
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
                  
        # Soma todos os aluguéis ativos da equipe para não sobrescrever dados
        cursor.execute('''
            UPDATE config_simulacao 
            SET valor_aluguel = (SELECT COALESCE(SUM(valor_aluguel + valor_condominio), 0) FROM imoveis_simulacao WHERE equipe_id = %s)
            WHERE equipe_id = %s
        ''', (id_equipe, id_equipe))
            
        conexao.commit()
        return jsonify({'status': 'sucesso'})
# erppadrao - estrutura/app_estrutura.py - PARTE 3 DE 3
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao: conexao.rollback()
        print(f"Erro transacional imobiliário: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao processar persistência.'}), 500
    finally:
        # 🛡️ PROTEÇÃO DO POOL: Garante a liberação dos slots transacionais no Supabase
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
            # Remove o registro imobiliário com isolamento estrito de equipe
            cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
            
            # Recalcula e atualiza o Custo Fixo restante (ou zera se não houver mais contratos)
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
            if not imovel: 
                return jsonify({'status': 'erro', 'message': 'Registro não localizado.'}), 404
            return jsonify(dict(imovel))
            
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro na rota individual: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha interna na operação.'}), 500
    finally:
        # 🛡️ PROTEÇÃO DO POOL: Garante fechamento do canal de comunicação individual
        if cursor: cursor.close()
        if conexao: conexao.close()
