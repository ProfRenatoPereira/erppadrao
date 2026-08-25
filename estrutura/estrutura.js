/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E CALCULO MATRICIAL INDEPENDENTE
   PARTE 1 DE 4: INICIALIZAÇÃO DE VARIÁVEIS E SIMULADOR INTEGRADO SUPABASE
   ========================================================================== */

const BANCO_SUPABASE_MOCK = {
    nomeGrupo: "METALÚRGICA ALFA",
    capitalTotalNominal: 5000000.00,
    limitePercentualSetor: 0.40, // Max 40%
    orcamentoInicialEngenharia: 2000000.00,
    
    // Simulação progressiva de estados paralelos (Módulo 07 Máquinas Ativas)
    patrimonioSetor07: 1538500.00,
    custoFixoSetor07: 38798.82,
    custoVariavelSetor07: 11657.27,

    contratosImoveis: [
        { id: "IMOB-9821", tipo: "Barracão Industrial", cidade: "Curitiba", bairro: "CIC (Cidade Industrial)", area: 150, condominio: 350.00, aluguel: 4875.00, taxaAnual: 62700.00 }
    ],
    quadroColaboradores: [
        { id: "RH-001", nome: "Colaborador Fictício", cargo: "Ajudante de Cozinha", salario: 1913.66, qtd: 1 },
        { id: "RH-002", nome: "Colaborador Fictício", cargo: "Cozinheira", salario: 2250.00, qtd: 1 },
        { id: "RH-003", nome: "Colaborador Fictício", cargo: "Recepcionista", salario: 1957.06, qtd: 1 },
        { id: "RH-004", nome: "Colaborador Fictício", cargo: "Porteiro", salario: 2170.41, qtd: 1 },
        { id: "RH-005", nome: "Colaborador Fictício", cargo: "Zelador", salario: 2017.32, qtd: 1 }
    ]
};

document.addEventListener("DOMContentLoaded", function() {
    inicializarMódulo02();
    document.getElementById('area_util').addEventListener('input', executarMotorDeCalculoPatrimonial);
    document.getElementById('valor_condominio').addEventListener('input', executarMotorDeCalculoPatrimonial);
});

function inicializarMódulo02() {
    document.getElementById('nome_grupo_display').value = BANCO_SUPABASE_MOCK.nomeGrupo;
    renderizarTabelasEAtivos();
    executarMotorDeCalculoPatrimonial();
}
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E CALCULO MATRICIAL INDEPENDENTE
   PARTE 2 DE 4: RENDERIZAÇÃO DE TABELAS DINÂMICAS E OPERAÇÕES DO SUPABASE
   ========================================================================== */

