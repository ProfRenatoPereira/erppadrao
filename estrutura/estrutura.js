// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
// PARTE 1 DE 5 - CONFIGURAÇÃO DE ACESSIBILIDADE WCAG E GATILHOS DE ENTRADA
// ==========================================================================

let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
    
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
    document.getElementById('valor_condominio')?.addEventListener('input', calcularPrecoMercadoRefletido);
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
    
    const elementos = document.querySelectorAll("p, label, input, select, th, td, h1, h2, h3, h4, span, button, a");
    elementos.forEach(el => {
        el.style.setProperty('font-size', (tamanhoFonteAtual - 3) + 'px', 'important');
    });
}

function alternarModoEscuro() { 
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Modo Claro" : "🌙 Modo Escuro";
}

function alternarAltoContraste() { 
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
    }
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Módulo imobiliário aberto. Gerencie contratos de alocação.");
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
// PARTE 2 DE 5 - ALGORITMO DE EQUAÇÕES DA RMC E INVESTIMENTOS IMOBILIÁRIOS
// ==========================================================================

function calcularPrecoMercadoRefletido() {
    const cidade = document.getElementById('cidade')?.value;
    const bairro = document.getElementById('bairro')?.value;
    const area = parseFloat(document.getElementById('area_util')?.value) || 0;
    
    if (area <= 0) {
        if (document.getElementById('valor_aluguel')) document.getElementById('valor_aluguel').value = "0.00";
        if (document.getElementById('taxa_anual')) document.getElementById('taxa_anual').value = "0.00";
        return;
    }
    
    let precoM2Locacao = 22.00;
    if (cidade === "Curitiba") {
        if (bairro === "Centro") precoM2Locacao = 30.00;
        else if (bairro === "Boqueirão") precoM2Locacao = 25.00;
        else if (bairro === "CIC") precoM2Locacao = 23.50;
    } else if (cidade === "São José dos Pinhais") precoM2Locacao = 21.00;
    else if (cidade === "Pinhais") precoM2Locacao = 21.50;
    else if (cidade === "Araucária") precoM2Locacao = 20.00;
    else if (cidade === "Campo Largo") precoM2Locacao = 19.50;

    const valorAluguelMensal = area * precoM2Locacao;
    const taxaAnualEstimada = area * 4.50; 
    
    if (document.getElementById('valor_aluguel')) document.getElementById('valor_aluguel').value = valorAluguelMensal.toFixed(2);
    if (document.getElementById('taxa_anual')) document.getElementById('taxa_anual').value = taxaAnualEstimada.toFixed(2);

    const inputReserva = document.getElementById('reserva_propria');
    if (inputReserva && (!inputReserva.value || inputReserva.value === "0" || inputReserva.value === "0.00")) {
        inputReserva.value = valorAluguelMensal.toFixed(2);
    }
    calcularEngenhariaPatrimonial();
}

function calcularEngenhariaPatrimonial() {
    const cidade = document.getElementById('cidade')?.value;
    const area = parseFloat(document.getElementById('area_util')?.value) || 0;
    const aluguelCalculado = parseFloat(document.getElementById('valor_aluguel')?.value) || 0;
    const reservaMensal = parseFloat(document.getElementById('reserva_propria')?.value) || 0;

    if (area <= 0) return;

    let valorM2Venda = 6289.00; 
    if (cidade === "Curitiba") valorM2Venda = 9078.00; 
    else if (cidade === "Pinhais" || cidade === "Araucária") valorM2Venda = 6850.00;
    else if (cidade === "Campo Largo") valorM2Venda = 5900.00;

    const valorMercadoRealAtivo = area * valorM2Venda;
    const correcaoIgpmanual = reservaMensal * (1 + 0.045);
    const taxaCapitalizacaoMensal = valorMercadoRealAtivo > 0 ? (aluguelCalculado / valorMercadoRealAtivo) * 100 : 0;
    const tempoMesesAquisicao = reservaMensal > 0 ? Math.ceil(valorMercadoRealAtivo / reservaMensal) : 0;

    if (document.getElementById('txt_igpm_correcao')) document.getElementById('txt_igpm_correcao').innerText = correcaoIgpmanual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + "/ano";
    if (document.getElementById('txt_valor_mercado_real')) document.getElementById('txt_valor_mercado_real').innerText = valorMercadoRealAtivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (document.getElementById('txt_tempo_meses')) document.getElementById('txt_tempo_meses').innerText = `${tempoMesesAquisicao} meses`;
    if (document.getElementById('txt_taxa_capitalizacao')) document.getElementById('txt_taxa_capitalizacao').innerText = `${taxaCapitalizacaoMensal.toFixed(2)}% a.m.`;
}

