/* ==========================================================================
   TERADMAS ERP v2.6 - GESTÃO PATRIMONIAL E CÁLCULO MATRICIAL (estrutura.js)
   PARTE 1 DE 4: INICIALIZAÇÃO DE VARIÁVEIS E SYNC COM ENDPOINTS PYTHON
   ========================================================================== */

let CONTEXTO_LOCAL_SETOR = {
    nomeGrupo: "METALÚRGICA ALFA",
    capitalTotalNominal: 5000000.00,
    limitePercentualSetor: 0.40,
    orcamentoInicialEngenharia: 2000000.00,
    patrimonioSetor07: 1538500.00,
    custoFixoSetor07: 38798.82,
    custoVariavelSetor07: 11657.27,
    contratosImoveis: [],
    quadroColaboradores: []
};

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('nome_grupo_display').value = CONTEXTO_LOCAL_SETOR.nomeGrupo;
    document.getElementById('area_util').addEventListener('input', executarMotorDeCalculoPatrimonial);
    document.getElementById('valor_condominio').addEventListener('input', executarMotorDeCalculoPatrimonial);
    
    sincronizarComBackendPython();
});

async function sincronizarComBackendPython() {
    try {
        console.log("⚡ Buscando dados consolidados via rotas Python do servidor...");
        const response = await fetch('/api/estrutura/dados');
        if (!response.ok) throw new Error("Erro na comunicação com o servidor.");
        
        const dadosServer = await response.json();
        
        if (dadosServer.contratosImoveis) CONTEXTO_LOCAL_SETOR.contratosImoveis = dadosServer.contratosImoveis;
        if (dadosServer.quadroColaboradores) CONTEXTO_LOCAL_SETOR.quadroColaboradores = dadosServer.quadroColaboradores;
        
        console.log("✅ Dados da nuvem sincronizados no contexto do ERP.");
    } catch (err) {
        console.warn("Utilizando cache estável de contingência do sistema:", err.message);
    }
    renderuzarEAplicarAtualizacao();
}
/* ==========================================================================
   TERADMAS ERP v2.6 - GESTÃO PATRIMONIAL E CÁLCULO MATRICIAL (estrutura.js)
   PARTE 2 DE 4: INJEÇÃO DINÂMICA DE TABELAS DE IMÓVEIS E PESSOAL DE APOIO
   ========================================================================== */

function renderizarTabelasEAtivos() {
    const corpoImoveis = document.getElementById('tabela_imoveis');
    corpoImoveis.innerHTML = "";
    CONTEXTO_LOCAL_SETOR.contratosImoveis.forEach(imovel => {
        corpoImoveis.innerHTML += `
            <tr>
                <td><strong>${CONTEXTO_LOCAL_SETOR.nomeGrupo}</strong></td>
                <td><strong>${imovel.tipo}</strong><br><small style="color:#6b7280;">${imovel.cidade} - ${imovel.bairro}</small></td>
                <td>${imovel.area} m²</td>
                <td style="color:#1e3a8a; font-weight:bold;">R$ ${imovel.aluguel.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center;">
                    <button class="btn-top" style="color:#d97706; background:#fef3c7;" onclick="carregarImovelEdicao('${imovel.id}')">Editar</button>
                    <button class="btn-top" style="color:#dc2626; background:#fee2e2;" onclick="removerImovel('${imovel.id}')">Rescindir</button>
                </td>
            </tr>`;
    });

    const corpoRH = document.getElementById('tabela_colaboradores');
    corpoRH.innerHTML = "";
    CONTEXTO_LOCAL_SETOR.quadroColaboradores.forEach(func => {
        let subtotal = func.salario * func.qtd;
        corpoRH.innerHTML += `
            <tr>
                <td>👤 ${func.nome}</td>
                <td>${func.cargo}</td>
                <td>R$ ${func.salario.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td>${func.qtd}</td>
                <td style="color:#1e3a8a; font-weight:600;">R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center;">
                    <button class="btn-edit-rh" onclick="carregarColaboradorEdicao('${func.id}')">Editar</button>
                    <button class="btn-top" style="color:#dc2626; border-color:#fee2e2;" onclick="removerColaborador('${func.id}')">Demitir</button>
                </td>
            </tr>`;
    });
}

