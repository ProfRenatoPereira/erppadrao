/* erppadrao - materiais/materiais.js - PARTE 1 DE 6 */

let escalaFonteGlobal = 16;
let sintetizadorLeitor = window.speechSynthesis;
let flagLeitorAtivo = false;

// ==========================================
// 1. SUBSISTEMA DE ACESSIBILIDADE DE SESSÃO
// ==========================================
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
/* erppadrao - materiais/materiais.js - PARTE 2 DE 6 */

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

// ==========================================
// 2. DICIONÁRIO DE ATIVOS E ENGENHARIA BASE
// ==========================================
window.carregarPreDefinido = function() {
    const s = document.getElementById('seletor_modelo').value;
    if (!s) return;

    const catalogo = {
        aco_1020: {
            sku: "MAT-STEEL-1020-01", nome: "Tarugo de Aço SAE 1020 (Corte)", unidade: "kg", preco: "14.50",
            refugo: "5.0", leadtime: "3", estoque: "50.0", especificacao: "Tarugo Redondo Aço Laminado SAE 1020 Ø1.1/2\""
        },
        aco_1045: {
            sku: "MAT-STEEL-1045-02", nome: "Eixo de Aço SAE 1045 (Usinagem)", unidade: "kg", preco: "18.90",
            refugo: "4.0", leadtime: "5", estoque: "30.0", especificacao: "Barra Desbastada Aço Forjado SAE 1045 Ø2\""
        },
        al_6061: {
            sku: "MAT-ALUM-6061-01", nome: "Chapa de Alumínio 6061-T6", unidade: "kg", preco: "42.30",
            refugo: "8.0", leadtime: "7", estoque: "20.0", especificacao: "Chapa de Alumínio Naval Espessura 1/4\""
        },
        fluido_corte: {
            sku: "MAT-CHEM-FLUID-03", nome: "Óleo Solúvel Semi-Sintético", unidade: "l", preco: "28.50",
            refugo: "2.0", leadtime: "2", estoque: "40.0", especificacao: "Fluido de Corte Concentrado para Usinagem de Metais"
        },
        eletrodo_7018: {
            sku: "MAT-WELD-7018-05", nome: "Eletrodo Revestido AWS E7018", unidade: "kg", preco: "35.00",
            refugo: "12.0", leadtime: "2", estoque: "15.0", especificacao: "Eletrodo para Solda em Aço Carbono Amperagem Alta"
        },
        gas_argon: {
            sku: "MAT-GAS-ARGON-01", nome: "Gás Argônio Industrial (Solda TIG)", unidade: "m3", preco: "85.00",
            refugo: "1.0", leadtime: "4", estoque: "6.0", especificacao: "Cilindro de Argônio Puro 99.9% para Proteção Atmosférica"
        },
        graxa_mnt: {
            sku: "MAT-LUBR-GREASE-02", nome: "Graxa de Lítio Extrema Pressão", unidade: "kg", preco: "45.20",
            refugo: "3.0", leadtime: "3", estoque: "10.0", especificacao: "Graxa Azul para Mancais e Rolamentos de Alta Rotação"
        }
    };
/* erppadrao - materiais/materiais.js - PARTE 3 DE 6 */

    const m = catalogo[s];
    if (m) {
        if(document.getElementById('codigo_sku')) document.getElementById('codigo_sku').value = m.sku;
        if(document.getElementById('nome_material')) document.getElementById('nome_material').value = m.nome;
        if(document.getElementById('unidade_medida')) document.getElementById('unidade_medida').value = m.unidade;
        if(document.getElementById('preco_unitario')) document.getElementById('preco_unitario').value = m.preco;
        if(document.getElementById('coeficiente_refugo')) document.getElementById('coeficiente_refugo').value = m.refugo;
        if(document.getElementById('lead_time_entrega')) document.getElementById('lead_time_entrega').value = m.leadtime;
        if(document.getElementById('estoque_seguranca')) document.getElementById('estoque_seguranca').value = m.estoque;
        if(document.getElementById('especificacao_tecnica')) document.getElementById('especificacao_tecnica').value = m.especificacao;
        
        if(document.getElementById('fornecedor_padrao')) {
            if(m.sku.includes("STEEL") || m.sku.includes("ALUM")) {
                document.getElementById('fornecedor_padrao').value = "Gerdau Comercial Metais S/A";
            } else if(m.sku.includes("GAS")) {
                document.getElementById('fornecedor_padrao').value = "White Martins Gases Industriais";
            } else {
                document.getElementById('fornecedor_padrao').value = "Distribuidora Central de Suprimentos Ltda";
            }
        }
    }
    window.calcularCustoOperacionalMaterial();
};

