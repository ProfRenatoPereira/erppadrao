/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 02: JS CLIENT (estrutura.js)
   PARTE 1 DE 3 - CONSTANTES DA RMC, TABELAS DE APOIO E CONTROLE WCAG
   ========================================================================== */

let tamanhoFonteAtual = 16;
let leitorAtivo = false;

// 🗺️ MATRIZ LOCAÇÃO RMC: Dicionário geográfico oficial com taxas de Cap Rate e reajustes por IGPM
const MATRIZ_LOCACAO_RMC = {
    "Curitiba": { valor_m2: 32.50, condominio_base: 350.00, cap_rate: 0.0055, igpm: 0.0425 },
    "São José dos Pinhais": { valor_m2: 24.00, condominio_base: 280.00, cap_rate: 0.0048, igpm: 0.0425 },
    "Pinhais": { valor_m2: 26.50, condominio_base: 300.00, cap_rate: 0.0052, igpm: 0.0425 },
    "Araucária": { valor_m2: 22.00, condominio_base: 250.00, cap_rate: 0.0045, igpm: 0.0425 },
    "Campo Largo": { valor_m2: 19.50, condominio_base: 220.00, cap_rate: 0.0042, igpm: 0.0425 }
};

// 👥 TABELA DE SALÁRIOS: Parâmetros salariais oficiais de apoio predial industrial
const TABELA_SALARIOS_AQUECIMENTO = {
    "Gerente de Infraestrutura": 8500.00,
    "Supervisor Predial": 5200.00,
    "Técnico de Manutenção Industrial": 3800.00,
    "Operador de Utilidades": 2900.00,
    "Auxiliar de Serviços Gerais / Portaria": 2100.00
};

document.addEventListener("DOMContentLoaded", function() {
    // Inicialização da malha de dados e tabelas do banco de dados Supabase
    carregarDadosIniciais();
    configurarGatilhosImobiliarios();
    configurarGatilhosApoioPredial();
    
    // Configura o evento de clique no botão do leitor oficial unificado
    document.getElementById('btn-leitor')?.addEventListener('click', alternarLeitorAudio);
});

function configurarGatilhosImobiliarios() {
    const inputs = ['area_util', 'cidade', 'bairro', 'valor_condominio', 'reserva_propria'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoLocacaoReativa);
            elemento.addEventListener('change', executarCalculoLocacaoReativa);
        }
    });
}

function configurarGatilhosApoioPredial() {
    const inputs = ['cargo_suporte', 'qtd_colaboradores'];
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.addEventListener('input', executarCalculoFolhaReativa);
            elemento.addEventListener('change', executarCalculoFolhaReativa);
        }
    });
}

// 📐 MOTOR DE REDIMENSIONAMENTO DE FONTE (ACESSIBILIDADE FORÇADA)
function alterarFonte(operacao) {
    if (operacao === '+') {
        tamanhoFonteAtual += 1;
    } else if (operacao === '-') {
        tamanhoFonteAtual -= 1;
    }
    
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
    
    const elementos = document.querySelectorAll("p, label, input, select, th, td, h1, h2, h3, h4, span, button, a");
    elementos.forEach(el => {
        el.style.setProperty('font-size', (tamanhoFonteAtual - 3) + 'px', 'important');
    });
}

function mudarFonte(dir) {
    alterarFonte(dir > 0 ? '+' : '-');
}

function alternarModoEscuro() { 
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
}

function alternarAltoContraste() { 
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor');
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "📢 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#007bff";
    }
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de investimentos imobiliários aberto. Utilize os seletores de região da Região Metropolitana de Curitiba para simular os custos e firmar contratos de locação.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        
        utterance.onend = function() {
            leitorAtivo = false;
            if (btn) {
                btn.innerText = "📢 Ativar Leitor";
                btn.style.backgroundColor = "#007bff";
            }
        };
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 02: JS CLIENT (estrutura.js)
   PARTE 2 DE 3 - MOTORES MATEMÁTICOS DE CUSTOS, ENGENHARIA DE ATIVOS E SUCESSÃO DE EVENTOS
   ========================================================================== */

