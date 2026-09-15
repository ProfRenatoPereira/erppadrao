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


def garantir_tabelas_operacionais(cursor):
    """Garante os quadros operacionais próprios de Materiais."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS materiais_colaboradores (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            nome TEXT,
            cargo TEXT,
            salario_base REAL DEFAULT 0,
            quantidade INTEGER DEFAULT 1,
            subtotal REAL DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS materiais_instrumentos (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            nome_instrumento TEXT,
            categoria TEXT,
            quantidade INTEGER DEFAULT 1,
            preco_compra REAL DEFAULT 0,
            potencia_watts REAL DEFAULT 0,
            consumo_gas_m3 REAL DEFAULT 0,
            consumo_agua_m3 REAL DEFAULT 0,
            depreciacao_anos INTEGER DEFAULT 10,
            minutos_operacionais_mes REAL DEFAULT 13200,
            insumo_minuto REAL DEFAULT 0,
            custo_minuto REAL DEFAULT 0,
            is_patrimonio BOOLEAN DEFAULT FALSE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS materiais_energia (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            descricao TEXT,
            tipo_energia TEXT,
            consumo_mensal REAL DEFAULT 0,
            unidade TEXT,
            tarifa_unitaria REAL DEFAULT 0,
            custo_fixo_mensal REAL DEFAULT 0,
            custo_variavel_mensal REAL DEFAULT 0,
            custo_total_mensal REAL DEFAULT 0
        )
    """)

    # Compatibilidade com instalações que já possuem a tabela operacional.
    cursor.execute("ALTER TABLE materiais_instrumentos ADD COLUMN IF NOT EXISTS minutos_operacionais_mes REAL DEFAULT 13200")
    cursor.execute("ALTER TABLE materiais_instrumentos ADD COLUMN IF NOT EXISTS insumo_minuto REAL DEFAULT 0")


def _valor_linha(row, chave):
    return numero((row or {}).get(chave), 0.0)


