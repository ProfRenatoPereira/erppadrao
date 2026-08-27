/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 1 DE 4 (INICIALIZAÇÃO E ESCOPO NATIVO)
 * ==========================================================================
 */

// Declarações explícitas de funções para evitar problemas de hoisting com listeners
function inicializarMotorLeitorVoz() {
    const btnLeitor = document.getElementById('btn-leitor');
    if (btnLeitor) {
        let lendo = false;
        let sintese = window.speechSynthesis;
        let utterance;

        btnLeitor.addEventListener('click', function() {
            if (!lendo) {
                const painelConteudo = document.querySelector('.grid-main') || document.body;
                let textoParaLer = painelConteudo.innerText || painelConteudo.textContent;
                textoParaLer = textoParaLer.replace(/♿|⚫|✔️|📢|📁|🛠️|🏭|📈|💰|📄|⚡|🔥|💧|⏱️|🏢|🔒|🚜|👥|💾|🔄|❌/g, '');
                
                utterance = new SpeechSynthesisUtterance(textoParaLer);
                utterance.lang = 'pt-BR';
                utterance.onend = function() { lendo = false; btnLeitor.innerText = "📢 Ativar Leitor"; };
                sintese.speak(utterance);
                lendo = true;
                btnLeitor.innerText = "🛑 Parar Leitor";
            } else {
                sintese.cancel(); lendo = false; btnLeitor.innerText = "📢 Ativar Leitor";
            }
        });
    }
}

function sincronizarNomeGrupoSessao() {
    fetch('/api/estrutura/metricas')
        .then(function(res) {
            if (!res.ok) throw new Error("Status HTTP inválido");
            return res.json();
        })
        .then(function(dados) {
            if (dados && dados.nome_empresa) {
                document.getElementById('nome_grupo_display').value = dados.nome_empresa;
            } else {
                document.getElementById('nome_grupo_display').value = "GRUPO ACADÊMICO";
            }
        })
        .catch(function(err) {
            console.warn("Aviso: Utilizando cache estável para o grupo:", err);
            document.getElementById('nome_grupo_display').value = "GRUPO DIDÁTICO (LOCAL)";
        });
}

document.addEventListener("DOMContentLoaded", function() {
    // Configuração síncrona dos gatilhos de digitação
    document.getElementById('area_util').addEventListener('input', executarCalculoLocacaoReativa);
    document.getElementById('valor_condominio').addEventListener('input', executarCalculoLocacaoReativa);
    document.getElementById('reserva_propria').addEventListener('input', calcularProjecaoIgpmAnual);
    
    // Processamento seguro das cargas iniciais
    sincronizarNomeGrupoSessao();
    recarregarDadosDoServidor();
    inicializarMotorLeitorVoz();
});
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 2 DE 4 (MOTORES DE CÁLCULO E ACESSIBILIDADE)
 * ==========================================================================
 */

function executarCalculoLocacaoReativa() {
    let area = parseFloat(document.getElementById('area_util').value) || 0;
    let condominio = parseFloat(document.getElementById('valor_condominio').value) || 0;
    
    let aluguelCalculado = area * 32.50; 
    let taxaAnualCalculada = (aluguelCalculado * 12) + condominio;

    document.getElementById('valor_aluguel').value = aluguelCalculado.toFixed(2);
    document.getElementById('taxa_anual').value = taxaAnualCalculada.toFixed(2);

    let provisaoInicial = aluguelCalculado + condominio;
    document.getElementById('reserva_propria').value = provisaoInicial.toFixed(2);

    let valorMercadoEstimado = aluguelCalculado / 0.0055;
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    let tempoMesesAmortizacao = valorMercadoEstimado / provisaoInicial;
    document.getElementById('txt_tempo_meses').innerText = `${Math.ceil(tempoMesesAmortizacao)} meses`;

    let capRateCalculado = (aluguelCalculado / valorMercadoEstimado) * 100;
    document.getElementById('txt_taxa_capitalizacao').innerText = `${capRateCalculado.toFixed(2)}% a.m.`;

    calcularProjecaoIgpmAnual();
}

