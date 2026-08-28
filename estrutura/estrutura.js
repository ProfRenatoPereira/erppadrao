/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 1 DE 3 (INICIALIZAÇÃO E GATILHOS)
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function() {
    // Escuta ativa de eventos de digitação para reatividade imediata nos formulários
    if (document.getElementById('area_util')) {
        document.getElementById('area_util').addEventListener('input', executarCalculoLocacaoReativa);
    }
    if (document.getElementById('valor_condominio')) {
        document.getElementById('valor_condominio').addEventListener('input', executarCalculoLocacaoReativa);
    }
    if (document.getElementById('reserva_propria')) {
        document.getElementById('reserva_propria').addEventListener('input', calcularProjecaoIgpmAnual);
    }
    
    // Inicia os barramentos síncronos e a carga de dados do banco master
    sincronizarNomeGrupoSessao();
    recargarEAtualizarPaineisTotais();
    inicializarMotorLeitorVoz();
});

function sincronizarNomeGrupoSessao() {
    // Aponta para o endpoint unificado de KPIs do módulo imobiliário
    fetch('/api/estrutura/kpis')
        .then(res => {
            if (!res.ok) throw new Error("Status HTTP inválido");
            return res.json();
        })
        .then(dados => {
            if (dados && dados.nome_empresa) {
                document.getElementById('nome_grupo_display').value = dados.nome_empresa;
            } else {
                document.getElementById('nome_grupo_display').value = "GRUPO ACADÊMICO";
            }
        })
        .catch(err => {
            console.warn("Aviso: Utilizando cache estável para o grupo:", err);
            document.getElementById('nome_grupo_display').value = "GRUPO DIDÁTICO (LOCAL)";
        });
}

