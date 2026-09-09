# erppadrao - financeiro/app_financeiro.py

from flask import (
    Blueprint,
    request,
    render_template_string,
    session,
    jsonify,
    send_from_directory
)

from psycopg2.extras import RealDictCursor

import os


financeiro_blueprint = Blueprint(
    'financeiro_blueprint',
    __name__
)


# ============================================================
# CONEXÃO CENTRAL
# ============================================================

def obter_conexao_master():
    """
    Obtém uma conexão através do GerenciadorCaixa.
    O gerenciamento do pool permanece centralizado.
    """

    import GerenciadorCaixa

    conexao = GerenciadorCaixa.obter_conexao_master()

    if conexao is None:
        raise RuntimeError(
            "Não foi possível obter conexão com o banco via GerenciadorCaixa."
        )

    return conexao


def liberar_conexao(conexao):
    """
    Devolve a conexão ao gerenciador central.
    """

    if conexao is None:
        return

    try:
        import GerenciadorCaixa

        GerenciadorCaixa.liberar_conexao_master(
            conexao
        )

    except Exception:
        try:
            conexao.close()
        except Exception:
            pass


# ============================================================
# TABELAS
# ============================================================

def garantir_tabelas_financeiras(cursor):
    """
    Garante as estruturas utilizadas pelo módulo Financeiro.

    Observação:
    CREATE TABLE IF NOT EXISTS é mantido para compatibilidade
    com instalações existentes.
    """

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS razao_financeiro (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            cliente_id INTEGER,
            cliente_nome_suporte TEXT,
            financeiro_descricao TEXT,
            financeiro_valor REAL NOT NULL DEFAULT 0,
            financeiro_condicao TEXT,
            financeiro_data TEXT,
            status_titulo TEXT NOT NULL DEFAULT 'Aberto'
        )
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_razao_financeiro_equipe
        ON razao_financeiro (equipe_id)
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS quotas_departamentos (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento_id TEXT NOT NULL,
            porcentagem_quota REAL NOT NULL DEFAULT 0,
            CONSTRAINT unique_equipe_depto
                UNIQUE (equipe_id, departamento_id)
        )
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_quotas_departamentos_equipe
        ON quotas_departamentos (equipe_id)
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS fluxo_caixa (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento TEXT,
            descricao TEXT,
            valor REAL NOT NULL DEFAULT 0,
            tipo TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_equipe
        ON fluxo_caixa (equipe_id)
        """
    )


# ============================================================
# AUTENTICAÇÃO
# ============================================================

def usuario_logado():
    return bool(
        session.get('logado')
    )


def resposta_nao_autenticado():
    return jsonify({
        'status': 'erro',
        'message': 'Não autenticado'
    }), 401


def obter_id_equipe():
    return str(
        session.get(
            'id_equipe',
            'equipe_alfa'
        )
    )


# ============================================================
# PÁGINA
# ============================================================

@financeiro_blueprint.route('/financeiro')
def pagina_financeiro():

    if not usuario_logado():
        return resposta_nao_autenticado()

    caminho_html = os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        'financeiro.html'
    )

    with open(
        caminho_html,
        'r',
        encoding='utf-8'
    ) as arquivo:

        html = arquivo.read()

    return render_template_string(
        html
    )


# ============================================================
# JAVASCRIPT
# ============================================================

@financeiro_blueprint.route(
    '/financeiro/financeiro.js'
)
def servir_js_financeiro():

    diretorio_atual = os.path.dirname(
        os.path.abspath(__file__)
    )

    return send_from_directory(
        diretorio_atual,
        'financeiro.js',
        mimetype='application/javascript'
    )


# ============================================================
# FATURAMENTO
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/faturar',
    methods=['POST']
)
def api_faturar_titulo():

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        dados = request.get_json(
            silent=True
        ) or {}

        cliente_id = int(
            dados.get(
                'cliente_id',
                0
            ) or 0
        )

        cliente_nome = str(
            dados.get(
                'cliente_nome_suporte',
                ''
            ) or ''
        ).strip()

        descricao = str(
            dados.get(
                'financeiro_descricao',
                ''
            ) or ''
        ).strip()

        valor = float(
            dados.get(
                'financeiro_valor',
                0
            ) or 0
        )

        condicao = str(
            dados.get(
                'financeiro_condicao',
                ''
            ) or ''
        ).strip()

        data_financeiro = str(
            dados.get(
                'financeiro_data',
                ''
            ) or ''
        ).strip()

        if cliente_id <= 0:
            return jsonify({
                'status': 'erro',
                'message': 'ID do cliente inválido.'
            }), 400

        if not cliente_nome:
            return jsonify({
                'status': 'erro',
                'message': 'Nome do cliente é obrigatório.'
            }), 400

        if not descricao:
            return jsonify({
                'status': 'erro',
                'message': 'Descrição financeira é obrigatória.'
            }), 400

        if valor <= 0:
            return jsonify({
                'status': 'erro',
                'message': 'Valor financeiro deve ser maior que zero.'
            }), 400

        if not data_financeiro:
            return jsonify({
                'status': 'erro',
                'message': 'Data financeira é obrigatória.'
            }), 400

        id_equipe = obter_id_equipe()

        conexao = obter_conexao_master()

        cursor = conexao.cursor()

        garantir_tabelas_financeiras(
            cursor
        )

        cursor.execute(
            """
            INSERT INTO razao_financeiro (
                equipe_id,
                cliente_id,
                cliente_nome_suporte,
                financeiro_descricao,
                financeiro_valor,
                financeiro_condicao,
                financeiro_data,
                status_titulo
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'Aberto'
            )
            RETURNING id
            """,
            (
                id_equipe,
                cliente_id,
                cliente_nome,
                descricao,
                valor,
                condicao,
                data_financeiro
            )
        )

        registro = cursor.fetchone()

        conexao.commit()

        cursor.close()

        return jsonify({
            'status': 'sucesso',
            'id': registro[0] if registro else None
        }), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# LISTAGEM DO RAZÃO
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/listar',
    methods=['GET']
)
def api_listar_titulos():

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        id_equipe = obter_id_equipe()

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabelas_financeiras(
            cursor
        )

        conexao.commit()

        cursor.execute(
            """
            SELECT
                id,
                equipe_id,
                cliente_id,
                cliente_nome_suporte,
                financeiro_descricao,
                financeiro_valor,
                financeiro_condicao,
                financeiro_data,
                status_titulo
            FROM razao_financeiro
            WHERE equipe_id = %s
            ORDER BY id DESC
            """,
            (
                id_equipe,
            )
        )

        linhas = cursor.fetchall()

        cursor.close()

        return jsonify(
            [dict(linha) for linha in linhas]
        ), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# LIQUIDAÇÃO
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/liquidar/<int:id_reg>',
    methods=['POST']
)
def api_liquidar_titulo_id(id_reg):

    if not usuario_logado():
        return resposta_nao_autenticado()

    if id_reg <= 0:
        return jsonify({
            'status': 'erro',
            'message': 'ID de título inválido.'
        }), 400

    conexao = None

    try:

        id_equipe = obter_id_equipe()

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabelas_financeiras(
            cursor
        )

        cursor.execute(
            """
            SELECT *
            FROM razao_financeiro
            WHERE id = %s
              AND equipe_id = %s
              AND status_titulo = 'Aberto'
            FOR UPDATE
            """,
            (
                id_reg,
                id_equipe
            )
        )

        titulo = cursor.fetchone()

        if not titulo:

            conexao.rollback()

            cursor.close()

            return jsonify({
                'status': 'erro',
                'message':
                    'Título não encontrado, já liquidado ou pertencente a outra equipe.'
            }), 404

        valor_recebimento = float(
            titulo.get(
                'financeiro_valor',
                0
            ) or 0
        )

        descricao = str(
            titulo.get(
                'financeiro_descricao',
                ''
            ) or ''
        )

        descricao_caixa = (
            f"Recebimento Duplicata "
            f"FT-00{id_reg} - {descricao}"
        )

        cursor.execute(
            """
            UPDATE razao_financeiro
            SET status_titulo = 'Liquidado'
            WHERE id = %s
              AND equipe_id = %s
            """,
            (
                id_reg,
                id_equipe
            )
        )

        cursor.execute(
            """
            INSERT INTO fluxo_caixa (
                equipe_id,
                departamento,
                descricao,
                valor,
                tipo
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                id_equipe,
                'financeiro',
                descricao_caixa,
                valor_recebimento,
                'LIQUIDAÇÃO'
            )
        )

        conexao.commit()

        cursor.close()

        return jsonify({
            'status': 'sucesso',
            'id': id_reg,
            'valor_liquidado': valor_recebimento
        }), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# SALVAR QUOTA
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/quota',
    methods=['POST']
)
def api_salvar_quota_setorial():

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        dados = request.get_json(
            silent=True
        ) or {}

        id_equipe = obter_id_equipe()

        depto = str(
            dados.get(
                'departamento_id',
                ''
            ) or ''
        ).strip()

        porcentagem = float(
            dados.get(
                'porcentagem_quota',
                0
            ) or 0
        )

        if not depto:
            return jsonify({
                'status': 'erro',
                'message':
                    'Departamento de destino é obrigatório.'
            }), 400

        if porcentagem < 0 or porcentagem > 100:
            return jsonify({
                'status': 'erro',
                'message':
                    'A porcentagem da quota deve estar entre 0 e 100.'
            }), 400

        conexao = obter_conexao_master()

        cursor = conexao.cursor()

        garantir_tabelas_financeiras(
            cursor
        )

        cursor.execute(
            """
            INSERT INTO quotas_departamentos (
                equipe_id,
                departamento_id,
                porcentagem_quota
            )
            VALUES (
                %s,
                %s,
                %s
            )
            ON CONFLICT (
                equipe_id,
                departamento_id
            )
            DO UPDATE SET
                porcentagem_quota =
                    EXCLUDED.porcentagem_quota
            RETURNING id, departamento_id, porcentagem_quota
            """,
            (
                id_equipe,
                depto,
                porcentagem
            )
        )

        registro = cursor.fetchone()

        conexao.commit()

        cursor.close()

        return jsonify({
            'status': 'sucesso',
            'departamento_id': depto,
            'porcentagem_quota': porcentagem,
            'id': registro[0] if registro else None
        }), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# BUSCAR QUOTA DE DEPARTAMENTO
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/quota/<string:depto_id>',
    methods=['GET']
)
def api_buscar_quota_depto(depto_id):

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        id_equipe = obter_id_equipe()

        depto_id = str(
            depto_id
        ).strip()

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabelas_financeiras(
            cursor
        )

        conexao.commit()

        cursor.execute(
            """
            SELECT
                departamento_id,
                porcentagem_quota
            FROM quotas_departamentos
            WHERE equipe_id = %s
              AND departamento_id = %s
            LIMIT 1
            """,
            (
                id_equipe,
                depto_id
            )
        )

        registro = cursor.fetchone()

        cursor.close()

        if registro:

            return jsonify(
                dict(registro)
            ), 200

        return jsonify({
            'departamento_id': depto_id,
            'porcentagem_quota': 0
        }), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro),
            'porcentagem_quota': 0
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# RESUMO DE QUOTAS
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/quotas/summary',
    methods=['GET']
)
def api_obter_resumo_quotas():

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        id_equipe = obter_id_equipe()

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabelas_financeiras(
            cursor
        )

        conexao.commit()

        cursor.execute(
            """
            SELECT
                departamento_id,
                porcentagem_quota
            FROM quotas_departamentos
            WHERE equipe_id = %s
              AND porcentagem_quota > 0
            ORDER BY porcentagem_quota DESC,
                     departamento_id ASC
            """,
            (
                id_equipe,
            )
        )

        linhas = cursor.fetchall()

        cursor.close()

        return jsonify(
            [dict(linha) for linha in linhas]
        ), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro)
        }), 500

    finally:

        liberar_conexao(
            conexao
        )


