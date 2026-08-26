/* ==========================================================================
     TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
        ARQUIVO: estrutura.js - PARTE 1 DE 3 (INICIALIZAÇÃO E SESSÃO)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    // Escuta ativa de eventos de digitação para reatividade imediata nos formulários
    const areaUtil = document.getElementById('area_util');
    const valorCondominio = document.getElementById('valor_condominio');
    const reservaPropria = document.getElementById('reserva_propria');

    if (areaUtil) areaUtil.addEventListener('input', executarCalculoLocacaoReativa);
    if (valorCondominio) valorCondominio.addEventListener('input', executarCalculoLocacaoReativa);
    if (reservaPropria) reservaPropria.addEventListener('input', calcularProjecaoIgpmAnual);
    
    // Inicia os barramentos síncronos e a carga de dados direto do banco master
    sincronizarNomeGrupoSessao();
    recarregarDadosDoServidor();
});

function sincronizarNomeGrupoSessao() {
    fetch('/api/financeiro/metricas?dept=estrutura')
        .then(res => {
            if (!res.ok) throw new Error("Status HTTP inválido");
            return res.json();
        })
        .then(dados => {
            if (dados && dados.nome_empresa) {
                document.getElementById('nome_grupo_display').value = dados.nome_empresa;
            } else {
                document.getElementById('nome_grupo_display').value = "GRUPO ACADÊMICO";
            }
        })
        .catch(err => {
            console.warn("Aviso: Utilizando cache estável para o grupo:", err);
            document.getElementById('nome_grupo_display').value = "GRUPO DIDÁTICO (LOCAL)";
        });
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 2 DE 3 (MOTORES CONTÁBEIS E DASHBOARD)
 * ==========================================================================
 */

