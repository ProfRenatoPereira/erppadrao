# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE ATIVOS (MÁQUINAS)
# APP PYTHON - VERSÃO INTEGRADA AO MOTOR FINANCEIRO CENTRAL
#
# REGRAS:
# - Conexão exclusivamente por GerenciadorCaixa.
# - Nunca fechar diretamente conexão devolvida pelo pool.
# - Isolamento por equipe_id vindo da sessão.
# - Máquinas físicas continuam classificadas como PRODUCAO em erp_maquinas.
# - O orçamento do módulo vem da quota oficial "maquinas" em
#   quotas_departamentos.
# - A quota é calculada sobre o CAPITAL INICIAL.
# - O saldo de aquisição é: valor_da_quota - patrimônio_atual_do_setor.
# - Não existe regra fixa de 40%, R$ 5 milhões ou R$ 2 milhões.
# - Não cria lançamentos financeiros automaticamente ao cadastrar uma máquina.
# ==========================================================================

import os
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from urllib.parse import quote_plus, urlparse, parse_qs
from urllib.request import Request, urlopen

from flask import Blueprint, request, render_template_string, session, jsonify, redirect
from psycopg2.extras import RealDictCursor

from GerenciadorCaixa import (
    obter_conexao_master,
    liberar_conexao_master,
)

logger = logging.getLogger(__name__)

maquinas_blueprint = Blueprint("maquinas_blueprint", __name__)


def equipe_atual():
    """Retorna exclusivamente o tenant da sessão."""
    return str(session.get("id_equipe", "equipe_alfa"))


def autenticado():
    return bool(session.get("logado"))


