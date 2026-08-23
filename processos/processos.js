/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 1 DE 3 - CORE DE ACESSIBILIDADE SEPARADO DA REDE
   ========================================================================== */

let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let cacheMaquinasEquipe = [];

const PRODUTOS_DIDATICOS = {
    eixo_transmissao: {
        nome: "Eixo de Transmissão Principal SAE 4340",
        operacoes: [
            { seq: 10, nome: "Corte de Tarugo a Laser / Serra Fita", setup: 15.0, operacao: 1.5, custo_maq: 0.6500 },
            { seq: 20, nome: "Usinagem Externa (Ø Inicial 101.6mm para Ø Final 50.8mm)", setup: 45.0, operacao: 8.5, custo_maq: 0.4500 },
            { seq: 30, nome: "Fresamento de Canais e Estrias de Encaixe", setup: 30.0, operacao: 4.2, custo_maq: 0.4500 },
            { seq: 40, nome: "Tratamento Térmico de Cementação Atmosférica", setup: 120.0, operacao: 25.0, custo_maq: 0.4800 },
            { seq: 50, nome: "Revenimento Contínuo para Alívio de Tensões", setup: 60.0, operacao: 15.0, custo_maq: 0.3000 },
            { seq: 60, nome: "Retífica Cilíndrica Universal nos Assentos", setup: 40.0, operacao: 6.0, custo_maq: 0.3800 }
        ]
    },
    pino_articulacao: {
        nome: "Pino de Articulação de Carga SAE 1045",
        operacoes: [
            { seq: 10, nome: "Corte de Barra Maciça (Ø 50.8mm / Comp: 150mm)", setup: 10.0, operacao: 0.8, custo_maq: 0.2200 },
            { seq: 20, nome: "Torneamento Externo e Faceamento", setup: 25.0, operacao: 3.2, custo_maq: 0.3200 },
            { seq: 30, nome: "Furação Radial para Canal de Lubrificação", setup: 15.0, operacao: 2.0, custo_maq: 0.2600 }
        ]
    }
};

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
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 2 DE 3 - RATEIO DE KPIs E EXTRAÇÃO ASSÍNCRONA DE MAQUINAS
   ========================================================================== */

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=processos');
        if (resMetricas.ok) {
            const metricas = await resMetricas.json();
            window.forcarAtualizacaoMetricasTopboard(); // Força a injeção master nas labels e progress-bar
        }
    } catch (err) { console.warn("Falha ao carregar balanço master: ", err); }
    
    // CORREÇÃO: Varre de forma progressiva a tabela engenharia_processos unificada no Supabase
    try {
        const resProcessos = await fetch('/api/processos/listar');
        const selectMaquinas = document.getElementById('maquina_vinculada');
        
        if (resProcessos.ok && selectMaquinas) {
            cacheMaquinasEquipe = await resProcessos.json();
            
            // População didática imediata contra travamentos se o banco físico estiver vazio
            selectMaquinas.innerHTML = `
                <option value="">-- Selecione o Posto de Trabalho --</option>
                <option value="101">Torno CNC Mazak Quick Turn (Ref: R$ 0.4500/min)</option>
                <option value="102">Centro de Usinagem CNC High Speed (Ref: R$ 0.5200/min)</option>
                <option value="103">Forno de Atmosfera Controlada (Ref: R$ 0.4800/min)</option>
                <option value="104">Retífica Cilíndrica Universal (Ref: R$ 0.3800/min)</option>
                <option value="105">Corte a Laser de Fibra Óptica (Ref: R$ 0.6500/min)</option>
            `;
            
            if (cacheMaquinasEquipe.length > 0) {
                cacheMaquinasEquipe.forEach(p => {
                    if (p.maquina_id && p.maquina_nome_suporte) {
                        const opt = new Option(`${p.maquina_nome_suporte} (Ref: R$ ${parseFloat(p.custo_ref_maquina || 0.45).toFixed(4)}/min)`, p.maquina_id);
                        // Evita duplicar opções de postos duplicados no laço
                        if (![...selectMaquinas.options].some(o => o.value == p.maquina_id)) {
                            selectMaquinas.add(opt);
                        }
                    }
                });
            }
        }
    } catch (err) { console.warn("Falha no barramento de ativos: ", err); }

    carregarTabelaRoteiros();
}

window.buscarCustoMinutoMaquina = function() {
    const select = document.getElementById('maquina_vinculada');
    if (!select) return;
    const txtSelected = select.options[select.selectedIndex]?.text;
    const campoRef = document.getElementById('custo_ref_maquina');
    
    if (campoRef && txtSelected) {
        if (txtSelected.includes('R$ ')) {
            campoRef.value = parseFloat(txtSelected.split('R$ ')[1]).toFixed(4);
        } else {
            campoRef.value = "0.4500"; // Fallback didático padrão de fábrica
        }
    }
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
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 07: ENGENHARIA DE PROCESSOS
   PARTE 3 DE 3 - SELEÇÃO DIDÁTICA E PIPELINE CRUD REATIVO
   ========================================================================== */

window.dispararSelecaoProdutoDidatico = function() {
    const prodChave = document.getElementById('seletor_produto_base').value;
    const seletorOp = document.getElementById('seletor_operacao_didatica');
    if (!seletorOp) return;
    
    seletorOp.innerHTML = '<option value="">-- Escolha a Fase de Fabricação --</option>';
    const item = PRODUTOS_DIDATICOS[prodChave];
    if (item) {
        item.operacoes.forEach(o => { seletorOp.add(new Option(`Op. ${o.seq} - ${o.nome}`, o.seq)); });
    }
    window.limparFormularioProcessos();
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
        document.getElementById('custo_ref_maquina').value = op.custo_maq.toFixed(4);
        window.calcularCustoOperacao();
    }
};

async function carregarTabelaRoteiros() {
    try {
        const resProcessos = await fetch('/api/processos/listar');
        const tbody = document.getElementById('tabela_processos');
        if (!resProcessos.ok || !tbody) return;
        
        const processos = await resProcessos.json();
        if (processos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum roteiro cadastrado no Supabase.</td></tr>`;
            return;
        }

        tbody.innerHTML = processos.map(p => `
            <tr class="hover:bg-gray-50 border-b text-[11px]">
                <td class="p-3"><strong>Op. # ${p.sequencia_op}</strong><br><span class="text-blue-900 font-bold">${p.nome_operacao}</span><br><small style="color:#64748b;">Item: ${p.produto_base || 'Geral'}</small></td>
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

window.limparFormularioProcessos = function() {
    document.getElementById('nome_operacao').value = '';
    document.getElementById('tempo_setup').value = '10.0';
    document.getElementById('tempo_operacao').value = '2.5';
    document.getElementById('custo_ref_maquina').value = '0.0000';
    document.getElementById('sequencia_op').value = '10';
    document.getElementById('custo_total_operacao').value = '';
};
