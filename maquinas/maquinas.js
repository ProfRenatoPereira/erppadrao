/* ==========================================================================
   TERADMAS ERP v2.6
   MÓDULO 07 - ENGENHARIA DE ATIVOS (MÁQUINAS)
   
   RESPONSABILIDADES:
   - Preservar o contrato atual do maquinas.html
   - Ler capital inicial real
   - Ler quota oficial de Máquinas
   - Calcular valor da quota sobre o CAPITAL INICIAL
   - Deduzir somente patrimônio efetivamente adquirido
   - Manter CRUD de máquinas
   - Manter cálculo de custo/minuto
   - Preparar pesquisa dinâmica de equipamentos via Google
   ========================================================================== */

"use strict";

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */

let tamanhoFonteAtual = 16;
let leitorAtivo = false;

let capitalInicialGlobal = 0;
let porcentagemQuotaGlobal = 0;
let valorQuotaGlobal = 0;
let patrimonioMaquinasGlobal = 0;
let saldoAquisicaoGlobal = 0;

let maquinasCadastradas = [];
let maquinaEmEdicao = null;


/* ==========================================================================
   UTILITÁRIOS
   ========================================================================== */

function numeroSeguro(valor, padrao = 0) {
    if (valor === null || valor === undefined || valor === "") {
        return padrao;
    }

    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : padrao;
    }

    let texto = String(valor).trim();

    if (!texto) return padrao;

    /*
       Trata:
       1000000.50
       1.000.000,50
       1000000,50
    */
    if (texto.includes(",") && texto.includes(".")) {
        texto = texto.replace(/\./g, "").replace(",", ".");
    } else if (texto.includes(",")) {
        texto = texto.replace(",", ".");
    }

    const resultado = Number(texto);

    return Number.isFinite(resultado) ? resultado : padrao;
}


