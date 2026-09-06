/**
 * TERADMAS ERP v2.6 - Controlador Financeiro e Gestão de Quotas Reativas
 * ARQUIVO: financeiro/financeiro.js (corrigido)
 */

let capitalDisponivelGlobal = 0.00;
let faturamentoTotalGlobal = 0.00;
let deptoAtual = "";

const formatarBRL = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

async function carregarDashboardFinanceiro() {
    try {
        const response = await fetch('/api/financeiro/metricas');
        if (!response.ok) {
            console.warn("API de métricas retornou status", response.status);
            return;
        }
        const metrics = await response.json();
        
        capitalDisponivelGlobal = parseFloat(metrics.capital_disponivel_total) || 0;
        faturamentoTotalGlobal = parseFloat(metrics.patrimonio_ativo_total) || 0;
        
        // Atualiza cards do topo (IDs presentes no HTML)
        const capTotalElem = document.getElementById('global-capital-total');
        const capDispElem = document.getElementById('global-capital-disponivel');
        const patrElem = document.getElementById('global-patrimonio');
        const custoElem = document.getElementById('global-custo-fixo');
        if (capTotalElem) capTotalElem.innerText = formatarBRL(metrics.capital_total || 0);
        if (capDispElem) capDispElem.innerText = formatarBRL(capitalDisponivelGlobal);
        if (patrElem) patrElem.innerText = formatarBRL(faturamentoTotalGlobal);
        if (custoElem) custoElem.innerText = formatarBRL(metrics.custo_fixo_geral_empresa || 0);
        
        recalcularMetricasPainel();
        await renderizarResumoQuotas();
        await carregarLivroRazao();
    } catch (e) {
        console.error("Erro na carga local de sincronia com a API:", e);
    }
}

function atualizarVisualizacaoQuota(valor) {
    const v = Number(valor) || 0;
    const pctElem = document.getElementById('percentual_valor');
    const pctSlider = document.getElementById('percentual_quota');
    if (pctElem) pctElem.value = v;
    if (pctSlider) pctSlider.value = v;
    recalcularMetricasPainel();
}

function atualizarSliderQuota(valor) {
    atualizarVisualizacaoQuota(valor);
}

function recalcularMetricasPainel() {
    const pct = parseFloat(document.getElementById('percentual_valor').value) || 0;
    const valorAlocado = capitalDisponivelGlobal * (pct / 100);
    
    const valorAlocadoElem = document.getElementById('valor_alocado_reais');
    if (valorAlocadoElem) valorAlocadoElem.value = formatarBRL(valorAlocado);
    
    const topQuotaCalculadaElem = document.getElementById('top_quota_calculada');
    if (topQuotaCalculadaElem) topQuotaCalculadaElem.innerText = formatarBRL(valorAlocado);
}

async function atualizarDetalhesSetor() {
    deptoAtual = document.getElementById('departamento_selecionado').value;
    const infoBox = document.getElementById('info_setor');
    const infoTxt = document.getElementById('info_setor_texto');
    
    if(!deptoAtual) {
        if (infoBox) infoBox.style.display = "none";
        return;
    }
    
    try {
        const response = await fetch(`/api/financeiro/quota/${deptoAtual}`);
        if (!response.ok) {
            throw new Error('Não foi possível obter quota do setor');
        }
        const data = await response.json();
        const pctSalva = Number(data.porcentagem_quota) || 0;
        
        const pctElem = document.getElementById('percentual_quota');
        const pctValor = document.getElementById('percentual_valor');
        if (pctElem) pctElem.value = pctSalva;
        if (pctValor) pctValor.value = pctSalva;
        
        if (infoTxt) infoTxt.innerHTML = `Módulo destino <strong>/${deptoAtual}</strong> selecionado para rateio. Defina a quota e confirme a alocação setorial.`;
        if (infoBox) infoBox.style.display = "block";
        
        recalcularMetricasPainel();
    } catch (err) {
        console.error("Erro ao sincronizar dados da cota setorial:", err);
    }
}

async function efetuarFaturamento(event) {
    event.preventDefault();
    const payload = {
        cliente_id: parseInt(document.getElementById('fat_cliente_id').value) || 0,
        cliente_nome_suporte: document.getElementById('fat_cliente_name').value,
        financeiro_descricao: document.getElementById('fat_descricao').value,
        financeiro_valor: parseFloat(document.getElementById('fat_valor').value) || 0,
        financeiro_condicao: document.getElementById('fat_condicao').value,
        financeiro_data: document.getElementById('fat_data').value
    };
    
    const response = await fetch('/api/financeiro/faturar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(response.ok) {
        alert("Título de faturamento registrado com sucesso no Razão!");
        const form = document.getElementById('formFaturamento');
        if (form) form.reset();
        await carregarDashboardFinanceiro();
        if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
    } else {
        const txt = await response.text();
        console.error('Erro ao faturar:', response.status, txt);
        alert('Erro ao registrar faturamento. Veja console para detalhes.');
    }
}

