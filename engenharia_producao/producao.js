// erppadrao - engenharia_producao/producao.js
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
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Engenharia de Produção aberto. Utilize o painel esquerdo para abrir ordens de produção consumindo insumos, ou liquide o backlog na fila à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Atualiza indicadores de saldo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=producao');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // 2. Busca e herda os produtos do catálogo (Fase 6) para o select
    const resProdutos = await fetch('/api/produtos/listar');
    const produtos = await resProdutos.json();
    const select = document.getElementById('prod_produto_id');
    
    if (produtos.length === 0) {
        select.innerHTML = '<option value="">❌ Nenhum Produto Homologado (Fase 6)</option>';
    } else {
        select.innerHTML = '<option value="">-- Selecione o Produto para Produção --</option>' + 
            produtos.map(p => `<option value="${p.id}">${p.sku_produto} - ${p.nome_produto}</option>`).join('');
    }

    carregarTabelaOrdens();
}

async function carregarTabelaOrdens() {
    const resOPs = await fetch('/api/producao/listar');
    const ops = await resOPs.json();
    const tbody = document.getElementById('tabela_producao');
    
    let totalEmitido = ops.length;
    let totalAndamento = ops.filter(x => x.status_op === 'Em Andamento').length;
    let totalConcluido = ops.filter(x => x.status_op === 'Finalizado').reduce((a, b) => a + (b.pcp_quantidade || 0), 0);
    
    document.getElementById('top_op_total').innerText = `${totalEmitido} OPs`;
    document.getElementById('top_op_andamento').innerText = `${totalAndamento} Em Execução`;
    document.getElementById('top_total_produzido').innerText = `${totalConcluido} unidades`;

    if (ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma Ordem de Produção na fila.</td></tr>`;
        return;
    }

    tbody.innerHTML = ops.map(o => {
        const corStatus = o.status_op === 'Finalizado' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800 animate-pulse';
        const botaoAcao = o.status_op === 'Em Andamento' 
            ? `<button onclick="finalizarFabricacaoLote(${o.id})" class="bg-purple-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase hover:bg-purple-700">Fechar OP</button>`
            : `<span class="text-green-600 font-extrabold text-[10px]">ESTOCADO</span>`;

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3"><strong>OP-00${o.id}</strong><br><span class="text-blue-900 font-sans font-bold">${o.produto_sku_suporte}</span></td>
            <td class="p-3 font-bold">Lote: ${o.pcp_quantidade} pçs<br><span class="text-gray-400 font-normal text-[10px] font-sans">Limite: ${o.pcp_data_limite}</span></td>
            <td class="p-3 font-sans font-semibold">${o.pcp_prioridade}</td>
            <td class="p-3 font-sans"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${corStatus}">${o.status_op}</span></td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">${botaoAcao}</td>
        </tr>`;
    }).join('');
}

async function lancarOrdemProducao(e) {
    e.preventDefault();
    const select = document.getElementById('prod_produto_id');
    if (!select.value) return;

    const dados = {
        produto_id: parseInt(select.value),
        produto_sku_suporte: select.options[select.selectedIndex].text.split(' - '),
        pcp_quantidade: parseInt(document.getElementById('prod_quantidade').value) || 1,
        pcp_prioridade: document.getElementById('prod_prioridade').value,
        pcp_data_limite: document.getElementById('prod_data_limite').value
    };

    const res = await fetch('/api/producao/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    const r = await res.json();
    if (r.status === 'erro') {
        alert(`❌ Falha no PCP: ${r.message}`);
    } else {
        document.getElementById('formProducao').reset();
        carregarDadosIniciais();
    }
}

async function finalizarFabricacaoLote(id) {
    if (!confirm('Deseja confirmar o encerramento desta OP e dar entrada no inventário de acabados?')) return;
    await fetch(`/api/producao/finalizar/${id}`, { method: 'POST' });
    carregarDadosIniciais();
}
