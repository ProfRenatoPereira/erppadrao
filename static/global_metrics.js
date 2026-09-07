/* ==========================================================================
   TERADMAS ERP v2.6
   METRICS.JS
   --------------------------------------------------------------------------
   CONTROLADOR UNIVERSAL DE MÉTRICAS

   RESPONSABILIDADE:

       master.py
           ↓
       /api/metrics
           ↓
       GerenciadorCaixa.py
           ↓
       PostgreSQL
           ↓
       metrics.js
           ↓
       HTML

   PRINCÍPIO:

   Este arquivo NÃO calcula capital, patrimônio ou custos.

   Ele somente:
       - identifica o contexto;
       - consulta o master;
       - recebe as métricas;
       - atualiza a interface;
       - formata valores;
       - mantém a página sincronizada.

   A lógica financeira existe exclusivamente no servidor.

   ========================================================================== */


"use strict";


/* ==========================================================================
   CONFIGURAÇÃO
   ========================================================================== */

const METRICS_CONFIG = {

    endpoint: "/api/metrics",

    contextoEndpoint: "/api/contexto",

    resumoEndpoint: "/api/resumo",

    intervaloAtualizacao: 30000,

    moeda: "BRL",

    locale: "pt-BR"

};


/* ==========================================================================
   ESTADO GLOBAL DA PÁGINA
   ========================================================================== */

const MetricsState = {

    carregando: false,

    ultimaAtualizacao: null,

    contexto: {

        equipe_id: null,

        nome_empresa: null,

        departamento: null

    },

    dados: {

        capital_total: 0,

        capital_disponivel_total: 0,

        capital_disponivel_departamento: 0,

        patrimonio_ativo_total: 0,

        patrimonio_isolado_setor: 0,

        custo_fixo_total: 0,

        custo_variavel_total: 0,

        custo_fixo_geral_empresa: 0,

        custo_fixo_isolado_setor: 0,

        custo_variavel_isolado_setor: 0,

        total_movimentacoes_fluxo: 0,

        total_entradas_fluxo: 0,

        total_saidas_fluxo: 0,

        patrimonio_imoveis: 0,

        patrimonio_maquinas: 0,

        patrimonio_materiais: 0,

        valor_aluguel_global: 0

    }

};


/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */


/**
 * Converte qualquer valor recebido do servidor para número.
 */
function numeroSeguro(valor, padrao = 0) {

    const numero = Number(valor);

    return Number.isFinite(numero)
        ? numero
        : padrao;
}


/**
 * Formata valores monetários brasileiros.
 */
