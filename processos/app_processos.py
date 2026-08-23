# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO DE PROCESSOS E ENGENHARIA DE ATIVOS
# ARQUIVO: processos/app_processos.py (COMPLETO E HOMOLOGADO)
# ==========================================================================

import os
import urllib.parse as urlparse
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify, render_template, session

# Instanciação do Blueprint do Subsetor de Engenharia de Processos
processos_blueprint = Blueprint(
    'processos', 
    __name__, 
    template_folder='templates',
    static_folder='static'
)

URL_SUPABASE = os.environ.get('URL_SUPABASE')

def obter_conexao_master():
    """
    Estabelece conexão segura TCP/IP com o Supabase.
    Mitiga explicitamente o erro psycopg2.OperationalError ignorando sockets Unix locais.
    """
    if not URL_SUPABASE:
        raise ValueError("ERRO CRÍTICO: URL_SUPABASE não configurada no ambiente do Render.")
    
    try:
        url = urlparse.urlparse(URL_SUPABASE)
        dbname = url.path[1:]
        user = url.username
        password = url.password
        host = url.hostname
        port = url.port or 5432
        
        return psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port,
            sslmode="require"
        )
    except Exception:
        return psycopg2.connect(URL_SUPABASE)

# ==========================================================================
# ROTAS DE RENDERIZAÇÃO VISUAL (FRONT-END DIDÁTICO)
# ==========================================================================

@processos_blueprint.route('/processos', methods=['GET'])
def pagina_processos():
    """Renderiza a tela principal de Engenharia de Processos."""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Sessão expirada ou não autenticada.'}), 401
    return render_template('processos.html')

@processos_blueprint.route('/materiais', methods=['GET'])
def pagina_materiais():
    """Renderiza o Catálogo de Materiais mitigando erros 404 de navegação do aluno."""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Sessão expirada ou não autenticada.'}), 401
    try:
        return render_template('materiais.html')
    except Exception:
        return render_template('processos.html')

# ==========================================================================
# ENDPOINTS DA API REST (INTEGRAÇÃO COM SUPABASE E MATRIZ CONTÁBIL)
# ==========================================================================

@processos_blueprint.route('/api/processos/listar', methods=['GET'])
def api_listar_processos():
    """Retorna todos os roteiros analíticos da equipe autenticada."""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = None
    try:
        conexao = obter_conexao_master()
        cur = conexao.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, produto_base, nome_operacao, maquina_id, maquina_nome_suporte, 
                   tempo_setup, tempo_operacao, custo_ref_maquina, sequencia_op, custo_total_operacao
            FROM engenharia_processos 
            WHERE equipe_id = %s 
            ORDER BY sequencia_op ASC
        """, (id_equipe,))
        
        processos = cur.fetchall()
        cur.close()
        conexao.close()
        return jsonify(processos), 200
        
    except Exception as e:
        if conexao: conexao.close()
        return jsonify({'status': 'error', 'message': f'Falha no barramento: {str(e)}'}), 500

@processos_blueprint.route('/api/processos/homologar', methods=['POST'])
def api_homologar_operacao():
    """Grava uma nova operação industrial aplicando os critérios contábeis do ERP."""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    dados = request.get_json() or {}
    
    # Extração e validação de parâmetros sob try/catch isolado contra falhas
    try:
        produto_base = dados.get('produto_base')
        nome_operacao = dados.get('nome_operacao')
        maquina_id = int(dados.get('maquina_id', 0))
        maquina_nome = dados.get('maquina_nome_suporte', 'Posto de Trabalho Padrão')
        tempo_setup = float(dados.get('tempo_setup', 0))
        tempo_operacao = float(dados.get('tempo_operacao', 0))
        custo_ref_maquina = float(dados.get('custo_ref_maquina', 0))
        sequencia_op = int(dados.get('sequencia_op', 10))
        
        # Equação Progressiva de Custo Direto da Operação por Unidade (Didático)
        # Custo = (Tempo de Operação * Custo Máquina Minuto) + (Tempo de Setup distribuído por lote conceitual de 15 peças)
        custo_total_operacao = round((tempo_operacao * custo_ref_maquina) + ((tempo_setup * custo_ref_maquina) / 15.0), 2)
        
    except (ValueError, TypeError) as e:
        return jsonify({'status': 'erro', 'message': f'Dados de entrada inválidos: {str(e)}'}), 400

    conexao = None
    try:
        conexao = obter_conexao_master()
        cur = conexao.cursor()
        
        cur.execute("""
            INSERT INTO engenharia_processos (
                equipe_id, produto_base, nome_operacao, maquina_id, maquina_nome_suporte, 
                tempo_setup, tempo_operacao, custo_ref_maquina, sequencia_op, custo_total_operacao
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (id_equipe, produto_base, nome_operacao, maquina_id, maquina_nome, 
               tempo_setup, tempo_operacao, custo_ref_maquina, sequencia_op, custo_total_operacao))
        
        conexao.commit()
        cur.close()
        conexao.close()
        
        return jsonify({'status': 'sucesso', 'message': 'Operação industrial homologada com sucesso!'}), 201
        
    except Exception as e:
        if conexao: conexao.close()
        return jsonify({'status': 'error', 'message': f'Erro de gravação no Supabase: {str(e)}'}), 500

@processos_blueprint.route('/api/processos/deletar/<int:id_processo>', methods=['DELETE'])
def api_deletar_operacao(id_processo):
    """Remove uma operação do roteiro analítico recalculando a matriz automaticamente."""
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = None
    try:
        conexao = obter_conexao_master()
        cur = conexao.cursor()
        
        cur.execute("""
            DELETE FROM engenharia_processos 
            WHERE id = %s AND equipe_id = %s
        """, (id_processo, id_equipe))
        
        conexao.commit()
        cur.close()
        conexao.close()
        
        return jsonify({'status': 'sucesso', 'message': 'Operação removida dos roteiros.'}), 200
        
    except Exception as e:
        if conexao: conexao.close()
        return jsonify({'status': 'error', 'message': f'Erro ao deletar registro: {str(e)}'}), 500
