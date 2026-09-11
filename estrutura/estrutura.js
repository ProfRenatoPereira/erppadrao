// ==========================================================================
 // TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
 // ARQUIVO: estrutura.js - PARTE 1 DE 3 (ACESSIBILIDADE E ENGENHARIA IMOBILIÁRIA)
 // ==========================================================================
 
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let idEdicaoRHAtual = null; 

document.addEventListener("DOMContentLoaded", function() {
    "use strict";
    carregarDadosIniciais();
    
    // Listeners do Bloco de Alocação de Espaço Físico
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
    document.getElementById('valor_condominio')?.addEventListener('input', calcularPrecoMercadoRefletido);
    
    // Listeners do Bloco de Apoio Predial / RH
    document.getElementById('cargo_suporte')?.addEventListener('change', calcularPreviaSalario);
    document.getElementById('qtd_colaboradores')?.addEventListener('input', calcularPreviaSalario);
    
    // Listener do Botão do Leitor de Áudio
    document.getElementById('btn-leitor')?.addEventListener('click', alternarLeitorAudio);
    document.getElementById('formDecisaoAquisicao')?.addEventListener('submit', analisarDecisaoAquisicao);
});

/* ==========================================================================
   SISTEMA DE ACESSIBILIDADE CORE (WCAG)
   ========================================================================== */
function alterarFonte(dir) {
    "use strict";
    const passo = dir === '+' ? 1 : (dir === '-' ? -1 : 0);
    tamanhoFonteAtual += passo;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
    
    const elementos = document.querySelectorAll("p, label, input, select, th, td, h1, h2, h3, h4, span, button, a");
    elementos.forEach(el => {
        el.style.setProperty('font-size', (tamanhoFonteAtual - 3) + 'px', 'important');
    });
}

function alternarModoEscuro() { 
    "use strict";
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
}

function alternarAltoContraste() { 
    "use strict";
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarLeitorAudio() {
    "use strict";
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor');
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "📢 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
        btn.setAttribute('aria-pressed', leitorAtivo ? 'true' : 'false');
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
                btn.setAttribute('aria-pressed', 'false');
            }
        };
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

/* ==========================================================================
   REGRAS DE NEGÓCIO: ENGENHARIA IMOBILIÁRIA REATIVA
   ========================================================================== */
function calcularPrecoMercadoRefletido() {
    "use strict";
    const cidade = document.getElementById('cidade')?.value || "Curitiba";
    const bairro = document.getElementById('bairro')?.value || "CIC";
    const area = parseFloat(document.getElementById('area_util')?.value) || 0;
    
    if (area <= 0) {
        if (document.getElementById('valor_aluguel')) document.getElementById('valor_aluguel').value = "0.00";
        if (document.getElementById('taxa_anual')) document.getElementById('taxa_anual').value = "0.00";
        return;
    }
    
    let precoM2 = 23.50; // Padrão CIC
    if (cidade === "Curitiba" && bairro === "Centro") {
        precoM2 = 30.00;
    } else if (cidade === "Curitiba" && bairro === "Boqueirão") {
        precoM2 = 25.00;
    }

    const valorAluguelMensal = area * precoM2;
    const taxaAnualEstimada = area * 4.50; 
    
    const inputAluguel = document.getElementById('valor_aluguel');
    const inputTaxaAnual = document.getElementById('taxa_anual');
    
    if (inputAluguel) inputAluguel.value = valorAluguelMensal.toFixed(2);
    if (inputTaxaAnual) inputTaxaAnual.value = taxaAnualEstimada.toFixed(2);

    // Mosaico Contábil Pedagógico (Cálculos Avançados de Mercado)
    const txtIgpm = document.getElementById('txt_igpm_correcao');
    const txtValorMercado = document.getElementById('txt_valor_mercado_real');
    const txtTaxaCapitalizacao = document.getElementById('txt_taxa_capitalizacao');
    const txtTempoMeses = document.getElementById('txt_tempo_meses');

    const projecaoIgpm = valorAluguelMensal * 1.0425; // Simulação IPCA/IGPM didático
    const valorVenalVenha = valorAluguelMensal / 0.0055; // 0.55% Cap Rate padrão

    if (txtIgpm) txtIgpm.innerText = projecaoIgpm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (txtValorMercado) txtValorMercado.innerText = valorVenalVenha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (txtTaxaCapitalizacao) txtTaxaCapitalizacao.innerText = "0.55% a.m.";
    if (txtTempoMeses) txtTempoMeses.innerText = "120 meses";
}
// ==========================================================================
 // TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
 // ARQUIVO: estrutura.js - PARTE 2 DE 3 (MOTOR DE RH E ENGENHARIA DE KPIS)
 // ==========================================================================
 
