/* ==========================================================================
   TERADMAS ERP v2.6
   MÓDULO 07 — ENGENHARIA DE ATIVOS (MÁQUINAS)
   maquinas.js

   REGRAS DESTE MÓDULO
   --------------------------------------------------------------------------
   1. O capital inicial vem do backend.
   2. A quota de MÁQUINAS vem de public.quotas_departamentos.
   3. Valor da quota = capital inicial × percentual da quota.
   4. Patrimônio é somente o que foi efetivamente adquirido/cadastrado.
   5. Saldo de aquisição = valor da quota − patrimônio atual.
   6. Não existe mais divisão automática 40% / 30% / 30%.
   7. Não existe capital fixo de R$ 5.000.000,00.
   8. Não existe orçamento fixo de R$ 2.000.000,00.
   9. O catálogo é apenas referência técnica.
  10. O catálogo não cria patrimônio automaticamente.
  11. A equipe/empresa é determinada pela sessão no backend.
========================================================================== */


/* ==========================================================================
   ESTADO GLOBAL
========================================================================== */

let capitalTotalEmpresa = 0;
let percentualQuotaMaquinas = 0;
let valorQuotaMaquinas = 0;
let patrimonioMaquinasAtual = 0;
let saldoAquisicaoMaquinas = 0;

let maquinasGlobal = [];
let maquinaEmEdicao = null;


/* ==========================================================================
   CATÁLOGO TÉCNICO DE REFERÊNCIA
   --------------------------------------------------------------------------
   IMPORTANTE:
   Estes registros NÃO são patrimônio da empresa.
   Servem apenas como modelos para preenchimento técnico.
========================================================================== */

const CATALOGO_ATIVOS = {

    cnc_mazak: {
        nome: "Torno CNC Mazak Quick Turn",
        potencia: "22.0",
        consumo: "18.5",
        agua: "0",
        gases: "0",
        velocidade: "4500",
        avanco: "0.25",
        frequencia: "720",
        preco: "650000.00",
        depr: "5416.67",
        residual: "130000.00",
        operador: "Operador CNC Nível III",
        mod: "0.4500"
    },

    centro_usid: {
        nome: "Centro de Usinagem CNC",
        potencia: "30.0",
        consumo: "24.0",
        agua: "0",
        gases: "0",
        velocidade: "6000",
        avanco: "0.30",
        frequencia: "720",
        preco: "850000.00",
        depr: "7083.33",
        residual: "170000.00",
        operador: "Operador CNC Nível III",
        mod: "0.4500"
    },

    torno_mecanico: {
        nome: "Torno Mecânico Convencional",
        potencia: "10.0",
        consumo: "7.5",
        agua: "0",
        gases: "0",
        velocidade: "1800",
        avanco: "0.40",
        frequencia: "360",
        preco: "85000.00",
        depr: "708.33",
        residual: "17000.00",
        operador: "Torneiro Mecânico",
        mod: "0.3500"
    },

    serra_fita: {
        nome: "Serra de Fita Industrial",
        potencia: "7.5",
        consumo: "5.5",
        agua: "0",
        gases: "0",
        velocidade: "90",
        avanco: "1.00",
        frequencia: "360",
        preco: "120000.00",
        depr: "1000.00",
        residual: "24000.00",
        operador: "Operador de Máquinas",
        mod: "0.3000"
    },

    retifica: {
        nome: "Retífica Industrial",
        potencia: "15.0",
        consumo: "11.0",
        agua: "0",
        gases: "0",
        velocidade: "3600",
        avanco: "0.15",
        frequencia: "360",
        preco: "180000.00",
        depr: "1500.00",
        residual: "36000.00",
        operador: "Retificador",
        mod: "0.3500"
    },

    furadeira_radial: {
        nome: "Furadeira Radial",
        potencia: "8.0",
        consumo: "6.0",
        agua: "0",
        gases: "0",
        velocidade: "1200",
        avanco: "0.20",
        frequencia: "360",
        preco: "95000.00",
        depr: "791.67",
        residual: "19000.00",
        operador: "Operador de Máquinas",
        mod: "0.3000"
    },

    forno_atmo: {
        nome: "Forno de Tratamento Térmico Atmosfera",
        potencia: "80.0",
        consumo: "65.0",
        agua: "0",
        gases: "12.0",
        velocidade: "0",
        avanco: "0",
        frequencia: "720",
        preco: "420000.00",
        depr: "3500.00",
        residual: "84000.00",
        operador: "Operador de Tratamento Térmico",
        mod: "0.4000"
    },

    forno_reveni: {
        nome: "Forno de Revenimento",
        potencia: "55.0",
        consumo: "44.0",
        agua: "0",
        gases: "8.0",
        velocidade: "0",
        avanco: "0",
        frequencia: "720",
        preco: "280000.00",
        depr: "2333.33",
        residual: "56000.00",
        operador: "Operador de Tratamento Térmico",
        mod: "0.4000"
    },

    compressor_ar: {
        nome: "Compressor de Ar Industrial",
        potencia: "30.0",
        consumo: "22.0",
        agua: "0",
        gases: "0",
        velocidade: "0",
        avanco: "0",
        frequencia: "720",
        preco: "160000.00",
        depr: "1333.33",
        residual: "32000.00",
        operador: "Técnico de Utilidades",
        mod: "0.3000"
    },

    empilhadeira_ele: {
        nome: "Empilhadeira Elétrica",
        potencia: "12.0",
        consumo: "8.0",
        agua: "0",
        gases: "0",
        velocidade: "20",
        avanco: "0",
        frequencia: "360",
        preco: "180000.00",
        depr: "1500.00",
        residual: "36000.00",
        operador: "Operador de Empilhadeira",
        mod: "0.3000"
    },

    cestos_inox: {
        nome: "Cestos Industriais em Inox",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "0",
        avanco: "0",
        frequencia: "0",
        preco: "18000.00",
        depr: "150.00",
        residual: "3600.00",
        operador: "Operador de Produção",
        mod: "0.2500"
    },

    palets_aco: {
        nome: "Paletes Industriais de Aço",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "0",
        avanco: "0",
        frequencia: "0",
        preco: "12000.00",
        depr: "100.00",
        residual: "2400.00",
        operador: "Operador de Produção",
        mod: "0.2500"
    },

    caixas_trans: {
        nome: "Caixas de Transporte Industrial",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "0",
        avanco: "0",
        frequencia: "0",
        preco: "8500.00",
        depr: "70.83",
        residual: "1700.00",
        operador: "Operador de Produção",
        mod: "0.2500"
    }
};


