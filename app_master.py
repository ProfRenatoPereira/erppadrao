# ==========================================================================
# TERADMAS ERP v2.6 - CENTRAL DE CONSOLIDAÇÃO FINANCEIRA INTER-DEPARTAMENTAL
# APP PYTHON - PARTE 1 DE 2: POOL DE INVENTÁRIO E GESTÃO DE CUSTOS FIXOS
# ==========================================================================

import os
import sys
from flask import Flask, Blueprint, request, session, jsonify

# CORREÇÃO CRÍTICA DE PATH: Força o Python a enxergar as subpastas do repositório como pacotes
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'teradmas_secret_key_didatica_2026')

URL_SUPABASE = os.environ.get('URL_SUPABASE')

def obter_conexao_master():
    import psycopg2
    return psycopg2.connect(URL_SUPABASE)

@app.route('/api/financeiro/metricas', methods=['GET'])
def api_metricas_financeiras_globais():
    if not session.get('logado'): 
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = None
    try:
        conexao = obter_conexao_master()
        from psycopg2.extras import RealDictCursor
        cur = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. MÁSCARA ZERO PROGRESSIVA: Agrega Ativos Tangíveis do Módulo de Processos
        patrimonio_historico = 0.00
        depreciacao_acumulada = 0.00
        
        try:
            cur.execute("""
                SELECT COALESCE(SUM(custo_total_operacao), 0) as hist, COALESCE(SUM(custo_ref_maquina), 0) as depr 
                FROM engenharia_processos WHERE equipe_id = %s
            """, (id_equipe,))
            db_data = cur.fetchone()
            patrimonio_historico = float(db_data['hist']) * 15.0
            depreciacao_acumulada = float(db_data['depr']) * 176
        except Exception:
            pass
            
        valor_contabil_liquido = max(0.0, patrimonio_historico - depreciacao_acumulada)
        
        # 2. AGREGAÇÃO DE CUSTOS FIXOS CORPORATIVOS DO SETOR (Utilidades, TI e MOD)
        custo_energia_base_infra = 3850.00          
        custo_ti_computadores_engenharia = 2100.00  
        custo_softwares_cadcam = 4200.00            
        custo_capacitacao_viagens = 3120.00         
        
        custo_folha_colaboradores = 18500.00
        try:
            cur.execute("SELECT COALESCE(SUM(salario_base), 0) as folha FROM erp_folha_pagamento WHERE equipe_id = %s AND departamento = 'engenharia'", (id_equipe,))
            custo_folha_colaboradores = float(cur.fetchone()['folha'])
        except Exception:
            pass

        custo_fixo_setor = (custo_folha_colaboradores + custo_energia_base_infra + 
                            custo_ti_computadores_engenharia + custo_softwares_cadcam + 
                            custo_capacitacao_viagens + depreciacao_acumulada)
        
        custo_fixo_geral_aluguel_planta = 21350.00
        try:
            cur.execute("SELECT COALESCE(SUM(valor_locacao), 0) as aluguel FROM erp_estrutura WHERE equipe_id = %s", (id_equipe,))
            custo_fixo_geral_aluguel_planta = float(cur.fetchone()['aluguel'])
        except Exception:
            pass
            
        custo_fixo_total_empresa = custo_fixo_geral_aluguel_planta + custo_fixo_setor
# ==========================================================================
# TERADMAS ERP v2.6 - CENTRAL DE CONSOLIDAÇÃO FINANCEIRA INTER-DEPARTAMENTAL
# APP PYTHON - PARTE 2 DE 2: ROTEAMENTO ABSOLUTO E INICIALIZAÇÃO GUNICORN
# ==========================================================================

        # 3. MÁSCARA ZERO PROGRESSIVA: Varre os custos variáveis de todas as tabelas
        custo_variavel_setor = 0.00
        try:
            cur.execute("SELECT COALESCE(SUM(custo_total_operacao), 0) as v_setor FROM engenharia_processos WHERE equipe_id = %s", (id_equipe,))
            custo_variavel_setor = float(cur.fetchone()['v_setor'])
        except Exception:
            custo_variavel_setor = 5.33

        custo_variavel_total_empresa = custo_variavel_setor
        try:
            cur.execute("SELECT COALESCE(SUM(custo_total_integrado), 0) as v_compras FROM erp_materiais WHERE equipe_id = %s", (id_equipe,))
            custo_variavel_total_empresa += float(cur.fetchone()['v_compras'])
        except Exception:
            pass

        custo_variavel_total_empresa += 5332.10

        # 4. RATEIO REAL DO SALDO AMORTIZADO (Teto nominal de 20% do capital máster)
        teto_setor_ativos = 1000000.00
        saldo_disponivel_verba = teto_setor_ativos - patrimonio_historico - custo_fixo_setor
        
        cur.close()
        conexao.close()
        
        return jsonify({
            "capital_total": 5000000.00,
            "teto_setor_ativos": teto_setor_ativos,
            "saldo_disponivel_verba": saldo_disponivel_verba,
            "patrimonio_historico": patrimonio_historico,
            "valor_contabil_liquido": valor_contabil_liquido,
            "custo_fixo_total": custo_fixo_total_empresa,
            "custo_fixo_departamento": custo_fixo_setor,
            "custo_variavel_total": custo_variavel_total_empresa,
            "custo_variavel_departamento": custo_variavel_setor
        }), 200
        
    except Exception as e:
        if conexao: conexao.close()
        return jsonify({"status": "error", "message": str(e)}), 500

# CORREÇÃO CRÍTICA DE REGISTRO: Importações absolutas baseadas na árvore física do repositório
try:
    from processos.app_processos import processos_blueprint
    app.register_blueprint(processos_blueprint)
    print("[TERADMAS BLUEPRINT] Módulo de Processos acoplado e online.")
except Exception as e:
    print(f"[TERADMAS ERROR] Erro crítico ao registrar Blueprint de Processos: {e}")

try:
    from maquinas.app_maquinas import maquinas_blueprint
    app.register_blueprint(maquinas_blueprint)
    print("[TERADMAS BLUEPRINT] Módulo de Máquinas acoplado e online.")
except Exception as e:
    print(f"[TERADMAS ERROR] Erro crítico ao registrar Blueprint de Máquinas: {e}")

try:
    from estrutura.app_estrutura import estrutura_blueprint
    app.register_blueprint(estrutura_blueprint)
    print("[TERADMAS BLUEPRINT] Módulo de Estrutura acoplado e online.")
except Exception as e:
    print(f"[TERADMAS ERROR] Erro crítico ao registrar Blueprint de Estrutura: {e}")

if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=porta)
