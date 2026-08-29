let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    // Carrega a malha transacional do banco de dados imediatamente
    carregarDadosIniciais();
    
    // 🧠 GATILHOS OPERACIONAIS: Vincula a readequação de preços aos inputs do formulário
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
    document.getElementById('valor_condominio')?.addEventListener('input', calcularPrecoMercadoRefletido);
});

// 📐 MOTOR DE REDIMENSIONAMENTO FORÇADO (CORRIGE O TRAVAMENTO)
function alterarFonte(dir) {
    const dirValue = dir === '+' ? 1 : (dir === '-' ? -1 : 0);
    tamanhoFonteAtual += dirValue;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    mudarFonte(dirValue);
}

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    
    // Altera o padrão proporcional na raiz do documento
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
    
    // Varre e limpa classes fixas em pixels, aplicando o tamanho dinâmico direto no DOM
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
    const btn = document.getElementById('btn-leitor');
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "📢 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
    }
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de investimentos imobiliários aberto. Utilize os seletores de região de Curitiba para simular os custos e firmar contratos de locação.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        
        utterance.onend = function() {
            leitorAtivo = false;
            if (btn) {
                btn.innerText = "📢 Ativar Leitor";
                btn.style.backgroundColor = "#0284c7";
            }
        };
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

function calcularPrecoMercadoRefletido() {
    const cidade = document.getElementById('cidade')?.value;
    const bairro = document.getElementById('bairro')?.value;
    const area = parseFloat(document.getElementById('area_util')?.value) || 0;
    
    if (area <= 0) {
        if (document.getElementById('valor_aluguel')) document.getElementById('valor_aluguel').value = "0.00";
        if (document.getElementById('taxa_anual')) document.getElementById('taxa_anual').value = "0.00";
        return;
    }
    
    let precoM2 = 22.00;
    if (cidade === "Curitiba") {
        if (bairro === "Centro") precoM2 = 30.00;
        else if (bairro === "Boqueirão") precoM2 = 25.00;
        else if (bairro === "CIC") precoM2 = 23.50;
    } else if (cidade === "São José dos Pinhais" || cidade === "Araucária" || cidade === "Pinhais") {
        precoM2 = 21.00; 
    }

    const valorAluguelMensal = area * precoM2;
    const taxaAnualEstimada = area * 4.50; 
    
    const inputAluguel = document.getElementById('valor_aluguel');
    const inputTaxaAnual = document.getElementById('taxa_anual');
    
    if (inputAluguel) inputAluguel.value = valorAluguelMensal.toFixed(2);
    if (inputTaxaAnual) inputTaxaAnual.value = taxaAnualEstimada.toFixed(2);
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
    
    if (qtd <= 0) {
        inputPrevia.value = "R$ 0,00";
        return;
    }
    
    inputPrevia.value = (salario * qtd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Falha na comunicação.");
        const metricas = await resMetricas.json();
        
        const capitalInicial = 5000000.00;
        const budgetMaximoSetor = capitalInicial * 0.40;
        
        // CORREÇÃO: Usar custo_fixo_isolado_setor (apenas ESTRUTURA) em vez de custo_fixo_total (toda empresa)
        const gastoSetor = metricas.custo_fixo_isolado_setor || 0;
        const custoFixoGeralEmpresa = metricas.custo_fixo_geral_empresa || 21350.00;
        const patrimônioSetor = metricas.patrimonio_isolado_setor || 0;
        
        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = capitalInicial.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_giro_global_label')) document.getElementById('top_giro_global_label').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_giro_global')) document.getElementById('top_giro_global').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('top_budget_inicial')) document.getElementById('top_budget_inicial').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-saldo-infra')) document.getElementById('kpi-saldo-infra').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-orcamento-inicial')) document.getElementById('kpi-orcamento-inicial').innerText = budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-patrimonio-total')) document.getElementById('kpi-patrimonio-total').innerText = patrimônioSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-teto-ativos')) document.getElementById('kpi-teto-ativos').innerText = 'Global: ' + (capitalInicial * 0.40).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-custo-fixo-setor')) document.getElementById('kpi-custo-fixo-setor').innerText = gastoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        if(document.getElementById('fechamento_custo_fixo_generico')) document.getElementById('fechamento_custo_fixo_generico').innerText = custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        if(document.getElementById('kpi-custo-variavel-setor')) document.getElementById('kpi-custo-variavel-setor').innerText = (metricas.custo_variavel_isolado_setor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        if(document.getElementById('kpi-custo-variavel-total')) document.getElementById('kpi-custo-variavel-total').innerText = (metricas.custo_variavel_total || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        if(document.getElementById('top_custo_fixo_setor')) document.getElementById('top_custo_fixo_setor').innerText = `${gastoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_fixo_geral_empresa')) document.getElementById('top_custo_fixo_geral_empresa').innerText = custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('custo_fixo_geral_total_valor')) document.getElementById('custo_fixo_geral_total_valor').innerText = custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('custo_fixo_setor_valor')) document.getElementById('custo_fixo_setor_valor').innerText = gastoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = metricas.nome_empresa || "EQUIPE LOGADA";

        let porcCapital = (gastoSetor / capitalInicial) * 100;
        let porcFixo = custoFixoGeralEmpresa > 0 ? (gastoSetor / custoFixoGeralEmpresa) * 100 : 0;
        let porcBudget = budgetMaximoSetor > 0 ? (gastoSetor / budgetMaximoSetor) * 100 : 0;
        porcBudget = Math.min(100, Math.max(0, porcBudget));

        if(document.getElementById('txt_porcentagem_setor_imob')) {
            document.getElementById('txt_porcentagem_setor_imob').innerText = `➔ Custos Totais: ${porcCapital.toFixed(2)}% | Custos Fixos: ${porcFixo.toFixed(1)}%`;
        }
        if(document.getElementById('txt_proporcao_global_empresa')) {
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Proporção deste Setor frente à Empresa: ${porcFixo.toFixed(2)}% do impacto fixo global`;
        }
        if(document.getElementById('custo_fixo_geral_total_detalhes')) {
            document.getElementById('custo_fixo_geral_total_detalhes').innerText = `→ Proporção Global: O Setor representa ${porcFixo.toFixed(2)}% de toda a Folha e Infraestrutura Corporativa`;
        }
        if(document.getElementById('custo_fixo_setor_detalhes')) {
            document.getElementById('custo_fixo_setor_detalhes').innerText = `→ Custos Totais: ${porcCapital.toFixed(3)}% | Custos Fixos Fixados: ${porcFixo.toFixed(2)}%`;
        }
        
        const txtBudget = document.getElementById('top_budget_setor');
        const barraProgresso = document.getElementById('barra-limite-setor');
        const txtPorcentagem = document.getElementById('txt_porcentagem_budget');
        const cardBudget = document.getElementById('card_budget_limite');
        
        if (txtBudget) txtBudget.innerText = `R$ ${gastoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})} / R$ ${budgetMaximoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        if (barraProgresso) barraProgresso.style.width = `${porcBudget}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${porcBudget.toFixed(1)}% do teto consumido`;
        
        if (cardBudget && barraProgresso) {
            if (gastoSetor > budgetMaximoSetor) {
                cardBudget.style.backgroundColor = "#fef2f2";
                cardBudget.style.borderColor = "#fca5a5";
                barraProgresso.style.backgroundColor = "#ef4444"; 
            } else {
                cardBudget.style.backgroundColor = "#f8fafc";
                cardBudget.style.borderColor = "#cbd5e1";
                barraProgresso.style.backgroundColor = "#3b82f6"; 
            }
        }

        await carregarTabelaImoveis();
        await carregarTabelaMaquinas();
        await carregarTabelaColaboradores();
        calcularCustoMinutoMaquina();
    } catch (err) { 
        console.error('Erro ao carregar dados iniciais:', err); 
    }
}

