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
    
    const seletores = document.querySelectorAll('.btn-top, .btn-submit, .input-form, .select-form, td, th, label, p');
    seletores.forEach(el => { el.style.setProperty('font-size', (escalaFonteGlobal - 4) + 'px', 'important'); });
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
        btn.innerText = "🛑 Parar"; btn.style.backgroundColor = "#dc2626"; sintetizadorLeitor.cancel();
        let txt = "Módulo de Catálogo de Materiais. " + document.querySelector('.painel-orcamentario-horizontal').innerText;
        let u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; u.rate = 1.0;
        u.onend = () => { if (flagLeitorAtivo) window.alternarLeitorAudio(); };
        sintetizadorLeitor.speak(u);
    } else {
        btn.innerText = "🔊 Leitor"; btn.style.backgroundColor = "#0284c7"; sintetizadorLeitor.cancel();
    }
};
/* erppadrao - materiais/materiais.js - PARTE 2 DE 4 */
window.carregarPreDefinido = function() {
    const s = document.getElementById('seletor_modelo').value;
    if (!s) return;

    // BANCO DE DADOS EXPANDIDO: 14 INSUMOS INDUSTRIAIS CORINGA ψ
    const catalogo = {
        aco_1020: { nome: "Tarugo Redondo Aço Laminado SAE 1020 Ø1.1/2''", sku: "MAT-STEEL-1020-01", um: "kg", custo: "14.50", refugo: "5.0", lt: "3", min: "50.0" },
        aco_1045: { nome: "Barra Retificada Aço Carbono SAE 1045 Ø2''", sku: "MAT-STEEL-1045-02", um: "kg", custo: "19.80", refugo: "4.5", lt: "4", min: "40.0" },
        aco_inox: { nome: "Chapa de Aço Inoxidável AISI 304 Escovada 2mm", sku: "MAT-SS-304-2MM", um: "kg", custo: "38.20", refugo: "8.0", lt: "7", min: "15.0" },
        ferro_fundido: { nome: "Bloco Prismático Ferro Fundido Cinzento FC-250", sku: "MAT-IRON-FC250", um: "unidade", custo: "145.00", refugo: "2.0", lt: "5", min: "10.0" },
        aluminio_6061: { nome: "Chapa Alumínio Naval/Aeronáutico 6061-T6 5mm", sku: "MAT-ALU-6061-5MM", um: "kg", custo: "44.50", refugo: "6.0", lt: "6", min: "25.0" },
        bronze_tm23: { nome: "Tarugo Bronze Comercial Perfilado TM-23 Ø1''", sku: "MAT-BRONZE-TM23", um: "kg", custo: "78.00", refugo: "3.0", lt: "10", min: "12.0" },
        cobre_eletro: { nome: "Barra Chat de Cobre Eletrolítico Puro 99.9%", sku: "MAT-COPPER-ELET", um: "kg", custo: "62.50", refugo: "1.5", lt: "8", min: "20.0" },
        nylon_66: { nome: "Tarugo Cilíndrico Nylon 6.6 Técnico Natural Ø50mm", sku: "MAT-NYLON-66", um: "kg", custo: "32.00", refugo: "5.0", lt: "4", min: "15.0" },
        acrilico_trans: { nome: "Chapa Acrílico Cristal Puro Cast 4mm", sku: "MAT-ACRY-CAST4", um: "unidade", custo: "198.00", refugo: "10.0", lt: "5", min: "8.0" },
        pvc_cinza: { nome: "Placa PVC Rígido Prensado Cinza Industrial 10mm", sku: "MAT-PVC-IND10", um: "unidade", custo: "112.50", refugo: "4.0", lt: "3", min: "12.0" },
        fluido_corte: { nome: "Óleo Solúvel Semi-Sintético Protetor Galão 20L", sku: "CON-CUT-OIL-20L", um: "litro", custo: "18.20", refugo: "0.5", lt: "2", min: "60.0" },
        argonio_mnt: { nome: "Cilindro Recarga Gás Argônio Puro Industrial 10m³", sku: "CON-ARGON-10M3", um: "litro", custo: "48.50", refugo: "1.0", lt: "2", min: "30.0" },
        eletrodo_7018: { nome: "Caixa de Eletrodo Revestido AWS E7018 3.25mm", sku: "CON-WELD-E7018", um: "unidade", custo: "85.00", refugo: "12.0", lt: "3", min: "15.0" },
        resina_epoxi: { nome: "Kit Resina Epóxi de Alta Fluidez + Endurecedor 5kg", sku: "CON-EPOXY-5KG", um: "unidade", custo: "245.00", refugo: "2.5", lt: "4", min: "6.0" }
    };

    const m = catalogo[s];
    if (m) {
        document.getElementById('nome_material').value = m.nome;
        document.getElementById('codigo_sku').value = m.sku;
        document.getElementById('unidade_medida').value = m.um;
        document.getElementById('custo_base').value = m.custo;
        document.getElementById('taxa_refugo').value = m.refugo;
        document.getElementById('lead_time').value = m.lt;
        document.getElementById('estoque_minimo').value = m.min;
    }
    window.calcularCustoTotalMaterial();
};
/* erppadrao - materiais/materiais.js - PARTE 3 DE 4 */
window.calcularCustoTotalMaterial = function() {
    const cb = parseFloat(document.getElementById('custo_base').value) || 0;
    const ref = parseFloat(document.getElementById('taxa_refugo').value) || 0;
    const c_tot = cb * (1 + (ref / 100));
    const inp = document.getElementById('custo_total_integrado');
    if (inp) inp.value = c_tot.toFixed(2);
};

