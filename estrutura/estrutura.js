// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 1 DE 3 (INICIALIZAÇÃO E CONTROLE DE SESSÃO)
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
    console.log("[ERP] Inicializando motor de Alocação de Espaço e Custos...");
    verificarSessaoEIniciar();
});

function verificarSessaoEIniciar() {
    // Consulta qual equipe está autenticada no servidor do Render
    fetch('/api/auth/sessao_atual')
        .then(response => {
            if (!response.ok) {
                console.error("[ERP] Sessão inválida ou expirada. Redirecionando para login...");
                window.location.href = '/login';
                return;
            }
            return response.json();
        })
        .then(dadosSessao => {
            if (!dadosSessao) return;
            
            console.log("[ERP] Conectado com sucesso à equipe:", dadosSessao.id_equipe);
            
            // Injeta dinamicamente o nome correto da Empresa/Grupo logado na tela
            const inputGrupo = document.getElementById("grupo_empresa") || 
                               document.querySelector('input[readonly]') || 
                               document.querySelector('input[value*="DIDÁTICO"]');
            if (inputGrupo) {
                inputGrupo.value = dadosSessao.nome_empresa;
                inputGrupo.style.backgroundColor = "#e8f0fe"; // Identificador visual de validação
            }

            // Executa as chamadas ao banco de dados de forma síncrona/encadeada
            carregarKPIs();
            carregarTabelasDados();
        })
        .catch(err => console.error("[ERP] Falha crítica de comunicação com o servidor:", err));
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 2 DE 3 (MOTORES DE CONSULTA E REQUISIÇÕES)
// ==========================================================================

function carregarKPIs() {
    // Linha 28 Corrigida - Agora mapeia com sucesso a rota de compatibilidade
    fetch('/api/estrutura/kpis')
        .then(res => {
            if (!res.ok) throw new Error("Erro na rota de KPIs");
            return res.json();
        })
        .then(kpis => {
            console.log("[ERP] Matriz de KPIs carregada com sucesso.");
            
            // Mapeamento opcional para injeção nos cards visuais superiores
            const cardAluguel = document.getElementById("kpi_aluguel_total");
            if (cardAluguel) cardAluguel.innerText = "R$ " + kpis.aluguel_total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            
            const cardCondo = document.getElementById("kpi_condominio_total");
            if (cardCondo) cardCondo.innerText = "R$ " + kpis.condominio_total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        })
        .catch(e => console.error("[ERP] Erro ao carregar os cards de KPI:", e));
}

function carregarTabelasDados() {
    console.log("[ERP] Buscando linhas de registros salvos no Supabase...");
    
    // 1. Busca Contratos Imobiliários Simulados
    fetch('/api/estrutura/imoveis')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_imoveis", lista, ["tipo_imovel", "regiao", "area_util", "valor_aluguel"]))
        .catch(e => console.error("[ERP] Erro ao processar tabela de imóveis:", e));

    // 2. Busca Equipamentos alocados na Estrutura
    fetch('/api/estrutura/maquinas')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_maquinas", lista, ["nome_equipamento", "potencia_watts", "custo_minuto_maquina"]))
        .catch(e => console.error("[ERP] Erro ao processar tabela de máquinas:", e));

    // 3. Busca Folha de Apoio e Suporte (RH)
    fetch('/api/estrutura/rh')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_rh", lista, ["nome", "cargo", "salario_base", "subtotal"]))
        .catch(e => console.error("[ERP] Erro ao processar tabela de RH:", e));
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 3 DE 3 (RENDERIZAÇÃO DINÂMICA DE TABELAS)
// ==========================================================================

function renderizarTabelaGenerica(idTabela, dados, colunas) {
    const tabela = document.getElementById(idTabela) || document.querySelector(`.${idTabela}`);
    if (!tabela) {
        console.warn(`[ERP] Tabela ou Container '${idTabela}' não localizado na árvore DOM.`);
        return;
    }
    
    // Localiza ou assume o elemento tbody interno para montagem limpa das linhas
    let tbody = tabela.getElementsByTagName('tbody')[0];
    if (!tbody) tbody = tabela; 
    
    tbody.innerHTML = ""; // Limpa os skeletons ou placeholders antigos

    if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colunas.length + 1}" style="text-align: center; color: #888; padding: 15px;">Nenhum registro encontrado para esta equipe no banco de dados.</td></tr>`;
        return;
    }

    // Varre a matriz de objetos montando a árvore de elementos html reativos
    dados.forEach(item => {
        const tr = document.createElement("tr");
        
        colunas.forEach(col => {
            const td = document.createElement("td");
            let valor = item[col] !== undefined ? item[col] : "-";
            
            // Tratamento amigável e formatação para dados monetários
            if (typeof valor === "number" && (col.includes("valor") || col.includes("salario") || col.includes("subtotal"))) {
                valor = "R$ " + valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            }
            
            td.innerText = valor;
            tr.appendChild(td);
        });

        // Adiciona coluna com botão padrão de deleção / ações se aplicável
        const tdAcoes = document.createElement("td");
        tdAcoes.innerHTML = `<button class="btn-deletar-erp" onclick="executarRemocaoRegistro('${idTabela}', ${item.id})" style="color: red; cursor: pointer; background: none; border: none;">❌ Deletar</button>`;
        tr.appendChild(tdAcoes);

        tbody.appendChild(tr);
    });
    
    console.log(`[ERP] Sucesso: ${dados.length} linhas sincronizadas no componente '${idTabela}'.`);
}

function executarRemocaoRegistro(origemTabela, idRegistro) {
    if (!confirm("Confirmar a exclusão e atualização imediata do orçamento?")) return;
    
    let rotaEndpoint = "";
    if (origemTabela.includes("imoveis")) rotaEndpoint = "imoveis";
    else if (origemTabela.includes("maquinas")) rotaEndpoint = "maquinas";
    else rotaEndpoint = "rh";

    fetch(`/api/estrutura/${rotaEndpoint}/${idRegistro}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(resposta => {
            if (resposta.status === 'removido' || resposta.status === 'sucesso') {
                alert("Registro excluído com sucesso.");
                verificarSessaoEIniciar(); // Atualiza a tela inteira de forma reativa
            }
        })
        .catch(err => console.error("[ERP] Falha na deleção assíncrona:", err));
}
