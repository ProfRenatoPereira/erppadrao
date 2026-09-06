# ==========================================================================
# TERADMAS ERP v2.6 - CONFIGURAÇÃO / INICIALIZAÇÃO DA EMPRESA
# ARQUIVO: configuracao/app_configuracao.py
#
# CORREÇÕES:
# - Persiste a inicialização no config_simulacao
# - Sincroniza configuracao_equipes quando a tabela existir
# - Não cria uma segunda fonte de capital diferente da configuração
# - Mantém departamentos_orcamento sincronizado
# - Inicializa fluxo_caixa sem apagar movimentações existentes
# - Usa a equipe da sessão como chave principal
# - Commit único para evitar banco parcialmente atualizado
# ==========================================================================

import os
from decimal import Decimal, InvalidOperation

from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    redirect
)

import psycopg2
from psycopg2.extras import RealDictCursor


configuracao_blueprint = Blueprint(
    'configuracao_blueprint',
    __name__
)


# ==========================================================================
# CONEXÃO CENTRAL
# ==========================================================================

def obtener_conexao_master():
    """
    Usa exatamente a mesma DATABASE_URL utilizada pelo app_master.py.
    """
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)


# ==========================================================================
# AUXILIARES
# ==========================================================================

def tabela_existe(cursor, nome_tabela):
    """
    Verifica se uma tabela existe no schema public.
    """
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = %s
        ) AS existe
        """,
        (nome_tabela,)
    )

    resultado = cursor.fetchone()

    if not resultado:
        return False

    return bool(resultado['existe'])


def coluna_existe(cursor, nome_tabela, nome_coluna):
    """
    Verifica se uma determinada coluna existe em uma tabela.
    """
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        ) AS existe
        """,
        (nome_tabela, nome_coluna)
    )

    resultado = cursor.fetchone()

    if not resultado:
        return False

    return bool(resultado['existe'])


def converter_capital(valor):
    """
    Conversão robusta de valores monetários enviados pelo navegador.

    Aceita:
        10000000
        10000000.00
        10000000,00
        "10000000,00"
    """

    if valor is None:
        raise ValueError("Capital inicial não informado.")

    texto = str(valor).strip()

    if not texto:
        raise ValueError("Capital inicial não informado.")

    # Remove espaços
    texto = texto.replace(" ", "")

    # Aceita padrão brasileiro:
    # 10.000.000,00
    if "," in texto:
        texto = texto.replace(".", "")
        texto = texto.replace(",", ".")

    try:
        valor_decimal = Decimal(texto)
    except InvalidOperation:
        raise ValueError("Formato de capital inicial inválido.")

    if valor_decimal <= 0:
        raise ValueError(
            "O capital total integralizado deve ser maior que zero."
        )

    return valor_decimal


# ==========================================================================
# ROTA HTML DA INICIALIZAÇÃO
# ==========================================================================

@configuracao_blueprint.route(
    '/configuracao/inicializacao',
    methods=['GET']
)
def rota_inicializacao_html():

    if not session.get('logado'):
        return redirect('/login')

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_html = os.path.join(
        diretorio_atual,
        'inicializacao.html'
    )

    try:
        with open(
            caminho_html,
            'r',
            encoding='utf-8'
        ) as arquivo:

            html = arquivo.read()

        return render_template_string(html)

    except FileNotFoundError:

        return (
            "Erro Crítico: Arquivo "
            "'inicializacao.html' não encontrado no servidor.",
            404
        )


# ==========================================================================
# ROTA JAVASCRIPT
# ==========================================================================

@configuracao_blueprint.route(
    '/configuracao/inicializacao.js',
    methods=['GET']
)
def rota_inicializacao_js():

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    caminho_js = os.path.join(
        diretorio_atual,
        'inicializacao.js'
    )

    try:
        with open(
            caminho_js,
            'r',
            encoding='utf-8'
        ) as arquivo:

            js_conteudo = arquivo.read()

        return (
            js_conteudo,
            200,
            {
                'Content-Type':
                'application/javascript; charset=utf-8'
            }
        )

    except FileNotFoundError:

        return (
            "console.error("
            "'Erro Crítico: arquivo inicializacao.js não encontrado.'"
            ");",
            404,
            {
                'Content-Type':
                'application/javascript; charset=utf-8'
            }
        )


