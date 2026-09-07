/* ==========================================================================
   TERADMAS ERP v2.6
   metrics.js
   MOTOR VISUAL DE MÉTRICAS
   --------------------------------------------------------------------------
   FUNÇÃO:
   - Receber as métricas fornecidas pelo backend Python
   - Atualizar os indicadores das páginas
   - Não gravar dados financeiros
   - Não inventar valores
   - Não recalcular o patrimônio
   - Não duplicar custos
   - Ser reutilizável em qualquer departamento
   ========================================================================== */

"use strict";


/* ==========================================================================
   CONFIGURAÇÃO
   ========================================================================== */

const TERADMAS_METRICS = {

    moeda: "BRL",

    locale: "pt-BR",

    selectors: {

        empresa: [
            "[data-metric='nome_empresa']",
            "#nome-empresa",
            "#empresa-nome"
        ],

        capitalInicial: [
            "[data-metric='capital_total']",
            "#capital-total"
        ],

        capitalDisponivel: [
            "[data-metric='capital_disponivel_total']",
            "#capital-disponivel-total"
        ],

        capitalDepartamento: [
            "[data-metric='capital_disponivel_departamento']",
            "#capital-disponivel-departamento"
        ],

        patrimonio: [
            "[data-metric='patrimonio_ativo_total']",
            "#patrimonio-ativo-total"
        ],

        imoveis: [
            "[data-metric='patrimonio_imoveis']",
            "#patrimonio-imoveis"
        ],

        maquinas: [
            "[data-metric='patrimonio_maquinas']",
            "#patrimonio-maquinas"
        ],

        materiais: [
            "[data-metric='patrimonio_materiais']",
            "#patrimonio-materiais"
        ],

        custoFixo: [
            "[data-metric='custo_fixo_total']",
            "#custo-fixo-total"
        ],

        custoVariavel: [
            "[data-metric='custo_variavel_total']",
            "#custo-variavel-total"
        ],

        fluxoLiquido: [
            "[data-metric='total_movimentacoes_fluxo']",
            "#fluxo-liquido"
        ],

        entradas: [
            "[data-metric='total_entradas_fluxo']",
            "#total-entradas"
        ],

        saidas: [
            "[data-metric='total_saidas_fluxo']",
            "#total-saidas"
        ],

        patrimonioSetor: [
            "[data-metric='patrimonio_isolado_setor']",
            "#patrimonio-setor"
        ],

        custoFixoSetor: [
            "[data-metric='custo_fixo_isolado_setor']",
            "#custo-fixo-setor"
        ],

        custoVariavelSetor: [
            "[data-metric='custo_variavel_isolado_setor']",
            "#custo-variavel-setor"
        ],

        orcamentoSetor: [
            "[data-metric='orcamento_liberado_setor']",
            "#orcamento-setor"
        ]

    }

};


/* ==========================================================================
   FORMATAÇÃO
   ========================================================================== */

function formatarMoeda(valor) {

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "R$ 0,00";
    }

    return numero.toLocaleString(
        TERADMAS_METRICS.locale,
        {
            style: "currency",
            currency: TERADMAS_METRICS.moeda
        }
    );
}


function formatarNumero(valor) {

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "0";
    }

    return numero.toLocaleString(
        TERADMAS_METRICS.locale
    );
}


/* ==========================================================================
   LEITURA SEGURA
   ========================================================================== */

function obterElemento(selectores) {

    if (!Array.isArray(selectores)) {
        return null;
    }

    for (const seletor of selectores) {

        const elemento =
            document.querySelector(seletor);

        if (elemento) {
            return elemento;
        }
    }

    return null;
}


function definirTexto(selectores, valor) {

    const elemento =
        obterElemento(selectores);

    if (!elemento) {
        return;
    }

    elemento.textContent = valor;
}


/* ==========================================================================
   ATUALIZAÇÃO DE UMA MÉTRICA
   ========================================================================== */

