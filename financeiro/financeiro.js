/**
 * TERADMAS ERP v2.6 - financeiro/financeiro.js
 * Contrato preservado: IDs e endpoints do módulo financeiro.
 * Sem CSS externo. Sem listeners duplicados.
 */
let capitalDisponivelGlobal=0, faturamentoTotalGlobal=0, deptoAtual="", dashboardEmExecucao=false;
const formatarBRL=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const el=id=>document.getElementById(id);

function status(msg,erro=false){const e=el("financeiro-status");if(!e)return;e.textContent=msg;e.className=erro?"status-msg status-erro":"status-msg";e.style.display=msg?"block":"none"}

async function carregarDashboardFinanceiro(){
 if(dashboardEmExecucao)return; dashboardEmExecucao=true;
 try{
  const r=await fetch("/api/financeiro/metricas",{cache:"no-store"}); if(!r.ok)throw Error(`HTTP ${r.status}`);
  const m=await r.json(); capitalDisponivelGlobal=Number(m.capital_disponivel_total)||0; faturamentoTotalGlobal=Number(m.patrimonio_ativo_total)||0;
  if(el("global-capital-total"))el("global-capital-total").textContent=formatarBRL(m.capital_total);
  if(el("global-capital-disponivel"))el("global-capital-disponivel").textContent=formatarBRL(capitalDisponivelGlobal);
  if(el("global-patrimonio"))el("global-patrimonio").textContent=formatarBRL(faturamentoTotalGlobal);
  if(el("global-custo-fixo"))el("global-custo-fixo").textContent=formatarBRL(m.custo_fixo_geral_empresa);
  const ct=Number(m.capital_total)||0;
  if(el("global-porcento-capital"))el("global-porcento-capital").textContent=ct?"100% da fundação":"";
  if(el("global-porcento-disponivel"))el("global-porcento-disponivel").textContent=ct?`${(capitalDisponivelGlobal/ct*100).toFixed(1)}% do capital`:"";
  if(el("global-porcento-patrimonio"))el("global-porcento-patrimonio").textContent=ct?`${(faturamentoTotalGlobal/ct*100).toFixed(1)}% do capital`:"";
  if(el("global-last-update"))el("global-last-update").textContent=`🔄 Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`;
  recalcularMetricasPainel(); await Promise.all([renderizarResumoQuotas(),carregarLivroRazao()]);
 }catch(e){console.error(e);status(`Não foi possível atualizar o painel financeiro: ${e.message}`,true)}
 finally{dashboardEmExecucao=false}
}

function pctAtual(){return Math.max(0,Math.min(100,Number(el("percentual_valor")?.value)||0))}
function atualizarVisualizacaoQuota(v){v=Math.max(0,Math.min(100,Number(v)||0));if(el("percentual_valor"))el("percentual_valor").value=v;if(el("percentual_quota"))el("percentual_quota").value=v;recalcularMetricasPainel()}
function atualizarSliderQuota(v){atualizarVisualizacaoQuota(v)}
function recalcularMetricasPainel(){const v=capitalDisponivelGlobal*pctAtual()/100;if(el("valor_alocado_reais"))el("valor_alocado_reais").value=formatarBRL(v)}

async function atualizarDetalhesSetor(){
 deptoAtual=el("departamento_selecionado")?.value||""; if(!deptoAtual){el("info_setor").style.display="none";atualizarVisualizacaoQuota(0);return}
 try{const r=await fetch(`/api/financeiro/quota/${encodeURIComponent(deptoAtual)}`,{cache:"no-store"});if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();atualizarVisualizacaoQuota(d.porcentagem_quota||0);el("info_setor_texto").innerHTML=`Módulo destino <strong>/${deptoAtual}</strong>. Quota salva: <strong>${pctAtual()}%</strong>.`;el("info_setor").style.display="block"}catch(e){console.error(e);el("info_setor").style.display="block";el("info_setor_texto").textContent="Não foi possível consultar a quota atual."}
}