function calcularPreviaSalario() {
    const select = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    const inputPrevia = document.getElementById('previa_salario');
    
    if (!select || !qtdInput || !inputPrevia) return;
    const option = select.options[select.selectedIndex];
    if (!select.value || !option) {
        inputPrevia.value = "R$ 0,00";
        return;
    }
    const salario = parseFloat(option.getAttribute('data-salario')) || 0;
    const qtd = parseInt(qtdInput.value) || 0;
    inputPrevia.value = (qtd <= 0) ? "R$ 0,00" : (salario * qtd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
// PARTE 3 DE 5 - MATRIZ DE CONSOLIDAÇÃO DOS ENCARGOS OPERACIONAIS GERAIS
// ==========================================================================

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Falha na comunicação.");
        const metricas = await resMetricas.json();
        
        await carregarTabelaImoveis();
        await carregarTabelaColaboradores();
        
        let custoAlugueisReal = 0;
        document.querySelectorAll('#tabela_imoveis tr').forEach(linha => {
            if (linha.cells.length > 3) {
                const valor = parseFloat(linha.cells[3].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
                custoAlugueisReal += valor;
            }
        });

        let custoFolhaRHReal = 0;
        document.querySelectorAll('#tabela_colaboradores tr').forEach(linha => {
            if (linha.cells.length > 4) {
                const valor = parseFloat(linha.cells[4].innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
                custoFolhaRHReal += valor;
            }
        });

        const capitalMaster = 5000000.00;
        const budgetMaximoSetor = capitalMaster * 0.40;
        const custoFixoSetorAtual = custoAlugueisReal + custoFolhaRHReal; 
        const custosFixosOutrosSetores = metricas.custos_fixos_outros_setores || 0;
        const custoFixoGeralEmpresaTotal = custosFixosOutrosSetores + custoFixoSetorAtual;

        let porcCapital = (custoFixoSetorAtual / capitalMaster) * 100;
        let porcFixo = custoFixoGeralEmpresaTotal > 0 ? (custoFixoSetorAtual / custoFixoGeralEmpresaTotal) * 100 : 0;
        let porcBudget = Math.min(100, (custoFixoSetorAtual / budgetMaximoSetor) * 100);

        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = capitalMaster.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_giro_global')) document.getElementById('top_giro_global').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_budget_inicial')) document.getElementById('top_budget_inicial').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_budget_saldo')) document.getElementById('top_budget_saldo').innerText = (budgetMaximoSetor - custoFixoSetorAtual).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_patrimonio_setor')) document.getElementById('top_patrimonio_setor').innerText = custoAlugueisReal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_custo_fixo_setor_head')) document.getElementById('top_custo_fixo_setor_head').innerText = custoFixoSetorAtual.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + "/mês";
        
        if(document.getElementById('txt_porcentagem_setor_imob')) {
            document.getElementById('txt_porcentagem_setor_imob').innerText = `➔ Custos Totais: ${porcCapital.toFixed(2)}% | Custos Fixos: ${porcFixo.toFixed(1)}%`;
        }

        const txtBudget = document.getElementById('top_budget_setor');
        const barraProgresso = document.getElementById('barra_progresso_budget');
        const txtPorcentagem = document.getElementById('txt_porcentagem_budget');
        
        if (txtBudget) txtBudget.innerText = `${custoFixoSetorAtual.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} / ${budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`;
        if (barraProgresso) barraProgresso.style.width = `${porcBudget}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${porcBudget.toFixed(1)}% do teto consumido`;

        if(document.getElementById('top_custo_fixo_geral_empresa')) document.getElementById('top_custo_fixo_geral_empresa').innerText = custoFixoGeralEmpresaTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + "/mês";
        if(document.getElementById('custo_fixo_geral_total_valor')) document.getElementById('custo_fixo_geral_total_valor').innerText = custoFixoGeralEmpresaTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + "/mês";
        if(document.getElementById('custo_fixo_setor_valor')) document.getElementById('custo_fixo_setor_valor').innerText = custoFixoSetorAtual.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + "/mês";
        
        if(document.getElementById('txt_proporcao_global_empresa')) document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Proporção deste Setor frente à Empresa: ${porcFixo.toFixed(2)}%`;
        if(document.getElementById('custo_fixo_geral_total_detalhes')) document.getElementById('custo_fixo_geral_total_detalhes').innerText = `→ Proporção Global: O Setor representa ${porcFixo.toFixed(2)}% de toda a Folha Corporativa Fixa.`;
        if(document.getElementById('custo_fixo_setor_detalhes')) document.getElementById('custo_fixo_setor_detalhes').innerText = `→ Custos Totais: ${porcCapital.toFixed(3)}% | Custos Fixos Setoriais: ${porcFixo.toFixed(2)}%`;
        
        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = metricas.nome_empresa || "EQUIPE LOGADA";
    } catch (err) { console.error(err); }
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
// PARTE 4 DE 5 - REQUISIÇÕES ASSÍNCRONAS DE RENDERIZAÇÃO DE PLANILHAS (GET)
// ==========================================================================

async function carregarTabelaImoveis() {
    try {
        const res = await fetch('/api/estrutura/imoveis');
        const imoveis = await res.json();
        const tbody = document.getElementById('tabela_imoveis');
        if (!tbody) return;
        
        if (!imoveis || imoveis.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding:16px; text-align:center; color:#94a3b8; font-weight:bold;">Nenhum espaço alocado no Supabase para este grupo.</td></tr>`;
            return;
        }
        tbody.innerHTML = imoveis.map(i => `
            <tr>
                <td style="font-weight:900; color:#1e3a8a;">${i.nome_empresa}</td>
                <td><strong>${i.tipo_imovel}</strong><br><span style="font-size:11px; color:#94a3b8;">${i.regiao}</span></td>
                <td style="font-family:monospace; font-weight:bold;">${i.area_util} m²</td>
                <td style="color:#1e3a8a; font-weight:800;">R$ ${(i.valor_aluguel || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="btn-top" style="background-color:#fffbec; color:#b45309;" onclick="editarImovel(${i.id})">Editar</button>
                    <button type="button" class="btn-top" style="background-color:#fef2f2; color:#dc2626;" onclick="deletarImovel(${i.id})">Rescindir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}

async function carregarTabelaColaboradores() {
    try {
        const res = await fetch('/api/estrutura/rh');
        const colaboradores = await res.json();
        const tbody = document.getElementById('tabela_colaboradores');
        if (!tbody) return;
        
        if (!colaboradores || colaboradores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:16px; text-align:center; color:#94a3b8; font-weight:bold;">MÁSCARA ZERO: Nenhum colaborador alocado neste setor.</td></tr>`;
            return;
        }
        tbody.innerHTML = colaboradores.map(c => `
            <tr>
                <td style="font-weight:800; color:#334155;">👤 ${c.nome}</td>
                <td style="font-weight:700;">👷 ${c.cargo}</td>
                <td>R$ ${(c.salario_base || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center; font-weight:bold;">${c.quantidade}</td>
                <td style="color:#4338ca; font-weight:bold;">R$ ${(c.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button type="button" class="btn-top" style="background-color:#fffbec; color:#b45309;" onclick="editarColaborador(${c.id})">Editar</button>
                    <button type="button" class="btn-top" style="background-color:#fef2f2; color:#dc2626;" onclick="deletarColaborador(${c.id})">Demitir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS
// PARTE 5 DE 5 - COMANDOS DE PERSISTÊNCIA POST/DELETE E CORREÇÃO DE SELECTS
// ==========================================================================

async function salvarImovel(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: "Taxa Anual Prevista: R$ " + (document.getElementById('taxa_anual')?.value || "0.00")
    };
    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            limparFormularioImobiliario();
            await carregarDadosIniciais();
        }
    } catch (err) { console.error(err); }
}

async function adicionarColaborador(e) {
    if(e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('cargo_suporte');
    const option = select.options[select.selectedIndex];
    
    const dados = {
        id: document.getElementById('rh_id').value ? parseInt(document.getElementById('rh_id').value) : null,
        nome: document.getElementById('rh_nome').value.trim(),
        cargo: select.value,
        salario_base: parseFloat(option.getAttribute('data-salario')) || 0,
        quantidade: parseInt(document.getElementById('qtd_colaboradores').value) || 1
    };
    try {
        const res = await fetch('/api/estrutura/rh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            document.getElementById('formContratacaoPredial').reset();
            document.getElementById('rh_id').value = '';
            document.getElementById('previa_salario').value = "R$ 0,00";
            if (document.getElementById('btn_contratar')) document.getElementById('btn_contratar').innerText = "👥 Confirmar Registro de Funcionário";
            await carregarDadosIniciais();
        }
    } catch (err) { console.error(err); }
}

async function editarImovel(id) {
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        const i = await res.json();
        document.getElementById('imovel_id').value = i.id;
        document.getElementById('tipo_imovel').value = i.tipo_imovel;
        document.getElementById('area_util').value = i.area_util;
        document.getElementById('valor_condominio').value = i.valor_condominio;
        if (i.regiao && i.regiao.includes(" - ")) {
            const partes = i.regiao.split(" - ");
            if (document.getElementById('cidade')) document.getElementById('cidade').value = partes[0].trim();
            if (document.getElementById('bairro')) document.getElementById('bairro').value = partes[1].trim();
        }
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato";
        calcularPrecoMercadoRefletido();
    } catch (err) { console.error(err); }
}

async function editarColaborador(id) {
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`);
        const c = await res.json();
        document.getElementById('rh_id').value = c.id;
        document.getElementById('rh_nome').value = c.nome;
        document.getElementById('cargo_suporte').value = c.cargo;
        document.getElementById('qtd_colaboradores').value = c.quantidade;
        if (document.getElementById('btn_contratar')) document.getElementById('btn_contratar').innerText = "🔄 Atualizar Colaborador";
        calcularPreviaSalario();
    } catch (err) { console.error(err); }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar a rescisão legal do contrato imobiliário?')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) await carregarDadosIniciais();
    } catch (err) { console.error(err); }
}

async function deletarColaborador(id) {
    if (!confirm('Confirmar o desligamento do funcionário?')) return;
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' });
        if (res.ok) await carregarDadosIniciais();
    } catch (err) { console.error(err); }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    if (document.getElementById('imovel_id')) document.getElementById('imovel_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
}