function calcularProjecaoIgpmAnual() {
    let reserva = parseFloat(document.getElementById('reserva_propria').value) || 0;
    let taxaIgpmEstimada = 0.072;
    let valorCorrigidoProjecao = reserva * (1 + taxaIgpmEstimada);
    document.getElementById('txt_igpm_correcao').innerText = `R$ ${valorCorrigidoProjecao.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    if (!seletor || seletor.selectedIndex === -1) return;
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function alterarFonte(operacao) {
    let htmlEl = document.documentElement;
    let estiloAtual = window.getComputedStyle(htmlEl).fontSize;
    let tamanhoNumerico = parseFloat(estiloAtual);
    if (operacao === '+') htmlEl.style.fontSize = (tamanhoNumerico + 1) + 'px';
    else if (operacao === '-') htmlEl.style.fontSize = (tamanhoNumerico - 1) + 'px';
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 3 DE 4 (ATUALIZAÇÃO DE PAINÉIS DE KPI)
 * ==========================================================================
 */

function recargarEAtualizarPaineisTotais() {
    fetch('/api/estrutura/metricas')
        .then(function(res) {
            if (!res.ok) throw new Error("Erro de comunicação financeira");
            return res.json();
        })
        .then(function(dados) {
            if (!dados) return;
            
            let custoDescontoTotalSetor = dados.aluguel_bruto_setor + dados.provisao_setor + dados.subtotal_fixado_rh;
            let saldoInfraestruturaCalculado = 2000000.00 - custoDescontoTotalSetor;
            let percentualDisponivelInfra = (saldoInfraestruturaCalculado / 2000000.00) * 100;
            
            document.getElementById('kpi-saldo-infra').innerText = `R$ ${saldoInfraestruturaCalculado.toLocaleString('pt-BR', {minimumFractionDigits:2})} ➔ ${percentualDisponivelInfra.toFixed(2)}% Disponível`;
            document.getElementById('kpi-patrimonio-total').innerText = `R$ ${dados.patrimonio_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            let tetoMaximoAtivosGlobal = 5000000.00 * 0.40; 
            document.getElementById('kpi-teto-ativos').innerText = `Global: R$ ${tetoMaximoAtivosGlobal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            let percentualConsumoTetoPatrimonio = tetoMaximoAtivosGlobal > 0 ? (dados.patrimonio_ativo_total / tetoMaximoAtivosGlobal) * 100 : 0;
            document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTetoPatrimonio, 100)}%`;
            document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTetoPatrimonio.toFixed(1)}% do teto consumido`;

            document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${dados.custo_fixo_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${dados.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            let impactoFixo = dados.custo_fixo_total > 0 ? (dados.custo_fixo_isolado_setor / dados.custo_fixo_total) * 100 : 0;
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${impactoFixo.toFixed(2)}% do global`;

            document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${dados.custo_variavel_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${dados.custo_variavel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            document.getElementById('lbl_watts_consumidos').innerText = `${dados.watts_consumidos.toLocaleString('pt-BR')} W`;
            document.getElementById('lbl_gas_consumido').innerText = `${dados.gas_consumido.toLocaleString('pt-BR')} m³`;
            document.getElementById('lbl_agua_consumida').innerText = `${dados.agua_consumido.toLocaleString('pt-BR')} m³`;
            document.getElementById('kpi-custo-minuto-total').innerText = `R$ ${dados.custo_minuto_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/min`;
        })
        .catch(function(err) { console.error("Erro ao sincronizar barramentos dinâmicos:", err); });
}
/**
 * ==========================================================================
 * TERADMAS ERP v2.6 - MÓDULO 02 & 07: ENGENHARIA IMOBILIÁRIA E ATIVOS
 * ARQUIVO: estrutura.js - PARTE 4 DE 4 (PIPELINES E CHAMADAS REST CRUD)
 * ==========================================================================
 */