# ============================================================
# MÉTRICAS FINANCEIRAS
# ============================================================

@financeiro_blueprint.route(
    '/api/financeiro/metricas',
    methods=['GET']
)
def api_metricas_financeiras():

    if not usuario_logado():
        return resposta_nao_autenticado()

    conexao = None

    try:

        id_equipe = obter_id_equipe()

        conexao = obter_conexao_master()

        cursor = conexao.cursor(
            cursor_factory=RealDictCursor
        )

        garantir_tabelas_financeiras(
            cursor
        )

        # ----------------------------------------------------
        # CAPITAL TOTAL
        #
        # O módulo Financeiro não cria o capital de fundação.
        # Ele procura estruturas já existentes no ERP.
        # ----------------------------------------------------

        capital_total = 0.0

        tabelas_candidatas = [
            (
                'capital_fundacao',
                'valor',
                'equipe_id'
            ),
            (
                'fundacao_capital',
                'valor',
                'equipe_id'
            ),
            (
                'capital_inicial',
                'valor',
                'equipe_id'
            )
        ]

        for tabela, coluna_valor, coluna_equipe in tabelas_candidatas:

            try:

                cursor.execute(
                    f"""
                    SELECT COALESCE(
                        SUM({coluna_valor}),
                        0
                    ) AS total
                    FROM {tabela}
                    WHERE {coluna_equipe} = %s
                    """,
                    (
                        id_equipe,
                    )
                )

                resultado = cursor.fetchone()

                if resultado:

                    valor = float(
                        resultado.get(
                            'total',
                            0
                        ) or 0
                    )

                    if valor != 0:
                        capital_total = valor
                        break

            except Exception:

                # Uma tabela candidata inexistente não deve
                # derrubar o dashboard financeiro.
                conexao.rollback()

                continue

        # ----------------------------------------------------
        # QUOTAS RESERVADAS
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COALESCE(
                SUM(porcentagem_quota),
                0
            ) AS percentual_total
            FROM quotas_departamentos
            WHERE equipe_id = %s
            """,
            (
                id_equipe,
            )
        )

        resultado_quota =
            cursor.fetchone()

        percentual_reservado = float(
            resultado_quota.get(
                'percentual_total',
                0
            ) or 0
        )

        # ----------------------------------------------------
        # PROTEÇÃO CONTRA SOMA SUPERIOR A 100%
        # ----------------------------------------------------

        percentual_reservado = max(
            0.0,
            min(
                100.0,
                percentual_reservado
            )
        )

        valor_quotas_reservadas =
            capital_total * (
                percentual_reservado / 100.0
            )

        capital_disponivel =
            capital_total - valor_quotas_reservadas

        if capital_disponivel < 0:
            capital_disponivel = 0.0

        # ----------------------------------------------------
        # FATURAMENTO ATIVO
        #
        # Considera títulos ainda em aberto.
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COALESCE(
                SUM(financeiro_valor),
                0
            ) AS total
            FROM razao_financeiro
            WHERE equipe_id = %s
              AND LOWER(
                    COALESCE(
                        status_titulo,
                        ''
                    )
                  ) = 'aberto'
            """,
            (
                id_equipe,
            )
        )

        resultado_faturamento =
            cursor.fetchone()

        patrimonio_ativo_total = float(
            resultado_faturamento.get(
                'total',
                0
            ) or 0
        )

        # ----------------------------------------------------
        # CUSTO FIXO
        #
        # O módulo Financeiro não inventa uma origem.
        # Consulta estruturas existentes quando disponíveis.
        # ----------------------------------------------------

        custo_fixo_geral_empresa = 0.0

        tabelas_custo = [
            (
                'custos_fixos',
                'valor',
                'equipe_id'
            ),
            (
                'custos',
                'valor',
                'equipe_id'
            ),
            (
                'estrutura_custos',
                'custo_fixo',
                'equipe_id'
            )
        ]

        for tabela, coluna_valor, coluna_equipe in tabelas_custo:

            try:

                cursor.execute(
                    f"""
                    SELECT COALESCE(
                        SUM({coluna_valor}),
                        0
                    ) AS total
                    FROM {tabela}
                    WHERE {coluna_equipe} = %s
                    """,
                    (
                        id_equipe,
                    )
                )

                resultado_custo =
                    cursor.fetchone()

                if resultado_custo:

                    valor_custo = float(
                        resultado_custo.get(
                            'total',
                            0
                        ) or 0
                    )

                    if valor_custo != 0:

                        custo_fixo_geral_empresa = (
                            valor_custo
                        )

                        break

            except Exception:

                conexao.rollback()

                continue

        conexao.commit()

        cursor.close()

        return jsonify({
            'status': 'sucesso',

            'capital_total':
                capital_total,

            'capital_disponivel_total':
                capital_disponivel,

            'patrimonio_ativo_total':
                patrimonio_ativo_total,

            'custo_fixo_geral_empresa':
                custo_fixo_geral_empresa,

            'percentual_capital_reservado':
                percentual_reservado,

            'valor_quotas_reservadas':
                valor_quotas_reservadas

        }), 200

    except Exception as erro:

        if conexao is not None:

            try:
                conexao.rollback()
            except Exception:
                pass

        return jsonify({
            'status': 'erro',
            'message': str(erro),

            'capital_total': 0,
            'capital_disponivel_total': 0,
            'patrimonio_ativo_total': 0,
            'custo_fixo_geral_empresa': 0
        }), 500

    finally:

        liberar_conexao(
            conexao
        )
