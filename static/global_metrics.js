/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 1 DE 2 - CAPTURA DE ENDPOINT E SINCRONISMO DINÂMICO DO CAIXA
   ========================================================================== */

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
        
        // 1. Sincroniza o Caixa de Giro Geral Disponível / Disponível para o Setor (Suporta Fallback de ID e IDs Limpos)
        const txtGiroGlobal = document.getElementById('top_giro_global') || document.getElementById('top_disponivel_setor') || document.getElementById('top_disponivel_setor_val');
        if (txtGiroGlobal && metricas.capital_disponivel_total !== undefined) {
            txtGiroGlobal.innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        // 2. Sincroniza o Capital Social Total Integralizado na Fundação (Fase 2)
        const txtCapitalTotal = document.getElementById('top_capital_total') || document.getElementById('top_capital_total_val');
        if (txtCapitalTotal && metricas.capital_total !== undefined) {
            txtCapitalTotal.innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }

        // 3. Sincroniza o Orçamento Inicial Fixado para a Engenharia
        const txtOrcamentoInicial = document.getElementById('top_orcamento_inicial');
        if (txtOrcamentoInicial && metricas.capital_disponivel_total !== undefined) {
            txtOrcamentoInicial.innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 2 DE 2 - ATUALIZAÇÃO DE CUSTOS ACUMULADOS E VERBAS DE SUPRIMENTOS
   ========================================================================== */

        // 4. Sincroniza o Custo Fixo Mensal Acumulado da Empresa (Contratos, Aluguel, MOD Fixa)
        const txtCustoFixo = document.getElementById('top_custo_fixo') || document.getElementById('top_custo_fixo_val');
        if (txtCustoFixo && metricas.custo_fixo_total !== undefined) {
            if (txtCustoFixo.innerText.includes('/mês') || txtCustoFixo.id === 'top_custo_fixo_val') {
                txtCustoFixo.innerHTML = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
            } else {
                txtCustoFixo.innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        }

        // 5. Sincroniza o Custo Fixo Específico do Setor/Departamento Logado
        const txtCustoFixoSetor = document.getElementById('top_custo_fixo_setor');
        if (txtCustoFixoSetor && metricas.custo_fixo_departamento !== undefined) {
            txtCustoFixoSetor.innerText = `R$ ${metricas.custo_fixo_departamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        }

        // 6. Sincroniza os Custos Variáveis Globais Acumulados da Planta Fabril
        const txtCustoVariavel = document.getElementById('top_custo_variavel') || document.getElementById('top_custo_variavel_val');
        if (txtCustoVariavel && metricas.custo_variavel_total !== undefined) {
            txtCustoVariavel.innerText = `R$ ${metricas.custo_variavel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        }

        // 7. Sincroniza os Custos Variáveis Específicos do Setor Corrente
        const txtCustoVariavelSetor = document.getElementById('top_custo_variavel_setor') || document.getElementById('top_custo_variavel_setor_val');
        if (txtCustoVariavelSetor && metricas.custo_variavel_departamento !== undefined) {
            txtCustoVariavelSetor.innerText = `R$ ${metricas.custo_variavel_departamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        }
        
        // 8. Sincroniza a Verba Reservada/Sustentada Reais e Porcentagens (Trava de Abastecimento)
        const txtVerbaReais = document.getElementById('top_verba_reais') || document.getElementById('top_verba_reais_val');
        if (txtVerbaReais && metricas.capital_disponivel_departamento !== undefined) {
            txtVerbaReais.innerText = `R$ ${metricas.capital_disponivel_departamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const txtVerbaPct = document.getElementById('top_verba_porcentagem') || document.getElementById('txt_porcentagem_budget');
        if (txtVerbaPct && metricas.capital_total > 0 && metricas.capital_disponivel_departamento !== undefined) {
            const pctCalculada = ((metricas.capital_disponivel_departamento / metricas.capital_total) * 100).toFixed(2);
            if (!txtVerbaPct.innerText.includes("Canal") && !txtVerbaPct.innerText.includes("Destravado")) {
                txtVerbaPct.innerText = txtVerbaPct.id === 'txt_porcentagem_budget' ? `${pctCalculada}% do teto consumido` : `${pctCalculada}% do Capital`;
            }
        }

    } catch (erro) {
        console.error("Erro crítico no processamento das métricas globais via AJAX: ", erro);
    }
}

// Expõe a função globalmente para permitir que os scripts individuais forcem a atualização após submits
window.forcarAtualizacaoMetricasTopboard = atualizarBarrasDeMetricasGlobais;
