/**
 * TERADMAS ERP v2.6 - Controlador Financeiro e Gestão de Quotas Reativas (20 Módulos)
 */

let capitalDisponivelGlobal = 0.00;
let faturamentoTotalGlobal = 0.00;
let deptoAtual = "";

const formatarBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function carregarDashboardFinanceiro() {
    try {
        const response = await fetch('/api/financeiro/metrics');
        const metrics = await response.json();
        
        // Atribui valores coletados, tratando nulos ou indefinidos de forma segura
        capitalDisponivelGlobal = parseFloat(metrics.capital_total) || 0;
        faturamentoTotalGlobal = parseFloat(metrics.faturamento_consolidado) || 0;
        
        document.getElementById('top_capital_total').innerText = formatarBRL(capitalDisponivelGlobal);
        document.getElementById('top_giro_global').innerText = formatarBRL(faturamentoTotalGlobal);
        
        recalcularMétricasPainel();
        await renderizarResumoQuotas();
        await carregarLivroRazao();
    } catch (e) {
        console.error("Erro na carga inicial das métricas corporativas:", e);
    }
}

function atualizarVisualizacaoQuota(valor) {
    document.getElementById('percentual_valor').value = valor;
    recalcularMétricasPainel();
}

function atualizarSliderQuota(valor) {
    document.getElementById('percentual_quota').value = valor;
    recalcularMétricasPainel();
}

function recalcularMétricasPainel() {
    const pct = parseFloat(document.getElementById('percentual_valor').value) || 0;
    // Calcula o valor real da cota; se capital total for 0, o retorno será R$ 0,00 mantendo estabilidade
    const valorAlocado = capitalDisponivelGlobal * (pct / 100);
    
    document.getElementById('valor_alocado_reais').value = formatarBRL(valorAlocado);
    document.getElementById('top_quota_calculada').innerText = formatarBRL(valorAlocado);
    
    // Cálculo do Custo Operacional Líquido Reativo baseado na variável injetada
    const custoFixoFicticioBase = 4200.00;
    const custoCalculado = custoFixoFicticioBase - (valorAlocado * 0.15);
    document.getElementById('top_custo_fixo').innerText = formatarBRL(custoCalculado < 0 ? 0 : custoCalculado);
}

async function atualizarDetalhesSetor() {
    deptoAtual = document.getElementById('departamento_selecionado').value;
    const infoBox = document.getElementById('info_setor');
    const infoTxt = document.getElementById('info_setor_texto');
    
    if(!deptoAtual) {
        infoBox.style.display = "none";
        return;
    }
    
    try {
        const response = await fetch(`/api/financeiro/quota/${deptoAtual}`);
        const data = await response.json();
        const pctSalva = data.porcentagem_quota || 0;
        
        document.getElementById('percentual_quota').value = pctSalva;
        document.getElementById('percentual_valor').value = pctSalva;
        
        infoTxt.innerHTML = `Módulo destino <strong>/${deptoAtual}</strong> selecionado. Defina e salve a quota percentual desejada.`;
        infoBox.style.display = "block";
        
        recalcularMétricasPainel();
    } catch (err) {
        console.error("Erro ao sincronizar dados da cota do módulo:", err);
    }
}

async function efetuarFaturamento(event) {
    event.preventDefault();
    const payload = {
        cliente_id: parseInt(document.getElementById('fat_cliente_id').value) || 0,
        cliente_nome_suporte: document.getElementById('fat_cliente_nome').value,
        financeiro_descricao: document.getElementById('fat_descricao').value,
        financeiro_valor: parseFloat(document.getElementById('fat_valor').value),
        financeiro_condicao: document.getElementById('fat_condicao').value,
        financeiro_data: document.getElementById('fat_data').value
    };
    
    const response = await fetch('/api/financeiro/faturar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(response.ok) {
        alert("Título gerado e registrado no Razão com sucesso!");
        document.getElementById('formFaturamento').reset();
        await carregarDashboardFinanceiro();
    }
}

