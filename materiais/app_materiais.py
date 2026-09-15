# ============================================================================
# TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
# APP PYTHON - VERSÃO CORRIGIDA E INTEGRADA AO MOTOR FINANCEIRO CENTRAL
#
# Regras desta versão:
# - Conexão exclusivamente por GerenciadorCaixa.
# - Nunca fecha diretamente uma conexão devolvida pelo pool.
# - Isolamento por equipe_id vindo da sessão.
# - A estrutura de erp_materiais é garantida antes de qualquer CRUD.
# - O painel financeiro não usa mais capital/quota fixos em JavaScript.
# - O orçamento do módulo é obtido da quota oficial de
#   quotas_departamentos para o identificador "materiais".
# - A quota monetária é calculada sobre o capital inicial real.
# - Não há pesquisa externa/internet neste módulo.
# ============================================================================

import logging
import os

from flask import Blueprint, jsonify, redirect, render_template_string, request, session
from psycopg2.extras import RealDictCursor

from GerenciadorCaixa import obter_conexao_master, liberar_conexao_master

logger = logging.getLogger(__name__)

materiais_blueprint = Blueprint("materiais_blueprint", __name__)


def equipe_atual():
    return str(session.get("id_equipe", "equipe_alfa"))


def autenticado():
    return bool(session.get("logado"))


def numero(valor, padrao=0.0):
    if valor in (None, ""):
        return float(padrao)
    try:
        return float(str(valor).replace(",", ".").strip())
    except (TypeError, ValueError):
        return float(padrao)


def inteiro(valor, padrao=0):
    if valor in (None, ""):
        return int(padrao)
    try:
        return int(float(str(valor).replace(",", ".").strip()))
    except (TypeError, ValueError):
        return int(padrao)


def garantir_tabela_materiais(cursor):
    """Garante somente a estrutura técnica usada pelo módulo."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS erp_materiais (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL
        )
        """
    )

    colunas = {
        "nome_material": "TEXT",
        "codigo_sku": "TEXT",
        "categoria": "TEXT",
        "unidade_medida": "TEXT",
        "preco_unitario": "REAL",
        "coeficiente_refugo": "REAL",
        "lead_time_entrega": "INTEGER",
        "estoque_seguranca": "REAL",
        "fornecedor_padrao": "TEXT",
        "especificacao_tecnica": "TEXT",
        "dim_diametro": "TEXT",
        "dim_espessura": "TEXT",
        "dim_comprimento": "REAL",
        "custo_total_integrado": "REAL",
    }

    for nome, tipo in colunas.items():
        cursor.execute(
            f"ALTER TABLE erp_materiais ADD COLUMN IF NOT EXISTS {nome} {tipo}"
        )


@materiais_blueprint.route("/materiais", methods=["GET"])
def pagina_materiais():
    if not autenticado():
        return redirect("/login")
    if not session.get("empresa_inicializada"):
        return redirect("/configuracao/inicializacao")

    caminho_html = os.path.join(os.path.dirname(os.path.abspath(__file__)), "materiais.html")
    try:
        with open(caminho_html, "r", encoding="utf-8") as arquivo:
            return render_template_string(arquivo.read())
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'materiais.html' não encontrado.", 404
    except Exception as erro:
        logger.exception("Erro ao renderizar Materiais: %s", erro)
        return "Erro ao carregar o módulo de Materiais.", 500


@materiais_blueprint.route("/materiais/materiais.js", methods=["GET"])
def rota_materiais_js():
    caminho_js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "materiais.js")
    try:
        with open(caminho_js, "r", encoding="utf-8") as arquivo:
            return arquivo.read(), 200, {"Content-Type": "application/javascript; charset=utf-8"}
    except FileNotFoundError:
        return "console.error('Script de Materiais não encontrado.');", 404


