// ==========================================================================
 // TERADMAS ERP v2.6 - PAINEL GLOBAL DE MÉTRICAS CONSOLIDADAS
 // ARQUIVO: metrics.js - PARTE 1 DE 2 (SINCRO E PROCESSAMENTO FINANCEIRO)
 // ==========================================================================
 
const GlobalMetrics = {
    dataCache: null,
    lastUpdate: null,
    updateInterval: 5000, // Atualização reativa a cada 5 segundos
    
    /**
     * Inicializa o motor de métricas globais do ecossistema TERADMAS
     */
    async init() {
        "use strict";
        try {
            console.log('🚀 Inicializando GlobalMetrics de Ocupação e Ativos...');
            await this.loadMetrics();
            
            // Ativa o ciclo reativo automático em background
            setInterval(() => this.loadMetrics(), this.updateInterval);
            console.log('✅ GlobalMetrics ativado com sucesso.');
        } catch (err) {
            console.error('❌ Erro no ciclo de partida das métricas:', err);
        }
    },
    
    /**
     * Consome os dados totalizados diretamente do GerenciadorCaixa no Flask
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
            console.error('❌ Erro de comunicação com o GerenciadorCaixa:', err);
        }
    },
    
    /**
     * Descarrega e renderiza as métricas e taxas nos elementos ativos do DOM
     */
    renderDashboard() {
        "use strict";
        if (!this.dataCache) return;
        
        const data = this.dataCache;
        const capitalTotal = data.capital_total || 10000000;
        const capitalDisponivel = data.capital_disponivel_total || 0;
        const patrimonioTotal = data.patrimonio_ativo_total || 0;
        const custoFixoTotal = data.custo_fixo_geral_empresa || 0;
        const custoVariavelTotal = data.custo_variavel_total || 0;
        
        // Equações e proporções matriciais com tratamento de dízimas
        const porcCapital = capitalTotal > 0 ? (custoFixoTotal / capitalTotal) * 100 : 0;
        const porcPatrimonio = capitalTotal > 0 ? (patrimonioTotal / capitalTotal) * 100 : 0;
        const porcDisponivel = capitalTotal > 0 ? ((capitalTotal - capitalDisponivel) / capitalTotal) * 100 : 0;
        
        // Atualiza os blocos da matriz superior mapeados
        this.updateElement('global-capital-total', capitalTotal, 'currency');
        this.updateElement('global-capital-disponivel', capitalDisponivel, 'currency');
        this.updateElement('global-patrimonio', patrimonioTotal, 'currency');
        this.updateElement('global-custo-fixo', custoFixoTotal, 'currency');
        this.updateElement('global-custo-variavel', custoVariavelTotal, 'currency');
        this.updateElement('global-porcento-capital', porcCapital, 'percent');
        this.updateElement('global-porcento-patrimonio', porcPatrimonio, 'percent');
        this.updateElement('global-porcento-disponivel', porcDisponivel, 'percent');
        
        // Atualiza carimbo temporal WCAG de auditoria do Professor
        const timestampElem = document.getElementById('global-last-update');
        if (timestampElem) {
            timestampElem.innerText = `🔄 Sincronizado às ${this.lastUpdate.toLocaleTimeString('pt-BR')}`;
        }
    },
// ==========================================================================
 // TERADMAS ERP v2.6 - PAINEL GLOBAL DE MÉTRICAS CONSOLIDADAS
 // ARQUIVO: metrics.js - PARTE 2 DE 2 (FORMATADORES E CÁLCULO IMOBILIÁRIO)
 // ==========================================================================
 
    /**
     * Auxiliar de injeção e formatação de valores monetários e decimais
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
     * Retorna um resumo estruturado para relatórios rápidos
     */
    getSummary() {
        "use strict";
        if (!this.dataCache) return 'Sem dados disponíveis no momento.';
        
        const data = this.dataCache;
        return `
            Capital Fundação: R$ ${(data.capital_total || 0).toLocaleString('pt-BR')}
            Patrimônio Imobilizado: R$ ${(data.patrimonio_ativo_total || 0).toLocaleString('pt-BR')}
            Despesa Fixa Global: R$ ${(data.custo_fixo_geral_empresa || 0).toLocaleString('pt-BR')}
            Despesa Variável: R$ ${(data.custo_variavel_total || 0).toLocaleString('pt-BR')}
        `;
    },
 
    /**
     * Força a atualização manual instantânea
     */
    forceRefresh() {
        "use strict";
        console.log('🔄 Sincronização forçada sob demanda disparada...');
        this.loadMetrics();
    }
};
 
