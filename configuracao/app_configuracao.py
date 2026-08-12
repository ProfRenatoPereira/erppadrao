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
    # 1. Validação estrita de autenticação de sessão
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado. Efetue o login novamente.'}), 401
        
    dados = request.json
    if not dados:
        return jsonify({'status': 'erro', 'message': 'Dados de requisição ausentes.'}), 400
        
    nome_empresa = dados.get('nome_empresa', '').strip()
    id_equipe = session.get('id_equipe')
    
    # 2. Validação de consistência do Nome da Empresa
    if not nome_empresa:
        return jsonify({'status': 'erro', 'message': 'O nome da empresa simulada não pode ficar em branco.'}), 400

    # 3. Conversão segura de tipo para evitar travamento com ValueError (Conversão de Strings inválidas)
    try:
        capital_total = float(str(dados.get('capital_total', 0)).replace(',', '.').strip())
        if capital_total <= 0:
            return jsonify({'status': 'erro', 'message': 'O capital total integralizado deve ser maior que zero.'}), 400
    except (ValueError, TypeError):
        return jsonify({'status': 'erro', 'message': 'Formato de Capital Inicial inválido.'}), 400
    
    conexao = None
    try:
        conexao = obter_conexao_master()
        cursor = conexao.cursor()
        
        # 1. Cria e Atualiza a Tabela Coringa de Configuração da Simulação
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS config_simulacao (
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT UNIQUE, 
                nome_empresa TEXT, 
                capital_total REAL, 
                valor_aluguel REAL DEFAULT 0
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
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT, 
                departamento TEXT, 
                orcamento_liberado REAL,
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
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT, 
                departamento TEXT, 
                descricao TEXT, 
                valor REAL, 
                tipo TEXT
            )
        ''')
        
        conexao.commit()
        cursor.close()
        
        # Atualiza a sessão corrente de forma estável com strings normatizadas em caixa alta
        session['nome_empresa'] = nome_empresa.upper()
        session['capital_inicial'] = capital_total
        session['empresa_inicializada'] = True
        
        return jsonify({'status': 'sucesso'})

    except psycopg2.DatabaseError as e:
        if conexao:
            conexao.rollback()
        print(f"Erro crítico no banco de dados Supabase: {e}")
        return jsonify({'status': 'erro', 'message': 'Falha interna ao persistir dados no banco de dados.'}), 500
        
    finally:
        # Garante que a conexão será desalocada mesmo se a query falhar no Supabase
        if conexao:
            conexao.close()
