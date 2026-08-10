// erppadrao - vendas/vendas.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheTabelaPrecosControladoria = []; // Guarda os preços homologados

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO PARA APRESENTAÇÃO (SEM MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Painel de Vendas e Faturamento aberto. Utilize o formulário à esquerda para registrar novas transações comerciais selecionando produtos e clientes cadastrados, ou audite as notas fiscais emitidas na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos globais do topo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=vendas');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    // 2. Busca e herda as tabelas de preços formadas no módulo de Controladoria (Fase 6)
    const resPrecos = await fetch('/api/precificacao/listar');
    cacheTabelaPrecosControladoria = await resPrecos.json();
    
    const selectProdutos = document.getElementById('venda_produto_id');
    if (cacheTabelaPrecosControladoria.length === 0) {
        selectProdutos.innerHTML = '<option value="">❌ Nenhuma Tabela de Preços Ativa (Vá para a Controladoria)</option>';
    } else {
        selectProdutos.innerHTML = '<option value="">-- Selecione o Item p/ Faturamento --</option>' + 
            cacheTabelaPrecosControladoria.map(p => `<option value="${p.produto_id}">${p.sku_produto_suporte} - ${p.nome_produto_suporte} (Preço Ref: R$ ${p.preco_venda_sugerido.toFixed(2)})</option>`).join('');
    }

    // 3. Busca e herda os clientes prospectados na carteira CRM (Fase 6) para popular o comprador
    const resClientes = await fetch('/api/clientes/listar');
    const clientes = await resClientes.json();
    const selectClientes = document.getElementById('venda_cliente_id');
    if (clientes.length === 0) {
        selectClientes.innerHTML = '<option value="">❌ Nenhum Cliente na Carteira (Vá para Clientes/CRM)</option>';
    } else {
        selectClientes.innerHTML = '<option value="">-- Selecione o Comprador Homologado --</option>' + 
            clientes.map(c => `<option value="${c.id}">${c.nome_cliente} (${c.tipo_pessoa})</option>`).join('');
    }

    // 4. Carrega o histórico de notas fiscais faturadas à direita
    carregarTabelaFaturamento();
}

function buscarPrecoTabelaControladoria() {
    const idProdSelected = document.getElementById('venda_produto_id').value;
    const precoTabela = cacheTabelaPrecosControladoria.find(x => x.produto_id == idProdSelected);
    
    // Injeta o preço de venda sugerido da controladoria no campo de referência do painel
    document.getElementById('venda_preco_ref').value = precoTabela ? precoTabela.preco_venda_sugerido.toFixed(2) : "0.00";
    
    calcularTotalFaturamento();
}

function calcularTotalFaturamento() {
    const precoRef = parseFloat(document.getElementById('venda_preco_ref').value) || 0;
    const quantidade = parseFloat(document.getElementById('venda_quantidade').value) || 1;
    const descontoPct = parseFloat(document.getElementById('venda_desconto').value) || 0;
    
    // Fórmula Comercial Pedagógica: (Preço * Qtd) - Desconto Comercial Concedido
    const subtotal = precoRef * quantidade;
    const valorLiquidoNota = subtotal - (subtotal * (descontoPct / 100));
    
    document.getElementById('venda_valor_total').value = `R$ ${valorLiquidoNota.toFixed(2)}`;
}
// Continuação do arquivo vendas/vendas.js

async function carregarTabelaFaturamento() {
    const resVendas = await fetch('/api/vendas/listar');
    const vendas = await resVendas.json();
    const tbody = document.getElementById('tabela_vendas');
    
    // Atualiza o contador de pedidos faturados no topo (segundo card)
    document.getElementById('top_vendas_qtd').innerText = `${vendas.length} Pedidos Faturados`;
    
    // Soma a receita bruta total de vendas para atualizar os indicadores financeiros
    let receitaBrutaAcumulada = 0;
    vendas.forEach(v => { receitaBrutaAcumulada += (v.venda_valor_total || 0); });
    document.getElementById('top_receita_vendas').innerText = `R$ ${receitaBrutaAcumulada.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    // Calcula o Ticket Médio por Lote Faturado (Receita / Qtd Pedidos) para a quarta métrica
    const ticketMedio = vendas.length > 0 ? (receitaBrutaAcumulada / vendas.length) : 0;
    document.getElementById('top_ticket_medio').innerText = `R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (vendas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum faturamento de pedidos registrado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = vendas.map(v => `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>NF-00${v.id}</strong><br><span class="text-gray-400 text-[10px] font-semibold">${v.cliente_nome_suporte || 'Cliente'}</span></td>
            <td class="p-3 text-blue-900 font-bold">${v.produto_sku_suporte || 'Item SKU'}</td>
            <td class="p-3 font-mono">Vol: ${v.venda_quantidade} un<br><span class="text-gray-400 text-[10px]">Desc: ${v.venda_desconto}%</span></td>
            <td class="p-3 font-mono font-bold text-emerald-600">R$ ${(v.venda_valor_total || 0).toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="emitirAlertaNotaFiscal(${v.id})" class="bg-blue-50 text-blue-700 font-bold border border-blue-200 px-2 py-0.5 rounded text-[10px] uppercase">Emitir DANFE</button>
                <button onclick="estornarFaturamento(${v.id})" class="bg-red-50 text-red-700 font-bold border border-red-200 px-2 py-0.5 rounded text-[10px] uppercase">Estornar</button>
            </td>
        </tr>`).join('');
}

async function faturarPedido(e) {
    e.preventDefault();
    const selectProd = document.getElementById('venda_produto_id');
    const selectCli = document.getElementById('venda_cliente_id');
    
    if (!selectProd.value || !selectCli.value) return;

    const dados = {
        produto_id: parseInt(selectProd.value),
        produto_sku_suporte: selectProd.options[selectProd.selectedIndex].text.split(' - ')[0],
        cliente_id: parseInt(selectCli.value),
        cliente_nome_suporte: selectCli.options[selectCli.selectedIndex].text.split(' (')[0],
        venda_quantidade: parseInt(document.getElementById('venda_quantidade').value) || 1,
        venda_desconto: parseFloat(document.getElementById('venda_desconto').value) || 0,
        venda_obs_logistica: document.getElementById('venda_obs_logistica').value.trim(),
        venda_valor_total: parseFloat(document.getElementById('venda_valor_total').value.replace('R$ ', '')) || 0
    };

    const res = await fetch('/api/vendas/faturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    
    const r = await res.json();
    if (r.status === 'sucesso') {
        limparFormularioVendas();
        carregarDadosIniciais();
    } else {
        alert(`❌ Falha no Faturamento: ${r.message}`);
    }
}

function emitirAlertaNotaFiscal(id) {
    alert(`DANFE da Nota Fiscal Eletrônica NF-00${id} gerada com sucesso para fins de auditoria acadêmica.`);
}

async function estornarFaturamento(id) {
    if (!confirm('Deseja realizar o estorno legal deste faturamento? O saldo financeiro será estornado do caixa.')) return;
    await fetch(`/api/vendas/estornar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioVendas() {
    document.getElementById('formVenda').reset();
    document.getElementById('venda_preco_ref').value = '';
    document.getElementById('venda_valor_total').value = '';
}