async function liquidarTitulo(idReg) {
    if(!confirm(`Confirmar liquidação e entrada física em caixa do título FT-00${idReg}?`)) return;
    
    const response = await fetch(`/api/financeiro/liquidar/${idReg}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    });
    
    if(response.ok) {
        alert("Título liquidado! Recurso injetado no Caixa de Giro.");
        await carregarDashboardFinanceiro();
    }
}

async function salvarAlocacaoSetorial(event) {
    event.preventDefault();
    if(!deptoAtual) return alert("Selecione um módulo alvo primeiro.");
    
    const payload = {
        departamento_id: deptoAtual,
        porcentagem_quota: parseFloat(document.getElementById('percentual_valor').value)
    };
    
    const response = await fetch('/api/financeiro/quota', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    if(response.ok) {
        alert("Quota parametrizada salva com sucesso!");
        await carregarDashboardFinanceiro();
    }
}

async function renderizarResumoQuotas() {
    try {
        const response = await fetch('/api/financeiro/quotas/summary');
        const distribuicao = await response.json();
        const container = document.getElementById('tabela_quotas_resumo');
        container.innerHTML = "";
        
        if (distribuicao.length === 0) {
            container.innerHTML = `<div style="padding:8px;background-color:#f3f4f6;font-size:11px;">Sem quotas setoriais parametrizadas.</div>`;
            return;
        }
        
        distribuicao.forEach(setor => {
            const valorMonetario = capitalDisponivelGlobal * (setor.porcentagem_quota / 100);
            container.innerHTML += `
                <div style="padding: 6px 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px;">
                    <div style="display:flex; justify-content: space-between; font-weight: bold;">
                        <span>📍 /${setor.departamento_id}</span>
                        <span style="color:#16a34a;">${setor.porcentagem_quota}% (${formatarBRL(valorMonetario)})</span>
                    </div>
                    <div class="barra-percentual-setor">
                        <div class="preenchimento-barra" style="width: ${setor.porcentagem_quota}%"></div>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error("Erro ao renderizar painel de sumário:", e);
    }
}

async function carregarLivroRazao() {
    try {
        const response = await fetch('/api/financeiro/listar');
        const dados = await response.json();
        const tbody = document.getElementById('tabela_financeiro');
        tbody.innerHTML = "";
        
        if(dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:12px;color:#94a3b8;">Nenhum título localizado no razão contábil.</td></tr>`;
            return;
        }
        
        dados.forEach(item => {
            const ehAberto = item.status_titulo === 'Aberto';
            const badgeColor = ehAberto ? 'background-color:#fef3c7;color:#d97706;' : 'background-color:#dcfce7;color:#15803d;';
            
            const botaoAcao = ehAberto 
                ? `<button onclick="liquidarTitulo(${item.id})" class="btn-submit" style="padding:4px 8px;font-size:10px;width:auto;display:inline-block;">⚡ Liquidar</button>`
                : `<span style="color:#16a34a;font-weight:bold;">✓ Em Caixa</span>`;

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="font-weight: bold; padding:10px;">FT-00${item.id}<br><small style="color:#6b7280;">ID Clie: ${item.cliente_id}</small></td>
                    <td style="padding:10px;"><strong>${item.cliente_nome_suporte}</strong><br><small style="color:#94a3b8;">${item.financeiro_descricao}</small></td>
                    <td style="padding:10px;"><span style="${badgeColor}padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;">${item.status_titulo.toUpperCase()}</span></td>
                    <td style="font-weight:900;color:#1e3a8a;padding:10px;">${formatarBRL(parseFloat(item.financeiro_valor))}<br><small style="color:#6b7280;">${item.financeiro_condicao} | ${item.financeiro_data}</small></td>
                    <td style="text-align:center;padding:10px;">${botaoAcao}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Erro ao preencher o livro razão:", err);
    }
}

document.addEventListener("DOMContentLoaded", carregarDashboardFinanceiro);
