// erppadrao - financeiro/financeiro.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}
function alternarModoEscuro() { document.body.classList.toggle('dark-mode'); }
function alternarAltoContraste() { document.body.classList.toggle('alto-contraste'); }
function alternarMenuMobile() { document.getElementById('menuNavegacao').classList.toggle('hidden'); }

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Fluxo Financeiro aberto. Utilize o formulário à esquerda para faturar duplicatas vinculadas aos clientes do CRM, ou liquide os títulos no livro razão à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos globais do topo
    const resMetricas = await fetch('/api/financeiro/metricas?dept=financeiro');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    // Configura a verba setorial base de finanças
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // 2. Busca e herda os clientes prospectados no CRM (Fase 6) para popular o seletor
    const resClientes = await fetch('/api/clientes/listar');
    const clientes = await resClientes.json();
    const selectClientes = document.getElementById('financeiro_cliente_id');
    
    if (clientes.length === 0) {
        selectClientes.innerHTML = '<option value="">❌ Nenhum Cliente Cadastrado (Vá para Clientes/CRM)</option>';
    } else {
        selectClientes.innerHTML = '<option value="">-- Selecione o Cliente Devedor --</option>' + 
            clientes.map(c => `<option value="${c.id}">${c.nome_cliente} (${c.tipo_pessoa})</option>`).join('');
    }

    // 3. Carrega o razão de contas a receber à direita
    carregarTabelaRazonete();
}
async function carregarTabelaRazonete() {
    const resTitulos = await fetch('/api/financeiro/listar');
    const titulos = await resTitulos.json();
    const tbody = document.getElementById('tabela_financeiro');
    
    let totalAberto = 0;
    let totalLiquidado = 0;
    let contadorTitulos = 0;
    
    titulos.forEach(t => {
        if (t.status_titulo === 'Aberto') {
            totalAberto += (t.financeiro_valor || 0);
            contadorTitulos++;
        } else if (t.status_titulo === 'Liquidado') {
            totalLiquidado += (t.financeiro_valor || 0);
        }
    });
    
    document.getElementById('top_total_receber').innerText = `R$ ${totalAberto.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_faturamentos_qtd').innerText = `${contadorTitulos} Títulos em Aberto`;
    document.getElementById('top_total_liquidado').innerText = `R$ ${totalLiquidado.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (titulos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum título gerado no livro razão para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = titulos.map(t => {
        const corStatus = t.status_titulo === 'Liquidado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800';
        const botaoAcao = t.status_titulo === 'Aberto' 
            ? `<button onclick="liquidarTitulo(${t.id})" class="bg-green-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase hover:bg-green-700">Liquidar</button>`
            : `<span class="text-gray-400 text-[10px] font-bold">CONCLUÍDO</span>`;

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>FT-00${t.id}</strong><br><span class="text-blue-900 font-bold">${t.cliente_nome_suporte}</span></td>
            <td class="p-3">${t.financeiro_descricao}<br><span class="text-gray-400 text-[10px]">Emissão: ${t.financeiro_data}</span></td>
            <td class="p-3 font-semibold">${t.financeiro_condicao}</td>
            <td class="p-3 font-mono font-bold text-gray-900">R$ ${t.financeiro_valor.toFixed(2)}<br><span class="px-2 py-0.2 rounded-full text-[9px] ${corStatus}">${t.status_titulo}</span></td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">${botaoAcao}</td>
        </tr>`;
    }).join('');
}

async function lancarFaturamento(e) {
    e.preventDefault();
    const select = document.getElementById('financeiro_cliente_id');
    if (!select.value) return;

    const dados = {
        cliente_id: parseInt(select.value),
        cliente_nome_suporte: select.options[select.selectedIndex].text.split(' ('),
        financeiro_descricao: document.getElementById('financeiro_descricao').value.trim(),
        financeiro_valor: parseFloat(document.getElementById('financeiro_valor').value) || 0,
        financeiro_condicao: document.getElementById('financeiro_condicao').value,
        financeiro_data: document.getElementById('financeiro_data').value
    };

    await fetch('/api/financeiro/faturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formFinanceiro').reset();
    carregarDadosIniciais();
}

async function liquidarTitulo(id) {
    if (!confirm('Deseja confirmar a liquidação e entrada física deste valor no caixa operacional disponível?')) return;
    await fetch(`/api/financeiro/liquidar/${id}`, { method: 'POST' });
    carregarDadosIniciais();
}
