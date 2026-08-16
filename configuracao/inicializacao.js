/* erppadrao - configuracao/inicializacao.js - PARTE 1 DE 2 */
let escalaFonteGlobal = 16;

// Força a injeção do tamanho dinâmico usando style.setProperty com !important
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

// Vinculação explícita das funções lógicas ao escopo de janela global
window.mudarFonte = mudarFonte;
window.alternarAltoContraste = alternarAltoContraste;
window.alternarModoEscuro = alternarModoEscuro;
/* erppadrao - configuracao/inicializacao.js - PARTE 2 DE 2 */
async function salvarInicializacao(event) {
    // 🎯 BLOQUEIO CRÍTICO: Impede o recarregamento padrão da página e a interrogação (?) na URL
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    // Captura os elementos de forma cascata cobrindo seletores por tipo
    const inputNome = document.querySelector('input[type="text"]');
    const inputCapital = document.querySelector('input[type="number"]');
    
    let valorCapital = 0;
    if (inputCapital) {
        // Higienização completa contra formatações de string para enviar um número flutuante puro
        let textoCapital = inputCapital.value.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        valorCapital = parseFloat(textoCapital) || 0;
    }

    // Estruturação do payload síncrono com as chaves esperadas pela rota defensiva do Python
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
            // Desvia o fluxo linear diretamente para o módulo Imobiliário
            window.location.href = resultado.redirect || '/estrutura';
        } else {
            alert("❌ Erro na validação: Certifique-se de preencher o nome da organização e o aporte de capital inicial.");
        }
    } catch (erro) {
        console.error("Falha transacional de barramento:", erro);
        alert("❌ Erro de barramento: O servidor central do Render não respondeu à requisição assíncrona.");
    }
}

// Vinculação automática ao formulário no carregamento do DOM
window.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    if (form) {
        form.onsubmit = salvarInicializacao;
    }
});
