/* erppadrao - maquinas/maquinas.js - PARTE 1 DE 2 */

// Variáveis Globais de Controle de Interface e Acessibilidade Corporativa (WCAG)
let escalaFonteGlobal = 16;
let sintetizadorLeitor = window.speechSynthesis;
let flagLeitorAtivo = false;

// ♿ INJEÇÃO FORÇADA DE ACESSIBILIDADE (WCAG) - ANULAÇÃO DE PIXEL FIXO via !important
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
    const botaoTema = document.getElementById('btn_tema');
    if (botaoTema) {
        botaoTema.innerText = document.body.classList.contains('dark-mode') ? "☀️ Modo Claro" : "🌙 Modo Escuro";
    }
}

function alternarLeitorAudio() {
    flagLeitorAtivo = !flagLeitorAtivo;
    const botaoLeitor = document.getElementById('btn-leitor-audio');
    if (!botaoLeitor) return;
    
    if (flagLeitorAtivo) {
        botaoLeitor.innerText = "🛑 Parar Áudio";
        botaoLeitor.style.backgroundColor = "#dc2626";
        executarLeituraTela();
    } else {
        botaoLeitor.innerText = "🔊 Ativar Leitor";
        botaoLeitor.style.backgroundColor = "#0284c7";
        sintetizadorLeitor.cancel();
    }
}

function executarLeituraTela() {
    if (!flagLeitorAtivo) return;
    sintetizadorLeitor.cancel();
    const titulo = document.getElementById('txt_titulo_pagina')?.innerText || "Máquinas e Equipamentos";
    const sub = document.getElementById('txt_sub')?.innerText || "";
    let locucao = new SpeechSynthesisUtterance(`${titulo}. Configuração do Parque de Ativos Mecânicos. ${sub}`);
    locucao.lang = 'pt-BR';
    locucao.onend = () => { if (flagLeitorAtivo) alternarLeitorAudio(); };
    sintetizadorLeitor.speak(locucao);
}

