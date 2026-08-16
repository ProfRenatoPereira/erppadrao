/* erppadrao - maquinas/maquinas.js - PARTE 1 DE 2 */
let escalaFonteGlobal = 16;
let sintetizadorLeitor = window.speechSynthesis;
let flagLeitorAtivo = false;

function mudarFonte(direcao) {
    escalaFonteGlobal += direcao;
    if (escalaFonteGlobal < 12) escalaFonteGlobal = 12;
    if (escalaFonteGlobal > 22) escalaFonteGlobal = 22;
    document.documentElement.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const b = document.getElementById('btn_tema');
    if (b) b.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
}

function alternarLeitorAudio() {
    flagLeitorAtivo = !flagLeitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (!btn) return;
    if (flagLeitorAtivo) {
        btn.innerText = "🛑 Parar";
        btn.style.backgroundColor = "#dc2626";
        sintetizadorLeitor.cancel();
        let t = document.getElementById('txt_titulo_pagina')?.innerText || "Máquinas";
        let u = new SpeechSynthesisUtterance(t + ". Parque de Ativos Industrial.");
        u.lang = 'pt-BR';
        u.onend = () => { if (flagLeitorAtivo) alternarLeitorAudio(); };
        sintetizadorLeitor.speak(u);
    } else {
        btn.innerText = "🔊 Leitor";
        btn.style.backgroundColor = "#0284c7";
        sintetizadorLeitor.cancel();
    }
}

function carregarPreDefinido() {
    const s = document.getElementById('seletor_modelo').value;
    if (s === 'cnc_mazak') {
        document.getElementById('nome_equipamento').value = "Torno CNC Mazak Quick Turn";
        document.getElementById('potencia').value = "22.0";
        document.getElementById('consumo_eletrico').value = "18.5";
        document.getElementById('consumo_agua').value = "0.002";
        document.getElementById('consumo_gases').value = "0.010";
        document.getElementById('velocidade').value = "6000";
        document.getElementById('avanco').value = "36000";
        document.getElementById('frequencia_manutencao').value = "500";
        document.getElementById('preco_compra').value = "650000.00";
        document.getElementById('depreciacao_mensal').value = "5416.67";
        document.getElementById('valor_venda_final').value = "130000.00";
        document.getElementById('operador_nome').value = "Operador CNC Nível III";
        document.getElementById('custo_minuto_operador').value = "0.4500";
    } else if (s === 'fresadora') {
        document.getElementById('nome_equipamento').value = "Fresadora Universal FU-3";
        document.getElementById('potencia').value = "7.5";
        document.getElementById('consumo_eletrico').value = "5.8";
        document.getElementById('consumo_agua').value = "0.000";
        document.getElementById('consumo_gases').value = "0.000";
        document.getElementById('velocidade').value = "1800";
        document.getElementById('avanco').value = "2000";
        document.getElementById('frequencia_manutencao').value = "1000";
        document.getElementById('preco_compra').value = "180000.00";
        document.getElementById('depreciacao_mensal').value = "1500.00";
        document.getElementById('valor_venda_final').value = "36000.00";
        document.getElementById('operador_nome').value = "Mecânico Industrial";
        document.getElementById('custo_minuto_operador').value = "0.3200";
    }
    calcularMinutoMaquina();
}