@materiais_blueprint.route("/api/materiais/orcamento", methods=["GET"])
def api_orcamento_materiais():
    """
    Ponte Financeiro -> Materiais.

    Fonte do orçamento:
      capital inicial = config_simulacao.capital_total
      quota           = quotas_departamentos.departamento_id='materiais'
      patrimônio      = estoque de segurança já registrado em erp_materiais

    O endpoint não usa valores fixos como R$ 5 milhões/R$ 2 milhões.
    """
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401

    conexao = cursor = None
    try:
        id_equipe = equipe_atual()
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        # Capital inicial real da equipe.
        capital_inicial = 0.0
        try:
            cursor.execute(
                """
                SELECT capital_total
                FROM config_simulacao
                WHERE equipe_id = %s
                ORDER BY id DESC
                LIMIT 1
                """,
                (id_equipe,),
            )
            config = cursor.fetchone()
            capital_inicial = numero((config or {}).get("capital_total"))
        except Exception:
            # Compatibilidade com versões que ainda armazenam o capital em
            # tabelas legadas da inicialização.
            conexao.rollback()
            for tabela, coluna in (
                ("configuracao_equipes", "capital_inicial"),
                ("configuracao_equipes", "capital_social"),
                ("inicializacao_negocio", "capital_inicial"),
                ("inicializacao_negocio", "capital_social"),
            ):
                try:
                    cursor.execute(
                        f"SELECT {coluna} FROM {tabela} WHERE equipe_id = %s ORDER BY id DESC LIMIT 1",
                        (id_equipe,),
                    )
                    registro = cursor.fetchone()
                    if registro:
                        capital_inicial = numero(registro.get(coluna))
                        if capital_inicial:
                            break
                except Exception:
                    conexao.rollback()

        # Quota oficial registrada pelo Financeiro.
        porcentagem_quota = 0.0
        try:
            cursor.execute(
                """
                SELECT COALESCE(porcentagem_quota, 0) AS porcentagem_quota
                FROM quotas_departamentos
                WHERE equipe_id = %s
                  AND LOWER(TRIM(departamento_id)) = 'materiais'
                LIMIT 1
                """,
                (id_equipe,),
            )
            quota = cursor.fetchone()
            porcentagem_quota = max(0.0, min(100.0, numero((quota or {}).get("porcentagem_quota"))))
        except Exception:
            conexao.rollback()
            porcentagem_quota = 0.0

        valor_quota = capital_inicial * porcentagem_quota / 100.0

        garantir_tabela_materiais(cursor)

        # Valor efetivamente comprometido pelo estoque de segurança cadastrado.
        cursor.execute(
            """
            SELECT COALESCE(
                SUM(
                    COALESCE(preco_unitario, 0)
                    * COALESCE(estoque_seguranca, 0)
                    * (1 + COALESCE(coeficiente_refugo, 0) / 100.0)
                ), 0
            ) AS patrimonio_atual
            FROM erp_materiais
            WHERE equipe_id = %s
            """,
            (id_equipe,),
        )
        patrimonio_atual = numero((cursor.fetchone() or {}).get("patrimonio_atual"))
        saldo_aquisicao = max(0.0, valor_quota - patrimonio_atual)

        # Não inventa custos fixos/variáveis que o módulo não possui dados
        # suficientes para classificar. Esses indicadores ficam zerados até
        # existir uma fonte contábil específica para essa classificação.
        conexao.commit()

        return jsonify(
            {
                "status": "sucesso",
                "equipe_id": id_equipe,
                "capital_inicial": round(capital_inicial, 2),
                "porcentagem_quota": round(porcentagem_quota, 2),
                "valor_quota": round(valor_quota, 2),
                "patrimonio_atual": round(patrimonio_atual, 2),
                "saldo_aquisicao": round(saldo_aquisicao, 2),
                "custos_fixos_geral": 0.0,
                "custos_fixos_setor": 0.0,
                "custos_variaveis_geral": 0.0,
                "custos_variaveis_setor": 0.0,
            }
        ), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()
        logger.exception("Erro ao carregar orçamento de Materiais: %s", erro)
        return jsonify(
            {
                "status": "erro",
                "message": "Não foi possível carregar o orçamento de Materiais.",
                "erro": str(erro),
            }
        ), 500
    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


@materiais_blueprint.route("/api/materiais/listar", methods=["GET"])
def api_listar_materiais():
    if not autenticado():
        return jsonify([]), 401

    conexao = cursor = None
    try:
        id_equipe = equipe_atual()
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        garantir_tabela_materiais(cursor)
        conexao.commit()

        cursor.execute(
            "SELECT * FROM erp_materiais WHERE equipe_id = %s ORDER BY id DESC",
            (id_equipe,),
        )
        return jsonify([dict(item) for item in cursor.fetchall()]), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()
        logger.exception("Erro ao listar materiais: %s", erro)
        return jsonify([]), 200
    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