window.carregarDadosIniciais = async function() {
    try {
        const res = await fetch('/api/financeiro/metricas?dept=materiais');
        if (!res.ok) throw new Error("Erro de ponte.");
        const m = await res.json();
        
        const resMat = await fetch('/api/materiais/listar');
        const lista = await resMat.json();
        
        let custoTotalInventario = 0;
        let custoVariavelSetorRefugo = 0;
        if (lista && lista.length > 0) {
            lista.forEach(x => {
                const cb = parseFloat(x.custo_base || 0);
                const ref = parseFloat(x.taxa_refugo || 0);
                custoTotalInventario += cb;
                custoVariavelSetorRefugo += (cb * (ref / 100));
            });
        }

        const capitalTotalEmpresa = 5000000.00;
        const disponivelParaSetor = 2000000.00;
        const saldoRestanteVerba = disponivelParaSetor - custoTotalInventario;
        let pctTeto = (custoTotalInventario / disponivelParaSetor) * 100;

        const custoFixoGeralAluguel = 21350.00;
        const custoFixoAlmoxarifado = 14500.00; 
        const totalCustosFixosAcumulados = custoFixoGeralAluguel + custoFixoAlmoxarifado;
        const totalCustosVariaveisAcumulados = custoVariavelSetorRefugo;

        const totalGeralCustosMensais = totalCustosFixosAcumulados + totalCustosVariaveisAcumulados;
        const denCusto = totalGeralCustosMensais || 1; const denFixo = totalCustosFixosAcumulados || 1; const denVar = totalCustosVariaveisAcumulados || 1;

        const pFixG_Tot = (totalCustosFixosAcumulados / denCusto) * 100; const pFixG_Nat = (totalCustosFixosAcumulados / denFixo) * 100;
        const pFixS_Tot = (custoFixoAlmoxarifado / denCusto) * 100; const pFixS_Nat = (custoFixoAlmoxarifado / denFixo) * 100;
        const pVarG_Tot = (totalCustosVariaveisAcumulados / denCusto) * 100; const pVarG_Nat = (totalCustosVariaveisAcumulados / denVar) * 100;
        const pVarS_Tot = (custoVariavelSetorRefugo / denCusto) * 100; const pVarS_Nat = (custoVariavelSetorRefugo / denVar) * 100;

        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR')}`;
        if(document.getElementById('top_disponivel_setor')) document.getElementById('top_disponivel_setor').innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR')}`;
        if(document.getElementById('top_orcamento_inicial')) document.getElementById('top_orcamento_inicial').innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR')}`;
        if(document.getElementById('top_patrimonio_maquinas')) document.getElementById('top_patrimonio_maquinas').innerText = `R$ ${custoTotalInventario.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        if(document.getElementById('top_custo_fixo')) document.getElementById('top_custo_fixo').innerText = `R$ ${totalCustosFixosAcumulados.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_fixo_setor')) document.getElementById('top_custo_fixo_setor').innerText = `R$ ${custoFixoAlmoxarifado.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_variavel')) document.getElementById('top_custo_variavel').innerText = `R$ ${totalCustosVariaveisAcumulados.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        if(document.getElementById('top_custo_variavel_setor')) document.getElementById('top_custo_variavel_setor').innerText = `R$ ${custoVariavelSetorRefugo.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

        if(document.getElementById('pct_disponivel_setor')) document.getElementById('pct_disponivel_setor').innerText = `➔ 40.00% do Cap.`;
        if(document.getElementById('pct_orcamento_inicial')) document.getElementById('pct_orcamento_inicial').innerText = `➔ 40.00% do Cap.`;
        if(document.getElementById('pct_saldo_suprimentos')) document.getElementById('pct_saldo_suprimentos').innerText = `➔ ${(saldoRestanteVerba/capitalTotalEmpresa*100).toFixed(2)}% do Cap.`;
        if(document.getElementById('pct_patrimonio_maquinas')) document.getElementById('pct_patrimonio_maquinas').innerText = `➔ ${(custoTotalInventario/capitalTotalEmpresa*100).toFixed(2)}% do Cap.`;

        if(document.getElementById('pct_custo_fixo_geral')) document.getElementById('pct_custo_fixo_geral').innerText = `➔ Custos Totais: ${pFixG_Tot.toFixed(1)}% | Custos Fixos: ${pFixG_Nat.toFixed(1)}%`;
        if(document.getElementById('pct_custo_fixo_setor')) document.getElementById('pct_custo_fixo_setor').innerText = `➔ Custos Totais: ${pFixS_Tot.toFixed(1)}% | Custos Fixos: ${pFixS_Nat.toFixed(1)}%`;
        if(document.getElementById('pct_custo_variavel_geral')) document.getElementById('pct_custo_variavel_geral').innerText = `➔ Custos Totais: ${pVarG_Tot.toFixed(1)}% | Custos Variáveis: ${pVarG_Nat.toFixed(1)}%`;
        if(document.getElementById('pct_custo_variavel_setor')) document.getElementById('pct_custo_variavel_setor').innerText = `➔ Custos Totais: ${pVarS_Tot.toFixed(1)}% | Custos Variáveis: ${pVarS_Nat.toFixed(1)}%`;

        if(document.getElementById('txt_valores_limite')) document.getElementById('txt_valores_limite').innerText = `R$ ${custoTotalInventario.toLocaleString('pt-BR')} / R$ ${disponivelParaSetor.toLocaleString('pt-BR')}`;
        if(document.getElementById('txt_porcentagem_budget')) document.getElementById('txt_porcentagem_budget').innerText = `${pctTeto.toFixed(1)}% do teto consumido`;
        if(document.getElementById('barra_progresso_budget')) document.getElementById('barra_progresso_budget').style.width = `${Math.min(pctTeto, 100)}%`;

        const card = document.getElementById('card_budget_limite'); const bar = document.getElementById('barra_progresso_budget');
        if (card && bar) { card.style.backgroundColor = (custoTotalInventario > disponivelParaSetor) ? "#fef2f2" : "#ffffff"; bar.style.backgroundColor = (custoTotalInventario > disponivelParaSetor) ? "#ef4444" : "#3b82f6"; }

        window.renderizarTabelaMateriais(lista);
    } catch (e) { console.error(e); }
};
/* erppadrao - materiais/materiais.js - PARTE 4 DE 4 */
window.renderizarTabelaMateriais = function(lista) {
    const tbody = document.getElementById('tabela_materiais'); if (!tbody) return;
    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum insumo produtivo homologado no Supabase.</td></tr>`; return;
    }
    tbody.innerHTML = lista.map(x => `
        <tr>
            <td><strong>${x.nome_material}</strong><br><small style="font-family: monospace; color:#64748b;">SKU: ${x.codigo_sku}</small></td>
            <td>Unidade: ${x.unidade_medida} | Perda: ${x.taxa_refugo}%</td>
            <td>Prazo: <strong>${x.lead_time} dias</strong><br><small>Segurança: ${x.estoque_minimo}</small></td>
            <td style="font-family: monospace; font-weight: bold; color: #1e3a8a;">R$ ${parseFloat(x.custo_base * (1 + (x.taxa_refugo/100))).toFixed(2)}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button type="button" onclick="window.editarMaterial(${x.id})" class="btn-top" style="background-color: #fffbef; color: #b45309;">Editar</button>
                <button type="button" onclick="window.deletarMaterial(${x.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626;">Remover</button>
            </td>
        </tr>
    `).join('');
    window.calcularCustoTotalMaterial(); window.mudarFonte(0);
};

window.salvarMaterial = async function(e) {
    if(e && e.preventDefault) e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        codigo_sku: document.getElementById('codigo_sku').value,
        unidade_medida: document.getElementById('unidade_medida').value,
        custo_base: parseFloat(document.getElementById('custo_base').value) || 0,
        taxa_refugo: parseFloat(document.getElementById('taxa_refugo').value) || 0,
        lead_time: parseInt(document.getElementById('lead_time').value) || 0,
        estoque_minimo: parseFloat(document.getElementById('estoque_minimo').value) || 0
    };
    try {
        const res = await fetch('/api/materiais/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
        if (res.ok) { window.limparFormularioMaterial(); window.carregarDadosIniciais(); alert("🎯 Material homologado!"); }
        else { alert("❌ Estouro de saldo em suprimentos."); }
    } catch (err) { alert("❌ Servidor offline."); }
};

window.editarMaterial = async function(id) {
    try {
        const res = await fetch(`/api/materiais/buscar/${id}`); const x = await res.json();
        document.getElementById('registro_id').value = x.id;
        document.getElementById('nome_material').value = x.nome_material;
        document.getElementById('codigo_sku').value = x.codigo_sku;
        document.getElementById('unidade_medida').value = x.unidade_medida;
        document.getElementById('custo_base').value = x.custo_base;
        document.getElementById('taxa_refugo').value = x.taxa_refugo;
        document.getElementById('lead_time').value = x.lead_time;
        document.getElementById('estoque_minimo').value = x.estoque_minimo;
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Insumo";
        if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'inline-block';
        window.calcularCustoTotalMaterial();
    } catch (e) { alert("❌ Erro."); }
};

window.deletarMaterial = async function(id) {
    if(!confirm('Remover este material do catálogo mestre?')) return;
    try {
        const res = await fetch(`/api/materiais/deletar/${id}`, { method: 'DELETE' });
        if (res.ok) { window.carregarDadosIniciais(); alert("🎯 Baixa realizada."); }
    } catch (e) { alert("❌ Erro."); }
};

window.limparFormularioMaterial = function() {
    const f = document.getElementById('formMaterial'); if (f) f.reset();
    if (document.getElementById('registro_id')) document.getElementById('registro_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Homologar Material no Catálogo";
    if (document.getElementById('btn_cancelar')) document.getElementById('btn_cancelar').style.display = 'none';
    window.calcularCustoTotalMaterial();
};

window.carregarDadosIniciais();