def _soma(cursor, sql, params, padrao=0.0):
    try:
        cursor.execute(sql, params)
        return _valor_linha(cursor.fetchone(), "total")
    except Exception:
        try:
            cursor.connection.rollback()
        except Exception:
            pass
        return float(padrao)


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
    """Painel financeiro e operacional de Materiais, sem valores fixos."""
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401

    conexao = cursor = None
    try:
        id_equipe = equipe_atual()
        conexao = obter_conexao_master()
        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")
        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        capital_inicial = 0.0
        try:
            cursor.execute("""
                SELECT capital_total FROM config_simulacao
                WHERE equipe_id=%s ORDER BY id DESC LIMIT 1
            """, (id_equipe,))
            config = cursor.fetchone()
            capital_inicial = numero((config or {}).get("capital_total"))
        except Exception:
            conexao.rollback()
            capital_inicial = 0.0

        if capital_inicial == 0:
            for tabela, coluna in (
                ("configuracao_equipes", "capital_inicial"),
                ("configuracao_equipes", "capital_social"),
                ("inicializacao_negocio", "capital_inicial"),
                ("inicializacao_negocio", "capital_social"),
            ):
                try:
                    cursor.execute(f"SELECT {coluna} FROM {tabela} WHERE equipe_id=%s ORDER BY id DESC LIMIT 1", (id_equipe,))
                    row = cursor.fetchone()
                    valor = numero((row or {}).get(coluna))
                    if valor:
                        capital_inicial = valor
                        break
                except Exception:
                    conexao.rollback()

        porcentagem_quota = 0.0
        try:
            cursor.execute("""
                SELECT COALESCE(porcentagem_quota,0) AS porcentagem_quota
                FROM quotas_departamentos
                WHERE equipe_id=%s AND LOWER(TRIM(departamento_id))='materiais'
                LIMIT 1
            """, (id_equipe,))
            porcentagem_quota = max(0.0, min(100.0, numero((cursor.fetchone() or {}).get("porcentagem_quota"))))
        except Exception:
            conexao.rollback()

        valor_quota = capital_inicial * porcentagem_quota / 100.0
        garantir_tabela_materiais(cursor)
        garantir_tabelas_operacionais(cursor)

        patrimonio_materiais = _soma(cursor, """
            SELECT COALESCE(SUM(COALESCE(preco_unitario,0)*COALESCE(estoque_seguranca,0)*(1+COALESCE(coeficiente_refugo,0)/100.0)),0) AS total
            FROM erp_materiais WHERE equipe_id=%s
        """, (id_equipe,))
        patrimonio_instrumentos = _soma(cursor, """
            SELECT COALESCE(SUM(CASE WHEN COALESCE(is_patrimonio,FALSE) THEN COALESCE(preco_compra,0)*COALESCE(quantidade,1) ELSE 0 END),0) AS total
            FROM materiais_instrumentos WHERE equipe_id=%s
        """, (id_equipe,))
        patrimonio_atual = patrimonio_materiais + patrimonio_instrumentos

        colaboradores = _soma(cursor, "SELECT COALESCE(SUM(subtotal),0) AS total FROM materiais_colaboradores WHERE equipe_id=%s", (id_equipe,))
        depreciacao = _soma(cursor, """
            SELECT COALESCE(SUM((COALESCE(preco_compra,0)*COALESCE(quantidade,1))/NULLIF(GREATEST(COALESCE(depreciacao_anos,10),1)*12,0)),0) AS total
            FROM materiais_instrumentos WHERE equipe_id=%s AND COALESCE(is_patrimonio,FALSE)=TRUE
        """, (id_equipe,))
        energia_fixa = _soma(cursor, "SELECT COALESCE(SUM(custo_fixo_mensal),0) AS total FROM materiais_energia WHERE equipe_id=%s", (id_equipe,))
        energia_variavel = _soma(cursor, """
            SELECT COALESCE(SUM(CASE WHEN COALESCE(custo_variavel_mensal,0)>0 THEN custo_variavel_mensal ELSE consumo_mensal*tarifa_unitaria END),0) AS total
            FROM materiais_energia WHERE equipe_id=%s
        """, (id_equipe,))
        materiais_variavel = patrimonio_materiais

        # Referência contábil global já existente no ERP, somada aos novos quadros de Materiais.
        global_fixo = _soma(cursor, """
            SELECT COALESCE(SUM(valor_aluguel+valor_condominio),0) AS total
            FROM imoveis_simulacao WHERE equipe_id=%s
        """, (id_equipe,))
        global_fixo += _soma(cursor, "SELECT COALESCE(SUM(salario_base),0) AS total FROM folha_funcionarios WHERE equipe_id=%s", (id_equipe,))
        global_fixo += _soma(cursor, "SELECT COALESCE(SUM(subtotal),0) AS total FROM estrutura_rh WHERE equipe_id=%s", (id_equipe,))
        global_fixo += colaboradores + depreciacao + energia_fixa

        global_variavel = _soma(cursor, """
            SELECT COALESCE(SUM(COALESCE(encargos_patronais,0)+COALESCE(valor_horas_extras,0)),0) AS total
            FROM livro_razonete_folha WHERE equipe_id=%s
        """, (id_equipe,))
        global_variavel += energia_variavel + materiais_variavel

        custo_fixo_setor = colaboradores + depreciacao + energia_fixa
        custo_variavel_setor = energia_variavel + materiais_variavel

        # Custo real por minuto do setor: mão de obra + energia/utilidades + insumos
        # + depreciação dos equipamentos. Não depende de um valor manual isolado.
        minutos_disponiveis = _soma(cursor, """
            SELECT COALESCE(SUM(GREATEST(COALESCE(quantidade,1),1) *
                               GREATEST(COALESCE(minutos_operacionais_mes,13200),1)),0) AS total
            FROM materiais_instrumentos WHERE equipe_id=%s
        """, (id_equipe,))
        if minutos_disponiveis <= 0:
            minutos_disponiveis = 13200.0

        mao_obra_minuto = colaboradores / minutos_disponiveis
        energia_minuto = energia_variavel / minutos_disponiveis
        insumo_minuto = _soma(cursor, """
            SELECT COALESCE(SUM(COALESCE(insumo_minuto,0)*GREATEST(COALESCE(quantidade,1),1)),0) AS total
            FROM materiais_instrumentos WHERE equipe_id=%s
        """, (id_equipe,))
        ajuste_minuto = _soma(cursor, """
            SELECT COALESCE(SUM(COALESCE(custo_minuto,0)*GREATEST(COALESCE(quantidade,1),1)),0) AS total
            FROM materiais_instrumentos WHERE equipe_id=%s
        """, (id_equipe,))
        depreciacao_minuto = depreciacao / minutos_disponiveis
        custo_minuto_total = mao_obra_minuto + energia_minuto + insumo_minuto + depreciacao_minuto + ajuste_minuto
        watts_total = _soma(cursor, "SELECT COALESCE(SUM(potencia_watts*GREATEST(quantidade,1)),0) AS total FROM materiais_instrumentos WHERE equipe_id=%s", (id_equipe,))

        conexao.commit()
        return jsonify({
            "status":"sucesso", "equipe_id":id_equipe,
            "capital_inicial":round(capital_inicial,2),
            "porcentagem_quota":round(porcentagem_quota,2),
            "valor_quota":round(valor_quota,2),
            "patrimonio_atual":round(patrimonio_atual,2),
            "saldo_aquisicao":round(max(0, valor_quota-patrimonio_atual),2),
            "custos_fixos_geral":round(global_fixo,2),
            "custos_fixos_setor":round(custo_fixo_setor,2),
            "custos_variaveis_geral":round(global_variavel,2),
            "custos_variaveis_setor":round(custo_variavel_setor,2),
            "custo_minuto_total":round(custo_minuto_total,4),
            "custo_minuto_mao_obra":round(mao_obra_minuto,4),
            "custo_minuto_energia":round(energia_minuto,4),
            "custo_minuto_insumo":round(insumo_minuto,4),
            "custo_minuto_depreciacao":round(depreciacao_minuto,4),
            "custo_minuto_ajuste":round(ajuste_minuto,4),
            "minutos_disponiveis_mes":round(minutos_disponiveis,2),
            "potencia_total_watts":round(watts_total,2),
            "patrimonio_materiais":round(patrimonio_materiais,2),
            "patrimonio_instrumentos":round(patrimonio_instrumentos,2),
        }), 200
    except Exception as erro:
        if conexao: conexao.rollback()
        logger.exception("Erro ao carregar orçamento de Materiais: %s", erro)
        return jsonify({"status":"erro", "message":"Não foi possível carregar o painel de Materiais.", "erro":str(erro)}), 500
    finally:
        if cursor: cursor.close()
        if conexao: liberar_conexao_master(conexao)


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



