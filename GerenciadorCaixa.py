# erppadrao - GerenciadorCaixa.py
import psycopg2
from psycopg2.extras import RealDictCursor

def obter_conexao_master():
    # Importação tardia para evitar loop de referência circular com o app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

def calcular_metricas_totais_equipe(id_equipe, departamento_atual=None):
    """
    Motor central que computa todas as entradas e saídas de caixa do Supabase
    de forma combinada e isolada para cada grupo didático.
    """
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    
    # 1. Puxa os parâmetros coringa estáveis da fundação do negócio (Fase 2)
    capital_total = 0.0
    valor_aluguel = 0.0
    nome_empresa = "GRUPO ACADÊMICO"
    
    try:
        cursor.execute("SELECT nome_empresa, capital_total, valor_aluguel FROM config_simulacao WHERE equipe_id = %s", (id_equipe,))
        config = cursor.fetchone()
        if config:
            capital_total = float(config['capital_total'] or 0)
            valor_aluguel = float(config['valor_aluguel'] or 0)
            nome_empresa = config['nome_empresa']
    except Exception:
        pass

    # 2. Computa o somatório histórico de movimentações no Livro de Fluxo de Caixa
    total_gasto_fluxo = 0.0
    try:
        # Tipo 'RECEITA' e 'LIQUIDAÇÃO' entram subtraindo (valores negativos no banco para o SUM diminuir os gastos)
        cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s", (id_equipe,))
        resultado_fluxo = cursor.fetchone()
        if resultado_fluxo and resultado_fluxo['total']:
            total_gasto_fluxo = float(resultado_fluxo['total'])
    except Exception:
        pass

    # 3. Calcula o Caixa de Giro Global Disponível (Fórmula: Capital Inicial - Gastos Globais)
    capital_disponivel_total = capital_total - total_gasto_fluxo

    # 4. Busca o orçamento liberto específico alocado para o departamento atual (Budget Didático)
    orcamento_liberado_setor = 0.0
    if departamento_atual:
        try:
            cursor.execute("SELECT orcamento_liberado FROM departamentos_orcamento WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
            dept_orc = cursor.fetchone()
            if dept_orc:
                orcamento_liberado_setor = float(dept_orc['orcamento_liberado'] or 0)
        except Exception:
            pass
    # 5. Calcula o somatório de despesas ocorridas especificamente no departamento requisitante
    gastos_especificos_setor = 0.0
    if departamento_atual:
        try:
            cursor.execute("SELECT SUM(valor) as total FROM fluxo_caixa WHERE equipe_id = %s AND departamento = %s", (id_equipe, departamento_atual))
            res_gastos = cursor.fetchone()
            if res_gastos and res_gastos['total']:
                # Transforma valores do banco em saídas reais para o cálculo da verba local do card
                gastos_especificos_setor = float(res_gastos['total'])
        except Exception:
            pass

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
        pass

    # 7. Consolidação Didática de Custos Variáveis (Insumos Estocados + Horas Extras/Encargos de RH)
    custo_valiavel_total = 0.0
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
        pass

    cursor.close()
    conexao.close()

    # Retorna o dicionário serializado unificado para injeção AJAX nas views do erppadrao
    return {
        'nome_empresa': nome_empresa.upper(),
        'capital_total': capital_total,
        'capital_disponivel_total': capital_disponivel_total,
        'capital_disponivel_departamento': max(0.0, capital_disponivel_departamento),
        'custo_fixo_total': custo_fixo_total,
        'custo_valiavel_total': custo_valiavel_total
    }
