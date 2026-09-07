/* ==========================================================================
   TERADMAS ERP v2.6
   metrics.js
   MOTOR DE MÉTRICAS DA INTERFACE
   ==========================================================================

   PRINCÍPIO CENTRAL:

   O JavaScript NÃO calcula o patrimônio financeiro da empresa.

   O Python / backend é a fonte oficial dos valores.

   O metrics.js:
       1. recebe os dados financeiros;
       2. normaliza os valores;
       3. atualiza os KPIs;
       4. atualiza barras de progresso;
       5. atualiza dados globais e setoriais;
       6. mantém todas as páginas visualmente sincronizadas.

   --------------------------------------------------------------------------

   REGRA FINANCEIRA CENTRAL:

       Capital de Giro =
           Capital Inicial
         + Fluxo de Caixa Líquido
         - Patrimônio Ativo Atual
         - Custos Fixos Totais
         - Custos Variáveis Totais

   IMPORTANTE:

   O patrimônio é DINÂMICO.

       aquisição  -> aumenta patrimônio
       exclusão   -> diminui patrimônio
       nova compra -> aumenta novamente

   Nenhum patrimônio histórico é mantido artificialmente pelo JS.

   ========================================================================== */

"use strict";


/* ==========================================================================
   CONFIGURAÇÃO
   ========================================================================== */

const TERADMAS_METRICS = {

    endpoint: "/api/metrics",

    refreshInterval: 15000,

    moeda: "BRL",

    locale: "pt-BR"

};


/* ==========================================================================
   ESTADO CENTRAL DA INTERFACE
   ========================================================================== */

const estadoMetricas = {

    carregado: false,

    carregando: false,

    erro: null,

    dados: {

        nome_empresa: "GRUPO ACADÊMICO",

        capital_total: 0,

        capital_disponivel_total: 0,

        capital_disponivel_departamento: 0,

        patrimonio_ativo_total: 0,

        custo_fixo_total: 0,

        custo_variavel_total: 0,

        custo_fixo_geral_empresa: 0,

        patrimonio_isolado_setor: 0,

        custo_fixo_isolado_setor: 0,

        custo_variavel_isolado_setor: 0,

        total_movimentacoes_fluxo: 0,

        total_entradas_fluxo: 0,

        total_saidas_fluxo: 0,

        patrimonio_imoveis: 0,

        patrimonio_maquinas: 0,

        patrimonio_materiais: 0

    }

};


/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */

function numero(valor, padrao = 0) {

    if (valor === null || valor === undefined) {
        return padrao;
    }

    if (typeof valor === "number") {

        return Number.isFinite(valor)
            ? valor
            : padrao;

    }

    const convertido = Number(
        String(valor)
            .replace(/\./g, "")
            .replace(",", ".")
    );

    return Number.isFinite(convertido)
        ? convertido
        : padrao;
}


/* --------------------------------------------------------------------------
   Formatação monetária
   -------------------------------------------------------------------------- */

