// maquinas/maquinas.js - PARTE 1
const catalogos = {
    "cnc_mazak": { 
        nome: "Torno CNC Mazak Quick Turn", pot: 25, cons: 18, vel: "6000 RPM", avan: "36000 mm/min", 
        mnt: 1000, preco: 450000, dep: 3750, venda: 90000, 
        operador: "Carlos Souza", custo_op: 0.25, agua: 0.050, gases: 0.120 
    },
    "fresadora": { 
        nome: "Fresadora Universal", pot: 15, cons: 11, vel: "3000 RPM", avan: "12000 mm/min", 
        mnt: 750, preco: 180000, dep: 1500, venda: 36000, 
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

function alternarModoEscuro() { 
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
}

function alternarAltoContraste() { 
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (btn) btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
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
        document.getElementById('frequencia_manutencao').value = item.mnt;
        document.getElementById('preco_compra').value = item.preco;
        document.getElementById('depreciacao_mensal').value = item.dep;
        document.getElementById('valor_venda_final').value = item.venda;
        document.getElementById('operador_nome').value = item.operador;
        document.getElementById('custo_minuto_operador').value = item.custo_op;
        
        // Injeção metrológica de fluidos e pneumática com tratamento de segurança
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
    
    const custoKwhEnergia = 0.75; 
    const custoMetroCubicoAgua = 6.50;  
    const custoMetroCubicoGas = 4.80;   
    
    const minutosNoMes = horasSemanais * 4.33 * 60 * turnos;
    
    const depreciacaoPorMinuto = depreciacao / minutosNoMes;
    const energiaPorMinuto = (consumoKwh * custoKwhEnergia) / 60;
    const aguaPorMinuto = (consumoAguaHora * custoMetroCubicoAgua) / 60;
    const gasesPorMinuto = (consumoGasesHora * custoMetroCubicoGas) / 60;
    
    const c_mm = custoEstruturalMinuto + depreciacaoPorMinuto + energiaPorMinuto + aguaPorMinuto + gasesPorMinuto + custoOperadorMinuto;
    
    const inputCMM = document.getElementById('custo_minuto_maquina');
    if (inputCMM) inputCMM.value = c_mm.toFixed(4);
}
// maquinas/maquinas.js - PARTE 2

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=maquinas');
        if (!resMetricas.ok) throw new Error("Falha ao processar métricas de engenharia.");
        const metricas = await resMetricas.json();
        
        document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_giro_global').innerText = `R$ ${(metricas.capital_disponivel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        document.getElementById('top_custo_variavel').innerText = `R$ ${(metricas.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
        const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
        document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

        const resAtivos = await fetch('/api/maquinas/listar');
        const ativos = await resAtivos.json();
        const tbody = document.getElementById('tabela_maquinas');
        if (!tbody) return;
        
        if (!ativos || ativos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">Nenhum ativo mecânico imobilizado no Supabase para este grupo.</td></tr>`;
            return;
        }

        tbody.innerHTML = ativos.map(a => `
            <tr>
                <td style="font-weight: 900; color: #1e3a8a;">${a.nome_equipamento}<br><span style="font-size: 11px; color: #64748b;">Op: ${a.operador_nome}</span></td>
                <td><strong>Potência:</strong> ${a.potencia} kW<br><span style="font-size: 11px; color: #475569;">H2O: ${a.consumo_agua} m³/h | Gás: ${a.consumo_gases} m³/h</span></td>
                <td style="font-family: monospace;">${a.frequencia_manutencao} h</td>
                <td style="color: #16a34a; font-weight: 800;">R$ ${(a.custo_minuto_maquina || 0).toFixed(4)}/min</td>
                <td style="text-align: center; white-space: nowrap;" class="actions-legal">
                    <button onclick="editarMaquina(${a.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7; margin-right: 2px;">Editar</button>
                    <button onclick="deletarMaquina(${a.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Descartar</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Erro na carga inicial do Supabase:", err);
    }
}

async function salvarMaquina(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_equipamento: document.getElementById('nome_equipamento').value.trim(),
        potencia: parseFloat(document.getElementById('potencia').value) || 0,
        consumo_eletrico: parseFloat(document.getElementById('consumo_eletrico').value) || 0,
        consumo_agua: parseFloat(document.getElementById('consumo_agua').value) || 0,
        consumo_gases: parseFloat(document.getElementById('consumo_gases').value) || 0,
        velocidade: document.getElementById('velocidade').value,
        avanco: document.getElementById('avanco').value,
        frequencia_manutencao: parseInt(document.getElementById('frequencia_manutencao').value) || 0,
        preco_compra: parseFloat(document.getElementById('preco_compra').value) || 0,
        depreciacao_mensal: parseFloat(document.getElementById('depreciacao_mensal').value) || 0,
        valor_venda_final: parseFloat(document.getElementById('valor_venda_final').value) || 0,
        operador_nome: document.getElementById('operador_nome').value.trim(),
        custo_minuto_operador: parseFloat(document.getElementById('custo_minuto_operador').value) || 0,
        custo_minuto_maquina: parseFloat(document.getElementById('custo_minuto_maquina').value) || 0
    };

    try {
        const res = await fetch('/api/maquinas/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            limparFormularioMaquina();
            carregarDadosIniciais();
        }
    } catch (err) { console.error(err); }
}

async function editarMaquina(id) {
    try {
        const res = await fetch(`/api/maquinas/buscar/${id}`);
        const m = await res.json();
        
        document.getElementById('registro_id').value = m.id;
        document.getElementById('nome_equipamento').value = m.nome_equipamento;
        document.getElementById('potencia').value = m.potencia;
        document.getElementById('consumo_eletrico').value = m.consumo_eletrico;
        document.getElementById('consumo_agua').value = m.consumo_agua;
        document.getElementById('consumo_gases').value = m.consumo_gases;
        document.getElementById('velocidade').value = m.velocidade || '';
        document.getElementById('avanco').value = m.avanco || '';
        document.getElementById('frequencia_manutencao').value = m.frequencia_manutencao;
        document.getElementById('preco_compra').value = m.preco_compra;
        document.getElementById('depreciacao_mensal').value = m.depreciacao_mensal;
        document.getElementById('valor_venda_final').value = m.valor_venda_final;
        document.getElementById('operador_nome').value = m.operador_nome;
        document.getElementById('custo_minuto_operador').value = m.custo_minuto_operador;
        document.getElementById('custo_minuto_maquina').value = m.custo_minuto_maquina;
        
        document.getElementById('btn_salvar').innerText = "🔄 Atualizar Ativo Mecânico";
        const btnCancel = document.getElementById('btn_cancelar');
        if (btnCancel) btnCancel.style.display = 'inline-block';
    } catch (err) { console.error(err); }
}

async function deletarMaquina(id) {
    if (!confirm('Confirmar o descarte e baixa contábil deste ativo do parque fabril?')) return;
    try {
        const res = await fetch(`/api/maquinas/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) carregarDadosIniciais();
    } catch (err) { console.error(err); }
}

function limparFormularioMaquina() {
    const form = document.getElementById('formMaquina');
    if (form) form.reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "💾 Registrar Ativo no Supabase";
    const btnCancel = document.getElementById('btn_cancelar');
    if (btnCancel) btnCancel.style.display = 'none';
    calcularMinutoMaquina();
}
