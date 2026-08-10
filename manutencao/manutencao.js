// erppadrao - manutencao/manutencao.js
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
        const texto = `Módulo de Engenharia de Manutenção aberto. Use o painel à esquerda para abrir chamados técnicos e ordens de serviço, ou liquide o backlog à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Atualiza indicadores de caixa globais do topo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=manutencao');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // 2. Busca e herda as Máquinas da Engenharia (Fase 4) para popular o seletor
    const resMaquinas = await fetch('/api/maquinas/listar');
    const maquinas = await resMaquinas.json();
    const select = document.getElementById('mnt_maquina_id');
    
    if (maquinas.length === 0) {
        select.innerHTML = '<option value="">❌ Nenhuma Máquina Cadastrada (Vá para a Fase 4)</option>';
    } else {
        select.innerHTML = '<option value="">-- Selecione o Ativo Industrial --</option>' + 
            maquinas.map(m => `<option value="${m.id}">${m.nome_equipamento} (Frequência Mnt: ${m.frequencia_manutencao}h)</option>`).join('');
    }

    carregarTabelaOrdensServico();
}

async function carregarTabelaOrdensServico() {
    const resOS = await fetch('/api/manutencao/listar');
    const chamados = await resOS.json();
    const tbody = document.getElementById('tabela_manutencao');
    
    let totalOS = chamados.length;
    let abertas = chamados.filter(x => x.status_os === 'Aberta').length;
    let custoTotal = 0;
    let tempoParadaTotal = 0;

    chamados.forEach(c => {
        if(c.status_os === 'Finalizada') {
            custoTotal += (c.mnt_custo_pecas || 0);
            tempoParadaTotal += (c.mnt_tempo_parada || 0);
        }
    });

    // Indicador Didático de Confiabilidade RAM/OEE
    // Simulação de perda de disponibilidade: 160h totais por turno no mês - horas paradas
    const disponibilidadeMedia = totalOS > 0 ? Math.max(70, 100 - (tempoParadaTotal / 1.6)) : 100;

    document.getElementById('top_mnt_total').innerText = `${totalOS} Ordens`;
    document.getElementById('top_mnt_abertas').innerText = `${abertas} Pendentes`;
    document.getElementById('top_dispo_media').innerText = `${disponibilidadeMedia.toFixed(1)}%`;
    document.getElementById('top_custo_manutencao').innerText = `R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (chamados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma intervenção registrada no livro de manutenção.</td></tr>`;
        return;
    }

    tbody.innerHTML = chamados.map(c => {
        const corStatus = c.status_os === 'Finalizada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 animate-pulse';
        const botaoAcao = c.status_os === 'Aberta' 
            ? `<button onclick="finalizarOrdemServico(${c.id})" class="bg-green-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase hover:bg-green-700">Liquidar</button>`
            : `<span class="text-green-600 font-extrabold text-[10px]">CONCLUÍDO</span>`;

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 font-sans"><strong>OS-MNT-00${c.id}</strong><br><span class="text-blue-900 font-bold">${c.maquina_nome_suporte}</span></td>
            <td class="p-3 font-sans">${c.mnt_descricao}<br><span class="text-gray-400 text-[10px]">Data: ${c.mnt_data}</span></td>
            <td class="p-3 font-sans font-semibold">${c.mnt_tipo}</td>
            <td class="p-3">Parada: ${c.mnt_tempo_parada}h<br><span class="text-red-600 font-bold">Peças: R$ ${c.mnt_custo_pecas.toFixed(2)}</span><br><span class="px-2 py-0.2 rounded-full text-[9px] font-bold ${corStatus} mt-0.5 inline-block">${c.status_os}</span></td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">${botaoAcao}</td>
        </tr>`;
    }).join('');
}

async function lancarOrdemServico(e) {
    e.preventDefault();
    const select = document.getElementById('mnt_maquina_id');
    if (!select.value) return;

    const dados = {
        maquina_id: parseInt(select.value),
        maquina_nome_suporte: select.options[select.selectedIndex].text.split(' ('),
        mnt_descricao: document.getElementById('mnt_descricao').value.trim(),
        mnt_tipo: document.getElementById('mnt_tipo').value,
        mnt_custo_pecas: parseFloat(document.getElementById('mnt_custo_pecas').value) || 0,
        mnt_tempo_parada: parseFloat(document.getElementById('mnt_tempo_parada').value) || 0,
        mnt_data: document.getElementById('mnt_data').value
    };

    await fetch('/api/manutencao/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formManutencao').reset();
    carregarDadosIniciais();
}

async function finalizarOrdemServico(id) {
    if (!confirm('Deseja encerrar este chamado técnico? O custo das peças/insumos será debitado do caixa geral.')) return;
    await fetch(`/api/manutencao/finalizar/${id}`, { method: 'POST' });
    carregarDadosIniciais();
}