# ============================================================================
# QUADROS OPERACIONAIS: COLABORADORES, INSTRUMENTOS E ENERGIA
# ============================================================================

@materiais_blueprint.route("/api/materiais/operacional", methods=["GET"])
def api_operacional_listar():
    if not autenticado(): return jsonify({"status":"erro","message":"Não autenticado."}), 401
    con=cur=None
    try:
        con=obter_conexao_master(); cur=con.cursor(cursor_factory=RealDictCursor)
        garantir_tabelas_operacionais(cur); con.commit(); equipe=equipe_atual()
        cur.execute("SELECT * FROM materiais_colaboradores WHERE equipe_id=%s ORDER BY id DESC",(equipe,)); colaboradores=cur.fetchall()
        cur.execute("SELECT * FROM materiais_instrumentos WHERE equipe_id=%s ORDER BY id DESC",(equipe,)); instrumentos=cur.fetchall()
        cur.execute("SELECT * FROM materiais_energia WHERE equipe_id=%s ORDER BY id DESC",(equipe,)); energia=cur.fetchall()

        # Composição oficial do minuto/máquina: mão de obra + energia + insumo + depreciação.
        total_colab = sum(numero(x.get("subtotal")) for x in colaboradores)
        total_energia = sum(numero(x.get("custo_variavel_mensal")) for x in energia)
        total_minutos = sum(max(1.0, numero(x.get("quantidade"),1)) * max(1.0, numero(x.get("minutos_operacionais_mes"),13200)) for x in instrumentos) or 13200.0
        total_depreciacao = sum(
            (numero(x.get("preco_compra")) * max(1.0, numero(x.get("quantidade"),1))) / (max(1, inteiro(x.get("depreciacao_anos"),10)) * 12)
            for x in instrumentos if bool(x.get("is_patrimonio"))
        )
        total_insumo = sum(numero(x.get("insumo_minuto")) * max(1.0, numero(x.get("quantidade"),1)) for x in instrumentos)
        total_ajuste = sum(numero(x.get("custo_minuto")) * max(1.0, numero(x.get("quantidade"),1)) for x in instrumentos)
        mao_obra_minuto = total_colab / total_minutos
        energia_minuto = total_energia / total_minutos
        depreciacao_minuto = total_depreciacao / total_minutos
        custo_minuto_total = mao_obra_minuto + energia_minuto + depreciacao_minuto + total_insumo + total_ajuste
        resumo = {
            "custo_minuto_total": round(custo_minuto_total,4),
            "custo_minuto_mao_obra": round(mao_obra_minuto,4),
            "custo_minuto_energia": round(energia_minuto,4),
            "custo_minuto_insumo": round(total_insumo,4),
            "custo_minuto_depreciacao": round(depreciacao_minuto,4),
            "custo_minuto_ajuste": round(total_ajuste,4),
            "minutos_disponiveis_mes": round(total_minutos,2)
        }
        return jsonify({"status":"sucesso","colaboradores":[dict(x) for x in colaboradores],"instrumentos":[dict(x) for x in instrumentos],"energia":[dict(x) for x in energia],"resumo":resumo}),200
    except Exception as erro:
        if con: con.rollback()
        logger.exception("Erro ao listar quadros operacionais de Materiais: %s",erro)
        return jsonify({"status":"erro","message":"Não foi possível carregar os quadros operacionais."}),500
    finally:
        if cur: cur.close()
        if con: liberar_conexao_master(con)


