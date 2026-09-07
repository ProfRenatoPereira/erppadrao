/* ==========================================================================
   TERADMAS ERP v2.6
   metrics.js
   ==========================================================================

   MOTOR DE APRESENTAÇÃO DAS MÉTRICAS

   RESPONSABILIDADE:

       PostgreSQL
            ↓
       GerenciadorCaixa.py
            ↓
          master.py
            ↓
        metrics.js
            ↓
           HTML

   O metrics.js NÃO calcula:
       - capital
       - patrimônio
       - custos
       - caixa
       - orçamento

   Ele somente:
       - identifica a equipe;
       - identifica o departamento;
       - consulta a API central;
       - recebe os dados;
       - atualiza a interface;
       - apresenta erros de forma segura.

   ARQUITETURA MULTIEMPRESA
   Cada equipe opera somente os dados de sua própria empresa.

   ========================================================================== */


"use strict";


/* ==========================================================================
   CONFIGURAÇÃO CENTRAL
   ========================================================================== */

const ERP_METRICS_CONFIG = {

    endpoint: "/api/metrics",

    contextoEndpoint: "/api/contexto",

    resumoEndpoint: "/api/resumo",

    intervaloAtualizacao: 30000,

    timeout: 10000,

    moeda: "BRL",

    locale: "pt-BR"

};


/* ==========================================================================
   ESTADO DO MÓDULO
   ========================================================================== */

const ERP_METRICS = {

    equipeId: null,

    departamento: null,

    nomeEmpresa: null,

    dados: {},

    carregando: false,

    erro: null,

    timer: null

};


/* ==========================================================================
   FORMATAÇÃO MONETÁRIA
   ========================================================================== */

