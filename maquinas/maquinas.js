// ============================================================================
// TERADMAS ERP v2.6 - GERENCIADOR DE MÁQUINAS E PARQUE FABRIL
// Integração de Pesquisa Dinâmica na Web + Motor Financeiro
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosIniciais();
});

// ----------------------------------------------------------------------------
// 1. CARREGAMENTO INICIAL E ATUALIZAÇÃO DOS KPIS
// ----------------------------------------------------------------------------
function carregarDadosIniciais() {
    // Busca os dados consolidados da empresa/equipe logada
    const empresaData = JSON.parse(localStorage.getItem('empresa_ativa')) || {
        nome: "Empresa Genérica",
        capitalInicial: 10000000.00,
        quotaMaquinasPercentual: 30.00
    };

    document.getElementById('nomeEmpresaHeader').innerText = `Empresa / Equipe: ${empresaData.nome}`;
    
    // Atualiza KPIs Financeiros
    const capitalInicial = empresaData.capitalInicial;
    const quotaMaquinas = capitalInicial * (empresaData.quotaMaquinasPercentual / 100);
    
    document.getElementById('kpiCapitalInicial').innerText = formatarMoeda(capitalInicial);
    document.getElementById('kpiQuotaMaquinas').innerText = formatarMoeda(quotaMaquinas);
    document.getElementById('kpiPercentualQuota').innerText = `${empresaData.quotaMaquinasPercentual}% do capital`;

    renderizarTabelaParqueFabril();
    atualizarResumoPatrimonial();
}

