# ==========================================================================
# TERADMAS ERP v2.6 - CENTRAL DE CONSOLIDAÇÃO FINANCEIRA (BACKEND MASTER)
# APP PYTHON - PARTE 1 DE 2: POOL DE INVENTÁRIO E GESTÃO DE CUSTOS FIXOS
# ==========================================================================

import os
from flask import Flask, Blueprint, request, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

# Instanciação explícita exigida pelo Gunicorn para o Port Binding no Render
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'teradmas_secret_key_didatica_2026')

# URL unificada do Supabase exposta como variável de ambiente
URL_SUPABASE = os.environ.get('URL_SUPABASE')

def obter_conexao_master():
    return psycopg2.connect(URL_SUPABASE)

@app.route('/api/financeiro/metricas', methods=['GET'])
def api_metricas_financeiras_globais():
    if not session.get('logado'): 
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    conexao = None
    try:
        conexao = obter_conexao_master()
        cur = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. VARREDURA PATRIMONIAL: Garante a integridade da tabela física do Supabase
        cur.execute('''
            CREATE TABLE IF NOT EXISTS engenharia_processos (
                id SERIAL PRIMARY KEY, equipe_id TEXT, produto_base TEXT, nome_operacao TEXT, 
                maquina_id INTEGER, maquina_nome_suporte TEXT, tempo_setup REAL, 
                tempo_operacao REAL, custo_ref_maquina REAL, sequencia_op INTEGER, 
                custo_total_operacao REAL
            )
        ''')
        conexao.commit()
        
        # Agregação unificada do histórico de compras e custos base do Supabase
        cur.execute("""
            SELECT COALESCE(SUM(custo_total_operacao), 0) as hist, COALESCE(SUM(custo_ref_maquina), 0) as depr 
            FROM engenharia_processos WHERE equipe_id = %s
        """, (id_equipe,))
        db_data = cur.fetchone()
        
        # Fórmulas de conversão e amortização contábil linearizada
        patrimonio_historico = float(db_data['hist']) * 15.0  # Fator de imobilização pedagógico
        depreciacao_acumulada = float(db_data['depr']) * 176  # Diluição linear mensal em 176h didáticas
        valor_contabil_liquido = max(0.0, patrimonio_historico - depreciacao_acumulada)
# ==========================================================================
# TERADMAS ERP v2.6 - CENTRAL DE CONSOLIDAÇÃO FINANCEIRA (BACKEND MASTER)
# APP PYTHON - PARTE 2 DE 2: ATUALIZAÇÃO DE UTILIDADES E REGISTRO DE ROTAS
# ==========================================================================

        # 2. AGREGAÇÃO DE CUSTOS FIXOS EXPANDIDOS DO SETOR (TI, Energia, Viagens e MOD)
        custo_folha_colaboradores = 18500.00   # Mão de Obra do Setor (MOD)
        custo_energia_base_infra = 3850.00     # Iluminação e Utilidades Fixas do Laboratório
        custo_ti_computadores_engenharia = 2100.00  # Estações CAD/CAM e Infraestrutura de TI
        custo_softwares_cadcam = 4200.00       # Licenciamento de Programas de Máquinas
        custo_capacitacao_viagens = 3120.00    # Viagens, Hospedagens e Cursos de Atualização
        
        # O Custo Fixo consolida a MOD, TI, utilidades expandidas e a depreciação do período
        custo_fixo_setor = (custo_folha_colaboradores + custo_energia_base_infra + 
                            custo_ti_computadores_engenharia + custo_softwares_cadcam + 
                            custo_capacitacao_viagens + depreciacao_acumulada)
        
        custo_fixo_geral_aluguel_planta = 21350.00
        custo_fixo_total_empresa = custo_fixo_geral_aluguel_planta + custo_fixo_setor

        # 3. ALGORITMO PROGRESSIVO DE CUSTOS VARIÁVEIS (Mascara Zero Condicional)
        custo_variavel_setor = float(db_data['hist'])
        # Agrega horas extras operacionais, alimentação e surtos de energia em horário de ponta
        custo_variavel_total_empresa = custo_variavel_setor + 5332.10

        # 4. BLINDAGEM DO TETO DE DIRECIONAMENTO CONTÁBIL (20% Real = R$ 1.000.000,00)
        teto_setor_ativos = 1000000.00
        saldo_disponivel_verba = teto_setor_ativos - patrimonio_historico - custo_fixo_setor
        
        cur.close()
        conexao.close()
        
        # Retorno do Payload estruturado em JSON para o global_metrics.js
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
        if conexao: 
            conexao.rollback()
            conexao.close()
        print(f"[TERADMAS MASTER FINANCIAL ERROR] Falha na consolidação de balanço: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Registro dos Blueprints dos módulos filhos (Importações dinâmicas isoladas)
try:
    from processos.app_processos import processos_blueprint
    app.register_blueprint(processos_blueprint)
except ImportError:
    print("[TERADMAS MODULE WARN] Blueprint de processos pendente de vinculação local.")

if __name__ == '__main__':
    # Binding de porta dinâmico exigido para execução em nuvens como o Render
    porta = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=porta)
