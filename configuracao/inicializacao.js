/* erppadrao - configuracao/inicializacao.js - PARTE 1 DE 2 */
let escalaFonteGlobal = 16;

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
}

window.mudarFonte = mudarFonte;
window.alternarAltoContraste = alternarAltoContraste;
window.alternarModoEscuro = alternarModoEscuro;
/* erppadrao - configuracao/inicializacao.js - PARTE 2 DE 2 */
async function salvarInicializacao(event) {
    if (event && event.preventDefault) event.preventDefault();
    
    // Captura os elementos da tela de forma segura
    const inputNome = document.querySelector('input[type="text"]');
    const inputCapital = document.querySelector('input[type="number"]');
    const erroCard = document.querySelector('.card style') || document.getElementById('erro_alerta') || document.querySelector('div[style*="background-color: #fff1f2"]');
    
    // 🎯 A CORREÇÃO CRÍTICA: Define explicitamente o payload que estava faltando na linha 86!
    const payload = {
        nome_fantasia: inputNome ? inputNome.value : '',
        capital_social: inputCapital ? parseFloat(inputCapital.value) : 0
    };

    try {
        const resposta = await fetch('/api/configuracao/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // Agora a variável existe e não quebra!
        });

        if (resposta.ok) {
            const resultado = await resposta.json();
            // Direciona para o fluxo correto (/estrutura) retornado pelo backend
            window.location.href = resultado.redirect || '/estrutura';
        } else {
            const msgErro = await resposta.text();
            console.error("Erro devolvido pelo servidor:", msgErro);
            alert("❌ Erro na validação dos dados de capital.");
        }
    } catch (erro) {
        console.error("Erro na comunicação assíncrona:", erro);
        alert("❌ O servidor central do Render não respondeu à requisição.");
    }
}

// Vincula a função ao formulário assim que a página carregar
window.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (form) {
        form.onsubmit = salvarInicializacao;
    }
});
