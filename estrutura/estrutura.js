/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E SINCRO REAL SUPABASE
   PARTE 1 DE 2 - GATILHOS DE EXECUÇÃO E REATIVIDADE DE PROJEÇÕES
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
        .then(res => res.json())
        .then(dados => {
            document.getElementById('nome_grupo_display').value = dados.nome_empresa || "GRUPO DIDÁTICO";
        }).catch(err => console.error("Erro ao puxar dados da sessão:", err));
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
    let taxaIgpmEstipada = 0.072;
    let valorCorrigidoProjecao = reserva * (1 + taxaIgpmEstipada);

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

function recargarEAtualizarPaineisTotais() {
    fetch('/api/financeiro/metricas?dept=estrutura')
        .then(res => res.json())
        .then(dados => {
            document.getElementById('kpi-patrimonio-total').innerText = `R$ ${dados.patrimonio_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            const elGlobal = document.getElementById('kpi-teto-ativos');
            if (elGlobal) elGlobal.innerText = `Global: R$ ${dados.patrimonio_ativo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
            
            let tetoMaximoAtivos = dados.capital_total * 0.40; 
            let percentualConsumoTeto = tetoMaximoAtivos > 0 ? (dados.patrimonio_ativo_total / tetoMaximoAtivos) * 100 : 0;
            document.getElementById('barra-limite-setor').style.width = `${Math.min(percentualConsumoTeto, 100)}%`;
            document.getElementById('txt_porcentagem_budget').innerText = `${percentualConsumoTeto.toFixed(1)}% do teto consumido`;

            document.getElementById('kpi-custo-fixo-setor').innerText = `R$ ${dados.custo_fixo_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('fechamento_custo_fixo_generico').innerText = `R$ ${dados.custo_fixo_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            
            let impactoFixo = dados.custo_fixo_total > 0 ? (dados.custo_fixo_isolado_setor / dados.custo_fixo_total) * 100 : 0;
            document.getElementById('txt_proporcao_global_empresa').innerText = `➔ Impacto do Setor: ${impactoFixo.toFixed(2)}% do global`;

            document.getElementById('kpi-custo-variavel-setor').innerText = `R$ ${dados.custo_variavel_isolado_setor.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
            document.getElementById('kpi-custo-variavel-total').innerText = `R$ ${dados.custo_variavel_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}/mês`;
        }).catch(err => console.error(err));
}
/* ==========================================================================
   TERADMAS ERP v2.6 - ENGINE DE GESTÃO PATRIMONIAL E SINCRO REAL SUPABASE
   PARTE 2 DE 2 - PERSISTÊNCIA TRANSAÇÃO COM ESCRITA E EDICÃO NO SUPABASE
   ========================================================================== */

function recarregarDadosDoServidor() {
    fetch('/api/estrutura/imoveis')
        .then(res => res.json())
        .then(imoveis => {
            const corpo = document.getElementById('tabela_imoveis');
            corpo.innerHTML = "";
            imoveis.forEach(imovel => {
                corpo.innerHTML += `
                    <tr>
                        <td><strong>${imovel.nome_empresa || "EQUIPE"}</strong></td>
                        <td><strong>${imovel.tipo_imovel}</strong><br><small style="color:#6b7280;">${imovel.regiao}</small></td>
                        <td>${imovel.area_util} m²</td>
                        <td style="color:#1e3a8a; font-weight:bold;">R$ ${parseFloat(imovel.valor_aluguel).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                        <td style="text-align:center;">
                            <button class="btn-top" style="color:#d97706; background:#fef3c7; border:none; padding:4px 8px; cursor:pointer;" onclick="carregarImovelEdicao(${imovel.id})">Editar</button>
                            <button class="btn-top" style="color:#dc2626; background:#fee2e2; border:none; padding:4px 8px; cursor:pointer;" onclick="removerImovel(${imovel.id})">Rescindir</button>
                        </td>
                    </tr>`;
            });
        });

    fetch('/api/estrutura/rh')
        .then(res => res.json())
        .then(equipe => {
            const corpo = document.getElementById('tabela_colaboradores');
            corpo.innerHTML = "";
            equipe.forEach(func => {
                corpo.innerHTML += `
                    <tr>
                        <td>👤 ${func.nome}</td>
                        <td>${func.cargo}</td>
                        <td>R$ ${parseFloat(func.salario_base).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                        <td>${func.quantidade}</td>
                        <td style="color:#1e3a8a; font-weight:600;">R$ ${parseFloat(func.subtotal).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                        <td style="text-align:center;">
                            <button class="btn-top" style="color:#1e3a8a; background:#e0f2fe; border:none; padding:4px 8px; cursor:pointer;" onclick="carregarColaboradorEdicao(${func.id})">Editar</button>
                            <button class="btn-top" style="color:#dc2626; background:#fee2e2; border:none; padding:4px 8px; cursor:pointer;" onclick="removerColaborador(${func.id})">Demitir</button>
                        </td>
                    </tr>`;
            });
        });

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

    fetch('/api/estrutura/imoveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    }).then(() => {
        document.getElementById('formImobiliario').reset();
        document.getElementById('imovel_id').value = "";
        document.getElementById('btn_salvar').innerText = "💾 Firmar Contrato de Locação";
        recarregarDadosDoServidor();
    });
}

function carregarImovelEdicao(id) {
    fetch(`/api/estrutura/imoveis/${id}`)
        .then(res => res.json())
        .then(imovel => {
            document.getElementById('imovel_id').value = imovel.id;
            document.getElementById('tipo_imovel').value = imovel.tipo_imovel;
            document.getElementById('area_util').value = imovel.area_util;
            document.getElementById('valor_condominio').value = imovel.valor_condominio;
            document.getElementById('btn_salvar').innerText = "🔄 Atualizar Contrato de Locação";
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Força o preenchimento reativo imediato dos campos bloqueados e provisões
            let aluguelCalculado = parseFloat(imovel.area_util) * 32.50;
            document.getElementById('valor_aluguel').value = aluguelCalculado.toFixed(2);
            document.getElementById('taxa_anual').value = ((aluguelCalculado * 12) + parseFloat(imovel.valor_condominio)).toFixed(2);
            document.getElementById('reserva_propria').value = (aluguelCalculado + parseFloat(imovel.valor_condominio)).toFixed(2);
            
            let valorMercadoEstimado = aluguelCalculado / 0.0055;
            document.getElementById('txt_valor_mercado_real').innerText = `R$ ${valorMercadoEstimado.toLocaleString('pt-BR', {maximumFractionDigits:2})}`;
            document.getElementById('txt_igpm_correcao').innerText = imovel.obs_contrato || "R$ 0,00";
        });
}

function removerImovel(id) {
    if(!confirm("Deseja rescindir este contrato patrimonial imobiliário?")) return;
    fetch(`/api/estrutura/imoveis/${id}`, { method: 'DELETE' }).then(() => recarregarDadosDoServidor());
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

    fetch('/api/estrutura/rh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    }).then(() => {
        document.getElementById('formContratacaoPredial').reset();
        document.getElementById('rh_id').value = "";
        document.getElementById('btn_contratar').innerText = "👥 Confirmar Registro de Funcionário";
        recarregarDadosDoServidor();
    });
}

function carregarColaboradorEdicao(id) {
    fetch(`/api/estrutura/rh/${id}`)
        .then(res => res.json())
        .then(func => {
            document.getElementById('rh_id').value = func.id;
            document.getElementById('rh_nome').value = func.nome;
            document.getElementById('cargo_suporte').value = func.cargo;
            document.getElementById('qtd_colaboradores').value = func.quantidade;
            document.getElementById('btn_contratar').innerText = "🔄 Atualizar Cadastro de Funcionário";
            calcularPreviaSalario();
        });
}

function removerColaborador(id) {
    if(!confirm("Deseja confirmar o desligamento e demissão do funcionário?")) return;
    fetch(`/api/estrutura/rh/${id}`, { method: 'DELETE' }).then(() => recarregarDadosDoServidor());
}