@materiais_blueprint.route("/api/materiais/colaboradores", methods=["POST"])
def api_materiais_colaborador_salvar():
    if not autenticado(): return jsonify({"status":"erro","message":"Não autenticado."}),401
    dados=request.get_json(silent=True) or {}; con=cur=None
    try:
        nome=str(dados.get("nome","") or "").strip(); cargo=str(dados.get("cargo","") or "").strip()
        salario=numero(dados.get("salario_base")); qtd=max(1,inteiro(dados.get("quantidade"),1)); id_reg=dados.get("id")
        if not cargo: return jsonify({"status":"erro","message":"Cargo é obrigatório."}),400
        subtotal=salario*qtd; con=obter_conexao_master(); cur=con.cursor(); garantir_tabelas_operacionais(cur)
        if id_reg:
            cur.execute("UPDATE materiais_colaboradores SET nome=%s,cargo=%s,salario_base=%s,quantidade=%s,subtotal=%s WHERE id=%s AND equipe_id=%s",(nome,cargo,salario,qtd,subtotal,int(id_reg),equipe_atual()))
        else:
            cur.execute("INSERT INTO materiais_colaboradores(equipe_id,nome,cargo,salario_base,quantidade,subtotal) VALUES(%s,%s,%s,%s,%s,%s)",(equipe_atual(),nome,cargo,salario,qtd,subtotal))
        con.commit(); return jsonify({"status":"sucesso"}),200
    except Exception as erro:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(erro)}),500
    finally:
        if cur: cur.close()
        if con: liberar_conexao_master(con)


@materiais_blueprint.route("/api/materiais/colaboradores/<int:id_reg>", methods=["DELETE"])
def api_materiais_colaborador_deletar(id_reg):
    return _deletar_operacional("materiais_colaboradores", id_reg)


