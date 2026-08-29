/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - PAINEL GLOBAL DE MÉTRICAS CONSOLIDADAS
 * Motor de agregação de dados em tempo real para Dashboard do Professor
 * ==========================================================================
 */

const GlobalMetrics = {
    dataCache: null,
    lastUpdate: null,
    updateInterval: 5000, // 5 segundos
    
    /**
     * Inicializa o motor de métricas globais
     */
    async init() {
        "use strict";
        try {
            console.log('🚀 Inicializando GlobalMetrics...');
            await this.loadMetrics();
            this.renderDashboard();
            // Auto-refresh a cada 5 segundos
            setInterval(() => this.loadMetrics(), this.updateInterval);
            console.log('✅ GlobalMetrics inicializado com sucesso');
        } catch (err) {
            console.error('❌ Erro ao inicializar métricas globais:', err);
        }
    },
    
    /**
     * Carrega métricas consolidadas do servidor
     */
    async loadMetrics() {
        "use strict";
        try {
            const response = await fetch('/api/financeiro/metricas?dept=global');
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            this.dataCache = await response.json();
            this.lastUpdate = new Date();
            this.renderDashboard();
        } catch (err) {
            console.error('❌ Erro ao carregar métricas:', err);
        }
    },
    
    /**
     * Renderiza o dashboard com os dados carregados
     */
    renderDashboard() {
        "use strict";
        if (!this.dataCache) return;
        
        const data = this.dataCache;
        const capitalTotal = data.capital_total || 5000000;
        const capitalDisponivel = data.capital_disponivel_total || 0;
        const patrimonioTotal = data.patrimonio_ativo_total || 0;
        const custoFixoTotal = data.custo_fixo_geral_empresa || 0;
        const custoVariavelTotal = data.custo_variavel_total || 0;
        
        // Cálculos de percentuais
        const porcCapital = (custoFixoTotal / capitalTotal) * 100;
        const porcPatrimonio = (patrimonioTotal / capitalTotal) * 100;
        const porcDisponivel = ((capitalTotal - capitalDisponivel) / capitalTotal) * 100;
        
        // Atualiza elementos do DOM (se existirem)
        this.updateElement('global-capital-total', capitalTotal, 'currency');
        this.updateElement('global-capital-disponivel', capitalDisponivel, 'currency');
        this.updateElement('global-patrimonio', patrimonioTotal, 'currency');
        this.updateElement('global-custo-fixo', custoFixoTotal, 'currency');
        this.updateElement('global-custo-variavel', custoVariavelTotal, 'currency');
        this.updateElement('global-porcento-capital', porcCapital, 'percent');
        this.updateElement('global-porcento-patrimonio', porcPatrimonio, 'percent');
        this.updateElement('global-porcento-disponivel', porcDisponivel, 'percent');
        
        // Atualiza timestamp da última sincronização
        const timestampElem = document.getElementById('global-last-update');
        if (timestampElem) {
            timestampElem.innerText = `🔄 Atualizado em ${this.lastUpdate.toLocaleTimeString('pt-BR')}`;
        }
        
        // Log de sincronização
        console.log('📊 Dashboard atualizado:', data);
    },
    
    /**
     * Atualiza um elemento do DOM com valor formatado
     * @param {string} elementId - ID do elemento
     * @param {number} value - Valor a ser exibido
     * @param {string} format - Formato: 'currency', 'percent', 'number', 'text'
     */
    updateElement(elementId, value, format) {
        "use strict";
        const elem = document.getElementById(elementId);
        if (!elem) return;
        
        let formatted = value;
        
        if (format === 'currency') {
            formatted = value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else if (format === 'percent') {
            formatted = `${value.toFixed(2)}%`;
        } else if (format === 'number') {
            formatted = value.toLocaleString('pt-BR');
        }
        
        elem.innerText = formatted;
    },
    
    /**
     * Retorna um valor específico do cache de métricas
     * @param {string} key - Chave do valor
     * @returns {*} Valor da métrica ou null
     */
    getMetricValue(key) {
        "use strict";
        if (!this.dataCache) return null;
        return this.dataCache[key];
    },
    
    /**
     * Força uma atualização imediata das métricas
     */
    forceRefresh() {
        "use strict";
        console.log('🔄 Forçando atualização de métricas...');
        this.loadMetrics();
    },
    
    /**
     * Retorna um resumo em texto das métricas principais
     */
    getSummary() {
        "use strict";
        if (!this.dataCache) return 'Sem dados disponíveis';
        
        const data = this.dataCache;
        return `
            Capital Total: R$ ${(data.capital_total || 0).toLocaleString('pt-BR')}
            Patrimônio Ativo: R$ ${(data.patrimonio_ativo_total || 0).toLocaleString('pt-BR')}
            Custo Fixo Global: R$ ${(data.custo_fixo_geral_empresa || 0).toLocaleString('pt-BR')}
            Custo Variável: R$ ${(data.custo_variavel_total || 0).toLocaleString('pt-BR')}
        `;
    }
};

/**
 * ==========================================================================
 * SCRIPT CLIENT PARA COMPATIBILIDADE COM MÓDULO IMOBILIÁRIO
 * Cálculos reativos de aluguel, condomínio e folha de apoio predial
 * ==========================================================================
 */

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
    "Auxiliar de Serviços Gerais / Portaria": 2100.00,
    "Zelador": 2200.00,
    "Motorista": 2400.00,
    "Segurança Patrimonial": 2300.00
};

