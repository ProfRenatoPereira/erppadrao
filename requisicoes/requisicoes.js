// erppadrao - requisicoes/requisicoes.js
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
        const texto = `Módulo de Requisições Internas aberto. Use o formulário à esquerda para solicitar insumos do Almoxarifado, ou atenda as ordens na fila à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Atualiza indicadores de caixa do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=requisicoes');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // 2. Busca e herda as Matérias-Primas reais do Almoxarifado (Fase 5 - Materiais)
    const resMateriais = await fetch('/api/materiais/listar');
    const materiais = await resMateriais.json();
    const select = document.getElementById('req_material_id');
    
    if (materiais.length === 0) {
        select.innerHTML = '<option value="">❌ Nenhum Insumo Estocado (Vá para o Almoxarifado)</option>';
    } else {
        select.innerHTML = '<option value="">-- Selecione a Matéria-Prima --</option>' + 
            materiais.map(m => `<option value="${m.id}">${m.nome_material} (Unidade: ${m.unidade_medida} | Saldo: ${m.quantidade_estoque})</option>`).join('');
    }

    carregarTabelaRequisicoes();
}

async function carregarTabelaRequisicoes() {
    const resReq = await fetch('/api/requisicoes/listar');
    const lista = await resReq.json();
    const tbody = document.getElementById('tabela_requisicoes');
    
    let total = lista.length;
    let pendentes = lista.filter(x => x.status_req === 'Pendente').length;
    let transferidos = lista.filter(x => x.status_req === 'Atendida').reduce((a, b) => a + (b.req_quantidade || 0), 0);
    
    // Indicador de eficiência logística
    const acuracidade = total > 0 ? ((total - pendentes) / total * 100) : 100;

    document.getElementById('top_req_total').innerText = `${total} Ordens`;
    document.getElementById('top_req_pendentes').innerText = `${pendentes} Pendentes`;
    document.getElementById('top_acuracidade_pct').innerText = `${acuracidade.toFixed(1)}%`;
    document.getElementById('top_insumos_transferidos').innerText = `${transferidos} itens`;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma requisição de insumos gerada internamente.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(r => {
        const corStatus = r.status_req === 'Atendida' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800 animate-pulse';
        const botaoAcao = r.status_req === 'Pendente' 
            ? `<button onclick="atenderRequisicaoAlmoxarifado(${r.id})" class="bg-green-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase hover:bg-green-700">Liberar</button>`
            : `<span class="text-green-600 font-extrabold text-[10px]">ENTREGUE</span>`;

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 font-sans"><strong>REQ-00${r.id}</strong><br><span class="text-blue-900 font-bold">${r.material_nome_suporte}</span></td>
            <td class="p-3 font-sans">${r.req_destino}<br><span class="text-gray-400 text-[10px]">Por: ${r.req_solicitante}</span></td>
            <td class="p-3 font-bold text-gray-900">${r.req_quantidade} un</td>
            <td class="p-3 font-sans"><span class="px-2 py-0.2 rounded-full text-[9px] font-bold ${corStatus}">${r.status_req}</span></td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">${botaoAcao}</td>
        </tr>`;
    }).join('');
}

async function lancarRequisicaoMaterial(e) {
    e.preventDefault();
    const select = document.getElementById('req_material_id');
    if (!select.value) return;

    const dados = {
        material_id: parseInt(select.value),
        material_nome_suporte: select.options[select.selectedIndex].text.split(' ('),
        req_quantidade: parseFloat(document.getElementById('req_quantidade').value) || 1,
        req_destino: document.getElementById('req_destino').value,
        req_solicitante: document.getElementById('req_solicitante').value.trim()
    };

    await fetch('/api/requisicoes/lancar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formRequisicao').reset();
    carregarDadosIniciais();
}

async function atenderRequisicaoAlmoxarifado(id) {
    if (!confirm('Confirmar a liberação física e baixa automática deste insumo do estoque do almoxarifado?')) return;
    const res = await fetch(`/api/requisicoes/atender/${id}`, { method: 'POST' });
    const r = await res.json();
    if(r.status === 'erro') {
        alert(`❌ Erro de Estoque: ${r.message}`);
    } else {
        carregarDadosIniciais();
    }
}
