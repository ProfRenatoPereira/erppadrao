# erppadrao - roi/app_roi.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

roi_blueprint = Blueprint('roi_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@roi_blueprint.route('/roi')
def pagina_roi():
    with open('roi/roi.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@roi_blueprint.route('/api/roi/apurar', methods=['GET'])
def api_apurar_balanco_cruzado():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # 1. Soma faturamento bruto das Notas Fiscais
    receita_bruta = 0.0
    try:
        cursor.execute('SELECT SUM(base_calculo) as total FROM livro_fiscal_nfe WHERE equipe_id = %s', (id_equipe,))
        r = cursor.fetchone()
        if r and r['total']: receita_bruta = float(r['total'])
    except Exception: pass

    # 2. Soma retenção tributária acumulada
    total_impostos = 0.0
    try:
        cursor.execute('SELECT SUM(total_impostos) as total FROM livro_fiscal_nfe WHERE equipe_id = %s', (id_equipe,))
        i = cursor.fetchone()
        if i and i['total']: total_impostos = float(i['total'])
    except Exception: pass

    # 3. Soma investimentos imobilizados em ativos/máquinas (Fase 4)
    total_investimentos = 50000.0 # Valor base didático de infraestrutura
    try:
        cursor.execute('SELECT SUM(preco_compra) as total FROM ativos_maquinas WHERE equipe_id = %s', (id_equipe,))
        m = cursor.fetchone()
        if m and m['total']: total_investimentos += float(m['total'])
    except Exception: pass

    # 4. Soma custos de folha operacional processada (Fase 7)
    total_folha = 0.0
    try:
        cursor.execute('SELECT SUM(valor_liquido + encargos_patronais) as total FROM livro_razonete_folha WHERE equipe_id = %s', (id_equipe,))
        f = cursor.fetchone()
        if f and f['total']: total_folha = float(f['total'])
    except Exception: pass

    # Lucro Líquido = Receita Bruta - Impostos SEFAZ - Custos Trabalhistas
    lucro_liquido = receita_bruta - total_impostos - total_folha

    cursor.close()
    conexao.close()
    
    return jsonify({
        'receita_bruta': receita_bruta,
        'total_investimentos': total_investimentos,
        'total_folha': total_folha,
        'lucro_liquido': lucro_liquido
    })

@roi_blueprint.route('/api/roi/salvar', methods=['POST'])
def api_salvar_meta_roi():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    dados = request.json
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    data_hoje = datetime.now().strftime('%d/%m/%Y %H:%M')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livro_metas_roi (
            id SERIAL PRIMARY KEY, equipe_id TEXT, data_registro TEXT,
            investimento_base REAL, roi_meta_pct REAL, faturamento_requerido REAL
        )
    ''')
    
    cursor.execute('''
        INSERT INTO livro_metas_roi (equipe_id, data_registro, investimento_base, roi_meta_pct, faturamento_requerido)
        VALUES (%s, %s, %s, %s, %s)
    ''', (id_equipe, data_hoje, float(dados['investimento_base']), float(dados['roi_meta_pct']), float(dados['faturamento_requerido'])))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'})

@roi_blueprint.route('/api/roi/listar', methods=['GET'])
def api_listar_metas_roi():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM livro_metas_roi WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
    linhas = cursor.fetchall()
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@roi_blueprint.route('/api/roi/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_meta_roi(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    cursor.execute('DELETE FROM livro_metas_roi WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'})