def garantir_tabela_maquinas(cursor):
    """
    Garante somente a estrutura técnica necessária para o CRUD de máquinas.

    A tabela é compartilhada com outros módulos; portanto, esta rotina
    adiciona apenas colunas compatíveis com o cadastro deste módulo.
    """
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS erp_maquinas (
            id SERIAL PRIMARY KEY,
            equipe_id TEXT NOT NULL,
            departamento TEXT DEFAULT 'PRODUCAO'
        )
        """
    )

    colunas = {
        "nome_equipamento": "TEXT",
        "potencia": "REAL",
        "consumo_eletrico": "REAL",
        "consumo_agua": "REAL",
        "consumo_gases": "REAL",
        "velocidade": "TEXT",
        "avanco": "TEXT",
        "frequencia_manutencao": "INTEGER",
        "preco_compra": "REAL",
        "depreciacao_mensal": "REAL",
        "valor_venda_final": "REAL",
        "operador_nome": "TEXT",
        "custo_minuto_operador": "REAL",
        "custo_minuto_maquina": "REAL",
        "jornada_semanal": "TEXT",
        "turnos_trabalho": "TEXT",
        "is_patrimonio": "BOOLEAN",
        "fabricante": "TEXT",
        "modelo": "TEXT",
        "fonte_url": "TEXT",
    }

    for nome, tipo in colunas.items():
        cursor.execute(
            f"ALTER TABLE erp_maquinas ADD COLUMN IF NOT EXISTS {nome} {tipo}"
        )


def numero(dados, campo, padrao=0.0):
    """Converte números recebidos do JavaScript sem quebrar o endpoint."""
    valor = dados.get(campo, padrao)
    if valor in (None, ""):
        return float(padrao)
    return float(valor)


# ==========================================================================
# PÁGINA
# ==========================================================================

@maquinas_blueprint.route("/maquinas", methods=["GET"])
def pagina_maquinas():
    if not autenticado():
        return redirect("/login")

    if not session.get("empresa_inicializada"):
        return redirect("/configuracao/inicializacao")

    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_html = os.path.join(diretorio_atual, "maquinas.html")

    try:
        with open(caminho_html, "r", encoding="utf-8") as arquivo:
            html = arquivo.read()
        return render_template_string(html)
    except FileNotFoundError:
        return "Erro Crítico: Arquivo 'maquinas.html' não encontrado.", 404
    except Exception as erro:
        logger.exception("Erro ao renderizar máquinas: %s", erro)
        return "Erro ao carregar o módulo de máquinas.", 500


@maquinas_blueprint.route("/maquinas/maquinas.js", methods=["GET"])
def rota_maquinas_js():
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_js = os.path.join(diretorio_atual, "maquinas.js")

    try:
        with open(caminho_js, "r", encoding="utf-8") as arquivo:
            js_conteudo = arquivo.read()

        return js_conteudo, 200, {"Content-Type": "application/javascript; charset=utf-8"}
    except FileNotFoundError:
        return "console.error('Script offline.');", 404


# ==========================================================================\n# PESQUISA EXTERNA DE EQUIPAMENTOS\n# ==========================================================================\n\n\ndef _extrair_dados_resultado(titulo, url, snippet, fonte):\n    """Extrai apenas características objetivas encontradas no resultado."""\n    texto = f"{titulo} {snippet}"\n\n    preco = None\n    match_preco = re.search(\n        r"R\\$\\s*([0-9]{1,3}(?:[.][0-9]{3})*(?:,[0-9]{1,2})?)",\n        texto,\n        flags=re.IGNORECASE,\n    )\n    if match_preco:\n        try:\n            preco = float(match_preco.group(1).replace(".", "").replace(",", "."))\n        except ValueError:\n            preco = None\n\n    potencia = None\n    potencia_unidade = None\n    match_pot = re.search(\n        r"([0-9]+(?:[.,][0-9]+)?)\\s*(kW|HP|CV)\\b",\n        texto,\n        flags=re.IGNORECASE,\n    )\n    if match_pot:\n        try:\n            valor = float(match_pot.group(1).replace(",", "."))\n            unidade = match_pot.group(2).upper()\n            if unidade == "HP":\n                valor *= 0.7457\n            elif unidade == "CV":\n                valor *= 0.7355\n            potencia = round(valor, 3)\n            potencia_unidade = unidade\n        except ValueError:\n            pass\n\n    host = (urlparse(url).hostname or "").lower()\n    fabricante = host.replace("www.", "").split(".")[0] if host else ""\n\n    return {\n        "titulo": titulo or "Equipamento pesquisado",\n        "url": url,\n        "snippet": snippet[:500],\n        "preco_compra": preco,\n        "potencia": potencia,\n        "potencia_unidade": potencia_unidade,\n        "fabricante": fabricante,\n        "fonte": fonte,\n    }\n\n\ndef _buscar_google(consulta):\n    url = "https://www.google.com/search?hl=pt-BR&num=8&q=" + quote_plus(consulta)\n    requisicao = Request(\n        url,\n        headers={\n            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",\n            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",\n        },\n    )\n    with urlopen(requisicao, timeout=2.8) as resposta:\n        html = resposta.read(900_000).decode("utf-8", errors="ignore")\n\n    resultados = []\n    padrao = re.compile(\n        r'<a[^>]+href=["\\\']([^"\\\']+)["\\\'][^>]*>\\s*<h3[^>]*>(.*?)</h3>',\n        flags=re.IGNORECASE | re.DOTALL,\n    )\n    for match in padrao.finditer(html):\n        link = unescape(match.group(1)).strip()\n        titulo = re.sub(r"<[^>]+>", " ", match.group(2))\n        titulo = re.sub(r"\\s+", " ", unescape(titulo)).strip()\n\n        if link.startswith("/url?"):\n            link = parse_qs(urlparse(link).query).get("q", [""])[0]\n        if not link.startswith(("http://", "https://")):\n            continue\n        host = (urlparse(link).hostname or "").lower()\n        if "google.com" in host:\n            continue\n\n        # Procura um trecho textual próximo ao título.\n        trecho = html[match.end():match.end() + 1800]\n        trecho = re.sub(r"<[^>]+>", " ", trecho)\n        trecho = re.sub(r"\\s+", " ", unescape(trecho)).strip()\n        resultados.append(_extrair_dados_resultado(titulo, link, trecho[:500], "Google"))\n        if len(resultados) >= 8:\n            break\n    return resultados\n\n\ndef _buscar_bing_html(consulta):\n    url = "https://www.bing.com/search?q=" + quote_plus(consulta)\n    requisicao = Request(\n        url,\n        headers={\n            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",\n            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",\n        },\n    )\n    with urlopen(requisicao, timeout=2.8) as resposta:\n        html = resposta.read(900_000).decode("utf-8", errors="ignore")\n\n    resultados = []\n    blocos = re.findall(r'<li[^>]+class=["\\\']b_algo["\\\'][^>]*>(.*?)</li>', html, flags=re.IGNORECASE | re.DOTALL)\n    for bloco in blocos[:8]:\n        match_link = re.search(r'<a[^>]+href=["\\\']([^"\\\']+)["\\\'][^>]*>(.*?)</a>', bloco, flags=re.IGNORECASE | re.DOTALL)\n        if not match_link:\n            continue\n        link = unescape(match_link.group(1)).strip()\n        titulo = re.sub(r"<[^>]+>", " ", match_link.group(2))\n        titulo = re.sub(r"\\s+", " ", unescape(titulo)).strip()\n        if not link.startswith(("http://", "https://")):\n            continue\n        host = (urlparse(link).hostname or "").lower()\n        if "bing.com" in host:\n            continue\n        match_snippet = re.search(r'<p[^>]*>(.*?)</p>', bloco, flags=re.IGNORECASE | re.DOTALL)\n        snippet = re.sub(r"<[^>]+>", " ", match_snippet.group(1)) if match_snippet else ""\n        snippet = re.sub(r"\\s+", " ", unescape(snippet)).strip()\n        resultados.append(_extrair_dados_resultado(titulo, link, snippet, "Bing"))\n    return resultados\n\n\n@maquinas_blueprint.route("/api/maquinas/pesquisar", methods=["GET"])\ndef api_pesquisar_equipamento():\n    """Pesquisa um equipamento na Internet sem bloquear o worker do Flask/Gunicorn."""\n    if not autenticado():\n        return jsonify({"status": "erro", "message": "Não autenticado."}), 401\n\n    consulta = str(request.args.get("q", "") or "").strip()[:180]\n    if len(consulta) < 2:\n        return jsonify({"status": "erro", "message": "Informe o equipamento que deseja pesquisar."}), 400\n\n    resultados = []\n    erros = []\n    # As fontes são consultadas em paralelo. Assim, uma fonte lenta não gera\n    # a sequência de 3 timeouts que provocou WORKER TIMEOUT no Render.\n    with ThreadPoolExecutor(max_workers=2) as executor:\n        tarefas = {\n            executor.submit(_buscar_google, consulta): "Google",\n            executor.submit(_buscar_bing_html, consulta): "Bing",\n        }\n        for tarefa in as_completed(tarefas):\n            fonte = tarefas[tarefa]\n            try:\n                resultados.extend(tarefa.result())\n            except Exception as erro:\n                erros.append(f"{fonte}: {erro}")\n\n    # Remove duplicatas por URL e limita o painel.\n    unicos = []\n    vistos = set()\n    for item in resultados:\n        chave = item["url"].rstrip("/").lower()\n        if chave in vistos:\n            continue\n        vistos.add(chave)\n        unicos.append(item)\n        if len(unicos) >= 8:\n            break\n\n    if not unicos:\n        logger.warning("Pesquisa externa sem resultados para '%s': %s", consulta, " | ".join(erros))\n        return jsonify({\n            "status": "indisponivel",\n            "consulta": consulta,\n            "resultados": [],\n            "message": "Nenhum resultado externo foi obtido. Tente um termo mais específico, por exemplo: fabricante + modelo + equipamento.",\n        }), 200\n\n    return jsonify({\n        "status": "sucesso",\n        "consulta": consulta,\n        "resultados": unicos,\n        "fonte": "Pesquisa na Internet",\n    }), 200\n\n\n# ==========================================================================
# ORÇAMENTO DO MÓDULO
# ==========================================================================

@maquinas_blueprint.route("/api/maquinas/orcamento", methods=["GET"])
def api_orcamento_maquinas():
    """
    Ponte Financeiro -> Máquinas.

    Fonte:
      capital inicial  = config_simulacao.capital_total
      quota máquinas   = quotas_departamentos.departamento_id='maquinas'
      patrimônio atual = erp_maquinas PRODUCAO + is_patrimonio=true

    A quota monetária NUNCA é calculada sobre o giro restante.
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

        # ------------------------------------------------------------------
        # 1. Capital inicial real da equipe
        # ------------------------------------------------------------------
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

        capital_inicial = float((config or {}).get("capital_total") or 0)

        # ------------------------------------------------------------------
        # 2. Quota oficial do Financeiro para o módulo Máquinas
        # ------------------------------------------------------------------
        cursor.execute(
            """
            SELECT COALESCE(porcentagem_quota, 0) AS porcentagem_quota
            FROM quotas_departamentos
            WHERE equipe_id = %s
              AND LOWER(TRIM(departamento_id)) = 'maquinas'
            LIMIT 1
            """,
            (id_equipe,),
        )
        quota = cursor.fetchone()

        porcentagem_quota = float(
            (quota or {}).get("porcentagem_quota") or 0
        )

        # Proteção contra dados inválidos.
        porcentagem_quota = max(0.0, min(100.0, porcentagem_quota))

        # ------------------------------------------------------------------
        # 3. Valor financeiro da quota: sempre sobre o capital inicial
        # ------------------------------------------------------------------
        valor_quota = capital_inicial * porcentagem_quota / 100.0

        # ------------------------------------------------------------------
        # 4. Patrimônio atual efetivamente adquirido pelo setor
        # ------------------------------------------------------------------
        garantir_tabela_maquinas(cursor)

        cursor.execute(
            """
            SELECT COALESCE(SUM(COALESCE(preco_compra, 0)), 0) AS patrimonio_atual
            FROM erp_maquinas
            WHERE equipe_id = %s
              AND departamento = 'PRODUCAO'
              AND COALESCE(is_patrimonio, TRUE) = TRUE
            """,
            (id_equipe,),
        )
        patrimonio = cursor.fetchone()

        patrimonio_atual = float(
            (patrimonio or {}).get("patrimonio_atual") or 0
        )

        # ------------------------------------------------------------------
        # 5. Saldo disponível dentro da quota do módulo
        # ------------------------------------------------------------------
        saldo_aquisicao = max(0.0, valor_quota - patrimonio_atual)

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
            }
        ), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()

        logger.exception("Erro ao carregar orçamento de máquinas: %s", erro)

        return jsonify(
            {
                "status": "erro",
                "message": "Não foi possível carregar o orçamento de Máquinas.",
                "erro": str(erro),
            }
        ), 500

    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# LISTAGEM