function calcularMinutoMaquina() {
    const d = parseFloat(document.getElementById('depreciacao_mensal').value) || 0;
    const kwh = parseFloat(document.getElementById('consumo_eletrico').value) || 0;
    const ag = parseFloat(document.getElementById('consumo_agua').value) || 0;
    const gs = parseFloat(document.getElementById('consumo_gases').value) || 0;
    const c_est = parseFloat(document.getElementById('custo_estrutural_oculto').value) || 0;
    const c_op = parseFloat(document.getElementById('custo_minuto_operador').value) || 0;
    const hs = parseFloat(document.getElementById('jornada_semanal').value) || 44;
    const t = parseFloat(document.getElementById('turnos_trabalho').value) || 1;
    
    const minMes = hs * 4.33 * 60 * t;
    if (minMes <= 0) return;

    const c_mm = c_est + (d / minMes) + ((kwh * 0.75) / 60) + ((ag * 6.50) / 60) + ((gs * 4.80) / 60) + c_op;
    const inp = document.getElementById('custo_minuto_maquina');
    if (inp) inp.value = c_mm.toFixed(4);
}
/* erppadrao - maquinas/maquinas.js - PARTE 2 DE 2 */
async function carregarDadosIniciais() {
    try {
        const res = await fetch('/api/financeiro/metricas?dept=maquinas');
        if (!res.ok) throw new Error("Erro de ponte.");
        const m = await res.json();
        
        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = `R$ ${(m.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if(document.getElementById('top_custo_fixo')) document.getElementById('top_custo_fixo').innerText = `R$ ${(m.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_variavel')) document.getElementById('top_custo_variavel').innerText = `R$ ${(m.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_verba_reais')) document.getElementById('top_verba_reais').innerText = `R$ ${(m.capital_disponivel_departamento || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        const cap = m.capital_total || 0;
        const verbaDisp = m.capital_disponivel_departamento || 0;
        if(document.getElementById('top_verba_porcentagem')) document.getElementById('top_verba_porcentagem').innerText = `${((verbaDisp / (cap || 1)) * 100).toFixed(2)}% do Capital`;

        const bMax = cap * 0.40;
        const gAt = m.custo_fixo_total || 0;
        let pct = bMax > 0 ? (gAt / bMax) * 100 : 0;
        pct = Math.min(100, Math.max(0, pct));
        
        if(document.getElementById('top_budget_setor')) document.getElementById('top_budget_setor').innerText = `R$ ${gAt.toLocaleString('pt-BR', {minimumFractionDigits:2})} / R$ ${bMax.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if(document.getElementById('barra_progresso_budget')) document.getElementById('barra_progresso_budget').style.width = `${pct}%`;
        if(document.getElementById('txt_porcentagem_budget')) document.getElementById('txt_porcentagem_budget').innerText = `${pct.toFixed(1)}% do teto consumido`;
        
        const card = document.getElementById('card_budget_limite');
        const bar = document.getElementById('barra_progresso_budget');
        if (card && bar) {
            if (gAt > bMax) { card.style.backgroundColor = "#fef2f2"; card.style.borderColor = "#fca5a5"; bar.style.backgroundColor = "#ef4444"; }
            else { card.style.backgroundColor = "#f8fafc"; card.style.borderColor = "#cbd5e1"; bar.style.backgroundColor = "#3b82f6"; }
        }

        const resAt = await fetch('/api/maquinas/listar');
        const ativos = await resAt.json();
        const tbody = document.getElementById('tabela_maquinas');
        if (!tbody) return;
        
        if (!ativos || ativos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum ativo mecânico imobilizado no Supabase.</td></tr>`;
            return;
        }

        tbody.innerHTML = ativos.map(x => `
            <tr>
                <td><strong>${x.nome_equipamento}</strong></td>
                <td>Elet: ${x.consumo_eletrico}kW | Água: ${x.consumo_agua}m³</td>
                <td><strong>${x.operador_nome}</strong></td>
                <td style="font-family: monospace; font-weight: bold; color: #1e3a8a;">R$ ${(x.custo_minuto_maquina || 0).toFixed(4)}/min</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="editarMaquina(${x.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7;">Editar</button>
                    <button type="button" onclick="deletarMaquina(${x.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Descartar</button>
                </td>
            </tr>
        `).join('');
        
        calcularMinutoMaquina();
        mudarFonte(0);
    } catch (e) { console.error(e); }
}

async function salvarMaquina(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_equipamento: document.getElementById('nome_equipamento').value,
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
        operador_nome: document.getElementById('operador_nome').value,
        custo_minuto_operador: parseFloat(document.getElementById('custo_minuto_operador').value) || 0,
        custo_minuto_maquina: parseFloat(document.getElementById('custo_minuto_maquina').value) || 0,
        jornada_semanal: document.getElementById('jornada_semanal').value,
        turnos_trabalho: document.getElementById('turnos_trabalho').value
    };

    try {
        const res = await fetch('/api/maquinas/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) { limparFormularioMaquina(); carregarDadosIniciais(); alert("🎯 Ativo salvo no Supabase!"); }
        else { alert("❌ Erro na validação: Saldo insuficiente ou estouro do teto (40%)."); }
    } catch (err) { alert("❌ Servidor central offline."); }
}

async function editarMaquina(id) {
    try {
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
        document.getElementById('preco_compra').value = m.preco_compra;
        document.getElementById('depreciacao_mensal').value = m.depreciacao_mensal;
        document.getElementById('valor_venda_final').value = m.valor_venda_final;
        document.getElementById('operador_nome').value = m.operador_nome;
        document.getElementById('custo_minuto_operador').value = m.custo_minuto_operador;
        document.getElementById('jornada_semanal').value = m.jornada_semanal || '44';
        document.getElementById('turnos_trabalho').value = m.turnos_trabalho || '1';
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Ativo";
        if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'inline-block';
        calcularMinutoMaquina();
    } catch (e) { alert("❌ Falha de barramento."); }
}

async function deletarMaquina(id) {
    if(!confirm('Deseja descartar este ativo do parque fabril?')) return;
    try {
        const res = await fetch(`/api/maquinas/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) { carregarDadosIniciais(); alert("🎯 Baixa realizada."); }
        else { alert("❌ Falha interna."); }
    } catch (e) { alert("❌ Erro operacional."); }
}

function limparFormularioMaquina() {
    const form = document.getElementById('formMaquina');
    if (form) form.reset();
    if (document.getElementById('registro_id')) document.getElementById('registro_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Registrar Ativo";
    if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'none';
    calcularMinutoMaquina();
}

window.mudarFonte = mudarFonte;
window.alternarAltoContraste = alternarAltoContraste;
window.alternarModoEscuro = alternarModoEscuro;
window.alternarLeitorAudio = alternarLeitorAudio;
window.carregarPreDefinido = carregarPreDefinido;
window.calcularMinutoMaquina = calcularMinutoMaquina;
window.salvarMaquina = salvarMaquina;
window.editarMaquina = editarMaquina;
window.deletarMaquina = deletarMaquina;
window.limparFormularioMaquina = limparFormularioMaquina;
window.addEventListener('DOMContentLoaded', carregarDadosIniciais);
