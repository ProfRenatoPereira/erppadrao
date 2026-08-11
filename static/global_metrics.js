// erppadrao - static/global_metrics.js
// Script global responsável pelo sincronismo em tempo real dos cards financeiros do topo

document.addEventListener("DOMContentLoaded", function() {
    atualizarBarrasDeMetricasGlobais();
});

async function atualizarBarrasDeMetricasGlobais() {
    try {
        // Detecta automaticamente qual o módulo/departamento atual através da URL da página
        const path = window.location.pathname.replace('/', '') || 'dashboard';
        
        // Faz a requisição unificada ao backend master para extrair o balanço do Supabase
        const resposta = await fetch(`/api/financeiro/metricas?dept=${path}`);
        
        if (!resposta.ok) {
            console.warn("Aviso: Endpoint de métricas globais indisponível para esta sessão.");
            return;
        }
        
        const metricas = await resposta.json();
        
        // 1. Sincroniza o Caixa de Giro Geral Disponível (Visível em quase todas as telas)
        const txtGiroGlobal = document.getElementById('top_giro_global');
        if (txtGiroGlobal && metricas.capital_disponivel_total !== undefined) {
            txtGiroGlobal.innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        // 2. Sincroniza o Capital Social Total Integralizado na Fundação (Fase 2)
        const txtCapitalTotal = document.getElementById('top_capital_total');
        if (txtCapitalTotal && metricas.capital_total !== undefined) {
            txtCapitalTotal.innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        // 3. Sincroniza o Custo Fixo Mensal Acumulado da Empresa (Contratos, Aluguel, MOD Fixa)
        const txtCustoFixo = document.getElementById('top_custo_fixo');
        if (txtCustoFixo && metricas.custo_fixo_total !== undefined) {
            // Verifica se a tela pede formatação por mês ou padrão
            if (txtCustoFixo.innerText.includes('/mês')) {
                txtCustoFixo.innerHTML = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
            } else {
                txtCustoFixo.innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        }
        
        // 4. Sincroniza os Orçamentos Reais e Porcentagens Setoriais (40% Eng, 30% RH, 30% Almoxarifado)
        const txtVerbaReais = document.getElementById('top_verba_reais');
        if (txtVerbaReais && metricas.capital_disponivel_departamento !== undefined) {
            txtVerbaReais.innerText = `R$ ${metricas.capital_disponivel_departamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const txtVerbaPct = document.getElementById('top_verba_porcentagem');
        if (txtVerbaPct && metricas.capital_total > 0 && metricas.capital_disponivel_departamento !== undefined) {
            const pctCalculada = ((metricas.capital_disponivel_departamento / metricas.capital_total) * 100).toFixed(2);
            // Preserva labels específicos de telas de CRM/Vendas se houver
            if (!txtVerbaPct.innerText.includes("Canal") && !txtVerbaPct.innerText.includes("Destravado")) {
                txtVerbaPct.innerText = `${pctCalculada}% do Capital`;
            }
        }

    } catch (erro) {
        console.error("Erro crítico no processamento das métricas globais via AJAX: ", erro);
    }
}

// Expõe a função globalmente para permitir que os scripts individuais forcem a atualização após submits
window.forcarAtualizacaoMetricasTopboard = atualizarBarrasDeMetricasGlobais;
