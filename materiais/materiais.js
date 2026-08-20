/* erppadrao - materiais/materiais.js - PARTE 1 DE 4 */

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

// AMPLIAÇÃO EXPANDIDA DO LEQUE: Insumos Químicos, Solventes e Fluidos de Tratamento Térmico adicionados com densidades reais
const CATALOGO_METALURGICO = {
    // 1. AÇOS SÓLIDOS MACIÇOS
    aco_1020: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1020-BR", nome: "Barra de Aço SAE 1020", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Carbono para Cementação" },
    aco_1030: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1030-BR", nome: "Barra de Aço SAE 1030", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono de Alta Forjabilidade" },
    aco_1045: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1045-BR", nome: "Eixo de Aço SAE 1045", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono Beneficiável" },
    aco_1070: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1070-BR", nome: "Tarugo de Aço SAE 1070", tipo: "barra", densidade: 7.82, unidade: "kg", especificacao: "Alto Carbono para Molas" },
    aco_4340: { grupo: "Aços Sólidos (Barras)", sku: "MAT-ALLOY-4340-BR", nome: "Eixo de Aço Liga SAE 4340", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Alta Temperabilidade" },
    aco_8620: { grupo: "Aços Sólidos (Barras)", sku: "MAT-ALLOY-8620-BR", nome: "Barra de Aço Liga SAE 8620", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Liga Cementável para Engrenagens" },
    aco_inox_304: { grupo: "Aços Sólidos (Barras)", sku: "MAT-INOX-304-CH", nome: "Chapa/Tarugo Inox AISI 304", tipo: "barra", densidade: 8.00, unidade: "kg", especificacao: "Aço Inoxidável Austenítico" },
    
    // 2. TUBOS MECÂNICOS CAVADOS
    tubo_1020: { grupo: "Tubos Mecânicos (Ocos)", sku: "MAT-PIPE-1020-ST", nome: "Tubo Mecânico SAE 1020", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Industrial Sem Costura" },
    tubo_1045: { grupo: "Tubos Mecânicos (Ocos)", sku: "MAT-PIPE-1045-HD", nome: "Tubo Hidráulico SAE 1045", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Trefilado Brunido" },
    
    // 3. INSUMOS QUÍMICOS E LUBRIFICANTES PRODUTIVOS
    quim_tinta: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-PAINT-IND", nome: "Tinta Primer Epóxi Industrial", tipo: "fluido", densidade: 1.25, unidade: "L", especificacao: "Revestimento de Proteção Anticorrosiva" },
    quim_graxa: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-GREASE-EP2", nome: "Graxa de Alta Temperatura EP2", tipo: "fluido", densidade: 0.92, unidade: "kg", especificacao: "Lubrificação de Rolamentos e Mancais de Carga" },
    quim_desengraxante: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-DEGREASE", nome: "Desengraxante Alcalino Concentrado", tipo: "fluido", densidade: 1.05, unity: "L", unidade: "L", especificacao: "Decapagem e Lavagem de Peças Pós-Usinagem" },
    quim_oleo_forno: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-FURN", nome: "Óleo Mineral para Fornos de Têmpera", tipo: "fluido", densidade: 0.88, unidade: "L", especificacao: "Meio de Resfriamento Acelerado Contornado" },
    quim_oleo_maquina: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-MACH", nome: "Óleo Lubrificante Hidráulico AW 68", tipo: "fluido", densidade: 0.89, unidade: "L", especificacao: "Fluidos de Transmissão de Sistema de Prensas" },
    quim_oleo_corte: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-CUT", nome: "Óleo de Corte Solúvel Semissintético", tipo: "fluido", densidade: 0.95, unidade: "L", especificacao: "Fluido de Refrigeração para Torneamento/Fresagem" },
    
    // 4. GASES INDUSTRIAIS
    gas_argon: { grupo: "Gases Industriais", sku: "MAT-GAS-ARGON-01", nome: "Gás Argônio Puro 99.9%", tipo: "gas", densidade: 1.2, unidade: "m³", especificacao: "Atmosfera Protetiva de Soldagem TIG" },
    gas_nitrogenio: { grupo: "Gases Industriais", sku: "MAT-GAS-NITRO-02", nome: "Gás Nitrogênio Especial", tipo: "gas", densidade: 1.2, unidade: "m³", especificacao: "Tratamento Térmico e Inertização" }
};
/* erppadrao - materiais/materiais.js - PARTE 2 DE 4 */

const OPCOES_DIAMETROS = [
    { valor: "0.0127", texto: "1/2\" (12,70 mm) / Padrão Pequeno" },
    { valor: "0.0254", texto: "1\" (25,40 mm) / Lote Médio" },
    { valor: "0.0508", texto: "2\" (50,80 mm) / Eixo Pesado" },
    { valor: "0.1016", texto: "4\" (101,60 mm) / Tarugo Máster" }
];

const OPCOES_ESPESSURAS = [
    { valor: "0.0020", texto: "Chapa / Parede 2,00 mm" },
    { valor: "0.00318", texto: "Parede 1/8\" (3,18 mm)" },
    { valor: "0.00635", texto: "Parede 1/4\" (6,35 mm)" },
    { valor: "0.01905", texto: "Tambor Galão Comercial / N/A" }
];

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
    
    if (document.getElementById('fornecedor_padrao')) {
        if(material.sku.includes("GAS")) { document.getElementById('fornecedor_padrao').value = "White Martins S/A"; }
        else if(material.sku.includes("CHEM")) { document.getElementById('fornecedor_padrao').value = "Distribuidora Ipiranga Químicos"; }
        else { document.getElementById('fornecedor_padrao').value = "Gerdau Comercial Metais S/A"; }
    }

    if (material.tipo === "gas" || material.tipo === "fluido") {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "N/A Embalagem";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = material.unidade === "L" ? "Volume Litros" : "Volume Unidade";
        if (bEspessura) bEspessura.style.display = "none";
    } else {
        if (document.getElementById('lbl_unidade_diametro')) document.getElementById('lbl_unidade_diametro').innerText = "Pol / mm";
        if (document.getElementById('lbl_unidade_comprimento')) document.getElementById('lbl_unidade_comprimento').innerText = "Metros (m)";
        OPCOES_DIAMETROS.forEach(o => dSelect.add(new Option(o.texto, o.valor)));
        if (material.tipo === "tubo" && bEspessura) {
            bEspessura.style.display = "block";
            OPCOES_ESPESSURAS.forEach(o => eSelect.add(new Option(o.texto, o.valor)));
        } else if (bEspessura) { bEspessura.style.display = "none"; }
    }
    
    document.getElementById('preco_unitario').value = material.sku.includes("CHEM") ? "42.80" : material.tipo === "gas" ? "85.00" : "18.50";
    document.getElementById('coeficiente_refugo').value = "5.0";
    document.getElementById('lead_time_entrega').value = "4";
    document.getElementById('estoque_seguranca').value = "10";
    document.getElementById('dim_comprimento').value = material.tipo === "fluido" ? "20.00" : "6.00";
    document.getElementById('quantidade_pecas_lote').value = "50";
    window.calcularCustoOperacionalMaterial();
};
/* erppadrao - materiais/materiais.js - PARTE 3 DE 4 */

// ============================================================================
// 3. MOTOR DE PROCESSAMENTO FÍSICO (MASSA E CUBAGEM DA PEÇA CORRIGIDOS)
// ============================================================================
window.calcularCustoOperacionalMaterial = function() {
    const chave = document.getElementById('seletor_modelo').value;
    const material = CATALOGO_METALURGICO[chave];
    if (!material) return;

    const pUn = parseFloat(document.getElementById('preco_unitario')?.value) || 0;
    const ref = parseFloat(document.getElementById('coeficiente_refugo')?.value) || 0;
    const compInput = parseFloat(document.getElementById('dim_comprimento')?.value) || 0;
    const qtdPecas = parseInt(document.getElementById('quantidade_pecas_lote')?.value) || 1;

    let volumeUnitarioM3 = 0, volumeTotalM3 = 0, massaUnitariaKg = 0, massaTotalKg = 0;

    if (material.tipo === "gas" || material.tipo === "fluido") {
        // Balanço Volumétrico Químico: Litros/m³ diretos multiplicados pela cubagem do lote
        if (material.unidade === "L") {
            volumeUnitarioM3 = compInput / 1000; // Converte litros para m³ real
            massaUnitariaKg = compInput * material.densidade; // Massa unitária base
        } else {
            volumeUnitarioM3 = compInput;
            massaUnitariaKg = compInput * material.densidade;
        }
        volumeTotalM3 = volumeUnitarioM3 * qtdPecas;
        massaTotalKg = massaUnitariaKg * qtdPecas;
    } else {
        const diametro = parseFloat(document.getElementById('dim_diametro')?.value) || 0;
        const raioExt = diametro / 2;
        if (material.tipo === "barra") { 
            volumeUnitarioM3 = Math.PI * Math.pow(raioExt, 2) * compInput; 
        } else {
            const espessura = parseFloat(document.getElementById('dim_espessura')?.value) || 0;
            const raioInt = raioExt - espessura;
            if (raioInt > 0) volumeUnitarioM3 = Math.PI * (Math.pow(raioExt, 2) - Math.pow(raioInt, 2)) * compInput;
        }
        massaUnitariaKg = volumeUnitarioM3 * (material.densidade * 1000);
        volumeTotalM3 = volumeUnitarioM3 * qtdPecas; 
        massaTotalKg = massaUnitariaKg * qtdPecas;
    }

    // CORREÇÃO CIRÚRGICA: .innerText injeta síncrono sem quebrar o Chrome
    const displayMassa = document.getElementById('massa_calculada_exibicao');
    if (displayMassa) {
        displayMassa.innerText = `Massa por Peça/Galão: ${massaUnitariaKg.toFixed(3)} kg | Vol. Unitário: ${volumeUnitarioM3.toFixed(5)} m³`;
    }

    // Alimenta as caixas verdes inferiores
    const dComprando = document.getElementById('balanco_comprando');
    if (dComprando) dComprando.innerText = `${(volumeTotalM3 * (1 + ref/100)).toFixed(3)} m³ / ${(massaTotalKg * (1 + ref/100)).toFixed(2)} ${material.unidade}`;
    
    if (document.getElementById('balanco_encomendado')) {
        document.getElementById('balanco_encomendado').innerText = `${(volumeTotalM3 * 1.2).toFixed(3)} m³ / ${(massaTotalKg * 1.2).toFixed(2)} kg`;
    }
    if (document.getElementById('balanco_entregue')) {
        document.getElementById('balanco_entregue').innerText = `${volumeTotalM3.toFixed(3)} m³ / ${massaTotalKg.toFixed(2)} kg`;
    }

    const custoTotalIntegradoOp = pUn * (1 + (ref / 100)) * (material.unidade === "L" || material.unidade === "m³" ? (compInput * qtdPecas) : massaTotalKg);
    if (document.getElementById('custo_total_integrado')) document.getElementById('custo_total_integrado').value = custoTotalIntegradoOp.toFixed(2);
};

window.vincularEventosInputs = function() {
    const ids = ['preco_unitario', 'coeficiente_refugo', 'estoque_seguranca', 'dim_comprimento', 'dim_diametro', 'dim_espessura', 'quantidade_pecas_lote'];
    ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.oninput = window.calcularCustoOperacionalMaterial;
    });
};
/* erppadrao - materiais/materiais.js - PARTE 4 DE 4 */