function atualizarMetricas(dados) {

    if (!dados || typeof dados !== "object") {

        console.warn(
            "TERADMAS metrics.js: dados financeiros ausentes."
        );

        return;
    }


    /* ----------------------------------------------------------------------
       EMPRESA
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.empresa,
        String(
            dados.nome_empresa ||
            "GRUPO ACADÊMICO"
        ).toUpperCase()
    );


    /* ----------------------------------------------------------------------
       CAPITAL
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.capitalInicial,
        formatarMoeda(
            dados.capital_total
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.capitalDisponivel,
        formatarMoeda(
            dados.capital_disponivel_total
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.capitalDepartamento,
        formatarMoeda(
            dados.capital_disponivel_departamento
        )
    );


    /* ----------------------------------------------------------------------
       PATRIMÔNIO
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.patrimonio,
        formatarMoeda(
            dados.patrimonio_ativo_total
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.imoveis,
        formatarMoeda(
            dados.patrimonio_imoveis
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.maquinas,
        formatarMoeda(
            dados.patrimonio_maquinas
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.materiais,
        formatarMoeda(
            dados.patrimonio_materiais
        )
    );


    /* ----------------------------------------------------------------------
       CUSTOS
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.custoFixo,
        formatarMoeda(
            dados.custo_fixo_total
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.custoVariavel,
        formatarMoeda(
            dados.custo_variavel_total
        )
    );


    /* ----------------------------------------------------------------------
       FLUXO DE CAIXA
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.fluxoLiquido,
        formatarMoeda(
            dados.total_movimentacoes_fluxo
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.entradas,
        formatarMoeda(
            dados.total_entradas_fluxo
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.saidas,
        formatarMoeda(
            dados.total_saidas_fluxo
        )
    );


    /* ----------------------------------------------------------------------
       MÉTRICAS DO SETOR
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.patrimonioSetor,
        formatarMoeda(
            dados.patrimonio_isolado_setor
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.custoFixoSetor,
        formatarMoeda(
            dados.custo_fixo_isolado_setor
        )
    );


    definirTexto(
        TERADMAS_METRICS.selectors.custoVariavelSetor,
        formatarMoeda(
            dados.custo_variavel_isolado_setor
        )
    );


    /* ----------------------------------------------------------------------
       ORÇAMENTO
       ---------------------------------------------------------------------- */

    definirTexto(
        TERADMAS_METRICS.selectors.orcamentoSetor,
        formatarMoeda(
            dados.orcamento_liberado_setor
        )
    );


    /* ----------------------------------------------------------------------
       DISPONIBILIZA OS DADOS PARA OUTROS JS
       ---------------------------------------------------------------------- */

    window.TERADMAS_METRICAS_ATUAIS = {
        ...dados
    };


    /* ----------------------------------------------------------------------
       EVENTO GLOBAL
       ---------------------------------------------------------------------- */

    document.dispatchEvent(
        new CustomEvent(
            "teradmas:metrics-updated",
            {
                detail: dados
            }
        )
    );


    console.info(
        "✅ TERADMAS: métricas financeiras atualizadas."
    );
}


/* ==========================================================================
   API PÚBLICA
   ========================================================================== */

window.TERADMASMetrics = {

    atualizar: atualizarMetricas,

    moeda: formatarMoeda,

    numero: formatarNumero,

    obterDados: function () {

        return window.TERADMAS_METRICAS_ATUAIS
            ? {
                ...window.TERADMAS_METRICAS_ATUAIS
            }
            : null;
    }

};


/* ==========================================================================
   COMPATIBILIDADE COM BACKENDS QUE JÁ ENTREGAM OS DADOS NO HTML
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
         * Caso o HTML já contenha um objeto global:
         *
         * window.METRICAS_FINANCEIRAS
         *
         * ele será utilizado automaticamente.
         */

        if (
            window.METRICAS_FINANCEIRAS &&
            typeof window.METRICAS_FINANCEIRAS === "object"
        ) {

            atualizarMetricas(
                window.METRICAS_FINANCEIRAS
            );
        }

    }
);
