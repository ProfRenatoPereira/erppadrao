import os
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, render_template_string, session, jsonify, redirect
import psycopg2
from psycopg2.extras import RealDictCursor

configuracao_blueprint = Blueprint('configuracao_blueprint', __name__)

def obtener_conexao_master():
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

def tabela_existe(cursor, nome_tabela):
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        ) AS existe
    """, (nome_tabela,))
    resultado = cursor.fetchone()
    return bool(resultado and resultado['existe'])

def coluna_existe(cursor, nome_tabela, nome_coluna):
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        ) AS existe
    """, (nome_tabela, nome_coluna))
    resultado = cursor.fetchone()
    return bool(resultado and resultado['existe'])

def converter_capital(valor):
    if valor is None:
        raise ValueError('Capital inicial não informado.')
    texto = str(valor).strip().replace(' ', '')
    if not texto:
        raise ValueError('Capital inicial não informado.')
    if ',' in texto:
        texto = texto.replace('.', '').replace(',', '.')
    try:
        valor_decimal = Decimal(texto)
    except InvalidOperation:
        raise ValueError('Formato de capital inicial inválido.')
    if valor_decimal < Decimal('10000'):
        raise ValueError('O capital total integralizado deve ser de no mínimo R$ 10.000,00.')
    return valor_decimal.quantize(Decimal('0.01'))

@configuracao_blueprint.route('/configuracao/inicializacao', methods=['GET'])
def rota_inicializacao_html():
    if not session.get('logado'):
        return redirect('/login')
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inicializacao.html')
    try:
        with open(caminho, 'r', encoding='utf-8') as arquivo:
            return render_template_string(arquivo.read())
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'inicializacao.html' não encontrado no servidor.", 404

@configuracao_blueprint.route('/configuracao/inicializacao.js', methods=['GET'])
def rota_inicializacao_js():
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inicializacao.js')
    try:
        with open(caminho, 'r', encoding='utf-8') as arquivo:
            return arquivo.read(), 200, {'Content-Type': 'application/javascript; charset=utf-8'}
    except FileNotFoundError:
        return "console.error('Erro Crítico: inicializacao.js não encontrado.');", 404, {'Content-Type': 'application/javascript; charset=utf-8'}

@configuracao_blueprint.route('/api/configuracao/inicializar', methods=['POST'])
def api_inicializar_empresa():
    if not session.get('logado'):
        return jsonify(status='erro', message='Não autenticado. Efetue o login novamente.'), 401

    id_equipe = session.get('id_equipe')
    if not id_equipe:
        return jsonify(status='erro', message='Equipe não identificada na sessão.'), 400
    id_equipe = str(id_equipe).strip().lower()

    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(status='erro', message='Dados de requisição ausentes.'), 400

    nome_empresa = str(dados.get('nome_empresa', '')).strip()
    if not nome_empresa:
        return jsonify(status='erro', message='O nome da empresa simulada não pode ficar em branco.'), 400
    if len(nome_empresa) > 200:
        return jsonify(status='erro', message='O nome da empresa é muito longo.'), 400

    try:
        capital_total = converter_capital(dados.get('capital_total'))
    except ValueError as erro:
        return jsonify(status='erro', message=str(erro)), 400

    conexao = None
    cursor = None

    try:
        conexao = obtener_conexao_master()
        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config_simulacao (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT UNIQUE,
                nome_empresa TEXT,
                capital_total NUMERIC(18,2),
                valor_aluguel NUMERIC(18,2) DEFAULT 0
            )
        """)

        cursor.execute("""
            INSERT INTO config_simulacao
                (equipe_id, nome_empresa, capital_total, valor_aluguel)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (equipe_id) DO UPDATE SET
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total
        """, (id_equipe, nome_empresa, capital_total, Decimal('0')))

        if tabela_existe(cursor, 'configuracao_equipes'):
            tem_equipe = coluna_existe(cursor, 'configuracao_equipes', 'equipe_id')
            tem_capital = coluna_existe(cursor, 'configuracao_equipes', 'capital_inicial')
            tem_updated = coluna_existe(cursor, 'configuracao_equipes', 'updated_at')

            if tem_equipe and tem_capital:
                if tem_updated:
                    cursor.execute("""
                        UPDATE configuracao_equipes
                        SET capital_inicial = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE equipe_id = %s
                    """, (capital_total, id_equipe))
                else:
                    cursor.execute("""
                        UPDATE configuracao_equipes
                        SET capital_inicial = %s
                        WHERE equipe_id = %s
                    """, (capital_total, id_equipe))

                if cursor.rowcount == 0:
                    cursor.execute("""
                        INSERT INTO configuracao_equipes (equipe_id, capital_inicial)
                        VALUES (%s, %s)
                    """, (id_equipe, capital_total))

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS departamentos_orcamento (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT NOT NULL,
                departamento TEXT NOT NULL,
                orcamento_liberado NUMERIC(18,2) NOT NULL DEFAULT 0,
                UNIQUE(equipe_id, departamento)
            )
        """)

        orcamentos = [
            (id_equipe, 'maquinas', capital_total * Decimal('0.40')),
            (id_equipe, 'rh', capital_total * Decimal('0.30')),
            (id_equipe, 'materiais', capital_total * Decimal('0.30'))
        ]

        cursor.executemany("""
            INSERT INTO departamentos_orcamento
                (equipe_id, departamento, orcamento_liberado)
            VALUES (%s, %s, %s)
            ON CONFLICT (equipe_id, departamento)
            DO UPDATE SET orcamento_liberado = EXCLUDED.orcamento_liberado
        """, orcamentos)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fluxo_caixa (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT,
                departamento TEXT,
                descricao TEXT,
                valor NUMERIC(18,2),
                tipo TEXT
            )
        """)

        conexao.commit()

        session['logado'] = True
        session['id_equipe'] = id_equipe
        session['nome_empresa'] = nome_empresa.upper()
        session['capital_inicial'] = float(capital_total)
        session['empresa_inicializada'] = True
        session.permanent = True

        return jsonify(
            status='sucesso',
            message='Empresa inicializada e sincronizada com sucesso.',
            equipe_id=id_equipe,
            nome_empresa=nome_empresa.upper(),
            capital_total=float(capital_total)
        ), 200

    except psycopg2.DatabaseError as erro:
        if conexao:
            conexao.rollback()
        print('❌ ERRO DE BANCO NA INICIALIZAÇÃO:', erro)
        return jsonify(status='erro', message='Falha interna ao persistir a configuração no banco de dados.'), 500

    except Exception as erro:
        if conexao:
            conexao.rollback()
        print('❌ ERRO CRÍTICO NA INICIALIZAÇÃO:', erro)
        return jsonify(status='erro', message='Erro inesperado ao inicializar a empresa.'), 500

    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        if conexao:
            try: conexao.close()
            except Exception: pass