/* ==========================================================================
   UTILITÁRIOS
========================================================================== */

function numero(valor, padrao = 0) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return padrao;
    }

    const normalizado = String(valor)
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const n = Number(normalizado);

    return Number.isFinite(n) ? n : padrao;
}


function formatarBRL(valor) {

    return numero(valor).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}


function formatarNumero(valor, casas = 2) {

    return numero(valor).toLocaleString(
        "pt-BR",
        {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        }
    );
}


function obterElemento(id) {

    return document.getElementById(id);
}


function definirTexto(ids, valor) {

    const lista = Array.isArray(ids)
        ? ids
        : [ids];

    lista.forEach(id => {

        const elemento = obterElemento(id);

        if (elemento) {
            elemento.textContent = valor;
        }

    });
}


function definirValor(ids, valor) {

    const lista = Array.isArray(ids)
        ? ids
        : [ids];

    lista.forEach(id => {

        const elemento = obterElemento(id);

        if (elemento) {
            elemento.value = valor;
        }

    });
}


function obterValorCampo(...ids) {

    for (const id of ids) {

        const elemento = obterElemento(id);

        if (
            elemento &&
            elemento.value !== undefined
        ) {
            return elemento.value;
        }

    }

    return "";
}


function escapeHtml(texto) {

    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ==========================================================================
   ACESSIBILIDADE
========================================================================== */

function mudarFonte(delta) {

    const atual = parseInt(
        document.documentElement.style
            .getPropertyValue("--tamanho-fonte") || "16",
        10
    );

    const novo = Math.max(
        12,
        Math.min(
            24,
            atual + Number(delta || 0)
        )
    );

    document.documentElement.style
        .setProperty(
            "--tamanho-fonte",
            `${novo}px`
        );

    document.body.style.fontSize =
        `${novo}px`;
}


function alternarModoEscuro() {

    document.body.classList.toggle(
        "dark-mode"
    );
}


function alternarAltoContraste() {

    document.body.classList.toggle(
        "alto-contraste"
    );
}


function falarTexto(texto) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }

    speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(texto);

    utterance.lang = "pt-BR";
    utterance.rate = 0.95;

    speechSynthesis.speak(
        utterance
    );
}


