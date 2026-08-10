// erppadrao - nota_fiscal/nota_fiscal.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheVendasHistorico = []; // Armazena as Notas fiscais e faturamentos brutos

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
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Ativar";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Escrituração Fiscal aberto. Vincule faturamentos de vendas para apurar e discriminar impostos de retenção federais, estaduais e municipais.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Puxa métricas e atualiza o topo
    const resMetricas = await fetch('/api/financeiro/metricas?dept=nota_fiscal');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    // 2. Busca e herda as vendas comerciais faturadas (Fase 7) para o select
    const resVendas = await fetch('/api/vendas/listar');
    cacheVendasHistorico = await resVendas.json();
    const selectVendas = document.getElementById('nfe_venda_id');
    
    if (cacheVendasHistorico.length === 0) {
        selectVendas.innerHTML = '<option value="">❌ Nenhuma Venda Comercial Localizada (Fase 7)</option>';
    } else {
        selectVendas.innerHTML = '<option value="">-- Selecione a Venda Comercial p/ Emissão --</option>' + 
            cacheVendasHistorico.map(v => `<option value="${v.id}">NF-00${v.id} - SKU: ${v.produto_sku_suporte} (Valor: R$ ${v.venda_valor_total.toFixed(2)})</option>`).join('');
    }

    carregarTabelaLivroFiscal();
}

function buscarDetalhesFaturamentoVenda() {
    const idVendaSelected = document.getElementById('nfe_venda_id').value;
    const venda = cacheVendasHistorico.find(x => x.id == idVendaSelected);
    
    if (venda) {
        document.getElementById('nfe_cliente_nome').value = venda.cliente_nome_suporte || "Cliente CRM";
        // Simulador de região inteligente baseado no ID
        document.getElementById('nfe_cliente_regiao').value = venda.cliente_id % 2 === 0 ? "Estadual" : "Local";
        
        // Ajusta gatilho de alíquota estadual dinâmico (ICMS 12% se fora do município, 18% se local)
        document.getElementById('aliq_icms').value = venda.cliente_id % 2 === 0 ? "12.0" : "18.0";
    } else {
        document.getElementById('nfe_cliente_nome').value = '';
        document.getElementById('nfe_cliente_regiao').value = '';
    }
    calcularParametrosFiscaisInLoco();
}
function calcularParametrosFiscaisInLoco() {
    const idVendaSelected = document.getElementById('nfe_venda_id').value;
    const venda = cacheVendasHistorico.find(x => x.id == idVendaSelected);
    const baseCalculo = venda ? parseFloat(venda.venda_valor_total) : 0;
    
    const issqn = parseFloat(document.getElementById('aliq_issqn').value) || 0;
    const icms = parseFloat(document.getElementById('aliq_icms').value) || 0;
    const pis = parseFloat(document.getElementById('aliq_pis').value) || 0;
    const cofins = parseFloat(document.getElementById('aliq_cofins').value) || 0;
    
    // Processamento da Carga Tributária em Reais (Métrica e Auditoria Governamental)
    const totalImpostosReais = baseCalculo * ((issqn + icms + pis + cofins) / 100);
    
    document.getElementById('nfe_imposto_reais_display').value = `R$ ${totalImpostosReais.toFixed(2)}`;
}

async function transmitirNotaFiscal(e) {
    e.preventDefault();
    const selectVenda = document.getElementById('nfe_venda_id');
    const venda = cacheVendasHistorico.find(x => x.id == selectVenda.value);
    if (!venda) return;

    const baseCalculo = parseFloat(venda.venda_valor_total);
    const issqn = parseFloat(document.getElementById('aliq_issqn').value) || 0;
    const icms = parseFloat(document.getElementById('aliq_icms').value) || 0;
    const pis = parseFloat(document.getElementById('aliq_pis').value) || 0;
    const cofins = parseFloat(document.getElementById('aliq_cofins').value) || 0;

    const dados = {
        venda_id: venda.id,
        cliente_nome: document.getElementById('nfe_cliente_nome').value,
        base_calculo: baseCalculo,
        valor_issqn: baseCalculo * (issqn / 100),
        valor_icms: baseCalculo * (icms / 100),
        valor_pis_cofins: baseCalculo * ((pis + cofins) / 100),
        total_impostos: baseCalculo * ((issqn + icms + pis + cofins) / 100),
        carga_tributaria_pct: issqn + icms + pis + cofins
    };

    await fetch('/api/nota_fiscal/transmitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formNotaFiscal').reset();
    carregarDadosIniciais();
}

async function carregarTabelaLivroFiscal() {
    const resLivro = await fetch('/api/nota_fiscal/listar');
    const notas = await resLivro.json();
    const tbody = document.getElementById('tabela_nota_fiscal');
    
    document.getElementById('top_nfe_qtd').innerText = `${notas.length} Notas (NF-e)`;
    
    let totalBruto = 0;
    let totalImpostos = 0;
    let somaCargaPct = 0;
    
    notas.forEach(n => {
        totalBruto += (n.base_calculo || 0);
        totalImpostos += (n.total_impostos || 0);
        somaCargaPct += (n.carga_tributaria_pct || 0);
    });
    
    const cargaMedia = notas.length > 0 ? (somaCargaPct / notas.length).toFixed(2) : "0.00";
    
    document.getElementById('top_faturamento_bruto').innerText = `R$ ${totalBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_total_impostos').innerText = `R$ ${totalImpostos.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_carga_tributaria_media').innerText = `Carga Média: ${cargaMedia}%`;
    document.getElementById('top_receita_liquida').innerText = `R$ ${(totalBruto - totalImpostos).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (notas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Livro de saídas fiscais vazio no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = notas.map(n => `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>NFE-XML-${n.id}</strong><br><span class="text-blue-900 font-bold">${n.cliente_nome}</span></td>
            <td class="p-3 font-mono font-bold">R$ ${n.base_calculo.toFixed(2)}</td>
            <td class="p-3 font-mono">Fed: R$ ${n.valor_pis_cofins.toFixed(2)}<br>Est: R$ ${n.valor_icms.toFixed(2)} | Mun: R$ ${n.valor_issqn.toFixed(2)}</td>
            <td class="p-3 font-mono font-bold text-red-700">R$ ${n.total_impostos.toFixed(2)}<br><span class="text-gray-400 text-[10px] font-normal">Carga: ${n.carga_tributaria_pct}%</span></td>
            <td class="p-3 text-center whitespace-nowrap actions-legal"><span class="text-emerald-600 font-black">✓ AUTORIZADA</span></td>
        </tr>`).join('');
}
