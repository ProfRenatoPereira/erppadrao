// erppadrao - produtos/produtos.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheInsumosAlmoxarifado = []; // Armazena as matérias-primas reais da Fase 5

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTÍNUO AUTOMATIZADO PARA SMART TV
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Engenharia de Produto aberto. Utilize o formulário de Ficha de Engenharia à esquerda para compor a árvore estrutural de componentes da sua BOM, ou confira as especificações técnicas registradas no catálogo à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos globais do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=produtos');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    // Configura a verba setorial base de desenvolvimento
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // 2. Busca e herda os insumos reais criados na Fase 5 para popular o select
    const resMateriais = await fetch('/api/materials/listar');
    cacheInsumosAlmoxarifado = await resMateriais.json();
    
    const selectInsumos = document.getElementById('insumo_vinculado');
    if (cacheInsumosAlmoxarifado.length === 0) {
        selectInsumos.innerHTML = '<option value="">❌ Nenhum Insumo no Almoxarifado (Vá para a Fase 5)</option>';
    } else {
        selectInsumos.innerHTML = '<option value="">-- Selecione a Matéria-Prima (BOM) --</option>' + 
            cacheInsumosAlmoxarifado.map(m => `<option value="${m.id}">${m.nome_material} (Custo Base: R$ ${m.preco_unitario.toFixed(2)})</option>`).join('');
    }

    // 3. Atualiza a listagem do catálogo de produtos salvos
    carregarTabelaProdutos();
}

function buscarPrecoInsumo() {
    const idInsumoSelected = document.getElementById('insumo_vinculado').value;
    const insumo = cacheInsumosAlmoxarifado.find(x => x.id == idInsumoSelected);
    
    // Aloca o preço unitário herdado da tabela de almoxarifado no campo de referência de custos
    document.getElementById('custo_ref_material').value = insumo ? insumo.preco_unitario.toFixed(2) : "0.00";
    
    calcularPrecoEstimadoBOM();
}

function calcularPrecoEstimadoBOM() {
    const quantidadeGasta = parseFloat(document.getElementById('qtd_insumo_gasta').value) || 0;
    const custoRefMaterial = parseFloat(document.getElementById('custo_ref_material').value) || 0;
    
    // Engenharia de Custos: Quantidade Absorvida * Preço do Insumo
    const custoEstruturalBOM = quantidadeGasta * custoRefMaterial;
    
    document.getElementById('custo_material_bom').value = `R$ ${custoEstruturalBOM.toFixed(2)}`;
}
async function carregarTabelaProdutos() {
    const resProdutos = await fetch('/api/produtos/listar');
    const produtos = await resProdutos.json();
    const tbody = document.getElementById('tabela_produtos');
    
    // Atualiza o contador de SKUs ativos no topo (quarto card)
    document.getElementById('top_custo_variavel').innerText = `${produtos.length} SKUs`;

    if (produtos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum produto final homologado na árvore estrutural para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = produtos.map(p => `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${p.sku_produto}</strong><br><span class="text-blue-900 font-bold">${p.nome_produto}</span></td>
            <td class="p-3 font-semibold text-gray-500">${p.unidade_venda}</td>
            <td class="p-3 text-gray-600">${p.insumo_nome_suporte || 'Matéria-prima'} (Qtd: ${p.quantidade_insumo_gasta})</td>
            <td class="p-3 font-mono font-bold text-purple-900">R$ ${(p.custo_material_bom || 0).toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarProduto(${p.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarProduto(${p.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function salvarProduto(e) {
    e.preventDefault();
    const select = document.getElementById('insumo_vinculado');
    
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_produto: document.getElementById('nome_produto').value.trim(),
        sku_produto: document.getElementById('sku_produto').value.trim().toUpperCase(),
        unidade_venda: document.getElementById('unidade_venda').value,
        insumo_id: parseInt(select.value) || null,
        insumo_nome_suporte: select.options[select.selectedIndex]?.text.split(' (')[0] || '',
        quantidade_insumo_gasta: parseFloat(document.getElementById('qtd_insumo_gasta').value) || 0,
        custo_ref_material: parseFloat(document.getElementById('custo_ref_material').value) || 0,
        custo_material_bom: parseFloat(document.getElementById('custo_material_bom').value.replace('R$ ', '')) || 0
    };

    await fetch('/api/produtos/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioProdutos();
    carregarDadosIniciais();
}

async function editarProduto(id) {
    const res = await fetch(`/api/produtos/buscar/${id}`);
    const p = await res.json();
    
    document.getElementById('registro_id').value = p.id;
    document.getElementById('nome_produto').value = p.nome_produto;
    document.getElementById('sku_produto').value = p.sku_produto;
    document.getElementById('unidade_venda').value = p.unidade_venda;
    document.getElementById('insumo_vinculado').value = p.insumo_id;
    document.getElementById('qtd_insumo_gasta').value = p.quantidade_insumo_gasta;
    document.getElementById('custo_ref_material').value = p.custo_ref_material;
    document.getElementById('custo_material_bom').value = `R$ ${p.custo_material_bom.toFixed(2)}`;
    
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Produto";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarProduto(id) {
    if (!confirm('Deseja retirar este item da árvore estrutural da empresa?')) return;
    await fetch(`/api/produtos/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioProdutos() {
    document.getElementById('formProduto').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "🔬 Homologar Produto";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('custo_material_bom').value = '';
    document.getElementById('custo_ref_material').value = '';
}
