/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 1 DE 3 - CORE AJAX E AMARRAÇÃO DE TETOS NOMINAIS REAIS (20%)
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
        
        // Parametrização Macro do Capital Social e Tetos de Rateio do Setor
        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 1000000.00; // 20.00% do Capital Máster nominal fixado
        
        // 1. Sincronização da Linha Corporativa Macro (Linha 01)
        const txtCapitalTotal = document.getElementById('top_capital_total') || document.getElementById('top_capital_total_val');
        if (txtCapitalTotal) {
            txtCapitalTotal.innerText = `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        
        const txtDisponivelSetor = document.getElementById('top_disponivel_setor') || document.getElementById('top_disponivel_setor_val') || document.getElementById('top_giro_global');
        if (txtDisponivelSetor) {
            txtDisponivelSetor.innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        if (document.getElementById('pct_disponivel_setor')) {
            document.getElementById('pct_disponivel_setor').innerText = `➔ 20.00% do Cap.`;
        }

        // 2. Sincronização da Verba Inicial Homologada da Engenharia (Linha 02)
        const txtOrcamentoInicial = document.getElementById('top_orcamento_inicial');
        if (txtOrcamentoInicial) {
            txtOrcamentoInicial.innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        if (document.getElementById('pct_orcamento_inicial')) {
            document.getElementById('pct_orcamento_inicial').innerText = `➔ 20.00% do Cap.`;
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 2 DE 3 - RATEIO DO SALDO AMORTIZADO E CÁLCULO PATRIMONIAL LÍQUIDO
   ========================================================================== */

        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 1000000.00;

        // 3. Saldo Disponível de Verba Abatido por Ativos Tangíveis e Intangíveis Expandidos (Linha 02)
        const saldoVerba = metricas.saldo_disponivel_verba !== undefined ? metricas.saldo_disponivel_verba : disponivelParaSetor;
        const txtVerbaReais = document.getElementById('top_verba_reais') || document.getElementById('top_verba_reais_val');
        if (txtVerbaReais) {
            txtVerbaReais.innerText = `R$ ${saldoVerba.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            txtVerbaReais.style.color = (saldoVerba < 0) ? "#dc2626" : "#166534";
        }
        if (document.getElementById('pct_saldo_engenharia')) {
            const pctVerba = ((saldoVerba / capitalTotalEmpresa) * 100).toFixed(2);
            document.getElementById('pct_saldo_engenharia').innerText = `➔ ${pctVerba}% do Cap.`;
        }

        // 4. Sincronização Patrimonial do Parque Fabril Somado do Supabase (Linha 03)
        const valorPatrimonioHistorico = metricas.patrimonio_historico || 0.00;
        const txtPatrimonio = document.getElementById('top_patrimonio_maquinas');
        if (txtPatrimonio) {
            txtPatrimonio.innerText = `R$ ${valorPatrimonioHistorico.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        if (document.getElementById('pct_patrimonio_maquinas')) {
            const pctPat = ((valorPatrimonioHistorico / capitalTotalEmpresa) * 100).toFixed(2);
            document.getElementById('pct_patrimonio_maquinas').innerText = `➔ ${pctPat}%`;
        }

        // 5. Novo Mapeamento Contábil: Valor Contábil Líquido Atualizado por Depreciação (Linha 03)
        const valorLiquidoReal = metricas.valor_contabil_liquido !== undefined ? metricas.valor_contabil_liquido : 0.00;
        const txtPatLiqReal = document.getElementById('top_patrimonio_liquido_real');
        if (txtPatLiqReal) {
            txtPatLiqReal.innerText = `R$ ${valorLiquidoReal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        if (document.getElementById('pct_patrimonio_liquido_real')) {
            const pctLiqReal = ((valorLiquidoReal / capitalTotalEmpresa) * 100).toFixed(2);
            document.getElementById('pct_patrimonio_liquido_real').innerText = `➔ ${pctLiqReal}%`;
        }

        // 6. Atualização das Travas e Progressão Gráfica de Teto de Abastecimento (Max 20%)
        if (document.getElementById('txt_valores_limite')) {
            document.getElementById('txt_valores_limite').innerText = `R$ ${valorPatrimonioHistorico.toLocaleString('pt-BR', {minimumFractionDigits: 2})} / R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        }
        const pctTetoConsumido = (valorTotalAtivosComprados / disponivelParaSetor) * 100;
        if (document.getElementById('txt_porcentagem_budget')) {
            document.getElementById('txt_porcentagem_budget').innerText = `${pctTetoConsumido.toFixed(2)}% do teto consumido`;
        }
        if (document.getElementById('barra_progresso_budget')) {
            document.getElementById('barra_progresso_budget').style.width = `${Math.min(pctTetoConsumido, 100)}%`;
        }
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT MASTER DE INDICAÇÃO ECONÔMICA GLOBAL
   PARTE 3 DE 3 - CÁLCULO PARAMÉTRICO DE CUSTOS DUPLOS COM TAXAS REAIS
   ========================================================================== */

        // 7. Sincronização Contábil de Custos Fixos Totais e Setoriais (Linha 04)
        const custoFixoTotalGeral = metricas.custo_fixo_total || 63700.00;
        const custoFixoSetorMapeado = metricas.custo_fixo_departamento || 0.00;

        const txtCustoFixo = document.getElementById('top_custo_fix');
        if (txtCustoFixo) txtCustoFixo.innerText = `R$ ${custoFixoTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        
        const txtCustoFixoSetor = document.getElementById('top_custo_fixo_setor');
        if (txtCustoFixoSetor) txtCustoFixoSetor.innerText = `R$ ${custoFixoSetorMapeado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;

        // Percentual Relativo Duplo de Custos Fixos (Setor vs Geral)
        const pFixG_Tot = ((custoFixoTotalGeral / custoFixoTotalGeral) * 100).toFixed(1);
        const pFixS_Tot = custoFixoTotalGeral > 0 ? ((custoFixoSetorMapeado / custoFixoTotalGeral) * 100).toFixed(1) : "0.0";
        if (document.getElementById('pct_custo_fixo_geral')) document.getElementById('pct_custo_fixo_geral').innerText = `➔ Custos Totais: ${pFixG_Tot}% | Custos Fixos: 100.0%`;
        if (document.getElementById('pct_custo_fixo_setor')) document.getElementById('pct_custo_fixo_setor').innerText = `➔ Custos Totais: ${pFixS_Tot}% | Custos Fixos: ${pFixS_Tot}%`;

        // 8. Sincronização Contábil de Custos Variáveis Totais e Setoriais (Linha 05)
        const custoVariavelTotalGeral = metricas.custo_variavel_total || 0.00;
        const custoVariavelSetorMapeado = metricas.custo_variavel_departamento || 5.33;

        const txtCustoVariavel = document.getElementById('top_custo_variavel');
        if (txtCustoVariavel) txtCustoVariavel.innerText = `R$ ${custoVariavelTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;
        
        const txtCustoVariavelSetor = document.getElementById('top_custo_variavel_setor');
        if (txtCustoVariavelSetor) txtCustoVariavelSetor.innerText = `R$ ${custoVariavelSetorMapeado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}/mês`;

        // Percentual Relativo Duplo de Custos Variáveis
        const pVarG_Tot = ((custoVariavelTotalGeral / (custoVariavelTotalGeral || 1)) * 100).toFixed(1);
        const pVarS_Tot = custoVariavelTotalGeral > 0 ? ((custoVariavelSetorMapeado / custoVariavelTotalGeral) * 100).toFixed(1) : "0.0";
        if (document.getElementById('pct_custo_variavel_geral')) document.getElementById('pct_custo_variavel_geral').innerText = `➔ Custos Totais: ${pVarG_Tot}% | Custos Variáveis: 100.0%`;
        if (document.getElementById('pct_custo_variavel_setor')) document.getElementById('pct_custo_variavel_setor').innerText = `➔ Custos Totais: ${pVarS_Tot}% | Custos Variáveis: ${pVarS_Tot}%`;

    } catch (erro) {
        console.error("Erro crítico no processamento das métricas globais via AJAX: ", erro);
    }
}

window.forcarAtualizacaoMetricasTopboard = atualizarBarrasDeMetricasGlobais;
