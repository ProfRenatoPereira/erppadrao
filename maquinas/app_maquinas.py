# erppadrao - maquinas/app_maquinas.py - PARTE 1 DE 3
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
    if not session.get('logado'):
        return redirect('/login')
    if not session.get('empresa_inicializada'):
        return redirect('/configuracao/inicializacao')
        
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
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'maquinas.js')
    
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "console.error('Arquivo maquinas.js não encontrado.');", 404
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
        
        # 🛡️ COMPATIBILIDADE INTEGRAL: Cria a tabela erp_maquinas para guardar os dados técnicos da tela
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS erp_maquinas (
                id SERIAL PRIMARY KEY, equipe_id TEXT, nome_equipamento TEXT, potencia REAL,
                consumo_eletrico REAL, consumo_agua REAL, consumo_gases REAL, velocidade TEXT,
                avanco TEXT, frequencia_manutencao INTEGER, preco_compra REAL, depreciacao_mensal REAL, 
                valor_venda_final REAL, operador_nome TEXT, custo_minuto_operador REAL, custo_minuto_maquina REAL,
                jornada_semanal TEXT DEFAULT '44', turnos_trabalho TEXT DEFAULT '1'
            )
        ''')
        conexao.commit()
        
        cursor.execute('SELECT * FROM erp_maquinas WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        linhas = cursor.fetchall()
        return jsonify([dict(x) for x in linhas])
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify([]), 200
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
# erppadrao - maquinas/app_maquinas.py - PARTE 3 DE 3

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
        v = dados.get('velocidade', '').strip()
        av = dados.get('avanco', '').strip()
        op = dados.get('operador_nome', '').strip()
        journ = dados.get('jornada_semanal', '44')
        turn = dados.get('turnos_trabalho', '1')
        
        pot = float(str(dados.get('potencia', 0)).replace(',', '.').strip())
        c_el = float(str(dados.get('consumo_eletrico', 0)).replace(',', '.').strip())
        c_ag = float(str(dados.get('consumo_agua', 0)).replace(',', '.').strip())
        c_gs = float(str(dados.get('consumo_gases', 0)).replace(',', '.').strip())
        pr = float(str(dados.get('preco_compra', 0)).replace(',', '.').strip())
        dep = float(str(dados.get('depreciacao_mensal', 0)).replace(',', '.').strip())
        v_vf = float(str(dados.get('valor_venda_final', 0)).replace(',', '.').strip())
        c_op = float(str(dados.get('custo_minuto_operador', 0)).replace(',', '.').strip())
        c_mq = float(str(dados.get('custo_minuto_maquina', 0)).replace(',', '.').strip())
        fr = int(dados.get('frequencia_manutencao', 0))

        # 🧠 INTEGRAÇÃO COM GERENCIADOR: Puxa o saldo real calculado na linha 36 do seu motor
        import GerenciadorCaixa
        m = GerenciadorCaixa.calcular_metricas_totais_equipe(id_equipe, 'maquinas')
        verba_disponivel = m.get('capital_disponivel_departamento', 0.0)

        if pr > verba_disponivel and not id_reg:
            return "Estouro Orçamentário: Saldo insuficiente na Engenharia.", 400

        if id_reg:
            cursor.execute('''
                UPDATE erp_maquinas SET nome_equipamento=%s, potencia=%s, consumo_eletrico=%s, consumo_agua=%s, 
                consumo_gases=%s, velocidade=%s, avanco=%s, frequencia_manutencao=%s, preco_compra=%s, 
                depreciacao_mensal=%s, valor_venda_final=%s, operador_nome=%s, custo_minuto_operador=%s, 
                custo_minuto_maquina=%s, jornada_semanal=%s, turnos_trabalho=%s WHERE id=%s AND equipe_id=%s
            ''', (nome_eq, pot, c_el, c_ag, c_gs, v, av, fr, pr, dep, v_vf, op, c_op, c_mq, journ, turn, id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO erp_maquinas (equipe_id, nome_equipamento, potencia, consumo_eletrico, consumo_agua, 
                consumo_gases, velocidade, avanco, frequencia_manutencao, preco_compra, depreciacao_mensal, 
                valor_venda_final, operador_nome, custo_minuto_operador, custo_minuto_maquina, jornada_semanal, turnos_trabalho)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, nome_eq, pot, c_el, c_ag, c_gs, v, av, fr, pr, dep, v_vf, op, c_op, c_mq, journ, turn))

        # 📝 LANÇAMENTO SÍNCRONO NO LIVRO CAIXA: Alimenta a tabela fluxo_caixa para o seu gerenciador ler e abater o saldo
        if not id_reg:
            cursor.execute('''
                INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor)
                VALUES (%s, %s, %s, %s);
            ''', (id_equipe, 'maquinas', f"Aquisição Ativo: {nome_eq}", pr))

        conexao.commit()
        return jsonify({'status': 'sucesso'}), 200
    except psycopg2.DatabaseError as e:
        if conexao: conexao.rollback()
        return jsonify({'status': 'erro'}), 500
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
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao, cursor = None, None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        cursor.execute("SELECT nome_equipamento, preco_compra FROM erp_maquinas WHERE id = %s AND equipe_id = %s", (id_reg, id_equipe))
        maq = cursor.fetchone()
        if maq:
            # Estorna o valor inserindo uma movimentação de valor negativo no livro caixa
            cursor.execute('''
                INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor)
                VALUES (%s, %s, %s, %s);
            ''', (id_equipe, 'maquinas', f"Estorno Descarte: {maq[0]}", -float(maq[1])))

        cursor.execute('DELETE FROM erp_maquinas WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        conexao.commit()
        return jsonify({'status': 'removido'})
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
