// erppadrao - estoque/estoque.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheCatalogoProdutosEngenharia = []; // Guarda os custos diretos herdados do Supabase

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
        const texto = `Módulo de Inventário de Produtos Acabados aberto. Utilize o formulário de Ajuste de Inventário à esquerda para definir saldos físicos e prateleiras de armazenagem, ou audite a acuracidade de almoxarifado na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos globais do topo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=estoque');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    // 2. Busca e herda os produtos da engenharia para carregar a ficha técnica de custos
    const resProdutos = await fetch('/api/produtos/listar');
    cacheCatalogoProdutosEngenharia = await resProdutos.json();
    
    const selectProdutos = document.getElementById('estoque_produto_id');
    if (cacheCatalogoProdutosEngenharia.length === 0) {
        selectProdutos.innerHTML = '<option value="">❌ Nenhum Produto Homologado (Vá para o Catálogo)</option>';
    } else {
        selectProdutos.innerHTML = '<option value="">-- Selecione o Produto SKU --</option>' + 
            cacheCatalogoProdutosEngenharia.map(p => `<option value="${p.id}">${p.sku_produto} - ${p.nome_produto} (Custo BOM: R$ ${p.custo_material_bom.toFixed(2)})</option>`).join('');
    }

    // 3. Atualiza a listagem do inventário físico à direita
    carregarTabelaInventario();
}

function buscarDadosFichaTecnica() {
    const idProdSelected = document.getElementById('estoque_produto_id').value;
    const prod = cacheCatalogoProdutosEngenharia.find(x => x.id == idProdSelected);
    
    // Aloca o custo da ficha técnica (BOM) como custo de fábrica referencial
    document.getElementById('custo_fabrica_ref').value = prod ? prod.custo_material_bom.toFixed(2) : "0.00";
    
    calcularValorEstoqueEst();
}

function calcularValorEstoqueEst() {
    const quantidade = parseFloat(document.getElementById('quantidade_fisica').value) || 0;
    const custoRef = parseFloat(document.getElementById('custo_fabrica_ref').value) || 0;
    
    // Abordagem Logística: Quantidade em Prateleira * Custo Unitário Absorvido
    const valorImobilizadoItem = quantidade * custoRef;
    
    document.getElementById('valor_imobilizado_item').value = `R$ ${valorImobilizadoItem.toFixed(2)}`;
}
// Continuação de estoque/estoque.js

async function carregarTabelaInventario() {
    const resEstoque = await fetch('/api/estoque/listar');
    const estoques = await resEstoque.json();
    const tbody = document.getElementById('tabela_estoque');
    
    // Atualiza o total de unidades e SKUs ativos no topo (segundo card)
    let totalUnidadesFisicas = 0;
    let totalCapitalImobilizadoPrateleira = 0;
    
    estoques.forEach(e => {
        totalUnidadesFisicas += (e.quantidade_fisica || 0);
        totalCapitalImobilizadoPrateleira += ((e.quantidade_fisica || 0) * (e.custo_fabrica_ref || 0));
    });
    
    document.getElementById('top_estoque_qtd').innerText = `${totalUnidadesFisicas} unidades`;
    document.getElementById('top_estoque_skus').innerText = `${estoques.length} SKUs Ativos`;
    
    // Aloca o capital imobilizado total na quarta métrica do topo
    document.getElementById('top_capital_imobilizado').innerText = `R$ ${totalCapitalImobilizadoPrateleira.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (estoques.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum registro de inventário consolidado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = estoques.map(e => {
        const capitalItem = (e.quantidade_fisica || 0) * (e.custo_fabrica_ref || 0);
        // Alerta de ponto de ressuprimento crítico (Gatilho do PCP)
        const classeAlerta = e.quantidade_fisica <= e.lote_minimo_alerta ? 'bg-red-100 text-red-800 animate-pulse font-bold' : 'bg-green-100 text-green-800 font-medium';
        const labelAlerta = e.quantidade_fisica <= e.lote_minimo_alerta ? '⚠️ Ressuprir' : 'Estável';

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${e.sku_suporte}</strong><br><span class="text-blue-900 font-bold">${e.nome_produto_suporte || 'Item'}</span></td>
            <td class="p-3 font-semibold text-gray-600">${e.localizacao_armazem}</td>
            <td class="p-3 font-mono">
                <span class="px-2 py-0.5 rounded text-[10px] ${classeAlerta}">Qtd: ${e.quantidade_fisica}</span><br>
                <span class="text-gray-400 text-[9px] mt-0.5 block">Status: ${labelAlerta}</span>
            </td>
            <td class="p-3 font-mono font-bold text-purple-900">R$ ${capitalItem.toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarEstoque(${e.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Ajustar</button>
                <button onclick="deletarEstoque(${e.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Zerar</button>
            </td>
        </tr>`;
    }).join('');
}

async function salvarEstoque(e) {
    e.preventDefault();
    const select = document.getElementById('estoque_produto_id');
    if (!select.value) return;

    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        produto_id: parseInt(select.value),
        sku_suporte: select.options[select.selectedIndex].text.split(' - ')[0],
        nome_produto_suporte: select.options[select.selectedIndex].text.split(' - ')[1].split(' (')[0],
        quantidade_fisica: parseFloat(document.getElementById('quantidade_fisica').value) || 0,
        localizacao_armazem: document.getElementById('localizacao_armazem').value,
        custo_fabrica_ref: parseFloat(document.getElementById('custo_fabrica_ref').value) || 0,
        lote_minimo_alerta: parseFloat(document.getElementById('lote_minimo_alerta').value) || 0
    };

    await fetch('/api/estoque/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioEstoque();
    carregarDadosIniciais();
}

async function editarEstoque(id) {
    const res = await fetch(`/api/estoque/buscar/${id}`);
    const e = await res.json();
    
    document.getElementById('registro_id').value = e.id;
    document.getElementById('estoque_produto_id').value = e.produto_id;
    document.getElementById('quantidade_fisica').value = e.quantidade_fisica;
    document.getElementById('localizacao_armazem').value = e.localizacao_armazem;
    document.getElementById('custo_fabrica_ref').value = e.custo_fabrica_ref;
    document.getElementById('lote_minimo_alerta').value = e.lote_minimo_alerta;
    
    calcularValorEstoqueEst();
    document.getElementById('btn_salvar').innerText = "🔄 Confirmar Ajuste";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarEstoque(id) {
    if(!confirm('Deseja realizar a baixa total por quebra ou inventário rotativo e zerar a posição?')) return;
    await fetch(`/api/estoque/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioEstoque() {
    document.getElementById('formEstoque').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "📦 Atualizar Saldo Físico";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('valor_imobilizado_item').value = '';
}