// ==========================================
// 3. MOTOR DE CÁLCULO E GATILHOS EM TEMPO REAL
// ==========================================
window.calcularCustoOperacionalMaterial = function() {
    const pUn = parseFloat(document.getElementById('preco_unitario')?.value) || 0;
    const ref = parseFloat(document.getElementById('coeficiente_refugo')?.value) || 0;
    const estSeg = parseFloat(document.getElementById('estoque_seguranca')?.value) || 0;
    
    const custoCalculadoBase = pUn * (1 + (ref / 100));
    const custoTotalIntegradoOp = custoCalculadoBase * estSeg;
    
    const inp = document.getElementById('custo_total_integrado');
    if (inp) {
        inp.value = custoTotalIntegradoOp.toFixed(2);
    }
};

window.vincularEventosInputs = function() {
    const ids = ['preco_unitario', 'coeficiente_refugo', 'estoque_seguranca', 'lead_time_entrega'];
    ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.oninput = window.calcularCustoOperacionalMaterial;
    });
};
/* erppadrao - materiais/materiais.js - PARTE 4 DE 6 */

// ==========================================
// 4. INICIALIZAÇÃO DA MATRIZ CONTÁBIL MÁSTER
// ==========================================
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
                custoVariavelMaquinasAcumulado += (((parseFloat(x.consumo_eletrico || 0) * 0.75) / 60) + 
                                                   ((parseFloat(x.consumo_agua || 0) * 6.50) / 60) + 
                                                   ((parseFloat(x.consumo_gases || 0) * 4.80) / 60)) * minMes;
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
        const totalCustosFixosPlanta = custoFixoGeralAluguel + custoFixoMaquinasAcumulado;
        const totalCustosVariveisPlanta = custoVariavelMaquinasAcumulado;
        const totalGeralCustosMensais = totalCustosFixosPlanta + totalCustosVariveisPlanta;

        const denCusto = totalGeralCustosMensais || 1;
        const denFixo = totalCustosFixosPlanta || 1;
        const denVar = totalCustosVariveisPlanta || 1;

        const pFixG_Tot = (totalCustosFixosPlanta / denCusto) * 100;
        const pFixG_Nat = (totalCustosFixosPlanta / denFixo) * 100;
        const pFixS_Tot = (custoFixoMaquinasAcumulado / denCusto) * 100;
        const pFixS_Nat = (custoFixoMaquinasAcumulado / denFixo) * 100;

        const pVarG_Tot = (totalCustosVariveisPlanta / denCusto) * 100;
        const pVarG_Nat = (totalCustosVariveisPlanta / denVar) * 100;
        const pVarS_Tot = (custoVariavelMaquinasAcumulado / denCusto) * 100;
        const pVarS_Nat = (custoVariavelMaquinasAcumulado / denVar) * 100;

        const pctDisponivel = (disponivelParaSetor / capitalTotalEmpresa) * 100;
        const pctOrcamentoIni = (disponivelParaSetor / capitalTotalEmpresa) * 100;
        const pctSaldoSuprimentos = (saldoVerbaSustentada / capitalTotalEmpresa) * 100;
        const pctInventarioDoCap = (valorTotalInventarioGeral / capitalTotalEmpresa) * 100;

        window.atualizarElementosUI(capitalTotalEmpresa, disponivelParaSetor, saldoVerbaSustentada, valorTotalInventarioGeral, totalCustosFixosPlanta, custoFixoMaquinasAcumulado, totalCustosVariveisPlanta, custoVariavelMaquinasAcumulado, pctDisponivel, pctOrcamentoIni, pctSaldoSuprimentos, pctInventarioDoCap, pFixG_Tot, pFixG_Nat, pFixS_Tot, pFixS_Nat, pVarG_Tot, pVarG_Nat, pVarS_Tot, pVarS_Nat, pctTetoConsumidoInsumos);
        window.renderizarTabelaMateriais(materiais);
        window.vincularEventosInputs();
        window.corrigirRodapeOficial();
    } catch (e) { console.error(e); }
};
/* erppadrao - materiais/materiais.js - PARTE 5 DE 6 */

