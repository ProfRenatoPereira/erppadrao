/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 1 DE 3 - ACESSIBILIDADE E CONTROLES VISUAIS
   ========================================================================== */

let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheMaquinasEquipe = [];

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() { 
    document.body.classList.toggle('dark-mode'); 
}

function alternarAltoContraste() { 
    document.body.classList.toggle('alto-contraste'); 
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (btn) btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
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
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 2 DE 3 - CONSUMO DE METRICAS E ALINHAMENTO DE IDS
   ========================================================================== */

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=processos');
        const metricas = await resMetricas.json();
        
        // CORREÇÃO: Alinhamento cirúrgico com os IDs terminados em '_val' injetados no HTML
        const cap = document.getElementById('top_capital_total_val');
        if (cap) cap.innerText = `R$ ${(metricas.capital_total || 5000000).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        const disp = document.getElementById('top_disponivel_setor_val');
        if (disp) disp.innerText = `R$ ${(metricas.capital_disponivel_total || 2000000).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        const cFixo = document.getElementById('top_custo_fixo_val');
        if (cFixo) cFixo.innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
        const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(1);
        
        const vReais = document.getElementById('top_verba_reais_val');
        if (vReais) vReais.innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        const pBudget = document.getElementById('txt_porcentagem_budget');
        if (pBudget) pBudget.innerText = `${pctDoCapital}% do Capital`;

        // 2. Carga dinâmica de ativos operacionais do Supabase
        const resMaquinas = await fetch('/api/maquinas/listar');
        cacheMaquinasEquipe = await resMaquinas.json();
        
        const selectMaquinas = document.getElementById('maquina_vinculada');
        if (selectMaquinas) {
            if (cacheMaquinasEquipe.length === 0) {
                selectMaquinas.innerHTML = '<option value="">❌ Nenhuma Máquina no Supabase (Vá para Fase 4)</option>';
            } else {
                selectMaquinas.innerHTML = '<option value="">-- Selecione o Posto de Trabalho --</option>' + 
                    cacheMaquinasEquipe.map(m => `<option value="${m.id}">${m.nome_equipamento} (R$ ${parseFloat(m.custo_minuto_maquina).toFixed(4)}/min)</option>`).join('');
            }
        }

        carregarTabelaRoteiros();
    } catch (err) {
        console.error("Erro na carga inicial do painel de processos:", err);
    }
}

function buscarCustoMinutoMaquina() {
    const idMaqSelected = document.getElementById('maquina_vinculada').value;
    const maq = cacheMaquinasEquipe.find(x => x.id == idMaqSelected);
    const campoRef = document.getElementById('custo_ref_maquina');
    if (campoRef) campoRef.value = maq ? parseFloat(maq.custo_minuto_maquina).toFixed(4) : "0.0000";
    calcularCustoOperacao();
}

function calcularCustoOperacao() {
    const tempoSetup = parseFloat(document.getElementById('tempo_setup').value) || 0;
    const tempoOperacao = parseFloat(document.getElementById('tempo_operacao').value) || 0;
    const custoMinutoMaquina = parseFloat(document.getElementById('custo_ref_maquina').value) || 0;
    const custoTotalUnitario = (tempoSetup + tempoOperacao) * custoMinutoMaquina;
    
    const campoCusto = document.getElementById('custo_total_operacao');
    if (campoCusto) campoCusto.value = `R$ ${custoTotalUnitario.toFixed(2)}`;
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 3 DE 3 - RENDERIZAÇÃO DA PLANILHA E OPERAÇÕES CRUD
   ========================================================================== */

async function carregarTabelaRoteiros() {
    try {
        const resProcessos = await fetch('/api/processos/listar');
        const processos = await resProcessos.json();
        const tbody = document.getElementById('tabela_processos');
        if (!tbody) return;
        
        if (processos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum roteiro ou cronoanálise cadastrada no Supabase para este grupo.</td></tr>`;
            return;
        }

        tbody.innerHTML = processos.map(p => `
            <tr class="hover:bg-gray-50 border-b text-[11px]">
                <td class="p-3"><strong>Op. # ${p.sequencia_op}</strong><br><span class="text-blue-900 font-bold">${p.nome_operacao}</span></td>
                <td class="p-3 font-semibold text-gray-700">${p.maquina_nome_suporte || 'Posto de Trabalho'}</td>
                <td class="p-3 font-mono">Setup: ${p.tempo_setup} min<br>Operação: ${p.tempo_operacao} min/pç</td>
                <td class="p-3 font-mono font-bold text-emerald-600">R$ ${parseFloat(p.custo_total_operacao || 0).toFixed(2)}</td>
                <td class="p-3 text-center whitespace-nowrap actions-legal">
                    <button type="button" onclick="editarProcesso(${p.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                    <button type="button" onclick="deletarProcesso(${p.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Erro ao renderizar roteiros:", err);
    }
}

async function salvarProcesso(e) {
    if (e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('maquina_vinculada');
    if (!select) return;
    
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
    document.getElementById('custo_total_operacao').value = `R$ ${parseFloat(p.custo_total_operacao).toFixed(2)}`;
    
    const btnS = document.getElementById('btn_salvar');
    if (btnS) btnS.innerText = "🔄 Atualizar Roteiro";
    const btnC = document.getElementById('btn_cancelar');
    if (btnC) btnC.classList.remove('hidden');
}

async function deletarProcesso(id) {
    if (!confirm('Deseja remover esta operação do roteiro de engenharia?')) return;
    await fetch(`/api/processos/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioProcessos() {
    const form = document.getElementById('formProcesso');
    if (form) form.reset();
    const regId = document.getElementById('registro_id');
    if (regId) regId.value = '';
    const btnS = document.getElementById('btn_salvar');
    if (btnS) btnS.innerText = "⚙️ Homologar Operação";
    const btnC = document.getElementById('btn_cancelar');
    if (btnC) btnC.classList.add('hidden');
    const cTotal = document.getElementById('custo_total_operacao');
    if (cTotal) cTotal.value = '';
    const cRef = document.getElementById('custo_ref_maquina');
    if (cRef) cRef.value = '';
}