function moeda(valor) {

    const numeroSeguro = numero(valor, 0);

    return new Intl.NumberFormat(
        TERADMAS_METRICS.locale,
        {
            style: "currency",
            currency: TERADMAS_METRICS.moeda,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(numeroSeguro);

}


/* --------------------------------------------------------------------------
   Formatação numérica
   -------------------------------------------------------------------------- */

function decimal(valor) {

    return new Intl.NumberFormat(
        TERADMAS_METRICS.locale,
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(numero(valor));

}


/* ==========================================================================
   ACESSO SEGURO AO DOM
   ========================================================================== */

function elemento(id) {

    return document.getElementById(id);

}


function definirTexto(id, valor) {

    const el = elemento(id);

    if (!el) {
        return;
    }

    el.textContent = valor;

}


/* ==========================================================================
   NORMALIZAÇÃO DOS DADOS RECEBIDOS DO PYTHON
   ========================================================================== */

function normalizarMetricas(dados) {

    dados = dados || {};

    return {

        nome_empresa:
            dados.nome_empresa ||
            "GRUPO ACADÊMICO",

        capital_total:
            numero(dados.capital_total),

        capital_disponivel_total:
            numero(dados.capital_disponivel_total),

        capital_disponivel_departamento:
            numero(
                dados.capital_disponivel_departamento
            ),

        patrimonio_ativo_total:
            numero(
                dados.patrimonio_ativo_total
            ),

        custo_fixo_total:
            numero(
                dados.custo_fixo_total
            ),

        custo_variavel_total:
            numero(
                dados.custo_variavel_total
            ),

        custo_fixo_geral_empresa:
            numero(
                dados.custo_fixo_geral_empresa
            ),

        patrimonio_isolado_setor:
            numero(
                dados.patrimonio_isolado_setor
            ),

        custo_fixo_isolado_setor:
            numero(
                dados.custo_fixo_isolado_setor
            ),

        custo_variavel_isolado_setor:
            numero(
                dados.custo_variavel_isolado_setor
            ),

        total_movimentacoes_fluxo:
            numero(
                dados.total_movimentacoes_fluxo
            ),

        total_entradas_fluxo:
            numero(
                dados.total_entradas_fluxo
            ),

        total_saidas_fluxo:
            numero(
                dados.total_saidas_fluxo
            ),

        patrimonio_imoveis:
            numero(
                dados.patrimonio_imoveis
            ),

        patrimonio_maquinas:
            numero(
                dados.patrimonio_maquinas
            ),

        patrimonio_materiais:
            numero(
                dados.patrimonio_materiais
            )

    };

}


/* ==========================================================================
   CARGA DOS DADOS
   ========================================================================== */

async function carregarMetricas(opcoes = {}) {

    if (estadoMetricas.carregando) {
        return estadoMetricas.dados;
    }

    estadoMetricas.carregando = true;
    estadoMetricas.erro = null;

    try {

        const parametros = new URLSearchParams();

        if (opcoes.equipeId !== undefined) {

            parametros.set(
                "equipe_id",
                opcoes.equipeId
            );

        }

        if (opcoes.departamento) {

            parametros.set(
                "departamento",
                opcoes.departamento
            );

        }

        const url = parametros.toString()
            ? `${TERADMAS_METRICS.endpoint}?${parametros}`
            : TERADMAS_METRICS.endpoint;


        const resposta = await fetch(
            url,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            }
        );


        if (!resposta.ok) {

            throw new Error(
                `Erro HTTP ${resposta.status}`
            );

        }


        const dados = await resposta.json();


        estadoMetricas.dados =
            normalizarMetricas(dados);

        estadoMetricas.carregado = true;


        atualizarInterface(
            estadoMetricas.dados
        );


        document.dispatchEvent(
            new CustomEvent(
                "teradmas:metricas-atualizadas",
                {
                    detail: estadoMetricas.dados
                }
            )
        );


        return estadoMetricas.dados;


    } catch (erro) {

        estadoMetricas.erro = erro;

        console.error(
            "❌ TERADMAS: erro ao carregar métricas:",
            erro
        );

        mostrarErroMetricas(
            erro
        );

        return estadoMetricas.dados;


    } finally {

        estadoMetricas.carregando = false;

    }

}


/* ==========================================================================
   ATUALIZAÇÃO PRINCIPAL DA INTERFACE
   ========================================================================== */

function atualizarInterface(dados) {

    atualizarIdentificacaoEmpresa(
        dados
    );

    atualizarFinanceiroGlobal(
        dados
    );

    atualizarFluxoCaixa(
        dados
    );

    atualizarPatrimonio(
        dados
    );

    atualizarCustos(
        dados
    );

    atualizarMetricasSetoriais(
        dados
    );

    atualizarOrcamento(
        dados
    );

}


/* ==========================================================================
   IDENTIFICAÇÃO DA EMPRESA
   ========================================================================== */

function atualizarIdentificacaoEmpresa(dados) {

    definirTexto(
        "nome-empresa",
        String(
            dados.nome_empresa ||
            "GRUPO ACADÊMICO"
        ).toUpperCase()
    );


    definirTexto(
        "empresa-nome",
        String(
            dados.nome_empresa ||
            "GRUPO ACADÊMICO"
        ).toUpperCase()
    );

}


/* ==========================================================================
   FINANCEIRO GLOBAL
   ========================================================================== */

function atualizarFinanceiroGlobal(dados) {

    definirTexto(
        "capital-total",
        moeda(
            dados.capital_total
        )
    );


    definirTexto(
        "capital-disponivel",
        moeda(
            dados.capital_disponivel_total
        )
    );


    definirTexto(
        "capital-disponivel-total",
        moeda(
            dados.capital_disponivel_total
        )
    );


    definirTexto(
        "capital-giro",
        moeda(
            dados.capital_disponivel_total
        )
    );


    definirTexto(
        "capital-giro-total",
        moeda(
            dados.capital_disponivel_total
        )
    );

}


/* ==========================================================================
   FLUXO DE CAIXA
   ========================================================================== */

function atualizarFluxoCaixa(dados) {

    definirTexto(
        "fluxo-liquido",
        moeda(
            dados.total_movimentacoes_fluxo
        )
    );


    definirTexto(
        "fluxo-caixa",
        moeda(
            dados.total_movimentacoes_fluxo
        )
    );


    definirTexto(
        "total-entradas",
        moeda(
            dados.total_entradas_fluxo
        )
    );


    definirTexto(
        "total-saidas",
        moeda(
            dados.total_saidas_fluxo
        )
    );

}


/* ==========================================================================
   PATRIMÔNIO
   ========================================================================== */

function atualizarPatrimonio(dados) {

    definirTexto(
        "patrimonio-total",
        moeda(
            dados.patrimonio_ativo_total
        )
    );


    definirTexto(
        "patrimonio-ativo-total",
        moeda(
            dados.patrimonio_ativo_total
        )
    );


    definirTexto(
        "patrimonio-imoveis",
        moeda(
            dados.patrimonio_imoveis
        )
    );


    definirTexto(
        "patrimonio-maquinas",
        moeda(
            dados.patrimonio_maquinas
        )
    );


    definirTexto(
        "patrimonio-materiais",
        moeda(
            dados.patrimonio_materiais
        )
    );

}


/* ==========================================================================
   CUSTOS
   ========================================================================== */

function atualizarCustos(dados) {

    definirTexto(
        "custo-fixo-total",
        moeda(
            dados.custo_fixo_total
        )
    );


    definirTexto(
        "custo-fixo-geral",
        moeda(
            dados.custo_fixo_geral_empresa
        )
    );


    definirTexto(
        "custo-variavel-total",
        moeda(
            dados.custo_variavel_total
        )
    );


    definirTexto(
        "custos-totais",
        moeda(
            dados.custo_fixo_total +
            dados.custo_variavel_total
        )
    );

}


/* ==========================================================================
   MÉTRICAS DO DEPARTAMENTO
   ========================================================================== */

function atualizarMetricasSetoriais(dados) {

    definirTexto(
        "patrimonio-setor",
        moeda(
            dados.patrimonio_isolado_setor
        )
    );


    definirTexto(
        "patrimonio-isolado-setor",
        moeda(
            dados.patrimonio_isolado_setor
        )
    );


    definirTexto(
        "custo-fixo-setor",
        moeda(
            dados.custo_fixo_isolado_setor
        )
    );


    definirTexto(
        "custo-variavel-setor",
        moeda(
            dados.custo_variavel_isolado_setor
        )
    );


    definirTexto(
        "capital-disponivel-departamento",
        moeda(
            dados.capital_disponivel_departamento
        )
    );

}


/* ==========================================================================
   ORÇAMENTO
   ========================================================================== */

function atualizarOrcamento(dados) {

    definirTexto(
        "orcamento-disponivel",
        moeda(
            dados.capital_disponivel_departamento
        )
    );

}


/* ==========================================================================
   BARRAS DE PROGRESSO
   ========================================================================== */

function atualizarProgresso(

    elementoId,
    valor,
    total

) {

    const barra =
        elemento(elementoId);

    if (!barra) {
        return;
    }


    const valorSeguro =
        numero(valor);


    const totalSeguro =
        numero(total);


    let percentual = 0;


    if (totalSeguro > 0) {

        percentual =
            (valorSeguro / totalSeguro) * 100;

    }


    percentual =
        Math.max(
            0,
            Math.min(
                100,
                percentual
            )
        );


    barra.style.width =
        `${percentual}%`;


    barra.setAttribute(
        "aria-valuenow",
        percentual.toFixed(1)
    );

}


/* ==========================================================================
   ESTADO VISUAL DE VALORES
   ========================================================================== */

function atualizarEstadoFinanceiro(

    elementoId,
    valor

) {

    const el =
        elemento(elementoId);

    if (!el) {
        return;
    }


    el.classList.remove(
        "valor-positivo",
        "valor-negativo",
        "valor-zero"
    );


    const numeroValor =
        numero(valor);


    if (numeroValor > 0) {

        el.classList.add(
            "valor-positivo"
        );

    } else if (numeroValor < 0) {

        el.classList.add(
            "valor-negativo"
        );

    } else {

        el.classList.add(
            "valor-zero"
        );

    }

}


/* ==========================================================================
   ERROS
   ========================================================================== */

function mostrarErroMetricas(erro) {

    const elementosErro =
        document.querySelectorAll(
            "[data-metric-error]"
        );


    elementosErro.forEach(
        el => {

            el.textContent =
                "Não foi possível atualizar os dados financeiros.";

            el.hidden = false;

        }
    );

}


/* ==========================================================================
   ATUALIZAÇÃO MANUAL
   ========================================================================== */

async function atualizarMetricasAgora(opcoes = {}) {

    return await carregarMetricas(
        opcoes
    );

}


/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */

function iniciarMetricas(opcoes = {}) {

    carregarMetricas(
        opcoes
    );


    if (
        TERADMAS_METRICS.refreshInterval > 0
    ) {

        window.setInterval(
            () => {

                carregarMetricas(
                    opcoes
                );

            },
            TERADMAS_METRICS.refreshInterval
        );

    }

}


/* ==========================================================================
   API PÚBLICA
   ========================================================================== */

window.TERADMAS_METRICS = {

    carregar:
        carregarMetricas,

    atualizar:
        atualizarMetricasAgora,

    obterEstado:
        () => estadoMetricas,

    obterDados:
        () => estadoMetricas.dados,

    moeda:
        moeda,

    decimal:
        decimal

};


/* ==========================================================================
   AUTO START
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        iniciarMetricas();

    }
);


/* ==========================================================================
   FIM DO metrics.js
   ========================================================================== */
