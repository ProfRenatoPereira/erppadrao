/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 1 DE 2 - CAPTURA DE ENDPOINT E SINCRONISMO DINÂMICO DO CAIXA
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    atualizarBarrasDeMetricasGlobais();
});

async function atualizarBarrasDeMetricasGlobais() {
    try {
        // Detecta o módulo através da URL (Ex: /processos, /materiais, /maquinas)
        const path = window.location.pathname.replace('/', '') || 'dashboard';
        
        // Faz a requisição AJAX unificada ao backend master do ecossistema
        const resposta = await fetch(`/api/financeiro/metricas?dept=${path}`);
        
        if (!resposta.ok) {
            console.warn("Aviso: Endpoint de métricas globais indisponível para esta sessão.");
            return;
        }
        
        const metricas = await resposta.json();
        
        // 1. Sincroniza Giro Geral / Orçamento Setorial Disponível
        // Suporta tanto o ID genérico quanto o sufixo específico '_val' do Módulo 07
        const txtGiroGlobal = document.getElementById('top_giro_global') || document.getElementById('top_disponivel_setor_val');
        if (txtGiroGlobal && metricas.capital_disponivel_total !== undefined) {
            txtGiroGlobal.innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        // 2. Sincroniza o Capital Social Total Integralizado da Empresa (R$ 5.000.000,00)
        const txtCapitalTotal = document.getElementById('top_capital_total') || document.getElementById('top_capital_total_val');
        if (txtCapitalTotal && metricas.capital_total !== undefined) {
            txtCapitalTotal.innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 2 DE 2 - ATUALIZAÇÃO DE CUSTOS ACUMULADOS E VERBAS DE SUPRIMENTOS
   ========================================================================== */

        // 3. Sincroniza o Custo Fixo Mensal Acumulado da Planta Operacional
        const txtCustoFixo = document.getElementById('top_custo_fixo') || document.getElementById('top_custo_fixo_val');
        if (txtCustoFixo && metricas.custo_fixo_total !== undefined) {
            if (txtCustoFixo.innerText.includes('/mês') || txtCustoFixo.id === 'top_custo_fixo_val') {
                txtCustoFixo.innerHTML = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
            } else {
                txtCustoFixo.innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        }
        
        // 4. Sincroniza a Verba Reservada/Sustentada do Departamento Corrente
        const txtVerbaReais = document.getElementById('top_verba_reais') || document.getElementById('top_verba_reais_val');
        if (txtVerbaReais && metricas.capital_disponivel_departamento !== undefined) {
            txtVerbaReais.innerText = `R$ ${metricas.capital_disponivel_departamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        // 5. Calcula e renderiza o percentual do orçamento consumido/disponível
        const txtVerbaPct = document.getElementById('top_verba_porcentagem') || document.getElementById('txt_porcentagem_budget');
        if (txtVerbaPct && metricas.capital_total > 0 && metricas.capital_disponivel_departamento !== undefined) {
            const pctCalculada = ((metricas.capital_disponivel_departamento / metricas.capital_total) * 100).toFixed(1);
            if (!txtVerbaPct.innerText.includes("Canal") && !txtVerbaPct.innerText.includes("Destravado")) {
                txtVerbaPct.innerText = txtVerbaPct.id === 'txt_porcentagem_budget' ? `${pctCalculada}% do teto consumido` : `${pctCalculada}% do Capital`;
            }
        }

    } catch (erro) {
        console.error("Erro crítico no processamento das métricas globais via AJAX: ", erro);
    }
}

// Vincula a execução ao escopo global do navegador
window.forcarAtualizacaoMetricasTopboard = atualizarBarrasDeMetricasGlobais;
