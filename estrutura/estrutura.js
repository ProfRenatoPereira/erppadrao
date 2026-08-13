// estrutura/estrutura.js - PARTE 1
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
    
    // Vincula os gatilhos de cálculo automático aos campos de entrada
    document.getElementById('cidade')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('bairro')?.addEventListener('change', calcularPrecoMercadoRefletido);
    document.getElementById('area_util')?.addEventListener('input', calcularPrecoMercadoRefletido);
});

// 🔥 CORREÇÃO DE ESCOPO: Sintoniza os métodos perfeitamente com os botões de acessibilidade
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
    if (btn) btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Módulo de investimentos imobiliários aberto. Utilize os seletores de região de Curitiba para simular os custos e firmar contratos de locação.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
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
    
    if (cidade === "Curitiba") {
        if (bairro === "Centro") precoM2 = 30.00;
        else if (bairro === "Boqueirão") precoM2 = 25.00;
        else if (bairro === "CIC") precoM2 = 23.50;
    } else if (cidade === "São José dos Pinhais" || city === "Araucária" || cidade === "Pinhais") {
        precoM2 = 21.00; // Áreas industriais estratégicas da RMC
    }
    
    const valorAluguelMensal = area * precoM2;
    const taxaAnualEstimada = area * 4.50; // IPTU e taxas coletadas por estimativa ao ano
    
    const inputAluguel = document.getElementById('valor_aluguel');
    const inputTaxaAnual = document.getElementById('taxa_anual');
    
    if (inputAluguel) inputAluguel.value = valorAluguelMensal.toFixed(2);
    if (inputTaxaAnual) inputTaxaAnual.value = taxaAnualEstimada.toFixed(2);
}
// estrutura/estrutura.js - PARTE 2

async function carregarDadosIniciais() {
    try {
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Erro de comunicação.");
        const metricas = await resMetricas.json();
        
        document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_giro_global').innerText = `R$ ${(metricas.capital_disponivel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        document.getElementById('top_custo_variavel').innerText = `R$ ${(metricas.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        document.getElementById('nome_grupo_display').value = metricas.nome_empresa || "EQUIPE LOGADA";

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
                    <button onclick="editarImovel(${i.id})" class="btn-top" style="background-color: #fffbef; color: #b45309; border-color: #fef3c7; margin-right: 2px;">Editar</button>
                    <button onclick="deletarImovel(${i.id})" class="btn-top" style="background-color: #fef2f2; color: #dc2626; border-color: #fee2e2;">Rescindir</button>
                </td>
            </tr>
        `).join('');
        
        calcularPrecoMercadoRefletido();
    } catch (err) {
        console.error("Erro na carga inicial:", err);
    }
}

async function salvarImovel(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: "Taxa Anual Prevista: R$ " + document.getElementById('taxa_anual').value
    };

    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (res.ok) {
            limparFormularioImobiliario();
            carregarDadosIniciais();
        }
    } catch (err) { console.error(err); }
}

async function editarImovel(id) {
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        const i = await res.json();
        
        document.getElementById('imovel_id').value = i.id;
        document.getElementById('tipo_imovel').value = i.tipo_imovel;
        document.getElementById('area_util').value = i.area_util;
        document.getElementById('valor_aluguel').value = i.valor_aluguel;
        document.getElementById('valor_condominio').value = i.valor_condominio;
        document.getElementById('obs_contrato').value = i.obs_contrato || '';
        
        if (i.regiao && i.regiao.includes(" - ")) {
            const partes = i.regiao.split(" - ");
            document.getElementById('cidade').value = partes[0];
            document.getElementById('bairro').value = partes[1];
        }
        
        document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato";
        
        // 🔥 CORREÇÃO VISUAL NATIVA: Exibição baseada em regras sem dependências de frameworks
        const btnCancel = document.getElementById('btn_cancelar');
        if (btnCancel) btnCancel.style.display = 'inline-block';
    } catch (err) { console.error(err); }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar a rescisão legal do contrato imobiliário? A verba sairá do custo fixo.')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) carregarDadosIniciais();
    } catch (err) { console.error(err); }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    
    document.getElementById('imovel_id').value = '';
    document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
    
    const btnCancel = document.getElementById('btn_cancelar');
    if (btnCancel) btnCancel.style.display = 'none';
    
    calcularPrecoMercadoRefletido();
}