// ==========================================
// 5. ATUALIZAÇÃO DA INTERFACE GRÁFICA (UI)
// ==========================================
window.atualizarElementosUI = function(capitalTotalEmpresa, disponivelParaSetor, saldoVerbaSustentada, valorTotalInventarioGeral, totalCustosFixosPlanta, custoFixoMaquinasAcumulado, totalCustosVariveisPlanta, custoVariavelMaquinasAcumulado, pctDisponivel, pctOrcamentoIni, pctSaldoSuprimentos, pctInventarioDoCap, pFixG_Tot, pFixG_Nat, pFixS_Tot, pFixS_Nat, pVarG_Tot, pVarG_Nat, pVarS_Tot, pVarS_Nat, pctTetoConsumidoInsumos) {
    if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = `R$ ${capitalTotalEmpresa.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if(document.getElementById('top_disponivel_setor')) document.getElementById('top_disponivel_setor').innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if(document.getElementById('top_orcamento_inicial')) document.getElementById('top_orcamento_inicial').innerText = `R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if(document.getElementById('top_verba_reais')) {
        document.getElementById('top_verba_reais').innerText = `R$ ${saldoVerbaSustentada.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_verba_reais').style.color = (saldoVerbaSustentada < 0) ? "#dc2626" : "#166534";
    }

    if(document.getElementById('top_patrimonio_maquinas')) document.getElementById('top_patrimonio_maquinas').innerText = `R$ ${valorTotalInventarioGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if(document.getElementById('top_custo_fixo')) document.getElementById('top_custo_fixo').innerText = `R$ ${totalCustosFixosPlanta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    if(document.getElementById('top_custo_fixo_setor')) document.getElementById('top_custo_fixo_setor').innerText = `R$ ${custoFixoMaquinasAcumulado.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    if(document.getElementById('top_custo_variavel')) document.getElementById('top_custo_variavel').innerText = `R$ ${totalCustosVariveisPlanta.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    if(document.getElementById('top_custo_variavel_setor')) document.getElementById('top_custo_variavel_setor').innerText = `R$ ${custoVariavelMaquinasAcumulado.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    if(document.getElementById('pct_disponivel_setor')) document.getElementById('pct_disponivel_setor').innerText = `➔ ${pctDisponivel.toFixed(2)}% do Cap.`;
    if(document.getElementById('pct_orcamento_inicial')) document.getElementById('pct_orcamento_inicial').innerText = `➔ ${pctOrcamentoIni.toFixed(2)}% do Cap.`;
    if(document.getElementById('pct_saldo_suprimentos')) document.getElementById('pct_saldo_suprimentos').innerText = `➔ ${pctSaldoSuprimentos.toFixed(2)}% do Cap.`;
    if(document.getElementById('pct_patrimonio_maquinas')) document.getElementById('pct_patrimonio_maquinas').innerText = `➔ ${pctInventarioDoCap.toFixed(2)}% do Cap.`;

    if(document.getElementById('pct_custo_fixo_geral')) document.getElementById('pct_custo_fixo_geral').innerText = `➔ Custos Totais: ${pFixG_Tot.toFixed(1)}% | Custos Fixos: ${pFixG_Nat.toFixed(1)}%`;
    if(document.getElementById('pct_custo_fixo_setor')) document.getElementById('pct_custo_fixo_setor').innerText = `➔ Custos Totais: ${pFixS_Tot.toFixed(1)}% | Custos Fixos: ${pFixS_Nat.toFixed(1)}%`;
    if(document.getElementById('pct_custo_variavel_geral')) document.getElementById('pct_custo_variavel_geral').innerText = `➔ Custos Totais: ${pVarG_Tot.toFixed(1)}% | Custos Variáveis: ${pVarG_Nat.toFixed(1)}%`;
    if(document.getElementById('pct_custo_variavel_setor')) document.getElementById('pct_custo_variavel_setor').innerText = `➔ Custos Totais: ${pVarS_Tot.toFixed(1)}% | Custos Variáveis: ${pVarS_Nat.toFixed(1)}%`;

    if(document.getElementById('txt_valores_limite')) document.getElementById('txt_valores_limite').innerText = `R$ ${valorTotalInventarioGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})} / R$ ${disponivelParaSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if(document.getElementById('txt_porcentagem_budget')) document.getElementById('txt_porcentagem_budget').innerText = `${pctTetoConsumidoInsumos.toFixed(1)}% do teto consumido`;
    if(document.getElementById('barra_progresso_budget')) document.getElementById('barra_progresso_budget').style.width = `${Math.min(pctTetoConsumidoInsumos, 100)}%`;

    const card = document.getElementById('card_budget_limite');
    const bar = document.getElementById('barra_progresso_budget');
    if (card && bar) {
        if (valorTotalInventarioGeral > disponivelParaSetor) {
            card.style.backgroundColor = "#fef2f2"; card.style.borderColor = "#fca5a5"; bar.style.backgroundColor = "#ef4444";
        } else {
            card.style.backgroundColor = "#ffffff"; card.style.borderColor = "#cbd5e1"; bar.style.backgroundColor = "#3b82f6";
        }
    }
};
/* erppadrao - materiais/materiais.js - PARTE 6 DE 6 */

// ==========================================
// 6. PERSISTÊNCIA E RENDERIZAÇÃO DO CRUD
// ==========================================
window.renderizarTabelaMateriais = function(materiais) {
    const tbody = document.getElementById('tabela_materiais');
    if (!tbody) return;
    
    if (!materiais || materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum material homologado no Supabase.</td></tr>`;
        return;
    }

    tbody.innerHTML = materiais.map(x => `
        <tr>
            <td><strong>${x.nome_material}</strong><br><small style="color: #64748b;">SKU: ${x.categoria || 'N/A'}</small></td>
            <td>U.M: ${x.unidade_medida} | Refugo: ${x.coeficiente_refugo}%</td>
            <td><strong>${x.fornecedor_padrao}</strong></td>
            <td style="font-family: monospace; font-weight: bold; color: #166534;">R$ ${(x.preco_unitario || 0).toFixed(2)}</td>
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

    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        categoria: document.getElementById('codigo_sku').value,
        unidade_medida: document.getElementById('unidade_medida').value,
        preco_unitario: parseFloat(document.getElementById('preco_unitario').value) || 0,
        coeficiente_refugo: parseFloat(document.getElementById('coeficiente_refugo').value) || 0,
        lead_time_entrega: parseInt(document.getElementById('lead_time_entrega').value) || 0,
        estoque_seguranca: parseFloat(document.getElementById('estoque_seguranca').value) || 0,
        fornecedor_padrao: document.getElementById('fornecedor_padrao').value,
        especificacao_tecnica: document.getElementById('especificacao_tecnica').value
    };

    try {
        const res = await fetch('/api/materiais/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) { 
            window.limparFormularioMaterial(); 
            window.carregarDadosIniciais(); 
            alert("🎯 Material cadastrado!"); 
        } else { 
            alert("❌ Erro na validação central."); 
        }
    } catch (err) { 
        alert("❌ Servidor offline."); 
    }
};

window.editarMaterial = async function(id) {
    try {
        const res = await fetch(`/api/materiais/buscar/${id}`);
        const m = await res.json();
        document.getElementById('registro_id').value = m.id;
        document.getElementById('codigo_sku').value = m.categoria || '';
        document.getElementById('nome_material').value = m.nome_material;
        document.getElementById('unidade_medida').value = m.unidade_medida || 'kg';
        document.getElementById('preco_unitario').value = m.preco_unitario;
        document.getElementById('coeficiente_refugo').value = m.coeficiente_refugo;
        document.getElementById('lead_time_entrega').value = m.lead_time_entrega;
        document.getElementById('estoque_seguranca').value = m.estoque_seguranca;
        document.getElementById('fornecedor_padrao').value = m.fornecedor_padrao || '';
        document.getElementById('especificacao_tecnica').value = m.especificacao_tecnica || '';
        
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
    window.calcularCustoOperacionalMaterial();
};

// ==========================================
// 7. SUBSISTEMA DE CORREÇÃO DO RODAPÉ MÁSTER
// ==========================================
window.corrigirRodapeOficial = function() {
    const r = document.querySelector('footer');
    if (r) {
        r.style.textAlign = "center";
        r.style.borderTop = "2px solid #1e3a8a";
        r.style.padding = "16px 0";
        r.innerHTML = `<p style="text-align: center; font-weight: bold; margin: 0; color: #4b5563;">
            © 2026 TERADMAS ERP v2.6 | Ecossistema Integrado de Planejamento e Controle de Materiais Produtivos. Professor Renato - Todos os direitos reservados.
        </p>`;
    }
};

// Inicialização imediata
window.carregarDadosIniciais();