# ==========================================================================
# API PRINCIPAL DE INICIALIZAÇÃO
# ==========================================================================

@configuracao_blueprint.route(
    '/api/configuracao/inicializar',
    methods=['POST']
)
def api_inicializar_empresa():

    # ----------------------------------------------------------------------
    # 1. AUTENTICAÇÃO
    # ----------------------------------------------------------------------

    if not session.get('logado'):

        return jsonify({
            'status': 'erro',
            'message':
                'Não autenticado. Efetue o login novamente.'
        }), 401


    # ----------------------------------------------------------------------
    # 2. IDENTIFICAÇÃO DA EQUIPE
    # ----------------------------------------------------------------------

    id_equipe = session.get('id_equipe')

    if not id_equipe:

        return jsonify({
            'status': 'erro',
            'message':
                'Equipe não identificada na sessão.'
        }), 400


    id_equipe = str(id_equipe).strip().lower()


    # ----------------------------------------------------------------------
    # 3. LEITURA DO JSON
    # ----------------------------------------------------------------------

    dados = request.get_json(
        silent=True
    )

    if not dados:

        return jsonify({
            'status': 'erro',
            'message':
                'Dados de requisição ausentes.'
        }), 400


    # ----------------------------------------------------------------------
    # 4. NOME DA EMPRESA
    # ----------------------------------------------------------------------

    nome_empresa = str(
        dados.get('nome_empresa', '')
    ).strip()

    if not nome_empresa:

        return jsonify({
            'status': 'erro',
            'message':
                'O nome da empresa simulada não pode ficar em branco.'
        }), 400


    # ----------------------------------------------------------------------
    # 5. CAPITAL INICIAL
    # ----------------------------------------------------------------------

    try:

        capital_total = converter_capital(
            dados.get('capital_total')
        )

    except ValueError as erro:

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 400


    # ----------------------------------------------------------------------
    # 6. CONEXÃO
    # ----------------------------------------------------------------------

    conexao = None
    cursor = None

    try:

        conexao = obtener_conexao_master()

        if not conexao:

            raise psycopg2.DatabaseError(
                'Não foi possível estabelecer conexão com o banco.'
            )

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )


        # ==================================================================
        # 7. CONFIG_SIMULACAO
        #
        # Esta é a tabela utilizada pelo GerenciadorCaixa.py revisado.
        # ==================================================================

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS config_simulacao (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT UNIQUE,
                nome_empresa TEXT,
                capital_total NUMERIC(18,2),
                valor_aluguel NUMERIC(18,2) DEFAULT 0
            )
            """
        )


        cursor.execute(
            """
            INSERT INTO config_simulacao
                (
                    equipe_id,
                    nome_empresa,
                    capital_total,
                    valor_aluguel
                )
            VALUES
                (%s, %s, %s, %s)

            ON CONFLICT (equipe_id)
            DO UPDATE SET
                nome_empresa = EXCLUDED.nome_empresa,
                capital_total = EXCLUDED.capital_total
            """,
            (
                id_equipe,
                nome_empresa,
                capital_total,
                Decimal('0')
            )
        )


        # ==================================================================
        # 8. CONFIGURACAO_EQUIPES
        #
        # IMPORTANTE:
        # O Supabase mostrado por você possui esta tabela com:
        #
        # equipe_id
        # capital_inicial
        #
        # Portanto sincronizamos o capital nela também.
        # ==================================================================

        if tabela_existe(
            cursor,
            'configuracao_equipes'
        ):

            possui_equipe_id = coluna_existe(
                cursor,
                'configuracao_equipes',
                'equipe_id'
            )

            possui_capital_inicial = coluna_existe(
                cursor,
                'configuracao_equipes',
                'capital_inicial'
            )

            if (
                possui_equipe_id
                and possui_capital_inicial
            ):

                cursor.execute(
                    """
                    UPDATE configuracao_equipes
                    SET
                        capital_inicial = %s,
                        updated_at = CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM information_schema.columns
                                WHERE table_schema = 'public'
                                  AND table_name = 'configuracao_equipes'
                                  AND column_name = 'updated_at'
                            )
                            THEN CURRENT_TIMESTAMP
                            ELSE updated_at
                        END
                    WHERE equipe_id = %s
                    """,
                    (
                        capital_total,
                        id_equipe
                    )
                )

                # Se não existia registro para a equipe,
                # cria um novo somente com as colunas que conhecemos.
                if cursor.rowcount == 0:

                    cursor.execute(
                        """
                        INSERT INTO configuracao_equipes
                            (
                                equipe_id,
                                capital_inicial
                            )
                        VALUES
                            (%s, %s)
                        """,
                        (
                            id_equipe,
                            capital_total
                        )
                    )


        # ==================================================================
        # 9. DEPARTAMENTOS_ORCAMENTO
        #
        # Distribuição didática:
        #
        # máquinas  = 40%
        # rh        = 30%
        # materiais = 30%
        # ==================================================================

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS departamentos_orcamento (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT NOT NULL,
                departamento TEXT NOT NULL,
                orcamento_liberado NUMERIC(18,2) NOT NULL DEFAULT 0,
                UNIQUE(equipe_id, departamento)
            )
            """
        )


        orcamentos = [

            (
                id_equipe,
                'maquinas',
                capital_total * Decimal('0.40')
            ),

            (
                id_equipe,
                'rh',
                capital_total * Decimal('0.30')
            ),

            (
                id_equipe,
                'materiais',
                capital_total * Decimal('0.30')
            )

        ]


        cursor.executemany(
            """
            INSERT INTO departamentos_orcamento
                (
                    equipe_id,
                    departamento,
                    orcamento_liberado
                )
            VALUES
                (%s, %s, %s)

            ON CONFLICT
                (equipe_id, departamento)

            DO UPDATE SET
                orcamento_liberado =
                    EXCLUDED.orcamento_liberado
            """,
            orcamentos
        )


        # ==================================================================
        # 10. FLUXO DE CAIXA
        #
        # Somente cria a estrutura.
        # NÃO apaga lançamentos anteriores.
        # ==================================================================

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS fluxo_caixa (
                id SERIAL PRIMARY KEY,
                equipe_id TEXT,
                departamento TEXT,
                descricao TEXT,
                valor NUMERIC(18,2),
                tipo TEXT
            )
            """
        )


        # ==================================================================
        # 11. COMMIT ÚNICO
        # ==================================================================

        conexao.commit()


        # ==================================================================
        # 12. ATUALIZAÇÃO DA SESSÃO
        # ==================================================================

        session['logado'] = True
        session['id_equipe'] = id_equipe
        session['nome_empresa'] = nome_empresa.upper()
        session['capital_inicial'] = float(
            capital_total
        )
        session['empresa_inicializada'] = True
        session.permanent = True


        # ==================================================================
        # 13. RESPOSTA
        # ==================================================================

        return jsonify({
            'status': 'sucesso',
            'message':
                'Empresa inicializada e sincronizada com sucesso.',
            'equipe_id': id_equipe,
            'nome_empresa': nome_empresa.upper(),
            'capital_total': float(capital_total)
        }), 200


    except psycopg2.DatabaseError as erro:

        if conexao:
            conexao.rollback()

        print(
            '❌ ERRO DE BANCO NA INICIALIZAÇÃO:',
            erro
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Falha interna ao persistir a configuração '
                'no banco de dados.'
        }), 500


    except Exception as erro:

        if conexao:
            conexao.rollback()

        print(
            '❌ ERRO CRÍTICO NA INICIALIZAÇÃO:',
            erro
        )

        return jsonify({
            'status': 'erro',
            'message':
                'Erro inesperado ao inicializar a empresa.'
        }), 500


    finally:

        if cursor:

            try:
                cursor.close()
            except Exception:
                pass

        if conexao:

            try:
                conexao.close()
            except Exception:
                pass
