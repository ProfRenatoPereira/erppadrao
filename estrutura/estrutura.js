/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E SINCRO REAL SUPABASE
   PARTE 1 DE 2 - GATILHOS DE EXECUÇÃO E TRATAMENTO SEGURO DE SESSÃO
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('area_util').addEventListener('input', executarCalculoLocacaoReativa);
    document.getElementById('valor_condominio').addEventListener('input', executarCalculoLocacaoReativa);
    document.getElementById('reserva_propria').addEventListener('input', calcularProjecaoIgpmAnual);
    
    sincronizarNomeGrupoSessao();
    recarregarDadosDoServidor();
});

function sincronizarNomeGrupoSessao() {
    fetch('/api/financeiro/metricas?dept=estrutura')
        .then(res => {
            if (!res.ok) throw new Error("Falha na sessão");
            return res.json();
        })
        .then(dados => {
            if (dados && dados.nome_empresa) {
                document.getElementById('nome_grupo_display').value = dados.nome_empresa;
            } else {
                document.getElementById('nome_grupo_display').value = "GRUPO DIDÁTICO";
            }
        })
        .catch(err => {
            console.warn("Aviso: Utilizando fallback de segurança para o grupo:", err);
            document.getElementById('nome_grupo_display').value = "GRUPO DIDÁTICO (LOCAL)";
        });
}

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
    document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {maximumFractionDigits:2})}`;

    calcularProjecaoIgpmAnual();
}

function calcularProjecaoIgpmAnual() {
    let reserva = parseFloat(document.getElementById('reserva_propria').value) || 0;
    let taxaIgpmEstimada = 0.072;
    let valorCorrigidoProjecao = reserva * (1 + taxaIgpmEstimada);

    document.getElementById('txt_igpm_correcao').innerText = `R$ ${valorCorrigidoProjecao.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function calcularPreviaSalario() {
    const seletor = document.getElementById('cargo_suporte');
    const qtdInput = document.getElementById('qtd_colaboradores');
    if(seletor.selectedIndex === 0 || seletor.selectedIndex === -1) return;
    let salarioBase = parseFloat(seletor.options[seletor.selectedIndex].getAttribute('data-salario')) || 0;
    let vagas = parseInt(qtdInput.value) || 1;
    document.getElementById('previa_salario').value = `R$ ${(salarioBase * vagas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E SINCRO REAL SUPABASE
   PARTE 2A - ATUALIZAÇÃO DE KPIs, CUSTOS FIXOS, VARIÁVEIS E UTILIDADES
   ========================================================================== */

function recargarEAtualizarPaineisTotais() {
    fetch('/api/financeiro/metricas?dept=estrutura')
        .then(res => {
            if (!res.ok) throw new Error("Erro de resposta do servidor");
            return res.json();
        })
        .then(dados => {
            if (!dados) return;
            document.getElementById('kpi-saldo-infra').innerText = `R$ ${(dados.saldo_infraestrutura_setor || 2000000).toLocaleString('pt-BR', {minimumFractionDigits:2})} ➔ ${(((dados.saldo_infraestrutura_setor || 2000000) / 2000000) * 100).toFixed(2)}% Disponível`;
            document.getElementById('kpi-patrimonio-total').innerText = `R$ ${(dados.patrimonio_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            document.getElementById('kpi-teto-ativos').innerText = `Global: R$ ${(dados.patrimonio_ativo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            let tetoMaximoAtivos = (dados.capital_total || 5000000) * 0.40; 
            let percentualConsumoTeto = tetoMaximoAtivos > 0 ? ((dados.patrimonio_ativo_total || 0) / tetoMaximoAtivos) * 100 : 0;
            document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTeto, 100)}%`;
            document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTeto.toFixed(1)}% do teto consumido`;

            document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${(dados.custo_fixo_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${(dados.custo_fixo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${(dados.custo_fixo_total > 0 ? (dados.custo_fixo_isolado_setor / dados.custo_fixo_total) * 100 : 0).toFixed(2)}%`;

            document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${(dados.custo_variavel_isolado_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${(dados.custo_variavel_total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            document.getElementById('txt_tempo_meses').innerText = dados.tempo_amortizacao_real || "0 meses";
            document.getElementById('txt_taxa_capitalizacao').innerText = dados.cap_rate_calculado || "0.00% a.m.";
            document.getElementById('lbl_watts_consumidos').innerText = `${(dados.watts_consumidos || 0).toLocaleString('pt-BR')} W`;
            document.getElementById('lbl_gas_consumido').innerText = `${(dados.gas_consumido || 0).toLocaleString('pt-BR')} m³`;
            document.getElementById('lbl_agua_consumida').innerText = `${(dados.agua_consumida || 0).toLocaleString('pt-BR')} m³`;
            document.getElementById('kpi-custo-minuto-total').innerText = `R$ ${(dados.custo_minuto_setor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}/min`;
        }).catch(err => console.error("Erro ao processar barramento de métricas:", err));
}
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E SINCRO REAL SUPABASE
   PARTE 2B - POPULAÇÃO E RENDERIZAÇÃO DAS TABELAS DINÂMICAS DO SUPABASE
   ========================================================================== */

function recarregarDadosDoServidor() {
    fetch('/api/estrutura/imoveis').then(res => res.json()).then(imoveis => {
        const corpo = document.getElementById('tabela_imoveis');
        if (corpo) {
            corpo.innerHTML = "";
            imoveis.forEach(imovel => {
                let aluguelComCondominio = parseFloat(imovel.valor_aluguel) + parseFloat(imovel.valor_condominio);
                corpo.innerHTML += `<tr><td><strong>${imovel.nome_empresa || "EQUIPE"}</strong></td><td><strong>${imovel.tipo_imovel}</strong><br><small style="color:#6b7280;">${imovel.regiao}</small></td><td>${imovel.area_util} m²</td><td style="color:#1e3a8a; font-weight:bold;">R$ ${aluguelComCondominio.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="carregarImovelEdicao(${imovel.id})">Editar</button> <button onclick="removerImovel(${imovel.id})">Rescindir</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));

    fetch('/api/estrutura/maquinas').then(res => res.json()).then(maquinas => {
        const corpo = document.getElementById('tabela_maquinas');
        if (corpo) {
            corpo.innerHTML = "";
            maquinas.forEach(m => {
                corpo.innerHTML += `<tr><td><strong>${m.nome_equipamento}</strong></td><td>R$ ${parseFloat(m.preco_compra).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${m.potencia_watts} W</td><td>${m.consumo_gas_m3} m³</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(m.custo_minuto_maquina).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="deletarMaquina(${m.id})">Remover</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));

    fetch('/api/estrutura/rh').then(res => res.json()).then(equipe => {
        const corpo = document.getElementById('tabela_colaboradores');
        if (corpo) {
            corpo.innerHTML = "";
            equipe.forEach(func => {
                corpo.innerHTML += `<tr><td>👤 ${func.nome}</td><td>${func.cargo}</td><td>R$ ${parseFloat(func.salario_base).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td>${func.quantidade}</td><td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(func.subtotal).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align:center;"><button onclick="carregarColaboradorEdicao(${func.id})">Editar</button> <button onclick="removerColaborador(${func.id})">Demitir</button></td></tr>`;
            });
        }
    }).catch(err => console.error(err));

    recargarEAtualizarPaineisTotais();
}