function formatarMoeda(valor) {

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "R$ 0,00";
    }

    return new Intl.NumberFormat(
        ERP_METRICS_CONFIG.locale,
        {
            style: "currency",
            currency: ERP_METRICS_CONFIG.moeda,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(numero);

}


/* ==========================================================================
   FORMATAÇÃO NUMÉRICA
   ========================================================================== */

function formatarNumero(valor) {

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "0";
    }

    return new Intl.NumberFormat(
        ERP_METRICS_CONFIG.locale,
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(numero);

}


/* ==========================================================================
   CONVERSÃO SEGURA
   ========================================================================== */

function numeroSeguro(valor) {

    const numero = Number(valor);

    return Number.isFinite(numero)
        ? numero
        : 0;

}


/* ==========================================================================
   OBTÉM EQUIPE_ID DA URL
   ========================================================================== */

function obterEquipeDaURL() {

    const parametros = new URLSearchParams(
        window.location.search
    );

    return (
        parametros.get("equipe_id") ||
        parametros.get("equipe") ||
        null
    );

}


/* ==========================================================================
   OBTÉM DEPARTAMENTO DA URL
   ========================================================================== */

function obterDepartamentoDaURL() {

    const parametros = new URLSearchParams(
        window.location.search
    );

    return (
        parametros.get("departamento") ||
        null
    );

}


/* ==========================================================================
   OBTÉM CONTEXTO DA EMPRESA
   ========================================================================== */

async function carregarContexto() {

    try {

        const resposta = await fetch(
            ERP_METRICS_CONFIG.contextoEndpoint,
            {
                method: "GET",

                credentials: "same-origin",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!resposta.ok) {
            return false;
        }


        const dados = await resposta.json();


        if (!dados.sucesso) {
            return false;
        }


        ERP_METRICS.equipeId =
            dados.equipe_id ||
            ERP_METRICS.equipeId;


        ERP_METRICS.nomeEmpresa =
            dados.nome_empresa ||
            ERP_METRICS.nomeEmpresa;


        ERP_METRICS.departamento =
            dados.departamento ||
            ERP_METRICS.departamento;


        return true;

    }

    catch (erro) {

        console.warn(
            "Não foi possível carregar o contexto:",
            erro
        );

        return false;
    }

}


/* ==========================================================================
   PREPARA CONTEXTO
   ========================================================================== */

async function prepararContexto() {

    /*
       Primeiro tenta obter o contexto da sessão.

       Isso é o comportamento esperado em produção:
       a equipe autenticada determina a empresa.

       Os parâmetros da URL permanecem como compatibilidade
       para testes e desenvolvimento.
    */

    ERP_METRICS.equipeId =
        obterEquipeDaURL();


    ERP_METRICS.departamento =
        obterDepartamentoDaURL();


    await carregarContexto();


    /*
       Se ainda não houver equipe, interrompe a consulta.

       NÃO inventamos uma equipe padrão.
    */

    if (!ERP_METRICS.equipeId) {

        mostrarErro(
            "Equipe não identificada."
        );

        return false;
    }


    return true;

}


/* ==========================================================================
   MONTA URL DA API
   ========================================================================== */

function montarURLMetricas() {

    const parametros = new URLSearchParams();


    /*
       Se a sessão já identificar a equipe,
       o servidor poderá utilizar a sessão.

       Mesmo assim, durante a fase de desenvolvimento,
       mantemos equipe_id compatível.
    */

    if (ERP_METRICS.equipeId) {

        parametros.set(
            "equipe_id",
            ERP_METRICS.equipeId
        );

    }


    if (ERP_METRICS.departamento) {

        parametros.set(
            "departamento",
            ERP_METRICS.departamento
        );

    }


    const query =
        parametros.toString();


    if (!query) {

        return ERP_METRICS_CONFIG.endpoint;

    }


    return (
        ERP_METRICS_CONFIG.endpoint +
        "?" +
        query
    );

}


/* ==========================================================================
   FETCH COM TIMEOUT
   ========================================================================== */

async function buscarComTimeout(
    url,
    opcoes = {}
) {

    const controlador =
        new AbortController();


    const temporizador =
        setTimeout(
            () => controlador.abort(),
            ERP_METRICS_CONFIG.timeout
        );


    try {

        return await fetch(
            url,
            {
                ...opcoes,

                signal:
                    controlador.signal,

                credentials:
                    "same-origin",

                headers: {
                    "Accept":
                        "application/json",

                    ...(opcoes.headers || {})
                }
            }
        );

    }

    finally {

        clearTimeout(
            temporizador
        );

    }

}


/* ==========================================================================
   CARREGA MÉTRICAS
   ========================================================================== */

async function carregarMetricas(
    mostrarIndicador = true
) {

    if (ERP_METRICS.carregando) {
        return;
    }


    ERP_METRICS.carregando = true;


    if (mostrarIndicador) {
        mostrarCarregando();
    }


    try {

        const contextoOK =
            await prepararContexto();


        if (!contextoOK) {
            return;
        }


        const url =
            montarURLMetricas();


        const resposta =
            await buscarComTimeout(
                url,
                {
                    method: "GET"
                }
            );


        let dados;


        try {

            dados =
                await resposta.json();

        }

        catch (erro) {

            throw new Error(
                "A API retornou uma resposta inválida."
            );

        }


        if (!resposta.ok) {

            throw new Error(
                dados.erro ||
                "Erro ao consultar as métricas."
            );

        }


        if (!dados.sucesso) {

            throw new Error(
                dados.erro ||
                "Não foi possível carregar as métricas."
            );

        }


        ERP_METRICS.dados =
            dados;


        ERP_METRICS.erro =
            null;


        atualizarInterface(
            dados
        );


        atualizarNomeEmpresa(
            dados.nome_empresa ||
            ERP_METRICS.nomeEmpresa
        );


        atualizarIdentificacaoEquipe(
            dados.equipe_id ||
            ERP_METRICS.equipeId
        );


        atualizarDepartamento(
            dados.departamento ||
            ERP_METRICS.departamento
        );


        ocultarErro();


    }

    catch (erro) {

        console.error(
            "Erro no carregamento das métricas:",
            erro
        );


        ERP_METRICS.erro =
            erro.message ||
            "Erro desconhecido.";


        mostrarErro(
            ERP_METRICS.erro
        );

    }

    finally {

        ERP_METRICS.carregando =
            false;

        ocultarCarregando();

    }

}


/* ==========================================================================
   ATUALIZA INTERFACE
   ========================================================================== */

function atualizarInterface(dados) {

    /*
       CAPITAL
    */

    definirValor(
        [
            "capital_total",
            "capital-inicial",
            "capitalInicial"
        ],
        formatarMoeda(
            dados.capital_total
        )
    );


    /*
       CAPITAL DISPONÍVEL
    */

    definirValor(
        [
            "capital_disponivel_total",
            "capital-disponivel",
            "capitalDisponivel"
        ],
        formatarMoeda(
            dados.capital_disponivel_total
        )
    );


    /*
       PATRIMÔNIO
    */

    definirValor(
        [
            "patrimonio_ativo_total",
            "patrimonio-total",
            "patrimonio"
        ],
        formatarMoeda(
            dados.patrimonio_ativo_total
        )
    );


    /*
       CUSTO FIXO
    */

    definirValor(
        [
            "custo_fixo_total",
            "custo-fixo",
            "custoFixo"
        ],
        formatarMoeda(
            dados.custo_fixo_total
        )
    );


    /*
       CUSTO VARIÁVEL
    */

    definirValor(
        [
            "custo_variavel_total",
            "custo-variavel",
            "custoVariavel"
        ],
        formatarMoeda(
            dados.custo_variavel_total
        )
    );


    /*
       FLUXO DE CAIXA
    */

    definirValor(
        [
            "total_movimentacoes_fluxo",
            "fluxo-caixa",
            "fluxoCaixa"
        ],
        formatarMoeda(
            dados.total_movimentacoes_fluxo
        )
    );


    /*
       ENTRADAS
    */

    definirValor(
        [
            "total_entradas_fluxo",
            "total-entradas",
            "entradas"
        ],
        formatarMoeda(
            dados.total_entradas_fluxo
        )
    );


    /*
       SAÍDAS
    */

    definirValor(
        [
            "total_saidas_fluxo",
            "total-saidas",
            "saidas"
        ],
        formatarMoeda(
            dados.total_saidas_fluxo
        )
    );


    /*
       ATIVOS INDIVIDUAIS
    */

    definirValor(
        [
            "patrimonio_imoveis",
            "patrimonio-imoveis"
        ],
        formatarMoeda(
            dados.patrimonio_imoveis
        )
    );


    definirValor(
        [
            "patrimonio_maquinas",
            "patrimonio-maquinas"
        ],
        formatarMoeda(
            dados.patrimonio_maquinas
        )
    );


    definirValor(
        [
            "patrimonio_materiais",
            "patrimonio-materiais"
        ],
        formatarMoeda(
            dados.patrimonio_materiais
        )
    );


    /*
       ALUGUEL
    */

    definirValor(
        [
            "valor_aluguel_global",
            "valor-aluguel",
            "aluguel"
        ],
        formatarMoeda(
            dados.valor_aluguel_global
        )
    );


    /*
       MÉTRICAS DO DEPARTAMENTO
    */

    definirValor(
        [
            "capital_disponivel_departamento",
            "capital-departamento"
        ],
        formatarMoeda(
            dados.capital_disponivel_departamento
        )
    );


    definirValor(
        [
            "patrimonio_isolado_setor",
            "patrimonio-setor"
        ],
        formatarMoeda(
            dados.patrimonio_isolado_setor
        )
    );


    definirValor(
        [
            "custo_fixo_isolado_setor",
            "custo-fixo-setor"
        ],
        formatarMoeda(
            dados.custo_fixo_isolado_setor
        )
    );


    definirValor(
        [
            "custo_variavel_isolado_setor",
            "custo-variavel-setor"
        ],
        formatarMoeda(
            dados.custo_variavel_isolado_setor
        )
    );


    /*
       BARRAS DE PROGRESSO
    */

    atualizarProgressos(
        dados
    );

}


/* ==========================================================================
   DEFINE VALOR EM ELEMENTOS
   ========================================================================== */

function definirValor(
    ids,
    valor
) {

    if (!Array.isArray(ids)) {
        ids = [ids];
    }


    ids.forEach(
        id => {

            const elemento =
                document.getElementById(id);


            if (elemento) {

                elemento.textContent =
                    valor;

            }

        }
    );

}


/* ==========================================================================
   ATUALIZA NOME DA EMPRESA
   ========================================================================== */

function atualizarNomeEmpresa(
    nome
) {

    if (!nome) {
        return;
    }


    const nomeNormalizado =
        String(nome).trim();


    if (!nomeNormalizado) {
        return;
    }


    document
        .querySelectorAll(
            "[data-empresa], " +
            "#nome_empresa, " +
            "#nome-empresa, " +
            ".nome-empresa"
        )
        .forEach(
            elemento => {

                elemento.textContent =
                    nomeNormalizado;

            }
        );

}


/* ==========================================================================
   ATUALIZA EQUIPE
   ========================================================================== */

function atualizarIdentificacaoEquipe(
    equipeId
) {

    if (
        equipeId === null ||
        equipeId === undefined ||
        equipeId === ""
    ) {
        return;
    }


    document
        .querySelectorAll(
            "[data-equipe], " +
            "#equipe_id, " +
            "#equipe-id"
        )
        .forEach(
            elemento => {

                elemento.textContent =
                    equipeId;

            }
        );

}


/* ==========================================================================
   ATUALIZA DEPARTAMENTO
   ========================================================================== */

function atualizarDepartamento(
    departamento
) {

    if (!departamento) {
        return;
    }


    document
        .querySelectorAll(
            "[data-departamento], " +
            "#departamento-atual, " +
            "#departamento"
        )
        .forEach(
            elemento => {

                elemento.textContent =
                    String(
                        departamento
                    ).toUpperCase();

            }
        );

}


/* ==========================================================================
   BARRAS DE PROGRESSO
   ========================================================================== */

function atualizarProgressos(
    dados
) {

    const capital =
        numeroSeguro(
            dados.capital_total
        );


    const disponivel =
        numeroSeguro(
            dados.capital_disponivel_total
        );


    if (capital <= 0) {
        return;
    }


    const percentualDisponivel =
        Math.max(
            0,
            Math.min(
                100,
                (
                    disponivel /
                    capital
                ) * 100
            )
        );


    document
        .querySelectorAll(
            "[data-progress='capital-disponivel']"
        )
        .forEach(
            barra => {

                barra.style.width =
                    percentualDisponivel + "%";

            }
        );


    document
        .querySelectorAll(
            ".progress-bar-fill"
        )
        .forEach(
            barra => {

                /*
                   Somente atualiza barras explicitamente
                   marcadas como pertencentes ao capital disponível.
                */

                if (
                    barra.dataset.progress ===
                    "capital-disponivel"
                ) {

                    barra.style.width =
                        percentualDisponivel + "%";

                }

            }
        );

}


/* ==========================================================================
   INDICADOR DE CARREGAMENTO
   ========================================================================== */

function mostrarCarregando() {

    document
        .querySelectorAll(
            "[data-metric-loading]"
        )
        .forEach(
            elemento => {

                elemento.hidden =
                    false;

            }
        );

}


/* ==========================================================================
   OCULTA INDICADOR
   ========================================================================== */

function ocultarCarregando() {

    document
        .querySelectorAll(
            "[data-metric-loading]"
        )
        .forEach(
            elemento => {

                elemento.hidden =
                    true;

            }
        );

}


/* ==========================================================================
   ERRO
   ========================================================================== */

function mostrarErro(
    mensagem
) {

    const mensagemFinal =
        mensagem ||
        "Não foi possível carregar os dados.";


    document
        .querySelectorAll(
            "[data-metric-error]"
        )
        .forEach(
            elemento => {

                elemento.textContent =
                    mensagemFinal;

                elemento.hidden =
                    false;

            }
        );


    /*
       Compatibilidade com páginas que possuam
       um elemento padrão de erro.
    */

    const erroPadrao =
        document.getElementById(
            "metric-error"
        );


    if (erroPadrao) {

        erroPadrao.textContent =
            mensagemFinal;

        erroPadrao.hidden =
            false;

    }

}


/* ==========================================================================
   OCULTA ERRO
   ========================================================================== */

function ocultarErro() {

    document
        .querySelectorAll(
            "[data-metric-error]"
        )
        .forEach(
            elemento => {

                elemento.hidden =
                    true;

            }
        );


    const erroPadrao =
        document.getElementById(
            "metric-error"
        );


    if (erroPadrao) {

        erroPadrao.hidden =
            true;

    }

}


/* ==========================================================================
   ATUALIZAÇÃO AUTOMÁTICA
   ========================================================================== */

function iniciarAtualizacaoAutomatica() {

    pararAtualizacaoAutomatica();


    ERP_METRICS.timer =
        window.setInterval(
            () => {

                carregarMetricas(
                    false
                );

            },
            ERP_METRICS_CONFIG.intervaloAtualizacao
        );

}


/* ==========================================================================
   PARA ATUALIZAÇÃO AUTOMÁTICA
   ========================================================================== */

function pararAtualizacaoAutomatica() {

    if (
        ERP_METRICS.timer
    ) {

        clearInterval(
            ERP_METRICS.timer
        );

        ERP_METRICS.timer =
            null;

    }

}


/* ==========================================================================
   EVENTOS
   ========================================================================== */

function registrarEventos() {

    /*
       Permite que outros módulos solicitem
       uma atualização sem conhecer a implementação.
    */

    document.addEventListener(
        "erp:atualizar-metricas",
        () => {

            carregarMetricas(
                true
            );

        }
    );


    /*
       Quando a página volta para primeiro plano,
       atualizamos os dados.
    */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                carregarMetricas(
                    false
                );

            }

        }
    );

}


/* ==========================================================================
   API PÚBLICA DO MÓDULO
   ========================================================================== */

window.TeradmasMetrics = {

    carregar:
        carregarMetricas,

    atualizar:
        carregarMetricas,

    dados:
        () => ({
            ...ERP_METRICS.dados
        }),

    equipe:
        () =>
            ERP_METRICS.equipeId,

    departamento:
        () =>
            ERP_METRICS.departamento,

    empresa:
        () =>
            ERP_METRICS.nomeEmpresa,

    parar:
        pararAtualizacaoAutomatica,

    iniciar:
        iniciarAtualizacaoAutomatica

};


/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        registrarEventos();


        await carregarMetricas(
            true
        );


        iniciarAtualizacaoAutomatica();

    }
);


/* ==========================================================================
   LIMPEZA
   ========================================================================== */

window.addEventListener(
    "beforeunload",
    () => {

        pararAtualizacaoAutomatica();

    }
);


/* ==========================================================================
   FIM DO metrics.js
   ========================================================================== */
