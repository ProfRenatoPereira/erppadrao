// erppadrao - precificacao/precificacao.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheProdutosFicha = []; // Armazena os custos diretos herdados do Supabase

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO PARA APRESENTAÇÃO (SEM USO DO MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Controladoria e Precificação aberto. Utilize o formulário à esquerda para simular margens de lucro, despesas tributárias e markup multiplicador, ou analise as margens de contribuição na tabela à direita.`;
        const utterance = new SynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos globais do topo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=precificacao');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // 2. Busca e herda os produtos estruturados na engenharia para cruzamento de custos diretos
    const resProdutos = await fetch('/api/produtos/listar');
    cacheProdutosFicha = await resProdutos.json();
    
    // 3. Busca os processos/PCP para somar o custo operacional ao custo do material
    const resProcessos = await fetch('/api/processos/listar');
    const processos = await resProcessos.json();
    
    const selectProdutos = document.getElementById('produto_precificar');
    if (cacheProdutosFicha.length === 0) {
        selectProdutos.innerHTML = '<option value="">❌ Nenhum Produto Homologado (Vá para o Catálogo)</option>';
    } else {
        // Vincula e calcula de forma combinada (Custo Material BOM + Custo Operação PCP)
        selectProdutos.innerHTML = '<option value="">-- Selecione o Produto SKU --</option>' + 
            cacheProdutosFicha.map(p => {
                // Soma didática de herança cross-checking
                const custoMaterial = p.custo_material_bom || 0;
                const custoOperacional = processos.filter(proc => proc.sku_vinculado == p.sku_produto).reduce((a, b) => a + (b.custo_total_operacao || 0), 0);
                const custoDiretoTotal = custoMaterial + custoOperacional;
                
                // Salva o custo direto calculado dentro do objeto para recuperação rápida
                p.custo_direto_calculado = custoDiretoTotal;
                
                return `<option value="${p.id}">${p.sku_produto} - ${p.nome_produto} (Custo: R$ ${custoDiretoTotal.toFixed(2)})</option>`;
            }).join('');
    }

    carregarTabelaPrecos();
}

function buscarCustoDiretoBase() {
    const idProdSelected = document.getElementById('produto_precificar').value;
    const prod = cacheProdutosFicha.find(x => x.id == idProdSelected);
    
    document.getElementById('custo_direto_base').value = prod ? prod.custo_direto_calculado.toFixed(2) : "0.00";
    calcularFormacaoPreco();
}

function calcularFormacaoPreco() {
    const custoDireto = parseFloat(document.getElementById('custo_direto_base').value) || 0;
    const impostos = parseFloat(document.getElementById('impostos_venda').value) || 0;
    const comissoes = parseFloat(document.getElementById('comissoes_venda').value) || 0;
    
    // Abordagem Pedagógica: Margem de Lucro Desejada sobre o Preço de Venda (Margem Interna)
    const margemLucro = parseFloat(document.getElementById('margem_lucro').value) || 0;
    
    // Cálculo do Markup Divisor Tradicional de Controladoria
    const somaDeducoesPercentuais = (impostos + comissoes + margemLucro) / 100;
    
    let precoSugerido = 0;
    let markupDivisor = 1 - listSomaDeducoesPercentuais;
    
    if (markupDivisor > 0) {
        precoSugerido = custoDireto / markupDivisor;
        document.getElementById('markup_calculado').value = (1 / markupDivisor).toFixed(2);
        document.getElementById('preco_venda_sugerido').value = `R$ ${precoSugerido.toFixed(2)}`;
    } else {
        document.getElementById('markup_calculado').value = "ERRO";
        document.getElementById('preco_venda_sugerido').value = "Dedução >= 100%";
    }
}
// Continuação do arquivo precificacao/precificacao.js

async function carregarTabelaPrecos() {
    const resPrecos = await fetch('/api/precificacao/listar');
    const precos = await resPrecos.json();
    const tbody = document.getElementById('tabela_precificacao');
    
    // Recupera o custo fixo mensal real do topo para calcular o Ponto de Equilíbrio da classe
    const textoCustoFixo = document.getElementById('top_custo_fixo').innerText.replace('R$ ', '').replace('/mês', '').replace(/\./g, '').replace(',', '.');
    const custoFixoMensal = parseFloat(textoCustoFixo) || 2500; // Fallback pedagógico

    if (precos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma tabela de formação de preços ativa no Supabase para este grupo.</td></tr>`;
        document.getElementById('top_custo_variavel').innerText = "0% de Margem";
        return;
    }

    // Calcula a média das Margens de Contribuição Ativas para exibir na quarta métrica do topo
    let somaMargensPct = 0;
    precos.forEach(p => { somaMargensPct += (p.margem_lucro || 0); });
    const margemMediaGlobal = (somaMargensPct / precos.length).toFixed(1);
    document.getElementById('top_custo_variavel').innerText = `${margemMediaGlobal}% de Margem`;

    tbody.innerHTML = precos.map(p => {
        const precoVenda = p.preco_venda_sugerido || 1;
        const custoDireto = p.custo_direto_base || 0;
        
        // Margem de contribuição unitária em Reais
        const margemContribuicaoReais = precoVenda - (precoVenda * ((p.impostos_venda + p.comissoes_venda) / 100)) - custoDireto;
        
        // Ponto de Equilíbrio Didático (Ponto de Break-Even): Custo Fixo da Empresa / Margem de Contribuição Unitária
        const pontoEquilibrioPecas = margemContribuicaoReais > 0 ? Math.ceil(custoFixoMensal / margemContribuicaoReais) : "Infinito";

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${p.sku_produto_suporte}</strong><br><span class="text-blue-900 font-bold">${p.nome_produto_suporte || 'Item'}</span></td>
            <td class="p-3 font-mono">Custo Direto: R$ ${custoDireto.toFixed(2)}<br><span class="text-gray-400 text-[10px]">Markup: ${p.markup_calculado}</span></td>
            <td class="p-3 font-bold text-emerald-600">R$ ${precoVenda.toFixed(2)}</td>
            <td class="p-3 font-mono">Lucro Alvo: ${p.margem_lucro}%<br><span class="text-purple-900 font-semibold text-[10px]">MC: R$ ${margemContribuicaoReais.toFixed(2)}</span></td>
            <td class="p-3 text-center font-bold text-gray-900 font-mono">${pontoEquilibrioPecas} <span class="text-[10px] text-gray-400 font-normal">pçs/mês</span></td>
        </tr>`
    }).join('');
}

async function salvarPrecificacao(e) {
    e.preventDefault();
    const select = document.getElementById('produto_precificar');
    if (!select.value) return;

    const dados = {
        id: null, // Sistema opera em substituição de registro "Coringa" único por SKU
        produto_id: parseInt(select.value),
        sku_produto_suporte: select.options[select.selectedIndex].text.split(' - ')[0],
        nome_produto_suporte: select.options[select.selectedIndex].text.split(' - ')[1].split(' (')[0],
        custo_direto_base: parseFloat(document.getElementById('custo_direto_base').value) || 0,
        impostos_venda: float(document.getElementById('impostos_venda').value) || 0,
        comissoes_venda: float(document.getElementById('comissoes_venda').value) || 0,
        margem_lucro: float(document.getElementById('margem_lucro').value) || 0,
        markup_calculado: float(document.getElementById('markup_calculado').value) || 0,
        preco_venda_sugerido: parseFloat(document.getElementById('preco_venda_sugerido').value.replace('R$ ', '')) || 0
    };

    await fetch('/api/precificacao/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioControladoria();
    carregarDadosIniciais();
}

function limparFormularioControladoria() {
    document.getElementById('formPrecificacao').reset();
    document.getElementById('preco_venda_sugerido').value = '';
    document.getElementById('markup_calculado').value = '';
    document.getElementById('custo_direto_base').value = '';
}