/* ==========================================================================
   REGRAS DE NEGÓCIO: APOIO PREDIAL & ENCARGOS TRABALHISTAS (CLT)
   ========================================================================== */
function calcularPreviaSalario() {
    "use strict";
    const select = document.getElementById('cargo_suporte');
    const inputSalario = document.getElementById('rh_salario');
    const inputAdicionais = document.getElementById('rh_adicionais');
    const inputEncargos = document.getElementById('rh_encargos');
    const inputCustoTotal = document.getElementById('rh_custo_total');
    const inputPrevia = document.getElementById('previa_salario');
    const qtdInput = document.getElementById('qtd_colaboradores');
    
    if (!select || !inputSalario || !inputAdicionais || !inputEncargos || !inputCustoTotal || !inputPrevia || !qtdInput) return;
    
    const option = select.options[select.selectedIndex];
    const quantidade = parseInt(qtdInput.value) || 1;

    if (!select.value || !option || quantidade <= 0) {
        inputSalario.value = "0.00";
        inputAdicionais.value = "0.00";
        inputEncargos.value = "0.00";
        inputCustoTotal.value = "0.00";
        inputPrevia.value = "R$ 0,00";
        return;
    }
    
    const salarioBaseUnitario = parseFloat(option.getAttribute('data-salario')) || 0;
    const periculosidadePct = parseFloat(option.getAttribute('data-periculosidade')) || 0;
    const insalubridadePct = parseFloat(option.getAttribute('data-insalubridade')) || 0;
    
    // Cálculo de Adicionais sobre a base contratual por vaga
    let adicionaisUnitario = 0;
    if (periculosidadePct > 0) {
        adicionaisUnitario += salarioBaseUnitario * (periculosidadePct / 100);
    }
    if (insalubridadePct > 0) {
        adicionaisUnitario += salarioBaseUnitario * (insalubridadePct / 100);
    }
    
    const baseCalculoEncargos = salarioBaseUnitario + adicionaisUnitario;
    const encargosSociaisUnitario = baseCalculoEncargos * 0.68; // Alíquota padrão do ERP (68%)
    const custoMensalUnitario = baseCalculoEncargos + encargosSociaisUnitario;
    
    // Multiplicação pelo volume de vagas alocadas
    const subtotalSalarioBase = salarioBaseUnitario * quantidade;
    const subtotalAdicionais = adicionaisUnitario * quantidade;
    const subtotalEncargos = encargosSociaisUnitario * quantidade;
    const custoMensalTotalGeral = custoMensalUnitario * quantidade;
    
    inputSalario.value = subtotalSalarioBase.toFixed(2);
    inputAdicionais.value = subtotalAdicionais.toFixed(2);
    inputEncargos.value = subtotalEncargos.toFixed(2);
    inputCustoTotal.value = custoMensalTotalGeral.toFixed(2);
    
    inputPrevia.value = custoMensalTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ==========================================================================
   CARREGADOR MESTRE: CONSOLIDAÇÃO ASSÍNCRONA DE ATIVOS E REGRAS DE TETOS
   ========================================================================== */
async function carregarDadosIniciais() {
    "use strict";
    try {
        const [resOrcamento, resMetricas] = await Promise.all([
            fetch('/api/estrutura/orcamento'),
            fetch('/api/financeiro/metricas?dept=estrutura')
        ]);

        if (!resOrcamento.ok) throw new Error("Falha ao carregar capital e quota de Estrutura.");
        if (!resMetricas.ok) throw new Error("Falha na sincronização das métricas financeiras.");

        const orcamento = await resOrcamento.json();
        const metricas = await resMetricas.json();

        const capitalInicial = Number(orcamento.capital_inicial) || 0;
        const porcentagemEstrutura = Number(orcamento.porcentagem_estrutura) || 0;
        const valorAlocadoEstrutura = Number(orcamento.valor_alocado_estrutura) || 0;
        const patrimonioSetor = Number(orcamento.patrimonio_atual_estrutura) || 0;
        const saldoAquisicoes = Number(orcamento.saldo_disponivel_aquisicoes) || 0;
        const gastoSetor = Number(metricas.custo_fixo_isolado_setor) || 0;
        const custoFixoGeralEmpresa = Number(metricas.custo_fixo_geral_empresa) || 0;
        const custoVariavelSetor = Number(metricas.custo_variavel_isolado_setor) || 0;
        const custoVariavelTotal = Number(metricas.custo_variavel_total) || 0;

        const brl = valor => Number(valor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        const pct = valor => `${Number(valor || 0).toFixed(2)}%`;

        const elementos = {
            'top_capital_total': brl(capitalInicial),
            'top_giro_global_label': brl(valorAlocadoEstrutura),
            'top_giro_global': brl(valorAlocadoEstrutura),
            'top_budget_inicial': brl(valorAlocadoEstrutura),
            'kpi-saldo-infra': brl(saldoAquisicoes),
            'kpi-orcamento-inicial': brl(valorAlocadoEstrutura),
            'kpi-patrimonio-total': brl(patrimonioSetor),
            'kpi-custo-fixo-setor': brl(gastoSetor) + '/mês',
            'fechamento_custo_fixo_generico': brl(custoFixoGeralEmpresa) + '/mês',
            'kpi-custo-variavel-setor': brl(custoVariavelSetor) + '/mês',
            'kpi-custo-variavel-total': brl(custoVariavelTotal) + '/mês'
        };

        Object.keys(elementos).forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.innerText = elementos[id];
        });

        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = orcamento.nome_empresa || metricas.nome_empresa || "EQUIPE LOGADA";

        const labelQuota = document.getElementById('txt_porcentagem_setor_imob');
        if (labelQuota) labelQuota.innerText = `➔ Quota endereçada: ${pct(porcentagemEstrutura)} do capital inicial`;

        const labelQuotaInicial = document.getElementById('txt_porcentagem_orcamento_estrutura');
        if (labelQuotaInicial) labelQuotaInicial.innerText = `➔ ${pct(porcentagemEstrutura)} do capital inicial`;

        if (document.getElementById('kpi-teto-ativos')) {
            document.getElementById('kpi-teto-ativos').innerText = `Quota: ${brl(valorAlocadoEstrutura)}`;
        }

        const impactoFixo = custoFixoGeralEmpresa > 0 ? (gastoSetor / custoFixoGeralEmpresa) * 100 : 0;
        const labelImpacto = document.getElementById('txt_proporcao_global_empresa');
        if (labelImpacto) labelImpacto.innerText = `➔ Impacto do Setor: ${impactoFixo.toFixed(2)}% do impacto fixo global`;

        const txtBudget = document.getElementById('top_budget_setor');
        const barraProgresso = document.getElementById('barra-limite-setor');
        const txtPorcentagem = document.getElementById('txt_porcentagem_budget');
        const cardBudget = document.getElementById('card_budget_limite');
        const percentualPatrimonio = valorAlocadoEstrutura > 0 ? Math.min(100, Math.max(0, (patrimonioSetor / valorAlocadoEstrutura) * 100)) : 0;

        if (txtBudget) txtBudget.innerText = `${brl(patrimonioSetor)} / ${brl(valorAlocadoEstrutura)}`;
        if (barraProgresso) barraProgresso.style.width = `${percentualPatrimonio}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${percentualPatrimonio.toFixed(1)}% da quota patrimonial consumida`;

        if (cardBudget && barraProgresso) {
            cardBudget.style.backgroundColor = percentualPatrimonio > 100 ? "#fef2f2" : "#f8fafc";
            cardBudget.style.borderColor = percentualPatrimonio > 100 ? "#fca5a5" : "#cbd5e1";
            barraProgresso.style.backgroundColor = percentualPatrimonio > 100 ? "#ef4444" : "#3b82f6";
        }

        const decisaoCapital = document.getElementById('decisao_capital_inicial');
        if (decisaoCapital) decisaoCapital.innerText = brl(capitalInicial);

        const decisaoSaldo = document.getElementById('decisao_saldo_disponivel');
        if (decisaoSaldo) decisaoSaldo.innerText = brl(saldoAquisicoes);

        const decisaoQuota = document.getElementById('decisao_quota_percentual');
        if (decisaoQuota) decisaoQuota.innerText = pct(porcentagemEstrutura);

        const decisaoAlocado = document.getElementById('decisao_valor_alocado');
        if (decisaoAlocado) decisaoAlocado.innerText = brl(valorAlocadoEstrutura);

        const decisaoPatrimonio = document.getElementById('decisao_patrimonio_atual');
        if (decisaoPatrimonio) decisaoPatrimonio.innerText = brl(patrimonioSetor);

        await carregarTabelaImoveis();
        await carregarTabelaUtensilios();
        await carregarTabelaColaboradores();
        await calcularCustoMinutoUtensilio();
    } catch (err) {
        console.error('Erro ao processar painel de Estrutura:', err);
    }
}

