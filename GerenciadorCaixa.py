# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# PARTE 1 DE 2 - GESTÃO DE CONEXÃO E PATRIMÔNIO TRILINEAR DOS ATIVOS
# ==========================================================================
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def obter_conexao_master():
    try:
        from app_master import URL_SUPABASE
        return psycopg2.connect(URL_SUPABASE)
    except (ImportError, AttributeError):
        url_fallback = os.environ.get("DATABASE_URL")
        if url_fallback:
            return psycopg2.connect(url_fallback)
        raise psycopg2.DatabaseError("Não foi possível ler as credenciais do banco.")

def calcular_metricas_totais_equipe(id_equipe, departamento_atual=None):
    conexao = obter_conexao_master()
    cursor = None
    
    capital_total = 5000000.00
    orcamento_inicial_infra = 2000000.00
    nome_empresa = "GRUPO ACADÊMICO"
    
    patrimonio_global_ativos = 0.0
    custo_fixo_global_empresa = 0.0
    custo_variavel_global_empresa = 0.0
    
    patrimonio_isolado_maquinas_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0
    
    soma_potencia_watts = 0.0
    soma_consumo_gas = 0.0
    soma_consumo_agua = 0.0
    soma_custo_minuto = 0.0
    
    total_aluguel_predial_com_condominio_setor = 0.0
    total_provisao_igpm_setor = 0.0
    total_salarios_apoio_setor = 0.0

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("SELECT nome_empresa, capital_total FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
            config = cursor.fetchone()
            if config:
                capital_total = float(config['capital_total'] or 5000000.00)
                nome_empresa = config['nome_empresa']
        except Exception:
            if conexao: conexao.rollback()

        # ==================================================================
        # 🏢 EQUAÇÃO 01: PATRIMÔNIO DE TODOS OS SETORES (SÓ MÁQUINAS/UTENSÍLIOS)
        # ==================================================================
        try:
            cursor.execute("SELECT preco_compra, departamento, potencia_watts, consumo_gas_m3, consumo_agua_m3, custo_minuto_maquina FROM erp_maquinas WHERE equipe_id = %s", (id_equipe,))
            todas_maquinas = cursor.fetchall()
            for maq in todas_maquinas:
                valor_maq = float(maq['preco_compra'] or 0)
                patrimonio_global_ativos += valor_maq
                
                if maq['departamento'] == 'estrutura':
                    patrimonio_isolado_maquinas_setor += valor_maq
                    soma_potencia_watts += float(maq['potencia_watts'] or 0)
                    soma_consumo_gas += float(maq['consumo_gas_m3'] or 0)
                    soma_consumo_agua += float(maq['consumo_agua_m3'] or 0)
                    soma_custo_minuto += float(maq['custo_minuto_maquina'] or 0)
        except Exception:
            if conexao: conexao.rollback()

        try:
            cursor.execute("SELECT SUM(quantidade_estoque * preco_unitario) as total FROM erp_materiais WHERE equipe_id = %s", (id_equipe,))
            res_mat = cursor.fetchone()
            if res_mat and res_mat['total']:
                patrimonio_global_ativos += float(res_mat['total'])
        except Exception:
            if conexao: conexao.rollback()
        # ==================================================================
        # 🔒 EQUAÇÃO 02: CUSTOS FIXOS MATRICIAIS E PROVISÃO DO IMÓVEL PRÓPRIO
        # ==================================================================
        try:
            cursor.execute("SELECT valor_aluguel, valor_condominio, obs_contrato FROM imoveis_simulacao WHERE equipe_id = %s", (id_equipe,))
            imoveis = cursor.fetchall()
            for imovel in imoveis:
                aluguel = float(imovel['valor_aluguel'] or 0)
                condominio = float(imovel['valor_condominio'] or 0)
                
                bruto_mensal = aluguel + condominio
                total_aluguel_predial_com_condominio_setor += bruto_mensal
                
                texto_igpm = imovel['obs_contrato'] or ""
                try:
                    valor_igpm_anual = float(texto_igpm.replace('R$', '').replace('.', '').replace(',', '.').strip())
                except Exception:
                    valor_igpm_anual = bruto_mensal * 1.072
                
                total_provisao_igpm_setor += valor_igpm_anual
                custo_fixo_isolado_setor += (bruto_mensal + valor_igpm_anual)
        except Exception:
            if conexao: conexao.rollback()

        try:
            cursor.execute("SELECT SUM(subtotal) as total FROM estrutura_rh WHERE equipe_id = %s", (id_equipe,))
            res_rh_imob = cursor.fetchone()
            if res_rh_imob and res_rh_imob['total']:
                total_salarios_apoio_setor = float(res_rh_imob['total'])
                custo_fixo_isolado_setor += total_salarios_apoio_setor
        except Exception:
            if conexao: conexao.rollback()

        custo_fixo_global_empresa = custo_fixo_isolado_setor
        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh_global = cursor.fetchone()
            if res_rh_global and res_rh_global['total']:
                custo_fixo_global_empresa += float(res_rh_global['total'])
        except Exception:
            if conexao: conexao.rollback()

        # ==================================================================
        # ⚡ EQUAÇÃO 03: CONSOLIDAÇÃO DE CUSTOS VARIÁVEIS (UTILITÁRIOS DA ENG)
        # ==================================================================
        custo_energia_calculado = (soma_potencia_watts / 1000.0) * 220.0 * 0.72
        custo_gas_calculado = soma_consumo_gas * 220.0 * 4.50
        custo_agua_calculado = soma_consumo_agua * 220.0 * 6.80
        
        custo_variavel_isolado_setor = custo_energia_calculado + custo_gas_calculado + custo_agua_calculado
        custo_variavel_global_empresa = custo_variavel_isolado_setor
        
        try:
            cursor.execute("SELECT SUM(encargos_patronais + valor_horas_extras) as total FROM livro_razonete_folha WHERE equipe_id = %s", (id_equipe,))
            res_folha_var = cursor.fetchone()
            if res_folha_var and res_folha_var['total']:
                custo_variavel_global_empresa += float(res_folha_var['total'])
        except Exception:
            if conexao: conexao.rollback()

        # ==================================================================
        # 📉 EQUAÇÃO 04: ATUALIZAÇÃO DO SALDO DE INFRAESTRUTURA ENGENHARIA
        # ==================================================================
        desconto_infraestrutura = total_aluguel_predial_com_condominio_setor + total_provisao_igpm_setor + total_salarios_apoio_setor
        saldo_infraestrutura_final = orcamento_inicial_infra - desconto_infraestrutura

        cap_rate_regional = 0.0
        tempo_meses_amortizacao = 0
        if total_aluguel_predial_com_condominio_setor > 0:
            valor_mercado_calculado = total_aluguel_predial_com_condominio_setor / 0.0055
            cap_rate_regional = (total_aluguel_predial_com_condominio_setor / valor_mercado_calculado) * 100
            if total_provisao_igpm_setor > 0:
                tempo_meses_amortizacao = round(valor_mercado_calculado / total_provisao_igpm_setor)

        return {
            'nome_empresa': nome_empresa.upper(),
            'capital_total': capital_total,
            'saldo_infraestrutura_setor': max(0.0, saldo_infraestrutura_final),
            'patrimonio_isolado_setor': patrimonio_isolado_maquinas_setor,
            'patrimonio_ativo_total': patrimonio_global_ativos,
            'custo_fixo_isolado_setor': custo_fixo_isolado_setor,
            'custo_fixo_total': custo_fixo_global_empresa,
            'custo_variavel_isolado_setor': custo_variavel_isolado_setor,
            'custo_variavel_total': custo_variavel_global_empresa,
            'tempo_amortizacao_real': f"{tempo_meses_amortizacao} meses",
            'cap_rate_calculado': f"{cap_rate_regional:.2f}% a.m.",
            'watts_consumidos': soma_potencia_watts,
            'gas_consumido': soma_consumo_gas,
            'agua_consumida': soma_consumo_agua,
            'custo_minuto_setor': soma_custo_minuto
        }
    except Exception as e:
        print(f"Erro Crítico: {e}")
        return {'nome_empresa': "MODO SEGURANÇA", 'capital_total': 5000000.00, 'saldo_infraestrutura_setor': 2000000.00, 'patrimonio_ativo_total': 0.0, 'custo_fixo_total': 0.0, 'custo_variavel_total': 0.0, 'patrimonio_isolado_setor': 0.0, 'custo_fixo_isolado_setor': 0.0, 'custo_variavel_isolado_setor': 0.0, 'tempo_amortizacao_real': "0 meses", 'cap_rate_calculado': "0.00% a.m.", 'watts_consumidos': 0, 'gas_consumido': 0, 'agua_consumida': 0, 'custo_minuto_setor': 0}
    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