async function carregarTabelaImoveis() {
    try {
        const resImoveis = await fetch('/api/estrutura/imoveis');
        const imoveis = await resImoveis.json();
        const tbody = document.getElementById('tabela_imoveis');
        if (!tbody) return;
        
        if (!imoveis || imoveis.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum espaço alocado no Supabase para este grupo</td></tr>`;
            return;
        }

        tbody.innerHTML = imoveis.map(i => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 900; color: #1e3a8a;">${i.nome_empresa}</td>
                <td><strong>${i.tipo_imovel}</strong><br><span style="font-size: 11px; color: #94a3b8;">${i.regiao}</span></td>
                <td style="font-family: monospace; font-weight: bold;">${i.area_util} m²</td>
                <td style="color: #1e3a8a; font-weight: 800;">R$ ${(i.valor_aluguel || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="editarImovel(${i.id})" class="btn-top" style="background-color: #fffbec; color: #b45309; border-color: #fde68a; margin-right: 2px;">Editar</button>
                    <button type="button" onclick="deletarImovel(${i.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Rescindir</button>
                </td>
            </tr>
        `).join('');
        
        calcularPrecoMercadoRefletido();
        mudarFonte(0);
    } catch (err) { console.error('Erro ao carregar tabela de imóveis:', err); }
}

