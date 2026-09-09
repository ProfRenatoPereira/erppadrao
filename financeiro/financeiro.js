/**
 * TERADMAS ERP v2.6
 * Controlador Financeiro e Gestão de Quotas Reativas
 * ARQUIVO: financeiro/financeiro.js
 */

let capitalDisponivelGlobal = 0.00;
let capitalTotalGlobal = 0.00;
let faturamentoTotalGlobal = 0.00;
let deptoAtual = "";
let carregamentoFinanceiroEmAndamento = false;

const INTERVALO_ATUALIZACAO_MS = 5000;

function formatarBRL(valor) {
    const numero = Number(valor) || 0;

    return numero.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function obterNumero(valor, padrao = 0) {
    const numero = Number(valor);

    return Number.isFinite(numero)
        ? numero
        : padrao;
}

function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function atualizarTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.innerText = valor;
    }
}

async function lerJSONSeguro(response) {
    const texto = await response.text();

    if (!texto) {
        return {};
    }

    try {
        return JSON.parse(texto);
    } catch (erro) {
        return {
            status: 'erro',
            message: texto
        };
    }
}

async function carregarDashboardFinanceiro() {

    if (carregamentoFinanceiroEmAndamento) {
        return;
    }

    carregamentoFinanceiroEmAndamento = true;

    try {

        const response =
            await fetch('/api/financeiro/metricas', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            });

        if (!response.ok) {
            console.warn(
                'API de métricas retornou status:',
                response.status
            );
            return;
        }

        const metrics =
            await lerJSONSeguro(response);

        capitalTotalGlobal =
            obterNumero(metrics.capital_total);

        capitalDisponivelGlobal =
            obterNumero(metrics.capital_disponivel_total);

        faturamentoTotalGlobal =
            obterNumero(metrics.patrimonio_ativo_total);

        atualizarTexto(
            'global-capital-total',
            formatarBRL(capitalTotalGlobal)
        );

        atualizarTexto(
            'global-capital-disponivel',
            formatarBRL(capitalDisponivelGlobal)
        );

        atualizarTexto(
            'global-patrimonio',
            formatarBRL(faturamentoTotalGlobal)
        );

        atualizarTexto(
            'global-custo-fixo',
            formatarBRL(
                metrics.custo_fixo_geral_empresa
            )
        );

        const porcentagemDisponivel =
            capitalTotalGlobal > 0
                ? (capitalDisponivelGlobal / capitalTotalGlobal) * 100
                : 0;

        const porcentagemPatrimonio =
            capitalTotalGlobal > 0
                ? (faturamentoTotalGlobal / capitalTotalGlobal) * 100
                : 0;

        atualizarTexto(
            'global-porcento-capital',
            capitalTotalGlobal > 0
                ? '100% do capital de fundação'
                : ''
        );

        atualizarTexto(
            'global-porcento-disponivel',
            `${porcentagemDisponivel.toFixed(2)}% disponível`
        );

        atualizarTexto(
            'global-porcento-patrimonio',
            `${porcentagemPatrimonio.toFixed(2)}% do capital`
        );

        atualizarTexto(
            'global-last-update',
            `🔄 Atualizado em ${new Date().toLocaleTimeString('pt-BR')}`
        );

        recalcularMetricasPainel();

        await renderizarResumoQuotas();
        await carregarLivroRazao();

    } catch (erro) {

        console.error(
            'Erro na sincronização financeira:',
            erro
        );

    } finally {

        carregamentoFinanceiroEmAndamento = false;
    }
}

function atualizarVisualizacaoQuota(valor) {

    let percentual =
        obterNumero(valor);

    percentual =
        Math.max(0, Math.min(100, percentual));

    const pctElem =
        document.getElementById('percentual_valor');

    const pctSlider =
        document.getElementById('percentual_quota');

    if (pctElem) {
        pctElem.value = percentual;
    }

    if (pctSlider) {
        pctSlider.value = percentual;
    }

    recalcularMetricasPainel();
}

function atualizarSliderQuota(valor) {
    atualizarVisualizacaoQuota(valor);
}

function recalcularMetricasPainel() {

    const pctElem =
        document.getElementById('percentual_valor');

    if (!pctElem) {
        return;
    }

    let pct =
        obterNumero(pctElem.value);

    pct =
        Math.max(0, Math.min(100, pct));

    const valorAlocado =
        capitalTotalGlobal * (pct / 100);

    const valorAlocadoElem =
        document.getElementById('valor_alocado_reais');

    if (valorAlocadoElem) {
        valorAlocadoElem.value =
            formatarBRL(valorAlocado);
    }

    const topQuotaCalculadaElem =
        document.getElementById('top_quota_calculada');

    if (topQuotaCalculadaElem) {
        topQuotaCalculadaElem.innerText =
            formatarBRL(valorAlocado);
    }
}

