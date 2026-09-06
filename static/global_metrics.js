// ==========================================================================
// TERADMAS ERP v2.6
// PAINEL GLOBAL DE MÉTRICAS CONSOLIDADAS
// ARQUIVO: metrics.js
//
// RESPONSABILIDADES:
// 1. Consumir /api/financeiro/metricas a cada 5 segundos.
// 2. Exibir os valores calculados pelo backend.
// 3. NÃO calcular orçamento ou capital disponível no frontend.
// 4. Permitir que o backend seja a fonte única da verdade financeira.
// ==========================================================================

const GlobalMetrics = {

    dataCache: null,
    lastUpdate: null,
    updateInterval: 5000,
    intervalId: null,

    /**
     * Inicializa o motor global de métricas.
     */
    async init() {
        "use strict";

        try {
            console.log("🚀 Inicializando GlobalMetrics...");

            await this.loadMetrics();

            // Evita criar múltiplos setInterval caso init()
            // seja chamado mais de uma vez.
            if (!this.intervalId) {
                this.intervalId = setInterval(() => {
                    this.loadMetrics();
                }, this.updateInterval);
            }

            console.log("✅ GlobalMetrics ativado. Ciclo: 5 segundos.");

        } catch (erro) {
            console.error(
                "❌ Erro na inicialização das métricas:",
                erro
            );
        }
    },

    /**
     * Consulta o motor financeiro central.
     *
     * IMPORTANTE:
     * O frontend não calcula capital disponível.
     * O backend é responsável por:
     *
     * capital inicial
     * + receitas
     * - despesas
     * = capital disponível
     *
     * E, quando aplicável, pelas quotas dos departamentos.
     */
    async loadMetrics() {
        "use strict";

        try {

            const response = await fetch(
                "/api/financeiro/metricas?dept=global",
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                );
            }

            const data = await response.json();

            if (!data || typeof data !== "object") {
                throw new Error(
                    "Resposta inválida do motor financeiro."
                );
            }

            this.dataCache = data;
            this.lastUpdate = new Date();

            this.renderDashboard();

        } catch (erro) {

            console.error(
                "❌ Falha na sincronização financeira:",
                erro
            );

            this.renderErrorState();
        }
    },

    /**
     * Renderiza os valores recebidos do backend.
     *
     * Nenhuma regra contábil é executada aqui.
     */
    renderDashboard() {
        "use strict";

        if (!this.dataCache) {
            return;
        }

        const data = this.dataCache;

        // ==============================================================
        // FONTE ÚNICA DOS VALORES
        // ==============================================================

        const capitalTotal = this.numeroSeguro(
            data.capital_total
        );

        const capitalDisponivel = this.numeroSeguro(
            data.capital_disponivel_total
        );

        const patrimonioTotal = this.numeroSeguro(
            data.patrimonio_ativo_total
        );

        const custoFixoTotal = this.numeroSeguro(
            data.custo_fixo_geral_empresa ??
            data.custo_fixo_total
        );

        const custoVariavelTotal = this.numeroSeguro(
            data.custo_variavel_total
        );

        // ==============================================================
        // PERCENTUAIS APENAS PARA APRESENTAÇÃO
        // ==============================================================
        //
        // Estes percentuais não alteram o capital.
        // São indicadores visuais.
        //

        const percentualCustoFixo =
            capitalTotal > 0
                ? (custoFixoTotal / capitalTotal) * 100
                : 0;

        const percentualPatrimonio =
            capitalTotal > 0
                ? (patrimonioTotal / capitalTotal) * 100
                : 0;

        const percentualCapitalUtilizado =
            capitalTotal > 0
                ? ((capitalTotal - capitalDisponivel) / capitalTotal) * 100
                : 0;

        // ==============================================================
        // PAINEL FINANCEIRO
        // ==============================================================

        this.updateElement(
            "global-capital-total",
            capitalTotal,
            "currency"
        );

        this.updateElement(
            "global-capital-disponivel",
            capitalDisponivel,
            "currency"
        );

        this.updateElement(
            "global-patrimonio",
            patrimonioTotal,
            "currency"
        );

        this.updateElement(
            "global-custo-fixo",
            custoFixoTotal,
            "currency"
        );

        this.updateElement(
            "global-custo-variavel",
            custoVariavelTotal,
            "currency"
        );

        // ==============================================================
        // INDICADORES
        // ==============================================================

        this.updateElement(
            "global-porcento-capital",
            percentualCustoFixo,
            "percent"
        );

        this.updateElement(
            "global-porcento-patrimonio",
            percentualPatrimonio,
            "percent"
        );

        this.updateElement(
            "global-porcento-disponivel",
            percentualCapitalUtilizado,
            "percent"
        );

        // ==============================================================
        // DADOS FINANCEIROS OPCIONAIS
        // ==============================================================
        //
        // Se o backend já fornecer receitas e despesas,
        // podemos exibi-las sem alterar versões antigas do frontend.
        //

        if (data.receita_total !== undefined) {
            this.updateElement(
                "global-receita-total",
                this.numeroSeguro(data.receita_total),
                "currency"
            );
        }

        if (data.despesa_total !== undefined) {
            this.updateElement(
                "global-despesa-total",
                this.numeroSeguro(data.despesa_total),
                "currency"
            );
        }

        if (data.resultado_caixa !== undefined) {
            this.updateElement(
                "global-resultado-caixa",
                this.numeroSeguro(data.resultado_caixa),
                "currency"
            );
        }

        // ==============================================================
        // QUOTAS
        // ==============================================================

        // Caso o backend forneça a soma das quotas da equipe.
        if (data.percentual_quotas_total !== undefined) {

            this.updateElement(
                "global-percentual-quotas",
                this.numeroSeguro(data.percentual_quotas_total),
                "percent"
            );
        }

        // ==============================================================
        // MARCADOR DE SINCRONIZAÇÃO
        // ==============================================================

        const timestampElem =
            document.getElementById("global-last-update");

        if (timestampElem) {

            timestampElem.innerText =
                `🔄 Sincronizado às ${
                    this.lastUpdate.toLocaleTimeString("pt-BR")
                }`;
        }
    },

    /**
     * Converte valores vindos do Flask/PostgreSQL
     * para número sem produzir NaN.
     */
    numeroSeguro(valor) {

        "use strict";

        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {
            return 0;
        }

        const numero = Number(valor);

        return Number.isFinite(numero)
            ? numero
            : 0;
    },

    /**
     * Formatação centralizada.
     */
    updateElement(elementId, value, format) {

        "use strict";

        const elem =
            document.getElementById(elementId);

        if (!elem) {
            return;
        }

        let formatted = value;

        if (format === "currency") {

            formatted =
                this.numeroSeguro(value).toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                );

        } else if (format === "percent") {

            formatted =
                `${this.numeroSeguro(value).toFixed(2)}%`;

        } else if (format === "number") {

            formatted =
                this.numeroSeguro(value).toLocaleString(
                    "pt-BR"
                );
        }

        elem.innerText = formatted;
    },

    /**
     * Mostra estado seguro quando a API não responde.
     *
     * Não inventa valores financeiros.
     */
    renderErrorState() {

        "use strict";

        const ids = [
            "global-capital-total",
            "global-capital-disponivel",
            "global-patrimonio",
            "global-custo-fixo",
            "global-custo-variavel"
        ];

        ids.forEach(id => {

            const elem =
                document.getElementById(id);

            if (elem) {
                elem.innerText = "—";
            }
        });

        const timestampElem =
            document.getElementById("global-last-update");

        if (timestampElem) {

            timestampElem.innerText =
                "⚠️ Falha na sincronização financeira";
        }
    },

    /**
     * Retorna resumo textual das métricas atuais.
     */
    getSummary() {

        "use strict";

        if (!this.dataCache) {
            return "Sem dados disponíveis no momento.";
        }

        const data = this.dataCache;

        return `
Capital Inicial: ${this.formatCurrency(data.capital_total)}
Capital Disponível: ${this.formatCurrency(data.capital_disponivel_total)}
Patrimônio: ${this.formatCurrency(data.patrimonio_ativo_total)}
Custo Fixo: ${this.formatCurrency(data.custo_fixo_geral_empresa)}
Custo Variável: ${this.formatCurrency(data.custo_variavel_total)}
        `.trim();
    },

    /**
     * Formatação utilizada pelo resumo.
     */
    formatCurrency(valor) {

        return this.numeroSeguro(valor).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
    },

    /**
     * Força uma atualização imediata.
     */
    async forceRefresh() {

        "use strict";

        console.log(
            "🔄 Sincronização financeira manual..."
        );

        await this.loadMetrics();
    }
};