// 📋 DICIONÁRIO DE MODELOS PREDEFINIDOS PARA O FORMULÁRIO DE ENGENHARIA DE CUSTOS
function carregarPreDefinido() {
    const seletor = document.getElementById('seletor_modelo').value;
    if (seletor === 'cnc_mazak') {
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
    } else if (seletor === 'fresadora') {
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

// 🧮 ENGENHARIA DE CUSTOS: CÁLCULO DIDÁTICO DO CUSTO MINUTO MÁQUINA (CMM)
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
    
    if (minutosNoMes <= 0) return;

    const depreciacaoPorMinuto = depreciacao / minutosNoMes;
    const energiaPorMinuto = (consumoKwh * custoKwhEnergia) / 60;
    const aguaPorMinuto = (consumoAguaHora * custoMetroCubicoAgua) / 60;
    const gasesPorMinuto = (consumoGasesHora * custoMetroCubicoGas) / 60;
    
    const c_mm = custoEstruturalMinuto + depreciacaoPorMinuto + energiaPorMinuto + aguaPorMinuto + gasesPorMinuto + custoOperadorMinuto;
    
    const inputCMM = document.getElementById('custo_minuto_maquina');
    if (inputCMM) inputCMM.value = c_mm.toFixed(4);
}
/* erppadrao - maquinas/maquinas.js - PARTE 2A DE 2 */

// 📡 CONEXÃO ASSÍNCRONA COM O PARQUE DE ATIVOS DO SUPABASE (OPÇÃO B - DEDUÇÃO DINÂMICA)
async function carregarDadosIniciais() {
    try {
        // 📡 AJAX 1: Consome as métricas consolidadas do GerenciadorCaixa para Engenharia
        const resMetricas = await fetch('/api/financeiro/metricas?dept=maquinas');
        if (!resMetricas.ok) throw new Error("Falha na ponte de comunicação.");
        const metricas = await resMetricas.json();
        
        // Injeta os dados monetários globais padronizados nas métricas do topo
        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if(document.getElementById('top_giro_global')) document.getElementById('top_giro_global').innerText = `R$ ${(metricas.capital_disponivel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if(document.getElementById('top_custo_fixo')) document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_variavel')) document.getElementById('top_custo_variavel').innerText = `R$ ${(metricas.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        // Atualiza a verba local alocada para o departamento de Engenharia e calcula porcentagem
        const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
        const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
        if(document.getElementById('top_verba_reais')) document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if(document.getElementById('top_verba_porcentagem')) document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

        // 🧠 MOTOR DE GOVERNANÇA ORÇAMENTÁRIA DO SETOR DE ATIVOS (40% Máximo do Capital Inicial)
        const capitalInicial = metricas.capital_total || 0;
        const budgetMaximoSetor = capitalInicial * 0.40; 
        const gastoAtualSetor = metricas.custo_fixo_total || 0; 
        
        let porcentagemConsumida = budgetMaximoSetor > 0 ? (gastoAtualSetor / budgetMaximoSetor) * 100 : 0;
        porcentagemConsumida = Math.min(100, Math.max(0, porcentagemConsumida)); 
        
        const txtBudget = document.getElementById('top_budget_setor');
        const barraProgresso = document.getElementById('barra_progresso_budget');
        const txtPorcentagem = document.getElementById('txt_porcentagem_budget');
        const cardBudget = document.getElementById('card_budget_limite');
        
        if (txtBudget) txtBudget.innerText = `R$ ${gastoAtualSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})} / R$ ${budgetMaximoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (barraProgresso) barraProgresso.style.width = `${porcentagemConsumida}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${porcentagemConsumida.toFixed(1)}% do teto consumido`;
        
        if (cardBudget && barraProgresso) {
            if (gastoAtualSetor > budgetMaximoSetor) {
                cardBudget.style.backgroundColor = "#fef2f2";
                cardBudget.style.borderColor = "#fca5a5";
                barraProgresso.style.backgroundColor = "#ef4444"; 
            } else {
                cardBudget.style.backgroundColor = "#f8fafc";
                cardBudget.style.borderColor = "#cbd5e1";
                barraProgresso.style.backgroundColor = "#3b82f6"; 
            }
        }

        // 📡 AJAX 2: Recupera a malha de ativos imobilizados cadastrados no Supabase
        const resAtivos = await fetch('/api/maquinas/listar');
        const ativos = await resAtivos.json();
        const tbody = document.getElementById('tabela_maquinas');
        if (!tbody) return;
        
        if (!ativos || ativos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum ativo mecânico imobilizado no Supabase para este grupo.</td></tr>`;
            return;
        }

        tbody.innerHTML = ativos.map(m => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px;"><strong>${m.nome_equipamento}</strong></td>
                <td style="padding: 12px;">Elet: ${m.consumo_eletrico}kW | Água: ${m.consumo_agua || 0}m³<br>Gás: ${m.consumo_gases || 0}m³/h</td>
                <td style="padding: 12px;"><strong>${m.operador_nome}</strong></td>
                <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #1e3a8a;">R$ ${(m.custo_minuto_maquina || 0).toFixed(4)}/min</td>
                <td style="padding: 12px; text-align: center; white-space: nowrap;">
                    <button type="button" onclick="editarMaquina(${m.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7; margin-right: 2px;">Editar</button>
                    <button type="button" onclick="deletarMaquina(${m.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Descartar</button>
                </td>
            </tr>
        `).join('');
        
        calcularMinutoMaquina();
        mudarFonte(0);
    } catch (err) { console.error(err); }
}
/* erppadrao - maquinas/maquinas.js - PARTE 2B DE 2 */

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
            alert("🎯 Ativo industrial registrado no parque fabril com sucesso!");
        } else {
            alert("❌ Erro na validação: Falha de integridade ao persistir no Supabase.");
        }
    } catch (err) { 
        console.error(err);
        alert("❌ Erro operacional: O servidor central do Render não respondeu.");
    }
}

async function editarMaquina(id) {
    try {
        const res = await fetch(`/api/maquinas/buscar/${id}`);
        if (!res.ok) throw new Error("Ativo inacessível.");
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
        document.getElementById('custo_minuto_maquina').value = m.custo_minuto_maquina;
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Máquina Activa";
        const btnCancel = document.getElementById('btn_cancelar');
        if (btnCancel) btnCancel.style.display = 'inline-block';
        
        calcularMinutoMaquina();
        mudarFonte(0);
    } catch (err) { 
        console.error(err);
        alert("❌ Erro ao tentar carregar ativo mecânico para alteração.");
    }
}

async function deletarMaquina(id) {
    if(!confirm('Deseja descartar este ativo imobilizado do parque fabril da empresa?')) return;
    try {
        const res = await fetch(`/api/maquinas/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
            alert("🎯 Ativo descartado e desvinculado com sucesso.");
        } else {
            alert("❌ Falha na exclusão: Operação negada pela segurança do Supabase.");
        }
    } catch (err) { 
        console.error(err); 
        alert("❌ Erro ao tentar processar o descarte junto à API.");
    }
}

function limparFormularioMaquina() {
    const form = document.getElementById('formMaquina');
    if (form) form.reset();
    if (document.getElementById('registro_id')) document.getElementById('registro_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Registrar Ativo no Supabase";
    const btnCancel = document.getElementById('btn_cancelar');
    if (btnCancel) btnCancel.style.display = 'none';
    calcularMinutoMaquina();
    mudarFonte(0);
}

// Injeção de Contexto das Rotinas e ganchos no Ciclo DOM do Render
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