function alternarLeitorAudio() {

    const ativo =
        document.body.classList.toggle(
            "leitor-ativo"
        );

    if (ativo) {

        falarTexto(
            document.body.innerText
        );

    } else if (
        "speechSynthesis" in window
    ) {

        speechSynthesis.cancel();

    }
}


function falarMensagem(texto) {

    if (
        document.body.classList.contains(
            "leitor-ativo"
        )
    ) {
        falarTexto(texto);
    }
}


/* ==========================================================================
   CATÁLOGO
========================================================================== */

function carregarModelo(codigo) {

    const modelo =
        CATALOGO_ATIVOS[codigo];

    if (!modelo) {
        return;
    }

    definirValor(
        ["nome_equipamento", "nome"],
        modelo.nome
    );

    definirValor(
        ["potencia"],
        modelo.potencia
    );

    definirValor(
        ["consumo_eletrico", "consumo"],
        modelo.consumo
    );

    definirValor(
        ["consumo_agua", "agua"],
        modelo.agua
    );

    definirValor(
        ["consumo_gases", "gases"],
        modelo.gases
    );

    definirValor(
        ["velocidade"],
        modelo.velocidade
    );

    definirValor(
        ["avanco"],
        modelo.avanco
    );

    definirValor(
        [
            "frequencia_manutencao",
            "frequencia"
        ],
        modelo.frequencia
    );

    definirValor(
        ["preco_compra", "preco"],
        modelo.preco
    );

    definirValor(
        [
            "depreciacao_mensal",
            "depreciacao"
        ],
        modelo.depr
    );

    definirValor(
        [
            "valor_venda_final",
            "valor_residual"
        ],
        modelo.residual
    );

    definirValor(
        [
            "operador_nome",
            "operador"
        ],
        modelo.operador
    );

    definirValor(
        ["custo_minuto_operador"],
        ""
    );

    calcularMinutoMaquina();
}


/* ==========================================================================
   CUSTO POR MINUTO DA MÁQUINA
   --------------------------------------------------------------------------
   Neste estágio, preservamos a composição técnica existente.

   O componente estrutural não recebe mais uma taxa fixa de 5%.

   A integração futura deverá receber as tarifas oficiais da Estrutura,
   RH e Folha para formar o custo absorvido sem duplicidade.
========================================================================== */

function calcularMinutoMaquina() {

    const consumoEletrico =
        numero(
            obterValorCampo(
                "consumo_eletrico",
                "consumo"
            )
        );

    const consumoAgua =
        numero(
            obterValorCampo(
                "consumo_agua",
                "agua"
            )
        );

    const consumoGases =
        numero(
            obterValorCampo(
                "consumo_gases",
                "gases"
            )
        );

    const depreciacaoMensal =
        numero(
            obterValorCampo(
                "depreciacao_mensal",
                "depreciacao"
            )
        );

    const jornadaSemanal =
        Math.max(
            1,
            numero(
                obterValorCampo(
                    "jornada_semanal"
                ),
                44
            )
        );

    const turnos =
        Math.max(
            1,
            numero(
                obterValorCampo(
                    "turnos_trabalho"
                ),
                1
            )
        );

    const horasMes =
        jornadaSemanal *
        4.33 *
        turnos;

    const minutosMes =
        horasMes * 60;

    const custoDepreciacaoMinuto =
        depreciacaoMensal /
        minutosMes;


    /*
       Tarifas técnicas atuais preservadas
       para compatibilidade com o cálculo existente.

       NÃO representam a arquitetura final.

       Futuramente:
       Estrutura → tarifas/utilidades
       RH/Folha → custo completo do operador
       Máquinas → composição do custo da máquina
    */

    const TARIFA_ENERGIA =
        0.78;

    const TARIFA_AGUA =
        8.20;

    const TARIFA_GASES =
        5.40;


    const custoEnergiaMinuto =
        (
            consumoEletrico *
            TARIFA_ENERGIA
        ) / 60;


    const custoAguaMinuto =
        (
            consumoAgua *
            TARIFA_AGUA
        ) / 60;


    const custoGasesMinuto =
        (
            consumoGases *
            TARIFA_GASES
        ) / 60;


    const custoOperadorMinuto =
        numero(
            obterValorCampo(
                "custo_minuto_operador"
            )
        );


    /*
       NÃO existe mais:

       custo estrutural = 5%

       O valor é zero até a integração oficial
       com Estrutura/RH/Folha.
    */

    const custoEstruturalMinuto = 0;


    const custoTotalMinuto =
        custoDepreciacaoMinuto +
        custoEnergiaMinuto +
        custoAguaMinuto +
        custoGasesMinuto +
        custoOperadorMinuto +
        custoEstruturalMinuto;


    definirValor(
        ["custo_minuto_maquina"],
        custoTotalMinuto.toFixed(4)
    );


    definirTexto(
        [
            "custo_minuto_maquina_display",
            "kpi_custo_minuto"
        ],
        formatarBRL(
            custoTotalMinuto
        )
    );


    return custoTotalMinuto;
}


