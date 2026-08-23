# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO DE PROCESSOS E MATERIAIS
# BLUEPRINT DE GESTÃO OPERACIONAL DE PROCESSOS PRODUTIVOS (REVISADO)
# ==========================================================================

import os
from flask import Blueprint, request, render_template_string, session, jsonify

# Definição do Blueprint para o módulo de Processos (Ajustado para rota limpa)
processos_blueprint = Blueprint(
    'processos_blueprint',
    __name__,
    template_folder='templates',
    static_folder='static'
)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    import psycopg2
    return psycopg2.connect(URL_SUPABASE)

# Rota raiz do módulo de Processos - Entrega o HTML real estruturado
@processos_blueprint.route('/processos', methods=['GET'])
def processos_inicio():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'processos.html')
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'processos.html' não localizado.", 404

# Rota para entregar o motor Javascript local sem Erros 404
@processos_blueprint.route('/processos/processos.js', methods=['GET'])
def rota_processos_js():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, 'processos.js')
    try:
        with open(caminho_js, 'r', encoding='utf-8') as f:
            js_conteudo = f.read()
        return js_conteudo, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "console.error('Script processos.js offline.');", 404

@processos_blueprint.route('/api/processos/salvar', methods=['POST'])
def api_salvar_processo():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json or {}
    id_reg = dados.get('id')
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    produto_base = dados.get('produto_base', 'Insumo Geral')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS engenharia_processos (
            id SERIAL PRIMARY KEY, equipe_id TEXT, produto_base TEXT, nome_operacao TEXT, 
            maquina_id INTEGER, maquina_nome_suporte TEXT, tempo_setup REAL, 
            tempo_operacao REAL, custo_ref_maquina REAL, sequencia_op INTEGER, 
            custo_total_operacao REAL
        )
    ''')
    conexao.commit()

    if id_reg:
        cursor.execute('''
            UPDATE engenharia_processos SET produto_base=%s, nome_operacao=%s, maquina_id=%s, 
            maquina_nome_suporte=%s, tempo_setup=%s, tempo_operacao=%s, 
            custo_ref_maquina=%s, sequencia_op=%s, custo_total_operacao=%s 
            WHERE id=%s AND equipe_id=%s
        ''', (produto_base, dados.get('nome_operacao'), dados.get('maquina_id'), dados.get('maquina_nome_suporte'), 
              dados.get('tempo_setup'), dados.get('tempo_operacao'), dados.get('custo_ref_maquina'), 
              dados.get('sequencia_op'), dados.get('custo_total_operacao'), id_reg, id_equipe))
    else:
        cursor.execute('''
            INSERT INTO engenharia_processos (equipe_id, produto_base, nome_operacao, maquina_id, 
            maquina_nome_suporte, tempo_setup, tempo_operacao, custo_ref_maquina, 
            sequencia_op, custo_total_operacao)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (id_equipe, produto_base, dados.get('nome_operacao'), dados.get('maquina_id'), dados.get('maquina_nome_suporte'), 
              dados.get('tempo_setup'), dados.get('tempo_operacao'), dados.get('custo_ref_maquina'), 
              dados.get('sequencia_op'), dados.get('custo_total_operacao')))
        
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'sucesso'}), 200
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO DE PROCESSOS E MATERIAIS
# BLUEPRINT DE GESTÃO OPERACIONAL DE PROCESSOS PRODUTIVOS (REVISADO)
# ==========================================================================

@processos_blueprint.route('/api/processos/listar', methods=['GET'])
def api_listar_processos():
    if not session.get('logado'):
        return jsonify([]), 401
        
    conexao = obter_conexao_master()
    from psycopg2.extras import RealDictCursor
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute("ALTER TABLE engenharia_processos ADD COLUMN IF NOT EXISTS produto_base TEXT;")
    conexao.commit()
    
    cursor.execute('SELECT * FROM engenharia_processos WHERE equipe_id = %s ORDER BY sequencia_op ASC', (id_equipe,))
    linhas = cursor.fetchall()
    
    cursor.close()
    conexao.close()
    return jsonify([dict(linha) for linha in linhas])

@processos_blueprint.route('/api/processos/buscar/<int:id_reg>', methods=['GET'])
def api_buscar_processo_id(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro'}), 401
        
    conexao = obter_conexao_master()
    from psycopg2.extras import RealDictCursor
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('SELECT * FROM engenharia_processos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    processo = cursor.fetchone()
    
    cursor.close()
    conexao.close()
    if not processo: 
        return jsonify({'status': 'erro', 'message': 'Operação não localizada'}), 404
    return jsonify(dict(processo))

@processos_blueprint.route('/api/processos/deletar/<int:id_reg>', methods=['DELETE'])
def api_deletar_processo(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    cursor.execute('DELETE FROM engenharia_processos WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
    
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({'status': 'removido'}), 200

# ==========================================================================
# SEÇÃO DE COMPATIBILIDADE: materiais_blueprint mantido intacto para legado
# ==========================================================================

materiais_blueprint = Blueprint(
    'materiais_blueprint',
    __name__,
    template_folder='templates',
    static_folder='static'
)

@materiais_blueprint.route('/materiais', methods=['GET'])
def materiais_inicio():
    """Página inicial do módulo de Materiais (legado)"""
    return render_template_string('''
        <div style="font-family:sans-serif; padding:40px; background:#f9fafb;">
            <h2 style="color:#1e3a8a;">📦 TERADMAS - Módulo de Materiais</h2>
            <p style="color:#475569;">Gestão de materiais e insumos produtivos</p>
            <div style="background:white; padding:20px; border-radius:8px; margin-top:20px; border-left:4px solid #10b981;">
                <p>Módulo integrado ao barramento financeiro centralizado.</p>
            </div>
        </div>
    ''')
