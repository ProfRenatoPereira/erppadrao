// erppadrao - maquinas/maquinas.js
// Catálogo Coringa de Equipamentos Pré-Definidos com Utilidades (Água e Gases)
const catalogos = {
    "cnc_mazak": { 
        nome: "Torno CNC Mazak Quick Turn", pot: 25, cons: 18, vel: "6000 RPM", avan: "36000 mm/min", 
        comp: 500, diam: 350, mnt: 1000, preco: 450000, dep: 3750, venda: 90000, 
        operador: "Carlos Souza", custo_op: 0.25, agua: 0.050, gases: 0.120 
    },
    "fresadora": { 
        nome: "Fresadora Universal", pot: 15, cons: 11, vel: "3000 RPM", avan: "12000 mm/min", 
        comp: 800, diam: 400, mnt: 750, preco: 180000, dep: 1500, venda: 36000, 
        operador: "Marcos Lima", custo_op: 0.20, agua: 0.010, gases: 0.000
    }
};

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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO PARA SALA DE AULA (SEM MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de Engenharia de Ativos aberto. Use o formulário de Configuração à esquerda para simular a cubagem de energia, água e gases, ou analise os ativos industriais cadastrados na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

function carregarPreDefinido() {
    const modelo = document.getElementById('seletor_modelo').value;
    if (catalogos[modelo]) {
        const item = catalogos[modelo];
        document.getElementById('nome_equipamento').value = item.nome;
        document.getElementById('potencia').value = item.pot;
        document.getElementById('consumo_eletrico').value = item.cons;
        document.getElementById('velocidade').value = item.vel;
        document.getElementById('avanco').value = item.avan;
        document.getElementById('comprimento_max').value = item.comp;
        document.getElementById('diametro_max').value = item.diam;
        document.getElementById('frequencia_manutencao').value = item.mnt;
        document.getElementById('preco_compra').value = item.preco;
        document.getElementById('depreciacao_mensal').value = item.dep;
        document.getElementById('valor_venda_final').value = item.venda;
        document.getElementById('operador_nome').value = item.operador;
        document.getElementById('custo_minuto_operador').value = item.custo_op;
        
        // Injeção metrológica de fluidos e pneumática
        document.getElementById('consumo_agua').value = item.agua.toFixed(3);
        document.getElementById('consumo_gases').value = item.gases.toFixed(3);
        
        calcularMinutoMaquina();
    }
}

function calcularMinutoMaquina() {
    const depreciacao = parseFloat(document.getElementById('depreciacao_mensal').value) || 0;
    const consumoKwh = parseFloat(document.getElementById('consumo_eletrico').value) || 0;
    const consumoAguaHora = parseFloat(document.getElementById('consumo_agua').value) || 0;
    const consumoGasesHora = parseFloat(document.getElementById('consumo_gases').value) || 0;
    
    const custoEstruturalMinuto = parseFloat(document.getElementById('custo_estrutural_oculto').value) || 0;
    const custoOperadorMinuto = parseFloat(document.getElementById('custo_minuto_operador').value) || 0;
    
    const horasSemanais = parseFloat(document.getElementById('jornada_semanal').value) || 44;
    const turnos = parseFloat(document.getElementById('turnos_trabalho').value) || 1;
    
    // Parâmetros Macroeconômicos Didáticos de Concessionárias Públicas
    const custoKwhEnergia = 0.75; 
    const custoMetroCubicoAgua = 6.50;  
    const custoMetroCubicoGas = 4.80;   
    
    const minutosNoMes = horasSemanais * 4.33 * 60 * turnos;
    
    // Diluição exata por minuto operacional
    const depreciacaoPorMinuto = depreciacao / minutosNoMes;
    const energiaPorMinuto = (consumoKwh * custoKwhEnergia) / 60;
    const aguaPorMinuto = (consumoAguaHora * custoMetroCubicoAgua) / 60;
    const gasesPorMinuto = (consumoGasesHora * custoMetroCubicoGas) / 60;
    
    // Soma de Custos Indiretos (CIF/Utilidades) + Mão de Obra Direta (MOD)
    const c_mm = custoEstruturalMinuto + depreciacaoPorMinuto + energiaPorMinuto + aguaPorMinuto + gasesPorMinuto + custoOperadorMinuto;
    
    document.getElementById('custo_minuto_maquina').value = c_mm.toFixed(4);
}
async function carregarDadosIniciais() {
    // Atualiza o painel duplo financeiro superior do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=maquinas');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('top_custo_variavel').innerText = `R$ ${metricas.custo_valiavel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    // Atualiza os dados de verba específica da engenharia e a porcentagem exigida
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // Carrega a listagem lateral direita do Supabase
    const resAtivos = await fetch('/api/maquinas/listar');
    const ativos = await resAtivos.json();
    const tbody = document.getElementById('tabela_maquinas');
    
    if(ativos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum ativo mecânico imobilizado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = ativos.map(m => `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${m.nome_equipamento}</strong><br><span class="text-gray-400 font-mono">Modelo Base</span></td>
            <td class="p-3">Elet.: ${m.consumo_eletrico}kW | Água: ${m.consumo_agua || 0}m³<br>Gás: ${m.consumo_gases || 0}m³/h</td>
            <td class="p-3"><strong>${m.operador_nome}</strong><br><span class="text-gray-400">MOD Alocada</span></td>
            <td class="p-3 font-mono font-bold text-blue-900">R$ ${(m.custo_minuto_maquina || 0).toFixed(4)}/min</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarMaquina(${m.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarMaquina(${m.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Descartar</button>
            </td>
        </tr>
    `).join('');
}

async function salvarMaquina(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_equipamento: document.getElementById('nome_equipamento').value,
        potencia: parseFloat(document.getElementById('potencia').value) || 0,
        consumo_eletrico: parseFloat(document.getElementById('consumo_eletrico').value) || 0,
        consumo_agua: parseFloat(document.getElementById('consumo_agua').value) || 0,
        consumo_gases: parseFloat(document.getElementById('consumo_gases').value) || 0,
        velocidade: document.getElementById('velocidade').value,
        avanco: document.getElementById('avanco').value,
        comprimento_max: parseFloat(document.getElementById('comprimento_max').value) || 0,
        diametro_max: parseFloat(document.getElementById('diametro_max').value) || 0,
        frequencia_manutencao: parseInt(document.getElementById('frequencia_manutencao').value) || 0,
        horas_trabalhadas: parseInt(document.getElementById('horas_trabalhadas').value) || 0,
        preco_compra: parseFloat(document.getElementById('preco_compra').value) || 0,
        depreciacao_mensal: parseFloat(document.getElementById('depreciacao_mensal').value) || 0,
        valor_venda_final: parseFloat(document.getElementById('valor_venda_final').value) || 0,
        operador_nome: document.getElementById('operador_nome').value,
        custo_minuto_operador: parseFloat(document.getElementById('custo_minuto_operador').value) || 0,
        custo_minuto_maquina: parseFloat(document.getElementById('custo_minuto_maquina').value) || 0
    };

    await fetch('/api/maquinas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioMaquinas();
    carregarDadosIniciais();
}

async function editarMaquina(id) {
    const res = await fetch(`/api/maquinas/buscar/${id}`);
    const m = await res.json();
    
    document.getElementById('registro_id').value = m.id;
    document.getElementById('nome_equipamento').value = m.nome_equipamento;
    document.getElementById('potencia').value = m.potencia;
    document.getElementById('consumo_eletrico').value = m.consumo_eletrico;
    document.getElementById('consumo_agua').value = m.consumo_agua || 0;
    document.getElementById('consumo_gases').value = m.consumo_gases || 0;
    document.getElementById('velocidade').value = m.velocidade || '';
    document.getElementById('avanco').value = m.avanco || '';
    document.getElementById('frequencia_manutencao').value = m.frequencia_manutencao;
    document.getElementById('horas_trabalhadas').value = m.horas_trabalhadas;
    document.getElementById('preco_compra').value = m.preco_compra;
    document.getElementById('depreciacao_mensal').value = m.depreciacao_mensal;
    document.getElementById('valor_venda_final').value = m.valor_venda_final;
    document.getElementById('operador_nome').value = m.operador_nome;
    document.getElementById('custo_minuto_operador').value = m.custo_minuto_operador;
    document.getElementById('custo_minuto_maquina').value = m.custo_minuto_maquina;
    
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Máquina";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarMaquina(id) {
    if(!confirm('Deseja descartar este ativo imobilizado do parque fabril da empresa?')) return;
    await fetch(`/api/maquinas/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioMaquinas() {
    document.getElementById('formMaquina').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "💾 Salvar Ativo";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('custo_minuto_maquina').value = '';
}