document.addEventListener("DOMContentLoaded", function() {
    // Inicializa GlobalMetrics se existir o elemento trigger
    if (document.getElementById('global-capital-total') || document.querySelector('[data-metric]')) {
        GlobalMetrics.init();
    }
    
    // Configuração de gatilhos para módulo imobiliário (se existirem)
    configurarGatilhosImobiliarios();
    configurarGatilhosApoioPredial();
    
    // Varredura inicial
    executarCalculoLocacaoReativa();
    executarCalculoFolhaReativa();
});

/**
 * Configura event listeners para campos de imóvel
 */
function configurarGatilhosImobiliarios() {
    const inputs = ['txt_area_util', 'sel_cidade_municipio', 'txt_taxa_condominio', 'area_util', 'cidade', 'valor_condominio'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoLocacaoReativa);
            elemento.addEventListener('change', executarCalculoLocacaoReativa);
        }
    });
}

/**
 * Configura event listeners para campos de folha/RH
 */
function configurarGatilhosApoioPredial() {
    const inputs = ['sel_cargo_operacional', 'txt_quantidade_vagas', 'cargo_suporte', 'qtd_colaboradores'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoFolhaReativa);
            elemento.addEventListener('change', executarCalculoFolhaReativa);
        }
    });
}

/**
 * Motor de cálculo reativo para locação imobiliária
 */
