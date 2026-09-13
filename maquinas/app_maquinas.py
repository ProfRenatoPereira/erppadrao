import os
from flask import Flask, render_template, request, jsonify
from tavily import TavilyClient

app = Flask(__name__, template_folder='.', static_folder='../static')

# Configuração da Chave de API do Tavily para Pesquisa Web Dinâmica
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# Mock / Banco de Dados em Memória para o Parque Fabril
PARQUE_FABRIL_DB = []


@app.route('/')
def index():
    """Renderiza a página principal do módulo de máquinas."""
    return render_template('maquinas.html')


# ============================================================================
# API DE PESQUISA DINÂMICA DE EQUIPAMENTOS NA WEB
# ============================================================================
@app.route('/api/maquinas/pesquisar_web', methods=['POST'])
def pesquisar_maquina_web():
    """
    Realiza busca em tempo real na web por equipamentos industriais
    e retorna dados estruturados para preenchimento no ERP.
    """
    data = request.get_json() or {}
    termo = data.get('termo', '').strip()

    if not termo:
        return jsonify({
            "status": "erro",
            "mensagem": "Por favor, informe o nome ou modelo do equipamento para realizar a pesquisa."
        }), 400

    if not TAVILY_API_KEY:
        return jsonify({
            "status": "erro",
            "mensagem": "A chave TAVILY_API_KEY não foi configurada nas variáveis de ambiente."
        }), 500

    try:
        client = TavilyClient(api_key=TAVILY_API_KEY)
        query_tecnica = (
            f"maquina equipamento industrial {termo} ficha tecnica "
            f"potencia KW consumo preco fabricante marca modelo"
        )

        # Realiza a busca estruturada
        resposta = client.search(
            query=query_tecnica,
            search_depth="advanced",
            max_results=5
        )

        resultados = []
        for item in resposta.get("results", []):
            resultados.append({
                "titulo": item.get("title", termo),
                "marca_modelo": termo,
                "resumo_tecnico": item.get("content", "")[:250] + "...",
                "fonte_url": item.get("url", ""),
                "potencia_kw": None,  # Pode ser ajustado ou preenchido pelo usuário
                "preco_estimado": None
            })

        return jsonify({
            "status": "sucesso",
            "resultados": resultados
        }), 200

    except Exception as e:
        return jsonify({
            "status": "erro",
            "mensagem": f"Erro interno ao realizar busca externa: {str(e)}"
        }), 500


# ============================================================================
# ENDPOINTS REST DE GERENCIAMENTO DO PARQUE FABRIL
# ============================================================================
@app.route('/api/maquinas', methods=['GET'])
def listar_maquinas():
    """Retorna todos os ativos cadastrados no parque fabril."""
    return jsonify({"status": "sucesso", "dados": PARQUE_FABRIL_DB}), 200


@app.route('/api/maquinas', methods=['POST'])
def cadastrar_maquina():
    """Cadastra um novo ativo imobilizado ou equipamento no parque fabril."""
    data = request.get_json() or {}

    nome = data.get('nome')
    preco = float(data.get('preco', 0))

    if not nome or preco <= 0:
        return jsonify({
            "status": "erro",
            "mensagem": "Dados inválidos. O nome e o preço do ativo são obrigatórios."
        }), 400

    novo_ativo = {
        "id": len(PARQUE_FABRIL_DB) + 1,
        "nome": nome,
        "preco": preco,
        "potencia_kw": float(data.get('potencia_kw', 0)),
        "operador": data.get('operador', 'Não informado'),
        "custo_minuto": data.get('custo_minuto', 'R$ 0,0000'),
        "imobilizado": bool(data.get('imobilizado', True))
    }

    PARQUE_FABRIL_DB.append(novo_ativo)

    return jsonify({
        "status": "sucesso",
        "mensagem": "Ativo cadastrado com sucesso no Parque Fabril!",
        "ativo": novo_ativo
    }), 201


@app.route('/api/maquinas/<int:ativo_id>', methods=['DELETE'])
def deletar_maquina(ativo_id):
    """Remove um ativo e estorna seu valor para recomposição do patrimônio."""
    global PARQUE_FABRIL_DB
    PARQUE_FABRIL_DB = [m for m in PARQUE_FABRIL_DB if m.get('id') != ativo_id]

    return jsonify({
        "status": "sucesso",
        "mensagem": f"Ativo #{ativo_id} removido e valor recomposto na quota."
    }), 200


if __name__ == '__main__':
    # Execução local do servidor Flask na porta 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
