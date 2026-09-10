# erppadrao - financeiro/app_financeiro.py
from flask import Blueprint, request, render_template_string, session, jsonify, send_from_directory
from psycopg2.extras import RealDictCursor
import os

financeiro_blueprint = Blueprint("financeiro_blueprint", __name__)

def obter_conexao_master():
    import GerenciadorCaixa
    conexao = GerenciadorCaixa.obter_conexao_master()
    if conexao is None:
        raise RuntimeError("Não foi possível obter conexão com o banco via GerenciadorCaixa.")
    return conexao

def liberar_conexao(conexao):
    if conexao is not None:
        import GerenciadorCaixa
        GerenciadorCaixa.liberar_conexao_master(conexao)

def equipe_atual():
    return str(session.get("id_equipe", "equipe_alfa"))

def garantir_tabelas(cursor):
    cursor.execute("""CREATE TABLE IF NOT EXISTS razao_financeiro(
        id SERIAL PRIMARY KEY,equipe_id TEXT NOT NULL,cliente_id INTEGER NOT NULL,
        cliente_nome_suporte TEXT NOT NULL,financeiro_descricao TEXT NOT NULL,
        financeiro_valor NUMERIC(18,2) NOT NULL,financeiro_condicao TEXT NOT NULL,
        financeiro_data TEXT NOT NULL,status_titulo TEXT NOT NULL DEFAULT 'Aberto')""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS quotas_departamentos(
        id SERIAL PRIMARY KEY,equipe_id TEXT NOT NULL,departamento_id TEXT NOT NULL,
        porcentagem_quota NUMERIC(6,2) NOT NULL DEFAULT 0,
        CONSTRAINT unique_equipe_depto_financeiro UNIQUE(equipe_id,departamento_id))""")

def garantir_fluxo(cursor):
    cursor.execute("""CREATE TABLE IF NOT EXISTS fluxo_caixa(
        id SERIAL PRIMARY KEY,equipe_id TEXT,departamento TEXT,descricao TEXT,
        valor NUMERIC(18,2),tipo TEXT,created_at TIMESTAMPTZ DEFAULT NOW())""")

@financeiro_blueprint.route("/financeiro")
def pagina_financeiro():
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    caminho=os.path.join(os.path.dirname(os.path.abspath(__file__)),"financeiro.html")
    with open(caminho,"r",encoding="utf-8") as f: return render_template_string(f.read())

@financeiro_blueprint.route("/financeiro/financeiro.js")
def servir_js_financeiro():
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)),"financeiro.js",mimetype="application/javascript")

@financeiro_blueprint.route("/api/financeiro/metricas")
def api_metricas_financeiras():
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    try:
        import GerenciadorCaixa
        return jsonify(GerenciadorCaixa.calcular_metricas_totais_equipe(equipe_atual())),200
    except Exception as e:
        return jsonify({"status":"erro","message":"Falha ao calcular métricas financeiras.","erro":str(e)}),500

@financeiro_blueprint.route("/api/financeiro/faturar",methods=["POST"])
def api_faturar_titulo():
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    d=request.get_json(silent=True) or {}
    try:
        cid=int(d.get("cliente_id",0) or 0); nome=str(d.get("cliente_nome_suporte","")).strip()
        desc=str(d.get("financeiro_descricao","")).strip(); valor=float(d.get("financeiro_valor",0) or 0)
        cond=str(d.get("financeiro_condicao","")).strip(); data=str(d.get("financeiro_data","")).strip()
        if cid<=0 or not nome or not desc or valor<=0 or not cond or not data:
            return jsonify({"status":"erro","message":"Dados do lançamento inválidos ou incompletos."}),400
        con=cur=None
        try:
            con=obter_conexao_master();cur=con.cursor();garantir_tabelas(cur)
            cur.execute("""INSERT INTO razao_financeiro(equipe_id,cliente_id,cliente_nome_suporte,financeiro_descricao,financeiro_valor,financeiro_condicao,financeiro_data)
                           VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING id""",(equipe_atual(),cid,nome,desc,valor,cond,data))
            rid=cur.fetchone()[0];con.commit();return jsonify({"status":"sucesso","id":rid}),200
        except Exception: 
            if con: con.rollback()
            raise
        finally:
            if cur: cur.close()
            liberar_conexao(con)
    except Exception as e:return jsonify({"status":"erro","message":str(e)}),500

@financeiro_blueprint.route("/api/financeiro/listar")
def api_listar_titulos():
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    con=cur=None
    try:
        con=obter_conexao_master();cur=con.cursor(cursor_factory=RealDictCursor);garantir_tabelas(cur)
        cur.execute("""SELECT id,cliente_id,cliente_nome_suporte,financeiro_descricao,financeiro_valor,financeiro_condicao,financeiro_data,status_titulo
                       FROM razao_financeiro WHERE equipe_id=%s ORDER BY id DESC""",(equipe_atual(),))
        rows=[dict(x) for x in cur.fetchall()];con.commit();return jsonify(rows),200
    except Exception as e:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(e)}),500
    finally:
        if cur: cur.close()
        liberar_conexao(con)

