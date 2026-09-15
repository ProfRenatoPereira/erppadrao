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
    function carregarPreDefinido() {
        const select = document.getElementById("seletor_modelo");
        if (!select?.value) return;
        const texto = select.options[select.selectedIndex]?.textContent?.trim() || "";
        if (!document.getElementById("nome_equipamento")?.value.trim()) setVal("nome_equipamento", texto);
        setVal("modelo", texto);
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
