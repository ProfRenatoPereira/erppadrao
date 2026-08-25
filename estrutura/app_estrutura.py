# ==========================================================================
# TERADMAS ERP v2.6 - CONTROLADOR BACKEND PYTHON (PARTE 1 DE 2)
# INICIALIZAÇÃO DA SESSÃO SEGURA E LEITURA (SELECT) NO SUPABASE
# ==========================================================================
from flask import Flask, jsonify, request, render_template
import os
from supabase import create_client, Client

app = Flask(__name__)

# Configurações de credenciais seguras no lado do servidor
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sua-service-role-ou-anon")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/estrutura')
def render_estrutura():
    return render_template('estrutura.html')

@app.route('/api/estrutura/dados', methods=['GET'])
def obter_dados_consolidados():
    try:
        # Busca isolada e assíncrona nas tabelas físicas do Postgres
        imoveis_response = supabase.table('contratos_imoveis').select('*').execute()
        rh_response = supabase.table('quadro_colaboradores').select('*').execute()
        
        return jsonify({
            "contratosImoveis": imoveis_response.data or [],
            "quadroColaboradores": rh_response.data or []
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ==========================================================================
# TERADMAS ERP v2.6 - CONTROLADOR BACKEND PYTHON (PARTE 2 DE 2)
# ROTAS DE PERSISTÊNCIA (INSERT/UPDATE) E EXCLUSÃO (DELETE)
# ==========================================================================

@app.route('/api/estrutura/imovel/salvar', methods=['POST'])
def salvar_imovel_db():
    dados = request.get_json()
    id_imovel = dados.get('id')
    payload = {
        "tipo": dados.get('tipo'),
        "cidade": dados.get('cidade'),
        "bairro": dados.get('bairro'),
        "area": dados.get('area'),
        "condominio": dados.get('condominio'),
        "aluguel": dados.get('aluguel'),
        "taxaAnual": dados.get('taxaAnual')
    }
    try:
        if id_imovel:
            supabase.table('contratos_imoveis').update(payload).eq('id', id_imovel).execute()
        else:
            supabase.table('contratos_imoveis').insert(payload).execute()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/estrutura/rh/salvar', methods=['POST'])
def salvar_rh_db():
    dados = request.get_json()
    id_rh = dados.get('id')
    payload = {
        "nome": dados.get('nome'),
        "cargo": dados.get('cargo'),
        "salario": dados.get('salario'),
        "qtd": dados.get('qtd')
    }
    try:
        if id_rh:
            supabase.table('quadro_colaboradores').update(payload).eq('id', id_rh).execute()
        else:
            supabase.table('quadro_colaboradores').insert(payload).execute()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/estrutura/imovel/deletar/<id_imovel>', methods=['DELETE'])
def deletar_imovel_db(id_imovel):
    try:
        supabase.table('contratos_imoveis').delete().eq('id', id_imovel).execute()
        return jsonify({"status": "deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/estrutura/rh/deletar/<id_rh>', methods=['DELETE'])
def deletar_rh_db(id_rh):
    try:
        supabase.table('quadro_colaboradores').delete().eq('id', id_rh).execute()
        return jsonify({"status": "deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
