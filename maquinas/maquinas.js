/* ==========================================================================\n   TERADMAS ERP v2.6 - MÓDULO 07\n   Máquinas: pesquisa externa + cadastro Supabase + orçamento\n   ========================================================================== */
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
       MODELOS BASE: apenas auxilia o cadastro; não substitui a pesquisa web.
       ---------------------------------------------------------------------- */
    function carregarPreDefinido() {
        const select = document.getElementById("seletor_modelo");
        if (!select?.value) return;
        const texto = select.options[select.selectedIndex]?.textContent?.trim() || "";
        if (!document.getElementById("nome_equipamento")?.value.trim()) setVal("nome_equipamento", texto);
        setVal("modelo", texto);
    }

    /* ----------------------------------------------------------------------
       PESQUISA NA INTERNET
       ---------------------------------------------------------------------- */
    async function pesquisarEquipamentoInternet() {
        const input = document.getElementById("pesquisa_equipamento");
        const termo = input?.value.trim();
        const painel = document.getElementById("resultado_pesquisa_internet");
        const botao = document.getElementById("btn_pesquisar_internet");
        if (!termo) {
            alert("Digite o equipamento que deseja pesquisar.");
            return;
        }

        if (botao) { botao.disabled = true; botao.textContent = "🔎 Pesquisando..."; }
        if (painel) painel.innerHTML = `<div style="font-size:11px;color:#64748b;padding:6px;">Consultando fontes externas...</div>`;

        try {
            const resposta = await fetch(`/api/maquinas/pesquisar?q=${encodeURIComponent(termo)}`, { cache: "no-store" });
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.message || "Falha na pesquisa.");

            if (!dados.resultados?.length) {
                painel.innerHTML = `<div style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:8px;border-radius:6px;">⚠️ ${escapeHtml(dados.message || "Nenhum resultado encontrado.")}</div>`;
                return;
            }

            painel.innerHTML = dados.resultados.map((r, indice) => {
                const preco = r.preco_compra != null ? fmtBRL(r.preco_compra) : "Preço não informado";
                const potencia = r.potencia != null ? `${r.potencia} kW${r.potencia_unidade ? ` (a partir de ${r.potencia_unidade})` : ""}` : "Potência não identificada";
                return `
                    <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                            <div style="min-width:0;flex:1;">
                                <div style="font-size:12px;font-weight:900;color:#1e3a8a;">${escapeHtml(r.titulo)}</div>
                                <div style="font-size:10px;color:#475569;margin-top:2px;">${escapeHtml(r.snippet || "Sem descrição disponível.")}</div>
                            </div>
                            <div style="font-size:11px;font-weight:900;color:#047857;white-space:nowrap;">${escapeHtml(preco)}</div>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:10px;color:#334155;">⚙️ ${escapeHtml(potencia)}</span>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <a href="${escapeAttr(r.url)}" target="_blank" rel="noopener" style="font-size:10px;color:#1d4ed8;font-weight:bold;">Fonte</a>
                                <button type="button" class="btn-top" style="background:#1e3a8a;color:#fff;border-color:#1e3a8a;margin:0;" onclick="window.usarResultadoPesquisa(${indice})">Usar este equipamento</button>
                            </div>
                        </div>
                    </div>`;
            }).join("");

            window._resultadosPesquisaMaquinas = dados.resultados;
        } catch (erro) {
            console.error("Erro na pesquisa de equipamentos:", erro);
            painel.innerHTML = `<div style="font-size:11px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:8px;border-radius:6px;">❌ ${escapeHtml(erro.message)}</div>`;
        } finally {
            if (botao) { botao.disabled = false; botao.textContent = "🔎 Pesquisar na Internet"; }
        }
    }

    function usarResultadoPesquisa(indice) {
        const r = window._resultadosPesquisaMaquinas?.[indice];
        if (!r) return;

        setVal("nome_equipamento", r.titulo || "");
        setVal("fonte_url", r.url || "");
        setVal("modelo", r.titulo || "");
        if (r.potencia != null) setVal("potencia", r.potencia);
        if (r.preco_compra != null) setVal("preco_compra", r.preco_compra.toFixed(2));

        const titulo = document.getElementById("txt_sub");
        if (titulo) titulo.textContent = "⚙️ Painel de Parametrização e Inserção de Ativos Industriais — EQUIPAMENTO PESQUISADO";
        document.getElementById("formMaquina")?.scrollIntoView({ behavior: "smooth", block: "start" });
        alert("Dados encontrados foram trazidos para o formulário. Confira as características técnicas e complete os campos que a fonte não informou antes de registrar.");
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
    window.pesquisarEquipamentoInternet = pesquisarEquipamentoInternet;
    window.usarResultadoPesquisa = usarResultadoPesquisa;
    window.mudarFonte = mudarFonte;
    window.alternarModoEscuro = alternarModoEscuro;
    window.alternarAltoContraste = alternarAltoContraste;
    window.alternarLeitorAudio = alternarLeitorAudio;

    document.addEventListener("DOMContentLoaded", async () => {
        const pesquisa = document.getElementById("pesquisa_equipamento");
        pesquisa?.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                pesquisarEquipamentoInternet();
            }
        });
        await Promise.all([carregarOrcamento(), carregarMaquinas()]);
        calcularMinutoMaquina();
    });
})();