function renderuzarEAplicarAtualizacao() {
    renderizarTabelasEAtivos();
    executarMotorDeCalculoPatrimonial();
}
/* ==========================================================================
   TERADMAS ERP v2.6 - GESTÃO PATRIMONIAL E CÁLCULO MATRICIAL (estrutura.js)
   PARTE 3 DE 4: CONTROLE DE SUBMISSÕES, ROTAS DE EXCLUSÃO E CARREGAMENTO
   ========================================================================== */

async function salvarImovel(event) {
    event.preventDefault();
    const id = document.getElementById('imovel_id').value;
    const novoImovel = {
        id: id || null,
        tipo: document.getElementById('tipo_imovel').value,
        cidade: document.getElementById('cidade').value,
        bairro: document.getElementById('bairro').value,
        area: parseFloat(document.getElementById('area_util').value) || 0,
        condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        taxaAnual: parseFloat(document.getElementById('taxa_anual').value) || 0
    };
    try {
        const response = await fetch('/api/estrutura/imovel/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoImovel)
        });
        if (!response.ok) throw new Error("Falha ao salvar ativo imobiliário.");
        document.getElementById('formImobiliario').reset();
        document.getElementById('imovel_id').value = "";
        document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
        await sincronizarComBackendPython();
    } catch (err) { console.error(err.message); }
}

function carregarImovelEdicao(id) {
    const imovel = CONTEXTO_LOCAL_SETOR.contratosImoveis.find(i => i.id === id);
    if (!imovel) return;
    document.getElementById('imovel_id').value = imovel.id;
    document.getElementById('tipo_imovel').value = imovel.tipo;
    document.getElementById('cidade').value = imovel.cidade;
    document.getElementById('bairro').value = imovel.bairro;
    document.getElementById('area_util').value = imovel.area;
    document.getElementById('valor_condominio').value = imovel.condominio;
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato de Locação";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function adicionarColaborador(event) {
    event.preventDefault();
    const id = document.getElementById('rh_id').value;
    const seletor = document.getElementById('cargo_suporte');
    const cargoText = seletor.options[seletor.selectedIndex].value;
    const salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    const novoFunc = {
        id: id || null,
        nome: document.getElementById('rh_nome').value,
        cargo: cargoText,
        salario: salarioBase,
        qtd: parseInt(document.getElementById('qtd_colaboradores').value) || 1
    };
    try {
        const response = await fetch('/api/estrutura/rh/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoFunc)
        });
        if (!response.ok) throw new Error("Falha ao registrar pessoal indireto.");
        document.getElementById('formContratacaoPredial').reset();
        document.getElementById('rh_id').value = "";
        document.getElementById('btn_contratar').innerText = "👥 Confirmar Registro de Funcionário";
        await sincronizarComBackendPython();
    } catch (err) { console.error(err.message); }
}

function carregarColaboradorEdicao(id) {
    const func = CONTEXTO_LOCAL_SETOR.quadroColaboradores.find(f => f.id === id);
    if (!func) return;
    document.getElementById('rh_id').value = func.id;
    document.getElementById('rh_nome').value = func.nome;
    document.getElementById('cargo_suporte').value = func.cargo;
    document.getElementById('qtd_colaboradores').value = func.qtd;
    document.getElementById('btn_contratar').innerText = "🔄 Atualizar Cadastro de Funcionário";
    calcularPreviaSalario();
}