/* ==========================================================================
   ORÇAMENTO DE MÁQUINAS
   --------------------------------------------------------------------------
   Fonte oficial:

       /api/maquinas/orcamento

   Backend retorna:

       capital_inicial
       porcentagem_quota
       valor_quota
       patrimonio_atual
       saldo_aquisicao
========================================================================== */

async function carregarOrcamentoMaquinas() {

    try {

        const resposta =
            await fetch(
                "/api/maquinas/orcamento",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.ok
        ) {

            throw new Error(
                dados.erro ||
                "Não foi possível carregar o orçamento de Máquinas."
            );

        }


        capitalTotalEmpresa =
            numero(
                dados.capital_inicial
            );


        percentualQuotaMaquinas =
            numero(
                dados.porcentagem_quota
            );


        valorQuotaMaquinas =
            numero(
                dados.valor_quota
            );


        patrimonioMaquinasAtual =
            numero(
                dados.patrimonio_atual
            );


        saldoAquisicaoMaquinas =
            numero(
                dados.saldo_aquisicao
            );


        atualizarPainelOrcamento();


        return dados;


    } catch (erro) {

        console.error(
            "Erro ao carregar orçamento de Máquinas:",
            erro
        );


        definirTexto(
            [
                "capital_total",
                "capitalTotal",
                "capital_total_empresa"
            ],
            "Indisponível"
        );


        definirTexto(
            [
                "quota_maquinas",
                "percentual_quota",
                "quota_percentual"
            ],
            "Indisponível"
        );


        definirTexto(
            [
                "valor_quota",
                "orcamento_setor",
                "orcamento_inicial"
            ],
            "Indisponível"
        );


        definirTexto(
            [
                "saldo_aquisicao",
                "saldo_setor",
                "saldo_restante"
            ],
            "Indisponível"
        );


        return null;
    }
}


/* ==========================================================================
   ATUALIZAÇÃO DO PAINEL
========================================================================== */

function atualizarPainelOrcamento() {

    definirTexto(
        [
            "capital_total",
            "capitalTotal",
            "capital_total_empresa"
        ],
        formatarBRL(
            capitalTotalEmpresa
        )
    );


    definirTexto(
        [
            "quota_maquinas",
            "percentual_quota",
            "quota_percentual"
        ],
        `${formatarNumero(
            percentualQuotaMaquinas,
            2
        )}%`
    );


    definirTexto(
        [
            "valor_quota",
            "orcamento_setor",
            "orcamento_inicial"
        ],
        formatarBRL(
            valorQuotaMaquinas
        )
    );


    definirTexto(
        [
            "patrimonio_atual",
            "patrimonio_maquinas",
            "patrimonio_setor"
        ],
        formatarBRL(
            patrimonioMaquinasAtual
        )
    );


    definirTexto(
        [
            "saldo_aquisicao",
            "saldo_setor",
            "saldo_restante"
        ],
        formatarBRL(
            saldoAquisicaoMaquinas
        )
    );


    const percentualConsumido =
        valorQuotaMaquinas > 0
            ? (
                patrimonioMaquinasAtual /
                valorQuotaMaquinas
            ) * 100
            : 0;


    definirTexto(
        [
            "percentual_consumido",
            "quota_consumida"
        ],
        `${Math.max(
            0,
            percentualConsumido
        ).toFixed(2)}%`
    );
}


/* ==========================================================================
   LISTAGEM
========================================================================== */

