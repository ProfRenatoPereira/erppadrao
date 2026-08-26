# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# PARTE 1 DE 2 - GERENCIAMENTO DE CONEXÃO E AGREGADOR DE PATRIMÔNIO ATIVO
# ==========================================================================

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def obter_conexao_master():
    """Importação tardia blindada contra loops circulares e quedas de sessão no Render."""
    try:
        from app_master import URL_SUPABASE
        return psycopg2.connect(URL_SUPABASE)
    except (ImportError, AttributeError):
        # Fallback de segurança: lê diretamente as variáveis de ambiente do Render se o master falhar
        url_fallback = os.environ.get("DATABASE_URL")
        if url_fallback:
            return psycopg2.connect(url_fallback)
        raise psycopg2.DatabaseError("Não foi possível ler as credenciais do banco no ambiente atual.")

def calcular_metricas_totais_equipe(id_equipe, departamento_atual=None):
    """
    Motor central unificado que calcula o balanço patrimonial e despesas correntes
    de forma combinada e isolada, gerando métricas do setor e da empresa completa.
    """
    conexao = obter_conexao_master()
    cursor = None
    
    # Parâmetros padrão de inicialização segura do ecossistema
    capital_total = 5000000.00
    valor_aluguel_global = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    total_gasto_fluxo = 0.0
    
    # Acumuladores de Empresa Completa (Soma matricial de todos os setores válidos)
    patrimonio_ativo_total = 0.0
    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0
    
    # Indicadores Isolados do Setor Requisitante
    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0
    
    # Parâmetros Orçamentários e de Controle Administrativo originais
    orcamento_liberado_setor = 2000000.00
    gastos_especificos_setor = 0.0
    
    # Acumuladores reativos para redes técnicas de utilidades do setor 02
    soma_potencia_watts = 0.0
    soma_consumo_gas = 0.0
    soma_consumo_agua = 0.0
    soma_custo_minuto = 0.0

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. Puxa os parâmetros coringa estáveis da fundação do negócio
        try:
            cursor.execute("SELECT nome_empresa, capital_total, valor_aluguel FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
            config = cursor.fetchone()
            if config:
                capital_total = float(config['capital_total'] or 5000000.00)
                valor_aluguel_global = float(config['valor_aluguel'] or 0)
                nome_empresa = config['nome_empresa']
        except Exception as e:
            print(f"Aviso: Tabela config_simulacao indisponível ou vazia: {e}")
            if conexao: conexao.rollback()

        # 2. Computa o somatório histórico de movimentações no Livro de Fluxo de Caixa
        try:
            cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s", (id_equipe,))
            resultado_fluxo = cursor.fetchone()
            if resultado_fluxo and resultado_fluxo['total']:
                total_gasto_fluxo = float(resultado_fluxo['total'])
        except Exception as e:
            print(f"Aviso: Tabela fluxo_caixa indisponível ou sem registros: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # 🏢 EQUAÇÃO REVISADA 01: COMPUTAÇÃO E SOMA DO PATRIMÔNIO ATIVO TOTAL
        # ==================================================================
        
        # A) Módulo Imobiliário e Suporte (Mapeamento real erp_maquinas para o Setor 02)
        try:
            cursor.execute("SELECT preco_compra, departamento, potencia_watts, consumo_gas_m3, consumo_agua_m3, custo_minuto_maquina FROM erp_maquinas WHERE equipe_id = %s", (id_equipe,))
            todas_maquinas = cursor.fetchall()
            for maq in todas_maquinas:
                valor_maq = float(maq['preco_compra'] or 0)
                patrimonio_ativo_total += valor_maq
                
                # Se o ativo pertencer ao Módulo 02, computa e isola seu patrimônio e consumos
                if maq['departmento'] == 'estrutura':
                    patrimonio_isolado_setor += valor_maq
                    soma_potencia_watts += float(maq['potencia_watts'] or 0)
                    soma_consumo_gas += float(maq['consumo_gas_m3'] or 0)
                    soma_consumo_agua += float(maq['consumo_agua_m3'] or 0)
                    soma_custo_minuto += float(maq['custo_minuto_maquina'] or 0)
        except Exception:
            if conexao: conexao.rollback()

        # B) Módulo de Engenharia de Ativos / Máquinas Globais (Outros setores)
        try:
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s AND departamento != 'estrutura'", (id_equipe,))
            res_maq = cursor.fetchone()
            if res_maq and res_maq['total']:
                patrimonio_ativo_total += float(res_maq['total'])
                if departamento_atual == 'maquinas':
                    patrimonio_isolado_setor += float(res_maq['total'])
        except Exception:
            if conexao: conexao.rollback()

        # C) Módulo de Almoxarifado / Materiais Estocados (Soma intersetorial real)
        try:
            cursor.execute("SELECT SUM(quantidade_estoque * preco_unitario) as total FROM erp_materiais WHERE equipe_id = %s", (id_equipe,))
            res_mat = cursor.fetchone()
            if res_mat and res_mat['total']:
                patrimonio_ativo_total += float(res_mat['total'])
                if departamento_atual == 'materiais':
                    patrimonio_isolado_setor += float(res_mat['total'])
        except Exception:
            if conexao: conexao.rollback()
        # ==================================================================
        # 🔒 EQUAÇÃO REVISADA 02: CONSOLIDAÇÃO DE CUSTOS FIXOS (SOMA MATRICIAL)
        # ==================================================================
        
        # Puxa e equaciona os contratos de locação imobiliária do Supabase (Aluguel + Condomínio)
        total_aluguel_com_condominio_setor = 0.0
        total_provisao_igpm_setor = 0.0
        try:
            cursor.execute("SELECT valor_aluguel, valor_condominio, obs_contrato FROM imoveis_simulacao WHERE equipe_id = %s", (id_equipe,))
            imoveis = cursor.fetchall()
            for imovel in imoveis:
                aluguel_real = float(imovel['valor_aluguel'] or 0)
                condominio_real = float(imovel['valor_condominio'] or 0)
                
                # Consolida o aluguel bruto mensal somando o condomínio (Simulação real R$ 65.350,00)
                bruto_mensal = aluguel_real + condominio_real
                total_aluguel_com_condominio_setor += bruto_mensal
                
                # Resgata a Provisão do Imóvel Próprio armazenada reativamente na coluna obs_contrato
                texto_igpm = imovel['obs_contrato'] or ""
                try:
                    valor_igpm_anual = float(texto_igpm.replace('R$', '').replace('.', '').replace(',', '.').strip())
                except Exception:
                    valor_igpm_anual = bruto_mensal * 1.072
                total_provisao_igpm_setor += valor_igpm_anual
        except Exception:
            if conexao: conexao.rollback()

        # O Custo Fixo Isolado do Setor soma obrigatoriamente o Aluguel Bruto + Provisão Imóvel Próprio
        custo_fixo_isolado_setor = total_aluguel_com_condominio_setor + total_provisao_igpm_setor
        custo_fixo_total_global = custo_fixo_isolado_setor

        # Varre e consolida a folha de funcionários CLT ativa de toda a empresa
        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh_global = cursor.fetchone()
            if res_rh_global and res_rh_global['total']:
                custo_fixo_total_global += float(res_rh_global['total'])
        except Exception:
            if conexao: conexao.rollback()

        # Varre o suporte predial específico e soma o Subtotal Fixado ao custo do setor e global
        total_rh_suporte_fixado = 0.0
        try:
            cursor.execute("SELECT SUM(subtotal) as total FROM estrutura_rh WHERE equipe_id = %s", (id_equipe,))
            res_rh_imob = cursor.fetchone()
            if res_rh_imob and res_rh_imob['total']:
                total_rh_suporte_fixado = float(res_rh_imob['total'])
                custo_fixo_total_global += total_rh_suporte_fixado
                if departamento_atual == 'estrutura':
                    custo_fixo_isolado_setor += total_rh_suporte_fixado
        except Exception:
            if conexao: conexao.rollback()

        # Integra a soma matricial de custos fixos gerados pelos demais 20 setores da simulação
        try:
            cursor.execute("SELECT SUM(orcamento_liberado) as total FROM departments_orcamento_fixo WHERE equipe_id = %s AND departamento != 'estrutura'", (id_equipe,))
            res_outros_fixos = cursor.fetchone()
            if res_outros_fixos and res_outros_fixos['total']:
                custo_fixo_total_global += float(res_outros_fixos['total'])
        except Exception:
            if conexao: conexao.rollback()

        # ==================================================================
        # ⚡ EQUAÇÃO REVISADA 03: CONSOLIDAÇÃO DE CUSTOS VARIÁVEIS GLOBAIS
        # ==================================================================
        # Equaciona o consumo técnico do setor multiplicando a carga das máquinas por 220h operacionais
        custo_energia_calculado = (soma_potencia_watts / 1000.0) * 220.0 * 0.72
        custo_gas_calculado = soma_consumo_gas * 220.0 * 4.50
        custo_agua_calculado = soma_consumo_agua * 220.0 * 6.80
        
        custo_variavel_isolado_setor = custo_energia_calculado + custo_gas_calculado + custo_agua_calculado
        custo_variavel_total_global = custo_variavel_isolado_setor

        try:
            cursor.execute("SELECT SUM(encargos_patronais + valor_horas_extras) as total FROM livro_razonete_folha WHERE equipe_id = %s", (id_equipe,))
            res_folha_var = cursor.fetchone()
            if res_folha_var and res_folha_var['total']:
                custo_variavel_total_global += float(res_folha_var['total'])
                if departamento_atual == 'rh' or departamento_atual == 'folha_pagamento':
                    custo_variavel_isolado_setor += float(res_folha_var['total'])
        except Exception:
            if conexao: conexao.rollback()

        # ==================================================================
        # 🎛️ CIRCUITO DE TRAVAS OPERACIONAIS INDIVIDUAIS POR DEPARTAMENTO
        # ==================================================================
        # Atualiza o Saldo descontando do Alocado a soma de Aluguel Bruto + Provisão Própria + Subtotal do RH Suporte
        desconto_infraestrutura_total = total_aluguel_com_condominio_setor + total_provisao_igpm_setor + total_rh_suporte_fixado
        capital_disponivel_departamento = orcamento_liberado_setor - desconto_infraestrutura_total
        capital_disponivel_total = capital_total - total_gasto_fluxo - valor_aluguel_global

        # Equacionamento dinâmico da Amortização Física e Cap Rate Real
        cap_rate_regional = 0.0
        tempo_meses_amortizacao = 0
        if total_aluguel_com_condominio_setor > 0:
            valor_mercado_real = total_aluguel_com_condominio_setor / 0.0055
            cap_rate_regional = (total_aluguel_com_condominio_setor / valor_mercado_real) * 100
            if total_provisao_igpm_setor > 0:
                tempo_meses_amortizacao = round(valor_mercado_real / total_provisao_igpm_setor)

        return {
            'nome_empresa': nome_empresa.upper(),
            'capital_total': capital_total,
            'capital_disponivel_total': max(0.0, capital_disponivel_total),
            'capital_disponivel_departamento': max(0.0, capital_disponivel_departamento),
            
            # Métricas Consolidadas Universais (Toda a Empresa)
            'patrimonio_ativo_total': patrimonio_ativo_total,
            'custo_fixo_total': custo_fixo_total_global,
            'custo_variavel_total': custo_variavel_total_global,
            'custo_fixo_geral_empresa': custo_fixo_total_global,
            
            # Métricas Isoladas Específicas do Setor Requisitante
            'patrimonio_isolado_setor': patrimonio_isolado_setor,
            'custo_fixo_isolado_setor': ... if departamento_atual != 'estrutura' else custo_fixo_isolado_setor,
            'custo_fixo_real_setor_imob': custo_fixo_isolado_setor, 
            'custo_variavel_isolado_setor': custo_variavel_isolado_setor,
            
            # Repasse de variáveis calculadas em tempo real para alimentação do DOM
            'tempo_amortizacao_real': f"{tempo_meses_amortizacao} meses",
            'cap_rate_calculado': f"{cap_rate_regional:.2f}% a.m.",
            'watts_consumidos': soma_potencia_watts,
            'gas_consumido': soma_consumo_gas,
            'agua_consumida': soma_consumo_agua,
            'custo_minuto_setor': soma_custo_minuto
        }

    except Exception as e:
        print(f"Erro Crítico no Motor de Métricas de Caixa: {e}")
        return {
            'nome_empresa': "MODO SEGURANÇA", 
            'capital_total': 5000000.00, 'capital_disponivel_total': 0.0, 'capital_disponivel_departamento': 0.0,
            'patrimonio_ativo_total': 0.0, 'custo_fixo_total': 21350.00, 'custo_variavel_total': 0.0,
            'custo_fixo_geral_empresa': 21350.00, 'patrimonio_isolado_setor': 0.0, 'custo_fixo_isolado_setor': 0.0, 'custo_variavel_isolado_setor': 0.0,
            'tempo_amortizacao_real': "0 meses", 'cap_rate_calculado': "0.00% a.m.", 'watts_consumidos': 0, 'gas_consumido': 0, 'agua_consumida': 0, 'custo_minuto_setor': 0
        }

    finally:
        if cursor: cursor.close()
        if conexao: conexao.close()
