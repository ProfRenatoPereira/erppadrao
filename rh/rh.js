// erppadrao - rh/rh.js
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
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Ativar";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Recursos Humanos aberto. Cadastre funcionários e calcule provisões de folha trabalhista à esquerda, ou gerencie a folha à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

function calcularInLocoEncargos() {
    const salarioBase = parseFloat(document.getElementById('salario_base').value) || 0;
    const encargos = salarioBase * 0.28; // Provisão Didática: INSS Patronal (20%) + FGTS (8%)
    document.getElementById('encargos_patronais_display').value = `R$ ${encargos.toFixed(2)}`;
}
async function carregarDadosIniciais() {
    const resMetricas = await fetch('/api/financeiro/metricas?dept=rh');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    const resFuncionarios = await fetch('/api/rh/listar');
    const funcionarios = await resFuncionarios.json();
    const tbody = document.getElementById('tabela_rh');
    
    let totalFolhaBruta = 0;
    let totalEncargosHE = 0;
    
    funcionarios.forEach(f => {
        totalFolhaBruta += (f.salario_base || 0);
        totalEncargosHE += ((f.salario_base || 0) * 0.28) + ((f.horas_extras || 0) * ((f.salario_base || 1)/220) * 1.5);
    });
    
    document.getElementById('top_custo_fixo').innerText = `R$ ${totalFolhaBruta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('top_custo_variavel').innerText = `R$ ${totalEncargosHE.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if(funcionarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum colaborador registrado no quadro.</td></tr>`;
        return;
    }

    tbody.innerHTML = funcionarios.map(f => {
        const valorHora = f.salario_base / 220;
        const valorHE = f.horas_extras * valorHora * 1.5;
        const inss = f.salario_base * 0.11; 
        const descVT = f.desconto_vt === 'Sim' ? f.salario_base * 0.06 : 0;
        const liquido = f.salario_base + valorHE - inss - descVT;
        const custoEmpresa = f.salario_base + valorHE + (f.salario_base * 0.28);

        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${f.nome_colaborador}</strong><br><span class="text-gray-400">${f.cargo_funcao}</span></td>
            <td class="p-3 font-mono font-bold text-green-700">R$ ${liquido.toFixed(2)}</td>
            <td class="p-3 text-gray-500 font-mono">INSS: R$ ${inss.toFixed(2)}<br>VT: R$ ${descVT.toFixed(2)}</td>
            <td class="p-3 font-mono font-bold text-red-700">R$ ${custoEmpresa.toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarFuncionario(${f.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarFuncionario(${f.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Demitir</button>
            </td>
        </tr>`;
    }).join('');
}

async function salvarFuncionario(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_colaborador: document.getElementById('nome_colaborador').value.trim(),
        cargo_funcao: document.getElementById('cargo_funcao').value.trim(),
        salario_base: parseFloat(document.getElementById('salario_base').value) || 0,
        horas_extras: parseInt(document.getElementById('horas_extras').value) || 0,
        desconto_vt: document.getElementById('desconto_vt').value
    };

    await fetch('/api/rh/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioRH();
    carregarDadosIniciais();
}

async function editarFuncionario(id) {
    const res = await fetch(`/api/rh/buscar/${id}`);
    const f = await res.json();
    document.getElementById('registro_id').value = f.id;
    document.getElementById('nome_colaborador').value = f.nome_colaborador;
    document.getElementById('cargo_funcao').value = f.cargo_funcao;
    document.getElementById('salario_base').value = f.salario_base;
    document.getElementById('horas_extras').value = f.horas_extras;
    document.getElementById('desconto_vt').value = f.desconto_vt;
    calcularInLocoEncargos();
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Registro";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarFuncionario(id) {
    if(!confirm('Deseja processar a rescisão legal e demissão deste colaborador?')) return;
    await fetch(`/api/rh/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioRH() {
    document.getElementById('formRH').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "👥 Admitir Colaborador";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('encargos_patronais_display').value = '';
}