async function carregarListaMaquinas() {

    try {

        const resposta =
            await fetch(
                "/api/maquinas/listar",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.ok
        ) {

            throw new Error(
                dados.erro ||
                "Falha ao listar máquinas."
            );

        }


        maquinasGlobal =
            Array.isArray(
                dados.maquinas
            )
                ? dados.maquinas
                : [];


        atualizarKPIs(
            maquinasGlobal
        );


        renderizarTabelaMaquinas(
            maquinasGlobal
        );


        return maquinasGlobal;


    } catch (erro) {

        console.error(
            "Erro ao listar máquinas:",
            erro
        );


        renderizarTabelaMaquinas(
            []
        );


        return [];
    }
}


/* ==========================================================================
   KPIs
========================================================================== */

function atualizarKPIs(lista) {

    const patrimonio =
        lista.reduce(
            (
                total,
                maquina
            ) => {

                if (
                    maquina.is_patrimonio
                ) {

                    return (
                        total +
                        numero(
                            maquina.preco_compra
                        )
                    );

                }

                return total;

            },
            0
        );


    const custoFixo =
        lista.reduce(
            (
                total,
                maquina
            ) => {

                return (
                    total +
                    numero(
                        maquina.depreciacao_mensal
                    )
                );

            },
            0
        );


    const custoVariavel =
        lista.reduce(
            (
                total,
                maquina
            ) => {

                return (
                    total +
                    numero(
                        maquina.custo_mensal_variavel
                    )
                );

            },
            0
        );


    definirTexto(
        [
            "kpi_patrimonio",
            "total_patrimonio",
            "patrimonio_total"
        ],
        formatarBRL(
            patrimonio
        )
    );


    definirTexto(
        [
            "kpi_custo_fixo",
            "custo_fixo_total"
        ],
        formatarBRL(
            custoFixo
        )
    );


    definirTexto(
        [
            "kpi_custo_variavel",
            "custo_variavel_total"
        ],
        formatarBRL(
            custoVariavel
        )
    );
}


/* ==========================================================================
   TABELA DE MÁQUINAS
========================================================================== */