@financeiro_blueprint.route("/api/financeiro/liquidar/<int:id_reg>",methods=["POST"])
def api_liquidar_titulo_id(id_reg):
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    con=cur=None
    try:
        con=obter_conexao_master();cur=con.cursor(cursor_factory=RealDictCursor);garantir_tabelas(cur);garantir_fluxo(cur)
        cur.execute("""SELECT * FROM razao_financeiro WHERE id=%s AND equipe_id=%s AND status_titulo='Aberto' FOR UPDATE""",(id_reg,equipe_atual()))
        titulo=cur.fetchone()
        if not titulo:return jsonify({"status":"erro","message":"Título não encontrado ou já liquidado."}),404
        valor=float(titulo["financeiro_valor"] or 0)
        cur.execute("UPDATE razao_financeiro SET status_titulo='Liquidado' WHERE id=%s AND equipe_id=%s",(id_reg,equipe_atual()))
        cur.execute("""INSERT INTO fluxo_caixa(equipe_id,departamento,descricao,valor,tipo)
                       VALUES(%s,'financeiro',%s,%s,'LIQUIDAÇÃO')""",(equipe_atual(),f"Recebimento Duplicata FT-00{id_reg} - {titulo['financeiro_descricao']}",valor))
        con.commit();return jsonify({"status":"sucesso","id":id_reg,"valor_liquidado":valor}),200
    except Exception as e:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(e)}),500
    finally:
        if cur: cur.close()
        liberar_conexao(con)

@financeiro_blueprint.route("/api/financeiro/quota",methods=["POST"])
def api_salvar_quota_setorial():
    if not session.get("logado"): return jsonify({"status":"erro","message":"Não autenticado"}),401
    d=request.get_json(silent=True) or {};depto=str(d.get("departamento_id","")).strip()
    try:pct=float(d.get("porcentagem_quota",0) or 0)
    except (TypeError,ValueError):return jsonify({"status":"erro","message":"Percentual inválido."}),400
    if not depto:return jsonify({"status":"erro","message":"Departamento obrigatório."}),400
    if not 0<=pct<=100:return jsonify({"status":"erro","message":"A quota deve estar entre 0% e 100%."}),400
    con=cur=None
    try:
        con=obter_conexao_master();cur=con.cursor();garantir_tabelas(cur)
        cur.execute("SELECT COALESCE(SUM(porcentagem_quota),0) FROM quotas_departamentos WHERE equipe_id=%s AND departamento_id<>%s",(equipe_atual(),depto))
        outros=float(cur.fetchone()[0] or 0)
        if outros+pct>100.0001:return jsonify({"status":"erro","message":f"As demais quotas já utilizam {outros:.2f}% do limite de 100%."}),409
        cur.execute("""INSERT INTO quotas_departamentos(equipe_id,departamento_id,porcentagem_quota)
                       VALUES(%s,%s,%s) ON CONFLICT(equipe_id,departamento_id)
                       DO UPDATE SET porcentagem_quota=EXCLUDED.porcentagem_quota""",(equipe_atual(),depto,pct))
        con.commit();return jsonify({"status":"sucesso","departamento_id":depto,"porcentagem_quota":pct}),200
    except Exception as e:
        if con: con.rollback()
        return jsonify({"status":"erro","message":str(e)}),500
    finally:
        if cur:cur.close()
        liberar_conexao(con)

@financeiro_blueprint.route("/api/financeiro/quota/<string:depto_id>")
def api_buscar_quota_depto(depto_id):
    if not session.get("logado"):return jsonify({"status":"erro","message":"Não autenticado"}),401
    con=cur=None
    try:
        con=obter_conexao_master();cur=con.cursor(cursor_factory=RealDictCursor);garantir_tabelas(cur)
        cur.execute("SELECT porcentagem_quota FROM quotas_departamentos WHERE equipe_id=%s AND departamento_id=%s LIMIT 1",(equipe_atual(),depto_id))
        row=cur.fetchone();con.commit();return jsonify(dict(row) if row else {"porcentagem_quota":0}),200
    except Exception as e:
        if con:con.rollback()
        return jsonify({"status":"erro","message":str(e),"porcentagem_quota":0}),500
    finally:
        if cur:cur.close()
        liberar_conexao(con)

@financeiro_blueprint.route("/api/financeiro/quotas/summary")
def api_obter_resumo_quotas():
    if not session.get("logado"):return jsonify({"status":"erro","message":"Não autenticado"}),401
    con=cur=None
    try:
        con=obter_conexao_master();cur=con.cursor(cursor_factory=RealDictCursor);garantir_tabelas(cur)
        cur.execute("""SELECT departamento_id,porcentagem_quota FROM quotas_departamentos
                       WHERE equipe_id=%s AND porcentagem_quota>0 ORDER BY porcentagem_quota DESC,departamento_id ASC""",(equipe_atual(),))
        rows=[dict(x) for x in cur.fetchall()];con.commit();return jsonify(rows),200
    except Exception as e:
        if con:con.rollback()
        return jsonify({"status":"erro","message":str(e)}),500
    finally:
        if cur:cur.close()
        liberar_conexao(con)
