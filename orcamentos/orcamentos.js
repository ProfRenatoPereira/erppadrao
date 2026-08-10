// erppadrao - orcamentos/orcamentos.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheCatalogoProdutos = [];

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
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Orçamentos Técnicos Comerciais aberto. Use o configurador à esquerda para simular preços de lotes com margem e despesas, ou consulte propostas salvas à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    const resMetricas = await fetch('/api/financeiro/metricas?dept=orcamentos');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // Herda Produtos (Fase 6)
    const resProdutos = await fetch('/api/produtos/listar');
    cacheCatalogoProdutos = await resProdutos.json();
    const selectP = document.getElementById('orc_produto_id');
    selectP.innerHTML = '<option value="">-- Selecione o Item --</option>' + 
        cacheCatalogoProdutos.map(p => `<option value="${p.id}">${p.sku_produto} - ${p.nome_produto}</option>`).join('');

    // Herda Clientes (Fase 6)
    const resClientes = await fetch('/api/clientes/listar');
    const clientes = await resClientes.json();
    const selectC = document.getElementById('orc_cliente_id');
    selectC.innerHTML = '<option value="">-- Comprador CRM --</option>' + 
        clientes.map(c => `<option value="${c.id}">${c.nome_cliente}</option>`).join('');

    carregarTabelaPropostas();
}

function buscarDadosCustoProduto() {
    calcularPainelOrcamento();
}

function calcularPainelOrcamento() {
    const idProd = document.getElementById('orc_produto_id').value;
    const prod = cacheCatalogoProdutos.find(x => x.id == idProd);
    const custoDiretoUn = prod ? parseFloat(prod.custo_material_bom) : 0;
    
    const quantidade = parseFloat(document.getElementById('orc_quantidade').value) || 1;
    const impostos = parseFloat(document.getElementById('orc_impostos').value) || 0;
    const comissoes = parseFloat(document.getElementById('orc_comissoes').value) || 0;
    const margem = parseFloat(document.getElementById('orc_margem').value) || 0;
    
    // Fórmula de Precificação por Markup Divisor Interno
    const divisor = 1 - ((impostos + comissoes + margem) / 100);
    const precoVendaUn = divisor > 0 ? (custoDiretoUn / divisor) : custoDiretoUn * 1.5;
    
    const custoLoteTotal = custoDiretoUn * quantidade;
    const precoLoteTotal = precoVendaUn * quantidade;
    
    // Simulação didática de lead time de fabricação (2 horas por peça)
    const leadTimeEstimado = quantidade * 2;

    document.getElementById('txt_preco_un').innerText = `R$ ${precoVendaUn.toFixed(2)} / peça`;
    document.getElementById('txt_custo_lote').innerText = `R$ ${custoLoteTotal.toFixed(2)} (Venda Lote: R$ ${precoLoteTotal.toFixed(2)})`;
    document.getElementById('txt_prazo_lote').innerText = `${leadTimeEstimado} horas úteis`;
}

async function carregarTabelaPropostas() {
    const res = await fetch('/api/orcamentos/listar');
    const dados = await res.json();
    const tbody = document.getElementById('tabela_orcamentos');
    
    if(dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum orçamento emitido.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = dados.map(o => `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3"><strong>ORC-00${o.id}</strong><br><span class="text-blue-900 font-sans font-bold">${o.sku_suporte}</span></td>
            <td class="p-3 font-sans">${o.cliente_nome_suporte}</td>
            <td class="p-3 font-bold">${o.quantidade} un</td>
            <td class="p-3 font-bold text-emerald-600">R$ ${o.total_proposto.toFixed(2)}</td>
            <td class="p-3 text-center actions-legal">
                <button onclick="deletarOrcamento(${o.id})" class="bg-red-50 text-red-700 border px-2 py-0.5 rounded text-[10px] font-bold">Excluir</button>
            </td>
        </tr>`).join('');
}

async function salvarOrcamento(e) {
    e.preventDefault();
    const selectP = document.getElementById('orc_produto_id');
    const selectC = document.getElementById('orc_cliente_id');
    if(!selectP.value || !selectC.value) return;
    
    const textoVendaTotal = document.getElementById('txt_custo_lote').innerText.split('Venda Lote: R$ ')[1].replace(')', '');

    const dados = {
        produto_id: parseInt(selectP.value),
        sku_suporte: selectP.options[selectP.selectedIndex].text.split(' - ')[0],
        cliente_id: parseInt(selectC.value),
        cliente_nome_suporte: selectC.options[selectC.selectedIndex].text,
        quantidade: parseInt(document.getElementById('orc_quantidade').value) || 1,
        total_proposto: parseFloat(textoVendaTotal)
    };

    await fetch('/api/orcamentos/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formOrcamento').reset();
    carregarDadosIniciais();
}

async function deletarOrcamento(id) {
    if(!confirm('Deseja cancelar esta proposta comercial?')) return;
    await fetch(`/api/orcamentos/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}
