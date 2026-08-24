/* ==========================================================================
   TERADMAS ERP v2.6 - JS MASTER (global_metrics.js)
   PARTE 1 DE 2 - CONTROLE DINÂMICO DE DIRETRIZES SEM RETRABALHO
   ========================================================================== */

/**
 * Parâmetros padrão e fallbacks locais do ecossistema de simulação.
 * Protege a renderização da interface caso a comunicação assíncrona sofra atrasos.
 */
const CONFIG_GLOBAL_EMPRESA = {
    capitalSocial: 5000000.00,
    limitesDinamicos: {
        "estrutura": 40.0, // Fallback elástico de 40% para Engenharia Imobiliária
        "maquinas": 40.0,  // Fallback elástico de 40% para Engenharia de Ativos
        "materiais": 20.0, // Fallback padrão de 20% para Almoxarifado
        "outros": 20.0
    }
};

/**
 * Sincroniza e puxa as porcentagens fixadas pela mesa de alta administração.
 * Alimenta a memória em segundo plano de forma transparente para as rotas filhas.
 */
async function sincronizarLimitesAdministrativos() {
    try {
        const response = await fetch('/api/financeiro/limites/setor');
        if (response.ok) {
            const limitesBd = await response.json();
            // Sobrescreve as chaves do dicionário com os tetos ajustados pelos estudantes
            Object.assign(CONFIG_GLOBAL_EMPRESA.limitesDinamicos, limitesBd);
            console.log("🎯 [MASTER CONFIG]: Tetos pedagógicos atualizados via painel financeiro.");
        }
    } catch (err) {
        console.warn("Aviso: Falha de conexão. Mantendo diretrizes de teto padrões.", err);
    }
}

/**
 * Inspeciona o caminho atual da rota do ecossistema para classificar o setor operante.
 * @returns {number} O percentual máximo decimal autorizado para o departamento atual
 */
function obterLimiteElasticidadeSetor() {
    const urlAtual = window.location.pathname;
    let chaveSetor = "outros";
    
    // Identificação por comportamento de URL para manter compatibilidade absoluta com os módulos
    if (urlAtual.includes('estrutura')) {
        chaveSetor = "estrutura";
    } else if (urlAtual.includes('maquinas')) {
        chaveSetor = "maquinas";
    } else if (urlAtual.includes('materiais')) {
        chaveSetor = "materials";
    }
    
    const porcentagemFracionada = CONFIG_GLOBAL_EMPRESA.limitesDinamicos[chaveSetor] || CONFIG_GLOBAL_EMPRESA.limitesDinamicos["outros"];
    
    // Converte de inteiro (ex: 40) para formato decimal multiplicador (ex: 0.40)
    return porcentagemFracionada / 100;
}

/**
 * Calcula o valor nominal do teto em Reais (R$) baseado no capital total da empresa.
 * @returns {number} Limite monetário de segurança
 */
function calcularValorMaximoSetor() {
    const percentualTeto = obterLimiteElasticidadeSetor();
    return CONFIG_GLOBAL_EMPRESA.capitalSocial * percentualTeto;
}

// Inicializa a sincronização imediata assim que a malha de script é acoplada
sincronizarLimitesAdministrativos();
/* ==========================================================================
   TERADMAS ERP v2.6 - JS MASTER (global_metrics.js)
   PARTE 2 DE 2 - INTERCEPTOR DE CONTROLE ORÇAMENTÁRIO E GATILHOS TOPBOARD
   ========================================================================== */

/**
 * Intercepta e audita as solicitações de transações de compra antes do envio ao Supabase.
 * Fornece métricas de conformidade pedagógica imediatas para o cliente.
 * @param {number} custoAtualSetor Patrimônio ou despesa acumulada na tela atual
 * @param {number} novoCustoPretendido O valor monetário da transação que se deseja executar
 * @returns {object} Relatório de aderência aos limites administrativos de capital
 */
function auditarMargemSegurancaSetor(custoAtualSetor, novoCustoPretendido = 0) {
    const limiteNominalMaximo = calcularValorMaximoSetor();
    const impactoProjetado = custoAtualSetor + novoCustoPretendido;
    const aderenciaConsumidaPercentual = (impactoProjetado / limiteNominalMaximo) * 100;
    
    const operacaoAutorizada = impactoProjetado <= limiteNominalMaximo;
    const saldoDisponivelElasticidade = limiteNominalMaximo - impactoProjetado;

    return {
        autorizado: operacaoAutorizada,
        tetoMaximoSetor: limiteNominalMaximo,
        custoProjetado: impactoProjetado,
        saldoRestante: saldoDisponivelElasticidade,
        porcentagemConsumo: Math.min(100, Math.max(0, Gold = aderenciaConsumidaPercentual))
    };
}

/**
 * Executa o recarregamento das métricas em cascata e força a reatividade dos cards em tela.
 * Evita o crash do navegador eliminando a necessidade de dar refresh completo na página.
 */
function forcarAtualizacaoMetricasTopboard() {
    console.log("🔄 [MASTER EVENTO]: Atualizando barramentos de dados entre módulos...");
    
    // Varre e executa os fallbacks síncronos dos scripts locais ativos na sessão
    if (typeof window.carregarDadosIniciais === 'function') {
        window.carregarDadosIniciais();
    } else if (typeof window.executarCalculoLocacaoReativa === 'function') {
        window.executarCalculoLocacaoReativa();
    }
}

// Garante o binding global amarrando todas as rotinas operacionais à window do navegador
window.globalConfigEmpresa = CONFIG_GLOBAL_EMPRESA;
window.obterLimiteElasticidadeSetor = obterLimiteElasticidadeSetor;
window.calcularValorMaximoSetor = calcularValorMaximoSetor;
window.auditarMargemSegurancaSetor = auditarMargemSegurancaSetor;
window.forcarAtualizacaoMetricasTopboard = forcarAtualizacaoMetricasTopboard;

console.log("✅ [TERADMAS MASTER JS]: global_metrics.js unificado e sincronizado com a Alta Administração.");