async function analisarDecisaoAquisicao(e) {
    "use strict";
    if (e && e.preventDefault) e.preventDefault();

    const input = document.getElementById('decisao_valor_aquisicao');
    const resultado = document.getElementById('decisao_resultado');
    const detalhe = document.getElementById('decisao_detalhe');
    const valor = Number(String(input?.value || '0').replace(',', '.')) || 0;

    if (valor <= 0) {
        if (resultado) resultado.innerText = 'INFORME UM VALOR';
        if (detalhe) detalhe.innerText = 'Digite o valor estimado da aquisição para iniciar a análise.';
        return;
    }

    try {
        const res = await fetch('/api/estrutura/decisao_aquisicao', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({valor_aquisicao: valor})
        });
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.message || 'Falha na análise.');

        if (resultado) resultado.innerText = dados.decisao;
        if (detalhe) {
            detalhe.innerText = `${dados.motivo} Saldo atual: ${formatarBRL(dados.saldo_disponivel_aquisicoes)} | Após a aquisição: ${formatarBRL(dados.saldo_apos_aquisicao)}.`;
        }
    } catch (err) {
        console.error('Erro na análise de aquisição:', err);
        if (resultado) resultado.innerText = 'ERRO';
        if (detalhe) detalhe.innerText = err.message;
    }
}

