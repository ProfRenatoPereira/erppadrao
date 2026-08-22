# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO FINANCEIRO CENTRALIZADO (BACKEND MASTER)
# APP PYTHON - PARTE 1 DE 2: POOL DE INVENTÁRIO E GESTÃO DE CUSTOS FIXOS
# ==========================================================================

import os
from flask import Blueprint, request, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

# Definição do Blueprint Master de Finanças (Ajuste o nome conforme seu arquivo principal)
financeiro_master_blueprint = Blueprint('financeiro_master_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@financeiro_master_blueprint.route('/api/financeiro/metricas', methods=['GET'])
def api_metricas_financeiras_globais():
    if not session.get('logado'): 
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    dept = request.args.get('dept', 'dashboard')
    
    conexao = None
    try:
        conexao = obter_conexao_master()
        cur = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. VARREDURA PROGRESSIVA: Somatório de Ativos Reais Imobilizados do Parque (Módulo 07)
        # Garante a existência da tabela antes de efetuar a agregação matemática
        cur.execute('''
            CREATE TABLE IF NOT EXISTS erp_maquinas (
                id SERIAL PRIMARY KEY, equipe_id TEXT, nome_equipamento TEXT, 
                preco_compra REAL, depreciacao_mensal REAL, valor_venda_final REAL
            )
        ''')
        conexao.commit()
        
        cur.execute("""
            SELECT COALESCE(SUM(preco_compra), 0) as hist, COALESCE(SUM(depreciacao_mensal), 0) as depr 
            FROM erp_maquinas WHERE equipe_id = %s
        """, (id_equipe,))
        maq_data = cur.fetchone()
        
        patrimonio_historico = float(maq_data['hist'])
        depreciacao_acumulada = float(maq_data['depr']) * 12  # Ciclo didático padrão de 1 ano
        valor_contabil_liquido = max(0.0, patrimonio_historico - depreciacao_acumulada)
        
        # 2. AGREGAÇÃO DE CUSTOS FIXOS EXPANDIDOS (Administrativo, Softwares, Viagens e Colaboradores)
        # Despesas operacionais didáticas e corporativas parametrizadas para o setor de engenharia
        custo_folha_setor = 18500.00         # Desconto da Folha de Pagamento do Setor
        custo_programas_cadcam = 4200.00     # Licenciamento de Programas e Softwares de Máquinas
        custo_viagens_hospedagem = 3120.00   # Viagens, Hospedagens e Cursos de Atualização
        
        # O Custo Fixo do Setor consolida os intangíveis adicionados mais a depreciação do período
        custo_fixo_setor = custo_folha_setor + custo_programas_cadcam + custo_viagens_hospedagem + float(maq_data['depr'])
        custo_fixo_geral_aluguel = 21350.00
        custo_fixo_total = custo_fixo_geral_aluguel + custo_fixo_setor
# ==========================================================================
# TERADMAS ERP v2.6 - MÓDULO FINANCEIRO CENTRALIZADO (BACKEND MASTER)
# APP PYTHON - PARTE 2 DE 2: MATRIZ PROGRESSIVA DE VARIÁVEIS E RATEIO DE TETO
# ==========================================================================

        # 3. MATRIZ PROGRESSIVA DOS PRÓXIMOS SETORES (Se retornarem zero, não interferem)
        custo_variavel_total = 0.00
        custo_variavel_setor = 0.00
        
        # Bloco condicional seguro: tenta ler a tabela do Módulo 09 (Processos), se não existir ignora
        try:
            cur.execute("""
                SELECT COALESCE(SUM(custo_total_operacao), 0) as v_setor 
                FROM engenharia_processos WHERE equipe_id = %s
            """, (id_equipe,))
            proc_data = cur.fetchone()
            custo_variavel_setor = float(proc_data['v_setor'])
            
            # Agrega despesas de horas extras operacionais, alimentação e energia em horário de ponta
            custo_variavel_total = custo_variavel_setor + 5332.10
        except Exception:
            # Caso a tabela engenharia_processos ainda não tenha sido criada, o sistema assume zero e prossegue
            custo_variavel_setor = 5.33  # Valor didático inicial mapeado no seu card
            custo_variavel_total = custo_variavel_setor

        # 4. RATIO E SALVAGUARDA DO SALDO AMORTIZADO (Teto nominal e imutável de 20%)
        teto_setor_ativos = 1000000.00
        saldo_disponivel_verba = teto_setor_ativos - patrimonio_historico - custo_fixo_setor
        
        cur.close()
        conexao.close()
        
        # Retorno do Payload estruturado em JSON para alimentação síncrona do global_metrics.js
        return jsonify({
            "capital_total": 5000000.00,
            "teto_setor_ativos": teto_setor_ativos,
            "saldo_disponivel_verba": saldo_disponivel_verba,
            "patrimonio_historico": patrimonio_historico,
            "valor_contabil_liquido": valor_contabil_liquido,
            "custo_fixo_total": custo_fixo_total,
            "custo_fixo_departamento": custo_fixo_setor,
            "custo_variavel_total": custo_variavel_total,
            "custo_variavel_departamento": custo_variavel_setor
        }), 200
        
    except Exception as e:
        if conexao: 
            conexao.rollback()
            conexao.close()
        print(f"[TERADMAS MASTER FINANCIAL ERROR] Falha na consolidação de balanço: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