/**
 * ==========================================================================
 * MATRIZES E PARÂMETROS COMPLEMENTARES DE ENGENHARIA ECONÔMICA
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
 
/**
 * Motor reativo unificado para cálculo patrimonial imobiliário
 */
function executarCalculoLocacaoReativa() {
    "use strict";
    try {
        const areaUtil = parseFloat(document.getElementById('txt_area_util')?.value || document.getElementById('area_util')?.value) || 0;
        const cidade = document.getElementById('sel_cidade_municipio')?.value || document.getElementById('cidade')?.value || "Curitiba";
        const paramCidade = MATRIZ_LOCACAO_RMC[cidade] || MATRIZ_LOCACAO_RMC["Curitiba"];
        
        if (areaUtil <= 0) return;
        
        const aluguelCalculado = areaUtil * paramCidade.valor_m2;
        const condominioInformado = parseFloat(
            document.getElementById('txt_taxa_condominio')?.value || document.getElementById('valor_condominio')?.value
        ) || paramCidade.condominio_base;
        
        const taxaAnualCalculada = (aluguelCalculado * 12) + (condominioInformado * 12);
        
        // Sincronização cruzada para evitar quebra em templates alternativos
        const mapeamentoInputs = {
            'txt_aluguel_calculado': aluguelCalculado,
            'valor_aluguel': aluguelCalculado,
            'txt_taxa_anual': taxaAnualCalculada,
            'taxa_anual': taxaAnualCalculada
        };
        
        Object.keys(mapeamentoInputs).forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = mapeamentoInputs[id].toFixed(2);
        });
        
        const projecaoIgpmAnual = aluguelCalculado * 12 * paramCidade.igpm;
        const valorMercadoEstimado = paramCidade.cap_rate > 0 ? (aluguelCalculado * 12) / (paramCidade.cap_rate * 12) : 0;
        const tempoAmortizacaoMeses = 120; // Regulamentar padrão do ERP
        const capRateMensalPercentual = paramCidade.cap_rate * 100;
        
        // Injeção de textos didáticos nos mosaicos matemáticos
        const updatesTexto = {
            'txt_igpm_correcao': projecaoIgpmAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            'txt_valor_mercado_real': valorMercadoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            'txt_tempo_meses': `${tempoAmortizacaoMeses} meses`,
            'txt_taxa_capitalizacao': `${capRateMensalPercentual.toFixed(2)}% a.m.`
        };
        
        Object.keys(updatesTexto).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = updatesTexto[id];
        });
        
    } catch (erro) {
        console.error("❌ Erro no processamento matemático patrimonial:", erro);
    }
}
 
// Vinculação de gatilhos imediatos nos inputs de simulação
function configurarGatilhosImobiliarios() {
    "use strict";
    const inputs = ['txt_area_util', 'sel_cidade_municipio', 'txt_taxa_condominio', 'area_util', 'cidade', 'valor_condominio'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoLocacaoReativa);
            elemento.addEventListener('change', executarCalculoLocacaoReativa);
        }
    });
}
 
// Inicialização segura atrelada ao ciclo de vida do DOM
document.addEventListener('DOMContentLoaded', () => {
    "use strict";
    if (document.getElementById('global-capital-total') || document.querySelector('[data-metric]')) {
        GlobalMetrics.init();
    }
    configurarGatilhosImobiliarios();
    executarCalculoLocacaoReativa();
});
 
window.GlobalMetrics = GlobalMetrics;
// expose a helper expected by a few modules:
window.forcarAtualizacaoMetricasTopboard = () => GlobalMetrics.forceRefresh();
