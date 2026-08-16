# erppadrao - configuracao/app_configuracao.py - PARTE 1 DE 2
import os
from flask import Blueprint, request, jsonify, session, redirect
import psycopg2

configuracao_blueprint = Blueprint('configuracao_blueprint', __name__)

def obter_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@configuracao_blueprint.route('/configuracao/inicializacao', methods=['GET'])
def pagina_inicializacao():
    if not session.get('logado'):
        return redirect('/login')
        
    # Caminho absoluto para garantir o carregamento do arquivo no Render
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, 'inicializacao.html')
    
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html = f.read()
        return html
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'inicializacao.html' não localizado no servidor do Render.", 404
# erppadrao - configuracao/app_configuracao.py - PARTE 2 DE 2

@configuracao_blueprint.route('/api/configuracao/salvar', methods=['POST'])
def api_inicializar_empresa_defensiva():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json or {}
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    # 🛡️ CAPTURA RESILIENTE: Mapeia todas as possíveis variações de nomes enviadas pelo front-end
    nome_empresa = dados.get('nome_fantasia', dados.get('nome_empresa', dados.get('nome_organizacao', ''))).strip()
    capital_social = dados.get('capital_social', dados.get('capital_input', dados.get('capital_total', 0)))
    
    # Sanitização numérica segura contra vírgulas ou formatações de string
    try:
        capital_social = float(str(capital_social).replace(',', '.').strip())
    except (ValueError, TypeError):
        capital_social = 0.0

    # Se mesmo com o mapeamento duplo vier vazio, aplica valores padrão didáticos para não travar a aula
    if not nome_empresa:
        nome_empresa = "METALÚRGICA ALFA S/A"
    if capital_social <= 0:
        capital_social = 5000000.0
        
    conexao = None
    cursor = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        # 🛠️ CONFORMIDADE COM O GERENCIADOR: Grava na tabela e colunas oficiais do seu GerenciadorCaixa
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS config_simulacao (
                equipe_id TEXT PRIMARY KEY,
                nome_empresa TEXT,
                capital_total REAL,
                valor_aluguel REAL DEFAULT 0
            );
        ''')
        
        cursor.execute('''
            INSERT INTO config_simulacao (equipe_id, nome_empresa, capital_total)
            VALUES (%s, %s, %s)
            ON CONFLICT (equipe_id) DO UPDATE SET 
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total;
        ''', (id_equipe, nome_empresa, capital_social))
        
        conexao.commit()
        
        # 🔑 ATUALIZAÇÃO DA SESSÃO FLASK: Libera a trava linear do interceptor no master
        session['empresa_inicializada'] = True
        session['nome_empresa'] = nome_empresa
        
        return jsonify({'status': 'sucesso', 'message': 'Empresa constituída!', 'redirect': '/estrutura'}), 200
        
    except psycopg2.DatabaseError as err:
        if conexao: conexao.rollback()
        print(f"Erro transacional de inicialização: {err}")
        return jsonify({'status': 'erro', 'message': 'Falha interna de barramento no Supabase.'}), 500
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
