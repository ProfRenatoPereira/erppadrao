// erppadrao - folha_pagamento/folha.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheFuncionariosAdmitidos = [];

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
        const texto = `Módulo de Folha de Pagamento aberto. Realize a apuração de ponto e emissão de holerites à esquerda ou confira o relatório analítico à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // Indicadores do topo do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=folha');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // Herda colaboradores admitidos no Módulo de RH (Fase 3)
    const resFuncs = await fetch('/api/rh/listar');
    cacheFuncionariosAdmitidos = await resFuncs.json();
    const select = document.getElementById('folha_funcionario_id');
    
    document.getElementById('top_funcionarios_qtd').innerText = `${cacheFuncionariosAdmitidos.length} Colaboradores`;

    if (cacheFuncionariosAdmitidos.length === 0) {
        select.innerHTML = '<option value="">❌ Nenhum Funcionário Admitido (Vá para o RH)</option>';
    } else {
        select.innerHTML = '<option value="">-- Selecione o Funcionário --</option>' + 
            cacheFuncionariosAdmitidos.map(f => `<option value="${f.id}">${f.nome_colaborador} (${f.cargo_funcao})</option>`).join('');
    }

    carregarTabelaHolerites();
}

function buscarSalarioBaseContratual() {
    const idSelected = document.getElementById('folha_funcionario_id').value;
    const func = cacheFuncionariosAdmitidos.find(x => x.id == idSelected);
    
    document.getElementById('folha_salario_base').value = func ? func.salario_base.toFixed(2) : "0.00";
    calcularValoresHoleriteInLoco();
}

function calcularValoresHoleriteInLoco() {
    const salarioBase = parseFloat(document.getElementById('folha_salario_base').value) || 0;
    const horasExtras = parseInt(document.getElementById('folha_horas_extras').value) || 0;
    const aliqInss = parseFloat(document.getElementById('folha_aliq_inss').value) || 11;
    const opcaoVT = document.getElementById('folha_desconto_vt').value;

    const valorHoraRegular = salarioBase / 220;
    const totalProventosHE = horasExtras * valorHoraRegular * 1.5;
    
    const descontoINSS = (salarioBase + totalProventosHE) * (aliqInss / 100);
    const descontoVT = opcaoVT === 'Sim' ? salarioBase * 0.06 : 0;

    const liquidoEst = (salarioBase + totalProventosHE) - (descontoINSS + descontoVT);
    document.getElementById('folha_liquido_display').value = `R$ ${liquidoEst.toFixed(2)}`;
}

async function carregarTabelaHolerites() {
    const res = await fetch('/api/folha/listar');
    const holerites = await res.json();
    const tbody = document.getElementById('tabela_folha');

    let acumuladoLiquido = 0;
    let acumuladoPatronal = 0;

    holerites.forEach(h => {
        acumuladoLiquido += h.valor_liquido;
        acumuladoPatronal += h.encargos_patronais;
    });

    document.getElementById('top_folha_liquida').innerText = `R$ ${acumuladoLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_encargos_patronais').innerText = `R$ ${acumuladoPatronal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if (holerites.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum holerite processado no Supabase para este período.</td></tr>`;
        return;
    }

    tbody.innerHTML = holerites.map(h => `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 font-sans"><strong>${h.funcionario_nome_suporte}</strong></td>
            <td>Bruto: R$ ${h.salario_base.toFixed(2)}<br><span class="text-blue-700 text-[10px]">H.E.: R$ ${h.valor_horas_extras.toFixed(2)}</span></td>
            <td>INSS: R$ ${h.desconto_inss.toFixed(2)}<br><span class="text-red-700 text-[10px]">V.T.: R$ ${h.desconto_vt.toFixed(2)}</span></td>
            <td class="text-green-700 font-bold font-sans">R$ ${h.valor_liquido.toFixed(2)}<br><span class="text-[9px] text-gray-400 font-normal">Encargos: R$ ${h.encargos_patronais.toFixed(2)}</span></td>
            <td class="p-3 text-center actions-legal">
                <button onclick="removerHolerite(${h.id})" class="bg-red-50 text-red-700 border px-2 py-0.5 rounded text-[10px] font-bold uppercase">Estornar</button>
            </td>
        </tr>`).join('');
}

async function processarHoleriteFuncionario(e) {
    e.preventDefault();
    const select = document.getElementById('folha_funcionario_id');
    if (!select.value) return;

    const salarioBase = parseFloat(document.getElementById('folha_salario_base').value) || 0;
    const horasExtras = parseInt(document.getElementById('folha_horas_extras').value) || 0;
    const aliqInss = parseFloat(document.getElementById('folha_aliq_inss').value) || 11;
    const opcaoVT = document.getElementById('folha_desconto_vt').value;

    const valorHoraRegular = salarioBase / 220;
    const totalProventosHE = horasExtras * valorHoraRegular * 1.5;
    const descontoINSS = (salarioBase + totalProventosHE) * (aliqInss / 100);
    const descontoVT = opcaoVT === 'Sim' ? salarioBase * 0.06 : 0;
    const liquido = (salarioBase + totalProventosHE) - (descontoINSS + descontoVT);
    
    // Cálculo CLT da cota Patronal: 20% INSS Empresa + 8% Fundo de Garantia (FGTS) = 28% de encargo sobre a remuneração base
    const encargosPatronais = (salarioBase + totalProventosHE) * 0.28;

    const dados = {
        funcionario_id: parseInt(select.value),
        funcionario_nome_suporte: select.options[select.selectedIndex].text,
        salario_base: salarioBase,
        horas_extras: horasExtras,
        valor_horas_extras: totalProventosHE,
        desconto_inss: descontoINSS,
        desconto_vt: descontoVT,
        valor_liquido: liquido,
        encargos_patronais: encargosPatronais
    };

    await fetch('/api/folha/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formFolha').reset();
    carregarDadosIniciais();
}

async function removerHolerite(id) {
    if (!confirm('Deseja realizar o estorno contábil do holerite deste funcionário?')) return;
    await fetch(`/api/folha/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}