// ----------------------------------------------------------------------------
// 2. PESQUISA DINÂMICA DE EQUIPAMENTOS NA INTERNET
// ----------------------------------------------------------------------------
async function executarPesquisaWebEquipamento() {
    const inputTermo = document.getElementById('inputBuscaWeb');
    const termo = inputTermo.value.trim();
    const btn = document.getElementById('btnPesquisarWeb');
    const painel = document.getElementById('painelResultadosWeb');
    const container = document.getElementById('containerResultadosWeb');

    if (!termo) {
        alert("Por favor, digite o nome ou modelo do equipamento para pesquisar na internet.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Pesquisando...`;
    container.innerHTML = `<p class="text-center my-3 text-muted">Buscando opções reais e especificações técnicas na web para "${termo}"...</p>`;
    painel.classList.remove('d-none');

    try {
        const response = await fetch('/api/maquinas/pesquisar_web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termo: termo })
        });

        const data = await response.json();
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-globe me-1"></i> Pesquisar na Web`;

        if (data.status === 'sucesso' && data.resultados && data.resultados.length > 0) {
            renderizarResultadosPesquisaWeb(data.resultados);
        } else {
            container.innerHTML = `<p class="text-danger text-center my-3">Nenhum equipamento encontrado para "${termo}". Tente refinar a busca.</p>`;
        }
    } catch (error) {
        console.error("Erro na busca de máquinas:", error);
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-globe me-1"></i> Pesquisar na Web`;
        container.innerHTML = `<p class="text-danger text-center my-3">Erro de conexão ao realizar a pesquisa na internet. Verifique sua rota ou servidor.</p>`;
    }
}

function renderizarResultadosPesquisaWeb(resultados) {
    const container = document.getElementById('containerResultadosWeb');
    container.innerHTML = '';

    resultados.forEach((item) => {
        const cardHtml = `
            <div class="card mb-2 border shadow-sm">
                <div class="card-body p-3 d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 font-weight-bold text-primary">${item.titulo || item.marca_modelo}</h6>
                        <p class="mb-1 small text-muted">${item.resumo_tecnico || 'Especificações extraídas da web.'}</p>
                        <span class="badge bg-secondary">Potência: ${item.potencia_kw ? item.potencia_kw + ' kW' : 'A definir'}</span>
                        <span class="badge bg-success me-2">Preço Est.: ${item.preco_estimado ? formatarMoeda(item.preco_estimado) : 'Sob Consulta'}</span>
                        ${item.fonte_url ? `<a href="${item.fonte_url}" target="_blank" class="small text-info">[Fonte Externa]</a>` : ''}
                    </div>
                    <button type="button" class="btn btn-sm btn-success px-3" onclick='selecionarMaqPesquisada(${JSON.stringify(item)})'>
                        ✓ Selecionar
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function selecionarMaqPesquisada(maquina) {
    // Auto-preenche os campos do formulário com as especificações encontradas
    if (document.getElementById('nomeAtivo')) {
        document.getElementById('nomeAtivo').value = maquina.titulo || maquina.marca_modelo || '';
    }
    if (document.getElementById('potenciaKW') && maquina.potencia_kw) {
        document.getElementById('potenciaKW').value = maquina.potencia_kw;
        document.getElementById('consumoEletrico').value = maquina.potencia_kw;
    }
    if (document.getElementById('precoCompra') && maquina.preco_estimado) {
        document.getElementById('precoCompra').value = maquina.preco_estimado;
    }

    // Atualiza os cálculos de depreciação e custo minuto
    calcularCustoMinutoMaquina();
    fecharPainelPesquisaWeb();
}

function fecharPainelPesquisaWeb() {
    document.getElementById('painelResultadosWeb').classList.add('d-none');
}

// ----------------------------------------------------------------------------
// 3. CÁLCULO DE CUSTO MINUTO E DEPRECIAÇÃO
// ----------------------------------------------------------------------------
function calcularCustoMinutoMaquina() {
    const preco = parseFloat(document.getElementById('precoCompra').value) || 0;
    const potencia = parseFloat(document.getElementById('potenciaKW').value) || 0;
    const jornadaStr = document.getElementById('jornadaTrabalho').value;

    // Definição de horas mensais conforme jornada
    let horasMes = 176; // 44h semanais padrão
    if (jornadaStr === '88h') horasMes = 352;
    if (jornadaStr === '132h') horasMes = 528;

    const minutosMes = horasMes * 60;

    // Depreciação linear estimada em 10 anos (120 meses)
    const depreciacaoMes = preco / 120;
    document.getElementById('depreciacaoMes').value = depreciacaoMes.toFixed(2);

    // Custo minuto base (Depreciação/minuto + Custo de Energia estimado R$ 0,80/kWh)
    const custoEnergiaMinuto = (potencia * 0.80) / 60;
    const custoDepreciacaoMinuto = depreciacaoMes / minutosMes;
    const custoMinutoTotal = custoEnergiaMinuto + custoDepreciacaoMinuto;

    document.getElementById('custoMinutoMaquina').value = `R$ ${custoMinutoTotal.toFixed(4)}`;
}

// ----------------------------------------------------------------------------
// 4. CADASTRO E SALVAMENTO DE NOVOS ATIVOS
// ----------------------------------------------------------------------------
function salvarNovoAtivo(event) {
    event.preventDefault();

    const nome = document.getElementById('nomeAtivo').value.trim();
    const preco = parseFloat(document.getElementById('precoCompra').value) || 0;
    const potencia = parseFloat(document.getElementById('potenciaKW').value) || 0;
    const operador = document.getElementById('operadorAlocado').value.trim() || 'Não especificado';
    const custoMinuto = document.getElementById('custoMinutoMaquina').value;
    const imobilizado = document.getElementById('checkAtivoImobilizado').checked;

    if (preco <= 0) {
        alert("O valor da máquina deve ser maior que zero.");
        return;
    }

    // Validação de saldo da quota
    const patrimônioAtual = obterPatrimonioTotal();
    const empresaData = JSON.parse(localStorage.getItem('empresa_ativa')) || { capitalInicial: 10000000, quotaMaquinasPercentual: 30 };
    const quotaTotal = empresaData.capitalInicial * (empresaData.quotaMaquinasPercentual / 100);
    const saldoDisponivel = quotaTotal - patrimônioAtual;

    if (preco > saldoDisponivel) {
        alert(`Operação negada: O valor do ativo (${formatarMoeda(preco)}) excede o saldo disponível na quota de máquinas (${formatarMoeda(saldoDisponivel)}).`);
        return;
    }

    const novoAtivo = {
        id: Date.now(),
        nome: nome,
        preco: preco,
        potencia: potencia,
        operador: operador,
        custoMinuto: custoMinuto,
        imobilizado: imobilizado
    };

    let parqueFabril = JSON.parse(localStorage.getItem('parque_fabril_maquinas')) || [];
    parqueFabril.push(novoAtivo);
    localStorage.setItem('parque_fabril_maquinas', JSON.stringify(parqueFabril));

    // Reseta formulário
    document.getElementById('formCadastroMaquina').reset();
    document.getElementById('custoMinutoMaquina').value = "R$ 0,0000";

    renderizarTabelaParqueFabril();
    atualizarResumoPatrimonial();
}

// ----------------------------------------------------------------------------
// 5. LISTAGEM, EXCLUSÃO E RECOMPOSIÇÃO PATRIMONIAL (REGRA 10)
// ----------------------------------------------------------------------------
function renderizarTabelaParqueFabril() {
    const tbody = document.getElementById('tabelaParqueFabril');
    const parqueFabril = JSON.parse(localStorage.getItem('parque_fabril_maquinas')) || [];

    tbody.innerHTML = '';

    if (parqueFabril.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3 text-muted">
                    Nenhum ativo mecânico cadastrado no parque fabril.
                </td>
            </tr>
        `;
        return;
    }

    parqueFabril.forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${item.nome}</strong><br>
                <span class="badge ${item.imobilizado ? 'bg-primary' : 'bg-secondary'}">
                    ${item.imobilizado ? 'ATIVO PATRIMONIAL' : 'DESPESA OPERACIONAL'}
                </span>
                <small class="text-muted ms-2">Preço: ${formatarMoeda(item.preco)}</small>
            </td>
            <td>${item.potencia ? item.potencia.toFixed(2) + ' kW' : '0,00 kW'}</td>
            <td>${item.operador}</td>
            <td class="font-weight-bold text-primary">${item.custoMinuto}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-danger" onclick="excluirAtivo(${item.id})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function excluirAtivo(id) {
    if (!confirm("Tem certeza que deseja excluir esta máquina do parque fabril? O valor investido será estornado do Patrimônio e o Saldo da Quota recomposto.")) {
        return;
    }

    let parqueFabril = JSON.parse(localStorage.getItem('parque_fabril_maquinas')) || [];
    parqueFabril = parqueFabril.filter(item => item.id !== id);
    localStorage.setItem('parque_fabril_maquinas', JSON.stringify(parqueFabril));

    renderizarTabelaParqueFabril();
    atualizarResumoPatrimonial();
}

function obterPatrimonioTotal() {
    const parqueFabril = JSON.parse(localStorage.getItem('parque_fabril_maquinas')) || [];
    return parqueFabril.reduce((acc, item) => item.imobilizado ? acc + item.preco : acc, 0);
}

function atualizarResumoPatrimonial() {
    const empresaData = JSON.parse(localStorage.getItem('empresa_ativa')) || { capitalInicial: 10000000, quotaMaquinasPercentual: 30 };
    const quotaTotal = empresaData.capitalInicial * (empresaData.quotaMaquinasPercentual / 100);
    const patrimonioAtual = obterPatrimonioTotal();
    const saldoDisponivel = quotaTotal - patrimonioAtual;
    const percentualConsumido = quotaTotal > 0 ? (patrimonioAtual / quotaTotal) * 100 : 0;

    document.getElementById('kpiPatrimonioAtual').innerText = formatarMoeda(patrimonioAtual);
    document.getElementById('kpiSaldoAquisição').innerText = formatarMoeda(saldoDisponivel);
    document.getElementById('kpiConsumoQuota').innerText = `${percentualConsumido.toFixed(1)}% da quota consumida`;
}

// ----------------------------------------------------------------------------
// 6. UTILITÁRIOS
// ----------------------------------------------------------------------------
function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
