/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 1 DE 6 - DICIONÁRIO EXPANDIDO DE OPERAÇÕES DIDÁTICAS PARA ADMINISTRAÇÃO
   ========================================================================== */

const PRODUTOS_DIDATICOS = {
    eixo_transmissao: {
        nome: "Eixo de Transmissão Principal SAE 4340",
        operacoes: [
            { seq: 10, nome: "Corte de Tarugo a Laser / Serra Fita", setup: 15.0, operacao: 1.5, maq_sku: "MAQ-LAS-FIBR-04" },
            { seq: 20, nome: "Usinagem Externa (Ø Inicial 101.6mm para Ø Final 50.8mm / Comp: 500mm)", setup: 45.0, operacao: 8.5, maq_sku: "MAQ-CNC-FRES-01" },
            { seq: 30, nome: "Fresamento de Canais e Estrias de Encaixe", setup: 30.0, operacao: 4.2, maq_sku: "MAQ-CNC-FRES-01" },
            { seq: 40, nome: "Tratamento Térmico de Cementação e Têmpera Atmosférica", setup: 120.0, operacao: 25.0, maq_sku: "MAQ-FORN-ATMO-07" },
            { seq: 50, nome: "Revenimento Contínuo para Alívio de Tensões", setup: 60.0, operacao: 15.0, maq_sku: "MAQ-FORN-REVE-08" },
            { seq: 60, nome: "Retífica Cilíndrica Universal de Precisão nos Assentos", setup: 40.0, operacao: 6.0, maq_sku: "MAQ-RET-CIL-06" }
        ]
    },
    pino_articulacao: {
        nome: "Pino de Articulação de Carga SAE 1045",
        operacoes: [
            { seq: 10, nome: "Corte de Barra Maciça (Ø 50.8mm / Comp: 150mm)", setup: 10.0, operacao: 0.8, maq_sku: "MAQ-SERR-FITA-04" },
            { seq: 20, nome: "Torneamento Externo e Faceamento das Extremidades", setup: 25.0, operacao: 3.2, maq_sku: "MAQ-MEC-TORN-02" },
            { seq: 30, nome: "Furação Radial Centralizada para Canal de Lubrificação", setup: 15.0, operacao: 2.0, maq_sku: "MAQ-FUR-RAD-06" },
            { seq: 40, nome: "Tratamento Térmico de Beneficiamento e Normalização", setup: 90.0, operacao: 18.0, maq_sku: "MAQ-FORN-ATMO-07" }
        ]
    },
    bucha_bronze: {
        nome: "Bucha de Desgaste Mecânico de Bronze/Inox",
        operacoes: [
            { seq: 10, nome: "Corte de Tubo Mecânico Sem Costura", setup: 12.0, operacao: 1.1, maq_sku: "MAQ-SERR-FITA-04" },
            { seq: 20, nome: "Torneamento Interno (Mandrilhamento do Ø Passante)", setup: 30.0, operacao: 4.5, maq_sku: "MAQ-MEC-TORN-02" },
            { seq: 30, nome: "Usinagem de Canais Internos de Graxa (Canais Helicoidais)", setup: 20.0, operacao: 2.8, maq_sku: "MAQ-MEC-TORN-02" }
        ]
    },
    engrenagem_elicoidal: {
        nome: "Engrenagem Helicoidal de Redutores SAE 8620",
        operacoes: [
            { seq: 10, nome: "Usinagem Externa e Faceamento do Bloco Flangeado", setup: 50.0, operacao: 6.5, maq_sku: "MAQ-CNC-FRES-01" },
            { seq: 20, nome: "Fezamento Dinâmico de Dentes Helicoidais (Módulo 4.0)", setup: 60.0, operacao: 12.0, maq_sku: "MAQ-CNC-FRES-01" },
            { seq: 30, nome: "Tratamento Térmico Químico de Carbonitretação", setup: 150.0, operacao: 30.0, maq_sku: "MAQ-FORN-ATMO-07" },
            { seq: 40, nome: "Recozimento Isotérmico para Ajuste Metalúrgico", setup: 80.0, operacao: 20.0, maq_sku: "MAQ-FORN-REVE-08" }
        ]
    },
    placa_base: {
        nome: "Placa Base de Acoplamento Estrutural",
        operacoes: [
            { seq: 10, nome: "Corte Perimetral de Chapa de Inox a Laser", setup: 20.0, operacao: 4.0, maq_sku: "MAQ-LAS-FIBR-04" },
            { seq: 20, nome: "Furação de Canais Concéntricos de Fixação", setup: 15.0, operacao: 3.5, maq_sku: "MAQ-FUR-RAD-06" },
            { seq: 30, nome: "Pintura Eletrostática a Pó e Cura em Estufa", setup: 45.0, operacao: 5.0, maq_sku: "MAQ-FORN-REVE-08" }
        ]
    },
    matriz_estampo: {
        nome: "Matriz de Estampo de Alta Carga SAE 1070",
        operacoes: [
            { seq: 10, nome: "Tratamento Térmico de Recozimento para Usinabilidade", setup: 100.0, operacao: 22.0, maq_sku: "MAQ-FORN-ATMO-07" },
            { seq: 20, nome: "Usinagem CNC por Cópia Tridimensional da Cavidade", setup: 90.0, operacao: 45.0, maq_sku: "MAQ-CNC-FRES-01" },
            { seq: 30, nome: "Tratamento de Alívio de Tensões por Ferritização/Perlitização", setup: 120.0, operacao: 24.0, maq_sku: "MAQ-FORN-REVE-08" }
        ]
    }
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 2 DE 6 - INICIALIZAÇÃO DA ACESSIBILIDADE E DISPARO DE TELA
   ========================================================================== */

let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheMaquinasEquipe = [];

document.addEventListener("DOMContentLoaded", function() {
    try { window.mudarFonte(0); } catch(e) { console.error(e); }
    carregarDadosIniciais();
});

window.mudarFonte = function(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
};

window.alternarModoEscuro = function() { document.body.classList.toggle('dark-mode'); };
window.alternarAltoContraste = function() { document.body.classList.toggle('alto-contraste'); };

window.alternarLeitorAudio = function() {
    leitorAtivo = !leitorAtivo;
    if (document.getElementById('btn-leitor-audio')) {
        document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Leitor";
    }
    try {
        if (leitorAtivo) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance("Módulo de Roteiros Didáticos Carregado.");
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
        } else { window.speechSynthesis.cancel(); }
    } catch(err) { console.error(err); }
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 3 DE 6 - SINCRONISMO DO TOPBOARD HORIZONTAL ELÁSTICO
   ========================================================================== */

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=processos');
        if (resMetricas.ok) {
            const metricas = await resMetricas.json();
            if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 5000000).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            if(document.getElementById('top_disponivel_setor')) document.getElementById('top_disponivel_setor').innerText = `R$ ${(metricas.capital_disponivel_total || 1000000).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            if(document.getElementById('top_orcamento_inicial')) document.getElementById('top_orcamento_inicial').innerText = `R$ ${(metricas.capital_disponivel_total || 1000000).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            if(document.getElementById('top_custo_fixo')) document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            const verbaSetor = metricas.capital_disponivel_departamento || 0;
            const pct = ((verbaSetor / (metricas.capital_total || 1)) * 100).toFixed(1);
            if(document.getElementById('top_verba_reais')) document.getElementById('top_verba_reais').innerText = `R$ ${verbaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            if(document.getElementById('pct_saldo_engenharia')) document.getElementById('pct_saldo_engenharia').innerText = `➔ ${pct}% do Cap.`;
        }
    } catch (err) { console.warn(err); }
    
    // Carga de Máquinas cadastradas para vinculação síncrona
    try {
        const resMaquinas = await fetch('/api/maquinas/listar');
        const selectMaquinas = document.getElementById('maquina_vinculada');
        if (resMaquinas.ok && selectMaquinas) {
            cacheMaquinasEquipe = await resMaquinas.json();
            if (cacheMaquinasEquipe.length === 0) {
                selectMaquinas.innerHTML = '<option value="">❌ Nenhuma Máquina no Supabase (Vá para Fase 4)</option>';
            } else {
                selectMaquinas.innerHTML = '<option value="">-- Selecione o Posto de Trabalho --</option>' + 
                    cacheMaquinasEquipe.map(m => `<option value="${m.id}">${m.nome_equipamento} (R$ ${parseFloat(m.custo_minuto_maquina || 0).toFixed(4)}/min)</option>`).join('');
            }
        }
    } catch (err) { console.warn(err); }

    carregarTabelaRoteiros();
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 4 DE 6 - PREENCHIMENTO AUTOMÁTICO DE ROTEIROS DIDÁTICOS
   ========================================================================== */

window.dispararSelecaoProdutoDidatico = function() {
    const prodChave = document.getElementById('seletor_produto_base').value;
    const seletorOp = document.getElementById('seletor_operacao_didatica');
    if (!seletorOp) return;
    
    seletorOp.innerHTML = '<option value="">-- Escolha a Fase de Fabricação --</option>';
    const item = PRODUTOS_DIDATICOS[prodChave];
    
    if (item) {
        item.operacoes.forEach(o => {
            seletorOp.add(new Option(`Op. ${o.seq} - ${o.nome}`, o.seq));
        });
    }
    window.limparCamposFase();
};

window.carregarFaseOperacionalPredefinida = function() {
    const prodChave = document.getElementById('seletor_produto_base').value;
    const opSeq = parseInt(document.getElementById('seletor_operacao_didatica').value);
    const item = PRODUTOS_DIDATICOS[prodChave];
    if (!item) return;
    
    const op = item.operacoes.find(o => o.seq === opSeq);
    if (op) {
        document.getElementById('nome_operacao').value = op.nome;
        document.getElementById('tempo_setup').value = op.setup.toFixed(1);
        document.getElementById('tempo_operacao').value = op.operacao.toFixed(1);
        document.getElementById('sequencia_op').value = op.seq;
        
        // Auto-selecionar a máquina correspondente se cadastrada por SKU ou ID por proximidade
        const selectMaq = document.getElementById('maquina_vinculada');
        if (selectMaq && cacheMaquinasEquipe.length > 0) {
            // Tenta encontrar por aproximação de nome ou índice didático
            const maqMatch = cacheMaquinasEquipe[opSeq % cacheMaquinasEquipe.length] || cacheMaquinasEquipe[0];
            if (maqMatch) {
                selectMaq.value = maqMatch.id;
                window.buscarCustoMinutoMaquina();
            }
        }
    }
};

window.buscarCustoMinutoMaquina = function() {
    const idMaqSelected = document.getElementById('maquina_vinculada').value;
    const maq = cacheMaquinasEquipe.find(x => x.id == idMaqSelected);
    const campoRef = document.getElementById('custo_ref_maquina');
    if (campoRef) campoRef.value = maq ? parseFloat(maq.custo_minuto_maquina || 0).toFixed(4) : "0.0000";
    window.calcularCustoOperacao();
};

window.calcularCustoOperacao = function() {
    const tempoSetup = parseFloat(document.getElementById('tempo_setup').value) || 0;
    const tempoOperacao = parseFloat(document.getElementById('tempo_operacao').value) || 0;
    const custoMinutoMaquina = parseFloat(document.getElementById('custo_ref_maquina').value) || 0;
    const custoTotalUnitario = (tempoSetup + tempoOperacao) * custoMinutoMaquina;
    
    const campoCusto = document.getElementById('custo_total_operacao');
    if (campoCusto) campoCusto.value = `R$ ${custoTotalUnitario.toFixed(2)}`;
};

window.limparCamposFase = function() {
    document.getElementById('nome_operacao').value = '';
    document.getElementById('tempo_setup').value = '10.0';
    document.getElementById('tempo_operacao').value = '2.5';
    document.getElementById('custo_ref_maquina').value = '0.0000';
    document.getElementById('sequencia_op').value = '10';
    document.getElementById('custo_total_operacao').value = '';
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 5 DE 6 - RENDERIZAÇÃO DA TABELA ANALÍTICA DE CRONOANÁLISE VIA DOM
   ========================================================================== */

async function carregarTabelaRoteiros() {
    try {
        const resProcessos = await fetch('/api/processos/listar');
        const tbody = document.getElementById('tabela_processos');
        if (!resProcessos.ok || !tbody) return;
        
        const processos = await resProcessos.json();
        let somaCustosProcessos = 0;
        processos.forEach(p => { somaCustosProcessos += parseFloat(p.custo_total_operacao || 0); });
        
        const elVariavel = document.getElementById('top_custo_variavel_setor');
        if (elVariavel) elVariavel.innerText = `R$ ${somaCustosProcessos.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

        if (processos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum roteiro cadastrado no Supabase.</td></tr>`;
            return;
        }

        tbody.innerHTML = processos.map(p => `
            <tr class="hover:bg-gray-50 border-b text-[11px]">
                <td class="p-3"><strong>Op. # ${p.sequencia_op}</strong><br><span class="text-blue-900 font-bold">${p.nome_operacao}</span><br><small style="color:#64748b;">Peça: ${p.produto_base || 'Geral'}</small></td>
                <td class="p-3 font-semibold text-gray-700">${p.maquina_nome_suporte || 'Posto de Trabalho'}</td>
                <td class="p-3 font-mono">Setup: ${p.tempo_setup} min<br>Operação: ${p.tempo_operacao} min/pç</td>
                <td class="p-3 font-mono font-bold text-emerald-600">R$ ${parseFloat(p.custo_total_operacao || 0).toFixed(2)}</td>
                <td class="p-3 text-center whitespace-nowrap actions-legal">
                    <button type="button" onclick="window.editarProcesso(${p.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                    <button type="button" onclick="window.deletarProcesso(${p.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 6 DE 6 - CONTROLES CRUD REATIVOS E RETORNO DO FORMULÁRIO
   ========================================================================== */

window.salvarProcesso = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('maquina_vinculada');
    const selectProd = document.getElementById('seletor_produto_base');
    if (!select || !select.value) return;
    
    try {
        const dados = {
            id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
            produto_base: selectProd ? selectProd.options[selectProd.selectedIndex]?.text : 'Insumo Geral',
            nome_operacao: document.getElementById('nome_operacao').value,
            maquina_id: parseInt(select.value) || null,
            maquina_nome_suporte: select.options[select.selectedIndex]?.text.split(' (')[0] || '',
            tempo_setup: parseFloat(document.getElementById('tempo_setup').value) || 0,
            tempo_operacao: parseFloat(document.getElementById('tempo_operacao').value) || 0,
            custo_ref_maquina: parseFloat(document.getElementById('custo_ref_maquina').value) || 0,
            sequencia_op: parseInt(document.getElementById('sequencia_op').value) || 10,
            custo_total_operacao: parseFloat(document.getElementById('custo_total_operacao').value.replace('R$ ', '')) || 0
        };

        const res = await fetch('/api/processos/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (res.ok) {
            window.limparFormularioProcessos();
            carregarDadosIniciais();
            alert("🎯 Etapa do Roteiro Homologada com Sucesso!");
        }
    } catch(err) { console.error(err); }
};

window.editarProcesso = async function(id) {
    try {
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
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Roteiro";
        if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').classList.remove('hidden');
    } catch(e) { console.error(e); }
};

window.deletarProcesso = async function(id) {
    if (!confirm('Deseja remover esta operação do roteiro?')) return;
    try {
        const res = await fetch(`/api/processos/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) carregarDadosIniciais();
    } catch(e) { console.error(e); }
};

window.limparFormularioProcessos = function() {
    const form = document.getElementById('formProcesso'); if (form) form.reset();
    if (document.getElementById('registro_id')) document.getElementById('registro_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "⚙️ Homologar Operação";
    if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').classList.add('hidden');
    window.limparCamposFase();
};
