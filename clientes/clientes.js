// erppadrao - clientes/clientes.js
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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO (NÃO REQUER PASSAR O MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Gestão de Clientes aberto. Utilize o formulário de Perfil do Cliente à esquerda para homologar novos compradores e definir limites de crédito, ou analise a carteira de clientes cadastrados na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    // 1. Atualiza o painel superior de indicadores globais
    const resMetricas = await fetch('/api/financeiro/metricas?dept=clientes');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    // 2. Busca os clientes cadastrados no Supabase para preencher a listagem
    const resClientes = await fetch('/api/clientes/listar');
    const clientes = await resClientes.json();
    const tbody = document.getElementById('tabela_clientes');
    
    // Atualiza o contador de prospecção e soma o limite de crédito total outorgado
    document.getElementById('top_clientes_qtd').innerText = `${clientes.length} Clientes`;
    
    let totalCreditoConcedido = 0;
    clientes.forEach(c => { totalCreditoConcedido += (c.limite_credito || 0); });
    document.getElementById('top_credito_total').innerText = `R$ ${totalCreditoConcedido.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if(clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum cliente ativo cadastrado no Supabase para este grupo.</td></tr>`;
        return;
    }
    // Continuação de clientes/clientes.js
    tbody.innerHTML = clientes.map(c => {
        // Aloca badges visuais com base no perfil de risco de crédito do cliente
        const corRisco = c.limite_credito > 50000 ? 'bg-red-100 text-red-800' : c.limite_credito > 10000 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';
        const labelRisco = c.limite_credito > 50000 ? 'Alto Risco' : c.limite_credito > 10000 ? 'Médio Risco' : 'Baixo Risco';

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${m.nome_cliente}</strong><br><span class="text-gray-400 text-[10px] font-semibold">${c.tipo_pessoa}</span></td>
            <td class="p-3">Região: ${c.regiao_cliente}<br><span class="text-gray-400">${c.contato_cliente || '-'}</span></td>
            <td class="p-3 font-semibold text-blue-900">${c.frequencia_demanda}</td>
            <td class="p-3">
                <span class="font-bold text-gray-900 font-mono">R$ ${c.limite_credito.toFixed(2)}</span><br>
                <span class="px-2 py-0.5 rounded-full font-bold text-[9px] ${corRisco}">${labelRisco}</span>
            </td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarCliente(${c.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarCliente(${c.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

async function salvarCliente(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_cliente: document.getElementById('nome_cliente').value.trim(),
        tipo_pessoa: document.getElementById('tipo_pessoa').value,
        regiao_cliente: document.getElementById('regiao_cliente').value,
        limite_credito: parseFloat(document.getElementById('limite_credito').value) || 0,
        frequencia_demanda: document.getElementById('frequencia_demanda').value,
        contato_cliente: document.getElementById('contato_cliente').value.trim()
    };

    await fetch('/api/clientes/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioClientes();
    carregarDadosIniciais();
}

async function editarCliente(id) {
    const res = await fetch(`/api/clientes/buscar/${id}`);
    const c = await res.json();
    
    document.getElementById('registro_id').value = c.id;
    document.getElementById('nome_cliente').value = c.nome_cliente;
    document.getElementById('tipo_pessoa').value = c.tipo_pessoa;
    document.getElementById('regiao_cliente').value = c.regiao_cliente;
    document.getElementById('limite_credito').value = c.limite_credito;
    document.getElementById('frequencia_demanda').value = c.frequencia_demanda;
    document.getElementById('contato_cliente').value = c.contato_cliente || '';
    
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Cliente";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarCliente(id) {
    if(!confirm('Deseja remover este cliente permanentemente da carteira comercial?')) return;
    await fetch(`/api/clientes/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioClientes() {
    document.getElementById('formCliente').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "👥 Homologar Cliente";
    document.getElementById('btn_cancelar').classList.add('hidden');
}