async function removerImovel(id) {
    try {
        const response = await fetch(`/api/estrutura/imovel/deletar/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Erro na deleção do ativo.");
        await sincronizarComBackendPython();
    } catch (err) { console.error(err.message); }
}

async function removerColaborador(id) {
    try {
        const response = await fetch(`/api/estrutura/rh/deletar/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Erro na deleção do registro.");
        await sincronizarComBackendPython();
    } catch (err) { console.error(err.message); }
}
/* ==========================================================================
   TERADMAS ERP v2.6 - GESTÃO PATRIMONIAL E CÁLCULO MATRICIAL (estrutura.js)
   PARTE 4 DE 4: CÁLCULOS MATRICIAIS CRUZADOS (SETOR VS GLOBAL DA EMPRESA)
   ========================================================================== */

function executarMotorDeCalculoPatrimonial() {
    let area = parseFloat(document.getElementById('area_util').value) || 0;
    let condominio = parseFloat(document.getElementById('valor_condominio').value) || 0;
    let valorAluguelCalculado = area * 32.50; 
    let taxaAnualCalculada = (valorAluguelCalculado * 12) + condominio;

    document.getElementById('valor_aluguel').value = valorAluguelCalculado.toFixed(2);
    document.getElementById('taxa_anual').value = taxaAnualCalculada.toFixed(2);

    let valorMercadoEstimado = valorAluguelCalculado / 0.0055;
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {maximumFractionDigits:2})}`;
    document.getElementById('txt_tempo_meses').innerText = `182 meses`;
    document.getElementById('txt_taxa_capitalizacao').innerText = `0.55% a.m.`;

    // 📊 REGRAS DE MATRIZ CUMULATIVA CRUZADA REAL (VALORES INDEPENDENTES OU ZERADOS)
    let patrimonioImobiliarioSetor = CONTEXTO_LOCAL_SETOR.contratosImoveis.reduce((acc, curr) => acc + curr.taxaAnual, 0);
    let patrimonioGeralGlobalEmpresa = patrimonioImobiliarioSetor + CONTEXTO_LOCAL_SETOR.patrimonioSetor07;
    
    document.getElementById('kpi-patrimonio-total').innerText = `R$ ${patrimonioImobiliarioSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('kpi-teto-ativos').innerText = `Global: R$ ${patrimonioGeralGlobalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    let tetoMaximoAtivos = CONTEXTO_LOCAL_SETOR.capitalTotalNominal * CONTEXTO_LOCAL_SETOR.limitePercentualSetor;
    let percentualConsumoTeto = (patrimonioGeralGlobalEmpresa / tetoMaximoAtivos) * 100;
    document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTeto, 100)}%`;
    document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTeto.toFixed(1)}% do teto consumido`;

    let totalFolhaApoioFixo = CONTEXTO_LOCAL_SETOR.quadroColaboradores.reduce((acc, curr) => acc + (curr.salario * curr.qtd), 0);
    let custoFixoTotalDesteSetor = valorAluguelCalculado + totalFolhaApoioFixo;
    let custoFixoGeralEmpresaCompleta = custoFixoTotalDesteSetor + CONTEXTO_LOCAL_SETOR.custoFixoSetor07;
    
    document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${custoFixoTotalDesteSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${custoFixoGeralEmpresaCompleta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    let proporcaoImpactoFixo = custoFixoGeralEmpresaCompleta > 0 ? (custoFixoTotalDesteSetor / custoFixoGeralEmpresaCompleta) * 100 : 0;
    document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${proporcaoImpactoFixo.toFixed(2)}% do global`;

    let custoVariavelDesteSetor = 0.00;
    let custoVariavelGeralEmpresaCompleta = custoVariavelDesteSetor + CONTEXTO_LOCAL_SETOR.custoVariavelSetor07;
    document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${custoVariavelDesteSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${custoVariavelGeralEmpresaCompleta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    if(seletor.selectedIndex === 0 || seletor.selectedIndex === -1) return;
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function alterarFonte(op) {
    let html = document.documentElement;
    let size = parseFloat(window.getComputedStyle(html).fontSize);
    html.style.fontSize = (op === '+' ? size + 1 : size - 1) + 'px';
}
function alternarModoEscuro() { document.body.classList.toggle('dark-mode'); }
function alternarAltoContraste() { document.body.classList.toggle('alto-contraste'); }
