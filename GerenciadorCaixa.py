# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# PARTE 1 DE 2 - GERENCIAMENTO DE CONEXÃO E AGREGADOR DE PATRIMÔNIO ATIVO
# CORREÇÃO: Alinhamento de chaves e variáveis sem acentuação gráfica
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
        url_fallback = os.environ.get("DATABASE_URL")
        if url_fallback:
            return psycopg2.connect(url_fallback)
        raise psycopg2.DatabaseError("Não foi possível ler as credenciais do banco no ambiente atual.")

def calcular_metricas_totais_equipe(id_equipe, departamento_atual=None):
    """Motor central unificado corrigido para pareamento estrito com o front-end js."""
    conexao = obter_conexao_master()
    cursor = None
    
    capital_total = 5000000.00
    valor_aluguel_global = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    total_gasto_fluxo = 0.0
    
    patrimonio_ativo_total = 0.0
    custo_fixo_total_global = 0.0
    custo_variavel_total_global = 0.0
    
    patrimonio_isolado_setor = 0.0
    custo_fixo_isolado_setor = 0.0
    custo_variavel_isolado_setor = 0.0

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("SELECT nome_empresa, capital_total, valor_aluguel FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
            config = cursor.fetchone()
            if config:
                capital_total = float(config['capital_total'] or 5000000.00)
                valor_aluguel_global = float(config['valor_aluguel'] or 0)
                nome_empresa = config['nome_empresa']
        except Exception as e:
            print(f"Aviso: Tabela config_simulacao indisponível: {e}")
            if conexao: conexao.rollback()

        try:
            cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s", (id_equipe,))
            resultado_fluxo = cursor.fetchone()
            if resultado_fluxo and resultado_fluxo['total']:
                total_gasto_fluxo = float(resultado_fluxo['total'])
        except Exception as e:
            print(f"Aviso: Tabela fluxo_caixa indisponível: {e}")
            if conexao: conexao.rollback()

        # A) Módulo Imobiliário (Tabela: imoveis_simulacao)
        imob_aluguel_setor = 0.0
        imob_condo_setor = 0.0
        try:
            cursor.execute("SELECT COALESCE(SUM(valor_aluguel), 0) as aluguel, COALESCE(SUM(valor_condominio), 0) as condo FROM imoveis_simulacao WHERE equipe_id = %s", (id_equipe,))
            res_imob = cursor.fetchone()
            if res_imob:
                imob_aluguel_setor = float(res_imob['aluguel'] or 0)
                imob_condo_setor = float(res_imob['condo'] or 0)
                patrimonio_ativo_total += imob_aluguel_setor
                if departamento_atual == 'estrutura':
                    patrimonio_isolado_setor += imob_aluguel_setor
        except Exception as e:
            print(f"Aviso: imoveis_simulacao: {e}")
            if conexao: conexao.rollback()

        # B) Módulo de Máquinas Gerais e Máquinas Alocadas na Estrutura
        try:
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s", (id_equipe,))
            res_maq = cursor.fetchone()
            if res_maq and res_maq['total']:
                patrimonio_ativo_total += float(res_maq['total'])
                
            # Captura o patrimônio específico de máquinas compradas pela infraestrutura imobiliária
            cursor.execute("SELECT SUM(preco_compra) as total FROM erp_maquinas WHERE equipe_id = %s AND departamento = %s", (id_equipe, 'ESTRUTURA'))
            res_maq_est = cursor.fetchone()
            if res_maq_est and res_maq_est['total'] and departamento_atual == 'estrutura':
                patrimonio_isolado_setor += float(res_maq_est['total'])
        except Exception as e:
            print(f"Aviso: erp_maquinas: {e}")
            if conexao: conexao.rollback()
        # ==================================================================
        # 🔒 EQUAÇÃO REVISADA 02: CONSOLIDAÇÃO DE CUSTOS FIXOS (SOMA MATRICIAL)
        # ==================================================================
        
        custo_fixo_total_global = imob_aluguel_setor + imob_condo_setor
        if departamento_atual == 'estrutura':
            custo_fixo_isolado_setor = imob_aluguel_setor + imob_condo_setor

        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh_global = cursor.fetchone()
            if res_rh_global and res_rh_global['total']:
                custo_fixo_total_global += float(res_rh_global['total'])
        except Exception as e:
            print(f"Aviso: folha_funcionarios: {e}")
            if conexao: conexao.rollback()

        # Soma o suporte do setor imobiliário
        rh_setor_valor = 0.0
        try:
            cursor.execute("SELECT COALESCE(SUM(subtotal), 0) as total FROM estrutura_rh WHERE equipe_id = %s", (id_equipe,))
            res_rh_imob = cursor.fetchone()
            if res_rh_imob:
                rh_setor_valor = float(res_rh_imob['total'] or 0)
                custo_fixo_total_global += rh_setor_valor
                if departamento_atual == 'estrutura':
                    custo_fixo_isolado_setor += rh_setor_valor
        except Exception as e:
            print(f"Aviso: estrutura_rh: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # ⚡ EQUAÇÃO REVISADA 03: CONSOLIDAÇÃO DE CUSTOS VARIÁVEIS GLOBAIS
        # ==================================================================
        try:
            cursor.execute("SELECT SUM(COALESCE(encargos_patronais, 0) + COALESCE(valor_horas_extras, 0)) as total FROM livro_razonete_folha WHERE equipe_id = %s", (id_equipe,))
            res_folha_var = cursor.fetchone()
            if res_folha_var and res_folha_var['total']:
                custo_variavel_total_global += float(res_folha_var['total'])
                if departamento_atual == 'rh' or departamento_atual == 'folha_pagamento':
                    custo_variavel_isolado_setor += float(res_folha_var['total'])
        except Exception as e:
            print(f"Aviso: livro_razonete_folha: {e}")
            if conexao: conexao.rollback()

        # ==================================================================
        # 🎗 CIRCUITO DE TRAVAS OPERACIONAIS INDIVIDUAIS POR DEPARTAMENTO
        # ==================================================================
        orcamento_liberado_setor = 0.0
        gastos_especificos_setor = 0.0
        
        if departamento_atual:
            try:
                cursor.execute("SELECT orcamento_liberado FROM departamentos_orcamento WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
                dept_orc = cursor.fetchone()
                if dept_orc:
                    orcamento_liberado_setor = float(dept_orc['orcamento_liberado'] or 0)
            except Exception as e:
                print(f"Aviso: departamentos_orcamento: {e}")
                if conexao: conexao.rollback()

            try:
                cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
                res_gastos = cursor.fetchone()
                if res_gastos and res_gastos['total']:
                    gastos_especificos_setor = float(res_gastos['total'])
            except Exception as e:
                print(f"Aviso: fluxo_caixa filtrado: {e}")
                if conexao: conexao.rollback()

        capital_disponivel_total = capital_total - total_gasto_fluxo - valor_aluguel_global
        capital_disponivel_departamento = orcamento_liberado_setor - gastos_especificos_setor

        return {
            'nome_empresa': nome_empresa.upper(),
            'capital_total': capital_total,
            'capital_disponivel_total': max(0.0, capital_disponivel_total),
            'capital_disponivel_departamento': max(0.0, capital_disponivel_departamento),
            
            'patrimonio_ativo_total': patrimonio_ativo_total,
            'custo_fixo_total': custo_fixo_total_global,
            'custo_variavel_total': custo_variavel_total_global,
            'custo_fixo_geral_empresa': custo_fixo_total_global,
            
            'patrimonio_isolado_setor': patrimonio_isolado_setor,
            'custo_fixo_isolado_setor': custo_fixo_isolado_setor,
            'custo_variavel_isolado_setor': custo_variavel_isolado_setor
        }

    except Exception as e:
        print(f"Erro Crítico no Motor de Métricas de Caixa: {e}")
        return {
            'nome_empresa': "MODO SEGURANÇA", 
            'capital_total': 5000000.00, 'capital_disponivel_total': 0.0, 'capital_disponivel_departamento': 0.0,
            'patrimonio_ativo_total': 0.0, 'custo_fixo_total': 21350.00, 'custo_variavel_total': 0.0,
            'custo_fixo_geral_empresa': 21350.00, 'patrimonio_isolado_setor': 0.0, 'custo_fixo_isolado_setor': 0.0, 'custo_variavel_isolado_setor': 0.0
        }

    finally:
        if cursor: 
            cursor.close()
        if conexao: 
            conexao.close()