async function efetuarFaturamento(ev){
 ev.preventDefault(); const p={cliente_id:Number(el("fat_cliente_id").value)||0,cliente_nome_suporte:el("fat_cliente_name").value.trim(),financeiro_descricao:el("fat_descricao").value.trim(),financeiro_valor:Number(el("fat_valor").value)||0,financeiro_condicao:el("fat_condicao").value,financeiro_data:el("fat_data").value};
 if(p.cliente_id<=0||!p.cliente_nome_suporte||!p.financeiro_descricao||p.financeiro_valor<=0||!p.financeiro_data){status("Preencha corretamente todos os campos.",true);return}
 try{const r=await fetch("/api/financeiro/faturar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}),d=await r.json();if(!r.ok||d.status!=="sucesso")throw Error(d.message||`HTTP ${r.status}`);alert("Título de faturamento registrado com sucesso no Razão!");el("formFaturamento").reset();await carregarDashboardFinanceiro()}catch(e){console.error(e);status(`Erro ao registrar faturamento: ${e.message}`,true)}
}

async function liquidarTitulo(id){
 if(!confirm(`Confirmar liquidação e entrada física em caixa do título FT-00${id}?`))return;
 try{const r=await fetch(`/api/financeiro/liquidar/${id}`,{method:"POST"}),d=await r.json();if(!r.ok||d.status!=="sucesso")throw Error(d.message||`HTTP ${r.status}`);alert("Título liquidado com sucesso! Saldo injetado no Caixa de Giro.");await carregarDashboardFinanceiro()}catch(e){console.error(e);status(`Falha ao liquidar título: ${e.message}`,true)}
}

async function salvarAlocacaoSetorial(ev){
 ev.preventDefault();if(!deptoAtual){status("Selecione um módulo de destino.",true);return}
 try{const r=await fetch("/api/financeiro/quota",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({departamento_id:deptoAtual,porcentagem_quota:pctAtual()})}),d=await r.json();if(!r.ok||d.status!=="sucesso")throw Error(d.message||`HTTP ${r.status}`);alert("Quota setorial parametrizada e salva com sucesso!");await carregarDashboardFinanceiro();await atualizarDetalhesSetor()}catch(e){console.error(e);status(`Erro ao salvar quota: ${e.message}`,true)}
}

async function renderizarResumoQuotas(){
 const c=el("tabela_quotas_resumo");if(!c)return;
 try{const r=await fetch("/api/financeiro/quotas/summary",{cache:"no-store"});if(!r.ok)throw Error(`HTTP ${r.status}`);const a=await r.json();c.innerHTML="";if(!a.length){c.textContent="Sem quotas setoriais parametrizadas.";return}
 a.forEach(s=>{const p=Math.max(0,Math.min(100,Number(s.porcentagem_quota)||0));const b=document.createElement("div");b.style.cssText="padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px";b.innerHTML=`<div style="display:flex;justify-content:space-between;font-weight:bold"><span>📍 /${s.departamento_id}</span><span style="color:#16a34a">${p}% (${formatarBRL(capitalDisponivelGlobal*p/100)})</span></div><div class="barra-percentual-setor"><div class="preenchimento-barra" style="width:${p}%"></div></div>`;c.appendChild(b)})}catch(e){console.error(e);c.textContent="Não foi possível carregar as quotas."}
}

async function carregarLivroRazao(){
 const tb=el("tabela_financeiro");if(!tb)return;
 try{const r=await fetch("/api/financeiro/listar",{cache:"no-store"});if(!r.ok)throw Error(`HTTP ${r.status}`);const a=await r.json();tb.innerHTML="";if(!a.length){tb.innerHTML="<tr><td colspan='5' style='text-align:center'>Nenhum título localizado no razão contábil.</td></tr>";return}
 a.forEach(i=>{const tr=document.createElement("tr");tr.innerHTML=`<td><strong>FT-00${i.id}</strong><br><small>ID: ${i.cliente_id}</small></td><td><strong></strong><br><small></small></td><td><span></span></td><td><strong></strong><br><small></small></td><td style="text-align:center"></td>`;
 tr.children[1].firstChild.textContent=i.cliente_nome_suporte||"";tr.children[1].lastChild.textContent=i.financeiro_descricao||"";
 const badge=tr.children[2].firstChild;badge.textContent=String(i.status_titulo||"").toUpperCase();badge.style.cssText=String(i.status_titulo).toLowerCase()==="aberto"?"background:#fef3c7;color:#d97706;padding:2px 6px;border-radius:4px;font-weight:bold":"background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:4px;font-weight:bold";
 tr.children[3].firstChild.textContent=formatarBRL(i.financeiro_valor);tr.children[3].lastChild.textContent=`${i.financeiro_condicao||""} | ${i.financeiro_data||""}`;
 if(String(i.status_titulo).toLowerCase()==="aberto"){const b=document.createElement("button");b.className="btn-submit";b.style.width="auto";b.style.padding="4px 8px";b.textContent="⚡ Liquidar";b.onclick=()=>liquidarTitulo(Number(i.id));tr.children[4].appendChild(b)}else{tr.children[4].textContent="✓ Em Caixa"}tb.appendChild(tr)})}catch(e){console.error(e);tb.innerHTML="<tr><td colspan='5' style='text-align:center;color:#991b1b'>Falha ao carregar o livro razão.</td></tr>"}
}

document.addEventListener("DOMContentLoaded",()=>{el("formFaturamento")?.addEventListener("submit",efetuarFaturamento);el("formAlocacao")?.addEventListener("submit",salvarAlocacaoSetorial);el("departamento_selecionado")?.addEventListener("change",atualizarDetalhesSetor);el("percentual_quota")?.addEventListener("input",e=>atualizarVisualizacaoQuota(e.target.value));el("percentual_valor")?.addEventListener("input",e=>atualizarSliderQuota(e.target.value));carregarDashboardFinanceiro();setInterval(carregarDashboardFinanceiro,5000)});