function formatarMoeda(valor) {

    const numero = numeroSeguro(valor);

    return new Intl.NumberFormat(
        METRICS_CONFIG.locale,
        {
            style: "currency",
            currency: METRICS_CONFIG.moeda,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(numero);
}


/**
 * Formata números comuns.
 */
function formatarNumero(valor, casas = 2) {

    const numero = numeroSeguro(valor);

    return new Intl.NumberFormat(
        METRICS_CONFIG.locale,
        {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        }
    ).format(numero);
}


/**
 * Formata percentual.
 */
function formatarPercentual(valor) {

    const numero = numeroSeguro(valor);

    return `${formatarNumero(numero, 1)}%`;

}


/* ==========================================================================
   DOM
   ========================================================================== */


/**
 * Localiza um elemento sem gerar erro caso ele não exista.
 */
function elemento(id) {

    return document.getElementById(id);

}


/**
 * Atualiza texto de um elemento.
 */
function definirTexto(id, valor) {

    const el = elemento(id);

    if (!el) {
        return;
    }

    el.textContent = valor;

}


/**
 * Atualiza valor de input.
 */
function definirValor(id, valor) {

    const el = elemento(id);

    if (!el) {
        return;
    }

    el.value = valor;

}


/**
 * Atualiza barra de progresso.
 */
function definirProgresso(id, percentual) {

    const el = elemento(id);

    if (!el) {
        return;
    }

    const valor = Math.max(
        0,
        Math.min(
            100,
            numeroSeguro(percentual)
        )
    );

    el.style.width = `${valor}%`;

    el.setAttribute(
        "aria-valuenow",
        String(valor)
    );

}


/* ==========================================================================
   CONTEXTO
   ========================================================================== */


/**
 * Obtém o contexto operacional do master.py.
 *
 * Não usamos equipe_id gravado no JavaScript como fonte de verdade.
 *
 * A identificação deve vir da sessão/backend.
 */
async function carregarContexto() {

    try {

        const resposta = await fetch(
            METRICS_CONFIG.contextoEndpoint,
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!resposta.ok) {

            throw new Error(
                `Erro HTTP ${resposta.status}`
            );

        }

        const dados = await resposta.json();

        if (!dados.sucesso) {

            throw new Error(
                dados.erro ||
                "Não foi possível obter o contexto."
            );

        }

        MetricsState.contexto = {

            equipe_id:
                dados.equipe_id ?? null,

            nome_empresa:
                dados.nome_empresa ?? null,

            departamento:
                dados.departamento ?? null

        };

        atualizarIdentificacaoEmpresa();

        return MetricsState.contexto;

    }

    catch (erro) {

        console.error(
            "Erro ao carregar contexto:",
            erro
        );

        return null;

    }

}


/* ==========================================================================
   IDENTIFICAÇÃO DA EMPRESA
   ========================================================================== */


/**
 * Atualiza o cabeçalho das páginas.
 *
 * Os elementos são opcionais para que o mesmo metrics.js
 * possa ser utilizado em diferentes pastas.
 */
function atualizarIdentificacaoEmpresa() {

    const contexto =
        MetricsState.contexto;

    definirTexto(
        "nome-empresa",
        contexto.nome_empresa || "GRUPO ACADÊMICO"
    );

    definirTexto(
        "empresa-nome",
        contexto.nome_empresa || "GRUPO ACADÊMICO"
    );

    definirTexto(
        "equipe-id",
        contexto.equipe_id ?? "—"
    );

    definirTexto(
        "departamento-atual",
        contexto.departamento || "GERAL"
    );

}


/* ==========================================================================
   MONTAGEM DA URL
   ========================================================================== */


/**
 * Monta a consulta ao endpoint de métricas.
 *
 * Normalmente o equipe_id não precisa ser enviado:
 * o master utiliza a sessão.

 * O departamento pode ser informado porque representa
 * a página atualmente aberta.
 */
function montarUrlMetricas() {

    const params =
        new URLSearchParams();

    const departamento =
        MetricsState.contexto.departamento;

    if (departamento) {

        params.set(
            "departamento",
            departamento
        );

    }

    const query =
        params.toString();

    if (!query) {

        return METRICS_CONFIG.endpoint;

    }

    return `${METRICS_CONFIG.endpoint}?${query}`;

}


/* ==========================================================================
   CONSULTA AO MASTER
   ========================================================================== */


/**
 * Consulta o motor financeiro através do master.py.
 */
async function buscarMetricas() {

    const url =
        montarUrlMetricas();

    const resposta =
        await fetch(
            url,
            {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

    if (!resposta.ok) {

        throw new Error(
            `Erro HTTP ${resposta.status}`
        );

    }

    const resultado =
        await resposta.json();

    if (!resultado.sucesso) {

        throw new Error(
            resultado.erro ||
            "O servidor recusou a consulta."
        );

    }

    return resultado;

}


/* ==========================================================================
   NORMALIZAÇÃO DOS DADOS
   ========================================================================== */


/**
 * Garante que a interface sempre receba uma estrutura previsível.
 */
function normalizarMetricas(dados) {

    const camposNumericos = [

        "capital_total",

        "capital_disponivel_total",

        "capital_disponivel_departamento",

        "patrimonio_ativo_total",

        "patrimonio_isolado_setor",

        "custo_fixo_total",

        "custo_variavel_total",

        "custo_fixo_geral_empresa",

        "custo_fixo_isolado_setor",

        "custo_variavel_isolado_setor",

        "total_movimentacoes_fluxo",

        "total_entradas_fluxo",

        "total_saidas_fluxo",

        "patrimonio_imoveis",

        "patrimonio_maquinas",

        "patrimonio_materiais",

        "valor_aluguel_global"

    ];

    const resultado = {

        ...MetricsState.dados

    };


    camposNumericos.forEach(
        campo => {

            if (
                Object.prototype.hasOwnProperty.call(
                    dados,
                    campo
                )
            ) {

                resultado[campo] =
                    numeroSeguro(
                        dados[campo]
                    );

            }

        }
    );


    resultado.nome_empresa =
        dados.nome_empresa ||
        MetricsState.contexto.nome_empresa ||
        "GRUPO ACADÊMICO";


    return resultado;

}


/* ==========================================================================
   ATUALIZAÇÃO DO ESTADO
   ========================================================================== */


/**
 * Recebe os dados do servidor.
 */
function atualizarEstado(dados) {

    MetricsState.dados =
        normalizarMetricas(dados);

    MetricsState.ultimaAtualizacao =
        new Date();

}


/* ==========================================================================
   ATUALIZAÇÃO DOS KPIs
   ========================================================================== */


/**
 * Atualiza os principais indicadores.
 *
 * Vários IDs são suportados deliberadamente.
 *
 * Isso permite que o mesmo metrics.js seja usado
 * em páginas diferentes sem obrigar todas elas
 * a terem exatamente o mesmo HTML.
 */
function atualizarKPIs() {

    const d =
        MetricsState.dados;


    /* ----------------------------------------------------------------------
       CAPITAL
       ---------------------------------------------------------------------- */

    definirTexto(
        "capital-total",
        formatarMoeda(
            d.capital_total
        )
    );

    definirTexto(
        "capital-disponivel",
        formatarMoeda(
            d.capital_disponivel_total
        )
    );

    definirTexto(
        "capital-disponivel-total",
        formatarMoeda(
            d.capital_disponivel_total
        )
    );

    definirTexto(
        "capital-disponivel-departamento",
        formatarMoeda(
            d.capital_disponivel_departamento
        )
    );


    /* ----------------------------------------------------------------------
       PATRIMÔNIO
       ---------------------------------------------------------------------- */

    definirTexto(
        "patrimonio-total",
        formatarMoeda(
            d.patrimonio_ativo_total
        )
    );

    definirTexto(
        "patrimonio-ativo-total",
        formatarMoeda(
            d.patrimonio_ativo_total
        )
    );

    definirTexto(
        "patrimonio-setor",
        formatarMoeda(
            d.patrimonio_isolado_setor
        )
    );


    /* ----------------------------------------------------------------------
       CUSTOS
       ---------------------------------------------------------------------- */

    definirTexto(
        "custo-fixo-total",
        formatarMoeda(
            d.custo_fixo_total
        )
    );

    definirTexto(
        "custo-variavel-total",
        formatarMoeda(
            d.custo_variavel_total
        )
    );

    definirTexto(
        "custo-fixo-geral",
        formatarMoeda(
            d.custo_fixo_geral_empresa
        )
    );

    definirTexto(
        "custo-fixo-setor",
        formatarMoeda(
            d.custo_fixo_isolado_setor
        )
    );

    definirTexto(
        "custo-variavel-setor",
        formatarMoeda(
            d.custo_variavel_isolado_setor
        )
    );


    /* ----------------------------------------------------------------------
       FLUXO DE CAIXA
       ---------------------------------------------------------------------- */

    definirTexto(
        "entradas-total",
        formatarMoeda(
            d.total_entradas_fluxo
        )
    );

    definirTexto(
        "saidas-total",
        formatarMoeda(
            d.total_saidas_fluxo
        )
    );

    definirTexto(
        "movimentacoes-total",
        formatarMoeda(
            d.total_movimentacoes_fluxo
        )
    );


    /* ----------------------------------------------------------------------
       ATIVOS
       ---------------------------------------------------------------------- */

    definirTexto(
        "patrimonio-imoveis",
        formatarMoeda(
            d.patrimonio_imoveis
        )
    );

    definirTexto(
        "patrimonio-maquinas",
        formatarMoeda(
            d.patrimonio_maquinas
        )
    );

    definirTexto(
        "patrimonio-materiais",
        formatarMoeda(
            d.patrimonio_materiais
        )
    );


    /* ----------------------------------------------------------------------
       ALUGUEL
       ---------------------------------------------------------------------- */

    definirTexto(
        "valor-aluguel",
        formatarMoeda(
            d.valor_aluguel_global
        )
    );


    /* ----------------------------------------------------------------------
       EMPRESA
       ---------------------------------------------------------------------- */

    definirTexto(
        "nome-empresa",
        d.nome_empresa
    );

    definirTexto(
        "empresa-nome",
        d.nome_empresa
    );


    /* ----------------------------------------------------------------------
       PROGRESSO DO CAPITAL
       ---------------------------------------------------------------------- */

    const capital =
        d.capital_total;

    const disponivel =
        d.capital_disponivel_total;

    let percentualCapital = 0;

    if (capital > 0) {

        percentualCapital =
            (disponivel / capital) * 100;

    }

    definirProgresso(
        "capital-progress",
        percentualCapital
    );

    definirProgresso(
        "progresso-capital",
        percentualCapital
    );


    /* ----------------------------------------------------------------------
       ÚLTIMA ATUALIZAÇÃO
       ---------------------------------------------------------------------- */

    if (
        MetricsState.ultimaAtualizacao
    ) {

        definirTexto(
            "metrics-atualizado-em",
            MetricsState
                .ultimaAtualizacao
                .toLocaleTimeString(
                    METRICS_CONFIG.locale
                )
        );

    }

}


/* ==========================================================================
   ESTADOS VISUAIS
   ========================================================================== */


/**
 * Indica carregamento.
 */
function indicarCarregamento(ativo) {

    const elementos =
        document.querySelectorAll(
            "[data-metrics-loading]"
        );

    elementos.forEach(
        el => {

            el.hidden = !ativo;

        }
    );

}


/**
 * Indica erro.
 */
function indicarErro(mensagem) {

    const elementos =
        document.querySelectorAll(
            "[data-metrics-error]"
        );

    elementos.forEach(
        el => {

            el.hidden = false;

            el.textContent =
                mensagem;

        }
    );

}


/**
 * Limpa mensagens de erro.
 */
function limparErro() {

    const elementos =
        document.querySelectorAll(
            "[data-metrics-error]"
        );

    elementos.forEach(
        el => {

            el.hidden = true;

        }
    );

}


/* ==========================================================================
   CARREGAMENTO PRINCIPAL
   ========================================================================== */


/**
 * Fluxo principal:
 *
 *     contexto
 *        ↓
 *     métricas
 *        ↓
 *     estado
 *        ↓
 *     interface
 */
async function carregarMetricas() {

    if (
        MetricsState.carregando
    ) {

        return;

    }

    MetricsState.carregando =
        true;

    indicarCarregamento(true);

    limparErro();


    try {

        /*
         * O contexto é consultado primeiro.
         *
         * Isso evita que uma página descubra sua empresa
         * através de dados antigos armazenados no navegador.
         */
        await carregarContexto();


        /*
         * Agora consultamos o único motor financeiro.
         */
        const resultado =
            await buscarMetricas();


        /*
         * O servidor pode devolver nome da empresa
         * juntamente com as métricas.
         */
        if (
            resultado.nome_empresa
        ) {

            MetricsState.contexto.nome_empresa =
                resultado.nome_empresa;

        }


        atualizarEstado(
            resultado
        );


        atualizarKPIs();


        /*
         * Evento público para páginas que possuem
         * componentes próprios.
         *
         * Assim cada pasta pode complementar a interface
         * sem duplicar a consulta ao servidor.
         */
        document.dispatchEvent(
            new CustomEvent(
                "teradmas:metrics-atualizadas",
                {
                    detail: {
                        dados:
                            MetricsState.dados,

                        contexto:
                            MetricsState.contexto
                    }
                }
            )
        );


    }

    catch (erro) {

        console.error(
            "Erro ao carregar métricas:",
            erro
        );

        indicarErro(
            erro.message ||
            "Não foi possível carregar as métricas."
        );


        /*
         * Evento para módulos que desejarem
         * tratar o erro de maneira específica.
         */
        document.dispatchEvent(
            new CustomEvent(
                "teradmas:metrics-erro",
                {
                    detail: {
                        erro
                    }
                }
            )
        );

    }

    finally {

        MetricsState.carregando =
            false;

        indicarCarregamento(false);

    }

}


/* ==========================================================================
   ATUALIZAÇÃO MANUAL
   ========================================================================== */


/**
 * Permite que qualquer página solicite
 * uma atualização sem conhecer a API.
 */
window.atualizarMetricas =
    carregarMetricas;


/* ==========================================================================
   ACESSO AO ESTADO
   ========================================================================== */


/**
 * Permite que módulos específicos consultem
 * os dados já carregados.
 *
 * Não modifica os dados.
 */
window.obterMetricas =
    function () {

        return {
            ...MetricsState.dados
        };

    };


window.obterContextoERP =
    function () {

        return {
            ...MetricsState.contexto
        };

    };


/* ==========================================================================
   EVENTOS
   ========================================================================== */


/**
 * Permite que outras partes do ERP solicitem
 * atualização depois de registrar uma operação.
 */
document.addEventListener(
    "teradmas:atualizar-metricas",
    function () {

        carregarMetricas();

    }
);


/**
 * Quando uma operação financeira for concluída,
 * os módulos podem disparar:
 *
 *     document.dispatchEvent(
 *         new Event("teradmas:atualizar-metricas")
 *     );
 *
 * Não é necessário conhecer o endpoint.
 */


/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        carregarMetricas();

        /*
         * Atualização periódica.
         *
         * A página não calcula nada localmente.
         * Apenas consulta novamente o estado oficial
         * da empresa.
         */
        setInterval(
            carregarMetricas,
            METRICS_CONFIG.intervaloAtualizacao
        );

    }
);


/* ==========================================================================
   EXPORTAÇÃO GLOBAL
   ========================================================================== */

window.TeradmasMetrics = {

    carregar:
        carregarMetricas,

    atualizar:
        carregarMetricas,

    obter:
        function () {
            return {
                ...MetricsState.dados
            };
        },

    contexto:
        function () {
            return {
                ...MetricsState.contexto
            };
        },

    formatarMoeda,

    formatarNumero,

    formatarPercentual

};


/* ==========================================================================
   FIM DO METRICS.JS
   ========================================================================== */
