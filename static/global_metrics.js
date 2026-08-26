/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT CLIENT INDIVIDUAL (IMOBILIÁRIO & CUSTOS)
   PARTE 1 DE 3 - MAPEAMENTO DA RMC, DICIONÁRIOS E BINDING DE GATILHOS
   ========================================================================== */

const MATRIZ_LOCACAO_RMC = {
    "Curitiba": { valor_m2: 32.50, condominio_base: 350.00, cap_rate: 0.0055, igpm: 0.0425 },
    "São José dos Pinhais": { valor_m2: 24.00, condominio_base: 280.00, cap_rate: 0.0048, igpm: 0.0425 },
    "Pinhais": { valor_m2: 26.50, condominio_base: 300.00, cap_rate: 0.0052, igpm: 0.0425 },
    "Araucária": { valor_m2: 22.00, condominio_base: 250.00, cap_rate: 0.0045, igpm: 0.0425 },
    "Campo Largo": { valor_m2: 19.50, condominio_base: 220.00, cap_rate: 0.0042, igpm: 0.0425 }
};

const TABELA_SALARIOS_AQUECIMENTO = {
    "Gerente de Infraestrutura": 8500.00,
    "Supervisor Predial": 5200.00,
    "Técnico de Manutenção Industrial": 3800.00,
    "Operador de Utilidades": 2900.00,
    "Auxiliar de Serviços Gerais / Portaria": 2100.00
};

document.addEventListener("DOMContentLoaded", function() {
    configurarGatilhosImobiliarios();
    configurarGatilhosApoioPredial();
    
    // Varredura inicial padrão
    executarCalculoLocacaoReativa();
    executarCalculoFolhaReativa();
});

function configurarGatilhosImobiliarios() {
    const inputs = ['txt_area_util', 'sel_cidade_municipio', 'txt_taxa_condominio'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoLocacaoReativa);
            elemento.addEventListener('change', executarCalculoLocacaoReativa);
        }
    });
}

function configurarGatilhosApoioPredial() {
    const inputs = ['sel_cargo_operacional', 'txt_quantidade_vagas'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoFolhaReativa);
            elemento.addEventListener('change', executarCalculoFolhaReativa);
        }
    });
}
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT CLIENT INDIVIDUAL (IMOBILIÁRIO & CUSTOS)
   PARTE 2 DE 3 - MOTORES DE CÁLCULO E MATRIZES DE ATUALIZAÇÃO DA UI
   ========================================================================== */