@materiais_blueprint.route("/api/materiais/instrumentos", methods=["POST"])
def api_materiais_instrumento_salvar():
    if not autenticado(): return jsonify({"status":"erro","message":"Não autenticado."}),401
    dados=request.get_json(silent=True) or {}; con=cur=None
    try:
        nome=str(dados.get("nome_instrumento","") or "").strip(); categoria=str(dados.get("categoria","") or "").strip()
        if not nome: return jsonify({"status":"erro","message":"Instrumento/material é obrigatório."}),400
        qtd=max(1,inteiro(dados.get("quantidade"),1)); preco=numero(dados.get("preco_compra")); watts=numero(dados.get("potencia_watts")); gas=numero(dados.get("consumo_gas_m3")); agua=numero(dados.get("consumo_agua_m3")); dep=max(1,inteiro(dados.get("depreciacao_anos"),10)); minutos_mes=max(1.0,numero(dados.get("minutos_operacionais_mes"),13200)); insumo_minuto=numero(dados.get("insumo_minuto")); minuto=numero(dados.get("custo_minuto")); patrimonio=bool(dados.get("is_patrimonio",False)); id_reg=dados.get("id")
        con=obter_conexao_master(); cur=con.cursor(); garantir_tabelas_operacionais(cur)
        valores=(nome,categoria,qtd,preco,watts,gas,agua,dep,minutos_mes,insumo_minuto,minuto,patrimonio)
        if id_reg:
            cur.execute("""UPDATE materiais_instrumentos SET nome_instrumento=%s,categoria=%s,quantidade=%s,preco_compra=%s,potencia_watts=%s,consumo_gas_m3=%s,consumo_agua_m3=%s,depreciacao_anos=%s,minutos_operacionais_mes=%s,insumo_minuto=%s,custo_minuto=%s,is_patrimonio=%s WHERE id=%s AND equipe_id=%s""",valores+(int(id_reg),equipe_atual()))
        else:
            cur.execute("""INSERT INTO materiais_instrumentos(equipe_id,nome_instrumento,categoria,quantidade,preco_compra,potencia_watts,consumo_gas_m3,consumo_agua_m3,depreciacao_anos,minutos_operacionais_mes,insumo_minuto,custo_minuto,is_patrimonio) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",(equipe_atual(),)+valores)
        con.commit(); return jsonify({"status":"sucesso"}),200
    except Exception as erro:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(erro)}),500
    finally:
        if cur: cur.close()
        if con: liberar_conexao_master(con)


@materiais_blueprint.route("/api/materiais/instrumentos/<int:id_reg>", methods=["DELETE"])
def api_materiais_instrumento_deletar(id_reg):
    return _deletar_operacional("materiais_instrumentos", id_reg)


@materiais_blueprint.route("/api/materiais/energia", methods=["POST"])
def api_materiais_energia_salvar():
    if not autenticado(): return jsonify({"status":"erro","message":"Não autenticado."}),401
    dados=request.get_json(silent=True) or {}; con=cur=None
    try:
        descricao=str(dados.get("descricao","") or "").strip(); tipo=str(dados.get("tipo_energia","Elétrica") or "Elétrica").strip(); consumo=numero(dados.get("consumo_mensal")); unidade=str(dados.get("unidade","kWh") or "kWh").strip(); tarifa=numero(dados.get("tarifa_unitaria")); fixo=numero(dados.get("custo_fixo_mensal")); id_reg=dados.get("id")
        if not descricao: return jsonify({"status":"erro","message":"Descrição da energia é obrigatória."}),400
        variavel=consumo*tarifa; total=fixo+variavel
        con=obter_conexao_master(); cur=con.cursor(); garantir_tabelas_operacionais(cur)
        valores=(descricao,tipo,consumo,unidade,tarifa,fixo,variavel,total)
        if id_reg:
            cur.execute("""UPDATE materiais_energia SET descricao=%s,tipo_energia=%s,consumo_mensal=%s,unidade=%s,tarifa_unitaria=%s,custo_fixo_mensal=%s,custo_variavel_mensal=%s,custo_total_mensal=%s WHERE id=%s AND equipe_id=%s""",valores+(int(id_reg),equipe_atual()))
        else:
            cur.execute("""INSERT INTO materiais_energia(equipe_id,descricao,tipo_energia,consumo_mensal,unidade,tarifa_unitaria,custo_fixo_mensal,custo_variavel_mensal,custo_total_mensal) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",(equipe_atual(),)+valores)
        con.commit(); return jsonify({"status":"sucesso"}),200
    except Exception as erro:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(erro)}),500
    finally:
        if cur: cur.close()
        if con: liberar_conexao_master(con)


@materiais_blueprint.route("/api/materiais/energia/<int:id_reg>", methods=["DELETE"])
def api_materiais_energia_deletar(id_reg):
    return _deletar_operacional("materiais_energia", id_reg)


def _deletar_operacional(tabela, id_reg):
    if not autenticado(): return jsonify({"status":"erro","message":"Não autenticado."}),401
    con=cur=None
    try:
        if tabela not in {"materiais_colaboradores","materiais_instrumentos","materiais_energia"}: raise ValueError("Tabela operacional inválida.")
        con=obter_conexao_master(); cur=con.cursor(); garantir_tabelas_operacionais(cur)
        cur.execute(f"DELETE FROM {tabela} WHERE id=%s AND equipe_id=%s",(id_reg,equipe_atual()))
        if cur.rowcount==0: con.rollback(); return jsonify({"status":"erro","message":"Registro não encontrado."}),404
        con.commit(); return jsonify({"status":"removido"}),200
    except Exception as erro:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(erro)}),500
    finally:
        if cur: cur.close()
        if con: liberar_conexao_master(con)


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