function executarCalculoLocacaoReativa() {
    let area = parseFloat(document.getElementById('area_util').value) || 0;
    let condominio = parseFloat(document.getElementById('valor_condominio').value) || 0;
    
    // Regra de negócio matemática estrita: R$ 32,50 fixos por m²
    let aluguelCalculado = area * 32.50; 
    let taxaAnualCalculada = (aluguelCalculado * 12) + condominio;

    document.getElementById('valor_aluguel').value = aluguelCalculado.toFixed(2);
    document.getElementById('taxa_anual').value = taxaAnualCalculada.toFixed(2);

    // Alimenta a Provisão Imóvel Próprio de forma reativa com Aluguel + Condomínio
    let provisaoInicial = aluguelCalculado + condominio;
    document.getElementById('reserva_propria').value = provisaoInicial.toFixed(2);

    // Avaliação trilinear de mercado baseada no Cap Rate padrão de 0.55% a.m.
    let valorMercadoEstimado = aluguelCalculado / 0.0055;
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {maximumFractionDigits:2})}`;

    calcularProjecaoIgpmAnual();
}

function calcularProjecaoIgpmAnual() {
    let reserva = parseFloat(document.getElementById('reserva_propria').value) || 0;
    // Parâmetro de simulação didática fixa: 7.2% de reajuste estimado
    let taxaIgpmEstimada = 0.072;
    let valorCorrigidoProjecao = reserva * (1 + taxaIgpmEstimada);

    document.getElementById('txt_igpm_correcao').innerText = `R$ ${valorCorrigidoProjecao.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    if (!seletor || seletor.selectedIndex === -1) return;
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function recargarEAtualizarPaineisTotais() {
    fetch('/api/financeiro/metricas?dept=estrutura')
        .then(res => {
            if (!res.ok) throw new Error("Erro de comunicação financeira");
            return res.json();
        })
        .then(dados => {
            if (!dados) return;
            
            // Orçamento de Infraestrutura Engenharia
            document.getElementById('kpi-saldo-infra').innerText = `R$ ${(dados.saldo_infraestrutura_setor || 2000000).toLocaleString('pt-BR', {minimumFractionDigits:2})} ➔ ${(((dados.saldo_infraestrutura_setor || 2000000) / 2000000) * 100).toFixed(2)}% Disponível`;
            
            // Controle e Cobertura Patrimonial Ativa
            document.getElementById('kpi-patrimonio-total').innerText = `R$ ${(dados.patrimonio_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            document.getElementById('kpi-teto-ativos').innerText = `Global: R$ ${(dados.patrimonio_ativo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            let tetoMaximoAtivos = (dados.capital_total || 5000000) * 0.40; 
            let percentualConsumoTeto = tetoMaximoAtivos > 0 ? ((dados.patrimonio_ativo_total || 0) / tetoMaximoAtivos) * 100 : 0;
            document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTeto, 100)}%`;
            document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTeto.toFixed(1)}% do teto consumido`;

            // Consolidação de Custos Fixos Correntes (Mensal)
            document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${(dados.custo_fixo_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${(dados.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            let impactoFixo = dados.custo_fixo_total > 0 ? (dados.custo_fixo_isolado_setor / dados.custo_fixo_total) * 100 : 0;
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${impactoFixo.toFixed(2)}% do global`;

            // Estruturação de Custos Variáveis Consolidados
            document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${(dados.custo_variavel_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${(dados.custo_variavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            // Amortização, Cap Rate, Utilidades e Custo Minuto Máquina
            document.getElementById('txt_tempo_meses').innerText = dados.tempo_amortizacao_real || "0 meses";
            document.getElementById('txt_taxa_capitalizacao').innerText = dados.cap_rate_calculado || "0.00% a.m.";
            document.getElementById('lbl_watts_consumidos').innerText = `${(dados.watts_consumidos || 0).toLocaleString('pt-BR')} W`;
            document.getElementById('lbl_gas_consumido').innerText = `${(dados.gas_consumido || 0).toLocaleString('pt-BR')} m³`;
            document.getElementById('lbl_agua_consumida').innerText = `${(dados.agua_consumida || 0).toLocaleString('pt-BR')} m³`;
            document.getElementById('kpi-custo-minuto-total').innerText = `R$ ${(dados.custo_minuto_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/min`;
        }).catch(err => console.error("Erro ao sincronizar barramentos dinâmicos:", err));
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 3 DE 3 (PERSISTÊNCIA E OPERAÇÕES CRUD)
 * ==========================================================================
 */

function recarregarDadosDoServidor() {
    fetch('/api/estrutura/imoveis').then(res => res.json()).then(imoveis => {
        const corpo = document.getElementById('tabela_imoveis');
        if (corpo) {
            corpo.innerHTML = "";
            imoveis.forEach(imovel => {
                let aluguelComCondominio = parseFloat(imovel.valor_aluguel) + parseFloat(imovel.valor_condominio);
                corpo.innerHTML += `<tr><td><strong>${imovel.nome_empresa || "EQUIPE"}</strong></td><td><strong>${imovel.tipo_imovel}</strong><br><small style="color:#6b7280;">${imovel.regiao}</small></td><td>${imovel.area_util} m²</td><td style="color:#1e3a8a; font-weight:bold;">R$ ${aluguelComCondominio.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button class="btn-action" onclick="carregarImovelEdicao(${imovel.id})">Editar</button> <button class="btn-action-del" onclick="removerImovel(${imovel.id})">Rescindir</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));

    fetch('/api/estrutura/maquinas').then(res => res.json()).then(maquinas => {
        const corpo = document.getElementById('tabela_maquinas');
        if (corpo) {
            corpo.innerHTML = "";
            maquinas.forEach(m => {
                corpo.innerHTML += `<tr><td><strong>${m.nome_equipamento}</strong></td><td>R$ ${parseFloat(m.preco_compra).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${m.potencia_watts} W</td><td>${m.consumo_gas_m3} m³</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(m.custo_minuto_maquina).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button class="btn-action-del" onclick="deletarMaquina(${m.id})">Remover</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));

    fetch('/api/estrutura/rh').then(res => res.json()).then(equipe => {
        const corpo = document.getElementById('tabela_colaboradores');
        if (corpo) {
            corpo.innerHTML = "";
            equipe.forEach(func => {
                corpo.innerHTML += `<tr><td>👤 ${func.nome}</td><td>${func.cargo}</td><td>R$ ${parseFloat(func.salario_base).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${func.quantidade}</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(func.subtotal).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button class="btn-action" onclick="carregarColaboradorEdicao(${func.id})">Editar</button> <button class="btn-action-del" onclick="removerColaborador(${func.id})">Demitir</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));
    recargarEAtualizarPaineisTotais();
}

function salvarImovel(event) {
    event.preventDefault();
    const id = document.getElementById('imovel_id').value;
    const dados = {
        id: id ? parseInt(id) : null,
        tipo_imovel: document.getElementById('tipo_imovel').value,
        regiao: document.getElementById('cidade').value + " - " + document.getElementById('bairro').value,
        area_util: parseFloat(document.getElementById('area_util').value) || 0,
        valor_condominio: parseFloat(document.getElementById('valor_condominio').value) || 0,
        valor_aluguel: parseFloat(document.getElementById('valor_aluguel').value) || 0,
        obs_contrato: document.getElementById('txt_igpm_correcao').innerText
    };
    fetch('/api/estrutura/imoveis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(() => { 
        document.getElementById('formImobiliario').reset(); 
        document.getElementById('imovel_id').value = ""; 
        document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
        recarregarDadosDoServidor(); 
    });
}

function auditarMargemSegurancaSetor(patrimonioTotal, precoNovo) {
    let limiteMaximo = 2000000.00;
    return { autorizado: (patrimonioTotal + precoNovo) <= limiteMaximo };
}

function salvarMaquina(event) {
    event.preventDefault();
    const seletor = document.getElementById('seletor_equipamento');
    if (seletor.selectedIndex === 0 || seletor.selectedIndex === -1) return;
    const opt = seletor.options[seletor.selectedIndex];
    const dados = {
        nome: opt.value,
        preco: parseFloat(opt.getAttribute('data-preco')) || 0,
        potencia: parseFloat(opt.getAttribute('data-watts')) || 0,
        gas: parseFloat(opt.getAttribute('data-gas')) || 0,
        agua: parseFloat(opt.getAttribute('data-agua')) || 0,
        depreciacao: parseFloat(opt.getAttribute('data-dep')) || 0,
        custo_minuto: parseFloat(opt.getAttribute('data-min')) || 0
    };
    fetch('/api/financeiro/metricas?dept=estrutura').then(res => res.json()).then(m => {
        let patrimonioAtual = m.patrimonio_ativo_total || 0;
        if (!auditarMargemSegurancaSetor(patrimonioAtual, dados.preco).autorizado) {
            alert("Erro Operacional: Esta aquisição excede as diretrizes administrativas de tetos (Max 40% dos ativos)!");
            return;
        }
        fetch('/api/estrutura/maquinas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(() => { 
            seletor.selectedIndex = 0; 
            recarregarDadosDoServidor(); 
        });
    });
}

function carregarImovelEdicao(id) {
    fetch(`/api/estrutura/imoveis/${id}`).then(res => res.json()).then(imovel => {
        document.getElementById('imovel_id').value = imovel.id;
        document.getElementById('tipo_imovel').value = imovel.tipo_imovel;
        document.getElementById('area_util').value = imovel.area_util;
        document.getElementById('valor_condominio').value = imovel.valor_condominio;
        document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato de Locação";
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        let aluguelCalculado = parseFloat(imovel.area_util) * 32.50;
        document.getElementById('valor_aluguel').value = aluguelCalculado.toFixed(2);
        document.getElementById('taxa_anual').value = ((aluguelCalculado * 12) + parseFloat(imovel.valor_condominio)).toFixed(2);
        document.getElementById('reserva_propria').value = (aluguelCalculado + parseFloat(imovel.valor_condominio)).toFixed(2);
        document.getElementById('txt_valor_mercado_real').innerText = `R$ ${(aluguelCalculado / 0.0055).toLocaleString('pt-BR', {maximumFractionDigits:2})}`;
        document.getElementById('txt_igpm_correcao').innerText = imovel.obs_contrato || "R$ 0,00";
    });
}

function adicionarColaborador(event) {
    event.preventDefault();
    const id = document.getElementById('rh_id').value;
    const seletor = document.getElementById('cargo_suporte');
    if (!seletor || seletor.selectedIndex === -1) return;
    const dados = {
        id: id ? parseInt(id) : null,
        nome: document.getElementById('rh_nome').value,
        cargo: seletor.value,
        salario_base: parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0,
        quantidade: parseInt(document.getElementById('qtd_colaboradores').value) || 1
    };
    fetch('/api/estrutura/rh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(() => { 
        document.getElementById('formContratacaoPredial').reset(); 
        document.getElementById('rh_id').value = ""; 
        document.getElementById('btn_contratar').innerText = "👥 Confirmar Registro";
        recarregarDadosDoServidor(); 
    });
}

function carregarColaboradorEdicao(id) {
    fetch(`/api/estrutura/rh/${id}`).then(res => res.json()).then(func => {
        document.getElementById('rh_id').value = func.id;
        document.getElementById('rh_nome').value = func.nome;
        document.getElementById('cargo_suporte').value = func.cargo;
        document.getElementById('qtd_colaboradores').value = func.quantidade;
        document.getElementById('btn_contratar').innerText = "🔄 Atualizar Cadastro de Funcionário";
        calcularPreviaSalario();
    });
}

function deletarMaquina(id) { 
    if(confirm("Deseja remover este ativo do setor?")) {
        fetch(`/api/estrutura/maquinas/${id}`, { method: 'DELETE' }).then(() => recarregarDadosDoServidor()); 
    }
}

function removerImovel(id) { 
    if(confirm("Deseja rescindir este contrato patrimonial?")) {
        fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' }).then(() => recarregarDadosDoServidor()); 
    }
}

function removerColaborador(id) { 
    if(confirm("Deseja demitir este colaborador?")) {
        fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' }).then(() => recarregarDadosDoServidor()); 
    }
}