function formatarBRL(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

// ==========================================================================
 // TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
 // ARQUIVO: estrutura.js - PARTE 3A DE 3 (RENDERIZAÇÃO DE TABELAS PARTE 1)
 // ==========================================================================
 
async function carregarTabelaImoveis() {
    "use strict";
    try {
        const resImoveis = await fetch('/api/estrutura/imoveis');
        if (!resImoveis.ok) {
            console.warn('Resposta /api/estrutura/imoveis não OK', resImoveis.status);
            document.getElementById('tabela_imoveis').innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Erro ao carregar espaços patrimoniais</td></tr>`;
            return;
        }
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
    } catch (err) { 
        console.error('Erro ao carregar tabela de imóveis:', err); 
    }
}

async function carregarTabelaUtensilios() {
    "use strict";
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        if (!resMaquinas.ok) {
            document.getElementById('tabela_utensilios').innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Erro ao carregar utensílios</td></tr>`;
            return;
        }
        const maquinas = await resMaquinas.json();
        const tbody = document.getElementById('tabela_utensilios'); // Alinhado ao novo DOM
        if (!tbody) return;
        
        if (!maquinas || maquinas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum utensílio adquirido</td></tr>`;
            if (document.getElementById('kpi-energia-mensal')) document.getElementById('kpi-energia-mensal').innerText = "0 W";
            if (document.getElementById('kpi-gas-mensal')) document.getElementById('kpi-gas-mensal').innerText = "0 m³";
            if (document.getElementById('kpi-agua-mensal')) document.getElementById('kpi-agua-mensal').innerText = "0 m³";
            return;
        }

        let totalWatts = 0;
        let totalGas = 0;
        let totalAgua = 0;

        tbody.innerHTML = maquinas.map(m => {
            totalWatts += parseFloat(m.potencia_watts || m.watts_consumo || 0);
            totalGas += parseFloat(m.consumo_gas_m3 || m.gas_consumo || 0);
            totalAgua += parseFloat(m.consumo_agua_m3 || m.agua_consumo || 0);

            return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="font-weight: 700;">${m.nome_equipamento || 'Utensílio'}</td>
                    <td style="color: #1e3a8a; font-weight: 800;">R$ ${(m.preco_compra || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="text-align: center;">${m.watts_consumo || m.potencia_watts || 0} W</td>
                    <td style="text-align: center;">${m.gas_consumo || m.consumo_gas_m3 || 0} m³</td>
                    <td style="color: #5b21b6; font-weight: bold;">R$ ${(m.custo_minuto || m.custo_minuto_maquina || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                    <td style="text-align: center;">
                        <button type="button" onclick="deletarMaquina(${m.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Remover</button>
                    </td>
                </tr>
            `;
        }).join('');

        if (document.getElementById('kpi-energia-mensal')) document.getElementById('kpi-energia-mensal').innerText = `${totalWatts.toLocaleString('pt-BR')} W`;
        if (document.getElementById('kpi-gas-mensal')) document.getElementById('kpi-gas-mensal').innerText = `${totalGas.toLocaleString('pt-BR', {minimumFractionDigits: 2})} m³`;
        if (document.getElementById('kpi-agua-mensal')) document.getElementById('kpi-agua-mensal').innerText = `${totalAgua.toLocaleString('pt-BR', {minimumFractionDigits: 2})} m³`;

    } catch (err) { 
        console.error('Erro ao carregar tabela de utensílios:', err); 
    }
}
// ==========================================================================
 // TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
 // ARQUIVO: estrutura.js - PARTE 3B DE 3 (RENDERIZAÇÃO DE RH E SALVAMENTO)
 // ==========================================================================
 
