// erppadrao - estrutura/estrutura.js - PARTE 1 DE 2
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
    
    // Vincula os gatilhos de cálculo automático aos campos de entrada
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
});

// ⚡ ACESSIBILIDADE: Métodos sincronizados com a Topbar WCAG
function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() { 
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
}

function alternarAltoContraste() { 
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
    }
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de investimentos imobiliários aberto. Utilize os seletores de região de Curitiba para simular os custos e firmar contratos de locação.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        
        utterance.onend = function() {
            leitorAtivo = false;
            if (btn) {
                btn.innerText = "🔊 Ativar Leitor";
                btn.style.backgroundColor = "#0284c7";
            }
        };
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

// 🧠 MOTOR DE INTELIGÊNCIA IMOBILIÁRIA (Cotação real Curitiba e RMC)
function calcularPrecoMercadoRefletido() {
    const cidade = document.getElementById('cidade')?.value;
    const bairro = document.getElementById('bairro')?.value;
    const area = parseFloat(document.getElementById('area_util')?.value) || 0;
    
    if (area <= 0) return;
    
    let precoM2 = 22.00; // Valor padrão para polos logísticos e industriais da RMC
    
    // 🌟 CORREÇÃO DE ESCOPO: city corrigida para cidade para evitar quebras no script
    if (cidade === "Curitiba") {
        if (bairro === "Centro") precoM2 = 30.00;
        else if (bairro === "Boqueirão") precoM2 = 25.00;
        else if (bairro === "CIC") precoM2 = 23.50;
    } else if (cidade === "São José dos Pinhais" || cidade === "Araucária" || cidade === "Pinhais") {
        precoM2 = 21.00; // Áreas industriais estratégicas da RMC
    }
    
    const valorAluguelMensal = area * precoM2;
    const taxaAnualEstimada = area * 4.50; // IPTU e taxas coletadas por estimativa ao ano
    
    const inputAluguel = document.getElementById('valor_aluguel');
    const inputTaxaAnual = document.getElementById('taxa_anual');
    
    if (inputAluguel) inputAluguel.value = valorAluguelMensal.toFixed(2);
    if (inputTaxaAnual) inputTaxaAnual.value = taxaAnualEstimada.toFixed(2);
}
// erppadrao - estrutura/estrutura.js - PARTE 2 DE 2

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Erro de comunicação.");
        const metricas = await resMetricas.json();
        
        document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_giro_global').innerText = `R$ ${(metricas.capital_disponivel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        document.getElementById('top_custo_variavel').innerText = `R$ ${(metricas.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        const inputGrupo = document.getElementById('nome_grupo_display');
        if (inputGrupo) inputGrupo.value = metricas.nome_empresa || "EQUIPE LOGADA";

        const resImoveis = await fetch('/api/estrutura/imoveis');
        const imoveis = await resImoveis.json();
        const tbody = document.getElementById('tabela_imoveis');
        if (!tbody) return;
        
        if (!imoveis || imoveis.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">Nenhum espaço alocado no Supabase para este grupo.</td></tr>`;
            return;
        }

        tbody.innerHTML = imoveis.map(i => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="font-weight: 900; color: #1e3a8a;">${i.nome_empresa}</td>
                <td><strong>${i.tipo_imovel}</strong><br><span style="font-size: 11px; color: #94a3b8;">${i.regiao}</span></td>
                <td style="font-family: monospace;">${i.area_util} m²</td>
                <td style="color: #1e3a8a; font-weight: 800;">R$ ${(i.valor_aluguel || 0).toFixed(2)}</td>
                <td style="text-align: center; white-space: nowrap;" class="actions-legal">
                    <button type="button" onclick="editarImovel(${i.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7; margin-right: 2px;">Editar</button>
                    <button type="button" onclick="deletarImovel(${i.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Rescindir</button>
                </td>
            </tr>
        `).join('');
        
        calcularPrecoMercadoRefletido();
    } catch (err) {
        console.error("Erro na carga inicial:", err);
    }
}

// 💾 FUNÇÃO OPERACIONAL: Persiste ou Atualiza o contrato imobiliário via REST POST
async function salvarImovel(e) {
    e.preventDefault();
    const idReg = document.getElementById('imovel_id').value;
    
    const payload = {
        id: idReg ? parseInt(idReg) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value),
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value),
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: "Contrato firmado via terminal acadêmico."
    };

    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            limparFormularioImobiliario();
            carregarDadosIniciais();
            alert("🎯 Contrato de alocação processado com sucesso!");
        }
    } catch (err) {
        alert("Erro ao tentar salvar o registro no Supabase.");
    }
}

// ✏️ FUNÇÃO OPERACIONAL: Carrega os dados da tabela de volta para o formulário
async function editarImovel(id) {
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        if (!res.ok) return;
        const i = await res.json();
        
        document.getElementById('imovel_id').value = i.id;
        document.getElementById('tipo_imovel').value = i.tipo_imovel;
        document.getElementById('area_util').value = i.area_util;
        document.getElementById('valor_condominio').value = i.valor_condominio;
        
        const partesRegiao = i.regiao.split(" - ");
        if(partesRegiao.length === 2) {
            document.getElementById('cidade').value = partesRegiao[0];
            document.getElementById('bairro').value = partesRegiao[1];
        }
        
        document.getElementById('btn_salvar').innerText = "💾 Atualizar Termos do Contrato";
        document.getElementById('btn_cancelar').style.display = "inline-block";
        calcularPrecoMercadoRefletido();
    } catch(e) {
        console.error("Falha ao recuperar registro individual.");
    }
}

// 🗑️ FUNÇÃO OPERACIONAL: Executa a rescisão e cancelamento do contrato imobiliário
async function deletarImovel(id) {
    if (!confirm("Atenção! Deseja mesmo rescindir este contrato de locação fabril?")) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
            alert("Contrato rescindido com sucesso.");
        }
    } catch(err) {
        alert("Erro ao tentar processar a rescisão.");
    }
}

// 🧹 FUNÇÃO OPERACIONAL: Reseta o estado estático do formulário
function limparFormularioImobiliario() {
    document.getElementById('imovel_id').value = "";
    document.getElementById('formImobiliario').reset();
    document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
    document.getElementById('btn_cancelar').style.display = "none";
    calcularPrecoMercadoRefletido();
}