async function atualizarDetalhesSetor() {

    const seletor =
        document.getElementById(
            'departamento_selecionado'
        );

    const infoBox =
        document.getElementById('info_setor');

    const infoTxt =
        document.getElementById('info_setor_texto');

    deptoAtual =
        seletor ? seletor.value : "";

    if (!deptoAtual) {

        if (infoBox) {
            infoBox.style.display = "none";
        }

        atualizarVisualizacaoQuota(0);

        return;
    }

    try {

        const response =
            await fetch(
                `/api/financeiro/quota/${encodeURIComponent(deptoAtual)}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    cache: 'no-store'
                }
            );

        const data =
            await lerJSONSeguro(response);

        if (!response.ok) {
            throw new Error(
                data.message ||
                'Não foi possível obter a quota do setor.'
            );
        }

        const pctSalva =
            Math.max(
                0,
                Math.min(
                    100,
                    obterNumero(data.porcentagem_quota)
                )
            );

        atualizarVisualizacaoQuota(pctSalva);

        if (infoTxt) {
            infoTxt.innerHTML =
                `Módulo destino <strong>/${escaparHTML(deptoAtual)}</strong> selecionado para rateio. Defina a quota e confirme a alocação setorial.`;
        }

        if (infoBox) {
            infoBox.style.display = "block";
        }

    } catch (erro) {

        console.error(
            'Erro ao sincronizar quota setorial:',
            erro
        );

        if (infoTxt) {
            infoTxt.innerText =
                'Não foi possível sincronizar a quota deste módulo.';
        }

        if (infoBox) {
            infoBox.style.display = "block";
        }
    }
}

async function efetuarFaturamento(event) {

    event.preventDefault();

    const clienteId =
        parseInt(
            document.getElementById('fat_cliente_id').value,
            10
        );

    const clienteNome =
        document.getElementById(
            'fat_cliente_name'
        ).value.trim();

    const descricao =
        document.getElementById(
            'fat_descricao'
        ).value.trim();

    const valor =
        parseFloat(
            document.getElementById('fat_valor').value
        );

    const condicao =
        document.getElementById(
            'fat_condicao'
        ).value;

    const data =
        document.getElementById(
            'fat_data'
        ).value;

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
        alert('Informe um ID de cliente válido.');
        return;
    }

    if (!clienteNome || !descricao) {
        alert('Preencha os dados do cliente e a descrição.');
        return;
    }

    if (!Number.isFinite(valor) || valor <= 0) {
        alert('Informe um valor de faturamento maior que zero.');
        return;
    }

    if (!data) {
        alert('Informe a data de competência.');
        return;
    }

    const payload = {
        cliente_id: clienteId,
        cliente_nome_suporte: clienteNome,
        financeiro_descricao: descricao,
        financeiro_valor: valor,
        financeiro_condicao: condicao,
        financeiro_data: data
    };

    try {

        const response =
            await fetch(
                '/api/financeiro/faturar',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

        const resultado =
            await lerJSONSeguro(response);

        if (!response.ok ||
            resultado.status === 'erro') {

            throw new Error(
                resultado.message ||
                'Erro ao registrar faturamento.'
            );
        }

        alert(
            'Título de faturamento registrado com sucesso no Razão!'
        );

        const form =
            document.getElementById(
                'formFaturamento'
            );

        if (form) {
            form.reset();
        }

        await carregarDashboardFinanceiro();

        if (
            typeof window.forcarAtualizacaoMetricasTopboard ===
            'function'
        ) {
            window.forcarAtualizacaoMetricasTopboard();
        }

    } catch (erro) {

        console.error(
            'Erro ao faturar:',
            erro
        );

        alert(
            `Erro ao registrar faturamento: ${erro.message}`
        );
    }
}

async function liquidarTitulo(idReg) {

    const id =
        parseInt(idReg, 10);

    if (!Number.isInteger(id) || id <= 0) {
        alert('Identificador de título inválido.');
        return;
    }

    if (
        !confirm(
            `Confirmar liquidação e entrada física em caixa do título FT-00${id}?`
        )
    ) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/financeiro/liquidar/${id}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

        const resultado =
            await lerJSONSeguro(response);

        if (!response.ok ||
            resultado.status === 'erro') {

            throw new Error(
                resultado.message ||
                'Falha ao liquidar título.'
            );
        }

        alert(
            'Título liquidado com sucesso! Saldo injetado no Caixa de Giro.'
        );

        await carregarDashboardFinanceiro();

        if (
            typeof window.forcarAtualizacaoMetricasTopboard ===
            'function'
        ) {
            window.forcarAtualizacaoMetricasTopboard();
        }

    } catch (erro) {

        console.error(
            'Erro na liquidação:',
            erro
        );

        alert(
            `Falha ao liquidar título: ${erro.message}`
        );
    }
}

async function salvarAlocacaoSetorial(event) {

    event.preventDefault();

    if (!deptoAtual) {
        alert(
            'Por favor, selecione um módulo de destino alvo.'
        );
        return;
    }

    const percentual =
        obterNumero(
            document.getElementById(
                'percentual_valor'
            ).value
        );

    if (percentual < 0 || percentual > 100) {
        alert(
            'A quota deve estar entre 0% e 100%.'
        );
        return;
    }

    const payload = {
        departamento_id: deptoAtual,
        porcentagem_quota: percentual
    };

    try {

        const response =
            await fetch(
                '/api/financeiro/quota',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

        const resultado =
            await lerJSONSeguro(response);

        if (!response.ok ||
            resultado.status === 'erro') {

            throw new Error(
                resultado.message ||
                'Erro ao salvar quota setorial.'
            );
        }

        alert(
            'Quota setorial parametrizada e salva com sucesso!'
        );

        await carregarDashboardFinanceiro();

    } catch (erro) {

        console.error(
            'Erro ao salvar quota:',
            erro
        );

        alert(
            `Erro ao salvar quota setorial: ${erro.message}`
        );
    }
}

async function renderizarResumoQuotas() {

    const container =
        document.getElementById(
            'tabela_quotas_resumo'
        );

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(
                '/api/financeiro/quotas/summary',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    cache: 'no-store'
                }
            );

        const distribuicao =
            await lerJSONSeguro(response);

        if (!response.ok) {
            throw new Error(
                distribuicao.message ||
                'Falha ao obter resumo de quotas.'
            );
        }

        container.innerHTML = "";

        if (
            !Array.isArray(distribuicao) ||
            distribuicao.length === 0
        ) {
            container.innerHTML =
                `<div style="padding:8px;background-color:#f3f4f6;border-radius:6px;">
                    Sem quotas setoriais parametrizadas.
                </div>`;

            return;
        }

        const totalPercentual =
            distribuicao.reduce(
                (total, setor) =>
                    total +
                    obterNumero(
                        setor.porcentagem_quota
                    ),
                0
            );

        distribuicao.forEach(setor => {

            const pct =
                Math.max(
                    0,
                    Math.min(
                        100,
                        obterNumero(
                            setor.porcentagem_quota
                        )
                    )
                );

            const valorMonetario =
                capitalTotalGlobal *
                (pct / 100);

            const departamento =
                escaparHTML(
                    setor.departamento_id
                );

            container.innerHTML += `
                <div style="padding:6px 8px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;">

                    <div style="display:flex;justify-content:space-between;font-weight:bold;gap:8px;">

                        <span>
                            📍 /${departamento}
                        </span>

                        <span style="color:#16a34a;">
                            ${pct.toFixed(2)}%
                            (${formatarBRL(valorMonetario)})
                        </span>

                    </div>

                    <div class="barra-percentual-setor">

                        <div class="preenchimento-barra"
                             style="width:${pct}%;"></div>

                    </div>

                </div>
            `;
        });

        const avisoTotal =
            document.createElement('div');

        avisoTotal.style.cssText =
            'font-size:0.65rem;color:#64748b;padding:4px 2px;text-align:right;';

        avisoTotal.innerText =
            `Total parametrizado: ${totalPercentual.toFixed(2)}%`;

        container.appendChild(avisoTotal);

    } catch (erro) {

        console.error(
            'Erro ao montar resumo de distribuição:',
            erro
        );

        container.innerHTML =
            `<div style="padding:8px;background-color:#fef2f2;color:#b91c1c;border-radius:6px;">
                Não foi possível carregar a distribuição de quotas.
            </div>`;
    }
}

async function carregarLivroRazao() {

    const tbody =
        document.getElementById(
            'tabela_financeiro'
        );

    if (!tbody) {
        return;
    }

    try {

        const response =
            await fetch(
                '/api/financeiro/listar',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    cache: 'no-store'
                }
            );

        const dados =
            await lerJSONSeguro(response);

        if (!response.ok) {
            throw new Error(
                dados.message ||
                'Não foi possível carregar o razão.'
            );
        }

        tbody.innerHTML = "";

        if (
            !Array.isArray(dados) ||
            dados.length === 0
        ) {

            tbody.innerHTML =
                `<tr>
                    <td colspan="5"
                        style="text-align:center;padding:16px;color:#94a3b8;">
                        Nenhum título localizado no razão contábil.
                    </td>
                </tr>`;

            return;
        }

        dados.forEach(item => {

            const status =
                String(
                    item.status_titulo || ''
                ).trim();

            const ehAberto =
                status.toLowerCase() === 'aberto';

            const badgeColor =
                ehAberto
                    ? 'background-color:#fef3c7;color:#d97706;'
                    : 'background-color:#dcfce7;color:#15803d;';

            const botaoAcao =
                ehAberto
                    ? `
                        <button
                            type="button"
                            onclick="liquidarTitulo(${Number(item.id)})"
                            class="btn-submit"
                            style="padding:4px 8px;font-size:10px;width:auto;display:inline-block;">
                            ⚡ Liquidar
                        </button>
                    `
                    : `
                        <span style="color:#16a34a;font-weight:bold;">
                            ✓ Em Caixa
                        </span>
                    `;

            const valor =
                obterNumero(
                    item.financeiro_valor
                );

            const cond =
                escaparHTML(
                    item.financeiro_condicao || ''
                );

            const data =
                escaparHTML(
                    item.financeiro_data || ''
                );

            const nome =
                escaparHTML(
                    item.cliente_nome_suporte || ''
                );

            const descricao =
                escaparHTML(
                    item.financeiro_descricao || ''
                );

            const clienteId =
                escaparHTML(
                    item.cliente_id ?? ''
                );

            const statusSeguro =
                escaparHTML(
                    status.toUpperCase()
                );

            tbody.innerHTML += `
                <tr>

                    <td style="font-weight:bold;padding:10px;">
                        FT-00${Number(item.id)}
                        <br>
                        <small style="color:#6b7280;">
                            ID: ${clienteId}
                        </small>
                    </td>

                    <td style="padding:10px;">
                        <strong>${nome}</strong>
                        <br>
                        <small style="color:#94a3b8;">
                            ${descricao}
                        </small>
                    </td>

                    <td style="padding:10px;">

                        <span style="${badgeColor}padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;">
                            ${statusSeguro}
                        </span>

                    </td>

                    <td style="font-weight:900;color:#1e3a8a;padding:10px;">
                        ${formatarBRL(valor)}
                        <br>
                        <small style="color:#6b7280;">
                            ${cond} | ${data}
                        </small>
                    </td>

                    <td style="text-align:center;padding:10px;">
                        ${botaoAcao}
                    </td>

                </tr>
            `;
        });

    } catch (erro) {

        console.error(
            'Erro ao preencher o livro razão:',
            erro
        );

        tbody.innerHTML =
            `<tr>
                <td colspan="5"
                    style="text-align:center;padding:16px;color:#b91c1c;">
                    Erro ao carregar o livro razão.
                </td>
            </tr>`;
    }
}

document.addEventListener(
    'DOMContentLoaded',
    () => {

        const formF =
            document.getElementById(
                'formFaturamento'
            );

        if (formF) {
            formF.addEventListener(
                'submit',
                efetuarFaturamento
            );
        }

        const formQ =
            document.getElementById(
                'formAlocacao'
            );

        if (formQ) {
            formQ.addEventListener(
                'submit',
                salvarAlocacaoSetorial
            );
        }

        const dataCampo =
            document.getElementById(
                'fat_data'
            );

        if (dataCampo && !dataCampo.value) {

            const hoje =
                new Date();

            const ano =
                hoje.getFullYear();

            const mes =
                String(
                    hoje.getMonth() + 1
                ).padStart(2, '0');

            const dia =
                String(
                    hoje.getDate()
                ).padStart(2, '0');

            dataCampo.value =
                `${ano}-${mes}-${dia}`;
        }

        carregarDashboardFinanceiro();

        setInterval(
            carregarDashboardFinanceiro,
            INTERVALO_ATUALIZACAO_MS
        );
    }
);
