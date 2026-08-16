# erppadrao - GerenciadorCaixa.py - PARTE 1 DE 2
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
    Motor central que computa todas as entradas e saídas de caixa do Supabase
    de forma combinada e isolada para cada grupo didático.
    """
    conexao = obter_conexao_master()
    cursor = None
    
    # Parâmetros padrão de inicialização segura
    capital_total = 0.0
    valor_aluguel = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    total_gasto_fluxo = 0.0
    orcamento_liberado_setor = 0.0
    gastos_especificos_setor = 0.0
    custo_fixo_total = 0.0
    custo_valiavel_total = 0.0

    try:
        cursor = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. Puxa os parâmetros coringa estáveis da fundação do negócio
        try:
            cursor.execute("SELECT nome_empresa, capital_total, valor_aluguel FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
            config = cursor.fetchone()
            if config:
                capital_total = float(config['capital_total'] or 0)
                valor_aluguel = float(config['valor_aluguel'] or 0)
                nome_empresa = config['nome_empresa']
        except Exception:
            if conexao: conexao.rollback()

        # 2. Computa o somatório histórico de movimentações no Livro de Fluxo de Caixa
        try:
            cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s", (id_equipe,))
            resultado_fluxo = cursor.fetchone()
            if resultado_fluxo and resultado_fluxo['total']:
                total_gasto_fluxo = float(resultado_fluxo['total'])
        except Exception:
            if conexao: conexao.rollback()

        # 🌟 EQUAÇÃO REVISADA: O Caixa de Giro agora desconta dinamicamente os aluguéis ativos firmados!
        capital_disponivel_total = capital_total - total_gasto_fluxo - valor_aluguel
# erppadrao - GerenciadorCaixa.py - PARTE 2 DE 2
        # 4. Busca o orçamento liberto específico alocado para o departamento atual
        if departamento_atual:
            try:
                cursor.execute("SELECT orcamento_liberado FROM departamentos_orcamento WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
                dept_orc = cursor.fetchone()
                if dept_orc:
                    orcamento_liberado_setor = float(dept_orc['orcamento_liberado'] or 0)
            except Exception:
                if conexao: conexao.rollback()
        
        # 5. Calcula o somatório de despesas ocorridas especificamente no departamento requisitante
        if departamento_atual:
            try:
                cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
                res_gastos = cursor.fetchone()
                if res_gastos and res_gastos['total']:
                    gastos_especificos_setor = float(res_gastos['total'])
            except Exception:
                if conexao: conexao.rollback()

        # Verba disponível do setor = Budget Inicial Alocado - O que o setor já gastou
        capital_disponivel_departamento = orcamento_liberado_setor - gastos_especificos_setor

        # 6. Consolidação Didática de Custos Fixos Correntes (Aluguel Imobiliário + Salários Base CLT do RH)
        custo_fixo_total = valor_aluguel
        try:
            cursor.execute("SELECT SUM(salario_base) as total FROM folha_funcionarios WHERE equipe_id = %s", (id_equipe,))
            res_rh = cursor.fetchone()
            if res_rh and res_rh['total']:
                custo_fixo_total += float(res_rh['total'])
        except Exception:
            if conexao: conexao.rollback()

        # 7. Consolidação Didática de Custos Variáveis (Insumos Estocados + Horas Extras/Encargos de RH)
        try:
            # Insumos no Almoxarifado
            cursor.execute("SELECT SUM(quantidade_estoque * preco_unitario) as total FROM ativos_materiais WHERE equipe_id = %s", (id_equipe,))
            res_mat = cursor.fetchone()
            if res_mat and res_mat['total']:
                custo_valiavel_total += float(res_mat['total'])
                
            # Encargos patronais e HE acumuladas na folha ativa
            cursor.execute("SELECT SUM(encargos_patronais + valor_horas_extras) as total FROM livro_razonete_folha WHERE equipe_id = %s", (id_equipe,))
            res_folha = cursor.fetchone()
            if res_folha and res_folha['total']:
                custo_valiavel_total += float(res_folha['total'])
        except Exception:
            if conexao: conexao.rollback()

        return {
            'nome_empresa': nome_empresa.upper(),
            'capital_total': capital_total,
            'capital_disponivel_total': max(0.0, capital_disponivel_total),
            'capital_disponivel_departamento': max(0.0, capital_disponivel_departamento),
            'custo_fixo_total': custo_fixo_total,
            'custo_valiavel_total': custo_valiavel_total
        }

    except Exception as e:
        print(f"Erro no Motor de Métricas de Caixa: {e}")
        return {
            'nome_empresa': "MODO SEGURANÇA", 'capital_total': 0.0, 'capital_disponivel_total': 0.0,
            'capital_disponivel_departamento': 0.0, 'custo_fixo_total': 0.0, 'custo_valiavel_total': 0.0
        }

    finally:
        # 🛡️ PROTEÇÃO DO POOL: Garante o fechamento total das comunicações abertas
        if cursor: 
            cursor.close()
        if conexao: 
            conexao.close()