async function carregarTabelaColaboradores() {
    "use strict";
    try {
        const res = await fetch('/api/estrutura/rh');
        if (!res.ok) {
            document.getElementById('tabela_colaboradores').innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Erro ao carregar colaboradores</td></tr>`;
            return;
        }
        const colaboradores = await res.json();
        const tbody = document.getElementById('tabela_colaboradores');
        if (!tbody) return;
        
        if (!colaboradores || colaboradores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum colaborador alocado</td></tr>`;
            return;
        }

        tbody.innerHTML = colaboradores.map(c => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 700;"> ${c.nome || 'N/A'}</td>
                <td style="font-weight: 600;">${c.cargo}</td>
                <td style="text-align: right;">R$ ${(c.salario_base || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; font-weight: bold;">${c.quantidade}</td>
                <td style="color: #4338ca; font-weight: bold; text-align: right;">R$ ${(c.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deletarColaborador(${c.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Demitir</button>
                </td>
            </tr>
        `).join('');
    } catch (err) { 
        console.error('Erro ao carregar colaboradores:', err); 
    }
}

async function calcularCustoMinutoUtensilio() {
    "use strict";
    try {
        const resMaquinas = await fetch('/api/estrutura/maquinas');
        if (!resMaquinas.ok) return;
        const maquinas = await resMaquinas.json();
        const elem = document.getElementById('kpi-custo-minuto-total');
        
        if (!elem) return;
        if (!maquinas || maquinas.length === 0) {
            elem.innerText = 'R$ 0,00/min';
            return;
        }
        
        const totalCustoMinuto = maquinas.reduce((sum, m) => sum + (m.custo_minuto || m.custo_minuto_maquina || 0), 0);
        elem.innerText = totalCustoMinuto.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + '/min';
    } catch (err) { 
        console.error('Erro ao calcular custo minuto:', err); 
    }
}

async function salvarImovel(e) {
    "use strict";
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
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
            alert("🎯 Contrato firmado com sucesso!");
        } else { 
            alert("❌ Erro ao salvar contrato imobiliário."); 
        }
    } catch (err) { 
        console.error('Erro ao salvar imóvel:', err); 
    }
}

async function salvarMaquina(e) {
    "use strict";
    if(e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('seletor_equipamento');
    const option = select.options[select.selectedIndex];
    
    if (!option || !option.value) {
        alert("❌ Selecione um utensílio válido.");
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
            select.selectedIndex = 0;
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Ativo de suporte alocado!");
        } else { 
            alert("❌ Erro ao salvar utensílio."); 
        }
    } catch (err) { 
        console.error('Erro ao salvar máquina:', err); 
    }
}
// ==========================================================================
 // TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
 // ARQUIVO: estrutura.js - PARTE 3C DE 3 (EXCLUSÕES, EDIÇÃO E RESETS)
 // ==========================================================================
 
async function adicionarColaborador(e) {
    "use strict";
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
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Colaborador adicionado!");
        } else { 
            alert("❌ Erro ao adicionar colaborador."); 
        }
    } catch (err) { 
        console.error('Erro ao salvar colaborador:', err); 
    }
}

async function editarImovel(id) {
    "use strict";
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        if (!res.ok) return;
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
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato";
        calcularPrecoMercadoRefletido();
    } catch (err) { 
        console.error('Erro ao editar imóvel:', err); 
    }
}

async function deletarImovel(id) {
    "use strict";
    if (!confirm('Confirmar rescisão do contrato de locação?')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Contrato rescindido.");
        }
    } catch (err) { 
        console.error('Erro ao deletar imóvel:', err); 
    }
}

async function deletarMaquina(id) {
    "use strict";
    if (!confirm('Remover este utensílio de suporte?')) return;
    try {
        const res = await fetch(`/api/estrutura/maquinas/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Utensílio removido.");
        }
    } catch (err) { 
        console.error('Erro ao deletar máquina/utensílio:', err); 
    }
}

async function deletarColaborador(id) {
    "use strict";
    if (!confirm('Confirmar desligamento do funcionário predial?')) return;
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (window.forcarAtualizacaoMetricasTopboard) window.forcarAtualizacaoMetricasTopboard();
            carregarDadosIniciais();
            alert("🎯 Colaborador desligado.");
        }
    } catch (err) { 
        console.error('Erro ao deletar colaborador:', err); 
    }
}

function limparFormularioImobiliario() {
    "use strict";
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    if (document.getElementById('imovel_id')) document.getElementById('imovel_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
    calcularPrecoMercadoRefletido();
}

// Atalhos de Teclado Universais para Auditoria e Contingência Pedagógica
document.addEventListener('keydown', function(event) {
    "use strict";
    if (event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        const painel = document.querySelector('a[href="/professor_painel_secreto"]');
        if (painel) window.location.href = painel.href;
    }
    if (event.key === 'Escape') {
        limparFormularioImobiliario();
        document.getElementById('formMaquinas')?.reset();
        document.getElementById('formContratacaoPredial')?.reset();
        if (document.getElementById('previa_salario')) document.getElementById('previa_salario').value = "R$ 0,00";
    }
});