window.carregarDadosIniciais = async function() {
    try {
        // MONTAGEM DO LEQUE ELABORADO DE CATEGORIAS: Agrupa por optgroup no HTML de forma organizada
        const seletor = document.getElementById('seletor_modelo');
        if (seletor && seletor.options.length <= 1) {
            const gruposMap = {};
            Object.keys(CATALOGO_METALURGICO).forEach(key => {
                const g = CATALOGO_METALURGICO[key].grupo;
                if (!gruposMap[g]) gruposMap[g] = [];
                gruposMap[g].push({ val: key, text: CATALOGO_METALURGICO[key].nome });
            });
            
            Object.keys(gruposMap).forEach(gName => {
                const optGroup = document.createElement('optgroup');
                optGroup.label = gName;
                gruposMap[gName].forEach(item => {
                    optGroup.appendChild(new Option(item.text, item.val));
                });
                seletor.appendChild(optGroup);
            });
        }

        const resMat = await fetch('/api/materiais/listar');
        const materiais = await resMat.json();
        
        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 2000000.00;
        const custoFixoGeralAluguel = 21350.00;
        const custoFixoAlmoxarifadoSetor = 12450.00;
        const custoFixoMaquinasAcumulado = 34432.51;
        const totalCustosFixosPlanta = custoFixoGeralAluguel + custoFixoMaquinasAcumulado + custoFixoAlmoxarifadoSetor;

        const definirTexto = (id, texto) => { const el = document.getElementById(id); if (el) el.innerText = texto; };
        definirTexto('top_capital_total', `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
        definirTexto('top_disponivel_setor', `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
        definirTexto('top_orcamento_inicial', `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
        definirTexto('top_custo_fixo', `R$ ${totalCustosFixosPlanta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);
        definirTexto('top_custo_fixo_setor', `R$ ${custoFixoAlmoxarifadoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`);
        definirTexto('top_custo_variavel', "R$ 10.593,38/mês");
        definirTexto('top_custo_variavel_setor', "R$ 4.210,12/mês");

        window.renderizarTabelaMateriais(materiais);
        window.vincularEventosInputs();
    } catch (e) { console.error(e); }
};

window.renderizarTabelaMateriais = function(materiais) {
    const tbody = document.getElementById('tabela_materiais');
    if (!tbody) return;
    if (!materiais || materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:16px; text-align:center; font-style:italic;">Nenhum material cadastrado no banco Supabase.</td></tr>`;
        return;
    }
    tbody.innerHTML = materiais.map(x => `
        <tr>
            <td><strong>${x.nome_material}</strong><br><small>SKU: ${x.codigo_sku}</small></td>
            <td>Controle: ${x.unidade_medida} | Refugo: ${x.coeficiente_refugo}%</td>
            <td><strong>${x.fornecedor_padrao}</strong></td>
            <td style="color:#166534; font-weight:bold;">R$ ${(x.preco_unitario || 0).toFixed(2)}</td>
            <td style="text-align:center;"><button type="button" onclick="window.deletarMaterial(${x.id})" class="btn-top" style="color:#dc2626; border-color:#fee2e2; background:#fef2f2;">Deletar</button></td>
        </tr>
    `).join('');
};

window.salvarMaterial = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        codigo_sku: document.getElementById('codigo_sku').value,
        categoria: "Insumo Industrial",
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
    if (res.ok) { window.limparFormularioMaterial(); window.carregarDadosIniciais(); alert("🎯 Material homologado e gravado!"); }
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