function renderizarTabelasEAtivos() {
    const corpoImoveis = document.getElementById('tabela_imoveis');
    corpoImoveis.innerHTML = "";
    BANCO_SUPABASE_MOCK.contratosImoveis.forEach(imovel => {
        corpoImoveis.innerHTML += `
            <tr>
                <td><strong>${BANCO_SUPABASE_MOCK.nomeGrupo}</strong></td>
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
    BANCO_SUPABASE_MOCK.quadroColaboradores.forEach(func => {
        let subtotal = func.salario * func.qtd;
        corpoRH.innerHTML += `
            <tr>
                <td>👤 ${func.nome}</td>
                <td>${func.cargo}</td>
                <td>R$ ${func.salario.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td>${func.qtd}</td>
                <td style="color:#1e3a8a; font-weight:600;">R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align:center;"><button class="btn-top" style="color:#dc2626; border-color:#fee2e2;" onclick="removerColaborador('${func.id}')">Demitir</button></td>
            </tr>`;
    });
}

function removerImovel(id) {
    BANCO_SUPABASE_MOCK.contratosImoveis = BANCO_SUPABASE_MOCK.contratosImoveis.filter(i => i.id !== id);
    renderizarTabelasEAtivos();
    executarMotorDeCalculoPatrimonial();
}

function removerColaborador(id) {
    BANCO_SUPABASE_MOCK.quadroColaboradores = BANCO_SUPABASE_MOCK.quadroColaboradores.filter(f => f.id !== id);
    renderizarTabelasEAtivos();
    executarMotorDeCalculoPatrimonial();
}
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E CALCULO MATRICIAL INDEPENDENTE
   PARTE 3 DE 4: ENGENHARIA DE CÁLCULO PATRIMONIAL E PROGRESSÃO INTER-SETORIAL
   ========================================================================== */

function executarMotorDeCalculoPatrimonial() {
    let area = parseFloat(document.getElementById('area_util').value) || 0;
    let condominio = parseFloat(document.getElementById('valor_condominio').value) || 0;
    
    // Algoritmo Paramétrico de Aluguel Regional Base Curitiba/RMC
    let valorAluguelCalculado = area * 32.50; 
    let taxaAnualCalculada = (valorAluguelCalculado * 12) + condominio;

    document.getElementById('valor_aluguel').value = valorAluguelCalculado.toFixed(2);
    document.getElementById('taxa_anual').value = taxaAnualCalculada.toFixed(2);

    // 🧬 EQUAÇÃO DE AMORTIZAÇÃO FISICA E MERCADO
    let valorMercadoEstimado = valorAluguelCalculado / 0.0055;
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {maximumFractionDigits:2})}`;
    document.getElementById('txt_tempo_meses').innerText = `182 meses`;
    document.getElementById('txt_taxa_capitalizacao').innerText = `0.55% a.m.`;

    consolidarMatrizUniversalCustos(valorAluguelCalculado);
}

function consolidarMatrizUniversalCustos(aluguelAtual) {
    // Somatório cumulativo de Ativos do Setor Imobiliário
    let patrimonioImobiliarioSetor = BANCO_SUPABASE_MOCK.contratosImoveis.reduce((acc, curr) => acc + curr.taxaAnual, 0);
    
    // 1. COMPARAÇÃO DO PATRIMÔNIO UNIVERSAL (SETOR VS EMPRESA GLOBAL)
    let patrimonioGeralGlobalEmpresa = patrimonioImobiliarioSetor + BANCO_SUPABASE_MOCK.patrimonioSetor07;
    document.getElementById('kpi-patrimonio-total').innerText = `R$ ${patrimonioImobiliarioSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('kpi-teto-ativos').innerText = `Global: R$ ${patrimonioGeralGlobalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    // Régua de Limites do Supabase baseada no Teto de R$ 2.000.000,00 (40% do Capital)
    let tetoMaximoAtivos = BANCO_SUPABASE_MOCK.capitalTotalNominal * BANCO_SUPABASE_MOCK.limitePercentualSetor;
    let percentualConsumoTeto = (patrimonioGeralGlobalEmpresa / tetoMaximoAtivos) * 100;
    
    document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTeto, 100)}%`;
    document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTeto.toFixed(1)}% do teto consumido`;
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E CALCULO MATRICIAL INDEPENDENTE
   PARTE 4 DE 4: CONSOLIDAÇÃO DO CAIXA GLOBAL, CUSTOS FIXOS/VARIÁVEIS E WCAG
   ========================================================================== */

    // Somatório cumulativo de Folha Fictícia do Apoio Predial Ativo
    let totalFolhaApoioFixo = BANCO_SUPABASE_MOCK.quadroColaboradores.reduce((acc, curr) => acc + (curr.salario * curr.qtd), 0);
    let custoFixoTotalDesteSetor = aluguelAtual + totalFolhaApoioFixo;

    // 2. COMPARAÇÃO DE CUSTOS FIXOS REAIS (SETOR VS SOMATÓRIO TOTAL DA EMPRESA)
    let custoFixoGeralEmpresaCompleta = custoFixoTotalDesteSetor + BANCO_SUPABASE_MOCK.custoFixoSetor07;
    
    document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${custoFixoTotalDesteSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${custoFixoGeralEmpresaCompleta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    let proporcaoImpactoFixo = custoFixoGeralEmpresaCompleta > 0 ? (custoFixoTotalDesteSetor / custoFixoGeralEmpresaCompleta) * 100 : 0;
    document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${proporcaoImpactoFixo.toFixed(2)}% do global`;

    // 3. COMPARAÇÃO DE CUSTOS VARIÁVEIS UNIVERSAIS (SETOR VS SOMATÓRIO GLOBAL)
    let custoVariavelDesteSetor = 0.00; // Imobiliário opera puramente em carga fixa industrial
    let custoVariavelGeralEmpresaCompleta = custoVariavelDesteSetor + BANCO_SUPABASE_MOCK.custoVariavelSetor07;

    document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${custoVariavelDesteSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${custoVariavelGeralEmpresaCompleta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

/* ACESSIBILIDADE WCAG CONTROLS */
function alterarFonte(op) {
    let html = document.documentElement;
    let size = parseFloat(window.getComputedStyle(html).fontSize);
    html.style.fontSize = (op === '+' ? size + 1 : size - 1) + 'px';
}
function alternarModoEscuro() { document.body.classList.toggle('dark-mode'); }
function alternarAltoContraste() { document.body.classList.toggle('alto-contraste'); }