async function carregarTabelaMaquinas() {
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        const maquinas = await resMaquinas.json();
        const tbody = document.getElementById('tabela_maquinas');
        if (!tbody) return;
        
        if (!maquinas || maquinas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum equipamento adquirido ainda</td></tr>`;
            return;
        }

        tbody.innerHTML = maquinas.map(m => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 700;">${m.nome_equipamento}</td>
                <td style="color: #1e3a8a; font-weight: 800;">R$ ${(m.preco_compra || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">${m.watts_consumo || 0} W</td>
                <td style="text-align: center;">${m.gas_consumo || 0} m³</td>
                <td style="color: #5b21b6; font-weight: bold;">R$ ${(m.custo_minuto || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deletarMaquina(${m.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Remover</button>
                </td>
            </tr>
        `).join('');
        mudarFonte(0);
    } catch (err) { console.error('Erro ao carregar tabela de máquinas:', err); }
}

async function carregarTabelaColaboradores() {
    try {
        const res = await fetch('/api/estrutura/rh');
        const colaboradores = await res.json();
        const tbody = document.getElementById('tabela_colaboradores');
        if (!tbody) return;
        
        if (!colaboradores || colaboradores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">MÁSCARA ZERO: Nenhum colaborador alocado neste setor</td></tr>`;
            return;
        }

        tbody.innerHTML = colaboradores.map(c => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 700;">👷 ${c.nome}</td>
                <td style="font-weight: 600;">${c.cargo}</td>
                <td style="text-align: right;">R$ ${(c.salario_base || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; font-weight: bold;">${c.quantidade}</td>
                <td style="color: #4338ca; font-weight: bold; text-align: right;">R$ ${(c.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deletarColaborador(${c.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Demitir</button>
                </td>
            </tr>
        `).join('');
        mudarFonte(0);
    } catch (err) { console.error('Erro ao carregar tabela de colaboradores:', err); }
}

async function calcularCustoMinutoMaquina() {
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        const maquinas = await resMaquinas.json();
        
        if (!maquinas || maquinas.length === 0) {
            const elem = document.getElementById('kpi-custo-minuto-total');
            if (elem) elem.innerText = 'R$ 0,00/min';
            return;
        }
        
        const totalCustoMinuto = maquinas.reduce((sum, m) => sum + (m.custo_minuto || 0), 0);
        const elem = document.getElementById('kpi-custo-minuto-total');
        if (elem) elem.innerText = totalCustoMinuto.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/min';
    } catch (err) { 
        console.error('Erro ao calcular custo minuto máquina:', err); 
    }
}

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
            carregarDadosIniciais();
            alert("🎯 Contrato de alocação processado e salvo!");
        } else {
            alert("❌ Erro ao salvar contrato. Verifique os dados.");
        }
    } catch (err) { console.error('Erro ao salvar imóvel:', err); }
}

async function salvarMaquina(e) {
    if(e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('seletor_equipamento');
    const option = select.options[select.selectedIndex];
    
    if (!option || !option.value) {
        alert("❌ Selecione um equipamento válido.");
        return;
    }
    
    const dados = {
        nome_equipamento: option.value,
        preco_compra: parseFloat(option.getAttribute('data-preco')) || 0,
        watts_consumo: parseFloat(option.getAttribute('data-watts')) || 0,
        gas_consumo: parseFloat(option.getAttribute('data-gas')) || 0,
        agua_consumo: parseFloat(option.getAttribute('data-agua')) || 0,
        depreciacao_anos: parseInt(option.getAttribute('data-dep')) || 10,
        custo_minuto: parseFloat(option.getAttribute('data-min')) || 0
    };

    try {
        const res = await fetch('/api/estrutura/maquinas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            document.getElementById('formMaquinas').reset();
            carregarDadosIniciais();
            alert("🎯 Equipamento adicionado ao patrimônio do setor!");
        } else {
            alert("❌ Erro ao adicionar equipamento.");
        }
    } catch (err) { console.error('Erro ao salvar máquina:', err); }
}

async function adicionarColaborador(e) {
    if(e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('cargo_suporte');
    const option = select.options[select.selectedIndex];
    
    const dados = {
        nome: document.getElementById('rh_nome').value,
        cargo: select.value,
        salario_base: parseFloat(option.getAttribute('data-salario')) || 0,
        quantidade: parseInt(document.getElementById('qtd_colaboradores').value) || 0
    };

    try {
        const res = await fetch('/api/estrutura/rh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            document.getElementById('formContratacaoPredial').reset();
            document.getElementById('previa_salario').value = "R$ 0,00";
            carregarDadosIniciais();
            alert("🎯 Colaborador adicionado à folha fixa do setor!");
        } else {
            alert("❌ Erro ao adicionar colaborador.");
        }
    } catch (err) { console.error('Erro ao salvar colaborador:', err); }
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
            if (document.getElementById('cidade')) document.getElementById('cidade').value = partes[0];
            if (document.getElementById('bairro')) document.getElementById('bairro').value = partes[1];
        }
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato Ativo";
        if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'inline-block';
        calcularPrecoMercadoRefletido();
        mudarFonte(0);
    } catch (err) { console.error('Erro ao editar imóvel:', err); }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar a rescisão legal do contrato imobiliário?')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
            alert("🎯 Contrato rescindido com sucesso.");
        } else {
            alert("❌ Erro ao deletar contrato.");
        }
    } catch (err) { console.error('Erro ao deletar imóvel:', err); }
}

async function deletarMaquina(id) {
    if (!confirm('Remover este equipamento do patrimônio?')) return;
    try {
        const res = await fetch(`/api/estrutura/maquinas/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
            alert("🎯 Equipamento removido do setor.");
        } else {
            alert("❌ Erro ao remover equipamento.");
        }
    } catch (err) { console.error('Erro ao deletar máquina:', err); }
}

async function deletarColaborador(id) {
    if (!confirm('Confirmar a demissão do colaborador do suporte predial?')) return;
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
            alert("🎯 Colaborador desligado da folha fixa.");
        } else {
            alert("❌ Erro ao desligar colaborador.");
        }
    } catch (err) { console.error('Erro ao deletar colaborador:', err); }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    if (document.getElementById('imovel_id')) document.getElementById('imovel_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
    if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'none';
}
