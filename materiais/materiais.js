// erppadrao - materiais/materiais.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

document.addEventListener("DOMContentLoaded", function() {
    carregarDadosIniciais();
    calcularTotalInsumo();
});

function mudarFonte(dir) {
    tamanhoFonteAtual += dir;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}
function alternarModoEscuro() { document.body.classList.toggle('dark-mode'); }
function alternarAltoContraste() { document.body.classList.toggle('alto-contraste'); }
function alternarMenuMobile() { document.getElementById('menuNavegacao').classList.toggle('hidden'); }

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO PARA APRESENTAÇÃO (SEM DEPÊNDENCIA DE MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const texto = `Cockpit de Almoxarifado aberto. Utilize o formulário de Entrada de Insumos à esquerda para gerenciar o estoque de matérias-primas e a classificação ABC, ou audite as quantidades estocadas na tabela à direita.`;
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

function calcularTotalInsumo() {
    const quantidade = parseFloat(document.getElementById('quantidade_estoque').value) || 0;
    const precoUnitario = parseFloat(document.getElementById('preco_unitario').value) || 0;
    
    // Regra matemática didática: Qtd * Preço Unitário
    const total = quantidade * precoUnitario;
    
    document.getElementById('valor_total_lote').value = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}
async function carregarDadosIniciais() {
    // Atualiza a barra de indicadores financeiros superiores com base no budget do almoxarifado
    const resMetricas = await fetch('/api/financeiro/metricas?dept=materiais');
    const metricas = await resMetricas.json();
    
    document.getElementById('top_capital_total').innerText = `R$ ${metricas.capital_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_giro_global').innerText = `R$ ${metricas.capital_disponivel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_custo_fixo').innerText = `R$ ${metricas.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
    
    const verbaDisponivelSetor = metricas.capital_disponivel_departamento || 0;
    const pctDoCapital = ((verbaDisponivelSetor / (metricas.capital_total || 1)) * 100).toFixed(2);
    document.getElementById('top_verba_reais').innerText = `R$ ${verbaDisponivelSetor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('top_verba_porcentagem').innerText = `${pctDoCapital}% do Capital`;

    // Carrega o inventário de matérias-primas salvas no Supabase
    const resMateriais = await fetch('/api/materiais/listar');
    const materiais = await resMateriais.json();
    const tbody = document.getElementById('tabela_materiais');
    
    // Calcula o valor total imobilizado em estoque para alimentar a quarta métrica do topo
    let totalImobilizadoEstoque = 0;
    materiais.forEach(m => { totalImobilizadoEstoque += (m.quantidade_estoque * m.preco_unitario); });
    document.getElementById('top_custo_variavel').innerText = `R$ ${totalImobilizadoEstoque.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    if(materiais.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">Nenhum insumo estocado no Supabase para este grupo.</td></tr>`;
        return;
    }

    tbody.innerHTML = materiais.map(m => {
        const custoTotalMaterial = (m.quantidade_estoque || 0) * (m.preco_unitario || 0);
        // Destaque visual pedagógico para a Curva ABC
        const corClasse = m.classe_abc === 'A' ? 'bg-red-100 text-red-800' : m.classe_abc === 'B' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';
        
        return `
        <tr class="hover:bg-gray-50 border-b text-[11px]">
            <td class="p-3"><strong>${m.nome_material}</strong><br><span class="text-gray-400">Unidade: ${m.unidade_medida}</span></td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${corClasse}">Classe ${m.classe_abc}</span></td>
            <td class="p-3 font-mono">Qtd: ${m.quantidade_estoque}<br><span class="text-gray-400 text-[10px]">Segurança: ${m.estoque_seguranca}</span></td>
            <td class="p-3 font-mono font-bold text-blue-900">R$ ${custoTotalMaterial.toFixed(2)}</td>
            <td class="p-3 text-center whitespace-nowrap actions-legal">
                <button onclick="editarMaterial(${m.id})" class="bg-amber-50 text-amber-700 font-bold border px-2 py-0.5 rounded text-[10px]">Editar</button>
                <button onclick="deletarMaterial(${m.id})" class="bg-red-50 text-red-700 font-bold border px-2 py-0.5 rounded text-[10px]">Baixar</button>
            </td>
        </tr>`
    }).join('');
}

async function salvarMaterial(e) {
    e.preventDefault();
    const dados = {
        id: document.getElementById('registro_id').value ? parseInt(document.getElementById('registro_id').value) : null,
        nome_material: document.getElementById('nome_material').value,
        unidade_medida: document.getElementById('unidade_medida').value,
        classe_abc: document.getElementById('classe_abc').value,
        quantidade_estoque: parseFloat(document.getElementById('quantidade_estoque').value) || 0,
        preco_unitario: parseFloat(document.getElementById('preco_unitario').value) || 0,
        estoque_seguranca: parseFloat(document.getElementById('estoque_seguranca').value) || 0,
        fornecedor_nome: document.getElementById('fornecedor_nome').value
    };

    await fetch('/api/materiais/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    limparFormularioMateriais();
    carregarDadosIniciais();
}

async function editarMaterial(id) {
    const res = await fetch(`/api/materiais/buscar/${id}`);
    const m = await res.json();
    
    document.getElementById('registro_id').value = m.id;
    document.getElementById('nome_material').value = m.nome_material;
    document.getElementById('unidade_medida').value = m.unidade_medida;
    document.getElementById('classe_abc').value = m.classe_abc;
    document.getElementById('quantidade_estoque').value = m.quantidade_estoque;
    document.getElementById('preco_unitario').value = m.preco_unitario;
    document.getElementById('estoque_seguranca').value = m.estoque_seguranca;
    document.getElementById('fornecedor_nome').value = m.fornecedor_nome;
    
    calcularTotalInsumo();
    document.getElementById('btn_salvar').innerText = "🔄 Atualizar Lote";
    document.getElementById('btn_cancelar').classList.remove('hidden');
}

async function deletarMaterial(id) {
    if(!confirm('Deseja realizar a baixa física deste insumo no almoxarifado corporativo?')) return;
    await fetch(`/api/materiais/deletar/${id}`, { method: 'DELETE' });
    carregarDadosIniciais();
}

function limparFormularioMateriais() {
    document.getElementById('formMaterial').reset();
    document.getElementById('registro_id').value = '';
    document.getElementById('btn_salvar').innerText = "🛒 Comprar e Estocar";
    document.getElementById('btn_cancelar').classList.add('hidden');
    document.getElementById('valor_total_lote').value = '';
}