function executarCalculoLocacaoReativa() {
    try {
        // Tenta diferentes IDs de campos (compatibilidade com múltiplos templates)
        const areaUtil = parseFloat(document.getElementById('txt_area_util')?.value || document.getElementById('area_util')?.value) || 0;
        const cidade = document.getElementById('sel_cidade_municipio')?.value || document.getElementById('cidade')?.value || "Curitiba";
        const paramCidade = MATRIZ_LOCACAO_RMC[cidade] || MATRIZ_LOCACAO_RMC["Curitiba"];
        
        if (areaUtil <= 0) return;
        
        // Cálculos base
        const aluguelCalculado = areaUtil * paramCidade.valor_m2;
        const condominioInformado = parseFloat(
            document.getElementById('txt_taxa_condominio')?.value || 
            document.getElementById('valor_condominio')?.value
        ) || paramCidade.condominio_base;
        const taxaAnualCalculada = (aluguelCalculado * 12) + (condominioInformado * 12);
        
        // Sincronização de inputs
        redirecionarValorInput('txt_aluguel_calculado', aluguelCalculado);
        redirecionarValorInput('txt_taxa_anual', taxaAnualCalculada);
        redirecionarValorInput('valor_aluguel', aluguelCalculado);
        redirecionarValorInput('taxa_anual', taxaAnualCalculada);
        
        // Cálculos avançados
        const projecaoIgpmAnual = aluguelCalculado * 12 * paramCidade.igpm;
        const valorMercadoEstimado = paramCidade.cap_rate > 0 ? (aluguelCalculado * 12) / (paramCidade.cap_rate * 12) : 0;
        const tempoAmortizacaoMeses = aluguelCalculado > 0 ? Math.ceil(valorMercadoEstimado / aluguelCalculado) : 0;
        const capRateMensalPercentual = paramCidade.cap_rate * 100;
        
        // Atualização dinâmica de textos
        atualizarTextoElemento('lbl_provisao_igpm', `Projeção IGP-M Anual: R$ ${projecaoIgpmAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('txt_igpm_correcao', `R$ ${projecaoIgpmAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('lbl_amortizacao_valor', `Valor de Mercado: R$ ${valorMercadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('txt_valor_mercado_real', `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        atualizarTextoElemento('lbl_amortizacao_tempo', `Tempo necessário: ${tempoAmortizacaoMeses} meses`);
        atualizarTextoElemento('txt_tempo_meses', `${tempoAmortizacaoMeses} meses`);
        atualizarTextoElemento('lbl_rentabilidade_taxa', `Taxa Capitalização: ${capRateMensalPercentual.toFixed(2)}% a.m.`);
        atualizarTextoElemento('txt_taxa_capitalizacao', `${capRateMensalPercentual.toFixed(2)}% a.m.`);
        
    } catch (erro) {
        console.error("❌ Erro no processamento matemático patrimonial:", erro);
    }
}

/**
 * Motor de cálculo reativo para folha de RH
 */
function executarCalculoFolhaReativa() {
    try {
        const cargo = document.getElementById('sel_cargo_operacional')?.value || document.getElementById('cargo_suporte')?.value || "";
        const quantidade = parseInt(
            document.getElementById('txt_quantidade_vagas')?.value || 
            document.getElementById('qtd_colaboradores')?.value
        ) || 1;
        const salarioBase = TABELA_SALARIOS_AQUECIMENTO[cargo] || 0.00;
        
        if (!cargo || salarioBase === 0) return;
        
        // Encargo patronal fixado em 68%
        const fatorEncargos = 1.68;
        const custoPreviaFolha = salarioBase * quantidade * fatorEncargos;
        
        redirecionarValorInput('txt_previa_folha', custoPreviaFolha);
        redirecionarValorInput('previa_salario', custoPreviaFolha);
        
    } catch (erro) {
        console.error("❌ Erro no motor de folha predial:", erro);
    }
}

/**
 * Atualiza valor de um campo input formatado em moeda
 */
function redirecionarValorInput(id, valor) {
    const el = document.getElementById(id);
    if (el) {
        el.value = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
}

/**
 * Atualiza conteúdo de texto de um elemento
 */
function atualizarTextoElemento(id, texto) {
    const el = document.getElementById(id);
    if (el) el.innerText = texto;
}

/**
 * Submete contrato imobiliário para persistência
 */
async function submeterContratoImobiliario() {
    const btn = document.getElementById('btn_firmar_contrato');
    if (btn) btn.disabled = true;

    try {
        const payload = {
            identificacao: document.getElementById('txt_identificacao_grupo')?.value || "G-PROD",
            tipo_estrutura: document.getElementById('sel_tipo_estrutura')?.value || document.getElementById('tipo_imovel')?.value,
            cidade: document.getElementById('sel_cidade_municipio')?.value || document.getElementById('cidade')?.value,
            bairro: document.getElementById('sel_bairro_polo')?.value || document.getElementById('bairro')?.value,
            area_util: parseFloat(document.getElementById('txt_area_util')?.value || document.getElementById('area_util')?.value) || 0,
            condominio: parseFloat(
                (document.getElementById('txt_taxa_condominio')?.value || document.getElementById('valor_condominio')?.value || '0')
                .replace(/\./g, '').replace(',', '.')) || 0,
            aluguel: parseFloat(
                (document.getElementById('txt_aluguel_calculado')?.value || document.getElementById('valor_aluguel')?.value || '0')
                .replace(/\./g, '').replace(',', '.')) || 0
        };

        const response = await fetch('/api/imobiliario/contrato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("🎯 Contrato imobiliário firmado com sucesso!");
            if (typeof GlobalMetrics.forceRefresh === 'function') {
                GlobalMetrics.forceRefresh();
            }
            if (typeof window.forcarAtualizacaoMetricasTopboard === 'function') {
                window.forcarAtualizacaoMetricasTopboard();
            }
        } else {
            const erroData = await response.json();
            alert(`❌ Erro: ${erroData.message || 'Verifique os tetos orçamentários.'}`);
        }
    } catch (err) {
        console.error("❌ Falha na persistência:", err);
        alert("❌ Erro de rede ao salvar contrato.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Vinculações explícitas
document.getElementById('btn_firmar_contrato')?.addEventListener('click', submeterContratoImobiliario);
window.calcularEngineeringPatrimonial = executarCalculoLocacaoReativa;
window.GlobalMetrics = GlobalMetrics;
