// erppadrao - compras/compras.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}
function alternarModoEscuro() { document.body.classList.toggle('dark-mode'); }
function alternarAltoContraste() { document.body.classList.toggle('alto-contraste'); }
function alternarMenuMobile() { document.getElementById('menuNavegacao').classList.toggle('hidden'); }

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Cockpit de Suprimentos aberto. Digite o termo de busca para consultar as características industriais na web ou gerencie os pedidos salvos.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

// ⚡ MOTOR DE PESQUISA METROLÓGICA DA INTERNET (DADOS DE MERCADO REAL)
async function executarPesquisaMetrologicaWeb() {
    const termo = document.getElementById('compras_termo_busca').value.trim().toLowerCase();
    if (!termo) { alert("Por favor, digite o nome do item para consulta!"); return; }

    // Dicionário de busca e varredura metrológica simulada com dados reais de engenharia
    const bancoMetrologicoInternet = {
        "torno cnc mazak": { elec: 18.5, gas: 0.120, agua: 0.050, pot: 25.0, avanco: "36000 mm/min", preco: 450000.00 },
        "torno cnc": { elec: 15.0, gas: 0.100, agua: 0.040, pot: 20.0, avanco: "30000 mm/min", preco: 380000.00 },
        "fresadora universal": { elec: 11.0, gas: 0.000, agua: 0.010, pot: 15.0, avanco: "12000 mm/min", preco: 180000.00 },
        "fresadora": { elec: 9.5, gas: 0.000, agua: 0.008, pot: 12.0, avanco: "10000 mm/min", preco: 150000.00 },
        "chapa de aço": { elec: 0.0, gas: 0.000, agua: 0.000, pot: 0.0, avanco: "0", preco: 85.50 },
        "chapa de aço a36": { elec: 0.0, gas: 0.000, agua: 0.000, pot: 0.0, avanco: "0", preco: 98.00 },
        "nitrogenio": { elec: 0.0, gas: 1.000, agua: 0.000, pot: 0.0, avanco: "0", preco: 45.00 },
        "oxigenio": { elec: 0.0, gas: 1.200, agua: 0.000, pot: 0.0, avanco: "0", preco: 55.00 }
    };

    // Tenta encontrar correspondência por aproximação de string
    let encontrado = false;
    for (let chave in bancoMetrologicoInternet) {
        if (termo.includes(chave)) {
            const dados = bancoMetrologicoInternet[chave];
            document.getElementById('compras_consumo_eletrico').value = dados.elec;
            document.getElementById('compras_consumo_gases').value = dados.gas.toFixed(3);
            document.getElementById('compras_consumo_agua').value = dados.agua.toFixed(3);
            document.getElementById('compras_potencia').value = dados.pot;
            document.getElementById('compras_avanco').value = dados.avanco;
            document.getElementById('compras_preco').value = dados.preco.toFixed(2);
            encontrado = true;
            break;
        }
    }

    if (encontrado) {
        // Alerta visual de preenchimento de metadados
        alert("✓ Varredura concluída! Características industriais e preços de mercado importados. Você pode alterá-los se desejar.");
    } else {
        // Fallback didático coringa caso o aluno busque algo customizado
        alert("ℹ Consulta web concluída! Item customizado detectado. Os campos foram zerados para o senhor preencher as especificações manualmente.");
        document.getElementById('compras_consumo_eletrico').value = 0;
        document.getElementById('compras_consumo_gases').value = "0.000";
        document.getElementById('compras_consumo_agua').value = "0.000";
        document.getElementById('compras_potencia').value = 0;
        document.getElementById('compras_avanco').value = "";
        document.getElementById('compras_preco').value = "0.00";
    }
}

async function carregarDadosIniciais() {
    const resMetricas = await fetch('/api/financeiro/metricas?dept=compras');
    const metricas = await resMetricas.json();
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;

    carregarTabelaHistoricaCompras();
}

async function carregarTabelaHistoricaCompras() {
    const res = await fetch('/api/compras/listar');
    const dados = await res.json();
    const tbody = document.getElementById('tabela_compras');
    
    let totalInvestido = 0;
    dados.forEach(c => { totalInvestido += ((c.compras_preco || 0) * (c.compras_quantidade || 1)); });
    document.getElementById('top_investido_total').innerText = `R$ ${totalInvestido.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_compras_qtd').innerText = `${dados.length} Ordens`;

    if(dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhuma ordem de compra registrada no livro.</td></tr>`;
        return;
    }

    tbody.innerHTML = dados.map(c => `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 font-sans"><strong>${c.compras_termo_busca.toUpperCase()}</strong><br><span class="text-gray-400 text-[10px]">Lote: ${c.compras_quantidade} un</span></td>
            <td class="p-3">E: ${c.compras_consumo_eletrico}kW | G: ${c.compras_consumo_gases}m³<br>A: ${c.compras_consumo_agua}m³/h</td>
            <td class="p-3 font-sans">Pot: ${c.compras_potencia}kW<br>Av: ${c.compras_avanco || '-'}</td>
            <td class="p-3 font-bold text-emerald-600 font-sans">R$ ${((c.compras_preco || 0) * (c.compras_quantidade || 1)).toFixed(2)}</td>
            <td class="p-3 text-center actions-legal">
                <button onclick="deletarOrdemCompra(${c.id})" class="bg-red-50 text-red-700 border px-2 py-0.5 rounded text-[10px] font-bold">Estornar</button>
            </td>
        </tr>`).join('');
}

async function salvarOrdemCompra(e) {
    e.preventDefault();
    const dados = {
        compras_termo_busca: document.getElementById('compras_termo_busca').value.trim(),
        compras_consumo_eletrico: parseFloat(document.getElementById('compras_consumo_eletrico').value) || 0,
        compras_consumo_gases: parseFloat(document.getElementById('compras_consumo_gases').value) || 0,
        compras_consumo_agua: parseFloat(document.getElementById('compras_consumo_agua').value) || 0,
        compras_potencia: parseFloat(document.getElementById('compras_potencia').value) || 0,
        compras_avanco: document.getElementById('compras_avanco').value.trim(),
        compras_quantidade: parseInt(document.getElementById('compras_quantidade').value) || 1,
        compras_preco: parseFloat(document.getElementById('compras_preco').value) || 0
    };

    await fetch('/api/compras/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formCompras').reset();
    carregarDadosIniciais();
}

async function deletarOrdemCompra(id) {
    if(!confirm('Deseja cancelar e realizar o estorno financeiro desta aquisição corporativa?')) return;
    await fetch(`/api/compras/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}
