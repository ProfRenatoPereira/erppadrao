// estrutura/estrutura.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTÍNUO AUTOMATIZADO (SEM USO DO MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Página de investimentos imobiliários aberta. Analise o formulário de alocação de espaço físico à esquerda e a tabela de simulações ativas no banco de dados à direita para calcular sua estrutura de custos fixos.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // Busca informações de capital e preenche as métricas do topo do painel
    const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('top_custo_variavel').innerText = `R$ ${metricas.custo_valiavel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    // Mostra o nome customizado da empresa do grupo
    document.getElementById('nome_grupo_display').value = metricas.nome_empresa || "EQUIPE LOGADA";

    // Puxa e alimenta a tabela lateral direita via AJAX
    const resImoveis = await fetch('/api/estrutura/imoveis');
    const imoveis = await resImoveis.json();
    const tbody = document.getElementById('tabela_imoveis');
    
    if(imoveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum espaço alocado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = imoveis.map(i => `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-3 font-black text-gray-900">${i.nome_grupo}</td>
            <td class="p-3"><strong>${i.tipo_imovel}</strong><br><span class="text-[11px] text-gray-400">${i.regiao}</span></td>
            <td class="p-3 font-mono">${i.area_util} m²</td>
            <td class="p-3 text-blue-900 font-extrabold">R$ ${(i.valor_aluguel || 0).toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarImovel(${i.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarImovel(${i.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Rescindir</button>
            </td>
        </tr>
    `).join('');
}
async function salvarImovel(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('regiao').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: document.getElementById('obs_contrato').value
    };

    await fetch('/api/estrutura/imoveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioImobiliario();
    carregarDadosIniciais();
}

async function editarImovel(id) {
    const res = await fetch(`/api/estrutura/imoveis/${id}`);
    const i = await res.json();
    
    document.getElementById('imovel_id').value = i.id;
    document.getElementById('tipo_imovel').value = i.tipo_imovel;
    document.getElementById('regiao').value = i.regiao;
    document.getElementById('area_util').value = i.area_util;
    document.getElementById('valor_aluguel').value = i.valor_aluguel;
    document.getElementById('valor_condominio').value = i.valor_condominio;
    document.getElementById('obs_contrato').value = i.obs_contrato || '';
    
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarImovel(id) {
    if(!confirm('Confirmar a rescisão legal do contrato imobiliário? A verba aluguel sairá do custo fixo.')) return;
    await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioImobiliario() {
    document.getElementById('formImobiliario').reset();
    document.getElementById('imovel_id').value = '';
    document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato";
    document.getElementById('btn_cancelar').classList.add('hidden');
}
