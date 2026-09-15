/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 1 DE 5 - ACESSIBILIDADE E REQUISITOS VISUAIS
   ========================================================================== */

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
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 2 DE 5 - DICIONÁRIO METALÚRGICO COM PRECIFICAÇÃO REATIVA
   ========================================================================== */

const CATALOGO_METALURGICO = {
    aco_1020: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1020-BR", nome: "Barra de Aço SAE 1020", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Carbono para Cementação", preco_base: "18.50" },
    aco_1030: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1030-BR", nome: "Barra de Aço SAE 1030", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono de Alta Forjabilidade", preco_base: "21.40" },
    aco_1045: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1045-BR", nome: "Eixo de Aço SAE 1045", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Médio Carbono Beneficiável Estrutural", preco_base: "24.80" },
    aco_1070: { grupo: "Aços Sólidos (Barras)", sku: "MAT-STEEL-1070-BR", nome: "Tarugo de Aço SAE 1070", tipo: "barra", densidade: 7.82, unidade: "kg", especificacao: "Alto Carbono para Molas e Facas", preco_base: "29.10" },
    aco_4340: { grupo: "Aços Sólidos (Barras)", sku: "MAT-ALLOY-4340-BR", nome: "Eixo de Aço Liga SAE 4340", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Alta Temperabilidade", preco_base: "38.50" },
    aco_8620: { grupo: "Aços Sólidos (Barras)", sku: "MAT-ALLOY-8620-BR", nome: "Barra de Aço Liga SAE 8620", tipo: "barra", densidade: 7.85, unidade: "kg", especificacao: "Aço Liga Cementável para Engrenagens", preco_base: "34.20" },
    aco_inox_304: { grupo: "Aços Sólidos (Barras)", sku: "MAT-INOX-304-CH", nome: "Chapa/Tarugo Inox AISI 304", tipo: "barra", densidade: 8.00, unidade: "kg", especificacao: "Aço Inoxidável Austenítico", preco_base: "55.00" },
    tubo_1020: { grupo: "Tubos Mecânicos (Ocos)", sku: "MAT-PIPE-1020-ST", nome: "Tubo Mecânico SAE 1020", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Industrial Sem Costura", preco_base: "22.30" },
    tubo_1045: { grupo: "Tubos Mecânicos (Ocos)", sku: "MAT-PIPE-1045-HD", nome: "Tubo Hidráulico SAE 1045", tipo: "tubo", densidade: 7.85, unidade: "kg", especificacao: "Tubo Trefilado Brunido", preco_base: "31.15" },
    quim_tinta: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-PAINT-IND", nome: "Tinta Primer Epóxi Industrial", tipo: "fluido", densidade: 1.25, unidade: "L", especificacao: "Revestimento de Proteção Anticorrosiva", preco_base: "42.80" },
    quim_graxa: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-GREASE-EP2", nome: "Graxa de Alta Temperatura EP2", tipo: "fluido", densidade: 0.92, unidade: "kg", especificacao: "Lubrificação de Rolamentos", preco_base: "36.50" },
    quim_desengraxante: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-DEGREASE", nome: "Desengraxante Alcalino Concentrado", tipo: "fluido", densidade: 1.05, unidade: "L", especificacao: "Decapagem e Lavagem de Peças", preco_base: "19.90" },
    quim_oleo_forno: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-FURN", nome: "Óleo Mineral para Fornos de Têmpera", tipo: "fluido", densidade: 0.88, unidade: "L", especificacao: "Meio de Resfriamento Acelerado", preco_base: "48.00" },
    quim_oleo_maquina: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-MACH", nome: "Óleo Lubrificante Hidráulico AW 68", tipo: "fluido", densidade: 0.89, unidade: "L", especificacao: "Fluidos de Transmissão", preco_base: "26.40" },
    quim_oleo_corte: { grupo: "Químicos e Lubrificantes", sku: "MAT-CHEM-OIL-CUT", nome: "Óleo de Corte Solúvel Semissintético", tipo: "fluido", densidade: 0.95, unidade: "L", especificacao: "Fluido de Refrigeração", preco_base: "32.10" },
    gas_argon: { grupo: "Gases Industriais", sku: "MAT-GAS-ARGON-01", nome: "Gás Argônio Puro 99.9%", tipo: "gas", densidade: 1.2, unidade: "m³", especificacao: "Atmosfera Protetiva de Soldagem", preco_base: "85.00" },
    gas_nitrogenio: { grupo: "Gases Industriais", sku: "MAT-GAS-NITRO-02", nome: "Gás Nitrogênio Especial", tipo: "gas", densidade: 1.2, unidade: "m³", especificacao: "Tratamento Térmico e Inertização", preco_base: "79.00" }
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 3 DE 5 - INICIALIZAÇÃO DE FORMULÁRIO E GEOMETRIAS
   ========================================================================== */

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
    
    document.getElementById('preco_unitario').value = material.preco_base || "18.50";
    document.getElementById('coeficiente_refugo').value = "5.0";
    document.getElementById('lead_time_entrega').value = "4";
    document.getElementById('estoque_seguranca').value = "10";
    document.getElementById('dim_comprimento').value = material.tipo === "fluido" ? "20.00" : "6.00";
    document.getElementById('quantidade_pecas_lote').value = "50";
    window.calcularCustoOperacionalMaterial();
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 4 DE 5 - ENGINE DE BALANÇO DE MASSA E CUBAGEM JS
   ========================================================================== */

window.calcularCustoOperacionalMaterial = function() {
    const chave = document.getElementById('seletor_modelo').value;
    const material = CATALOGO_METALURGICO[chave];
    if (!material) return;

    const pUn = numeroSeguro(document.getElementById('preco_unitario')?.value);
    const ref = numeroSeguro(document.getElementById('coeficiente_refugo')?.value);
    const compInput = numeroSeguro(document.getElementById('dim_comprimento')?.value) || 0;
    const qtdPecas = parseInt(document.getElementById('quantidade_pecas_lote')?.value) || 1;

    let volumeUnitarioM3 = 0, volumeTotalM3 = 0, massaUnitariaKg = 0, massaTotalKg = 0;

    if (material.tipo === "gas" || material.tipo === "fluido") {
        if (material.unidade === "L") {
            volumeUnitarioM3 = compInput / 1000;
            massaUnitariaKg = compInput * material.densidade;
        } else {
            volumeUnitarioM3 = compInput;
            massaUnitariaKg = compInput * material.densidade;
        }
        volumeTotalM3 = volumeUnitarioM3 * qtdPecas;
        massaTotalKg = massaUnitariaKg * qtdPecas;
    } else {
        const diametro = numeroSeguro(document.getElementById('dim_diametro')?.value);
        const raioExt = diametro / 2;
        if (material.tipo === "barra") { 
            volumeUnitarioM3 = Math.PI * Math.pow(raioExt, 2) * compInput; 
        } else {
            const espessura = numeroSeguro(document.getElementById('dim_espessura')?.value);
            const raioInt = raioExt - espessura;
            if (raioInt > 0) volumeUnitarioM3 = Math.PI * (Math.pow(raioExt, 2) - Math.pow(raioInt, 2)) * compInput;
        }
        massaUnitariaKg = volumeUnitarioM3 * (material.densidade * 1000);
        volumeTotalM3 = volumeUnitarioM3 * qtdPecas; 
        massaTotalKg = massaUnitariaKg * qtdPecas;
    }

    const displayMassa = document.getElementById('massa_calculada_exibicao');
    if (displayMassa) {
        displayMassa.innerText = `Massa por Peça/Galão: ${massaUnitariaKg.toFixed(3)} kg | Vol. Unitário: ${volumeUnitarioM3.toFixed(5)} m³`;
    }

    if (document.getElementById('balanco_comprando')) document.getElementById('balanco_comprando').innerText = `${(volumeTotalM3 * (1 + ref/100)).toFixed(3)} m³ / ${(massaTotalKg * (1 + ref/100)).toFixed(2)} ${material.unidade}`;
    if (document.getElementById('balanco_encomendado')) document.getElementById('balanco_encomendado').innerText = `${(volumeTotalM3 * 1.2).toFixed(3)} m³ / ${(massaTotalKg * 1.2).toFixed(2)} kg`;
    if (document.getElementById('balanco_entregue')) document.getElementById('balanco_entregue').innerText = `${volumeTotalM3.toFixed(3)} m³ / ${massaTotalKg.toFixed(2)} kg`;

    const custoTotalIntegradoOp = pUn * (1 + (ref / 100)) * (material.unidade === "L" || material.unidade === "m³" ? (compInput * qtdPecas) : massaTotalKg);
    if (document.getElementById('custo_total_integrado')) document.getElementById('custo_total_integrado').value = custoTotalIntegradoOp.toFixed(2);
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 5 DE 6 - INTEGRAÇÃO DA TRAVA CONTÁBIL E RENDERIZAÇÃO DA TABELA
   ========================================================================== */

window.carregarDadosIniciais = async function() {
    try {
        const [resMateriais, resOrcamento, resOperacional] = await Promise.all([
            fetch('/api/materiais/listar'),
            fetch('/api/materiais/orcamento'),
            fetch('/api/materiais/operacional')
        ]);

        if (!resMateriais.ok) throw new Error(`Falha ao listar materiais (${resMateriais.status})`);
        const materiais = await resMateriais.json();
        let orcamento = {
            capital_inicial: 0,
            porcentagem_quota: 0,
            valor_quota: 0,
            patrimonio_atual: 0,
            saldo_aquisicao: 0,
            custos_fixos_geral: 0,
            custos_fixos_setor: 0,
            custos_variaveis_geral: 0,
            custos_variaveis_setor: 0
        };

        if (resOrcamento.ok) {
            const dadosOrcamento = await resOrcamento.json();
            if (dadosOrcamento && dadosOrcamento.status !== 'erro') {
                orcamento = { ...orcamento, ...dadosOrcamento };
            }
        }

        const capitalTotalEmpresa = numeroSeguro(orcamento.capital_inicial);
        const disponivelParaSetor = numeroSeguro(orcamento.valor_quota);
        const patrimonioAtual = numeroSeguro(orcamento.patrimonio_atual);
        const saldoVerbaSustentada = numeroSeguro(orcamento.saldo_aquisicao);
        const pctTetoConsumido = disponivelParaSetor > 0
            ? Math.min((patrimonioAtual / disponivelParaSetor) * 100, 100)
            : 0;

        const moeda = valor => `R$ ${numeroSeguro(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const definirTexto = (id, texto) => {
            const el = document.getElementById(id);
            if (el) el.innerText = texto;
        };

        definirTexto('top_capital_total_val', moeda(capitalTotalEmpresa));
        definirTexto('top_disponivel_setor_val', moeda(disponivelParaSetor));
        definirTexto('top_orcamento_inicial_val', moeda(disponivelParaSetor));
        definirTexto('top_verba_reais_val', moeda(saldoVerbaSustentada));
        definirTexto('top_patrimonio_maquinas_val', moeda(patrimonioAtual));
        definirTexto('top_custo_fixo_val', `${moeda(orcamento.custos_fixos_geral)}/mês`);
        definirTexto('top_custo_fixo_setor_val', `${moeda(orcamento.custos_fixos_setor)}/mês`);
        definirTexto('top_custo_variavel_val', `${moeda(orcamento.custos_variaveis_geral)}/mês`);
        definirTexto('top_custo_variavel_setor_val', `${moeda(orcamento.custos_variaveis_setor)}/mês`);

        const pctQuota = numeroSeguro(orcamento.porcentagem_quota);
        definirTexto('pct_custo_fixo_geral', capitalTotalEmpresa > 0 ? `${((numeroSeguro(orcamento.custos_fixos_geral) / capitalTotalEmpresa) * 100).toFixed(2)}% do capital inicial` : '');
        definirTexto('pct_custo_fixo_setor', pctQuota > 0 ? `Quota oficial do setor: ${pctQuota.toFixed(2)}%` : 'Quota do setor ainda não definida no Financeiro');
        definirTexto('pct_custo_variavel_geral', '');
        definirTexto('pct_custo_variavel_setor', '');

        const vLimite = document.getElementById('txt_valores_limite');
        if (vLimite) {
            vLimite.innerHTML = `TRAVA DE ABASTECIMENTO: <strong>${moeda(patrimonioAtual)} / ${moeda(disponivelParaSetor)}</strong>`;
        }

        definirTexto('txt_porcentagem_budget', `${pctTetoConsumido.toFixed(1)}% da quota consumida`);
        const bar = document.getElementById('barra_progresso_budget');
        if (bar) bar.style.width = `${pctTetoConsumido}%`;

        window.renderizarTabelaMateriais(materiais);

        if (resOperacional.ok) {
            const operacional = await resOperacional.json();
            window.renderizarQuadrosOperacionais(operacional);
        } else {
            window.renderizarQuadrosOperacionais({colaboradores: [], instrumentos: [], energia: []});
        }
    } catch (e) {
        console.error('Erro ao carregar painel de Materiais:', e);
        window.renderizarTabelaMateriais([]);
    }
};

window.renderizarTabelaMateriais = function(materiais) {
    const tbody = document.getElementById('tabela_materiais');
    if (!tbody) return;
    if (!materiais || materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:16px; text-align:center; font-style:italic;">Nenhum material cadastrado no banco Supabase.</td></tr>`;
        return;
    }
    tbody.innerHTML = materiais.map(x => {
        const pUn = numeroSeguro(x.preco_unitario || 0); const qEst = numeroSeguro(x.estoque_seguranca || 0);
        const cTotal = pUn * qEst * (1 + (numeroSeguro(x.coeficiente_refugo || 0) / 100));
        return `<tr>
            <td><strong>${x.nome_material}</strong><br><small style="color:#64748b;">SKU: ${x.codigo_sku || 'N/A'}</small></td>
            <td>Controle: <strong>${x.unidade_medida || 'kg'}</strong> | Refugo: ${x.coeficiente_refugo || 0}%<br><small style="color:#2563eb;">Dimensões: Ø ${x.dim_diametro || '0'} | Esp: ${x.dim_espessura || '0'} | Comp: ${x.dim_comprimento || 0}m</small></td>
            <td><strong>${x.fornecedor_padrao || 'Homologado'}</strong><br><span style="color:#1e3a8a; font-weight:bold;">📦 Qtd Estoque: ${qEst.toFixed(1)} ${x.unidade_medida || 'un'}</span></td>
            <td style="font-family:monospace;"><small style="color:#64748b; display:block;">Un: R$ ${pUn.toFixed(2)}</small><strong style="color:#166534; font-size:13px;">Total: R$ ${cTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></td>
            <td style="text-align:center; white-space:nowrap;">
                <button type="button" onclick="window.editarMaterial(${x.id})" class="btn-top" style="color:#b45309; border-color:#fef3c7; background:#fffbef; margin-right:4px;">Editar</button>
                <button type="button" onclick="window.deletarMaterial(${x.id})" class="btn-top" style="color:#dc2626; border-color:#fee2e2; background:#fef2f2;">Deletar</button>
            </td>
        </tr>`;
    }).join('');
};
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 08: ENGENHARIA DE MATERIAIS
   PARTE 6 DE 6 - SISTEMA CRUD REATIVO (EDITAR, SALVAR E DELETAR)
   ========================================================================== */


/* ==========================================================================
   QUADROS OPERACIONAIS DE MATERIAIS
   ========================================================================== */
function moedaMateriais(v) { return numeroSeguro(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function escapeMateriais(v) { const d=document.createElement('div'); d.textContent=v ?? ''; return d.innerHTML; }

window.renderizarQuadrosOperacionais = function(data) {
    const colaboradores=data?.colaboradores||[], instrumentos=data?.instrumentos||[], energia=data?.energia||[];
    const rh=document.getElementById('tabela_colaboradores_materiais');
    const ti=document.getElementById('tabela_instrumentos_materiais');
    const te=document.getElementById('tabela_energia_materiais');
    const tm=document.getElementById('tabela_minuto_maquina_materiais');
    if(rh) rh.innerHTML=colaboradores.length?colaboradores.map(c=>`<tr><td><strong>${escapeMateriais(c.nome||'Equipe')}</strong></td><td>${escapeMateriais(c.cargo||'')}</td><td>${moedaMateriais(c.salario_base)}</td><td>${c.quantidade||1}</td><td><strong>${moedaMateriais(c.subtotal)}</strong></td><td><button class="btn-top" type="button" onclick="window.deletarColaboradorMateriais(${c.id})">Remover</button></td></tr>`).join(''):`<tr><td colspan="6" style="padding:16px;text-align:center;font-style:italic;">Nenhum colaborador contratado.</td></tr>`;
    if(ti) ti.innerHTML=instrumentos.length?instrumentos.map(i=>`<tr><td><strong>${escapeMateriais(i.nome_instrumento)}</strong></td><td>${escapeMateriais(i.categoria||'')}</td><td>${i.quantidade||1}</td><td>${moedaMateriais(numeroSeguro(i.preco_compra)*numeroSeguro(i.quantidade||1))}</td><td>${numeroSeguro(i.potencia_watts)*numeroSeguro(i.quantidade||1)} W<br>${numeroSeguro(i.consumo_gas_m3)*numeroSeguro(i.quantidade||1)} m³ gás</td><td><strong>${moedaMateriais(i.custo_minuto)}</strong>/min</td><td>${i.is_patrimonio?'Sim':'Não'}</td><td><button class="btn-top" type="button" onclick="window.deletarInstrumentoMateriais(${i.id})">Remover</button></td></tr>`).join(''):`<tr><td colspan="8" style="padding:16px;text-align:center;font-style:italic;">Nenhum instrumento/material de apoio registrado.</td></tr>`;
    if(te) te.innerHTML=energia.length?energia.map(e=>`<tr><td><strong>${escapeMateriais(e.descricao)}</strong></td><td>${escapeMateriais(e.tipo_energia||'')}</td><td>${numeroSeguro(e.consumo_mensal).toLocaleString('pt-BR',{minimumFractionDigits:2})} ${escapeMateriais(e.unidade||'')}</td><td>${moedaMateriais(e.tarifa_unitaria)}</td><td>${moedaMateriais(e.custo_fixo_mensal)}</td><td>${moedaMateriais(e.custo_variavel_mensal)}</td><td><strong>${moedaMateriais(e.custo_total_mensal)}</strong></td><td><button class="btn-top" type="button" onclick="window.deletarEnergiaMateriais(${e.id})">Remover</button></td></tr>`).join(''):`<tr><td colspan="8" style="padding:16px;text-align:center;font-style:italic;">Nenhum consumo de energia/utilidade registrado.</td></tr>`;
    if(tm) tm.innerHTML=instrumentos.length?instrumentos.map(i=>{const total=numeroSeguro(i.custo_minuto)*Math.max(1,numeroSeguro(i.quantidade));return `<tr><td><strong>${escapeMateriais(i.nome_instrumento)}</strong></td><td>${escapeMateriais(i.categoria||'')}</td><td>${i.quantidade||1}</td><td>${(numeroSeguro(i.potencia_watts)*Math.max(1,numeroSeguro(i.quantidade))).toLocaleString('pt-BR')} W</td><td>${moedaMateriais(i.custo_minuto)}/min</td><td><strong>${moedaMateriais(total)}/min</strong></td></tr>`;}).join(''):`<tr><td colspan="6" style="padding:16px;text-align:center;font-style:italic;">Nenhum equipamento com custo por minuto registrado.</td></tr>`;
    const totalMin=instrumentos.reduce((a,i)=>a+numeroSeguro(i.custo_minuto)*Math.max(1,numeroSeguro(i.quantidade)),0);
    const k=document.getElementById('kpi_custo_minuto_materiais'); if(k) k.textContent=moedaMateriais(totalMin)+'/min';
};

window.salvarColaboradorMateriais=async function(e){e.preventDefault();const cargo=document.getElementById('mat_rh_cargo').value;const dados={nome:document.getElementById('mat_rh_nome').value,cargo,salario_base:numeroSeguro(document.getElementById('mat_rh_salario').value),quantidade:parseInt(document.getElementById('mat_rh_qtd').value,10)||1};const r=await fetch('/api/materiais/colaboradores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});if(!r.ok){alert('Erro ao contratar colaborador.');return;}document.getElementById('formColaboradorMateriais').reset();document.getElementById('mat_rh_qtd').value=1;window.carregarDadosIniciais();};
window.deletarColaboradorMateriais=async function(id){if(!confirm('Remover colaborador do quadro de Materiais?'))return;const r=await fetch(`/api/materiais/colaboradores/${id}`,{method:'DELETE'});if(r.ok)window.carregarDadosIniciais();};
window.salvarInstrumentoMateriais=async function(e){e.preventDefault();const dados={nome_instrumento:document.getElementById('mat_inst_nome').value,categoria:document.getElementById('mat_inst_categoria').value,quantidade:parseInt(document.getElementById('mat_inst_qtd').value,10)||1,preco_compra:numeroSeguro(document.getElementById('mat_inst_preco').value),potencia_watts:numeroSeguro(document.getElementById('mat_inst_watts').value),consumo_gas_m3:numeroSeguro(document.getElementById('mat_inst_gas').value),consumo_agua_m3:numeroSeguro(document.getElementById('mat_inst_agua').value),depreciacao_anos:parseInt(document.getElementById('mat_inst_dep').value,10)||10,custo_minuto:numeroSeguro(document.getElementById('mat_inst_minuto').value),is_patrimonio:document.getElementById('mat_inst_patrimonio').checked};const r=await fetch('/api/materiais/instrumentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});if(!r.ok){alert('Erro ao registrar instrumento/material.');return;}document.getElementById('formInstrumentoMateriais').reset();document.getElementById('mat_inst_qtd').value=1;document.getElementById('mat_inst_dep').value=10;window.carregarDadosIniciais();};
window.deletarInstrumentoMateriais=async function(id){if(!confirm('Remover este item do quadro operacional?'))return;const r=await fetch(`/api/materiais/instrumentos/${id}`,{method:'DELETE'});if(r.ok)window.carregarDadosIniciais();};
window.salvarEnergiaMateriais=async function(e){e.preventDefault();const dados={descricao:document.getElementById('mat_en_descricao').value,tipo_energia:document.getElementById('mat_en_tipo').value,consumo_mensal:numeroSeguro(document.getElementById('mat_en_consumo').value),unidade:document.getElementById('mat_en_unidade').value,tarifa_unitaria:numeroSeguro(document.getElementById('mat_en_tarifa').value),custo_fixo_mensal:numeroSeguro(document.getElementById('mat_en_fixo').value)};const r=await fetch('/api/materiais/energia',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});if(!r.ok){alert('Erro ao registrar energia.');return;}document.getElementById('formEnergiaMateriais').reset();document.getElementById('mat_en_unidade').value='kWh';window.carregarDadosIniciais();};
window.deletarEnergiaMateriais=async function(id){if(!confirm('Remover este registro de energia?'))return;const r=await fetch(`/api/materiais/energia/${id}`,{method:'DELETE'});if(r.ok)window.carregarDadosIniciais();};

window.editarMaterial = async function(id) {
    if (!id) return;
    try {
        const res = await fetch(`/api/materiais/listar`); if (!res.ok) throw new Error("Erro");
        const materiais = await res.json(); const mat = materiais.find(x => x.id === id);
        if (!mat) return;
        const containerGeom = document.getElementById('container_geometrico'); if (containerGeom) containerGeom.style.display = "flex";
        const campoId = document.getElementById('registro_id');
        if (campoId) { campoId.value = mat.id; } else {
            const hId = document.createElement('input'); hId.type = 'hidden'; hId.id = 'registro_id'; hId.value = mat.id;
            document.getElementById('formMaterial').appendChild(hId);
        }
        if (document.getElementById('nome_material')) document.getElementById('nome_material').value = mat.nome_material || '';
        if (document.getElementById('codigo_sku')) document.getElementById('codigo_sku').value = mat.codigo_sku || '';
        if (document.getElementById('unidade_medida')) document.getElementById('unidade_medida').value = mat.unidade_medida || 'kg';
        if (document.getElementById('preco_unitario')) document.getElementById('preco_unitario').value = numeroSeguro(mat.preco_unitario).toFixed(2);
        if (document.getElementById('coeficiente_refugo')) document.getElementById('coeficiente_refugo').value = numeroSeguro(mat.coeficiente_refugo).toFixed(1);
        if (document.getElementById('lead_time_entrega')) document.getElementById('lead_time_entrega').value = Number.parseInt(mat.lead_time_entrega, 10) || 0;
        if (document.getElementById('estoque_seguranca')) document.getElementById('estoque_seguranca').value = numeroSeguro(mat.estoque_seguranca).toFixed(1);
        if (document.getElementById('fornecedor_padrao')) document.getElementById('fornecedor_padrao').value = mat.fornecedor_padrao || '';
        if (document.getElementById('especificacao_tecnica')) document.getElementById('especificacao_tecnica').value = mat.especificacao_tecnica || '';
        if (document.getElementById('dim_comprimento')) document.getElementById('dim_comprimento').value = numeroSeguro(mat.dim_comprimento).toFixed(2);
        const seletorModelo = document.getElementById('seletor_modelo');
        if (seletorModelo) {
            const ch = Object.keys(CATALOGO_METALURGICO).find(k => CATALOGO_METALURGICO[k].sku === mat.codigo_sku);
            if (ch) {
                seletorModelo.value = ch; const dSel = document.getElementById('dim_diametro'); const eSel = document.getElementById('dim_espessura');
                if (dSel) dSel.innerHTML = ""; if (eSel) eSel.innerHTML = "";
                if (CATALOGO_METALURGICO[ch].tipo !== "gas" && CATALOGO_METALURGICO[ch].tipo !== "fluido") {
                    OPCOES_DIAMETROS.forEach(o => dSel.add(new Option(o.texto, o.valor)));
                    if (CATALOGO_METALURGICO[ch].tipo === "tubo" && document.getElementById('bloco_espessura')) {
                        document.getElementById('bloco_espessura').style.display = "block"; OPCOES_ESPESSURAS.forEach(o => eSel.add(new Option(o.texto, o.valor)));
                    } else if (document.getElementById('bloco_espessura')) { document.getElementById('bloco_espessura').style.display = "none"; }
                }
            }
        }
        if (document.getElementById('dim_diametro')) document.getElementById('dim_diametro').value = mat.dim_diametro || '0';
        if (document.getElementById('dim_espessura')) document.getElementById('dim_espessura').value = mat.dim_espessura || '0';
        window.calcularCustoOperacionalMaterial(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error(e); }
};

window.salvarMaterial = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? Number.parseInt(document.getElementById('registro_id').value, 10) : null,
        nome_material: document.getElementById('nome_material').value, codigo_sku: document.getElementById('codigo_sku').value,
        categoria: "Insumo Industrial", unidade_medida: document.getElementById('unidade_medida').value,
        preco_unitario: numeroSeguro(document.getElementById('preco_unitario').value) || 0,
        coeficiente_refugo: numeroSeguro(document.getElementById('coeficiente_refugo').value) || 0,
        lead_time_entrega: Number.parseInt(document.getElementById('lead_time_entrega').value, 10) || 0,
        estoque_seguranca: numeroSeguro(document.getElementById('estoque_seguranca').value) || 0,
        fornecedor_padrao: document.getElementById('fornecedor_padrao').value, especificacao_tecnica: document.getElementById('especificacao_tecnica').value,
        dim_diametro: document.getElementById('dim_diametro')?.value || '0', dim_espessura: document.getElementById('dim_espessura')?.value || '0',
        dim_comprimento: numeroSeguro(document.getElementById('dim_comprimento')?.value) || 0, custo_total_integrado: numeroSeguro(document.getElementById('custo_total_integrado')?.value) || 0
    };
    const res = await fetch('/api/materiais/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    if (res.ok) { window.limparFormularioMaterial(); window.carregarDadosIniciais(); alert("🎯 Material homologado e gravado!"); }
};

window.deletarMaterial = async function(id) {
    if(!confirm('Remover insumo?')) return;
    const res = await fetch(`/api/materiais/deletar/${id}`, { method: 'DELETE' }); if (res.ok) window.carregarDadosIniciais();
};

window.limparFormularioMaterial = function() {
    document.getElementById('formMaterial').reset();
    const cId = document.getElementById('registro_id'); if (cId) cId.value = "";
    if (document.getElementById('container_geometrico')) document.getElementById('container_geometrico').style.display = "none";
};

window.vincularEventosInputs = function() {
    ['preco_unitario', 'coeficiente_refugo', 'estoque_seguranca', 'dim_comprimento', 'dim_diametro', 'dim_espessura', 'quantidade_pecas_lote'].forEach(id => {
        const el = document.getElementById(id); if (el) el.oninput = window.calcularCustoOperacionalMaterial;
    });
};

function numeroSeguro(v) { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : 0; }
window.carregarDadosIniciais();
