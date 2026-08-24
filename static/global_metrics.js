/* ==========================================================================
   TERADMAS ERP v2.6 - JS MASTER (global_metrics.js)
   PARTE 1 DE 2 - CONTROLE DE DIRETRIZES OPERACIONAIS E DIRETÓRIO DE TETOS ELÁSTICOS
   ========================================================================== */

/**
 * Motor central de governança financeira global da simulação.
 * Analisa as regras de negócio de margens limites e elasticidade de verba.
 */
const CONFIG_GLOBAL_EMPRESA = {
    capitalSocial: 5000000.00,
    tetoPadraoSetorPercentual: 0.20,   // 20% padrão para a maioria dos setores
    tetoElasticoSetorPercentual: 0.40, // 40% elástico exclusivo para Ativos Imobiliários e Máquinas
    classeAlertaEstouro: "estouro-teto-critico"
};

/**
 * Avalia dinamicamente o path/caminho atual da URL para determinar se o teto
 * deve ser expandido de forma elástica de 20% para 40% (Teto: R$ 2.000.000,00).
 * @returns {number} O percentual máximo permitido para o setor atual
 */
function obterLimiteElasticidadeSetor() {
    const urlAtual = window.location.pathname;
    
    // Inspeciona se a rota do ecossistema pertence ao Módulo 02 (Imobiliário) ou Máquinas
    if (urlAtual.includes('estrutura') || urlAtual.includes('maquinas')) {
        console.log("⚙️ [MASTER LÓGICA]: Módulo de Alta Imobilização de Capital detectado. Chaveando verba limite elástica para 40%.");
        return CONFIG_GLOBAL_EMPRESA.tetoElasticoSetorPercentual;
    }
    
    return CONFIG_GLOBAL_EMPRESA.tetoPadraoSetorPercentual;
}

/**
 * Retorna o valor nominal em Reais do teto financeiro calculado.
 * @returns {number} Limite máximo nominal (R$)
 */
function calcularValorMaximoSetor() {
    const percentualTeto = obterLimiteElasticidadeSetor();
    return CONFIG_GLOBAL_EMPRESA.capitalSocial * percentualTeto;
}
/* ==========================================================================
   TERADMAS ERP v2.6 - JS MASTER (global_metrics.js)
   PARTE 2 DE 2 - INTERCEPTOR DE CONTROLE ORÇAMENTÁRIO E VINCULAÇÃO GLOBAL
   ========================================================================== */

/**
 * Audita e valida as operações de compra ou alocação antes do envio ao Supabase.
 * Previne estouros ilegais na interface que violem as travas pedagógicas do sistema.
 * @param {number} custoAtualSetor Somatório atualizado dos custos do departamento
 * @param {number} novoCustoPretendido O valor da nova operação que se deseja realizar
 * @returns {object} Objeto contendo o status de validação e a margem de segurança
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
        porcentagemConsumo: Math.min(100, Math.max(0, aderenciaConsumidaPercentual))
    };
}

/**
 * Força o recarregamento em cascata das métricas em painéis que compartilham o Topboard.
 * Utilizado de forma assíncrona após mutações de inserção ou deleção de ativos.
 */
function forcarAtualizacaoMetricasTopboard() {
    console.log("🔄 [MASTER EVENTO]: Disparando recálculo assíncrono síncrono nos painéis compartilhados...");
    
    // Gatilho de fallback para acionar a atualização nos arquivos locais do cliente
    if (typeof window.carregarDadosIniciais === 'function') {
        window.carregarDadosIniciais();
    } else if (typeof window.executarCalculoLocacaoReativa === 'function') {
        window.executarCalculoLocacaoReativa();
    }
}

// Vinculação explícita à árvore window global para acessibilidade irrestrita inter-módulos
window.globalConfigEmpresa = CONFIG_GLOBAL_EMPRESA;
window.obterLimiteElasticidadeSetor = obterLimiteElasticidadeSetor;
window.calcularValorMaximoSetor = calcularValorMaximoSetor;
window.auditarMargemSegurancaSetor = auditarMargemSegurancaSetor;
window.forcarAtualizacaoMetricasTopboard = forcarAtualizacaoMetricasTopboard;

console.log("✅ [TERADMAS MASTER JS]: global_metrics.js carregado e barramento transacional operacional.");