function renderizarTabelaMaquinas(lista) {

    const tbody =
        obterElemento(
            "tabela_maquinas_body"
        ) ||
        obterElemento(
            "lista_maquinas"
        ) ||
        obterElemento(
            "corpo_tabela_maquinas"
        );


    if (!tbody) {
        return;
    }


    if (!lista.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="20"
                    style="text-align:center;"
                >
                    Nenhuma máquina cadastrada
                    para esta equipe.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        lista
            .map(maquina => {

                const id =
                    maquina.id ?? "";

                const nome =
                    maquina.nome_equipamento ??
                    "—";

                const preco =
                    formatarBRL(
                        maquina.preco_compra
                    );

                const custoMinuto =
                    formatarBRL(
                        maquina.custo_minuto_maquina
                    );

                const operador =
                    maquina.operador_nome ||
                    "Não definido";

                const patrimonio =
                    maquina.is_patrimonio
                        ? "Sim"
                        : "Não";


                return `
                    <tr>

                        <td>
                            ${escapeHtml(
                                String(nome)
                            )}
                        </td>

                        <td>
                            ${preco}
                        </td>

                        <td>
                            ${custoMinuto}
                        </td>

                        <td>
                            ${escapeHtml(
                                String(operador)
                            )}
                        </td>

                        <td>
                            ${patrimonio}
                        </td>

                        <td>

                            <button
                                type="button"
                                onclick="editarMaquina(${Number(id)})"
                            >
                                Editar
                            </button>

                            <button
                                type="button"
                                onclick="deletarMaquina(${Number(id)})"
                            >
                                Excluir
                            </button>

                        </td>

                    </tr>
                `;

            })
            .join("");
}


/* ==========================================================================
   DADOS INICIAIS
========================================================================== */

async function carregarDadosIniciais() {

    await carregarOrcamentoMaquinas();

    await carregarListaMaquinas();


    /*
       Consulta também o Financeiro para manter
       a página sincronizada com o motor central.
    */

    try {

        const resposta =
            await fetch(
                "/api/financeiro/metricas?dept=maquinas",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );


        if (!resposta.ok) {
            return;
        }


        const dados =
            await resposta.json();


        if (
            dados.ok !== false &&
            dados.metricas
        ) {

            atualizarMetricasFinanceiras(
                dados.metricas
            );

        }


    } catch (erro) {

        console.warn(
            "Métricas do Financeiro indisponíveis:",
            erro
        );

    }
}


/* ==========================================================================
   MÉTRICAS DO FINANCEIRO
========================================================================== */

function atualizarMetricasFinanceiras(metricas) {

    if (!metricas) {
        return;
    }


    if (
        metricas.capital_total !==
        undefined
    ) {

        capitalTotalEmpresa =
            numero(
                metricas.capital_total
            );

    }


    /*
       Não substituímos o patrimônio de Máquinas
       pelo patrimônio total da empresa.

       O orçamento específico de Máquinas
       continua sendo responsabilidade de:

           /api/maquinas/orcamento
    */


    atualizarPainelOrcamento();
}


/* ==========================================================================
   SALVAR MÁQUINA
========================================================================== */

async function salvarMaquina(event) {

    if (event) {
        event.preventDefault();
    }


    const precoCompra =
        numero(
            obterValorCampo(
                "preco_compra",
                "preco"
            )
        );


    const custoMinuto =
        calcularMinutoMaquina();


    /*
       Quando estamos editando uma máquina que já era patrimônio,
       seu próprio valor é temporariamente devolvido ao saldo
       para permitir a edição sem penalizar duas vezes.
    */

    const patrimonioEmEdicao =
        maquinaEmEdicao &&
        maquinaEmEdicao.is_patrimonio
            ? numero(
                maquinaEmEdicao.preco_compra
            )
            : 0;


    const saldoParaEdicao =
        saldoAquisicaoMaquinas +
        patrimonioEmEdicao;


    if (precoCompra < 0) {

        alert(
            "❌ O preço de compra não pode ser negativo."
        );

        return;
    }


    /*
       Somente patrimônio efetivo consome a quota de aquisição.
    */

    const elementoPatrimonio =
        obterElemento(
            "is_patrimonio"
        ) ||
        obterElemento(
            "ativo_patrimonio"
        );


    const isPatrimonio =
        elementoPatrimonio
            ? (
                "checked" in elementoPatrimonio
                    ? Boolean(
                        elementoPatrimonio.checked
                    )
                    : elementoPatrimonio.value ===
                      "true"
              )
            : true;


    /*
       Se o cadastro não for patrimônio,
       não devemos bloquear pela quota de aquisição.
    */

    if (
        isPatrimonio &&
        precoCompra > saldoParaEdicao &&
        saldoParaEdicao >= 0
    ) {

        alert(
            "❌ Saldo de aquisição de Máquinas insuficiente.\n\n" +

            `Capital inicial: ${formatarBRL(
                capitalTotalEmpresa
            )}\n` +

            `Quota de Máquinas: ${formatarBRL(
                valorQuotaMaquinas
            )}\n` +

            `Patrimônio atual: ${formatarBRL(
                patrimonioMaquinasAtual
            )}\n` +

            `Saldo disponível: ${formatarBRL(
                saldoParaEdicao
            )}`
        );

        return;
    }


    const payload = {

        id:
            maquinaEmEdicao?.id ||
            null,

        nome_equipamento:
            obterValorCampo(
                "nome_equipamento",
                "nome"
            ),

        potencia:
            obterValorCampo(
                "potencia"
            ),

        consumo_eletrico:
            obterValorCampo(
                "consumo_eletrico",
                "consumo"
            ),

        consumo_agua:
            obterValorCampo(
                "consumo_agua",
                "agua"
            ),

        consumo_gases:
            obterValorCampo(
                "consumo_gases",
                "gases"
            ),

        velocidade:
            obterValorCampo(
                "velocidade"
            ),

        avanco:
            obterValorCampo(
                "avanco"
            ),

        frequencia_manutencao:
            obterValorCampo(
                "frequencia_manutencao",
                "frequencia"
            ),

        preco_compra:
            precoCompra,

        depreciacao_mensal:
            numero(
                obterValorCampo(
                    "depreciacao_mensal",
                    "depreciacao"
                )
            ),

        valor_venda_final:
            numero(
                obterValorCampo(
                    "valor_venda_final",
                    "valor_residual"
                )
            ),

        operador_nome:
            obterValorCampo(
                "operador_nome",
                "operador"
            ),

        custo_minuto_operador:
            numero(
                obterValorCampo(
                    "custo_minuto_operador"
                )
            ),

        custo_minuto_maquina:
            custoMinuto,

        jornada_semanal:
            numero(
                obterValorCampo(
                    "jornada_semanal"
                ),
                44
            ),

        turnos_trabalho:
            numero(
                obterValorCampo(
                    "turnos_trabalho"
                ),
                1
            ),

        is_patrimonio:
            isPatrimonio
    };


    try {

        const resposta =
            await fetch(
                "/api/maquinas/salvar",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.ok
        ) {

            throw new Error(
                dados.erro ||
                dados.mensagem ||
                "Não foi possível salvar a máquina."
            );

        }


        alert(
            "✅ Máquina salva com sucesso."
        );


        falarMensagem(
            "Máquina salva com sucesso."
        );


        maquinaEmEdicao =
            null;


        limparFormularioMaquina();


        /*
           Recarrega orçamento e patrimônio
           para refletir imediatamente a aquisição.
        */

        await carregarDadosIniciais();


    } catch (erro) {

        console.error(
            "Erro ao salvar máquina:",
            erro
        );


        alert(
            `❌ Erro ao salvar máquina: ${erro.message}`
        );

    }
}


/* ==========================================================================
   EDITAR
========================================================================== */

async function editarMaquina(id) {

    try {

        const resposta =
            await fetch(
                `/api/maquinas/buscar/${encodeURIComponent(id)}`,
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.ok
        ) {

            throw new Error(
                dados.erro ||
                "Máquina não encontrada."
            );

        }


        maquinaEmEdicao =
            dados.maquina;


        preencherFormularioMaquina(
            dados.maquina
        );


        window.scrollTo(
            {
                top: 0,
                behavior: "smooth"
            }
        );


    } catch (erro) {

        console.error(
            "Erro ao buscar máquina:",
            erro
        );


        alert(
            `❌ ${erro.message}`
        );

    }
}


/* ==========================================================================
   PREENCHER FORMULÁRIO
========================================================================== */

function preencherFormularioMaquina(
    maquina
) {

    definirValor(
        [
            "nome_equipamento",
            "nome"
        ],
        maquina.nome_equipamento ?? ""
    );


    definirValor(
        ["potencia"],
        maquina.potencia ?? ""
    );


    definirValor(
        [
            "consumo_eletrico",
            "consumo"
        ],
        maquina.consumo_eletrico ?? ""
    );


    definirValor(
        [
            "consumo_agua",
            "agua"
        ],
        maquina.consumo_agua ?? ""
    );


    definirValor(
        [
            "consumo_gases",
            "gases"
        ],
        maquina.consumo_gases ?? ""
    );


    definirValor(
        ["velocidade"],
        maquina.velocidade ?? ""
    );


    definirValor(
        ["avanco"],
        maquina.avanco ?? ""
    );


    definirValor(
        [
            "frequencia_manutencao",
            "frequencia"
        ],
        maquina.frequencia_manutencao ?? ""
    );


    definirValor(
        [
            "preco_compra",
            "preco"
        ],
        maquina.preco_compra ?? ""
    );


    definirValor(
        [
            "depreciacao_mensal",
            "depreciacao"
        ],
        maquina.depreciacao_mensal ?? ""
    );


    definirValor(
        [
            "valor_venda_final",
            "valor_residual"
        ],
        maquina.valor_venda_final ?? ""
    );


    definirValor(
        [
            "operador_nome",
            "operador"
        ],
        maquina.operador_nome ?? ""
    );


    definirValor(
        [
            "custo_minuto_operador"
        ],
        maquina.custo_minuto_operador ?? ""
    );


    definirValor(
        [
            "custo_minuto_maquina"
        ],
        maquina.custo_minuto_maquina ?? ""
    );


    definirValor(
        [
            "jornada_semanal"
        ],
        maquina.jornada_semanal ?? 44
    );


    definirValor(
        [
            "turnos_trabalho"
        ],
        maquina.turnos_trabalho ?? 1
    );


    const elementoPatrimonio =
        obterElemento(
            "is_patrimonio"
        ) ||
        obterElemento(
            "ativo_patrimonio"
        );


    if (
        elementoPatrimonio &&
        "checked" in elementoPatrimonio
    ) {

        elementoPatrimonio.checked =
            Boolean(
                maquina.is_patrimonio
            );

    }


    calcularMinutoMaquina();
}


/* ==========================================================================
   EXCLUIR
========================================================================== */

async function deletarMaquina(id) {

    if (
        !confirm(
            "Deseja realmente excluir esta máquina?"
        )
    ) {
        return;
    }


    try {

        const resposta =
            await fetch(
                `/api/maquinas/deletar/${encodeURIComponent(id)}`,
                {
                    method: "DELETE",
                    credentials: "same-origin"
                }
            );


        const dados =
            await resposta.json();


        if (
            !resposta.ok ||
            !dados.ok
        ) {

            throw new Error(
                dados.erro ||
                "Não foi possível excluir a máquina."
            );

        }


        alert(
            "✅ Máquina excluída."
        );


        falarMensagem(
            "Máquina excluída."
        );


        if (
            maquinaEmEdicao &&
            Number(maquinaEmEdicao.id) ===
            Number(id)
        ) {

            maquinaEmEdicao =
                null;

            limparFormularioMaquina();
        }


        /*
           Importante:
           a exclusão remove o patrimônio atual
           retornado pelo backend e, portanto,
           recompõe o saldo da quota de Máquinas.
        */

        await carregarDadosIniciais();


    } catch (erro) {

        console.error(
            "Erro ao excluir máquina:",
            erro
        );


        alert(
            `❌ Erro ao excluir máquina: ${erro.message}`
        );

    }
}


/* ==========================================================================
   LIMPAR FORMULÁRIO
========================================================================== */

function limparFormularioMaquina() {

    maquinaEmEdicao =
        null;


    const formulario =
        obterElemento(
            "formMaquina"
        ) ||
        obterElemento(
            "form_maquina"
        ) ||
        document.querySelector(
            "form"
        );


    if (
        formulario &&
        typeof formulario.reset ===
        "function"
    ) {

        formulario.reset();

    }


    definirValor(
        [
            "custo_minuto_maquina"
        ],
        "0.0000"
    );
}


/* ==========================================================================
   INICIALIZAÇÃO DA PÁGINA
========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const formulario =
            obterElemento(
                "formMaquina"
            ) ||
            obterElemento(
                "form_maquina"
            );


        if (formulario) {

            formulario.addEventListener(
                "submit",
                salvarMaquina
            );

        }


        const seletorModelo =
            obterElemento(
                "catalogo_ativo"
            ) ||
            obterElemento(
                "modelo_ativo"
            ) ||
            obterElemento(
                "modelo"
            );


        if (seletorModelo) {

            seletorModelo.addEventListener(
                "change",
                event => {

                    carregarModelo(
                        event.target.value
                    );

                }
            );

        }


        const botaoSalvar =
            obterElemento(
                "btnSalvarMaquina"
            ) ||
            obterElemento(
                "btn_salvar_maquina"
            );


        if (
            botaoSalvar &&
            !formulario
        ) {

            botaoSalvar.addEventListener(
                "click",
                salvarMaquina
            );

        }


        const botaoLimpar =
            obterElemento(
                "btnLimparMaquina"
            ) ||
            obterElemento(
                "btn_limpar_maquina"
            );


        if (botaoLimpar) {

            botaoLimpar.addEventListener(
                "click",
                limparFormularioMaquina
            );

        }


        /*
           Primeira carga.
        */

        carregarDadosIniciais();


        /*
           Mantém o módulo sincronizado
           com Financeiro e patrimônio.
        */

        setInterval(
            () => {

                carregarOrcamentoMaquinas();

                carregarListaMaquinas();

            },
            5000
        );

    }
);


/* ==========================================================================
   COMPATIBILIDADE COM O HTML
========================================================================== */

window.carregarModelo =
    carregarModelo;

window.calcularMinutoMaquina =
    calcularMinutoMaquina;

window.carregarDadosIniciais =
    carregarDadosIniciais;

window.carregarOrcamentoMaquinas =
    carregarOrcamentoMaquinas;

window.salvarMaquina =
    salvarMaquina;

window.editarMaquina =
    editarMaquina;

window.deletarMaquina =
    deletarMaquina;

window.limparFormularioMaquina =
    limparFormularioMaquina;

window.mudarFonte =
    mudarFonte;

window.alternarModoEscuro =
    alternarModoEscuro;

window.alternarAltoContraste =
    alternarAltoContraste;

window.alternarLeitorAudio =
    alternarLeitorAudio;