@materiais_blueprint.route("/api/materiais/salvar", methods=["POST"])
def api_salvar_material():
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401
    if not session.get("empresa_inicializada"):
        return jsonify({"status": "erro", "message": "A empresa ainda não foi inicializada."}), 403

    dados = request.get_json(silent=True) or {}
    id_reg = dados.get("id")
    id_equipe = equipe_atual()
    nome_mat = str(dados.get("nome_material", "") or "").strip()

    if not nome_mat:
        return jsonify({"status": "erro", "message": "Nome do material é obrigatório."}), 400

    conexao = cursor = None
    try:
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")
        cursor = conexao.cursor()
        garantir_tabela_materiais(cursor)

        valores = (
            nome_mat,
            str(dados.get("codigo_sku", "") or "").strip(),
            str(dados.get("categoria", "") or "").strip(),
            str(dados.get("unidade_medida", "kg") or "kg").strip(),
            numero(dados.get("preco_unitario")),
            numero(dados.get("coeficiente_refugo")),
            inteiro(dados.get("lead_time_entrega")),
            numero(dados.get("estoque_seguranca")),
            str(dados.get("fornecedor_padrao", "") or "").strip(),
            str(dados.get("especificacao_tecnica", "") or "").strip(),
            str(dados.get("dim_diametro", "0") or "0").strip(),
            str(dados.get("dim_espessura", "0") or "0").strip(),
            numero(dados.get("dim_comprimento")),
            numero(dados.get("custo_total_integrado")),
        )

        if id_reg:
            cursor.execute(
                """
                UPDATE erp_materiais SET
                    nome_material=%s,
                    codigo_sku=%s,
                    categoria=%s,
                    unidade_medida=%s,
                    preco_unitario=%s,
                    coeficiente_refugo=%s,
                    lead_time_entrega=%s,
                    estoque_seguranca=%s,
                    fornecedor_padrao=%s,
                    especificacao_tecnica=%s,
                    dim_diametro=%s,
                    dim_espessura=%s,
                    dim_comprimento=%s,
                    custo_total_integrado=%s
                WHERE id=%s AND equipe_id=%s
                """,
                valores + (int(id_reg), id_equipe),
            )
            if cursor.rowcount == 0:
                conexao.rollback()
                return jsonify({"status": "erro", "message": "Material não encontrado."}), 404
        else:
            cursor.execute(
                """
                INSERT INTO erp_materiais (
                    equipe_id, nome_material, codigo_sku, categoria,
                    unidade_medida, preco_unitario, coeficiente_refugo,
                    lead_time_entrega, estoque_seguranca, fornecedor_padrao,
                    especificacao_tecnica, dim_diametro, dim_espessura,
                    dim_comprimento, custo_total_integrado
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                """,
                (id_equipe,) + valores,
            )

        conexao.commit()
        return jsonify({"status": "sucesso", "message": "Material salvo com sucesso."}), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()
        logger.exception("Erro transacional ao salvar material: %s", erro)
        return jsonify({"status": "erro", "message": "Não foi possível salvar o material.", "erro": str(erro)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


@materiais_blueprint.route("/api/materiais/buscar/<int:id_reg>", methods=["GET"])
def api_buscar_material_id(id_reg):
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401

    conexao = cursor = None
    try:
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        garantir_tabela_materiais(cursor)
        cursor.execute(
            "SELECT * FROM erp_materiais WHERE id=%s AND equipe_id=%s LIMIT 1",
            (id_reg, equipe_atual()),
        )
        material = cursor.fetchone()
        if not material:
            return jsonify({"status": "erro", "message": "Material não encontrado."}), 404
        return jsonify(dict(material)), 200
    except Exception as erro:
        if conexao:
            conexao.rollback()
        logger.exception("Erro ao buscar material %s: %s", id_reg, erro)
        return jsonify({"status": "erro", "message": "Não foi possível buscar o material."}), 500
    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


@materiais_blueprint.route("/api/materiais/deletar/<int:id_reg>", methods=["DELETE"])
def api_deletar_material(id_reg):
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401

    conexao = cursor = None
    try:
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")
        cursor = conexao.cursor()
        garantir_tabela_materiais(cursor)
        cursor.execute(
            "DELETE FROM erp_materiais WHERE id=%s AND equipe_id=%s",
            (id_reg, equipe_atual()),
        )
        if cursor.rowcount == 0:
            conexao.rollback()
            return jsonify({"status": "erro", "message": "Material não encontrado."}), 404
        conexao.commit()
        return jsonify({"status": "removido", "message": "Material removido com sucesso."}), 200
    except Exception as erro:
        if conexao:
            conexao.rollback()
        logger.exception("Erro ao deletar material %s: %s", id_reg, erro)
        return jsonify({"status": "erro", "message": "Não foi possível remover o material."}), 500
    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)
