// erppadrao - estrutura/estrutura.js
// Script de controle do módulo de investimentos imobiliários e infraestrutura predial

let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let idEdicaoRHAtual = null; 

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
    
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
    document.getElementById('valor_condominio')?.addEventListener('input', calcularPrecoMercadoRefletido);
    
    document.getElementById('cargo_suporte')?.addEventListener('change', calcularPreviaSalario);
    document.getElementById('qtd_colaboradores')?.addEventListener('input', calcularPreviaSalario);
});

function alterarFonte(dir) {
    const dirValue = dir === '+' ? 1 : (dir === '-' ? -1 : 0);
    tamanhoFonteAtual += dirValue;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    mudarFonte(dirValue);
}

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
        const gastoSetor = metricas.custo_fixo_isolado_setor || 0;
        const custoFixoGeralEmpresa = metricas.custo_fixo_geral_empresa || 21350.00;
        const patrimonioSetor = metricas.patrimonio_isolado_setor || 0;
        
        const elementos = {
            'top_capital_total': capitalInicial.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'top_giro_global_label': budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'top_giro_global': budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'top_budget_inicial': budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'kpi-saldo-infra': budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'kpi-orcamento-inicial': budgetMaximoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'kpi-patrimonio-total': patrimonioSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            'kpi-custo-fixo-setor': gastoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês',
            'fechamento_custo_fixo_generico': custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês'
        };

        Object.keys(elementos).forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.innerText = elementos[id];
        });
        
        if(document.getElementById('kpi-teto-ativos')) 
            document.getElementById('kpi-teto-ativos').innerText = 'Global: ' + (capitalInicial * 0.40).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-custo-variavel-setor')) 
            document.getElementById('kpi-custo-variavel-setor').innerText = (metricas.custo_variavel_isolado_setor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        if(document.getElementById('kpi-custo-variavel-total')) 
            document.getElementById('kpi-custo-variavel-total').innerText = (metricas.custo_variavel_total || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/mês';
        
        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = metricas.nome_empresa || "EQUIPE LOGADA";

        let porcCapital = (gastoSetor / capitalInicial) * 100;
        let porcFixo = custoFixoGeralEmpresa > 0 ? (gastoSetor / custoFixoGeralEmpresa) * 100 : 0;
        let porcBudget = budgetMaximoSetor > 0 ? (gastoSetor / budgetMaximoSetor) * 100 : 0;
        porcBudget = Math.min(100, Math.max(0, porcBudget));

        const percentuais = {
            'txt_porcentagem_setor_imob': `➔ Custos Totais: ${porcCapital.toFixed(2)}% | Custos Fixos: ${porcFixo.toFixed(1)}%`,
            'txt_proporcao_global_empresa': `➔ Proporção deste Setor frente à Empresa: ${porcFixo.toFixed(2)}% do impacto fixo global`
        };
        
        Object.keys(percentuais).forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.innerText = percentuais[id];
        });
        
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
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum espaço alocado</td></tr>`;
            return;
        }

        tbody.innerHTML = imoveis.map(i => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 900; color: #1e3a8a;">${i.nome_empresa || 'N/A'}</td>
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
    } catch (err) { console.error('Erro ao carregar tabela de imóveis:', err); }
}
async function carregarTabelaMaquinas() {
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        const maquinas = await resMaquinas.json();
        const tbody = document.getElementById('tabela_maquinas');
        if (!tbody) return;
        
        if (!maquinas || maquinas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum equipamento adquirido</td></tr>`;
            const tags = ['consumo_energia', 'kpi-energia-mensal', 'consumo_gas', 'kpi-gas-mensal', 'consumo_agua', 'kpi-agua-mensal'];
            tags.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = id.includes('energia') ? "Consumida: 0 W" : "Consumido: 0 m³"; });
            return;
        }

        let totalWatts = 0; 
        let totalGas = 0; 
        let totalAgua = 0;

        tbody.innerHTML = maquinas.map(m => {
            // Mapeamento corrigido baseado estritamente nas colunas reais da tabela 'erp_maquinas' do Supabase
            totalWatts += parseFloat(m.potencia_watts || m.watts_consumo || 0);
            totalGas += parseFloat(m.consumo_gas_m3 || m.gas_consumo || 0);
            totalAgua += parseFloat(m.consumo_agua_m3 || m.agua_consumo || 0);

            return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="font-weight: 700;">${m.nome_equipamento || m.equipment_name || 'Equipamento'}</td>
                    <td style="color: #1e3a8a; font-weight: 800;">R$ ${(m.preco_compra || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="text-align: center;">${m.potencia_watts || m.watts_consumo || 0} W</td>
                    <td style="text-align: center;">${m.consumo_gas_m3 || m.gas_consumo || 0} m³</td>
                    <td style="color: #5b21b6; font-weight: bold;">R$ ${(m.custo_minuto_maquina || m.custo_minuto || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="text-align: center;">
                        <button type="button" onclick="deletarMaquina(${m.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Remover</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Tenta injetar os valores em todas as variações de IDs de labels possíveis da tela
        const txtEnergia = document.getElementById('consumo_energia') || document.getElementById('kpi-energia-mensal');
        const txtGas = document.getElementById('consumo_gas') || document.getElementById('kpi-gas-mensal');
        const txtAgua = document.getElementById('consumo_agua') || document.getElementById('kpi-agua-mensal');

        if (txtEnergia) txtEnergia.innerText = `Consumida: ${totalWatts.toLocaleString('pt-BR')} W`;
        if (txtGas) txtGas.innerText = `Consumido: ${totalGas.toLocaleString('pt-BR', {minimumFractionDigits: 2})} m³`;
        if (txtAgua) txtAgua.innerText = `Consumida: ${totalAgua.toLocaleString('pt-BR', {minimumFractionDigits: 2})} m³`;
    } catch (err) { console.error('Erro no somatório de utilidades:', err); }
}

async function carregarTabelaColaboradores() {
    try {
        const res = await fetch('/api/estrutura/rh');
        const colaboradores = await res.json();
        const tbody = document.getElementById('tabela_colaboradores');
        if (!tbody) return;
        
        if (!colaboradores || colaboradores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum colaborador alocado</td></tr>`;
            return;
        }

        tbody.innerHTML = colaboradores.map(c => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 700;">👷 ${c.nome || 'N/A'}</td>
                <td style="font-weight: 600;">${c.cargo}</td>
                <td style="text-align: right;">R$ ${(c.salario_base || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; font-weight: bold;">${c.quantidade}</td>
                <td style="color: #4338ca; font-weight: bold; text-align: right;">R$ ${(c.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deletarColaborador(${c.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Demitir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error('Erro ao carregar colaboradores:', err); }
}
async function calcularCustoMinutoMaquina() {
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        const maquinas = await resMaquinas.json();
        const elem = document.getElementById('kpi-custo-minuto-total');
        
        if (!elem) return;
        if (!maquinas || maquinas.length === 0) {
            elem.innerText = 'R$ 0,00/min';
            return;
        }
        
        const totalCustoMinuto = maquinas.reduce((sum, m) => sum + (m.custo_minuto || m.custo_minuto_maquina || 0), 0);
        elem.innerText = totalCustoMinuto.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/min';
    } catch (err) { console.error('Erro ao calcular custo minuto:', err); }
}

async function salvarImovel(e) {
    if(e && e.preventDefault) e.preventDefault();
    const equipeId = sessionStorage.getItem('equipe_id') || "EQUIPE_PADRAO";
    const deptAtual = window.location.pathname.replace('/', '') || 'estrutura';
    
    const dados = {
        equipe_id: equipeId,
        dept: deptAtual,
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: "Taxa Anual: R$ " + (document.getElementById('taxa_anual')?.value || "0.00")
    };

    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            limparFormularioImobiliario();
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Contrato salvo!");
        } else { alert("❌ Erro ao salvar contrato."); }
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

    const equipeId = sessionStorage.getItem('equipe_id') || "EQUIPE_PADRAO";
    const deptAtual = window.location.pathname.replace('/', '') || 'estrutura';

    const dados = {
        equipe_id: equipeId,
        dept: deptAtual,
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
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Equipamento adicionado!");
        } else { alert("❌ Erro ao adicionar equipamento."); }
    } catch (err) { console.error('Erro ao salvar máquina:', err); }
}
async function adicionarColaborador(e) {
    if(e && e.preventDefault) e.preventDefault();
    
    const select = document.getElementById('cargo_suporte');
    const inputQtd = document.getElementById('qtd_colaboradores');
    const option = select ? select.options[select.selectedIndex] : null;

    // Validação estrita baseada nos elementos reais do seu formulário HTML
    if (!select || !select.value) { 
        alert("❌ Por favor, escolha uma função/cargo operacional."); 
        return; 
    }
    if (!option) return;

    const equipeIdLogada = sessionStorage.getItem('id_equipe') || "equipe_alfa";
    const deptAtualizado = window.location.pathname.replace('/', '') || 'estrutura';
    const salarioBase = parseFloat(option.getAttribute('data-salario')) || 0;
    const quantidade = parseInt(inputQtd ? inputQtd.value : 1) || 1;

    // Montagem do payload adaptada para a ausência do input de nome na interface
    const dados = {
        equipe_id: equipeIdLogada,
        dept: deptAtualizado,
        nome: `Equipe de ${select.value}`, // Preenche o campo obrigatório do banco de forma elegante
        cargo: select.value, 
        salario_base: salarioBase,
        quantidade: quantidade
    };

    try {
        const res = await fetch('/api/estrutura/rh', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(dados) 
        });
        
        if (res.ok) { 
            // Reseta o formulário usando o ID exato mapeado no seu HTML
            const formPredial = document.getElementById('formContratacaoPredial');
            if (formPredial) formPredial.reset();
            
            if (document.getElementById('previa_salario')) {
                document.getElementById('previa_salario').value = "R$ 0,00";
            }
            
            // Força a atualização reativa dos KPIs do cabeçalho global e tabelas
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais(); 
            alert("🎯 Colaborador adicionado!"); 
        } else { 
            alert("❌ Erro ao adicionar colaborador (O servidor de banco de dados rejeitou o registro)."); 
        }
    } catch (err) { 
        console.error('Erro de envio no método POST de RH:', err); 
        alert("❌ Falha crítica de comunicação com o servidor Render.");
    }
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
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar";
        calcularPrecoMercadoRefletido();
    } catch (err) { console.error('Erro ao editar imóvel:', err); }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar rescisão do contrato?')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Contrato rescindido.");
        }
    } catch (err) { console.error('Erro ao deletar imóvel:', err); }
}

async function deletarMaquina(id) {
    if (!confirm('Remover este equipamento?')) return;
    try {
        const res = await fetch(`/api/estrutura/maquinas/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Equipamento removido.");
        }
    } catch (err) { console.error('Erro ao deletar máquina:', err); }
}

async function deletarColaborador(id) {
    if (!confirm('Confirmar demissão?')) return;
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Colaborador desligado.");
        }
    } catch (err) { console.error('Erro ao deletar colaborador:', err); }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    if (document.getElementById('imovel_id')) document.getElementById('imovel_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
}