function executarCalculoLocacaoReativa() {
    try {
        const areaUtil = parseFloat(document.getElementById('area_util')?.value) || 0;
        const cidade = document.getElementById('cidade')?.value || "Curitiba";
        const paramCidade = MATRIZ_LOCACAO_RMC[cidade] || MATRIZ_LOCACAO_RMC["Curitiba"];
        
        // 1. Cálculo Base do Aluguel Regionalizado e Taxas Prediais
        const aluguelCalculado = areaUtil * paramCidade.valor_m2;
        const condominioInformado = parseFloat(document.getElementById('valor_condominio')?.value) || paramCidade.condominio_base;
        const taxaAnualCalculada = (aluguelCalculado * 12) + (condominioInformado * 12);
        
        // Sincronização direta e segura em formato numérico puro nos campos correspondentes
        const inputAluguel = document.getElementById('valor_aluguel');
        if (inputAluguel) inputAluguel.value = aluguelCalculado.toFixed(2);
        
        const inputTaxaAnual = document.getElementById('taxa_anual');
        if (inputTaxaAnual) inputTaxaAnual.value = taxaAnualCalculada.toFixed(2);
        
        // 2. Cálculos Econômicos Avançados (Abordagem Didática de Engenharia de Ativos)
        const reservaPropria = parseFloat(document.getElementById('reserva_propria')?.value) || 0;
        const projecaoIgpmAnual = reservaPropria * (1 + paramCidade.igpm); 
        const valorMercadoEstimado = paramCidade.cap_rate > 0 ? aluguelCalculado / paramCidade.cap_rate : 0;
        
        // Amortização — Define o tempo necessário em meses para atingir o valor patrimonial real do imóvel
        const baseAmortizacao = reservaPropria > 0 ? reservaPropria : aluguelCalculado;
        const tempoAmortizacaoMeses = baseAmortizacao > 0 ? Math.ceil(valorMercadoEstimado / baseAmortizacao) : 0;
        const capRateMensalPercentual = paramCidade.cap_rate * 100;

        // Injeção de textos informativos síncronos nas labels dinâmicas inferiores
        atualizarTextoElemento('txt_igpm_correcao', "R$ " + projecaoIgpmAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        atualizarTextoElemento('txt_valor_mercado_real', "R$ " + valorMercadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        atualizarTextoElemento('txt_tempo_meses', tempoAmortizacaoMeses + " meses");
        atualizarTextoElemento('txt_taxa_capitalizacao', capRateMensalPercentual.toFixed(2) + "% a.m.");

    } catch (erro) {
        console.error("Erro no processamento matemático patrimonial: ", erro);
    }
}

function calcularPrecoMercadoRefletido() {
    executarCalculoLocacaoReativa();
}

function calcularPreviaSalario() {
    executarCalculoFolhaReativa();
}

function executarCalculoFolhaReativa() {
    try {
        const selectCargo = document.getElementById('cargo_suporte');
        const cargo = selectCargo?.value || "";
        const quantidade = parseInt(document.getElementById('qtd_colaboradores')?.value) || 1;
        
        // Recuperação síncrona do salário com fallback baseado na option selecionada
        let salarioBase = TABELA_SALARIOS_AQUECIMENTO[cargo] || 0.00;
        if (salarioBase === 0 && selectCargo && selectCargo.selectedIndex >= 0) {
            const option = selectCargo.options[selectCargo.selectedIndex];
            salarioBase = parseFloat(option.getAttribute('data-salario')) || 0;
        }
        
        // Multiplicação reativa pelo encargo patronal padrão do sistema (fator de 1.68)
        const fEncargos = 1.68;
        const custoPreviaFolha = salarioBase * quantidade * fEncargos;
        
        const inputPrevia = document.getElementById('previa_salario');
        if (inputPrevia) {
            inputPrevia.value = custoPreviaFolha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    } catch (erro) {
        console.error("Erro no motor de folha predial: ", erro);
    }
}

function atualizarTextoElemento(id, texto) {
    const el = document.getElementById(id);
    if (el) el.innerText = texto;
}

function calcularEngenhariaPatrimonial() {
    executarCalculoLocacaoReativa();
}

window.calcularEngenhariaPatrimonial = executarCalculoLocacaoReativa;
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 02: JS CLIENT (estrutura.js)
   PARTE 3A - CONSUMO ASSÍNCRONO DA API E DISTRIBUIÇÃO CORPORATIVA DE METRICAS
   ========================================================================== */

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Falha na comunicação de rede com as métricas.");
        const metricas = await resMetricas.json();
        
        const capitalInicial = 5000000.00;
        const budgetMaximoSetor = capitalInicial * 0.40; 
        const gastoSetor = metricas.custo_fixo_total || 0; 
        const custoFixoGeralEmpresa = metricas.custo_fixo_geral_empresa || 21350.00;
        
        // Sincroniza a matriz horizontal superior unificada de 5 KPIs
        if(document.getElementById('top_capital_total')) document.getElementById('top_capital_total').innerText = capitalInicial.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-patrimonio-total')) document.getElementById('kpi-patrimonio-total').innerText = gastoSetor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-teto-ativos')) document.getElementById('kpi-teto-ativos').innerText = `Limite Máx 40%: R$ ${budgetMaximoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        if(document.getElementById('kpi-custo-fixo-total')) document.getElementById('kpi-custo-fixo-total').innerText = `Total: ` + custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if(document.getElementById('kpi-custo-fixo-setor')) document.getElementById('kpi-custo-fixo-setor').innerText = `Do Setor: R$ ${gastoSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        // Sincroniza o sexto quadro rosa corporativo de fechamento no rodapé
        if(document.getElementById('fechamento_custo_fixo_generico')) {
            document.getElementById('fechamento_custo_fixo_generico').innerText = custoFixoGeralEmpresa.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + "/mês";
        }
        
        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = metricas.nome_empresa || "EQUIPE LOGADA";

        let porcFixo = custoFixoGeralEmpresa > 0 ? (gastoSetor / custoFixoGeralEmpresa) * 100 : 0;
        let porcBudget = budgetMaximoSetor > 0 ? (gastoSetor / budgetMaximoSetor) * 100 : 0;
        porcBudget = Math.min(100, Math.max(0, porcBudget));

        if(document.getElementById('txt_proporcao_global_empresa')) {
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Proporção deste Setor frente à Empresa: ${porcFixo.toFixed(2)}% do impacto fixo global`;
        }
        
        // Atualização reativa da barra de progresso elástica do limite de 40%
        const barraProgresso = document.getElementById('barra-limite-setor');
        const txtPorcentagem = document.getElementById('txt_porcentagem_budget');
        const cardBudget = document.getElementById('card_budget_limite');
        
        if (barraProgresso) barraProgresso.style.width = `${porcBudget}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${porcBudget.toFixed(1)}% do teto consumido`;
        
        if (barraProgresso) {
            if (gastoSetor > budgetMaximoSetor) {
                if (cardBudget) cardBudget.style.backgroundColor = "#fef2f2";
                if (cardBudget) cardBudget.style.borderColor = "#fca5a5";
                barraProgresso.style.backgroundColor = "#ef4444"; 
            } else {
                if (cardBudget) cardBudget.style.backgroundColor = "#f8fafc";
                if (cardBudget) cardBudget.style.borderColor = "#cbd5e1";
                barraProgresso.style.backgroundColor = "#3b82f6"; 
            }
        }

        await carregarTabelaImoveis();
        await carregarTabelaColaboradores();
    } catch (err) { console.error("Erro na carga inicial do ecossistema:", err); }
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 02: JS CLIENT (estrutura.js)
   PARTE 3B - RENDERIZAÇÃO DE TABELAS E COMPROMISSO DE CONTRATOS ASSÍNCRONOS
   ========================================================================== */

async function carregarTabelaImoveis() {
    try {
        const resImoveis = await fetch('/api/estrutura/imoveis');
        const imoveis = await resImoveis.json();
        const tbody = document.getElementById('tabela_imoveis');
        if (!tbody) return;
        
        if (!imoveis || imoveis.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">Nenhum espaço alocado no Supabase para este grupo.</td></tr>`;
            return;
        }

        tbody.innerHTML = imoveis.map(i => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 900; color: #1e3a8a;">${i.nome_empresa}</td>
                <td><strong>${i.tipo_imovel}</strong><br><span style="font-size: 11px; color: #94a3b8;">${i.regiao}</span></td>
                <td style="font-family: monospace; font-weight: bold;">${i.area_util} m²</td>
                <td style="color: #1e3a8a; font-weight: 800;">R$ ${(i.valor_aluguel || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="editarImovel(${i.id})" class="btn-top" style="background-color: #fffbec; color: #b45309; border-color: #fde68a; margin-right: 2px;">Editar</button>
                    <button type="button" onclick="deletarImovel(${i.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Rescindir</button>
                </td>
            </tr>
        `).join('');
        
        executarCalculoLocacaoReativa();
        if (typeof alterarFonte === "function") alterarFonte('');
    } catch (err) { console.error("Erro ao processar malha imobiliária Supabase:", err); }
}

async function carregarTabelaColaboradores() {
    try {
        const res = await fetch('/api/estrutura/rh');
        const colaboradores = await res.json();
        const tbody = document.getElementById('tabela_colaboradores');
        if (!tbody) return;
        
        if (!colaboradores || colaboradores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-weight: bold;">MÁSCARA ZERO: Nenhum colaborador alocado neste setor.</td></tr>`;
            return;
        }

        tbody.innerHTML = colaboradores.map(c => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 700; color: #334155;">👷 ${c.nome || 'Colaborador Fictício'}</td>
                <td style="font-weight: bold; color: #475569;">${c.cargo}</td>
                <td>R$ ${(c.salario_base || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center; font-weight: bold;">${c.quantidade}</td>
                <td style="color: #4338ca; font-weight: bold;">R$ ${(c.subtotal || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deletarColaborador(${c.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2; font-size:10px;">Demitir</button>
                </td>
            </tr>
        `).join('');
        
        if (typeof alterarFonte === "function") alterarFonte('');
    } catch (err) { console.error("Erro ao renderizar quadro de RH fixo:", err); }
}

async function salvarImovel(e) {
    if(e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btn_salvar');
    if (btn) btn.disabled = true;

    const dados = {
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: "Taxa Anual Prevista: R$ " + (document.getElementById('taxa_anual')?.value || "0.00")
    };

    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            limparFormularioImobiliario();
            await carregarDadosIniciais();
            alert("🎯 Contrato de alocação processado e salvo!");
        } else {
            alert("⚠️ Falha na gravação. Verifique a aderência orçamentária.");
        }
    } catch (err) { console.error("Erro ao enviar transação imobiliária:", err); }
    finally { if (btn) btn.disabled = false; }
}
/* ==========================================================================
   TERADMAS ERP v2.6 - MÓDULO 02: JS CLIENT (estrutura.js)
   PARTE 3C - CADASTRO DE RECURSOS HUMANOS, EDIÇÃO INDIVIDUAL E RESCISÕES
   ========================================================================== */

async function adicionarColaborador(e) {
    if(e && e.preventDefault) e.preventDefault();
    const select = document.getElementById('cargo_suporte');
    const option = select.options[select.selectedIndex];
    
    const dados = {
        nome: document.getElementById('rh_nome')?.value || "Colaborador Fictício",
        cargo: select.value,
        salario_base: parseFloat(option.getAttribute('data-salario')) || 0,
        quantidade: parseInt(document.getElementById('qtd_colaboradores').value) || 0
    };

    try {
        const res = await fetch('/api/estrutura/rh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            document.getElementById('formContratacaoPredial').reset();
            if (document.getElementById('previa_salario')) document.getElementById('previa_salario').value = "R$ 0,00";
            await carregarDadosIniciais();
            alert("🎯 Colaborador adicionado à folha fixa do setor!");
        }
    } catch (err) { console.error("Erro ao processar mutabilidade de RH fixa:", err); }
}

async function editarImovel(id) {
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        const i = await res.json();
        
        document.getElementById('imovel_id').value = i.id;
        document.getElementById('tipo_imovel').value = i.tipo_imovel;
        document.getElementById('area_util').value = i.area_util;
        document.getElementById('valor_condominio').value = i.valor_condominio;
        
        if (i.regiao && i.regiao.includes(" - ")) {
            const partes = i.regiao.split(" - ");
            if (document.getElementById('cidade')) document.getElementById('cidade').value = partes[0];
            if (document.getElementById('bairro')) document.getElementById('bairro').value = partes[1];
        }
        
        if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato Ativo";
        executarCalculoLocacaoReativa();
    } catch (err) { console.error("Erro ao recuperar registro para edição:", err); }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar a rescisão legal do contrato imobiliário?')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarDadosIniciais();
            alert("🎯 Contrato rescindido com sucesso.");
        }
    } catch (err) { console.error("Erro ao executar rescisão no banco:", err); }
}

async function deletarColaborador(id) {
    if (!confirm('Confirmar a demissão do colaborador do suporte predial?')) return;
    try {
        const res = await fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarDadosIniciais();
            alert("🎯 Colaborador desligado da folha fixa.");
        }
    } catch (err) { console.error("Erro ao remover colaborador do banco:", err); }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    if (document.getElementById('imovel_id')) document.getElementById('imovel_id').value = '';
    if (document.getElementById('btn_salvar')) document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
}
