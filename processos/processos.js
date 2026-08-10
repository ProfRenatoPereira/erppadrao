// erppadrao - processos/processos.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheMaquinasEquipe = []; // Guarda as máquinas cadastradas para cruzar custos

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO PARA PROJETORES (SEM MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Engenharia de Processos aberto. Utilize o formulário de Mapeamento à esquerda para associar operações aos tempos de setup e operação de suas máquinas, ou confira os roteiros de fabricação na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza as barras de indicadores econômicos corporativos superiores
    const resMetricas = await fetch('/api/financeiro/metricas?dept=processos');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    // Configura a verba setorial do PCP
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // 2. Busca as máquinas reais cadastradas pela equipe na Fase 4 para popular o seletor
    const resMaquinas = await fetch('/api/maquinas/listar');
    cacheMaquinasEquipe = await resMaquinas.json();
    
    const selectMaquinas = document.getElementById('maquina_vinculada');
    if (cacheMaquinasEquipe.length === 0) {
        selectMaquinas.innerHTML = '<option value="">❌ Nenhuma Máquina no Supabase (Vá para Fase 4)</option>';
    } else {
        selectMaquinas.innerHTML = '<option value="">-- Selecione o Posto de Trabalho --</option>' + 
            cacheMaquinasEquipe.map(m => `<option value="${m.id}">${m.nome_equipamento} (R$ ${m.custo_minuto_maquina.toFixed(4)}/min)</option>`).join('');
    }

    // 3. Atualiza a listagem analítica de processos à direita
    carregarTabelaRoteiros();
}

function buscarCustoMinutoMaquina() {
    const idMaqSelected = document.getElementById('maquina_vinculada').value;
    const maq = cacheMaquinasEquipe.find(x => x.id == idMaqSelected);
    
    // Injeta o custo-minuto real calculado na Fase 4 diretamente no campo oculto de referência
    document.getElementById('custo_ref_maquina').value = maq ? maq.custo_minuto_maquina.toFixed(4) : "0.0000";
    
    calcularCustoOperacao();
}

function calcularCustoOperacao() {
    const tempoSetup = parseFloat(document.getElementById('tempo_setup').value) || 0;
    const tempoOperacao = parseFloat(document.getElementById('tempo_operacao').value) || 0;
    const custoMinutoMaquina = parseFloat(document.getElementById('custo_ref_maquina').value) || 0;
    
    // Abordagem Didática de Custo Industrial (Cronoanálise): 
    // O setup é diluído considerando lotes didáticos de 1 unidade para evidenciar o impacto do tempo de preparação
    const custoTotalUnitario = (tempoSetup + tempoOperacao) * custoMinutoMaquina;
    
    document.getElementById('custo_total_operacao').value = `R$ ${custoTotalUnitario.toFixed(2)}`;
}
async function carregarTabelaRoteiros() {
    const resProcessos = await fetch('/api/processos/listar');
    const processos = await resProcessos.json();
    const tbody = document.getElementById('tabela_processos');
    
    // Soma os custos de processamento para alimentar a quarta métrica de custo variável do topo
    let somaCustosProcessos = 0;
    processos.forEach(p => { somaCustosProcessos += (p.custo_total_operacao || 0); });
    document.getElementById('top_custo_variavel').innerText = `R$ ${somaCustosProcessos.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (processos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum roteiro ou cronoanálise cadastrada no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = processos.map(p => `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>Op. # ${p.sequencia_op}</strong><br><span class="text-blue-900 font-bold">${p.nome_operacao}</span></td>
            <td class="p-3 font-semibold text-gray-700">${p.maquina_nome_suporte || 'Posto de Trabalho'}</td>
            <td class="p-3 font-mono">Setup: ${p.tempo_setup} min<br>Operação: ${p.tempo_operacao} min/pç</td>
            <td class="p-3 font-mono font-bold text-emerald-600">R$ ${(p.custo_total_operacao || 0).toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarProcesso(${p.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarProcesso(${p.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function salvarProcesso(e) {
    e.preventDefault();
    const select = document.getElementById('maquina_vinculada');
    
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_operacao: document.getElementById('nome_operacao').value,
        maquina_id: parseInt(select.value) || null,
        maquina_nome_suporte: select.options[select.selectedIndex]?.text.split(' (')[0] || '',
        tempo_setup: parseFloat(document.getElementById('tempo_setup').value) || 0,
        tempo_operacao: parseFloat(document.getElementById('tempo_operacao').value) || 0,
        custo_ref_maquina: parseFloat(document.getElementById('custo_ref_maquina').value) || 0,
        sequencia_op: parseInt(document.getElementById('sequencia_op').value) || 10,
        custo_total_operacao: parseFloat(document.getElementById('custo_total_operacao').value.replace('R$ ', '')) || 0
    };

    await fetch('/api/processos/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioProcessos();
    carregarDadosIniciais();
}

async function editarProcesso(id) {
    const res = await fetch(`/api/processos/buscar/${id}`);
    const p = await res.json();
    
    document.getElementById('registro_id').value = p.id;
    document.getElementById('nome_operacao').value = p.nome_operacao;
    document.getElementById('maquina_vinculada').value = p.maquina_id;
    document.getElementById('tempo_setup').value = p.tempo_setup;
    document.getElementById('tempo_operacao').value = p.tempo_operacao;
    document.getElementById('custo_ref_maquina').value = p.custo_ref_maquina;
    document.getElementById('sequencia_op').value = p.sequencia_op;
    document.getElementById('custo_total_operacao').value = `R$ ${p.custo_total_operacao.toFixed(2)}`;
    
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Roteiro";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarProcesso(id) {
    if (!confirm('Deseja remover esta operação do roteiro de engenharia?')) return;
    await fetch(`/api/processos/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioProcessos() {
    document.getElementById('formProcesso').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "⚙️ Homologar Operação";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('custo_total_operacao').value = '';
    document.getElementById('custo_ref_maquina').value = '';
}