function recargarDadosDoServidor() {
    fetch('/api/estrutura/imoveis').then(function(res){ return res.json(); }).then(function(imoveis) {
        const corpo = document.getElementById('tabela_imoveis');
        if (corpo) {
            corpo.innerHTML = "";
            imoveis.forEach(function(imovel) {
                let aluguelComCondominio = parseFloat(imovel.valor_aluguel) + parseFloat(imovel.valor_condominio);
                corpo.innerHTML += `<tr><td><strong>${imovel.nome_empresa || "EQUIPE"}</strong></td><td><strong>${imovel.tipo_imovel}</strong><br><small style="color:#6b7280;">${imovel.regiao}</small></td><td>${imovel.area_util} m²</td><td style="color:#1e3a8a; font-weight:bold;">R$ ${aluguelComCondominio.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="carregarImovelEdicao(${imovel.id})">Editar</button> <button onclick="removerImovel(${imovel.id})">Rescindir</button></td></tr>`;
            });
        }
    }).catch(function(err){ console.error(err); });

    fetch('/api/estrutura/maquinas').then(function(res){ return res.json(); }).then(function(maquinas) {
        const corpo = document.getElementById('tabela_maquinas');
        if (corpo) {
            corpo.innerHTML = "";
            maquinas.forEach(function(m) {
                corpo.innerHTML += `<tr><td><strong>${m.nome_equipamento}</strong></td><td>R$ ${parseFloat(m.preco_compra).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${m.potencia_watts} W</td><td>${m.consumo_gas_m3} m³</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(m.custo_minuto_maquina).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="deletarMaquina(${m.id})">Remover</button></td></tr>`;
            });
        }
    }).catch(function(err){ console.error(err); });

    fetch('/api/estrutura/rh').then(function(res){ return res.json(); }).then(function(equipe) {
        const corpo = document.getElementById('tabela_colaboradores');
        if (corpo) {
            corpo.innerHTML = "";
            equipe.forEach(function(func) {
                corpo.innerHTML += `<tr><td>👤 ${func.nome}</td><td>${func.cargo}</td><td>R$ ${parseFloat(func.salario_base).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${func.quantidade}</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(func.subtotal).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="carregarColaboradorEdicao(${func.id})">Editar</button> <button onclick="removerColaborador(${func.id})">Demitir</button></td></tr>`;
            });
        }
    }).catch(function(err){ console.error(err); });
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
    fetch('/api/estrutura/imoveis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(function(){ document.getElementById('formImobiliario').reset(); document.getElementById('imovel_id').value = ""; recarregarDadosDoServidor(); });
}

function auditarMargemSegurancaSetor(patrimonioTotal, precoNovo) { return { authorized: (patrimonioTotal + precoNovo) <= 2000000.00 }; }

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
    fetch('/api/estrutura/metricas').then(function(res){ return res.json(); }).then(function(m) {
        if (!auditarMargemSegurancaSetor((m.patrimonio_ativo_total || 0), dados.preco).authorized) { alert("Erro Operacional: Esta aquisição excede as diretrizes administrativas de tetos!"); return; }
        fetch('/api/estrutura/maquinas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(function(){ seletor.selectedIndex = 0; recarregarDadosDoServidor(); });
    });
}

function carregarImovelEdicao(id) {
    fetch(`/api/estrutura/imoveis/${id}`).then(function(res){ return res.json(); }).then(function(imovel) {
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
    const dados = {
        id: id ? parseInt(id) : null,
        nome: document.getElementById('rh_nome').value,
        cargo: seletor.value,
        salario_base: parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0,
        quantidade: parseInt(document.getElementById('qtd_colaboradores').value) || 1
    };
    fetch('/api/estrutura/rh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }).then(function(){ document.getElementById('formContratacaoPredial').reset(); document.getElementById('rh_id').value = ""; recarregarDadosDoServidor(); });
}

function carregarColaboradorEdicao(id) {
    fetch(`/api/estrutura/rh/${id}`).then(function(res){ return res.json(); }).then(function(func) {
        document.getElementById('rh_id').value = func.id;
        document.getElementById('rh_nome').value = func.nome;
        document.getElementById('cargo_suporte').value = func.cargo;
        document.getElementById('qtd_colaboradores').value = func.quantidade;
        document.getElementById('btn_contratar').innerText = "🔄 Atualizar Cadastro de Funcionário";
        calcularPreviaSalario();
    });
}

function deletarMaquina(id) { if(confirm("Deseja remover este ativo do setor?")) fetch(`/api/estrutura/maquinas/${id}`, { method: 'DELETE' }).then(function(){ recarregarDadosDoServidor(); }); }
function removerImovel(id) { if(confirm("Deseja rescindir este contrato patrimonial?")) fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' }).then(function(){ recarregarDadosDoServidor(); }); }
function removerColaborador(id) { if(confirm("Deseja demitir este colaborador?")) fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' }).then(function(){ recarregarDadosDoServidor(); }); }
