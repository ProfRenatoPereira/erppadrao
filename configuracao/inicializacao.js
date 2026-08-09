// configuracao/inicializacao.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

function mudarFonte(direcao) {
    tamanhoFonteAtual += direcao;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    document.getElementById('btn_tema').innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

// LEITOR AUDIOVISUAL SEQUENCIAL CONTINUO (NÃO REQUER PASSAR O MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    document.getElementById('btn-leitor-audio').innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const blocos = [
            document.getElementById('txt_titulo')?.innerText,
            document.getElementById('txt_sub')?.innerText,
            "Equipe conectada: " + document.getElementById('txt_equipe')?.innerText,
            document.getElementById('txt_desc')?.innerText,
            "Informe o nome de fantasia da empresa no primeiro campo de texto e insira o valor total do capital social no segundo campo numérico para prosseguir."
        ];
        const utterance = new SpeechSynthesisUtterance(blocos.join(". "));
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}
async function salvarInicializacao(e) {
    e.preventDefault();
    
    const dados = {
        nome_empresa: document.getElementById('nome_empresa').value.trim(),
        capital_total: parseFloat(document.getElementById('capital_total').value) || 0
    };

    const res = await fetch('/api/configuracao/inicializar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    
    const r = await res.json();
    if(r.status === 'sucesso') {
        // Redireciona o grupo diretamente para a Página 1 (Módulo Imobiliário)
        window.location.href = '/estrutura'; 
    } else {
        alert("Erro crítico de persistência. Contate o suporte técnico docente.");
    }
}
