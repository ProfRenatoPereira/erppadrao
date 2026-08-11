// erppadrao - roi/roi.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;
let capitalInvestidoGlobal = 100000; // Fallback didático
let lucroLiquidoGlobal = 0;

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
        const texto = `Módulo de Análise de ROI aberto. Verifique os indicadores de retorno e tempo de payback estruturados no topo, ou simule novas metas financeiras.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else { window.speechSynthesis.cancel(); }
}

async function carregarDadosIniciais() {
    // 1. Coleta a apuração financeira cruzada do backend do erppadrao
    const resMetricas = await fetch('/api/financeiro/metricas?dept=roi');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    // 2. Extrai dados cruzados de faturamento e compras para computar o ROI Real
    const resApuracao = await fetch('/api/roi/apurar');
    const apuracao = await resApuracao.json();

    capitalInvestidoGlobal = apuracao.total_investimentos || 100000;
    lucroLiquidoGlobal = apuracao.lucro_liquido || 0;
    const receitaBruta = apuracao.receita_bruta || 0;

    // Fórmula Tradicional de ROI: (Lucro Líquido / Investimento) * 100
    const roiReal = (lucroLiquidoGlobal / capitalInvestidoGlobal) * 100;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquidoGlobal / receitaBruta) * 100 : 0;

    // Fórmula de Payback Didático (Meses para recuperar o capital): Investimento / Lucro Mensal Estimado
    const paybackMeses = lucroLiquidoGlobal > 0 ? (capitalInvestidoGlobal / (lucroLiquidoGlobal / 12)).toFixed(1) : "Infinito";

    document.getElementById('top_roi_pct').innerText = `${roiReal.toFixed(2)}%`;
    document.getElementById('top_lucro_liquido').innerText = `R$ ${lucroLiquidoGlobal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_margem_liquida').innerText = `Margem: ${margemLiquida.toFixed(1)}%`;
    document.getElementById('top_total_investido').innerText = `R$ ${capitalInvestidoGlobal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_payback_tempo').innerText = `${paybackMeses} meses`;

    document.getElementById('roi_meta_pct').oninput = calcularMetaReceitaExigidaInLoco;
    document.getElementById('roi_provisao_investimento').oninput = calcularMetaReceitaExigidaInLoco;

    calcularMetaReceitaExigidaInLoco();
    carregarTabelaMetasROI();
}

function calcularMetaReceitaExigidaInLoco() {
    const metaRoi = parseFloat(document.getElementById('roi_meta_pct').value) || 0;
    const provisao = parseFloat(document.getElementById('roi_provisao_investimento').value) || 0;
    
    const investimentoProjetado = capitalInvestidoGlobal + provisao;
    // Fórmula de Projeção Econômica: Lucro Requerido = Investimento * % Meta de ROI
    const lucroRequerido = investimentoProjetado * (metaRoi / 100);
    
    // Estima faturamento assumindo uma margem líquida didática padrão de 20%
    const faturamentoEstimadoExigido = lucroRequerido / 0.20;

    document.getElementById('roi_receita_exigida_display').value = `R$ ${faturamentoEstimadoExigido.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

async function carregarTabelaMetasROI() {
    const res = await fetch('/api/roi/listar');
    const metas = await res.json();
    const tbody = document.getElementById('tabela_roi');

    if (metas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum planejamento de ROI homologado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = metas.map(m => `
        <tr class="hover:bg-gray-50 border-b text-[11px] font-mono">
            <td class="p-3 font-sans"><strong>${m.data_registro}</strong></td>
            <td>R$ ${m.investimento_base.toFixed(2)}</td>
            <td class="font-bold text-blue-900">${m.roi_meta_pct}% Alvo</td>
            <td class="font-bold text-emerald-600">R$ ${m.faturamento_requerido.toFixed(2)}</td>
            <td class="p-3 text-center actions-legal">
                <button onclick="removerMetaROI(${m.id})" class="bg-red-50 text-red-700 border px-2 py-0.5 rounded text-[10px] font-bold uppercase">Remover</button>
            </td>
        </tr>`).join('');
}

async function salvarMetaROI(e) {
    e.preventDefault();
    const metaRoi = parseFloat(document.getElementById('roi_meta_pct').value) || 0;
    const provisao = parseFloat(document.getElementById('roi_provisao_investimento').value) || 0;
    const textoReceita = document.getElementById('roi_receita_exigida_display').value.replace('R$ ', '').replace(/\./g, '').replace(',', '.');

    const dados = {
        investimento_base: capitalInvestidoGlobal + provisao,
        roi_meta_pct: metaRoi,
        faturamento_requerido: parseFloat(textoReceita) || 0
    };

    await fetch('/api/roi/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    document.getElementById('formROI').reset();
    carregarDadosIniciais();
}

async function removerMetaROI(id) {
    if(!confirm('Deseja retirar este planejamento do livro de metas de viabilidade econômica?')) return;
    await fetch(`/api/roi/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}
