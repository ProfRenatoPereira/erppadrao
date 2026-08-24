/* ==========================================================================
   TERADMAS ERP v2.6 - REESCRITA DO SCRIPT CLIENT (`estrutura.js`)
   PARTE 1 DE 2 - MATRIZ DE PRECIFICAÇÃO E CAPTURA DE SESSÃO ANTICRASH
   ========================================================================== */

const CONFIG_RMC_IMOBILIARIO = {
    "Curitiba": { valor_m2: 32.50, condominio_base: 350.00, cap_rate: 0.0055, igpm: 0.0425 },
    "São José dos Pinhais": { valor_m2: 24.00, condominio_base: 280.00, cap_rate: 0.0048, igpm: 0.0425 },
    "Pinhais": { valor_m2: 26.50, condominio_base: 300.00, cap_rate: 0.0052, igpm: 0.0425 },
    "Araucária": { valor_m2: 22.00, condominio_base: 250.00, cap_rate: 0.0045, igpm: 0.0425 },
    "Campo Largo": { valor_m2: 19.50, condominio_base: 220.00, cap_rate: 0.0042, igpm: 0.0425 }
};

const TABELA_CUSTOS_RH_PREDIAL = {
    "Gerente de Infraestrutura": 8500.00,
    "Supervisor Predial": 5200.00,
    "Técnico de Manutenção Industrial": 3800.00,
    "Operador de Utilidades": 2900.00,
    "Auxiliar de Serviços Gerais / Portaria": 2100.00
};

document.addEventListener("DOMContentLoaded", function() {
    console.log("Inicializando Reescrita do Módulo Imobiliário v2.6...");
    
    // Força a liberação dos elementos de layout ocultados por falha de script anterior
    garantirVisibilidadeLayout();

    // Vincula os escutadores de forma segura (Defensiva)
    vincularEventosDefensivos('txt_area_util', ['input', 'change'], calcularLocacaoPatrimonial);
    vincularEventosDefensivos('sel_cidade_municipio', ['change'], calcularLocacaoPatrimonial);
    vincularEventosDefensivos('txt_taxa_condominio', ['input'], calcularLocacaoPatrimonial);
    
    vincularEventosDefensivos('sel_cargo_operacional', ['change'], calcularFolhaApoio);
    vincularEventosDefensivos('txt_quantidade_vagas', ['input'], calcularFolhaApoio);

    // Executa primeira rodada de cálculos para tirar os campos do estado zerado
    calcularLocacaoPatrimonial();
    calcularFolhaApoio();
});

function vincularEventosDefensivos(idElemento, eventos, funcao) {
    const el = document.getElementById(idElemento);
    if (el) {
        eventos.forEach(evt => el.addEventListener(evt, funcao));
    }
}

function garantirVisibilidadeLayout() {
    // Força desbloqueio total de inputs e elementos da árvore DOM
    document.querySelectorAll('input, select, button').forEach(el => {
        el.removeAttribute('disabled');
        el.style.opacity = "1";
    });
}
/* ==========================================================================
   TERADMAS ERP v2.6 - REESCRITA DO SCRIPT CLIENT (`estrutura.js`)
   PARTE 2 DE 2 - ENGENHARIA REATIVA FINANCEIRA E VALIDAÇÃO DE INPUTS
   ========================================================================== */

function calcularLocacaoPatrimonial() {
    try {
        const areaUtil = parseFloat(document.getElementById('txt_area_util')?.value) || 0;
        const cidade = document.getElementById('sel_cidade_municipio')?.value || "Curitiba";
        const dadosCidade = CONFIG_RMC_IMOBILIARIO[cidade] || CONFIG_RMC_IMOBILIARIO["Curitiba"];

        // 1. Cálculos de Locação Base
        const aluguelCalculado = areaUtil * dadosCidade.valor_m2;
        const condominioFixo = parseFloat(document.getElementById('txt_taxa_condominio')?.value) || dadosCidade.condominio_base;
        const taxaAnual = (aluguelCalculado * 12) + (condominioFixo * 12);

        // Atualização dos inputs calculados na UI
        definirValorInput('txt_aluguel_calculado', aluguelCalculado);
        definirValorInput('txt_taxa_anual', taxaAnual);

        // 2. Projeções dos Cards Auxiliares
        const projecaoIgpm = aluguelCalculado * 12 * dadosCidade.igpm;
        const valorMercado = dadosCidade.cap_rate > 0 ? (aluguelCalculado * 12) / (dadosCidade.cap_rate * 12) : 0;
        const mesesAmortizacao = aluguelCalculado > 0 ? Math.ceil(valorMercado / aluguelCalculado) : 0;

        // Injeção de texto segura nos elementos internos dos cards coloridos
        definirTextoHTML('lbl_provisao_igpm', `Projeção IGP-M Anual: R$ ${projecaoIgpm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        definirTextoHTML('lbl_amortizacao_valor', `Valor de Mercado: R$ ${valorMercado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        definirTextoHTML('lbl_amortizacao_tempo', `Tempo necessário: ${mesesAmortizacao} meses`);
        definirTextoHTML('lbl_rentabilidade_taxa', `Taxa Capitalização: ${(dadosCidade.cap_rate * 100).toFixed(2)}% a.m.`);

    } catch (err) {
        console.error("Falha no cálculo patrimonial (Isolado para evitar travamento):", err);
    }
}

function calcularFolhaApoio() {
    try {
        const cargo = document.getElementById('sel_cargo_operacional')?.value || "";
        const qtd = parseInt(document.getElementById('txt_quantidade_vagas')?.value) || 1;
        const salarioBase = TABELA_CUSTOS_RH_PREDIAL[cargo] || 0;
        
        // Encargo patronal indexado em 68% do ecossistema TERADMAS
        const custoTotalFolha = salarioBase * qtd * 1.68;
        definirValorInput('txt_previa_folha', custoTotalFolha);
    } catch (err) {
        console.error("Falha no cálculo de folha:", err);
    }
}

function definirValorInput(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.value = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
}

function definirTextoHTML(id, texto) {
    const el = document.getElementById(id);
    if (el) el.innerText = texto;
}
