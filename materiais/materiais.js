/* erppadrao - materiais/materiais.js - PARTE 1 DE 5 */

let escalaFonteGlobal = 16;
let sintetizadorLeitor = window.speechSynthesis;
let flagLeitorAtivo = false;

// ============================================================================
// 1. SUBSISTEMA DE ACESSIBILIDADE DE SESSÃO
// ============================================================================
window.mudarFonte = function(direcao) {
    escalaFonteGlobal += (direcao * 2);
    if (escalaFonteGlobal < 12) escalaFonteGlobal = 12;
    if (escalaFonteGlobal > 26) escalaFonteGlobal = 26;
    
    document.documentElement.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
    document.body.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
    
    const seletores = document.querySelectorAll('.btn-top, .btn-submit, .input-form, .select-form, td, th, label, p');
    seletores.forEach(el => {
        el.style.setProperty('font-size', (escalaFonteGlobal - 4) + 'px', 'important');
    });
};

window.alternarAltoContraste = function() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
};

window.alternarModoEscuro = function() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const b = document.getElementById('btn_tema');
    if (b) b.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
};

window.alternarLeitorAudio = function() {
    flagLeitorAtivo = !flagLeitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (!btn) return;
    
    if (flagLeitorAtivo) {
        btn.innerText = "🛑 Parar";
        btn.style.backgroundColor = "#dc2626";
        sintetizadorLeitor.cancel();
        
        let textoParaLer = "Catálogo e Engenharia de Materiais Produtivos. ";
        const faixas = document.querySelectorAll('.painel-orcamentario-horizontal > div');
        faixas.forEach((faixa, index) => {
            textoParaLer += `Linha horizontal ${index + 1}: ${faixa.innerText}. `;
        });
        
        let utterance = new SpeechSynthesisUtterance(textoParaLer);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        utterance.onend = () => { if (flagLeitorAtivo) window.alternarLeitorAudio(); };
        sintetizadorLeitor.speak(utterance);
    } else {
        btn.innerText = "🔊 Leitor";
        btn.style.backgroundColor = "#0284c7";
        sintetizadorLeitor.cancel();
    }
};
/* erppadrao - materiais/materiais.js - PARTE 2 DE 5 */