function executarCalculoLocacaoReativa() {
    try {
        const areaUtil = parseFloat(document.getElementById('txt_area_util')?.value) || 0;
        const cidade = document.getElementById('sel_cidade_municipio')?.value || "Curitiba";
        const paramCidade = MATRIZ_LOCACAO_RMC[cidade] || MATRIZ_LOCACAO_RMC["Curitiba"];
        
        // 1. Cálculo Base do Aluguel e Taxas
        const aluguelCalculado = areaUtil * paramCidade.valor_m2;
        const condominioInformado = parseFloat(document.getElementById('txt_taxa_condominio')?.value) || paramCidade.condominio_base;
        const taxaAnualCalculada = (aluguelCalculado * 12) + (condominioInformado * 12);
        
        // Sincronização dos Inputs Calculados
        redirecionarValorInput('txt_aluguel_calculado', aluguelCalculado);
        redirecionarValorInput('txt_taxa_anual', taxaAnualCalculada);
        
        // 2. Cálculos Financeiros Avancados (Cards de Provisão e Ativos)
        const projecaoIgpmAnual = aluguelCalculado * 12 * paramCidade.igpm;
        const valorMercadoEstimado = paramCidade.cap_rate > 0 ? (aluguelCalculado * 12) / (paramCidade.cap_rate * 12) : 0;
        const tempoAmortizacaoMeses = aluguelCalculado > 0 ? Math.ceil(valorMercadoEstimado / aluguelCalculado) : 0;
        const capRateMensalPercentual = paramCidade.cap_rate * 100;

        // Atualização Dinâmica de Textos Internos nos Quadros da Interface
        atualizarTextoElemento('lbl_provisao_igpm', `Projeção IGP-M Anual: R$ ${projecaoIgpmAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('lbl_amortizacao_valor', `Valor de Mercado: R$ ${valorMercadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('lbl_amortizacao_tempo', `Tempo necessário: ${tempoAmortizacaoMeses} meses`);
        atualizarTextoElemento('lbl_rentabilidade_taxa', `Taxa Capitalização: ${capRateMensalPercentual.toFixed(2)}% a.m.`);
        atualizarTextoElemento('lbl_rentabilidade_proporcao', `➔ Proporção locatícia regional para ${cidade}.`);

    } catch (erro) {
        console.error("Erro no processamento matemático patrimonial: ", erro);
    }
}

function executarCalculoFolhaReativa() {
    try {
        const cargo = document.getElementById('sel_cargo_operacional')?.value || "";
        const quantidade = parseInt(document.getElementById('txt_quantidade_vagas')?.value) || 1;
        const salarioBase = TABELA_SALARIOS_AQUECIMENTO[cargo] || 0.00;
        
        // Encargo patronal fixado em 68% (Previdenciário + Trabalhista + FGTS)
        const fatorEncargos = 1.68;
        const custoPreviaFolha = salarioBase * quantidade * fatorEncargos;
        
        redirecionarValorInput('txt_previa_folha', custoPreviaFolha);
    } catch (erro) {
        console.error("Erro no motor de folha predial: ", erro);
    }
}

function redirecionarValorInput(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.value = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
}

function atualizarTextoElemento(id, texto) {
    const el = document.getElementById(id);
    if (el) el.innerText = texto;
}

// Vinculação com o escopo global do global_metrics.js
window.calcularEngineeringPatrimonial = executarCalculoLocacaoReativa;
/* ==========================================================================
   TERADMAS ERP v2.6 - SCRIPT CLIENT INDIVIDUAL (IMOBILIÁRIO & CUSTOS)
   PARTE 3 DE 3 - PERSISTÊNCIA ASSÍNCRONA VIA API ENDPOINTS (SUBMIT CRUD)
   ========================================================================== */

async function submeterContratoImobiliario() {
    const btn = document.getElementById('btn_firmar_contrato');
    if (btn) btn.disabled = true;

    try {
        const payload = {
            identificacao: document.getElementById('txt_identificacao_grupo')?.value || "G-PROD",
            tipo_estrutura: document.getElementById('sel_tipo_estrutura')?.value,
            cidade: document.getElementById('sel_cidade_municipio')?.value,
            bairro: document.getElementById('sel_bairro_polo')?.value,
            area_util: parseFloat(document.getElementById('txt_area_util')?.value) || 0,
            condominio: parseFloat(document.getElementById('txt_taxa_condominio')?.value) || 0,
            aluguel: parseFloat(document.getElementById('txt_aluguel_calculado')?.value.replace(/\./g, '').replace(',', '.')) || 0
        };

        const response = await fetch('/api/imobiliario/contrato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Contrato imobiliário firmado e persistido com sucesso no Supabase!");
            if (typeof window.forcarAtualizacaoMetricasTopboard === 'function') {
                window.forcarAtualizacaoMetricasTopboard();
            }
            window.location.reload();
        } else {
            const erroData = await response.json();
            alert(`Erro na gravação: ${erroData.message || 'Verifique os tetos orçamentários.'}`);
        }
    } catch (err) {
        console.error("Falha de rede na persistência imobiliária:", err);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Vinculação explícita nos botões principais do formulário se não houver inline onclick
document.getElementById('btn_firmar_contrato')?.addEventListener('click', submeterContratoImobiliario);
