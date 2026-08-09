// login/login.js
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

// LEITOR AUDIOVISUAL SEQUENCIAL AUTOMATIZADO (NÃO REQUER USO DO MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel(); // Reseta barulhos na fila
        
        // Coleta os textos estruturais em ordem de leitura contínua
        const blocosTexto = [];
        const titulo = document.getElementById('txt_titulo')?.innerText;
        const sub = document.getElementById('txt_sub')?.innerText;
        const desc = document.getElementById('txt_desc')?.innerText;
        const erro = document.getElementById('msg_erro')?.innerText;
        
        if(titulo) blocosTexto.push(titulo);
        if(sub) blocosTexto.push(sub);
        if(desc) blocosTexto.push(desc);
        if(erro) blocosTexto.push("Mensagem do sistema: " + erro);
        
        blocosTexto.push("Por favor, informe seu usuário no primeiro campo e sua senha no segundo campo.");

        // Transforma o array em um fluxo corrido de áudio pedagógico
        const textoCorrido = blocosTexto.join(". ");
        const utterance = new SpeechSynthesisUtterance(textoCorrido);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0; // Velocidade confortável de reprodução
        
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}
