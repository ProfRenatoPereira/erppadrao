/* ==========================================================================\n   TERADMAS ERP v2.6 - MÓDULO 07\n   Máquinas: cadastro Supabase + orçamento + indicadores\n   ========================================================================== */
(function () {
    "use strict";

    const fmtBRL = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency", currency: "BRL"
    });

    const num = (id) => Number.parseFloat(document.getElementById(id)?.value || 0) || 0;
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? "";
    };

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function pct(valor, base) {
        if (!base) return "0.00%";
        return `${((Number(valor || 0) / Number(base)) * 100).toFixed(2)}%`;
    }

    /* ----------------------------------------------------------------------
       ORÇAMENTO
       ---------------------------------------------------------------------- */
    async function carregarOrcamento() {
        try {
            const resposta = await fetch("/api/maquinas/orcamento", { cache: "no-store" });
            const dados = await resposta.json();
            if (!resposta.ok || dados.status !== "sucesso") throw new Error(dados.message || "Falha no orçamento.");

            const capital = Number(dados.capital_inicial || 0);
            const quota = Number(dados.valor_quota || 0);
            const saldo = Number(dados.saldo_aquisicao || 0);
            const patrimonio = Number(dados.patrimonio_atual || 0);
            const quotaPct = Number(dados.porcentagem_quota || 0);

            setText("top_capital_total", fmtBRL(capital));
            setText("top_disponivel_setor", fmtBRL(quota));
            setText("pct_disponivel_setor", `➔ ${quotaPct.toFixed(2)}% do Cap.`);
            setText("top_orcamento_inicial", fmtBRL(quota));
            setText("pct_orcamento_inicial", `➔ ${pct(quota, capital)} do Cap.`);
            setText("top_verba_reais", fmtBRL(saldo));
            setText("pct_saldo_engenharia", `➔ ${pct(saldo, capital)} do Cap.`);
            setText("top_patrimonio_maquinas", fmtBRL(patrimonio));
            setText("pct_patrimonio_maquinas", `➔ ${pct(patrimonio, capital)} do Cap.`);

            const consumo = quota > 0 ? Math.min(100, (patrimonio / quota) * 100) : 0;
            const barra = document.getElementById("barra_progresso_budget");
            if (barra) barra.style.width = `${consumo}%`;
            setText("txt_valores_limite", `${fmtBRL(patrimonio)} / ${fmtBRL(quota)}`);
            setText("txt_porcentagem_budget", `${consumo.toFixed(1)}% da quota consumida`);
        } catch (erro) {
            console.error("Erro ao carregar orçamento de máquinas:", erro);
        }
    }

    /* ----------------------------------------------------------------------
       CRUD DA TABELA SUPABASE
       ---------------------------------------------------------------------- */
    async function carregarMaquinas() {
        const tbody = document.getElementById("tabela_maquinas");
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5">Carregando ativos...</td></tr>`;

        try {
            const resposta = await fetch("/api/maquinas/listar", { cache: "no-store" });
            const maquinas = await resposta.json();
            if (!resposta.ok) throw new Error("Falha ao listar máquinas.");

            if (!Array.isArray(maquinas) || maquinas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5">Nenhum equipamento cadastrado para esta equipe.</td></tr>`;
                return;
            }

            tbody.innerHTML = maquinas.map((m) => {
                const nome = escapeHtml(m.nome_equipamento || "Sem identificação");
                const insumos = [
                    m.consumo_eletrico ? `${m.consumo_eletrico} kWh` : "",
                    m.consumo_agua ? `${m.consumo_agua} m³/h água` : "",
                    m.consumo_gases ? `${m.consumo_gases} m³/h gases` : ""
                ].filter(Boolean).join(" | ") || "—";
                const operador = escapeHtml(m.operador_nome || "—");
                const custo = fmtBRL(m.custo_minuto_maquina || 0) + "/min";
                const fonte = m.fonte_url ? `<a href="${escapeAttr(m.fonte_url)}" target="_blank" rel="noopener">fonte</a>` : "";
                return `
                    <tr>
                        <td><strong>${nome}</strong>${fonte ? `<br><small>${fonte}</small>` : ""}</td>
                        <td>${escapeHtml(insumos)}</td>
                        <td>${operador}</td>
                        <td>${custo}</td>
                        <td style="text-align:center; white-space:nowrap;">
                            <button type="button" class="btn-top" onclick="window.editarMaquina(${Number(m.id)})">✏️ Editar</button>
                            <button type="button" class="btn-top" onclick="window.excluirMaquina(${Number(m.id)})">🗑️ Excluir</button>
                        </td>
                    </tr>`;
            }).join("");
        } catch (erro) {
            console.error("Erro ao listar máquinas:", erro);
            tbody.innerHTML = `<tr><td colspan="5">Não foi possível carregar os equipamentos.</td></tr>`;
        }
    }

    async function salvarMaquina(evento) {
        if (evento?.preventDefault) evento.preventDefault();

        const nome = document.getElementById("nome_equipamento")?.value.trim();
        if (!nome) {
            alert("Informe o nome de identificação do equipamento.");
            return;
        }

        const dados = {
            id: document.getElementById("registro_id")?.value || null,
            nome_equipamento: nome,
            potencia: num("potencia"),
            consumo_eletrico: num("consumo_eletrico"),
            consumo_agua: num("consumo_agua"),
            consumo_gases: num("consumo_gases"),
            velocidade: document.getElementById("velocidade")?.value || "",
            avanco: document.getElementById("avanco")?.value || "",
            frequencia_manutencao: Number.parseInt(document.getElementById("frequencia_manutencao")?.value || 0, 10) || 0,
            preco_compra: num("preco_compra"),
            depreciacao_mensal: num("depreciacao_mensal"),
            valor_venda_final: num("valor_venda_final"),
            operador_nome: document.getElementById("operador_nome")?.value || "",
            custo_minuto_operador: num("custo_minuto_operador"),
            custo_minuto_maquina: num("custo_minuto_maquina"),
            jornada_semanal: document.getElementById("jornada_semanal")?.value || "44",
            turnos_trabalho: document.getElementById("turnos_trabalho")?.value || "1",
            is_patrimonio: Boolean(document.getElementById("is_patrimonio")?.checked),
            fabricante: document.getElementById("fabricante")?.value || "",
            modelo: document.getElementById("modelo")?.value || "",
            fonte_url: document.getElementById("fonte_url")?.value || ""
        };

        const botao = document.getElementById("btn_salvar");
        if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

        try {
            const resposta = await fetch("/api/maquinas/salvar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
            const retorno = await resposta.json();
            if (!resposta.ok || retorno.status !== "sucesso") {
                throw new Error(retorno.message || "Não foi possível salvar o equipamento.");
            }
            alert("✅ Equipamento registrado no Supabase.");
            limparFormularioMaquina();
            await carregarMaquinas();
            await carregarOrcamento();
            await carregarIndicadoresMaquinas();
        } catch (erro) {
            console.error("Erro ao salvar máquina:", erro);
            alert(`❌ ${erro.message}`);
        } finally {
            if (botao) { botao.disabled = false; botao.textContent = "💾 Registrar Ativo no Parque Fabril"; }
        }
    }

    async function editarMaquina(id) {
        try {
            const resposta = await fetch(`/api/maquinas/buscar/${id}`, { cache: "no-store" });
            const m = await resposta.json();
            if (!resposta.ok || m.status === "erro") throw new Error(m.message || "Equipamento não encontrado.");

            const campos = [
                "registro_id", "nome_equipamento", "potencia", "consumo_eletrico", "consumo_agua", "consumo_gases",
                "velocidade", "avanco", "frequencia_manutencao", "preco_compra", "depreciacao_mensal",
                "valor_venda_final", "operador_nome", "custo_minuto_operador", "custo_minuto_maquina",
                "jornada_semanal", "turnos_trabalho", "fabricante", "modelo", "fonte_url"
            ];
            campos.forEach((campo) => setVal(campo, m[campo] ?? ""));
            const patrimonio = document.getElementById("is_patrimonio");
            if (patrimonio) patrimonio.checked = m.is_patrimonio !== false;

            const cancelar = document.getElementById("btn_cancelar");
            if (cancelar) cancelar.style.display = "inline-block";
            document.getElementById("formMaquina")?.scrollIntoView({ behavior: "smooth", block: "start" });
            calcularMinutoMaquina();
        } catch (erro) {
            alert(`❌ ${erro.message}`);
        }
    }

    async function excluirMaquina(id) {
        if (!confirm("Excluir este equipamento do parque fabril?")) return;
        try {
            const resposta = await fetch(`/api/maquinas/deletar/${id}`, { method: "DELETE" });
            const retorno = await resposta.json();
            if (!resposta.ok || retorno.status !== "removido") throw new Error(retorno.message || "Não foi possível excluir.");
            await carregarMaquinas();
            await carregarOrcamento();
            await carregarIndicadoresMaquinas();
        } catch (erro) {
            alert(`❌ ${erro.message}`);
        }
    }

    function limparFormularioMaquina() {
        const form = document.getElementById("formMaquina");
        if (form) form.reset();
        setVal("registro_id", "");
        setVal("fabricante", "");
        setVal("modelo", "");
        setVal("fonte_url", "");
        setVal("consumo_agua", "0.000");
        setVal("consumo_gases", "0.000");
        setVal("custo_minuto_maquina", "0.0000");
        const cancelar = document.getElementById("btn_cancelar");
        if (cancelar) cancelar.style.display = "none";
        calcularMinutoMaquina();
    }

    /* ----------------------------------------------------------------------
       CÁLCULO DO CUSTO/MINUTO
       ---------------------------------------------------------------------- */
    function calcularMinutoMaquina() {
        const depreciacao = num("depreciacao_mensal");
        const operador = num("custo_minuto_operador");
        const jornada = Number(document.getElementById("jornada_semanal")?.value || 44);
        const turnos = Number(document.getElementById("turnos_trabalho")?.value || 1);
        const minutosMes = (jornada * 52 / 12) * 60 * Math.max(turnos, 1);
        const custoDep = minutosMes > 0 ? depreciacao / minutosMes : 0;
        const custo = custoDep + operador;
        setVal("custo_minuto_maquina", custo.toFixed(4));
    }

    /* ----------------------------------------------------------------------
       MODELOS BASE: auxilia o preenchimento automático; o cadastro também pode ser manual.
       ---------------------------------------------------------------------- */
    /*
       MODELOS BASE INDUSTRIAIS
       Os valores abaixo são parâmetros didáticos de referência.
       Eles NÃO bloqueiam a edição manual: ao selecionar um modelo, o formulário
       é preenchido e o estudante pode ajustar qualquer característica conforme
       a máquina efetivamente escolhida para o negócio.
    */
    const MODELOS_BASE = {
        cnc_mazak: {
            nome: "Torno CNC Mazak Quick Turn", fabricante: "Mazak", modelo: "Quick Turn",
            potencia: 15, consumo_eletrico: 15, consumo_agua: 0, consumo_gases: 0,
            velocidade: "4.000 RPM", avanco: "1–500 mm/min", frequencia_manutencao: 500,
            preco_compra: 450000, depreciacao_mensal: 3750, valor_venda_final: 90000,
            custo_minuto_operador: 0.35, jornada_semanal: "44", turnos_trabalho: "1"
        },
        centro_usid: {
            nome: "Centro de Usinagem CNC", fabricante: "Genérico", modelo: "Centro CNC",
            potencia: 22, consumo_eletrico: 22, consumo_agua: 0, consumo_gases: 0,
            velocidade: "6.000 RPM", avanco: "1–3.000 mm/min", frequencia_manutencao: 500,
            preco_compra: 650000, depreciacao_mensal: 5416.67, valor_venda_final: 130000,
            custo_minuto_operador: 0.40, jornada_semanal: "44", turnos_trabalho: "1"
        },
        torno_mecanico: {
            nome: "Torno Mecânico Convencional", fabricante: "Genérico", modelo: "Torno 600 x 2.000 mm",
            potencia: 7.5, consumo_eletrico: 7.5, consumo_agua: 0, consumo_gases: 0,
            velocidade: "2.000 RPM", avanco: "0,05–500 mm/min", frequencia_manutencao: 300,
            preco_compra: 80000, depreciacao_mensal: 666.67, valor_venda_final: 16000,
            custo_minuto_operador: 0.30, jornada_semanal: "44", turnos_trabalho: "1"
        },
        serra_fita: {
            nome: "Serra de Fita Industrial", fabricante: "Genérico", modelo: "Serra de Fita",
            potencia: 5.5, consumo_eletrico: 5.5, consumo_agua: 0, consumo_gases: 0,
            velocidade: "3.500 RPM", avanco: "20–120 mm/min", frequencia_manutencao: 400,
            preco_compra: 45000, depreciacao_mensal: 375, valor_venda_final: 9000,
            custo_minuto_operador: 0.25, jornada_semanal: "44", turnos_trabalho: "1"
        },
        retifica: {
            nome: "Retífica Cilíndrica", fabricante: "Genérico", modelo: "Retífica CNC/Convencional",
            potencia: 11, consumo_eletrico: 11, consumo_agua: 0, consumo_gases: 0,
            velocidade: "3.000 RPM", avanco: "0,01–100 mm/min", frequencia_manutencao: 500,
            preco_compra: 220000, depreciacao_mensal: 1833.33, valor_venda_final: 44000,
            custo_minuto_operador: 0.35, jornada_semanal: "44", turnos_trabalho: "1"
        },
        furadeira_radial: {
            nome: "Furadeira Radial", fabricante: "Genérico", modelo: "Furadeira Radial",
            potencia: 4, consumo_eletrico: 4, consumo_agua: 0, consumo_gases: 0,
            velocidade: "2.000 RPM", avanco: "0,05–300 mm/min", frequencia_manutencao: 300,
            preco_compra: 60000, depreciacao_mensal: 500, valor_venda_final: 12000,
            custo_minuto_operador: 0.25, jornada_semanal: "44", turnos_trabalho: "1"
        },
        forno_atmo: {
            nome: "Forno de Atmosfera Controlada", fabricante: "Genérico", modelo: "Forno Atmosfera",
            potencia: 60, consumo_eletrico: 60, consumo_agua: 0, consumo_gases: 5,
            velocidade: "—", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 380000, depreciacao_mensal: 3166.67, valor_venda_final: 76000,
            custo_minuto_operador: 0.30, jornada_semanal: "44", turnos_trabalho: "1"
        },
        forno_reveni: {
            nome: "Forno de Revenimento", fabricante: "Genérico", modelo: "Forno de Revenimento",
            potencia: 45, consumo_eletrico: 45, consumo_agua: 0, consumo_gases: 3,
            velocidade: "—", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 260000, depreciacao_mensal: 2166.67, valor_venda_final: 52000,
            custo_minuto_operador: 0.30, jornada_semanal: "44", turnos_trabalho: "1"
        },
        compressor_ar: {
            nome: "Compressor de Ar de Parafuso", fabricante: "Genérico", modelo: "Compressor de Parafuso",
            potencia: 37, consumo_eletrico: 37, consumo_agua: 0, consumo_gases: 0,
            velocidade: "3.000 RPM", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 120000, depreciacao_mensal: 1000, valor_venda_final: 24000,
            custo_minuto_operador: 0.15, jornada_semanal: "44", turnos_trabalho: "1"
        },
        empilhadeira_ele: {
            nome: "Empilhadeira Elétrica", fabricante: "Genérico", modelo: "Empilhadeira Elétrica",
            potencia: 10, consumo_eletrico: 10, consumo_agua: 0, consumo_gases: 0,
            velocidade: "1.800 RPM", avanco: "—", frequencia_manutencao: 500,
            preco_compra: 180000, depreciacao_mensal: 1500, valor_venda_final: 36000,
            custo_minuto_operador: 0.25, jornada_semanal: "44", turnos_trabalho: "1"
        },
        cestos_inox: {
            nome: "Cestos de Aço Inox (Forno)", fabricante: "Genérico", modelo: "Cesto Inox",
            potencia: 0, consumo_eletrico: 0, consumo_agua: 0, consumo_gases: 0,
            velocidade: "—", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 3500, depreciacao_mensal: 29.17, valor_venda_final: 700,
            custo_minuto_operador: 0, jornada_semanal: "44", turnos_trabalho: "1"
        },
        palets_aco: {
            nome: "Paletes de Aço Reforçados", fabricante: "Genérico", modelo: "Palete de Aço",
            potencia: 0, consumo_eletrico: 0, consumo_agua: 0, consumo_gases: 0,
            velocidade: "—", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 1800, depreciacao_mensal: 15, valor_venda_final: 360,
            custo_minuto_operador: 0, jornada_semanal: "44", turnos_trabalho: "1"
        },
        caixas_trans: {
            nome: "Caixas Metálicas para Transporte", fabricante: "Genérico", modelo: "Caixa Metálica",
            potencia: 0, consumo_eletrico: 0, consumo_agua: 0, consumo_gases: 0,
            velocidade: "—", avanco: "—", frequencia_manutencao: 1000,
            preco_compra: 1200, depreciacao_mensal: 10, valor_venda_final: 240,
            custo_minuto_operador: 0, jornada_semanal: "44", turnos_trabalho: "1"
        }
    };

    function carregarPreDefinido() {
        const select = document.getElementById("seletor_modelo");
        if (!select?.value) return;

        const modelo = MODELOS_BASE[select.value];
        const texto = select.options[select.selectedIndex]?.textContent?.trim() || "";
        if (!modelo) {
            if (!document.getElementById("nome_equipamento")?.value.trim()) setVal("nome_equipamento", texto);
            setVal("modelo", texto);
            return;
        }

        // Preenche TODOS os campos técnicos do modelo base.
        // O estudante continua podendo alterar qualquer valor antes de salvar.
        const campos = [
            "nome", "potencia", "consumo_eletrico", "consumo_agua", "consumo_gases",
            "velocidade", "avanco", "frequencia_manutencao", "preco_compra",
            "depreciacao_mensal", "valor_venda_final", "custo_minuto_operador",
            "jornada_semanal", "turnos_trabalho", "fabricante", "modelo"
        ];

        campos.forEach((campo) => {
            const id = campo === "nome" ? "nome_equipamento" : campo;
            if (modelo[campo] !== undefined) setVal(id, modelo[campo]);
        });

        // O custo/minuto é derivado de depreciação + MOD e deve ser recalculado.
        calcularMinutoMaquina();
    }

    /* ----------------------------------------------------------------------
       ACESSIBILIDADE
       ---------------------------------------------------------------------- */
    let tamanhoFonteAtual = 16;
    let leitorAtivo = false;
    let filaLeitura = [];

    function mudarFonte(delta) {
        tamanhoFonteAtual = Math.min(24, Math.max(12, tamanhoFonteAtual + delta));
        document.documentElement.style.fontSize = `${tamanhoFonteAtual}px`;
    }

    function alternarModoEscuro() {
        document.body.classList.toggle("dark-mode");
        const botao = document.getElementById("btn_tema");
        if (botao) botao.textContent = document.body.classList.contains("dark-mode") ? "☀️ Modo Claro" : "🌙 Modo Escuro";
    }

    function alternarAltoContraste() {
        document.body.classList.toggle("alto-contraste");
    }

    function alternarLeitorAudio() {
        if (!("speechSynthesis" in window)) {
            alert("O leitor de áudio não está disponível neste navegador.");
            return;
        }
        if (leitorAtivo) {
            speechSynthesis.cancel();
            leitorAtivo = false;
            filaLeitura = [];
            setText("btn-leitor-audio", "🔊 Ativar Leitor");
            return;
        }
        leitorAtivo = true;
        setText("btn-leitor-audio", "⏹️ Parar Leitor");
        const texto = document.body.innerText.replace(/\s+/g, " ").trim();
        const fala = new SpeechSynthesisUtterance(texto.slice(0, 12000));
        fala.lang = "pt-BR";
        fala.onend = () => {
            leitorAtivo = false;
            setText("btn-leitor-audio", "🔊 Ativar Leitor");
        };
        speechSynthesis.speak(fala);
    }

    function escapeHtml(valor) {
        return String(valor ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
    }

    function escapeAttr(valor) {
        return escapeHtml(valor).replace(/javascript:/gi, "");
    }

    window.salvarMaquina = salvarMaquina;
    window.editarMaquina = editarMaquina;
    window.excluirMaquina = excluirMaquina;
    window.limparFormularioMaquina = limparFormularioMaquina;
    window.calcularMinutoMaquina = calcularMinutoMaquina;
    window.carregarPreDefinido = carregarPreDefinido;
    window.mudarFonte = mudarFonte;
    window.alternarModoEscuro = alternarModoEscuro;
    window.alternarAltoContraste = alternarAltoContraste;
    window.alternarLeitorAudio = alternarLeitorAudio;

    async function carregarIndicadoresMaquinas() {
        try {
            const resposta = await fetch("/api/maquinas/indicadores", { cache: "no-store" });
            const dados = await resposta.json();
            if (!resposta.ok || dados.status !== "sucesso") {
                throw new Error(dados.message || "Falha nos indicadores.");
            }

            const consumo = dados.consumo || {};
            const custos = dados.custos_fixos || {};

            setText("kpi_consumo_eletrico", `${Number(consumo.eletrico || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} kWh`);
            setText("kpi_consumo_agua", `${Number(consumo.agua || 0).toLocaleString("pt-BR", {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³/h`);
            setText("kpi_consumo_gases", `${Number(consumo.gases || 0).toLocaleString("pt-BR", {minimumFractionDigits: 3, maximumFractionDigits: 3})} m³/h`);

            setText("kpi_custo_mao_obra", `${fmtBRL(custos.mao_obra || 0)}/mês`);
            setText("kpi_custo_ocupacao", `${fmtBRL(custos.ocupacao || 0)}/mês`);
            setText("kpi_custo_depreciacao", `${fmtBRL(custos.depreciacao_maquinas || 0)}/mês`);
            setText("kpi_custo_fixo_empresa", `${fmtBRL(custos.total_empresa || 0)}/mês`);

            // Atualiza também os cards de custos que já existiam no cabeçalho.
            setText("top_custo_fixo", `${fmtBRL(custos.total_empresa || 0)}/mês`);
            setText("top_custo_fixo_setor", `${fmtBRL(custos.depreciacao_maquinas || 0)}/mês`);
            setText("pct_custo_fixo_geral", "Mão de obra + ocupação + demais custos fixos registrados");
            setText("pct_custo_fixo_setor", "Depreciação mensal dos ativos de Máquinas");
        } catch (erro) {
            console.error("Erro ao carregar indicadores de máquinas:", erro);
        }
    }

    window.carregarIndicadoresMaquinas = carregarIndicadoresMaquinas;

    document.addEventListener("DOMContentLoaded", async () => {
        await Promise.all([carregarOrcamento(), carregarMaquinas(), carregarIndicadoresMaquinas()]);
        calcularMinutoMaquina();
    });
})();