// ============================================================================
// 2. DICIONÁRIO DE ENGENHARIA METALÚRGICA E MATERIAIS MÁSTER
// ============================================================================
const CATALOGO_METALURGICO = {
    aco_1020: { sku: "MAT-STEEL-1020-BR", nome: "Barra de Aço SAE 1020", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Carbono para Cementação - Fornecedor: Gerdau Comercial S/A" },
    aco_1030: { sku: "MAT-STEEL-1030-BR", nome: "Barra de Aço SAE 1030", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono de Alta Forjabilidade - Fornecedor: Gerdau Comercial S/A" },
    aco_1045: { sku: "MAT-STEEL-1045-BR", nome: "Eixo de Aço SAE 1045", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono Beneficiável Estrutural - Fornecedor: Gerdau Comercial S/A" },
    aco_1070: { sku: "MAT-STEEL-1070-BR", nome: "Tarugo de Aço SAE 1070", tipo: "barra", densidade: 7.82, unidade: "kg", especificacao: "Alto Carbono para Molas e Facas - Fornecedor: Gerdau Comercial S/A" },
    aco_4320: { sku: "MAT-ALLOY-4320-BR", nome: "Barra de Aço Liga SAE 4320", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Liga Cr-Ni-Mo de Alta Tenacidade - Fornecedor: Gerdau Comercial S/A" },
    aco_4340: { sku: "MAT-ALLOY-4340-BR", nome: "Eixo de Aço Liga SAE 4340", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Alta Temperabilidade / Elementos de Transmissão - Fornecedor: Gerdau Comercial S/A" },
    aco_8620: { sku: "MAT-ALLOY-8620-BR", nome: "Barra de Aço Liga SAE 8620", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Liga Destinado a Engrenagens e Elementos Móveis - Fornecedor: Gerdau Comercial S/A" },
    aco_8640: { sku: "MAT-ALLOY-8640-BR", nome: "Tarugo de Aço Liga SAE 8640", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Fixadores e Parafusos de Alta Resistência Mecânica - Fornecedor: Gerdau Comercial S/A" },
    aco_inox_304: { sku: "MAT-INOX-304-CH", nome: "Chapa/Tarugo Inox AISI 304", tipo: "barra", densidade: 8.00, unidade: "kg", especificacao: "Aço Inoxidável Austenítico Anti-Corrosivo - Fornecedor: Gerdau Comercial S/A" },
    tubo_1020: { sku: "MAT-PIPE-1020-ST", nome: "Tubo Mecânico SAE 1020", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Industrial Sem Costura - Fornecedor: Distribuidora Central Ltda" },
    tubo_1045: { sku: "MAT-PIPE-1045-HD", nome: "Tubo Hidráulico SAE 1045", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo trefilado para camisas de cilindro - Fornecedor: Distribuidora Central Ltda" },
    tubo_st52: { sku: "MAT-PIPE-ST52-DIN", nome: "Tubo de Alta Pressão ST52 DIN2391", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Grau E355 Brunido Alta Performance - Fornecedor: Distribuidora Central Ltda" },
    gas_argon: { sku: "MAT-GAS-ARGON-01", nome: "Gás Argônio Puro 99.9%", tipo: "gas", densidade: 1.0, unidade: "m³", especificacao: "Atmosfera Protetiva de Soldagem/Fusão - Fornecedor: White Martins S/A" },
    gas_nitrogenio: { sku: "MAT-GAS-NITRO-02", nome: "Gás Nitrogênio Especial", tipo: "gas", densidade: 1.0, unidade: "m³", especificacao: "Tratamento Térmico e Corte Térmico Avançado - Fornecedor: White Martins S/A" }
};

const OPCOES_DIAMETROS = [
    { valor: "0.0127", texto: "1/2\" (12,70 mm)" },
    { valor: "0.01905", texto: "3/4\" (19,05 mm)" },
    { valor: "0.0254", texto: "1\" (25,40 mm)" },
    { valor: "0.0381", texto: "1.1/2\" (38,10 mm)" },
    { valor: "0.0508", texto: "2\" (50,80 mm)" },
    { valor: "0.0762", texto: "3\" (76,20 mm)" },
    { valor: "0.1016", texto: "4\" (101,60 mm)" }
];

const OPCOES_ESPESSURAS = [
    { valor: "0.0020", texto: "2,00 mm" },
    { valor: "0.00318", texto: "1/8\" (3,18 mm)" },
    { valor: "0.00476", texto: "3/16\" (4,76 mm)" },
    { valor: "0.00635", texto: "1/4\" (6,35 mm)" },
    { valor: "0.00952", texto: "3/8\" (9,52 mm)" }
];
/* erppadrao - materiais/materiais.js - PARTE 3 DE 5 */

window.carregarPreDefinido = function() {
    const chave = document.getElementById('seletor_modelo').value;
    const material = CATALOGO_METALURGICO[chave];
    
    const dSelect = document.getElementById('dim_diametro');
    const eSelect = document.getElementById('dim_espessura');
    const bEspessura = document.getElementById('bloco_espessura');
    const containerGeom = document.getElementById('container_geometrico');

    if (dSelect) dSelect.innerHTML = "";
    if (eSelect) eSelect.innerHTML = "";

    if (!material) {
        if (containerGeom) containerGeom.style.display = "none";
        return;
    }

    if (containerGeom) containerGeom.style.display = "flex";
    if (document.getElementById('codigo_sku')) document.getElementById('codigo_sku').value = material.sku;
    if (document.getElementById('nome_material')) document.getElementById('nome_material').value = material.nome;
    if (document.getElementById('unidade_medida')) document.getElementById('unidade_medida').value = material.unidade;
    if (document.getElementById('especificacao_tecnica')) document.getElementById('especificacao_tecnica').value = material.especificacao;
    
    if (document.getElementById('fornecedor_padrao')) {
        document.getElementById('fornecedor_padrao').value = material.sku.includes("GAS") ? "White Martins Gases Industriais" : material.sku.includes("PIPE") ? "Distribuidora Central de Suprimentos" : "Gerdau Comercial Metais S/A";
    }

    if (material.tipo === "gas") {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "N/A";
        if (document.getElementById('lbl_unidade_espessura')) document.getElementById('lbl_unidade_espessura').innerText = "N/A";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = "m³ Volumétrico";
        if (bEspessura) bEspessura.style.display = "none";
        if (dSelect) dSelect.disabled = true;
    } else {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "Pol / mm";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = "Metros (m)";
        if (dSelect) dSelect.disabled = false;
        
        if (dSelect) {
            OPCOES_DIAMETROS.forEach(o => dSelect.add(new Option(o.texto, o.valor)));
        }

        if (material.tipo === "tubo") {
            if (bEspessura) bEspessura.style.display = "block";
            if (document.getElementById('lbl_unidade_espessura')) document.getElementById('lbl_unidade_espessura').innerText = "mm";
            if (eSelect) {
                OPCOES_ESPESSURAS.forEach(o => eSelect.add(new Option(o.texto, o.valor)));
            }
        } else {
            if (bEspessura) bEspessura.style.display = "none";
        }
    }

    if (document.getElementById('preco_unitario')) document.getElementById('preco_unitario').value = material.tipo === "gas" ? "85.00" : material.tipo === "tubo" ? "32.40" : "18.50";
    if (document.getElementById('coeficiente_refugo')) document.getElementById('coeficiente_refugo').value = "5.0";
    if (document.getElementById('lead_time_entrega')) document.getElementById('lead_time_entrega').value = "4";
    if (document.getElementById('estoque_seguranca')) document.getElementById('estoque_seguranca').value = "10";

    window.calcularCustoOperacionalMaterial();
};

window.calcularCustoOperacionalMaterial = function() {
    const chave = document.getElementById('seletor_modelo').value;
    const material = CATALOGO_METALURGICO[chave];
    if (!material) return;

    const pUn = parseFloat(document.getElementById('preco_unitario')?.value) || 0;
    const ref = parseFloat(document.getElementById('coeficiente_refugo')?.value) || 0;
    const estSeg = parseFloat(document.getElementById('estoque_seguranca')?.value) || 0;
    const compInput = parseFloat(document.getElementById('dim_comprimento')?.value) || 0;

    let grandezaFisicaTotal = 0; 

    if (material.tipo === "gas") {
        grandezaFisicaTotal = compInput * estSeg;
    } else {
        const diametro = parseFloat(document.getElementById('dim_diametro')?.value) || 0;
        const raioExt = diametro / 2;
        let volumeMetrosCubicos = 0;

        if (material.tipo === "barra") {
            volumeMetrosCubicos = Math.PI * Math.pow(raioExt, 2) * compInput;
        } else if (material.tipo === "tubo") {
            const espessura = parseFloat(document.getElementById('dim_espessura')?.value) || 0;
            const raioInt = raioExt - espessura;
            if (raioInt > 0) {
                volumeMetrosCubicos = Math.PI * (Math.pow(raioExt, 2) - Math.pow(raioInt, 2)) * compInput;
            }
        }
        
        const massaPorUnidade = volumeMetrosCubicos * (material.densidade * 1000);
        grandezaFisicaTotal = massaPorUnidade * estSeg;
    }

    const custoCalculadoBase = pUn * (1 + (ref / 100));
    const custoTotalIntegradoOp = custoCalculadoBase * grandezaFisicaTotal;

    const inp = document.getElementById('custo_total_integrado');
    if (inp) inp.value = custoTotalIntegradoOp.toFixed(2);
};

window.vincularEventosInputs = function() {
    const ids = ['preco_unitario', 'coeficiente_refugo', 'estoque_seguranca', 'dim_comprimento', 'dim_diametro', 'dim_espessura'];
    ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.oninput = window.calcularCustoOperacionalMaterial;
    });
};
/* erppadrao - materiais/materiais.js - PARTE 4 DE 5 */

// ============================================================================
// 4. MOTOR CONTÁBIL DA MATRIZ MASTER HORIZONTAL (PROTEÇÃO DUPLA DE IDs)
// ============================================================================
window.carregarDadosIniciais = async function() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=materiais');
        if (!resMetricas.ok) throw new Error("Erro de ponte financeira.");
        const m = await resMetricas.json();
        
        const resMat = await fetch('/api/materiais/listar');
        const materiais = await resMat.json();
        
        const resAtivos = await fetch('/api/maquinas/listar');
        let ativosMaquinas = [];
        if (resAtivos.ok) ativosMaquinas = await resAtivos.json();

        let patrimonioMaquinasAcumulado = 0;
        let custoFixoMaquinasAcumulado = 0;
        let custoVariavelMaquinasAcumulado = 0;

        if (ativosMaquinas && ativosMaquinas.length > 0) {
            ativosMaquinas.forEach(x => {
                patrimonioMaquinasAcumulado += parseFloat(x.preco_compra || 0);
                const hs = parseFloat(x.jornada_semanal) || 44;
                const t = parseFloat(x.turnos_trabalho) || 1;
                const minMes = hs * 4.33 * 60 * t;
                custoFixoMaquinasAcumulado += ((parseFloat(x.custo_minuto_operador) || 0) * minMes) + (parseFloat(x.depreciacao_mensal) || 0);
                custoVariavelMaquinasAcumulado += (((parseFloat(x.consumo_eletrico || 0) * 0.75) / 60) + ((parseFloat(x.consumo_agua || 0) * 6.50) / 60) + ((parseFloat(x.consumo_gases || 0) * 4.80) / 60)) * minMes;
            });
        }

        if (custoFixoMaquinasAcumulado === 0) custoFixoMaquinasAcumulado = 34432.51;
        if (custoVariavelMaquinasAcumulado === 0) custoVariavelMaquinasAcumulado = 10593.38;
        if (patrimonioMaquinasAcumulado === 0) patrimonioMaquinasAcumulado = 1453500.00;

        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 2000000.00;
        
        let valorTotalEstoqueMateriais = 0;
        if (materiais && materiais.length > 0) {
            materiais.forEach(mat => {
                valorTotalEstoqueMateriais += (parseFloat(mat.preco_unitario || 0) * parseFloat(mat.estoque_seguranca || 0));
            });
        }

        const valorTotalInventarioGeral = patrimonioMaquinasAcumulado + valorTotalEstoqueMateriais;
        const saldoVerbaSustentada = disponivelParaSetor - valorTotalEstoqueMateriais;
        let pctTetoConsumidoInsumos = (valorTotalInventarioGeral / disponivelParaSetor) * 100;

        const custoFixoGeralAluguel = 21350.00; 
        const custoFixoAlmoxarifadoSetor = 12450.00; 
        
        const totalCustosFixosPlanta = custoFixoGeralAluguel + custoFixoMaquinasAcumulado + custoFixoAlmoxarifadoSetor;
        const totalCustosVariveisPlanta = custoVariavelMaquinasAcumulado;
        const totalGeralCustosMensais = totalCustosFixosPlanta + totalCustosVariveisPlanta;

        const denCusto = totalGeralCustosMensais || 1;
        const denFixo = totalCustosFixosPlanta || 1;
        const denVar = totalCustosVariveisPlanta || 1;

        const pFixG_Tot = (totalCustosFixosPlanta / denCusto) * 100;
        const pFixG_Nat = (totalCustosFixosPlanta / denFixo) * 100;
        const pFixS_Tot = (custoFixoAlmoxarifadoSetor / denCusto) * 100;
        const pFixS_Nat = (custoFixoAlmoxarifadoSetor / denFixo) * 100;

        const pVarG_Tot = (totalCustosVariveisPlanta / denCusto) * 100;
        const pVarG_Nat = (totalCustosVariveisPlanta / denVar) * 100;
        const pVarS_Tot = (custoVariavelMaquinasAcumulado / denCusto) * 100;
        const pVarS_Nat = (custoVariavelMaquinasAcumulado / denVar) * 100;

        const pctDisponivel = (disponivelParaSetor / capitalTotalEmpresa) * 100;
        const pctOrcamentoIni = (disponivelParaSetor / capitalTotalEmpresa) * 100;
        const pctSaldoSuprimentos = (saldoVerbaSustentada / capitalTotalEmpresa) * 100;
        const pctInventarioDoCap = (valorTotalInventarioGeral / capitalTotalEmpresa) * 100;

        window.atualizarElementosUI(capitalTotalEmpresa, disponivelParaSetor, saldoVerbaSustentada, valorTotalInventarioGeral, totalCustosFixosPlanta, custoFixoAlmoxarifadoSetor, totalCustosVariveisPlanta, custoVariavelMaquinasAcumulado, pctDisponivel, pctOrcamentoIni, pctSaldoSuprimentos, pctInventarioDoCap, pFixG_Tot, pFixG_Nat, pFixS_Tot, pFixS_Nat, pVarG_Tot, pVarG_Nat, pVarS_Tot, pVarS_Nat, pctTetoConsumidoInsumos);
        window.renderizarTabelaMateriais(materiais);
        window.vincularEventosInputs();
        window.corrigirRodapeOficial();
    } catch (e) { console.error(e); }
};

window.atualizarElementosUI = function(capitalTotalEmpresa, disponivelParaSetor, saldoVerbaSustentada, valorTotalInventarioGeral, totalCustosFixosPlanta, custoFixoAlmoxarifadoSetor, totalCustosVariveisPlanta, custoVariavelMaquinasAcumulado, pctDisponivel, pctOrcamentoIni, pctSaldoSuprimentos, pctInventarioDoCap, pFixG_Tot, pFixG_Nat, pFixS_Tot, pFixS_Nat, pVarG_Tot, pVarG_Nat, pVarS_Tot, pVarS_Nat, pctTetoConsumidoInsumos) {
    const definirTexto = (id, texto) => { const el = document.getElementById(id); if (el) el.innerText = texto; };
    
    definirTexto('top_capital_total', `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    definirTexto('top_disponivel_setor', `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    definirTexto('top_orcamento_inicial', `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    
    const vReais = document.getElementById('top_verba_reais');
    if (vReais) {
        vReais.innerText = `R$ ${saldoVerbaSustentada.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        vReais.style.color = (saldoVerbaSustentada < 0) ? "#dc2626" : "#166534";
    }

    definirTexto('top_patrimonio_maquinas', `R$ ${valorTotalInventarioGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    definirTexto('top_custo_fixo', `R$ ${totalCustosFixosPlanta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);
    definirTexto('top_custo_fixo_setor', `R$ ${custoFixoAlmoxarifadoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);
    definirTexto('top_custo_variavel', `R$ ${totalCustosVariveisPlanta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);
    definirTexto('top_custo_variavel_setor', `R$ ${custoVariavelMaquinasAcumulado.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);

    definirTexto('pct_disponivel_setor', `➔ ${pctDisponivel.toFixed(2)}% do Cap.`);
    definirTexto('pct_orcamento_inicial', `➔ ${pctOrcamentoIni.toFixed(2)}% do Cap.`);
    
    definirTexto('pct_saldo_suprimentos', `➔ ${pctSaldoSuprimentos.toFixed(2)}% do Cap.`);
    definirTexto('pct_saldo_engenharia', `➔ ${pctSaldoSuprimentos.toFixed(2)}% do Cap.`);
    definirTexto('pct_patrimonio_maquinas', `➔ ${pctInventarioDoCap.toFixed(2)}% do Cap.`);

    definirTexto('pct_custo_fixo_geral', `➔ Custos Totais: ${pFixG_Tot.toFixed(1)}% | Custos Fixos: ${pFixG_Nat.toFixed(1)}%`);
    definirTexto('pct_custo_fixo_setor', `➔ Custos Totais: ${pFixS_Tot.toFixed(1)}% | Proporção Fixo: ${pFixS_Nat.toFixed(1)}%`);
    definirTexto('pct_custo_variavel_geral', `➔ Custos Totais: ${pVarG_Tot.toFixed(1)}% | Custos Variáveis: ${pVarG_Nat.toFixed(1)}%`);
    definirTexto('pct_custo_variavel_setor', `➔ Custos Totais: ${pVarS_Tot.toFixed(1)}% | Custos Variáveis: ${pVarS_Nat.toFixed(1)}%`);

    definirTexto('txt_valores_limite', `R$ ${valorTotalInventarioGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})} / R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    definirTexto('txt_porcentagem_budget', `${pctTetoConsumidoInsumos.toFixed(1)}% do teto consumido`);
    
    const bar = document.getElementById('barra_progresso_budget');
    if (bar) bar.style.width = `${Math.min(pctTetoConsumidoInsumos, 100)}%`;

    const card = document.getElementById('card_budget_limite');
    if (card && bar) {
        if (pctTetoConsumidoInsumos > 100) {
            card.style.backgroundColor = "#fef2f2"; card.style.borderColor = "#fca5a5"; bar.style.backgroundColor = "#ef4444";
        } else {
            card.style.backgroundColor = "#ffffff"; card.style.borderColor = "#cbd5e1"; bar.style.backgroundColor = "#3b82f6";
        }
    }
};
/* erppadrao - materiais/materiais.js - PARTE 5 DE 5 (CORRIGIDA E BLINDADA) */

// ============================================================================
// 5. CAMADA DE PERSISTÊNCIA E OPERAÇÕES CRUD (SUPABASE)
// ============================================================================
window.renderizarTabelaMateriais = function(materiais) {
    const tbody = document.getElementById('tabela_materiais');
    if (!tbody) return;
    if (!materiais || materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum material homologado no Supabase.</td></tr>`;
        return;
    }
    tbody.innerHTML = materiais.map(x => `
        <tr>
            <td><strong>${x.nome_material}</strong><br><small style="color: #64748b;">SKU: ${x.codigo_sku || 'N/A'}</small></td>
            <td>Controle: <strong>${x.unidade_medida}</strong> | Refugo processual: ${x.coeficiente_refugo}%<br><span style="font-size:10px; color:#2563eb;">${x.especificacao_tecnica || ''}</span></td>
            <td><strong>${x.fornecedor_padrao}</strong><br><small>L.T: ${x.lead_time_entrega || 0} dias</small></td>
            <td style="font-family: monospace; font-weight: bold; color: #166534;">R$ ${(x.preco_unitario || 0).toFixed(2)} / ${x.unidade_medida}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" onclick="window.editarMaterial(${x.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7;">Editar</button>
                <button type="button" onclick="window.deletarMaterial(${x.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Deletar</button>
            </td>
        </tr>
    `).join('');
    window.mudarFonte(0);
};

window.salvarMaterial = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    window.calcularCustoOperacionalMaterial();
    const chaveModelo = document.getElementById('seletor_modelo').value;
    const materialBase = CATALOGO_METALURGICO[chaveModelo];
    let categoriaResolvida = "Outros";
    if (materialBase) {
        if (materialBase.tipo === "barra") categoriaResolvida = "Aços Sólidos";
        if (materialBase.tipo === "tubo") categoriaResolvida = "Tubos Mecânicos";
        if (materialBase.tipo === "gas") categoriaResolvida = "Gases Industriais";
    }
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        codigo_sku: document.getElementById('codigo_sku').value,
        categoria: categoriaResolvida,
        unidade_medida: document.getElementById('unidade_medida').value,
        preco_unitario: parseFloat(document.getElementById('preco_unitario').value) || 0,
        coeficiente_refugo: parseFloat(document.getElementById('coeficiente_refugo').value) || 0,
        lead_time_entrega: parseInt(document.getElementById('lead_time_entrega').value) || 0,
        estoque_seguranca: parseFloat(document.getElementById('estoque_seguranca').value) || 0,
        fornecedor_padrao: document.getElementById('fornecedor_padrao').value,
        especificacao_tecnica: document.getElementById('especificacao_tecnica').value,
        dim_diametro: document.getElementById('dim_diametro')?.value || '0',
        dim_espessura: document.getElementById('dim_espessura')?.value || '0',
        dim_comprimento: parseFloat(document.getElementById('dim_comprimento')?.value) || 0,
        custo_total_integrado: parseFloat(document.getElementById('custo_total_integrado')?.value) || 0
    };
    try {
        const res = await fetch('/api/materiais/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) { window.limparFormularioMaterial(); window.carregarDadosIniciais(); alert("🎯 Material cadastrado!"); }
        else { alert("❌ Erro na validação central."); }
    } catch (err) { alert("❌ Servidor offline."); }
};

window.editarMaterial = async function(id) {
    try {
        const res = await fetch(`/api/materiais/buscar/${id}`);
        const m = await res.json();
        document.getElementById('registro_id').value = m.id;
        document.getElementById('codigo_sku').value = m.codigo_sku || m.categoria || '';
        document.getElementById('nome_material').value = m.nome_material;
        document.getElementById('unidade_medida').value = m.unidade_medida || 'kg';
        document.getElementById('preco_unitario').value = m.preco_unitario;
        document.getElementById('coeficiente_refugo').value = m.coeficiente_refugo;
        document.getElementById('lead_time_entrega').value = m.lead_time_entrega;
        document.getElementById('estoque_seguranca').value = m.estoque_seguranca;
        document.getElementById('fornecedor_padrao').value = m.fornecedor_padrao || '';
        document.getElementById('especificacao_tecnica').value = m.especificacao_tecnica || '';
        if (document.getElementById('dim_comprimento') && m.dim_comprimento) document.getElementById('dim_comprimento').value = m.dim_comprimento;
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Homologação";
        if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'inline-block';
        window.calcularCustoOperacionalMaterial();
    } catch (e) { alert("❌ Falha de barramento."); }
};

window.deletarMaterial = async function(id) {
    if(!confirm('Deseja remover este insumo do catálogo de engenharia?')) return;
    try {
        const res = await fetch(`/api/materiais/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) { window.carregarDadosIniciais(); alert("🎯 Material removido."); }
        else { alert("❌ Falha interna."); }
    } catch (e) { alert("❌ Erro operacional."); }
};

window.limparFormularioMaterial = function() {
    const form = document.getElementById('formMaterial');
    if (form) form.reset();
    if (document.getElementById('registro_id')) document.getElementById('registro_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Homologar Material no Catálogo";
    if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'none';
    
    // CORREÇÃO CIRÚRGICA: Eliminado o .style.style.display duplicado que travava a leitura do arquivo inteiro
    const containerGeom = document.getElementById('container_geometrico');
    if (containerGeom) containerGeom.style.display = "none";
    
    window.calcularCustoOperacionalMaterial();
};

window.corrigirRodapeOficial = function() {
    const r = document.querySelector('footer');
    if (r) {
        r.style.textAlign = "center";
        r.style.borderTop = "2px solid #1e3a8a";
        r.style.padding = "16px 0";
        r.innerHTML = `<p style="text-align: center; font-weight: bold; margin: 0; color: #4b5563;">© 2026 TERADMAS ERP v2.6 | Ecossistema Integrado de Planejamento e Controle de Materiais Produtivos. Professor Renato - Todos os direitos reservados.</p>`;
    }
};

window.carregarDadosIniciais();
