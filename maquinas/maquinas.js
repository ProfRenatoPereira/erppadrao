/* erppadrao - materiais/materiais.js - PARTE 1 DE 3 */

let escalaFonteGlobal = 16;
let sintetizadorLeitor = window.speechSynthesis;
let flagLeitorAtivo = false;

window.mudarFonte = function(direcao) {
    escalaFonteGlobal += (direcao * 2);
    if (escalaFonteGlobal < 12) escalaFonteGlobal = 12;
    if (escalaFonteGlobal > 26) escalaFonteGlobal = 26;
    document.documentElement.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
    document.body.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
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
        btn.innerText = "🛑 Parar"; sintetizadorLeitor.cancel();
        let utterance = new SpeechSynthesisUtterance("Módulo de engenharia de materiais carregado.");
        utterance.lang = 'pt-BR';
        sintetizadorLeitor.speak(utterance);
    } else { btn.innerText = "🔊 Leitor"; sintetizadorLeitor.cancel(); }
};

const CATALOGO_METALURGICO = {
    aco_1020: { sku: "MAT-STEEL-1020-BR", nome: "Barra de Aço SAE 1020", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Carbono para Cementação" },
    aco_1045: { sku: "MAT-STEEL-1045-BR", nome: "Eixo de Aço SAE 1045", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono Beneficiável" },
    tubo_1020: { sku: "MAT-PIPE-1020-ST", nome: "Tubo Mecânico SAE 1020", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Industrial Sem Costura" },
    gas_argon: { sku: "MAT-GAS-ARGON-01", nome: "Gás Argônio Puro 99.9%", tipo: "gas", densidade: 1.2, unidade: "m³", especificacao: "Atmosfera Protetiva de Soldagem" }
};

const OPCOES_DIAMETROS = [{ valor: "0.0254", texto: "1\" (25,40 mm)" }, { valor: "0.0508", texto: "2\" (50,80 mm)" }];
const OPCOES_ESPESSURAS = [{ valor: "0.00318", texto: "1/8\" (3,18 mm)" }, { valor: "0.00635", texto: "1/4\" (6,35 mm)" }];
/* erppadrao - materiais/materiais.js - PARTE 2 DE 3 */

window.carregarPreDefinido = function() {
    const chave = document.getElementById('seletor_modelo').value;
    const material = CATALOGO_METALURGICO[chave];
    const dSelect = document.getElementById('dim_diametro');
    const eSelect = document.getElementById('dim_espessura');
    const bEspessura = document.getElementById('bloco_espessura');
    const containerGeom = document.getElementById('container_geometrico');

    if (dSelect) dSelect.innerHTML = "";
    if (eSelect) eSelect.innerHTML = "";
    if (!material) { if (containerGeom) containerGeom.style.display = "none"; return; }

    if (containerGeom) containerGeom.style.display = "flex";
    if (document.getElementById('codigo_sku')) document.getElementById('codigo_sku').value = material.sku;
    if (document.getElementById('nome_material')) document.getElementById('nome_material').value = material.nome;
    if (document.getElementById('unidade_medida')) document.getElementById('unidade_medida').value = material.unidade;
    if (document.getElementById('especificacao_tecnica')) document.getElementById('especificacao_tecnica').value = material.especificacao;
    if (document.getElementById('fornecedor_padrao')) document.getElementById('fornecedor_padrao').value = material.sku.includes("GAS") ? "White Martins Gases" : "Gerdau S/A";

    if (material.tipo === "gas") {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "N/A";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = "m³ Vol";
        if (bEspessura) bEspessura.style.display = "none";
    } else {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "Pol";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = "Metros";
        OPCOES_DIAMETROS.forEach(o => dSelect.add(new Option(o.texto, o.valor)));
        if (material.tipo === "tubo" && bEspessura) {
            bEspessura.style.display = "block";
            OPCOES_ESPESSURAS.forEach(o => eSelect.add(new Option(o.texto, o.valor)));
        } else if (bEspessura) { bEspessura.style.display = "none"; }
    }
    document.getElementById('preco_unitario').value = "18.50";
    document.getElementById('coeficiente_refugo').value = "5.0";
    document.getElementById('lead_time_entrega').value = "4";
    document.getElementById('estoque_seguranca').value = "10";
    document.getElementById('dim_comprimento').value = "6.00";
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

    let volumeUnitarioM3 = 0, volumeTotalM3 = 0, massaUnitariaKg = 0, massaTotalKg = 0;

    if (material.tipo === "gas") {
        volumeUnitarioM3 = compInput; volumeTotalM3 = volumeUnitarioM3 * estSeg;
        massaUnitariaKg = volumeUnitarioM3 * material.densidade; massaTotalKg = volumeTotalM3 * material.densidade;
    } else {
        const diametro = parseFloat(document.getElementById('dim_diametro')?.value) || 0;
        const raioExt = diametro / 2;
        if (material.tipo === "barra") { volumeUnitarioM3 = Math.PI * Math.pow(raioExt, 2) * compInput; }
        else {
            const espessura = parseFloat(document.getElementById('dim_espessura')?.value) || 0;
            const raioInt = raioExt - espessura;
            if (raioInt > 0) volumeUnitarioM3 = Math.PI * (Math.pow(raioExt, 2) - Math.pow(raioInt, 2)) * compInput;
        }
        massaUnitariaKg = volumeUnitarioM3 * (material.densidade * 1000);
        volumeTotalM3 = volumeUnitarioM3 * estSeg; massaTotalKg = massaUnitariaKg * estSeg;
    }

    const displayMassa = document.getElementById('massa_calculada_exibicao');
    if (displayMassa) displayMassa.innerText = `${volumeUnitarioM3.toFixed(4)} m³ (${massaUnitariaKg.toFixed(2)} kg/peça) | Total: ${volumeTotalM3.toFixed(3)} m³`;

    const dComprando = document.getElementById('balanco_comprando');
    if (dComprando) dComprando.innerText = `${(volumeTotalM3 * (1 + ref/100)).toFixed(3)} m³ / ${(massaTotalKg * (1 + ref/100)).toFixed(2)} kg`;
    if (document.getElementById('balanco_encomendado')) document.getElementById('balanco_encomendado').innerText = `${volumeTotalM3.toFixed(3)} m³`;
    if (document.getElementById('balanco_entregue')) document.getElementById('balanco_entregue').innerText = `${volumeTotalM3.toFixed(3)} m³`;

    const custoTotalIntegradoOp = pUn * (1 + (ref / 100)) * (material.tipo === "gas" ? volumeTotalM3 : massaTotalKg);
    if (document.getElementById('custo_total_integrado')) document.getElementById('custo_total_integrado').value = custoTotalIntegradoOp.toFixed(2);
};

window.vincularEventosInputs = function() {
    const ids = ['preco_unitario', 'coeficiente_refugo', 'estoque_seguranca', 'dim_comprimento', 'dim_diametro', 'dim_espessura'];
    ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.oninput = window.calcularCustoOperacionalMaterial;
    });
};
/* erppadrao - materiais/materiais.js - PARTE 3 DE 3 */

window.carregarDadosIniciais = async function() {
    try {
        const resMat = await fetch('/api/materiais/listar');
        const materiais = await resMat.json();
        
        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 2000000.00;
        const custoFixoGeralAluguel = 21350.00;
        const custoFixoAlmoxarifadoSetor = 12450.00;
        const custoFixoMaquinasAcumulado = 34432.51;
        const totalCustosFixosPlanta = custoFixoGeralAluguel + custoFixoMaquinasAcumulado + custoFixoAlmoxarifadoSetor;

        const definirTexto = (id, texto) => { const el = document.getElementById(id); if (el) el.innerText = texto; };
        definirTexto('top_capital_total', `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR')}`);
        definirTexto('top_disponivel_setor', `R$ ${disponivelParaSetor.toLocaleString('pt-BR')}`);
        definirTexto('top_orcamento_inicial', `R$ ${disponivelParaSetor.toLocaleString('pt-BR')}`);
        definirTexto('top_custo_fixo', `R$ ${totalCustosFixosPlanta.toLocaleString('pt-BR')}/mês`);
        definirTexto('top_custo_fixo_setor', `R$ ${custoFixoAlmoxarifadoSetor.toLocaleString('pt-BR')}/mês`);
        definirTexto('top_custo_variavel', "R$ 10.593,38/mês");
        definirTexto('top_custo_variavel_setor', "R$ 4.210,12/mês");

        window.renderizarTabelaMateriais(materiais);
    } catch (e) { console.error(e); }
};

window.renderizarTabelaMateriais = function(materiais) {
    const tbody = document.getElementById('tabela_materiais');
    if (!tbody) return;
    if (!materiais || materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:16px; text-align:center; font-style:italic;">Nenhum material homologado.</td></tr>`;
        return;
    }
    tbody.innerHTML = materiais.map(x => `
        <tr>
            <td><strong>${x.nome_material}</strong><br><small>SKU: ${x.codigo_sku}</small></td>
            <td>Controle: ${x.unidade_medida} | Refugo: ${x.coeficiente_refugo}%</td>
            <td><strong>${x.fornecedor_padrao}</strong></td>
            <td style="color:#166534; font-weight:bold;">R$ ${(x.preco_unitario || 0).toFixed(2)}</td>
            <td style="text-align:center;">
                <button type="button" onclick="window.deletarMaterial(${x.id})" class="btn-top" style="color:#dc2626;">Deletar</button>
            </td>
        </tr>
    `).join('');
};

window.salvarMaterial = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        codigo_sku: document.getElementById('codigo_sku').value,
        categoria: "Aços Sólidos",
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
    const res = await fetch('/api/materiais/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    if (res.ok) { window.limparFormularioMaterial(); window.carregarDadosIniciais(); alert("🎯 Material homologado!"); }
};

window.deletarMaterial = async function(id) {
    if(!confirm('Remover insumo?')) return;
    const res = await fetch(`/api/materiais/deletar/${id}`, { method: 'DELETE' });
    if (res.ok) { window.carregarDadosIniciais(); }
};

window.limparFormularioMaterial = function() {
    document.getElementById('formMaterial').reset();
    document.getElementById('container_geometrico').style.display = "none";
};

window.carregarDadosIniciais();
