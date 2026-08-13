// estrutura/estrutura.js - PARTE 1
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() { 
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) {
        btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
    }
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
    }
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Página de investimentos imobiliários aberta. Analise o formulário de alocação de espaço físico à esquerda e a tabela de simulações ativas no banco de dados à direita para calcular sua estrutura de custos fixos.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

async function carregarDadosIniciais() {
    try {
        // Busca informações de capital e preenche as métricas do topo do painel
        const resMetricas = await fetch('/api/financeiro/metricas?dept=estrutura');
        if (!resMetricas.ok) throw new Error("Erro ao buscar métricas financeiras.");
        const metricas = await resMetricas.json();
        
        document.getElementById('top_capital_total').innerText = `R$ ${(metricas.capital_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_giro_global').innerText = `R$ ${(metricas.capital_disponivel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('top_custo_fixo').innerText = `R$ ${(metricas.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        document.getElementById('top_custo_variavel').innerText = `R$ ${(metricas.custo_valiavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        
        document.getElementById('nome_grupo_display').value = metricas.nome_empresa || "EQUIPE LOGADA";

        // Puxa e alimenta a tabela lateral direita via AJAX
        const resImoveis = await fetch('/api/estrutura/imoveis');
        const imoveis = await resImoveis.json();
        const tbody = document.getElementById('tabela_imoveis');
        if (!tbody) return;
        
        if (!imoveis || imoveis.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">Nenhum espaço alocado no Supabase para este grupo.</td></tr>`;
            return;
        }

        // 🔥 CORREÇÃO DE COLUNA: i.nome_grupo alterado para i.nome_empresa para casar com a query
        tbody.innerHTML = imoveis.map(i => `
            <tr>
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
    } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
    }
}
// estrutura/estrutura.js - PARTE 2

async function salvarImovel(e) {
    e.preventDefault();
    
    // Reseta caixa de erro se houver
    const msgErroDiv = document.getElementById('msg_erro');
    if (msgErroDiv) { msgErroDiv.style.display = 'none'; }
    
    const dados = {
        id: document.getElementById('imovel_id').value ? parseInt(document.getElementById('imovel_id').value) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('regiao').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        obs_contrato: document.getElementById('obs_contrato').value
    };

    try {
        const res = await fetch('/api/estrutura/imoveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        const r = await res.json();
        if (res.ok && r.status === 'sucesso') {
            limparFormularioImobiliario();
            carregarDadosIniciais();
        } else {
            alert("❌ Erro ao registrar contrato: " + (r.message || "Verifique as permissões de rede."));
        }
    } catch (err) {
        console.error(err);
        alert("❌ Erro de comunicação com o servidor Supabase.");
    }
}

async function editarImovel(id) {
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`);
        if (!res.ok) throw new Error("Registro não localizado.");
        const i = await res.json();
        
        document.getElementById('imovel_id').value = i.id;
        document.getElementById('tipo_imovel').value = i.tipo_imovel;
        document.getElementById('regiao').value = i.regiao;
        document.getElementById('area_util').value = i.area_util;
        document.getElementById('valor_aluguel').value = i.valor_aluguel;
        document.getElementById('valor_condominio').value = i.valor_condominio;
        document.getElementById('obs_contrato').value = i.obs_contrato || '';
        
        document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato";
        
        // 🔥 CORREÇÃO DE EXIBIÇÃO: Troca de classList utilitária por display nativo
        const btnCancel = document.getElementById('btn_cancelar');
        if (btnCancel) { btnCancel.style.display = 'inline-block'; }
    } catch (err) {
        console.error(err);
        alert("❌ Falha ao recuperar ficha de contrato para edição.");
    }
}

async function deletarImovel(id) {
    if (!confirm('Confirmar a rescisão legal do contrato imobiliário? A verba aluguel sairá do custo fixo.')) return;
    try {
        const res = await fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' });
        if (res.ok) {
            carregarDadosIniciais();
        } else {
            alert("❌ Falha ao processar rescisão legal.");
        }
    } catch (err) {
        console.error(err);
        alert("❌ Erro de conexão ao tentar deletar.");
    }
}

function limparFormularioImobiliario() {
    const form = document.getElementById('formImobiliario');
    if (form) form.reset();
    
    document.getElementById('imovel_id').value = '';
    document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato";
    
    // 🔥 CORREÇÃO DE EXIBIÇÃO: Ocultação nativa do botão cancelar
    const btnCancel = document.getElementById('btn_cancelar');
    if (btnCancel) { btnCancel.style.display = 'none'; }
}
