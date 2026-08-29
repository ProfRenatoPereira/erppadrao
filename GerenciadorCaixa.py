# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# PARTE 1 DE 2 - GERENCIAMENTO DE CONEXÃO E AGREGADOR DE PATRIMÔNIO ATIVO
# CORREÇÃO: Cálculo correto de custos fixos do setor ESTRUTURA
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
    
    CORREÇÃO v2: Cálculo correto de custos fixos por setor
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

        # B) Módulo de Engenharia de Ativos / Máquinas (Tabela: ativos_maquinas)
        try:
            cursor.execute("SELECT SUM(preco_compra) as total FROM ativos_maquinas WHERE equipe_id = %s", (id_equipe,))
            res_maq = cursor.fetchone()
            if res_maq and res_maq['total']:
                patrimonio_ativo_total += float(res_maq['total'])
                if departamento_atual == 'maquinas':
                    patrimonio_isolado_setor += float(res_maq['total'])
        except Exception as e:
            print(f"Aviso: ativos_maquinas: {e}")
            if conexao: conexao.rollback()

        # C) Módulo de Almoxarifado / Materiais Estocados (Tabela: ativos_materials)
        try:
            cursor.execute("SELECT SUM(quantidade_estoque * preco_unitario) as total FROM ativos_materials WHERE equipe_id = %s", (id_equipe,))
            res_mat = cursor.fetchone()
            if res_mat and res_mat['total']:
                patrimonio_ativo_total += float(res_mat['total'])
                if departamento_atual == 'materiais':
                    patrimonio_isolado_setor += float(res_mat['total'])
        except Exception as e:
            print(f"Aviso: ativos_materials: {e}")
            if conexao: conexao.rollback()

# ==========================================================================
# TERADMAS ERP v2.6 - MOTOR FINANCEIRO CENTRAL (GerenciadorCaixa.py)
# PARTE 2 DE 2 - CUSTOS FIXOS, VARIÁVEIS CONSOLIDADOS E DICIONÁRIO DE SAÍDA
# CORREÇÃO: Lógica correta de soma de custos fixos
# ==========================================================================

        # ==================================================================
        # 🔒 EQUAÇÃO REVISADA 02: CONSOLIDAÇÃO DE CUSTOS FIXOS (SOMA MATRICIAL)
        # CORREÇÃO: Agora soma corretamente os custos do setor ESTRUTURA
        # ==================================================================
        
        # PASSO 1: Inicializa com valores de imóvel do setor (já calculado acima)
        custo_fixo_total_global = imob_aluguel_setor + imob_condo_setor
        if departamento_atual == 'estrutura':
            custo_fixo_isolado_setor = imob_aluguel_setor + imob_condo_setor

        # PASSO 2: Varre e consolida a folha de funcionários CLT ativa (Tabela: folha_funcionarios)
        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh_global = cursor.fetchone()
            if res_rh_global and res_rh_global['total']:
                custo_fixo_total_global += float(res_rh_global['total'])
        except Exception as e:
            print(f"Aviso: folha_funcionarios: {e}")
            if conexao: conexao.rollback()

        # PASSO 3: Varre o suporte predial específico do setor imobiliário (Tabela: estrutura_rh)
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
            # Varre encargos patronais e horas extras acumuladas (Tabela: livro_razonete_folha)
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
        # 🎛️ CIRCUITO DE TRAVAS OPERACIONAIS INDIVIDUAIS POR DEPARTAMENTO
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

        # Deduções reativas do fluxo de caixa de giro da empresa e saldo setorial
        capital_disponivel_total = capital_total - total_gasto_fluxo - valor_aluguel_global
        capital_disponivel_departamento = orcamento_liberado_setor - gastos_especificos_setor

        # Retorna o mapa de dados completo unificado para alimentar a matriz superior e rodapés
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
        # 🛡️ PROTEÇÃO DO POOL: Garante o fechamento total das comunicações abertas no Supabase
        if cursor: 
            cursor.close()
        if conexao: 
            conexao.close()
