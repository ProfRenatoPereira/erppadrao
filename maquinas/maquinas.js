/* TERADMAS ERP v2.6 - Módulo Máquinas */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const n = (id) => parseFloat($(id)?.value) || 0;
    const money = (v) => Number(v || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    let resultadosWeb = [];

    window.mudarFonte = function (passo) {
        let size = parseInt(getComputedStyle(document.documentElement).fontSize, 10) || 16;
        size = Math.max(12, Math.min(24, size + Number(passo || 0)));
        document.documentElement.style.fontSize = size + "px";
        document.querySelectorAll("p,label,input,select,th,td,h1,h2,h3,h4,span,button,a").forEach(el => el.style.setProperty("font-size", Math.max(9,size-3)+"px","important"));
    };
    window.alternarModoEscuro = function(){ document.body.classList.remove("alto-contraste"); document.body.classList.toggle("dark-mode"); };
    window.alternarAltoContraste = function(){ document.body.classList.remove("dark-mode"); document.body.classList.toggle("alto-contraste"); };
    window.alternarLeitorAudio = function(){
        const btn=$("btn-leitor-audio");
        if(!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const ativo=btn?.getAttribute("aria-pressed")!=="true";
        if(btn){btn.setAttribute("aria-pressed",String(ativo));btn.textContent=ativo?"🔇 Desativar Leitor":"📢 Ativar Leitor";}
        if(ativo){const u=new SpeechSynthesisUtterance("Módulo de Engenharia de Ativos. Pesquise equipamentos reais na internet, confira os dados e depois registre o ativo no Supabase.");u.lang="pt-BR";u.onend=()=>{if(btn){btn.setAttribute("aria-pressed","false");btn.textContent="📢 Ativar Leitor";}};window.speechSynthesis.speak(u);}
    };

    window.carregarPreDefinido = function(){
        const sel=$("seletor_modelo"); const nomes={cnc_mazak:"Torno CNC Mazak Quick Turn",centro_usid:"Centro de Usinagem CNC",torno_mecanico:"Torno Mecânico Convencional",serra_fita:"Serra de Fita Industrial",retifica:"Retífica Cilíndrica",furadeira_radial:"Furadeira Radial",forno_atmo:"Forno de Atmosfera Controlada",forno_reveni:"Forno de Revenimento",compressor_ar:"Compressor de Ar de Parafuso",empilhadeira_ele:"Empilhadeira Elétrica",cestos_inox:"Cestos de Aço Inox (Forno)",palets_aco:"Paletes de Aço Reforçados",caixas_trans:"Caixas Metálicas para Transporte"};
        if(sel?.value && nomes[sel.value]) $("nome_equipamento").value=nomes[sel.value];
        window.calcularMinutoMaquina();
    };

    window.calcularMinutoMaquina = function(){
        const minutos=(n("jornada_semanal")||44)*4.333*60*(n("turnos_trabalho")||1);
        const tarifa=n("custo_estrutural_oculto");
        const energia=n("consumo_eletrico")*minutos/60*tarifa;
        const custo=minutos>0?(n("depreciacao_mensal")+energia)/minutos+n("custo_minuto_operador"):0;
        if($("custo_minuto_maquina")) $("custo_minuto_maquina").value=custo.toFixed(4);
        return custo;
    };

    async function carregarOrcamento(){
        try{
            const r=await fetch("/api/maquinas/orcamento",{cache:"no-store"}); if(!r.ok)return;
            const d=await r.json(); if(d.status!=="sucesso")return;
            const capital=+d.capital_inicial||0, quota=+d.valor_quota||0, patrimonio=+d.patrimonio_atual||0, saldo=+d.saldo_aquisicao||0;
            const pc=capital?saldo/capital*100:0, pp=capital?patrimonio/capital*100:0, pq=quota?Math.min(100,patrimonio/quota*100):0;
            if($("top_capital_total"))$("top_capital_total").textContent=money(capital);
            if($("top_disponivel_setor"))$("top_disponivel_setor").textContent=money(saldo);
            if($("pct_disponivel_setor"))$("pct_disponivel_setor").textContent=`➔ ${pc.toFixed(2)}% do Cap.`;
            if($("top_orcamento_inicial"))$("top_orcamento_inicial").textContent=money(quota);
            if($("pct_orcamento_inicial"))$("pct_orcamento_inicial").textContent=`➔ ${(+d.porcentagem_quota||0).toFixed(2)}% do Cap.`;
            if($("top_verba_reais"))$("top_verba_reais").textContent=money(saldo);
            if($("pct_saldo_engenharia"))$("pct_saldo_engenharia").textContent=`➔ ${pc.toFixed(2)}% do Cap.`;
            if($("top_patrimonio_maquinas"))$("top_patrimonio_maquinas").textContent=money(patrimonio);
            if($("pct_patrimonio_maquinas"))$("pct_patrimonio_maquinas").textContent=`➔ ${pp.toFixed(2)}% do Cap.`;
            if($("txt_valores_limite"))$("txt_valores_limite").textContent=`${money(patrimonio)} / ${money(quota)}`;
            if($("barra_progresso_budget"))$("barra_progresso_budget").style.width=pq+"%";
            if($("txt_porcentagem_budget"))$("txt_porcentagem_budget").textContent=`${pq.toFixed(1)}% da quota consumida`;
        }catch(e){console.error(e);}
    }

    async function carregarMaquinas(){
        const tb=$("tabela_maquinas"); if(!tb)return;
        try{
            const r=await fetch("/api/maquinas/listar",{cache:"no-store"}); if(!r.ok)throw Error();
            const arr=await r.json();
            if(!Array.isArray(arr)||!arr.length){tb.innerHTML='<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;font-weight:bold;">Nenhum ativo mecânico cadastrado.</td></tr>';return;}
            tb.innerHTML=arr.map(m=>`<tr><td style="font-weight:900;color:#1e3a8a;">${esc(m.nome_equipamento||"N/A")}</td><td>⚡ ${esc(m.consumo_eletrico??0)} kWh<br>💧 ${esc(m.consumo_agua??0)} m³/h<br>🔥 ${esc(m.consumo_gases??0)} m³/h</td><td>${esc(m.operador_nome||"Não informado")}</td><td style="font-weight:900;color:#1e3a8a;">${money(m.custo_minuto_maquina||0)}/min</td><td style="text-align:center;white-space:nowrap;"><button type="button" class="btn-top" onclick="window.editarMaquina(${m.id})">Editar</button><button type="button" class="btn-top" style="background:#fef2f2;color:#dc2626;border-color:#fee2e2;" onclick="window.deletarMaquina(${m.id})">Excluir</button></td></tr>`).join("");
        }catch(e){console.error(e);tb.innerHTML='<tr><td colspan="5" style="padding:16px;text-align:center;color:#dc2626;font-weight:bold;">Não foi possível carregar os ativos.</td></tr>';}
    }

    function renderWeb(arr){
        const box=$("resultados_pesquisa_web"); if(!box)return; resultadosWeb=Array.isArray(arr)?arr:[];
        if(!resultadosWeb.length){box.innerHTML='<div style="padding:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;font-weight:bold;">Nenhum equipamento encontrado. Tente tipo, marca, modelo ou característica.</div>';return;}
        box.innerHTML=resultadosWeb.map((r,i)=>{
            const specs=[]; if(r.modelo)specs.push("Modelo: "+esc(r.modelo)); if(r.potencia)specs.push("Potência: "+esc(r.potencia)+" kW"); if(r.consumo_eletrico)specs.push("Consumo: "+esc(r.consumo_eletrico)+" kWh"); if(r.velocidade)specs.push("Velocidade: "+esc(r.velocidade)); if(r.avanco)specs.push("Avanço: "+esc(r.avanco));
            const preco=r.preco?esc((r.moeda||"R$")+" "+r.preco):"Preço não informado";
            return `<article style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#fff;"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;"><div style="min-width:240px;flex:1;"><div style="font-size:13px;font-weight:900;color:#1e3a8a;">${esc(r.titulo||"Equipamento")}</div><div style="font-size:11px;font-weight:700;color:#475569;margin-top:3px;">${esc(r.fabricante||"Fabricante não identificado")}${r.condicao?" • "+esc(r.condicao):""}</div></div><div style="font-size:13px;font-weight:900;color:#166534;white-space:nowrap;">${preco}</div></div><div style="margin-top:8px;font-size:11px;color:#334155;line-height:1.5;">${esc(r.descricao||"")}</div>${specs.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${specs.map(s=>`<span style="background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe;border-radius:6px;padding:3px 6px;font-size:10px;font-weight:800;">${s}</span>`).join("")}</div>`:""}<div style="margin-top:9px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;"><a href="${esc(r.url||"#")}" target="_blank" rel="noopener noreferrer" style="font-size:10px;font-weight:bold;color:#2563eb;">Fonte: ${esc(r.fonte||"Internet")}</a><button type="button" class="btn-top" style="background:#1e3a8a;color:#fff;border-color:#1e3a8a;margin:0;" onclick="window.usarEquipamentoPesquisado(${i})">Usar este equipamento</button></div></article>`;
        }).join("");
    }

    window.pesquisarEquipamentosWeb=async function(){
        const input=$("pesquisa_equipamento_web"), btn=$("btn_pesquisar_web"), box=$("resultados_pesquisa_web"), q=(input?.value||"").trim();
        if(q.length<3){alert("Informe pelo menos 3 caracteres para pesquisar um equipamento.");input?.focus();return;}
        if(btn){btn.disabled=true;btn.textContent="🔎 Pesquisando...";} if(box)box.innerHTML='<div style="padding:12px;color:#1e3a8a;font-size:12px;font-weight:bold;">Pesquisando equipamentos reais na internet...</div>';
        try{const r=await fetch(`/api/maquinas/pesquisar?q=${encodeURIComponent(q)}`,{cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||`HTTP ${r.status}`);renderWeb(d.resultados||[]);}catch(e){if(box)box.innerHTML=`<div style="padding:12px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;font-weight:bold;">${esc(e.message||"Não foi possível pesquisar agora.")}</div>`;}finally{if(btn){btn.disabled=false;btn.textContent="🔎 Pesquisar na Internet";}}
    };

    window.usarEquipamentoPesquisado=function(i){
        const r=resultadosWeb[i];if(!r)return;
        ["potencia","consumo_eletrico","consumo_agua","consumo_gases","velocidade","avanco"].forEach(k=>{if(r[k]!==null&&r[k]!==undefined&&r[k]!=="")$(k).value=r[k];});
        $("nome_equipamento").value=r.titulo||r.nome||"";
        if(r.preco&&String(r.moeda||"R$").includes("R"))$("preco_compra").value=parseFloat(String(r.preco).replace(/\./g,"").replace(",","."))||"";
        window.calcularMinutoMaquina();
        const aviso=$("aviso_origem_pesquisa");if(aviso){aviso.style.display="block";aviso.innerHTML=`Fonte selecionada: <strong>${esc(r.fonte||"Internet")}</strong>. Confira os dados técnicos e o preço antes de registrar.`;}
        $("nome_equipamento")?.scrollIntoView({behavior:"smooth",block:"center"});
    };

    window.salvarMaquina=async function(e){
        e?.preventDefault();const form=$("formMaquina");if(!form?.checkValidity()){form?.reportValidity();return;}window.calcularMinutoMaquina();
        const d={id:$("registro_id")?.value?Number($("registro_id").value):null,nome_equipamento:$("nome_equipamento")?.value?.trim(),potencia:n("potencia"),consumo_eletrico:n("consumo_eletrico"),consumo_agua:n("consumo_agua"),consumo_gases:n("consumo_gases"),velocidade:$("velocidade")?.value||"",avanco:$("avanco")?.value||"",frequencia_manutencao:Number($("frequencia_manutencao")?.value||0),preco_compra:n("preco_compra"),depreciacao_mensal:n("depreciacao_mensal"),valor_venda_final:n("valor_venda_final"),operador_nome:$("operador_nome")?.value||"",custo_minuto_operador:n("custo_minuto_operador"),custo_minuto_maquina:n("custo_minuto_maquina"),jornada_semanal:$("jornada_semanal")?.value||"44",turnos_trabalho:$("turnos_trabalho")?.value||"1",is_patrimonio:!!$("is_patrimonio")?.checked};
        try{const r=await fetch("/api/maquinas/salvar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}),j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="sucesso")throw Error(j.message||"Não foi possível salvar.");alert("✅ Equipamento registrado e salvo no Supabase.");window.limparFormularioMaquina();await carregarMaquinas();await carregarOrcamento();if(typeof window.forcarAtualizacaoMetricasTopboard==="function")window.forcarAtualizacaoMetricasTopboard();}catch(err){alert("❌ "+err.message);}
    };

    window.editarMaquina=async function(id){try{const r=await fetch(`/api/maquinas/buscar/${id}`,{cache:"no-store"}),m=await r.json();if(!r.ok)throw Error(m.message||"Máquina não encontrada.");$("registro_id").value=m.id;["nome_equipamento","potencia","consumo_eletrico","consumo_agua","consumo_gases","velocidade","avanco","frequencia_manutencao","operador_nome","preco_compra","depreciacao_mensal","valor_venda_final","custo_minuto_operador","jornada_semanal","turnos_trabalho"].forEach(k=>{if($(k))$(k).value=m[k]??"";});$("is_patrimonio").checked=m.is_patrimonio!==false;window.calcularMinutoMaquina();$("btn_salvar").textContent="🔄 Atualizar Ativo";$("btn_cancelar").style.display="inline-block";$("formMaquina").scrollIntoView({behavior:"smooth"});}catch(e){alert("❌ "+e.message);}};
    window.deletarMaquina=async function(id){if(!confirm("Confirma a exclusão deste ativo?"))return;try{const r=await fetch(`/api/maquinas/deletar/${id}`,{method:"DELETE"}),j=await r.json().catch(()=>({}));if(!r.ok||j.status!=="removido")throw Error(j.message||"Não foi possível excluir.");await carregarMaquinas();await carregarOrcamento();}catch(e){alert("❌ "+e.message);}};
    window.limparFormularioMaquina=function(){$("formMaquina")?.reset();$("registro_id").value="";$("consumo_agua").value="0.000";$("consumo_gases").value="0.000";$("jornada_semanal").value="44";$("turnos_trabalho").value="1";$("is_patrimonio").checked=true;$("btn_salvar").textContent="💾 Registrar Ativo no Parque Fabril";$("btn_cancelar").style.display="none";if($("resultados_pesquisa_web"))$("resultados_pesquisa_web").innerHTML="";if($("aviso_origem_pesquisa"))$("aviso_origem_pesquisa").style.display="none";window.calcularMinutoMaquina();};

    document.addEventListener("DOMContentLoaded",()=>{
        carregarOrcamento();carregarMaquinas();window.calcularMinutoMaquina();
        $("pesquisa_equipamento_web")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();window.pesquisarEquipamentosWeb();}});
    });
})();