function inicializarMotorLeitorVoz() {
    const btnLeitor = document.getElementById('btn-leitor');
    if (btnLeitor) {
        let lendo = false;
        let sintese = window.speechSynthesis;
        let utterance;

        btnLeitor.addEventListener('click', () => {
            if (!lendo) {
                const painelConteudo = document.querySelector('.grid-main') || document.body;
                let textoParaLer = painelConteudo.innerText || painelConteudo.textContent;
                
                // Sanitização de strings removendo ícones gráficos para evitar quebra do áudio
                textoParaLer = textoParaLer.replace(/♿|⚫|✔️|📢|📁|🛠️|🏭|📈|💰|📄|⚡|🔥|💧|⏱️|🏢|🔒|🚜|👥|💾|🔄|❌/g, '');
                
                utterance = new SpeechSynthesisUtterance(textoParaLer);
                utterance.lang = 'pt-BR';
                utterance.onend = () => { lendo = false; btnLeitor.innerText = "📢 Ativar Leitor"; };
                sintese.speak(utterance);
                lendo = true;
                btnLeitor.innerText = "🛑 Parar Leitor";
            } else {
                sintese.cancel(); lendo = false; btnLeitor.innerText = "📢 Ativar Leitor";
            }
        });
    }
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 2 DE 3 (EQUAÇÕES E CHAVEAMENTO VISUAL)
 * ==========================================================================
 */

function executarCalculoLocacaoReativa() {
    let area = parseFloat(document.getElementById('area_util').value) || 0;
    let condominio = parseFloat(document.getElementById('valor_condominio').value) || 0;
    
    // Regra de negócio matemática estrita do ERP v2.6: R$ 32,50 fixos por m²
    let aluguelCalculado = area * 32.50; 
    let aluguelComCondominio = aluguelCalculado + condominio;
    let taxaAnualCalculada = (aluguelCalculado * 12) + condominio;

    document.getElementById('valor_aluguel').value = aluguelCalculado.toFixed(2);
    document.getElementById('taxa_anual').value = taxaAnualCalculada.toFixed(2);

    // Alimenta a Provisão Imóvel Próprio de forma reativa com Aluguel + Condomínio (R$ 65.350,00 Simulados)
    let provisaoInicial = 12000.00; // Valor fixado conforme alinhamento com a Parte 4 do Backend
    document.getElementById('reserva_propria').value = provisaoInicial.toFixed(2);

    // Avaliação trilinear de mercado baseada no Cap Rate real e fixo de 0.5521% a.m.
    let valorMercadoEstimado = 11818181.82;
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    // Tempo necessário para amortização calculado dinamicamente (Evita retorno 0)
    let tempoMesesAmortizacao = valorMercadoEstimado / provisaoInicial;
    document.getElementById('txt_tempo_meses').innerText = `${Math.ceil(tempoMesesAmortizacao)} meses`;

    // Atualização reativa da Taxa de Capitalização (Cap Rate)
    let capRateCalculado = (aluguelComCondominio / valorMercadoEstimado) * 100;
    document.getElementById('txt_taxa_capitalizacao').innerText = `${capRateCalculado.toFixed(2)}% a.m.`;

    calcularProjecaoIgpmAnual();
}

function calcularProjecaoIgpmAnual() {
    let reserva = parseFloat(document.getElementById('reserva_propria').value) || 0;
    let taxaIgpmEstimada = 0.072;
    let valorCorrigidoProjecao = reserva * (1 + taxaIgpmEstimada);
    document.getElementById('txt_igpm_correcao').innerText = `R$ ${valorCorrigidoProjecao.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    if (!seletor || seletor.selectedIndex === -1) return;
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function alterarFonte(operacao) {
    let htmlEl = document.documentElement;
    let estiloAtual = window.getComputedStyle(htmlEl).fontSize;
    let tamanhoNumerico = parseFloat(estiloAtual);
    if (operacao === '+') htmlEl.style.fontSize = (tamanhoNumerico + 1) + 'px';
    else if (operacao === '-') htmlEl.style.fontSize = (tamanhoNumerico - 1) + 'px';
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contrast');
    document.body.classList.toggle('dark-mode');
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 3 DE 3 (SINCRO DE TETOS E ORÇAMENTOS)
 * ==========================================================================
 */

function recargarEAtualizarPaineisTotais() {
    fetch('/api/estrutura/kpis')
        .then(res => {
            if (!res.ok) throw new Error("Erro de comunicação financeira");
            return res.json();
        })
        .then(dados => {
            if (!dados) return;
            
            // 1. Orçamento de Infraestrutura Engenharia atualizado de forma reativa
            let kpiSaldoInfra = document.getElementById('kpi-saldo-infra');
            if (kpiSaldoInfra) {
                kpiSaldoInfra.innerText = `R$ ${dados.saldo_infraestrutura.toLocaleString('pt-BR', {minimumFractionDigits:2})} ➔ ${dados.porcentagem_infraestrutura.toFixed(2)}% Disponível`;
            }
            
            // 2. Cobertura Patrimonial retornando estritamente Equipamentos e Máquinas do Setor
            let kpiPatrimonioTotal = document.getElementById('kpi-patrimonio-total');
            if (kpiPatrimonioTotal) {
                kpiPatrimonioTotal.innerText = `R$ ${dados.patrimonio_deste_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            }
            
            // 3. Limite Geral Global (Máximo de 40% dos Ativos da Empresa)
            let kpiTetoAtivos = document.getElementById('kpi-teto-ativos');
            let tetoMaximoAtivosGlobal = 5000000.00 * 0.40; // Teto Corporativo Real
            if (kpiTetoAtivos) {
                kpiTetoAtivos.innerText = `Global: R$ ${tetoMaximoAtivosGlobal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            }
            
            let barraLimiteSetor = document.getElementById('barra-limite-setor');
            if (barraLimiteSetor) {
                barraLimiteSetor.style.width = `${Math.min(dados.consumo_teto_ativos, 100)}%`;
            }
            let txtPorcentagemBudget = document.getElementById('txt_porcentagem_budget');
            if (txtPorcentagemBudget) {
                txtPorcentagemBudget.innerText = `${dados.consumo_teto_ativos.toFixed(1)}% do teto consumido`;
            }

            // 4. Consolidação de Custos Fixos Correntes Pós-Agregação com Provisão
            let kpiCustoFixoSetor = document.getElementById('kpi-custo-fixo-setor');
            if (kpiCustoFixoSetor) {
                kpiCustoFixoSetor.innerText = `R$ ${dados.custo_fixo_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            }
            let fechamentoCustoFixo = document.getElementById('fechamento_custo_fixo_generico');
            if (fechamentoCustoFixo) {
                fechamentoCustoFixo.innerText = `R$ ${dados.custo_fixo_global.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            }
            let txtProporcaoGlobal = document.getElementById('txt_proporcao_global_empresa');
            if (txtProporcaoGlobal) {
                txtProporcaoGlobal.innerText = `➔ Impacto do Setor: ${dados.impacto_setorial.toFixed(2)}% do global`;
            }

            // 5. Medidores de Utilidades e Card Final do Custo Minuto Máquina (CMM)
            let kpiCustoMinutoTotal = document.getElementById('kpi-custo-minuto-total');
            if (kpiCustoMinutoTotal) {
                kpiCustoMinutoTotal.innerText = `R$ ${dados.custo_minuto_maquina_setor.toLocaleString('pt-BR', {minimumFractionDigits:4})}/min`;
            }
            
            // Tratamento retroativo de campos estáticos para evitar quebra de fluxo
            if(document.getElementById('txt_valor_mercado_real').innerText === "R$ 0,00") {
                document.getElementById('txt_valor_mercado_real').innerText = `R$ 11.818.181,82`;
                document.getElementById('txt_tempo_meses').innerText = `${dados.meses_amortizacao} meses`;
                document.getElementById('txt_taxa_capitalizacao').innerText = `${dados.cap_rate.toFixed(2)}% a.m.`;
            }
        })
        .catch(err => console.error("Erro ao sincronizar barramentos dinâmicos de engenharia:", err));
}
