# erppadrao - maquinas/app_maquinas.py - PARTE 1 DE 3
import os
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

maquinas_blueprint = Blueprint('maquinas_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@maquinas_blueprint.route('/maquinas', methods=['GET'])
def pagina_maquinas():
    if not session.get('logado'):
        return redirect('/login')
    if not session.get('empresa_inicializada'):
        return redirect('/configuracao/inicializacao')
        
    # 🌟 CORREÇÃO DE AMBIENTE: Localização dinâmica absoluta da pasta do módulo
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'maquinas.html')
    
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'maquinas.html' não encontrado no servidor.", 404

@maquinas_blueprint.route('/maquinas/maquinas.js', methods=['GET'])
def rota_maquinas_js():
    # 🌟 CORREÇÃO DE AMBIENTE: Localização dinâmica absoluta do script encapsulado
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'maquinas.js')
    
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "console.error('Erro Crítico: Arquivo maquinas.js não encontrado.');", 404
# erppadrao - maquinas/app_maquinas.py - PARTE 2 DE 3

@maquinas_blueprint.route('/api/maquinas/listar', methods=['GET'])
def api_listar_maquinas():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = None
    cursor = None
    
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # Garante a criação da tabela metrológica antes do loop de leitura das equipes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ativos_maquinas (
                id SERIAL PRIMARY KEY, equipe_id TEXT, nome_equipamento TEXT, potencia REAL,
                consumo_eletrico REAL, consumo_agua REAL, consumo_gases REAL, velocidade TEXT,
                avanco TEXT, comprimento_max REAL DEFAULT 0, diametro_max REAL DEFAULT 0, frequencia_manutencao INTEGER,
                horas_trabalhadas INTEGER DEFAULT 0, preco_compra REAL, depreciacao_mensal REAL, valor_venda_final REAL,
                operador_nome TEXT, custo_minuto_operador REAL, custo_minuto_maquina REAL
            )
        ''')
        conexao.commit()
        
        cursor.execute('SELECT * FROM ativos_maquinas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        linhas = cursor.fetchall()
        return jsonify([dict(linha) for linha in linhas])
        
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        print(f"Erro ao listar máquinas da equipe: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao recuperar registros do Supabase.'}), 500
    finally:
        # 🛡️ PROTEÇÃO DO POOL: Garante o fechamento total das conexões mesmo sob falhas SQL
        if cursor: cursor.close()
        if conexao: conexao.close()
# erppadrao - maquinas/app_maquinas.py - PARTE 3 DE 3

@maquinas_blueprint.route('/api/maquinas/salvar', methods=['POST'])
def api_salvar_maquina():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    if not dados:
        return jsonify({'status': 'erro', 'message': 'Dados ausentes'}), 400
        
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = None
    cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        # 🔐 PROTEÇÃO CONTRA KEYERROR: Uso estrito de .get() com valores padrão seguros
        nome_equipamento = dados.get('nome_equipamento', '').strip()
        velocidade = dados.get('velocidade', '').strip()
        avanco = dados.get('avanco', '').strip()
        operador_nome = dados.get('operador_nome', '').strip()
        
        potencia = float(str(dados.get('potencia', 0)).replace(',', '.').strip())
        consumo_eletrico = float(str(dados.get('consumo_eletrico', 0)).replace(',', '.').strip())
        consumo_agua = float(str(dados.get('consumo_agua', 0)).replace(',', '.').strip())
        consumo_gases = float(str(dados.get('consumo_gases', 0)).replace(',', '.').strip())
        preco_compra = float(str(dados.get('preco_compra', 0)).replace(',', '.').strip())
        depreciacao_mensal = float(str(dados.get('depreciacao_mensal', 0)).replace(',', '.').strip())
        valor_venda_final = float(str(dados.get('valor_venda_final', 0)).replace(',', '.').strip())
        custo_minuto_operador = float(str(dados.get('custo_minuto_operador', 0)).replace(',', '.').strip())
        custo_minuto_maquina = float(str(dados.get('custo_minuto_maquina', 0)).replace(',', '.').strip())
        
        frequencia_manutencao = int(dados.get('frequencia_manutencao', 0))
        
        # Parâmetros ocultos ou legados preenchidos com segurança
        comprimento_max = float(str(dados.get('comprimento_max', 0)).replace(',', '.').strip())
        diametro_max = float(str(dados.get('diametro_max', 0)).replace(',', '.').strip())
        horas_trabalhadas = int(dados.get('horas_trabalhadas', 0))

        if id_reg:
            cursor.execute('''
                UPDATE ativos_maquinas SET nome_equipamento=%s, potencia=%s, consumo_eletrico=%s, 
                consumo_agua=%s, consumo_gases=%s, velocidade=%s, avanco=%s, comprimento_max=%s, 
                diametro_max=%s, frequencia_manutencao=%s, horas_trabalhadas=%s, preco_compra=%s, 
                depreciacao_mensal=%s, valor_venda_final=%s, operador_nome=%s, custo_minuto_operador=%s, 
                custo_minuto_maquina=%s WHERE id=%s AND equipe_id=%s
            ''', (nome_equipamento, potencia, consumo_eletrico, consumo_agua, consumo_gases, 
                  velocidade, avanco, comprimento_max, diametro_max, frequencia_manutencao, 
                  horas_trabalhadas, preco_compra, depreciacao_mensal, valor_venda_final, 
                  operador_nome, custo_minuto_operador, custo_minuto_maquina, id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO ativos_maquinas (equipe_id, nome_equipamento, potencia, consumo_eletrico, 
                consumo_agua, consumo_gases, velocidade, avanco, comprimento_max, diametro_max, 
                frequencia_manutencao, horas_trabalhadas, preco_compra, depreciacao_mensal, 
                valor_venda_final, operador_nome, custo_minuto_operador, custo_minuto_maquina)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, nome_equipamento, potencia, consumo_eletrico, consumo_agua, 
                  consumo_gases, velocidade, avanco, comprimento_max, diametro_max, 
                  frequencia_manutencao, horas_trabalhadas, preco_compra, depreciacao_mensal, 
                  valor_venda_final, operador_nome, custo_minuto_operador, custo_minuto_maquina))
            
        conexao.commit()
        return jsonify({'status': 'sucesso', 'message': 'Ativo industrial atualizado com sucesso.'})
        
    except (ValueError, TypeError, psycopg2.DatabaseError) as err:
        if conexao:
            conexao.rollback()
        print(f"Erro transacional ao salvar maquina no Supabase: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao processar gravação.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@maquinas_blueprint.route('/api/maquinas/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_maquina_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        
        cursor.execute('SELECT * FROM ativos_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        maquina = cursor.fetchone()
        
        if not maquina: 
            return jsonify({'status': 'erro', 'message': 'Ativo não localizado.'}), 404
        return jsonify(dict(maquina))
        
    except psycopg2.DatabaseError as e:
        print(f"Erro ao buscar maquina por ID: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha na requisição.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()


@maquinas_blueprint.route('/api/maquinas/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_maquina(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = None
    cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        id_equipe = session.get('id_equipe', 'equipe_alfa')
        
        cursor.execute('DELETE FROM ativos_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        conexao.commit()
        return jsonify({'status': 'removido', 'message': 'Ativo desmobilizado do parque fabril.'})
        
    except psycopg2.DatabaseError as e:
        if conexao:
            conexao.rollback()
        print(f"Erro ao deletar maquina: {e}")
        return jsonify({'status': 'erro', 'message': 'Erro de integridade ao descartar ativo.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
