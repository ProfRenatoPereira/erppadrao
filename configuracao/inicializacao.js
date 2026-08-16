/* erppadrao - configuracao/inicializacao.js - PARTE 1 DE 2 */
let escalaFonteGlobal = 16;

// Motor JavaScript que força a injeção do tamanho dinâmico anulando classes fixas de pixel
function mudarFonte(direcao) {
    escalaFonteGlobal += direcao;
    if (escalaFonteGlobal < 12) escalaFonteGlobal = 12;
    if (escalaFonteGlobal > 22) escalaFonteGlobal = 22;
    document.documentElement.style.setProperty('font-size', escalaFonteGlobal + 'px', 'important');
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const botaoTema = document.getElementById('btn_tema');
    if (botaoTema) {
        botaoTema.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
    }
}

// Vinculação explícita ao escopo global do navegador
window.mudarFonte = mudarFonte;
window.alternarAltoContraste = alternarAltoContraste;
window.alternarModoEscuro = alternarModoEscuro;
/* erppadrao - configuracao/inicializacao.js - PARTE 2 DE 2 */
async function salvarInicializacao(event) {
    if (event && event.preventDefault) event.preventDefault();
    
    // Captura os inputs de forma cascata cobrindo IDs e seletores genéricos
    const inputNome = document.getElementById('nome_fantasia') || document.querySelector('input[name="nome_fantasia"]') || document.querySelector('input[type="text"]');
    const inputCapital = document.getElementById('capital_social') || document.querySelector('input[name="capital_social"]') || document.querySelector('input[type="number"]');
    
    let valorCapital = 0;
    if (inputCapital) {
        // Higienização de caracteres de moeda para evitar falhas de tipagem (ValueError) no Python
        let textoCapital = inputCapital.value.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        valorCapital = parseFloat(textoCapital) || 0;
    }

    // 🎯 PAYLOAD DEFINIDO: Vincula os valores higienizados exatamente às chaves do formulário
    const payload = {
        nome_fantasia: inputNome ? inputNome.value.trim() : '',
        capital_social: valorCapital
    };

    try {
        const resposta = await fetch('/api/configuracao/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (resposta.ok) {
            const resultado = await resposta.json();
            // Redireciona síncrono para o módulo imobiliário (/estrutura) aprovado pelo backend
            window.location.href = resultado.redirect || '/estrutura';
        } else {
            alert("❌ Erro na validação dos dados de capital. Certifique-se de que o nome da organização e o aporte inicial estão corretos.");
        }
    } catch (erro) {
        console.error("Falha transacional de barramento:", erro);
        alert("❌ Falha de barramento: O servidor central do Render não respondeu.");
    }
}

// Vinculação segura atrelada ao ciclo de vida do DOM
window.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form') || document.getElementById('formInicializacao');
    if (form) {
        form.onsubmit = salvarInicializacao;
    }
});
