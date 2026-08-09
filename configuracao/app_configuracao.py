# configuracao/app_configuracao.py
from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2

configuracao_blueprint = Blueprint('configuracao_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@configuracao_blueprint.route('/api/configuracao/inicializar', methods=['POST'])
def api_inicializar_empresa():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    dados = request.json
    nome_empresa = dados.get('nome_empresa')
    capital_total = float(dados.get('capital_total', 0))
    id_equipe = session.get('id_equipe')
    
    conexao = obter_conexao_master()
    cursor = conexao.cursor()
    
    # 1. Cria e Atualiza a Tabela Coringa de Configuração da Simulação
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS config_simulacao (
            id SERIAL PRIMARY KEY, equipe_id TEXT UNIQUE, nome_empresa TEXT, capital_total REAL, valor_aluguel REAL DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        INSERT INTO config_simulacao (equipe_id, nome_empresa, capital_total) 
        VALUES (%s, %s, %s)
        ON CONFLICT (equipe_id) DO UPDATE SET nome_empresa=%s, capital_total=%s
    ''', (id_equipe, nome_empresa, capital_total, nome_empresa, capital_total))
    # 2. Cria e Injeta a Distribuição Orçamentária por Departamento (Budget Didático)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departamentos_orcamento (
            id SERIAL PRIMARY KEY, equipe_id TEXT, departamento TEXT, orcamento_liberado REAL,
            UNIQUE(equipe_id, departamento)
        )
    ''')
    
    # Divisão e Alocação Estratégica de Capital de Custo:
    # 40% Engenharia (Máquinas), 30% Recursos Humanos (RH), 30% Almoxarifado (Materiais)
    orcamentos = [
        (id_equipe, 'maquinas', capital_total * 0.40),
        (id_equipe, 'rh', capital_total * 0.30),
        (id_equipe, 'materiais', capital_total * 0.30)
    ]
    
    cursor.executemany('''
        INSERT INTO departamentos_orcamento (equipe_id, departamento, orcamento_liberado)
        VALUES (%s, %s, %s)
        ON CONFLICT (equipe_id, departamento) DO UPDATE SET orcamento_liberado = EXCLUDED.orcamento_liberado
    ''', orcamentos)
    
    # 3. Inicializa a tabela de fluxo de caixa para controle de capabilidade de aula para aula
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fluxo_caixa (
            id SERIAL PRIMARY KEY, equipe_id TEXT, departamento TEXT, descricao TEXT, valor REAL, tipo TEXT
        )
    ''')
    
    conexao.commit()
    cursor.close()
    conexao.close()
    
    # Atualiza a sessão corrente com os dados "Coringa" estáveis
    session['nome_empresa'] = nome_empresa.upper()
    session['capital_inicial'] = capital_total
    session['empresa_inicializada'] = True
    
    return jsonify({'status': 'sucesso'})