# ==========================================================================

@maquinas_blueprint.route("/api/maquinas/listar", methods=["GET"])
def api_listar_maquinas():
    if not autenticado():
        return jsonify([]), 401

    conexao = cursor = None

    try:
        id_equipe = equipe_atual()
        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        garantir_tabela_maquinas(cursor)
        conexao.commit()

        # As máquinas de produção continuam identificadas por PRODUCAO.
        # A quota do módulo é identificada separadamente por "maquinas".
        cursor.execute(
            """
            SELECT *
            FROM erp_maquinas
            WHERE equipe_id = %s
              AND (departamento = 'PRODUCAO' OR departamento IS NULL)
            ORDER BY id DESC
            """,
            (id_equipe,),
        )

        return jsonify(cursor.fetchall()), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()

        logger.exception("Erro ao listar máquinas: %s", erro)
        return jsonify([]), 200

    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# SALVAR
# ==========================================================================

@maquinas_blueprint.route("/api/maquinas/salvar", methods=["POST"])
def api_salvar_maquina():
    if not autenticado():
        return jsonify({"status": "erro", "message": "Não autenticado."}), 401

    if not session.get("empresa_inicializada"):
        return jsonify(
            {
                "status": "erro",
                "message": "A empresa ainda não foi inicializada.",
            }
        ), 403

    dados = request.get_json(silent=True) or {}
    id_reg = dados.get("id")
    id_equipe = equipe_atual()

    nome_eq = str(dados.get("nome_equipamento", "") or "").strip()

    if not nome_eq:
        return jsonify(
            {
                "status": "erro",
                "message": "Nome do equipamento é obrigatório.",
            }
        ), 400

    conexao = cursor = None

    try:
        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor()

        garantir_tabela_maquinas(cursor)

        pot = numero(dados, "potencia")
        c_ele = numero(dados, "consumo_eletrico")
        c_agu = numero(dados, "consumo_agua")
        c_gas = numero(dados, "consumo_gases")

        vel = str(dados.get("velocidade", "") or "").strip()
        avc = str(dados.get("avanco", "") or "").strip()

        try:
            frq = int(dados.get("frequencia_manutencao", 0) or 0)
        except (TypeError, ValueError):
            frq = 0

        prc = numero(dados, "preco_compra")
        dep = numero(dados, "depreciacao_mensal")
        rsd = numero(dados, "valor_venda_final")

        op_n = str(dados.get("operador_nome", "") or "").strip()
        c_op = numero(dados, "custo_minuto_operador")
        c_mq = numero(dados, "custo_minuto_maquina")

        jor = str(dados.get("jornada_semanal", "44") or "44").strip()
        tur = str(dados.get("turnos_trabalho", "1") or "1").strip()

        # Não confiar em valor textual vindo do navegador.
        isp = dados.get("is_patrimonio", True)
        if isinstance(isp, str):
            isp = isp.lower() in ("true", "1", "sim", "yes")
        else:
            isp = bool(isp)

        # --------------------------------------------------------------
        # Classificação física do ativo.
        #
        # A página é "Máquinas", a quota é "maquinas", mas os ativos
        # produtivos permanecem classificados como PRODUCAO.
        # --------------------------------------------------------------
        departamento = "PRODUCAO"

        if id_reg:
            try:
                id_reg_int = int(id_reg)
            except (TypeError, ValueError):
                return jsonify(
                    {
                        "status": "erro",
                        "message": "Identificador da máquina inválido.",
                    }
                ), 400

            cursor.execute(
                """
                UPDATE erp_maquinas
                SET
                    nome_equipamento = %s,
                    potencia = %s,
                    consumo_eletrico = %s,
                    consumo_agua = %s,
                    consumo_gases = %s,
                    velocidade = %s,
                    avanco = %s,
                    frequencia_manutencao = %s,
                    preco_compra = %s,
                    depreciacao_mensal = %s,
                    valor_venda_final = %s,
                    operador_nome = %s,
                    custo_minuto_operador = %s,
                    custo_minuto_maquina = %s,
                    jornada_semanal = %s,
                    turnos_trabalho = %s,
                    is_patrimonio = %s,
                    fabricante = %s,
                    modelo = %s,
                    fonte_url = %s,
                    departamento = %s
                WHERE id = %s
                  AND equipe_id = %s
                  AND (departamento = 'PRODUCAO' OR departamento IS NULL)
                """,
                (
                    nome_eq,
                    pot,
                    c_ele,
                    c_agu,
                    c_gas,
                    vel,
                    avc,
                    frq,
                    prc,
                    dep,
                    rsd,
                    op_n,
                    c_op,
                    c_mq,
                    jor,
                    tur,
                    isp,
                    str(dados.get("fabricante", "") or "").strip(),
                    str(dados.get("modelo", "") or "").strip(),
                    str(dados.get("fonte_url", "") or "").strip(),
                    departamento,
                    id_reg_int,
                    id_equipe,
                ),
            )

            if cursor.rowcount == 0:
                conexao.rollback()
                return jsonify(
                    {
                        "status": "erro",
                        "message": "Máquina não encontrada para esta equipe.",
                    }
                ), 404

        else:
            cursor.execute(
                """
                INSERT INTO erp_maquinas (
                    equipe_id,
                    nome_equipamento,
                    potencia,
                    consumo_eletrico,
                    consumo_agua,
                    consumo_gases,
                    velocidade,
                    avanco,
                    frequencia_manutencao,
                    preco_compra,
                    depreciacao_mensal,
                    valor_venda_final,
                    operador_nome,
                    custo_minuto_operador,
                    custo_minuto_maquina,
                    jornada_semanal,
                    turnos_trabalho,
                    is_patrimonio,
                    fabricante,
                    modelo,
                    fonte_url,
                    departamento
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    id_equipe,
                    nome_eq,
                    pot,
                    c_ele,
                    c_agu,
                    c_gas,
                    vel,
                    avc,
                    frq,
                    prc,
                    dep,
                    rsd,
                    op_n,
                    c_op,
                    c_mq,
                    jor,
                    tur,
                    isp,
                    str(dados.get("fabricante", "") or "").strip(),
                    str(dados.get("modelo", "") or "").strip(),
                    str(dados.get("fonte_url", "") or "").strip(),
                    departamento,
                ),
            )

        conexao.commit()

        return jsonify(
            {
                "status": "sucesso",
                "message": "Máquina salva com sucesso.",
            }
        ), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()

        logger.exception("Erro ao salvar máquina: %s", erro)

        return jsonify(
            {
                "status": "erro",
                "message": "Não foi possível salvar a máquina.",
                "erro": str(erro),
            }
        ), 500

    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# BUSCAR POR ID
# ==========================================================================

@maquinas_blueprint.route("/api/maquinas/buscar/<int:id_reg>", methods=["GET"])
def api_buscar_maquina_id(id_reg):
    if not autenticado():
        return jsonify(
            {"status": "erro", "message": "Não autenticado."}
        ), 401

    conexao = cursor = None

    try:
        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor(cursor_factory=RealDictCursor)

        cursor.execute(
            """
            SELECT *
            FROM erp_maquinas
            WHERE id = %s
              AND equipe_id = %s
              AND (departamento = 'PRODUCAO' OR departamento IS NULL)
            LIMIT 1
            """,
            (id_reg, equipe_atual()),
        )

        maquina = cursor.fetchone()

        if not maquina:
            return jsonify(
                {
                    "status": "erro",
                    "message": "Máquina não encontrada.",
                }
            ), 404

        return jsonify(dict(maquina)), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()

        logger.exception("Erro ao buscar máquina %s: %s", id_reg, erro)

        return jsonify(
            {
                "status": "erro",
                "message": "Não foi possível buscar a máquina.",
                "erro": str(erro),
            }
        ), 500

    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)


# ==========================================================================
# DELETAR
# ==========================================================================

@maquinas_blueprint.route("/api/maquinas/deletar/<int:id_reg>", methods=["DELETE"])
def api_deletar_maquina(id_reg):
    if not autenticado():
        return jsonify(
            {"status": "erro", "message": "Não autenticado."}
        ), 401

    conexao = cursor = None

    try:
        conexao = obter_conexao_master()

        if conexao is None:
            raise RuntimeError("Não foi possível obter conexão com o banco.")

        cursor = conexao.cursor()

        cursor.execute(
            """
            DELETE FROM erp_maquinas
            WHERE id = %s
              AND equipe_id = %s
              AND (departamento = 'PRODUCAO' OR departamento IS NULL)
            """,
            (id_reg, equipe_atual()),
        )

        if cursor.rowcount == 0:
            conexao.rollback()
            return jsonify(
                {
                    "status": "erro",
                    "message": "Máquina não encontrada.",
                }
            ), 404

        conexao.commit()

        return jsonify(
            {
                "status": "removido",
                "message": "Máquina removida com sucesso.",
            }
        ), 200

    except Exception as erro:
        if conexao:
            conexao.rollback()

        logger.exception("Erro ao deletar máquina %s: %s", id_reg, erro)

        return jsonify(
            {
                "status": "erro",
                "message": "Não foi possível remover a máquina.",
            }
        ), 500

    finally:
        if cursor:
            cursor.close()
        if conexao:
            liberar_conexao_master(conexao)
