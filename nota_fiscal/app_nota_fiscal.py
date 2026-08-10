# erppadrao - nota_fiscal/app_nota_fiscal.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

nota_fiscal_blueprint = Blueprint('nota_fiscal_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@nota_fiscal_blueprint.route('/nota_fiscal')
def pagina_nota_fiscal():
    with open('nota_fiscal/nota_fiscal.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@nota_fiscal_blueprint.route('/api/nota_fiscal/transmitir', methods=['POST'])
def api_transmitir_nfe():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # Inicia a escrituração tributária geral no Supabase se não existir
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livro_fiscal_nfe (
            id SERIAL PRIMARY KEY, equipe_id TEXT, venda_id INTEGER,
            cliente_nome TEXT, base_calculo REAL, valor_issqn REAL,
            valor_icms REAL, valor_pis_cofins REAL, total_impostos REAL,
            carga_tributaria_pct REAL
        )
    ''')
    
    cursor.execute('''
        INSERT INTO livro_fiscal_nfe (equipe_id, venda_id, cliente_nome, base_calculo, 
        valor_issqn, valor_icms, valor_pis_cofins, total_impostos, carga_tributaria_pct)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (id_equipe, dados['venda_id'], dados['cliente_nome'], float(dados['base_calculo']),
          float(dados['valor_issqn']), float(dados['valor_icms']), float(dados['valor_pis_cofins']),
          float(dados['total_impostos']), float(dados['carga_tributaria_pct'])))
    # 2. ABORDAGEM GERENCIAL DE FLUXO DE CAIXA: Lança a provisão de imposto a recolher
    # Retém o imposto como débito no fluxo_caixa geral da equipe para abater da receita comercial líquida
    descricao_imposto = f"Provisão de Tributos Retidos s/ NF-e Ref. Venda #{dados['venda_id']}"
    cursor.execute('''
        INSERT INTO fluxo_caixa (equipe_id, departamento, descricao, valor, tipo)
        VALUES (%s, 'nota_fiscal', %s, %s, 'IMPOSTO_RETIDO')
    ''', (id_equipe, descricao_imposto, float(dados['total_impostos'])))
          
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@nota_fiscal_blueprint.route('/api/nota_fiscal/listar', methods=['GET'])
def api_listar_livro_fiscal():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM livro_fiscal_nfe WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])
