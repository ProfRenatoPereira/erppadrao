// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 1 DE 3 (GERENCIAMENTO DE HANDSHAKE DE SESSÃO)
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
    console.log("[ERP] Inicializando motor de Alocação de Espaço e Custos...");
    verificarSessaoEIniciar();
});

function verificarSessaoEIniciar() {
    // 1. Consulta o microsserviço de autenticação no Render para descobrir o token da equipe
    fetch('/api/auth/sessao_atual')
        .then(response => {
            if (!response.ok) {
                console.error("[ERP] Impasse de credenciais na nuvem. Redirecionando para login...");
                window.location.href = '/login';
                return;
            }
            return response.json();
        })
        .then(dadosSessao => {
            if (!dadosSessao) return;
            
            console.log("[ERP] Conectado com sucesso à equipe ativa: " + dadosSessao.id_equipe);
            
            // 2. Injeta reativamente o nome do grupo estudantil no input do formulário
            const inputGrupo = document.getElementById("grupo_empresa");
            if (inputGrupo) {
                inputGrupo.value = dadosSessao.nome_empresa;
                inputGrupo.style.backgroundColor = "#e8f0fe"; // Validação visual azulada
            }

            // 3. Dispara em paralelo o consumo das views e tabelas do Supabase
            carregarKPIs();
            carregarTabelasDados();
        })
        .catch(err => console.error("[ERP] Erro crítico na barreira de handshake:", err));
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 2 DE 3 (CONSUMO E ADIÇÃO DE ARRAYS DATA)
// ==========================================================================

function carregarKPIs() {
    // Rota de Compatibilidade (Evita o erro 404 visto no log)
    fetch('/api/estrutura/kpis')
        .then(res => {
            if (!res.ok) throw new Error("Falha no payload de KPIs");
            return res.json();
        })
        .then(kpis => {
            console.log("[ERP] Matriz de KPIs injetada com sucesso.");
            
            // Injeção opcional de valores formatados nos badges informativos superiores
            const previewProvisao = document.querySelector(".badge-simulacao span");
            if (previewProvisao) {
                const totalCalculado = kpis.aluguel_total + kpis.condominio_total;
                previewProvisao.innerHTML = "Total Corrente: <strong>R$ " + totalCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 2}) + "</strong>";
            }
        })
        .catch(e => console.error("[ERP] Falha no processamento contábil macro:", e));
}

function carregarTabelasDados() {
    console.log("[ERP] Efetuando varredura de tabelas relacionais...");
    
    // Consulta 1: Contratos de Locação de Espaço Físico
    fetch('/api/estrutura/imoveis')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_imoveis", lista, ["tipo_imovel", "regiao", "area_util", "valor_aluguel"]))
        .catch(e => console.error("[ERP] Erro de rede em tabela_imoveis:", e));

    // Consulta 2: Ativos e Equipamentos alocados na planta industrial
    fetch('/api/estrutura/maquinas')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_maquinas", lista, ["nome_equipamento", "potencia_watts", "custo_minuto_maquina"]))
        .catch(e => console.error("[ERP] Erro de rede em tabela_maquinas:", e));

    // Consulta 3: Prestadores e Terceirizados contratados (RH)
    fetch('/api/estrutura/rh')
        .then(res => res.json())
        .then(lista => renderizarTabelaGenerica("tabela_rh", lista, ["nome", "cargo", "salario_base", "subtotal"]))
        .catch(e => console.error("[ERP] Erro de rede em tabela_rh:", e));
}
// ==========================================================================
// TERADMAS ERP v2.6 - MÓDULO 02: IMOBILIÁRIO E CUSTOS FIXOS INDUSTRIAIS
// ARQUIVO: estrutura.js - PARTE 3 DE 3 (CONSTRUTOR REATIVO DE COMPONENTES DOM)
// ==========================================================================

function renderizarTabelaGenerica(idTabela, dados, colunas) {
    const tabelaElemento = document.getElementById(idTabela);
    if (!tabelaElemento) {
        console.warn("[ERP] Abortado: ID '" + idTabela + "' ausente na árvore HTML.");
        return;
    }
    
    // Isola o corpo (tbody) para não corromper o cabeçalho (thead)
    const tbody = tabelaElemento.querySelector("tbody");
    if (!tbody) return;
    
    tbody.innerHTML = ""; // Elimina placeholders de carregamento

    if (!dados || dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colunas.length + 1}" style="text-align: center; color: #777; padding: 12px; font-style: italic;">Nenhum registro associado a este setor no Supabase.</td></tr>`;
        return;
    }

    // Varre as tuplas vindas do PostgreSQL injetando as células textuais
    dados.forEach(registro => {
        const tr = document.createElement("tr");
        
        colunas.forEach(propriedade => {
            const td = document.createElement("td");
            let dadoPuro = registro[propriedade] !== undefined ? registro[propriedade] : "-";
            
            // Formatador dinâmico de moeda em Real Brasileiro para campos financeiros
            if (typeof dadoPuro === "number" && (propriedade.includes("valor") || propriedade.includes("salario") || propriedade.includes("subtotal"))) {
                dadoPuro = "R$ " + dadoPuro.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            }
            // Formatador para áreas em metros quadrados
            if (propriedade.includes("area")) {
                dadoPuro = dadoPuro + " m²";
            }
            
            td.innerText = dadoPuro;
            tr.appendChild(td);
        });

        // Adiciona a célula operacional contendo a chave de rescisão/exclusão (DELETE)
        const tdAcao = document.createElement("td");
        tdAcao.innerHTML = `<button onclick="removerRegistroBanco('${idTabela}', ${registro.id})" style="color: #c00; font-weight: bold; background: none; border: none; cursor: pointer; text-transform: uppercase; font-size: 11px;">❌ Rescindir</button>`;
        tr.appendChild(tdAcao);

        tbody.appendChild(tr);
    });
    
    console.log("[ERP] Sucesso: " + dados.length + " linha(s) injetada(s) em '" + idTabela + "'.");
}

function removerRegistroBanco(identificadorTabela, chavePrimariaID) {
    if (!confirm("Aviso: Esta ação irá excluir definitivamente o registro do Supabase. Prosseguir?")) return;
    
    let subModuloRota = "";
    if (identificadorTabela.includes("imoveis")) subModuloRota = "imoveis";
    else if (identificadorTabela.includes("maquinas")) subModuloRota = "maquinas";
    else subModuloRota = "rh";

    fetch(`/api/estrutura/${subModuloRota}/${chavePrimariaID}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(retorno => {
            if (retorno.status === 'removido' || retorno.status === 'sucesso') {
                console.log("[ERP] Tupla desalocada com sucesso do servidor.");
                verificarSessaoEIniciar(); // Recarrega o grid de tabelas de forma reativa
            } else {
                alert("Erro ao remover registro.");
            }
        })
        .catch(err => console.error("[ERP] Falha na requisição transacional DELETE:", err));
}