// ==========================================================================
// MATRIZ DE LOCAÇÃO
// ==========================================================================

const MATRIZ_LOCACAO_RMC = {

    "Curitiba": {
        valor_m2: 32.50,
        condominio_base: 350.00,
        cap_rate: 0.0055,
        igpm: 0.0425
    },

    "São José dos Pinhais": {
        valor_m2: 24.00,
        condominio_base: 280.00,
        cap_rate: 0.0048,
        igpm: 0.0425
    },

    "Pinhais": {
        valor_m2: 26.50,
        condominio_base: 300.00,
        cap_rate: 0.0052,
        igpm: 0.0425
    },

    "Araucária": {
        valor_m2: 22.00,
        condominio_base: 250.00,
        cap_rate: 0.0045,
        igpm: 0.0425
    },

    "Campo Largo": {
        valor_m2: 19.50,
        condominio_base: 220.00,
        cap_rate: 0.0042,
        igpm: 0.0425
    }
};


// ==========================================================================
// TABELA DE SALÁRIOS
// ==========================================================================

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


// ==========================================================================
// CÁLCULO IMOBILIÁRIO REATIVO
// ==========================================================================

function executarCalculoLocacaoReativa() {

    "use strict";

    try {

        const areaUtil =
            parseFloat(
                document.getElementById("txt_area_util")?.value ||
                document.getElementById("area_util")?.value
            ) || 0;

        const cidade =
            document.getElementById("sel_cidade_municipio")?.value ||
            document.getElementById("cidade")?.value ||
            "Curitiba";

        const paramCidade =
            MATRIZ_LOCACAO_RMC[cidade] ||
            MATRIZ_LOCACAO_RMC["Curitiba"];

        if (areaUtil <= 0) {
            return;
        }

        const aluguelCalculado =
            areaUtil * paramCidade.valor_m2;

        const condominioInformado =
            parseFloat(
                document.getElementById(
                    "txt_taxa_condominio"
                )?.value ||
                document.getElementById(
                    "valor_condominio"
                )?.value
            ) || paramCidade.condominio_base;

        const taxaAnualCalculada =
            (aluguelCalculado * 12) +
            (condominioInformado * 12);

        const mapeamentoInputs = {

            "txt_aluguel_calculado":
                aluguelCalculado,

            "valor_aluguel":
                aluguelCalculado,

            "txt_taxa_anual":
                taxaAnualCalculada,

            "taxa_anual":
                taxaAnualCalculada
        };

        Object.keys(mapeamentoInputs).forEach(id => {

            const input =
                document.getElementById(id);

            if (input) {
                input.value =
                    mapeamentoInputs[id].toFixed(2);
            }
        });

        const projecaoIgpmAnual =
            aluguelCalculado *
            12 *
            paramCidade.igpm;

        const valorMercadoEstimado =
            paramCidade.cap_rate > 0
                ? (aluguelCalculado * 12) /
                  (paramCidade.cap_rate * 12)
                : 0;

        const tempoAmortizacaoMeses = 120;

        const capRateMensalPercentual =
            paramCidade.cap_rate * 100;

        const updatesTexto = {

            "txt_igpm_correcao":
                projecaoIgpmAnual.toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                ),

            "txt_valor_mercado_real":
                valorMercadoEstimado.toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                ),

            "txt_tempo_meses":
                `${tempoAmortizacaoMeses} meses`,

            "txt_taxa_capitalizacao":
                `${capRateMensalPercentual.toFixed(2)}% a.m.`
        };

        Object.keys(updatesTexto).forEach(id => {

            const el =
                document.getElementById(id);

            if (el) {
                el.innerText =
                    updatesTexto[id];
            }
        });

    } catch (erro) {

        console.error(
            "❌ Erro no cálculo patrimonial imobiliário:",
            erro
        );
    }
}


// ==========================================================================
// GATILHOS IMOBILIÁRIOS
// ==========================================================================

function configurarGatilhosImobiliarios() {

    "use strict";

    const inputs = [

        "txt_area_util",
        "sel_cidade_municipio",
        "txt_taxa_condominio",

        "area_util",
        "cidade",
        "valor_condominio"
    ];

    inputs.forEach(id => {

        const elemento =
            document.getElementById(id);

        if (elemento) {

            elemento.addEventListener(
                "input",
                executarCalculoLocacaoReativa
            );

            elemento.addEventListener(
                "change",
                executarCalculoLocacaoReativa
            );
        }
    });
}


// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        "use strict";

        if (
            document.getElementById(
                "global-capital-total"
            ) ||
            document.querySelector(
                "[data-metric]"
            )
        ) {

            GlobalMetrics.init();
        }

        configurarGatilhosImobiliarios();

        executarCalculoLocacaoReativa();
    }
);


// ==========================================================================
// EXPOSIÇÃO GLOBAL
// ==========================================================================

window.GlobalMetrics = GlobalMetrics;

window.forcarAtualizacaoMetricasTopboard =
    () => GlobalMetrics.forceRefresh();
