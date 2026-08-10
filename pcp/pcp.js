// erppadrao - pcp/pcp.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheAtivosMaquinas = []; // Guarda as máquinas cadastradas na Fase 4

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTÍNUO PARA PROJETOR DA SALA DE AULA (SEM MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Página 10 de Planejamento e Controle de Produção aberta. Use o formulário à esquerda para sequenciar roteiros operacionais de ordens de serviço, ou audite as filas de produção ativas no chão de fábrica à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Puxa métricas e atualiza o widget financeiro do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=pcp');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // 2. Busca e herda as Máquinas (Fase 4) para popular o Posto de Trabalho
    const resMaquinas = await fetch('/api/maquinas/listar');
    cacheAtivosMaquinas = await resMaquinas.json();
    const selectMaquinas = document.getElementById('pcp_maquina_id');
    
    if (cacheAtivosMaquinas.length === 0) {
        selectMaquinas.innerHTML = '<option value="">❌ Nenhuma Máquina (Fase 4)</option>';
    } else {
        selectMaquinas.innerHTML = '<option value="">-- Posto de Trabalho --</option>' + 
            cacheAtivosMaquinas.map(m => `<option value="${m.id}">${m.nome_equipamento}</option>`).join('');
    }

    // 3. Busca e herda os Produtos do Catálogo de Engenharia (Fase 6)
    const resProdutos = await fetch('/api/produtos/listar');
    const produtos = await resProdutos.json();
    const selectProdutos = document.getElementById('pcp_produto_id');
    
    if (produtos.length === 0) {
        selectProdutos.innerHTML = '<option value="">❌ Nenhum Item (Fase 6)</option>';
    } else {
        selectProdutos.innerHTML = '<option value="">-- Item Final --</option>' + 
            produtos.map(p => `<option value="${p.id}">${p.sku_produto}</option>`).join('');
    }

    // 4. Busca e herda os Operadores Cadastrados no Quadro de Pessoal (Fase 7 - RH)
    const resRH = await fetch('/api/rh/listar');
    const funcionarios = await resRH.json();
    const selectOperadores = document.getElementById('pcp_operador_id');
    
    if (funcionarios.length === 0) {
        selectOperadores.innerHTML = '<option value="">❌ Sem MOD (Fase 7)</option>';
    } else {
        selectOperadores.innerHTML = '<option value="">-- Apontamento MOD --</option>' + 
            funcionarios.map(f => `<option value="${f.id}">${f.nome_colaborador}</option>`).join('');
    }

    // 5. Atualiza o grid de monitoramento operacional à direita
    carregarFilaChaoFabrica();
}
// Continuação de pcp/pcp.js

async function carregarFilaChaoFabrica() {
    const resOPs = await fetch('/api/pcp/listar');
    const ops = await resOPs.json();
    const tbody = document.getElementById('tabela_pcp');

    if (ops.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-gray-400 italic">Nenhum roteiro ou ordem de serviço na fila de produção.</td></tr>`;
        return;
    }

    tbody.innerHTML = ops.map(o => {
        const corStatus = o.status_op === 'Finalizado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800 animate-pulse';
        const botaoAcao = o.status_op === 'Em Andamento' 
            ? `<button onclick="concluirOperacaoChaoFabrica(${o.id})" class="bg-purple-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase hover:bg-purple-700">Apontar</button>`
            : `<span class="text-green-600 font-extrabold text-[10px]">✔ ENVIADO</span>`;

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 border-r font-bold text-gray-900">${o.os_pedido}</td>
            <td class="p-3 border-r">${o.num_operacao}</td>
            <td class="p-3 border-r font-sans">${o.maquina_nome_suporte}</td>
            <td class="p-3 border-r font-sans"><strong>${o.produto_sku_suporte}</strong><br><span class="text-[10px] text-gray-400">Lote: ${o.pcp_quantidade} pçs</span></td>
            <td class="p-3 border-r text-gray-500">${o.data_entrada_op || '08:00'}</td>
            <td class="p-3 border-r font-bold text-blue-900">${o.tempo_lote} min</td>
            <td class="p-3 border-r text-gray-500">${o.data_saida_op || '08:15'}</td>
            <td class="p-3 border-r font-bold text-purple-900">R$ ${(o.custo_operacao_total || 0).toFixed(2)}</td>
            <td class="p-3 border-r font-sans">${o.operador_nome_suporte}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">${botaoAcao}</td>
        </tr>`;
    }).join('');
}

async function lancarOrdemProducao(e) {
    e.preventDefault();
    const selectMaq = document.getElementById('pcp_maquina_id');
    const selectProd = document.getElementById('pcp_produto_id');
    const selectOp = document.getElementById('pcp_operador_id');

    // Recupera o custo por minuto da máquina selecionada para calcular o lote
    const idMaq = selectMaq.value;
    const maquinaReal = cacheAtivosMaquinas.find(x => x.id == idMaq);
    const custoMinutoRef = maquinaReal ? maquinaReal.custo_minuto_maquina : 0.05;

    const tempoLoteTotal = parseFloat(document.getElementById('tempo_lote').value) || 0;
    const custoCalculadoDaOperacao = tempoLoteTotal * custoMinutoRef;

    const dados = {
        os_pedido: document.getElementById('os_pedido').value.trim().toUpperCase(),
        num_operacao: parseInt(document.getElementById('num_operacao').value) || 10,
        maquina_id: parseInt(idMaq),
        maquina_nome_suporte: selectMaq.options[selectMaq.selectedIndex].text,
        produto_id: parseInt(selectProd.value),
        produto_sku_suporte: selectProd.options[selectProd.selectedIndex].text,
        pcp_quantidade: parseInt(document.getElementById('pcp_quantidade').value) || 1,
        tempo_lote: tempoLoteTotal,
        operador_id: parseInt(selectOp.value),
        operador_nome_suporte: selectOp.options[selectOp.selectedIndex].text,
        custo_operacao_total: custoCalculadoDaOperacao
    };

    const res = await fetch('/api/pcp/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    const r = await res.json();
    if(r.status === 'erro') {
        alert(`❌ Falha no Apontamento: ${r.message}`);
    } else {
        document.getElementById('formPCP').reset();
        carregarDadosIniciais();
    }
}

async function concluirOperacaoChaoFabrica(id) {
    if (!confirm('Deseja fechar esta operação e atualizar o saldo físico do estoque?')) return;
    await fetch(`/api/pcp/finalizar/${id}`, { method: 'POST' });
    carregarDadosIniciais();
}