function formatarBRL(valor) {
    return numeroSeguro(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}


function formatarNumero(valor, casas = 2) {
    return numeroSeguro(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}


function elemento(id) {
    return document.getElementById(id);
}


function definirTexto(id, valor) {
    const el = elemento(id);
    if (el) {
        el.innerText = valor;
    }
}


function definirValor(id, valor) {
    const el = elemento(id);
    if (el) {
        el.value = valor;
    }
}


/* ==========================================================================
   ACESSIBILIDADE
   ========================================================================== */

function mudarFonte(passo) {
    tamanhoFonteAtual += Number(passo) || 0;

    tamanhoFonteAtual = Math.max(
        12,
        Math.min(24, tamanhoFonteAtual)
    );

    document.documentElement.style.fontSize =
        tamanhoFonteAtual + "px";

    const elementos = document.querySelectorAll(
        "p, label, input, select, th, td, h1, h2, h3, h4, span, button, a"
    );

    elementos.forEach(el => {
        el.style.setProperty(
            "font-size",
            (tamanhoFonteAtual - 3) + "px",
            "important"
        );
    });
}


function alternarModoEscuro() {
    document.body.classList.remove("alto-contraste");
    document.body.classList.toggle("dark-mode");

    const btn = elemento("btn_tema");

    if (btn) {
        btn.innerText =
            document.body.classList.contains("dark-mode")
                ? "☀️ Modo Claro"
                : "🌙 Modo Escuro";
    }
}


function alternarAltoContraste() {
    document.body.classList.remove("dark-mode");
    document.body.classList.toggle("alto-contraste");
}


function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;

    const btn =
        elemento("btn-leitor-audio") ||
        elemento("btn-leitor");

    if (!btn) return;

    if (!leitorAtivo) {
        window.speechSynthesis.cancel();

        btn.innerText = "🔊 Ativar Leitor";
        btn.setAttribute("aria-pressed", "false");

        return;
    }

    btn.innerText = "🔇 Desativar Leitor";
    btn.setAttribute("aria-pressed", "true");

    window.speechSynthesis.cancel();

    const texto = `
        Módulo de Engenharia de Ativos.
        Este módulo permite cadastrar máquinas e equipamentos,
        calcular custos por minuto,
        controlar o patrimônio adquirido
        e analisar a disponibilidade da quota destinada às máquinas.
    `;

    const utterance =
        new SpeechSynthesisUtterance(texto);

    utterance.lang = "pt-BR";

    utterance.onend = function () {
        leitorAtivo = false;

        btn.innerText = "🔊 Ativar Leitor";
        btn.setAttribute("aria-pressed", "false");
    };

    window.speechSynthesis.speak(utterance);
}


/* ==========================================================================
   ORÇAMENTO / CAPITAL / QUOTA
   ========================================================================== */

async function carregarOrcamentoMaquinas() {
    try {
        const resposta =
            await fetch("/api/maquinas/orcamento", {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });

        if (!resposta.ok) {
            throw new Error(
                "HTTP " + resposta.status
            );
        }

        const dados = await resposta.json();

        if (
            !dados ||
            dados.status === "erro"
        ) {
            throw new Error(
                dados?.message ||
                "A API não retornou o orçamento."
            );
        }

        capitalInicialGlobal =
            numeroSeguro(dados.capital_inicial);

        porcentagemQuotaGlobal =
            Math.max(
                0,
                Math.min(
                    100,
                    numeroSeguro(
                        dados.porcentagem_quota
                    )
                )
            );

        valorQuotaGlobal =
            numeroSeguro(dados.valor_quota);

        patrimonioMaquinasGlobal =
            numeroSeguro(dados.patrimonio_atual);

        saldoAquisicaoGlobal =
            Math.max(
                0,
                numeroSeguro(dados.saldo_aquisicao)
            );

        atualizarPainelOrcamentario();

        return dados;

    } catch (erro) {
        console.error(
            "Erro ao carregar orçamento de Máquinas:",
            erro
        );

        /*
           Não deixar "Carregando..." indefinidamente.
           Se a API falhar, mostramos indisponibilidade.
        */
        definirTexto(
            "top_capital_total",
            "Indisponível"
        );

        definirTexto(
            "top_disponivel_setor",
            "Indisponível"
        );

        definirTexto(
            "top_orcamento_inicial",
            "Indisponível"
        );

        definirTexto(
            "top_verba_reais",
            "Indisponível"
        );

        return null;
    }
}


/* ==========================================================================
   ATUALIZAÇÃO DOS CARDS DO HTML ATUAL
   ========================================================================== */

function atualizarPainelOrcamentario() {

    const capital =
        capitalInicialGlobal;

    const quota =
        porcentagemQuotaGlobal;

    const valorQuota =
        valorQuotaGlobal;

    const patrimonio =
        patrimonioMaquinasGlobal;

    const saldo =
        saldoAquisicaoGlobal;

    /*
       CAPITAL INICIAL
    */

    definirTexto(
        "top_capital_total",
        formatarBRL(capital)
    );


    /*
       QUOTA DE MÁQUINAS
    */

    definirTexto(
        "top_disponivel_setor",
        formatarBRL(valorQuota)
    );

    definirTexto(
        "pct_disponivel_setor",
        `➔ ${formatarNumero(quota)}% do Cap.`
    );


    /*
       VALOR ENDEREÇADO
    */

    definirTexto(
        "top_orcamento_inicial",
        formatarBRL(valorQuota)
    );

    definirTexto(
        "pct_orcamento_inicial",
        `➔ ${formatarNumero(quota)}% do Cap.`
    );


    /*
       SALDO PARA AQUISIÇÕES
    */

    definirTexto(
        "top_verba_reais",
        formatarBRL(saldo)
    );

    const percentualSaldo =
        capital > 0
            ? (saldo / capital) * 100
            : 0;

    definirTexto(
        "pct_saldo_engenharia",
        `➔ ${formatarNumero(percentualSaldo)}% do Cap.`
    );


    /*
       PATRIMÔNIO
    */

    definirTexto(
        "top_patrimonio_maquinas",
        formatarBRL(patrimonio)
    );

    const percentualPatrimonio =
        capital > 0
            ? (patrimonio / capital) * 100
            : 0;

    definirTexto(
        "pct_patrimonio_maquinas",
        `➔ ${formatarNumero(percentualPatrimonio)}% do Cap.`
    );


    /*
       CONSUMO DA QUOTA
    */

    const consumo =
        valorQuota > 0
            ? (patrimonio / valorQuota) * 100
            : 0;

    const consumoLimitado =
        Math.max(
            0,
            Math.min(100, consumo)
        );

    definirTexto(
        "txt_valores_limite",
        `${formatarBRL(patrimonio)} / ${formatarBRL(valorQuota)}`
    );

    definirTexto(
        "txt_porcentagem_budget",
        `${formatarNumero(consumoLimitado, 1)}% da quota consumida`
    );

    const barra =
        elemento("barra_progresso_budget");

    if (barra) {
        barra.style.width =
            consumoLimitado + "%";
    }
}


/* ==========================================================================
   MÉTRICAS FINANCEIRAS
   ========================================================================== */

async function carregarMetricasFinanceiras() {

    try {

        const resposta =
            await fetch(
                "/api/financeiro/metricas?dept=maquinas",
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        if (!resposta.ok) {
            throw new Error(
                "HTTP " + resposta.status
            );
        }

        const metricas =
            await resposta.json();

        const custoFixoEmpresa =
            numeroSeguro(
                metricas.custo_fixo_geral_empresa
            );

        const custoFixoSetor =
            numeroSeguro(
                metricas.custo_fixo_isolado_setor
            );

        const custoVariavelEmpresa =
            numeroSeguro(
                metricas.custo_variavel_total
            );

        const custoVariavelSetor =
            numeroSeguro(
                metricas.custo_variavel_isolado_setor
            );


        definirTexto(
            "top_custo_fixo",
            formatarBRL(custoFixoEmpresa) + "/mês"
        );

        definirTexto(
            "top_custo_fixo_setor",
            formatarBRL(custoFixoSetor) + "/mês"
        );

        definirTexto(
            "top_custo_variavel",
            formatarBRL(custoVariavelEmpresa) + "/mês"
        );

        definirTexto(
            "top_custo_variavel_setor",
            formatarBRL(custoVariavelSetor) + "/mês"
        );


        const pctFixoEmpresa =
            capitalInicialGlobal > 0
                ? (custoFixoEmpresa / capitalInicialGlobal) * 100
                : 0;

        const pctFixoSetor =
            capitalInicialGlobal > 0
                ? (custoFixoSetor / capitalInicialGlobal) * 100
                : 0;

        const pctVariavelEmpresa =
            capitalInicialGlobal > 0
                ? (custoVariavelEmpresa / capitalInicialGlobal) * 100
                : 0;

        const pctVariavelSetor =
            capitalInicialGlobal > 0
                ? (custoVariavelSetor / capitalInicialGlobal) * 100
                : 0;


        definirTexto(
            "pct_custo_fixo_geral",
            `➔ Custos Totais: ${formatarNumero(pctFixoEmpresa)}% | Custos Fixos: ${formatarNumero(pctFixoEmpresa)}%`
        );

        definirTexto(
            "pct_custo_fixo_setor",
            `➔ Custos Totais: ${formatarNumero(pctFixoSetor)}% | Custos Fixos: ${formatarNumero(pctFixoSetor)}%`
        );

        definirTexto(
            "pct_custo_variavel_geral",
            `➔ Custos Totais: ${formatarNumero(pctVariavelEmpresa)}% | Custos Variáveis: ${formatarNumero(pctVariavelEmpresa)}%`
        );

        definirTexto(
            "pct_custo_variavel_setor",
            `➔ Custos Totais: ${formatarNumero(pctVariavelSetor)}% | Custos Variáveis: ${formatarNumero(pctVariavelSetor)}%`
        );

        return metricas;

    } catch (erro) {

        console.error(
            "Erro ao carregar métricas financeiras:",
            erro
        );

        return null;
    }
}


/* ==========================================================================
   CATÁLOGO BASE
   ========================================================================== */

const CATALOGO_ATIVOS = {

    cnc_mazak: {
        nome: "Torno CNC Mazak Quick Turn",
        potencia: "22.0",
        consumo: "18.5",
        agua: "0",
        gases: "0",
        velocidade: "4500 RPM",
        avanco: "5000 mm/min",
        manutencao: "500",
        preco: "650000.00",
        depr: "5416.67",
        residual: "130000.00",
        operador: "Operador CNC Nível III",
        mod: "0.4500"
    },

    centro_usid: {
        nome: "Centro de Usinagem CNC",
        potencia: "30.0",
        consumo: "25.0",
        agua: "0",
        gases: "0",
        velocidade: "8000 RPM",
        avanco: "6000 mm/min",
        manutencao: "500",
        preco: "850000.00",
        depr: "7083.33",
        residual: "170000.00",
        operador: "Operador CNC Nível III",
        mod: "0.4500"
    },

    torno_mecanico: {
        nome: "Torno Mecânico Convencional",
        potencia: "7.5",
        consumo: "6.0",
        agua: "0",
        gases: "0",
        velocidade: "1800 RPM",
        avanco: "800 mm/min",
        manutencao: "300",
        preco: "85000.00",
        depr: "708.33",
        residual: "17000.00",
        operador: "Torneiro Mecânico",
        mod: "0.3000"
    },

    serra_fita: {
        nome: "Serra de Fita Industrial",
        potencia: "5.5",
        consumo: "4.5",
        agua: "0",
        gases: "0",
        velocidade: "120 RPM",
        avanco: "100 mm/min",
        manutencao: "200",
        preco: "45000.00",
        depr: "375.00",
        residual: "9000.00",
        operador: "Operador de Máquinas",
        mod: "0.2500"
    },

    retifica: {
        nome: "Retífica Cilíndrica",
        potencia: "11.0",
        consumo: "9.0",
        agua: "0",
        gases: "0",
        velocidade: "3000 RPM",
        avanco: "500 mm/min",
        manutencao: "300",
        preco: "180000.00",
        depr: "1500.00",
        residual: "36000.00",
        operador: "Retificador",
        mod: "0.3500"
    },

    furadeira_radial: {
        nome: "Furadeira Radial",
        potencia: "7.5",
        consumo: "6.0",
        agua: "0",
        gases: "0",
        velocidade: "1500 RPM",
        avanco: "300 mm/min",
        manutencao: "200",
        preco: "75000.00",
        depr: "625.00",
        residual: "15000.00",
        operador: "Operador de Máquinas",
        mod: "0.2500"
    },

    forno_atmo: {
        nome: "Forno de Atmosfera Controlada",
        potencia: "45.0",
        consumo: "38.0",
        agua: "0",
        gases: "5.0",
        velocidade: "",
        avanco: "",
        manutencao: "500",
        preco: "320000.00",
        depr: "2666.67",
        residual: "64000.00",
        operador: "Operador de Tratamento Térmico",
        mod: "0.3500"
    },

    forno_reveni: {
        nome: "Forno de Revenimento",
        potencia: "30.0",
        consumo: "25.0",
        agua: "0",
        gases: "3.0",
        velocidade: "",
        avanco: "",
        manutencao: "400",
        preco: "220000.00",
        depr: "1833.33",
        residual: "44000.00",
        operador: "Operador de Tratamento Térmico",
        mod: "0.3500"
    },

    compressor_ar: {
        nome: "Compressor de Ar de Parafuso",
        potencia: "37.0",
        consumo: "30.0",
        agua: "0",
        gases: "0",
        velocidade: "",
        avanco: "",
        manutencao: "350",
        preco: "145000.00",
        depr: "1208.33",
        residual: "29000.00",
        operador: "Técnico de Utilidades",
        mod: "0.2800"
    },

    empilhadeira_ele: {
        nome: "Empilhadeira Elétrica",
        potencia: "12.0",
        consumo: "8.0",
        agua: "0",
        gases: "0",
        velocidade: "15 km/h",
        avanco: "",
        manutencao: "250",
        preco: "185000.00",
        depr: "1541.67",
        residual: "37000.00",
        operador: "Operador de Empilhadeira",
        mod: "0.2800"
    },

    cestos_inox: {
        nome: "Cestos de Aço Inox (Forno)",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "",
        avanco: "",
        manutencao: "50",
        preco: "3500.00",
        depr: "29.17",
        residual: "700.00",
        operador: "Operador de Produção",
        mod: "0"
    },

    palets_aco: {
        nome: "Paletes de Aço Reforçados",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "",
        avanco: "",
        manutencao: "30",
        preco: "1800.00",
        depr: "15.00",
        residual: "360.00",
        operador: "Operador de Produção",
        mod: "0"
    },

    caixas_trans: {
        nome: "Caixas Metálicas para Transporte",
        potencia: "0",
        consumo: "0",
        agua: "0",
        gases: "0",
        velocidade: "",
        avanco: "",
        manutencao: "20",
        preco: "1200.00",
        depr: "10.00",
        residual: "240.00",
        operador: "Operador de Produção",
        mod: "0"
    }
};


/* ==========================================================================
   CARREGAMENTO DE MODELO
   ========================================================================== */

function carregarPreDefinido() {

    const seletor =
        elemento("seletor_modelo");

    if (!seletor) return;

    const codigo =
        seletor.value;

    if (!codigo) return;

    const modelo =
        CATALOGO_ATIVOS[codigo];

    if (!modelo) {
        console.warn(
            "Modelo não encontrado no catálogo:",
            codigo
        );
        return;
    }

    definirValor(
        "nome_equipamento",
        modelo.nome
    );

    definirValor(
        "potencia",
        modelo.potencia
    );

    definirValor(
        "consumo_eletrico",
        modelo.consumo
    );

    definirValor(
        "consumo_agua",
        modelo.agua
    );

    definirValor(
        "consumo_gases",
        modelo.gases
    );

    definirValor(
        "velocidade",
        modelo.velocidade
    );

    definirValor(
        "avanco",
        modelo.avanco
    );

    definirValor(
        "frequencia_manutencao",
        modelo.manutencao
    );

    definirValor(
        "preco_compra",
        modelo.preco
    );

    definirValor(
        "depreciacao_mensal",
        modelo.depr
    );

    definirValor(
        "valor_venda_final",
        modelo.residual
    );

    definirValor(
        "operador_nome",
        modelo.operador
    );

    definirValor(
        "custo_minuto_operador",
        modelo.mod
    );

    calcularMinutoMaquina();
}


/* ==========================================================================
   CÁLCULO DO CUSTO POR MINUTO
   ========================================================================== */

function calcularMinutoMaquina() {

    const depreciacaoMensal =
        numeroSeguro(
            elemento("depreciacao_mensal")?.value
        );

    const consumoEletrico =
        numeroSeguro(
            elemento("consumo_eletrico")?.value
        );

    const consumoAgua =
        numeroSeguro(
            elemento("consumo_agua")?.value
        );

    const consumoGases =
        numeroSeguro(
            elemento("consumo_gases")?.value
        );

    const custoOperador =
        numeroSeguro(
            elemento("custo_minuto_operador")?.value
        );

    const jornada =
        numeroSeguro(
            elemento("jornada_semanal")?.value,
            44
        );

    const turnos =
        numeroSeguro(
            elemento("turnos_trabalho")?.value,
            1
        );


    /*
       Capacidade mensal aproximada.

       Mantemos o cálculo operacional do módulo.
       Os custos estruturais adicionais continuarão sendo
       tratados pela arquitetura financeira/custos do ERP.
    */

    const minutosMensais =
        jornada *
        4.33 *
        60 *
        turnos;


    const custoDepreciacaoMinuto =
        minutosMensais > 0
            ? depreciacaoMensal / minutosMensais
            : 0;


    /*
       Tarifas operacionais utilizadas pelo cálculo técnico
       atualmente existente no módulo.
    */

    const TARIFA_KWH = 0.78;
    const TARIFA_AGUA_M3 = 8.20;
    const TARIFA_GAS_M3 = 5.40;


    const custoEnergiaMinuto =
        minutosMensais > 0
            ? (
                consumoEletrico *
                TARIFA_KWH *
                (jornada * 4.33 * turnos)
              ) / minutosMensais
            : 0;


    const custoAguaMinuto =
        minutosMensais > 0
            ? (
                consumoAgua *
                TARIFA_AGUA_M3 *
                (jornada * 4.33 * turnos)
              ) / minutosMensais
            : 0;


    const custoGasMinuto =
        minutosMensais > 0
            ? (
                consumoGases *
                TARIFA_GAS_M3 *
                (jornada * 4.33 * turnos)
              ) / minutosMensais
            : 0;


    /*
       A taxa estrutural fixa anterior foi removida.
       O campo hidden continua existindo no HTML somente
       por compatibilidade, mas não recebe mais 5% ou 40%.
    */

    const custoEstruturalOculto =
        numeroSeguro(
            elemento("custo_estrutural_oculto")?.value
        );


    const custoEstruturalMinuto =
        custoEstruturalOculto;


    const custoTotalMinuto =
        custoDepreciacaoMinuto +
        custoEnergiaMinuto +
        custoAguaMinuto +
        custoGasMinuto +
        custoOperador +
        custoEstruturalMinuto;


    definirValor(
        "custo_minuto_maquina",
        custoTotalMinuto.toFixed(4)
    );

    return custoTotalMinuto;
}


/* ==========================================================================
   LISTAGEM DAS MÁQUINAS
   ========================================================================== */

async function carregarMaquinas() {

    try {

        const resposta =
            await fetch(
                "/api/maquinas/listar",
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        if (!resposta.ok) {
            throw new Error(
                "HTTP " + resposta.status
            );
        }

        const dados =
            await resposta.json();

        maquinasCadastradas =
            Array.isArray(dados)
                ? dados
                : [];

        renderizarTabelaMaquinas();

        /*
           Depois da listagem, atualizamos orçamento.
           Assim o patrimônio recém-cadastrado é refletido.
        */

        await carregarOrcamentoMaquinas();

    } catch (erro) {

        console.error(
            "Erro ao carregar máquinas:",
            erro
        );

        maquinasCadastradas = [];

        renderizarTabelaMaquinas();
    }
}


/* ==========================================================================
   TABELA
   ========================================================================== */

function escaparHTML(valor) {

    return String(
        valor ?? ""
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function renderizarTabelaMaquinas() {

    const tbody =
        elemento("tabela_maquinas");

    if (!tbody) return;

    if (
        !maquinasCadastradas ||
        maquinasCadastradas.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    style="
                        padding:16px;
                        text-align:center;
                        color:#94a3b8;
                        font-style:italic;
                        font-weight:bold;
                    "
                >
                    Nenhuma máquina cadastrada.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        maquinasCadastradas.map(maquina => {

            const custoMinuto =
                numeroSeguro(
                    maquina.custo_minuto_maquina
                );

            const patrimonio =
                maquina.is_patrimonio !== false;


            return `
                <tr>

                    <td>
                        <strong>
                            ${escaparHTML(
                                maquina.nome_equipamento
                            )}
                        </strong>
                        ${
                            patrimonio
                                ? `<br>
                                   <span
                                     style="
                                       font-size:10px;
                                       color:#16a34a;
                                       font-weight:bold;
                                     "
                                   >
                                     ATIVO PATRIMONIAL
                                   </span>`
                                : ""
                        }
                    </td>

                    <td>
                        ${formatarNumero(
                            numeroSeguro(
                                maquina.consumo_eletrico
                            ),
                            2
                        )} kWh
                    </td>

                    <td>
                        ${escaparHTML(
                            maquina.operador_nome || "-"
                        )}
                    </td>

                    <td>
                        <strong>
                            ${formatarBRL(
                                custoMinuto
                            )}
                        </strong>
                        /min
                    </td>

                    <td
                        style="
                            text-align:center;
                            white-space:nowrap;
                        "
                    >

                        <button
                            type="button"
                            class="btn-top"
                            onclick="window.editarMaquina(${Number(maquina.id)})"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="btn-top"
                            onclick="window.deletarMaquina(${Number(maquina.id)})"
                            style="
                                background-color:#fef2f2;
                                color:#dc2626;
                                border-color:#fee2e2;
                            "
                        >
                            Excluir
                        </button>

                    </td>

                </tr>
            `;

        }).join("");
}


/* ==========================================================================
   SALVAR MÁQUINA
   ========================================================================== */

async function salvarMaquina(event) {

    if (
        event &&
        typeof event.preventDefault === "function"
    ) {
        event.preventDefault();
    }


    const nome =
        elemento("nome_equipamento")?.value
            ?.trim();


    if (!nome) {
        alert(
            "❌ Informe o nome do equipamento."
        );
        return;
    }


    const preco =
        numeroSeguro(
            elemento("preco_compra")?.value
        );


    if (preco <= 0) {
        alert(
            "❌ Informe um preço de aquisição válido."
        );
        return;
    }


    /*
       REGRA FINANCEIRA:

       A máquina somente pode ser registrada como patrimônio
       se estiver dentro do saldo da quota de Máquinas.

       Na edição, o valor do próprio patrimônio existente
       não deve ser contado novamente.
    */

    const idAtual =
        elemento("registro_id")?.value;


    let patrimonioAtualDoRegistro = 0;

    if (idAtual) {

        const registro =
            maquinasCadastradas.find(
                m =>
                    Number(m.id) ===
                    Number(idAtual)
            );

        if (registro) {
            patrimonioAtualDoRegistro =
                numeroSeguro(
                    registro.preco_compra
                );
        }
    }


    const saldoConsiderandoEdicao =
        saldoAquisicaoGlobal +
        patrimonioAtualDoRegistro;


    const isPatrimonio =
        elemento("is_patrimonio")?.checked !== false;


    if (
        isPatrimonio &&
        preco > saldoConsiderandoEdicao
    ) {

        alert(
            "❌ Aquisição não autorizada.\n\n" +
            "Valor da máquina: " +
            formatarBRL(preco) +
            "\n" +
            "Saldo disponível da quota: " +
            formatarBRL(
                saldoConsiderandoEdicao
            ) +
            "\n\n" +
            "Revise a aquisição."
        );

        return;
    }


    const dados = {

        id:
            idAtual
                ? Number(idAtual)
                : null,

        nome_equipamento:
            nome,

        potencia:
            numeroSeguro(
                elemento("potencia")?.value
            ),

        consumo_eletrico:
            numeroSeguro(
                elemento("consumo_eletrico")?.value
            ),

        consumo_agua:
            numeroSeguro(
                elemento("consumo_agua")?.value
            ),

        consumo_gases:
            numeroSeguro(
                elemento("consumo_gases")?.value
            ),

        velocidade:
            elemento("velocidade")?.value || "",

        avanco:
            elemento("avanco")?.value || "",

        frequencia_manutencao:
            Math.max(
                0,
                Math.trunc(
                    numeroSeguro(
                        elemento(
                            "frequencia_manutencao"
                        )?.value
                    )
                )
            ),

        preco_compra:
            preco,

        depreciacao_mensal:
            numeroSeguro(
                elemento(
                    "depreciacao_mensal"
                )?.value
            ),

        valor_venda_final:
            numeroSeguro(
                elemento(
                    "valor_venda_final"
                )?.value
            ),

        operador_nome:
            elemento("operador_nome")?.value
                ?.trim() || "",

        custo_minuto_operador:
            numeroSeguro(
                elemento(
                    "custo_minuto_operador"
                )?.value
            ),

        custo_minuto_maquina:
            numeroSeguro(
                elemento(
                    "custo_minuto_maquina"
                )?.value
            ),

        jornada_semanal:
            elemento("jornada_semanal")?.value ||
            "44",

        turnos_trabalho:
            elemento("turnos_trabalho")?.value ||
            "1",

        is_patrimonio:
            isPatrimonio
    };


    try {

        const resposta =
            await fetch(
                "/api/maquinas/salvar",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify(dados)
                }
            );


        const retorno =
            await resposta.json()
                .catch(() => ({}));


        if (!resposta.ok) {

            throw new Error(
                retorno.message ||
                retorno.erro ||
                "Falha ao salvar máquina."
            );
        }


        alert(
            "✅ Máquina registrada com sucesso."
        );


        limparFormularioMaquina();

        await carregarMaquinas();

        await carregarMetricasFinanceiras();


    } catch (erro) {

        console.error(
            "Erro ao salvar máquina:",
            erro
        );

        alert(
            "❌ Não foi possível registrar a máquina.\n\n" +
            erro.message
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
                `/api/maquinas/buscar/${id}`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!resposta.ok) {

            const erro =
                await resposta.json()
                    .catch(() => ({}));

            throw new Error(
                erro.message ||
                "Máquina não encontrada."
            );
        }


        const maquina =
            await resposta.json();


        maquinaEmEdicao =
            maquina;


        definirValor(
            "registro_id",
            maquina.id
        );

        definirValor(
            "nome_equipamento",
            maquina.nome_equipamento
        );

        definirValor(
            "potencia",
            maquina.potencia
        );

        definirValor(
            "consumo_eletrico",
            maquina.consumo_eletrico
        );

        definirValor(
            "consumo_agua",
            maquina.consumo_agua
        );

        definirValor(
            "consumo_gases",
            maquina.consumo_gases
        );

        definirValor(
            "velocidade",
            maquina.velocidade
        );

        definirValor(
            "avanco",
            maquina.avanco
        );

        definirValor(
            "frequencia_manutencao",
            maquina.frequencia_manutencao
        );

        definirValor(
            "preco_compra",
            maquina.preco_compra
        );

        definirValor(
            "depreciacao_mensal",
            maquina.depreciacao_mensal
        );

        definirValor(
            "valor_venda_final",
            maquina.valor_venda_final
        );

        definirValor(
            "operador_nome",
            maquina.operador_nome
        );

        definirValor(
            "custo_minuto_operador",
            maquina.custo_minuto_operador
        );

        definirValor(
            "jornada_semanal",
            maquina.jornada_semanal || "44"
        );

        definirValor(
            "turnos_trabalho",
            maquina.turnos_trabalho || "1"
        );


        const patrimonio =
            elemento("is_patrimonio");

        if (patrimonio) {
            patrimonio.checked =
                maquina.is_patrimonio !== false;
        }


        const seletor =
            elemento("seletor_modelo");

        if (seletor) {
            seletor.value = "";
        }


        calcularMinutoMaquina();


        const cancelar =
            elemento("btn_cancelar");

        if (cancelar) {
            cancelar.style.display =
                "inline-block";
        }


        const salvar =
            elemento("btn_salvar");

        if (salvar) {
            salvar.innerText =
                "🔄 Atualizar Ativo";
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


    } catch (erro) {

        console.error(
            "Erro ao editar máquina:",
            erro
        );

        alert(
            "❌ " + erro.message
        );
    }
}


/* ==========================================================================
   EXCLUIR
   ========================================================================== */

async function deletarMaquina(id) {

    if (
        !confirm(
            "Confirmar exclusão desta máquina?"
        )
    ) {
        return;
    }


    try {

        const resposta =
            await fetch(
                `/api/maquinas/deletar/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const retorno =
            await resposta.json()
                .catch(() => ({}));


        if (!resposta.ok) {

            throw new Error(
                retorno.message ||
                "Não foi possível excluir."
            );
        }


        alert(
            "✅ Máquina removida."
        );


        await carregarMaquinas();

        await carregarMetricasFinanceiras();


    } catch (erro) {

        console.error(
            "Erro ao excluir máquina:",
            erro
        );

        alert(
            "❌ " + erro.message
        );
    }
}


/* ==========================================================================
   LIMPAR FORMULÁRIO
   ========================================================================== */

function limparFormularioMaquina() {

    const formulario =
        elemento("formMaquina");

    if (formulario) {
        formulario.reset();
    }


    definirValor(
        "registro_id",
        ""
    );


    const agua =
        elemento("consumo_agua");

    if (agua) {
        agua.value = "0.000";
    }


    const gases =
        elemento("consumo_gases");

    if (gases) {
        gases.value = "0.000";
    }


    const jornada =
        elemento("jornada_semanal");

    if (jornada) {
        jornada.value = "44";
    }


    const turnos =
        elemento("turnos_trabalho");

    if (turnos) {
        turnos.value = "1";
    }


    const patrimonio =
        elemento("is_patrimonio");

    if (patrimonio) {
        patrimonio.checked = true;
    }


    definirValor(
        "custo_minuto_maquina",
        "0.0000"
    );


    const cancelar =
        elemento("btn_cancelar");

    if (cancelar) {
        cancelar.style.display =
            "none";
    }


    const salvar =
        elemento("btn_salvar");

    if (salvar) {
        salvar.innerText =
            "💾 Registrar Ativo no Parque Fabril";
    }


    maquinaEmEdicao = null;
}


/* ==========================================================================
   PESQUISA DINÂMICA — GOOGLE
   ========================================================================== */

/*
   Esta função é o ponto de entrada da pesquisa externa.

   O navegador NÃO recebe chave do Google.

   O backend deverá executar a consulta Google e retornar JSON.

   Endpoint esperado:

       GET /api/maquinas/pesquisar_google?q=torno%20CNC

   Formato esperado:

   {
       "status": "sucesso",
       "consulta": "torno CNC",
       "resultados": [
           {
               "titulo": "...",
               "descricao": "...",
               "url": "...",
               "marca": "...",
               "modelo": "...",
               "fabricante": "...",
               "caracteristicas": {}
           }
       ]
   }
*/

async function pesquisarEquipamentoGoogle(termo) {

    const consulta =
        String(termo || "").trim();


    if (consulta.length < 2) {

        alert(
            "Digite pelo menos dois caracteres para pesquisar."
        );

        return [];
    }


    try {

        const resposta =
            await fetch(
                "/api/maquinas/pesquisar_google?q=" +
                encodeURIComponent(consulta),
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    },
                    cache: "no-store"
                }
            );


        const dados =
            await resposta.json()
                .catch(() => ({}));


        if (!resposta.ok) {

            throw new Error(
                dados.message ||
                "Falha na pesquisa Google."
            );
        }


        if (
            dados.status &&
            dados.status !== "sucesso"
        ) {

            throw new Error(
                dados.message ||
                "Pesquisa não disponível."
            );
        }


        return Array.isArray(
            dados.resultados
        )
            ? dados.resultados
            : [];


    } catch (erro) {

        console.error(
            "Erro na pesquisa Google:",
            erro
        );

        alert(
            "❌ A pesquisa externa não pôde ser realizada.\n\n" +
            erro.message
        );

        return [];
    }
}


/* ==========================================================================
   ABERTURA DOS RESULTADOS GOOGLE
   ========================================================================== */

function abrirResultadoGoogle(url) {

    if (!url) return;

    /*
       O endereço retornado pela API deve ser aberto em nova aba.
    */

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */

async function carregarDadosIniciais() {

    console.log(
        "TERADMAS Máquinas: iniciando sincronização..."
    );


    /*
       Primeiro orçamento.
       Isso resolve os quatro cards "Carregando...".
    */

    await carregarOrcamentoMaquinas();


    /*
       Depois métricas financeiras.
    */

    await carregarMetricasFinanceiras();


    /*
       Depois patrimônio/listagem.
    */

    await carregarMaquinas();


    console.log(
        "TERADMAS Máquinas: sincronização concluída."
    );
}


/* ==========================================================================
   ATUALIZAÇÃO MANUAL
   ========================================================================== */

async function atualizarDadosMaquinas() {

    await carregarOrcamentoMaquinas();

    await carregarMetricasFinanceiras();

    await carregarMaquinas();
}


/* ==========================================================================
   EVENTOS
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "TERADMAS Máquinas JS carregado."
        );


        /*
           Expor funções usadas pelo HTML.
        */

        window.mudarFonte =
            mudarFonte;

        window.alternarModoEscuro =
            alternarModoEscuro;

        window.alternarAltoContraste =
            alternarAltoContraste;

        window.alternarLeitorAudio =
            alternarLeitorAudio;

        window.carregarPreDefinido =
            carregarPreDefinido;

        window.calcularMinutoMaquina =
            calcularMinutoMaquina;

        window.salvarMaquina =
            salvarMaquina;

        window.editarMaquina =
            editarMaquina;

        window.deletarMaquina =
            deletarMaquina;

        window.limparFormularioMaquina =
            limparFormularioMaquina;

        window.carregarDadosIniciais =
            carregarDadosIniciais;

        window.atualizarDadosMaquinas =
            atualizarDadosMaquinas;

        window.pesquisarEquipamentoGoogle =
            pesquisarEquipamentoGoogle;

        window.abrirResultadoGoogle =
            abrirResultadoGoogle;


        /*
           Inicialização.
        */

        carregarDadosIniciais();


        /*
           Recalcula custo/minuto sempre que
           os campos técnicos forem alterados.
        */

        const camposCalculo = [
            "potencia",
            "consumo_eletrico",
            "consumo_agua",
            "consumo_gases",
            "depreciacao_mensal",
            "custo_minuto_operador",
            "jornada_semanal",
            "turnos_trabalho"
        ];


        camposCalculo.forEach(id => {

            const campo =
                elemento(id);

            if (!campo) return;

            campo.addEventListener(
                "input",
                calcularMinutoMaquina
            );

            campo.addEventListener(
                "change",
                calcularMinutoMaquina
            );
        });

    }
);





// ============================================================================
// INTEGRAÇÃO DE PESQUISA WEB SEM ALTERAR OS CÁLCULOS NATIVOS
// ============================================================================

async function executarPesquisaWebNaTela() {
    const inputTermo = document.getElementById('inputBuscaWeb');
    const termo = inputTermo.value.trim();
    const btn = document.getElementById('btnPesquisarWeb');
    const painel = document.getElementById('painelResultadosWeb');
    const container = document.getElementById('containerResultadosWeb');

    if (!termo) {
        alert("Por favor, digite o nome do equipamento para pesquisar.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = "Pesquisando...";
    container.innerHTML = "<p class='text-muted my-2 small'>Buscando especificações técnicas na web...</p>";
    painel.classList.remove('d-none');

    try {
        const response = await fetch('/api/maquinas/pesquisar_web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termo: termo })
        });

        const data = await response.json();
        btn.disabled = false;
        btn.innerHTML = "Buscar Especificações";

        if (data.status === 'sucesso' && data.resultados && data.resultados.length > 0) {
            container.innerHTML = '';
            data.resultados.forEach(item => {
                const div = document.createElement('div');
                div.className = 'border-bottom py-2 d-flex justify-content-between align-items-center';
                div.innerHTML = `
                    <div>
                        <strong style="color: #0d6efd;">${item.titulo}</strong><br>
                        <small class="text-muted">${item.resumo_tecnico}</small>
                    </div>
                    <button type="button" class="btn btn-sm btn-success ms-2" onclick='preencherCamposComBusca(${JSON.stringify(item)})'>
                        Selecionar
                    </button>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = "<p class='text-danger my-2 small'>Nenhum resultado encontrado para a busca.</p>";
        }
    } catch (error) {
        console.error("Erro na busca de máquinas:", error);
        btn.disabled = false;
        btn.innerHTML = "Buscar Especificações";
        container.innerHTML = "<p class='text-danger my-2 small'>Erro de conexão com o servidor de pesquisa.</p>";
    }
}

function preencherCamposComBusca(item) {
    // Insere o valor no campo de seleção/input existente sem disparar falhas
    const campoModelo = document.getElementById('modeloBase');
    if (campoModelo) {
        if (campoModelo.tagName === 'SELECT') {
            const novaOpcao = new Option(item.titulo, item.titulo, true, true);
            campoModelo.add(novaOpcao);
        } else {
            campoModelo.value = item.titulo;
        }
        
        // Dispara o evento change para acionar os preenchimentos padrão do seu sistema, caso existam
        campoModelo.dispatchEvent(new Event('change'));
    }

    document.getElementById('painelResultadosWeb').classList.add('d-none');
}
