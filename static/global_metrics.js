/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 1 DE 3 - CORE AJAX E AMARRAÇÃO DE TETOS NOMINAIS REAIS (20% / 40%)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    atualizarBarrasDeMetricasGlobais();
});

async function atualizarBarrasDeMetricasGlobais() {
    try {
        const path = window.location.pathname.replace('/', '') || 'dashboard';
        
        // Requisição AJAX unificada para extrair a matriz contábil do Supabase
        const resposta = await fetch(`/api/financeiro/metricas?dept=${path}`);
        if (!resposta.ok) {
            console.warn("Aviso: Barramento financeiro central temporariamente offline.");
            return;
        }
        
        const metricas = await resposta.json();
        
        // Parametrização Macro do Capital Social e Tetos de Rateio por Módulo (Regra de Ouro)
        const capitalTotalEmpresa = 5000000.00;
        
        // 🚨 COMPORTAMENTO ELÁSTICO: Se estiver no Imobiliário/Estrutura o limite é 40%, senão é 20%
        let fatorRateio = 0.20;
        let nomeSetorExibicao = "DO SETOR";
        let nomeSetorAbreviado = "SETOR";
        
        if (path === "estrutura") {
            fatorRateio = 0.40;
            nomeSetorExibicao = "PARA O SETOR";
            nomeSetorAbreviado = "INFRA";
        }
        
        const disponivelParaSetor = capitalTotalEmpresa * fatorRateio; 
        const stringPercentualFator = (fatorRateio * 100).toFixed(2);
        
        // 1. Sincronização da Linha Corporativa Macro (Linha 01)
        const txtCapitalTotal = document.getElementById('top_capital_total') || document.getElementById('top_capital_total_val');
        if (txtCapitalTotal) {
            txtCapitalTotal.innerText = `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const txtDisponivelSetor = document.getElementById('top_disponivel_setor') || document.getElementById('top_disponivel_setor_val') || document.getElementById('top_giro_global');
        if (txtDisponivelSetor) {
            // Se for o card completo de texto corrido imobiliário
            if (txtDisponivelSetor.id === 'top_giro_global' && path === "estrutura") {
                txtDisponivelSetor.innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            } else {
                txtDisponivelSetor.innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        }
        if (document.getElementById('pct_disponivel_setor')) {
            document.getElementById('pct_disponivel_setor').innerText = `➔ ${stringPercentualFator}% do Cap.`;
        }

        // 2. Sincronização da Verba Inicial Homologada da Engenharia (Linha 02)
        const txtOrcamentoInicial = document.getElementById('top_orcamento_inicial') || document.getElementById('top_budget_inicial');
        if (txtOrcamentoInicial) {
            txtOrcamentoInicial.innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        if (document.getElementById('pct_orcamento_inicial')) {
            document.getElementById('pct_orcamento_inicial').innerText = `➔ ${stringPercentualFator}% do Cap.`;
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 2 DE 3 - CONTRATAÇÃO DE ATIVOS, SALDOS DE INVESTIMENTOS E PROGRESS BAR
   ========================================================================== */

        // 3. Sincronização do Saldo de Orçamento Restante (Linha 02 - Card Direto)
        const gastoAtualAtivosSetor = metricas.patrimonio_setor || metricas.custo_fixo_total || 0.00;
        const saldoOrçamentoRestante = disponivelParaSetor - gastoAtualAtivosSetor;
        
        const txtBudgetSaldo = document.getElementById('top_budget_saldo') || document.getElementById('top_orcamento_saldo');
        if (txtBudgetSaldo) {
            txtBudgetSaldo.innerText = `R$ ${saldoOrçamentoRestante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }

        // 4. Sincronização de Ativos Imobilizados / Máquinas Fixadas (Linha 03)
        const txtPatrimonioSetor = document.getElementById('top_patrimonio_setor') || document.getElementById('top_ativos_setor');
        if (txtPatrimonioSetor) {
            txtPatrimonioSetor.innerText = `R$ ${gastoAtualAtivosSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const pAtivos_Cap = ((gastoAtualAtivosSetor / capitalTotalEmpresa) * 100).toFixed(2);
        const txtPctPatrimonio = document.getElementById('pct_patrimonio_setor');
        if (txtPctPatrimonio) {
            txtPctPatrimonio.innerText = `➔ ${pAtivos_Cap}% do Cap.`;
        }

        // 5. Motor de Controle do Teto Orçamentário e Alerta de Ultrapassagem (Linha 03 - Direita)
        let porcentagemConsumidaTeto = disponivelParaSetor > 0 ? (gastoAtualAtivosSetor / disponivelParaSetor) * 100 : 0;
        porcentagemConsumidaTeto = Math.min(100, Math.max(0, porcentagemConsumidaTeto));
        
        const txtBudgetSetor = document.getElementById('top_budget_setor');
        if (txtBudgetSetor) {
            txtBudgetSetor.innerText = `R$ ${gastoAtualAtivosSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} / R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const barraProgresso = document.getElementById('barra_progresso_budget');
        if (barraProgresso) {
            barraProgresso.style.width = `${porcentagemConsumidaTeto}%`;
        }
        
        const txtPorcentagemBudget = document.getElementById('txt_porcentagem_budget');
        if (txtPorcentagemBudget) {
            txtPorcentagemBudget.innerText = `${porcentagemConsumidaTeto.toFixed(1)}% do teto consumido`;
        }
        
        // 6. Alerta de Sobrecarga Visual WCAG (Muda a cor do Card se estourar o limite de 40%)
        const cardBudgetLimite = document.getElementById('card_budget_limite');
        if (cardBudgetLimite && barraProgresso) {
            if (gastoAtualAtivosSetor > disponivelParaSetor) {
                cardBudgetLimite.style.backgroundColor = "#fef2f2";
                cardBudgetLimite.style.borderColor = "#fca5a5";
                barraProgresso.style.backgroundColor = "#ef4444";
            } else {
                cardBudgetLimite.style.backgroundColor = "#f8fafc";
                cardBudgetLimite.style.borderColor = "#cbd5e1";
                barraProgresso.style.backgroundColor = "#3b82f6";
            }
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 3 DE 3 - CÁLCULO PARAMÉTRICO DE CUSTOS DUPLOS COM TAXAS REAIS
   ========================================================================== */

        // 7. Sincronização Contábil de Custos Fixos Totais e Setoriais (Linha 04)
        const custoFixoTotalGeral = metricas.custo_fixo_geral_empresa || metricas.custo_fixo_total || 21350.00;
        const custoFixoSetorMapeado = metricas.custo_fixo_departamento || (path === 'estrutura' ? custoFixoTotalGeral : 0.00);

        const txtCustoFixo = document.getElementById('top_custo_fix') || document.getElementById('top_custo_fixo_geral_empresa');
        if (txtCustoFixo) txtCustoFixo.innerText = `R$ ${custoFixoTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        
        const txtCustoFixoSetor = document.getElementById('top_custo_fixo_setor') || document.getElementById('top_custo_fixo_setor_head');
        if (txtCustoFixoSetor) txtCustoFixoSetor.innerText = `R$ ${custoFixoSetorMapeado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;

        // Percentual Relativo Duplo de Custos Fixos (Setor vs Geral)
        const pFixG_Tot = ((custoFixoTotalGeral / capitalTotalEmpresa) * 100).toFixed(2);
        const pFixS_Tot = custoFixoTotalGeral > 0 ? ((custoFixoSetorMapeado / custoFixoTotalGeral) * 100).toFixed(1) : "0.0";
        const pFixS_Cap = ((custoFixoSetorMapeado / capitalTotalEmpresa) * 100).toFixed(2);
        
        if (document.getElementById('pct_custo_fixo_geral')) document.getElementById('pct_custo_fixo_geral').innerText = `➔ Custos Totais: ${pFixG_Tot}% | Custos Fixos: 100.0%`;
        if (document.getElementById('txt_porcentagem_setor_imob')) document.getElementById('txt_porcentagem_setor_imob').innerText = `➔ Custos Totais: ${pFixS_Cap}% | Custos Fixos: ${pFixS_Tot}%`;

        // 8. Sincronização Contábil de Custos Variáveis Totais e Setoriais (Linha 05)
        const custoVariavelTotalGeral = metricas.custo_variavel_total || 0.00;
        const custoVariavelSetorMapeado = metricas.custo_variavel_departamento || 0.00;

        const txtCustoVariavel = document.getElementById('top_custo_variavel') || document.getElementById('top_custo_variavel_geral');
        if (txtCustoVariavel) txtCustoVariavel.innerText = `R$ ${custoVariavelTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        
        const txtCustoVariavelSetor = document.getElementById('top_custo_variavel_setor');
        if (txtCustoVariavelSetor) txtCustoVariavelSetor.innerText = `R$ ${custoVariavelSetorMapeado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;

        // Percentual Relativo Duplo de Custos Variáveis
        const pVarG_Tot = ((custoVariavelTotalGeral / capitalTotalEmpresa) * 100).toFixed(2);
        const pVarS_Tot = custoVariavelTotalGeral > 0 ? ((custoVariavelSetorMapeado / custoVariavelTotalGeral) * 100).toFixed(1) : "0.0";
        
        if (document.getElementById('pct_custo_variavel_geral')) document.getElementById('pct_custo_variavel_geral').innerText = `➔ Custos Totais: ${pVarG_Tot}% | Custos Variáveis: 100.0%`;
        if (document.getElementById('pct_custo_variavel_setor')) document.getElementById('pct_custo_variavel_setor').innerText = `➔ Custos Totais: 0.0% | Custos Variáveis: ${pVarS_Tot}%`;

        // Executa a varredura progressiva local caso a folha de estrutura predial necessite sincronizar
        if (typeof calcularEngenhariaPatrimonial === 'function') {
            calcularEngenhariaPatrimonial();
        }

    } catch (erro) {
        console.error("Erro crítico no processamento das métricas globais via AJAX: ", erro);
    }
}

window.forcarAtualizacaoMetricasTopboard = atualizarBarrasDeMetricasGlobais;