async function liquidarTitulo(idReg) {
    if(!confirm(`Confirmar liquidação e entrada física em caixa do título FT-00${idReg}?`)) return;
    
    const response = await fetch(`/api/financeiro/liquidar/${idReg}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    });
    
    if(response.ok) {
        alert("Título liquidado com sucesso! Saldo injetado no Caixa de Giro.");
        await carregarDashboardFinanceiro();
        if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
    } else {
        console.error('Erro na liquidação', response.status);
        alert('Falha ao liquidar título. Verifique logs.');
    }
}

async function salvarAlocacaoSetorial(event) {
    event.preventDefault();
    if(!deptoAtual) return alert("Por favor, selecione um módulo de destino alvo.");
    
    const payload = {
        departamento_id: deptoAtual,
        porcentagem_quota: parseFloat(document.getElementById('percentual_valor').value) || 0
    };
    
    const response = await fetch('/api/financeiro/quota', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(response.ok) {
        alert("Quota setorial parametrizada e salva no Supabase!");
        await carregarDashboardFinanceiro();
    } else {
        console.error('Erro ao salvar quota', response.status);
        alert('Erro ao salvar quota setorial.');
    }
}

async function renderizarResumoQuotas() {
    try {
        const response = await fetch('/api/financeiro/quotas/summary');
        if (!response.ok) {
            throw new Error('Falha ao obter summary de quotas');
        }
        const distribuicao = await response.json();
        const container = document.getElementById('tabela_quotas_resumo');
        if (!container) return;
        container.innerHTML = "";
        
        if (distribuicao.length === 0) {
            container.innerHTML = `<div style="padding:8px;background-color:#f3f4f6;border-radius:6px;">Sem quotas setoriais parametrizadas.</div>`;
            return;
        }
        
               distribuicao.forEach(setor => {
            const pct = Number(setor.porcentagem_quota) || 0;
            const valorMonetario = capitalDisponivelGlobal * (pct / 100);
            container.innerHTML += `
                <div style="padding: 6px 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 4px;">
                    <div style="display:flex; justify-content: space-between; font-weight: bold;">
                        <span>📍 /${setor.departamento_id}</span>
                        <span style="color:#16a34a;">${pct}% (${formatarBRL(valorMonetario)})</span>
                    </div>
                    <div class="barra-percentual-setor">
                        <!-- O !important força o navegador a aplicar o tamanho calculado pelo JavaScript -->
                        <div class="preenchimento-barra" style="width: ${pct}% !important;"></div>
                    </div>
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro ao montar sumário de distribuição:", e);
    }
}

async function carregarLivroRazao() {
    try {
        const response = await fetch('/api/financeiro/listar');
        if (!response.ok) {
            console.warn('Não foi possível carregar razão (status:', response.status, ')');
            return;
        }
        const dados = await response.json();
        const tbody = document.getElementById('tabela_financeiro');
        if (!tbody) return;
        tbody.innerHTML = "";
        
        if(!Array.isArray(dados) || dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;">Nenhum título localizado no razão contábil.</td></tr>`;
            return;
        }
        
        dados.forEach(item => {
            const ehAberto = (item.status_titulo || '').toString().toLowerCase() === 'aberto';
            const badgeColor = ehAberto ? 'background-color:#fef3c7;color:#d97706;' : 'background-color:#dcfce7;color:#15803d;';
            
            const botaoAcao = ehAberto 
                ? `<button onclick="liquidarTitulo(${item.id})" class="btn-submit" style="padding:4px 8px;font-size:10px;width:auto;display:inline-block;">⚡ Liquidar</button>`
                : `<span style="color:#16a34a;font-weight:bold;">✓ Em Caixa</span>`;

            const valor = Number(item.financeiro_valor) || 0;
            const cond = item.financeiro_condicao || '';
            const data = item.financeiro_data || '';

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="font-weight: bold; padding:10px;">FT-00${item.id}<br><small style="color:#6b7280;">ID: ${item.cliente_id}</small></td>
                    <td style="padding:10px;"><strong>${item.cliente_nome_suporte}</strong><br><small style="color:#94a3b8;">${item.financeiro_descricao}</small></td>
                    <td style="padding:10px;"><span style="${badgeColor}padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;">${(item.status_titulo || '').toUpperCase()}</span></td>
                    <td style="font-weight:900;color:#1e3a8a;padding:10px;">${formatarBRL(valor)}<br><small style="color:#6b7280;">${cond} | ${data}</small></td>
                    <td style="text-align:center;padding:10px;">${botaoAcao}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Erro ao preencher o livro razão:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const formF = document.getElementById('formFaturamento');
    if (formF) formF.addEventListener('submit', efetuarFaturamento);

    const formQ = document.getElementById('formAlocacao');
    if (formQ) formQ.addEventListener('submit', salvarAlocacaoSetorial);

    carregarDashboardFinanceiro();
    setInterval(carregarDashboardFinanceiro, 5000);
});
