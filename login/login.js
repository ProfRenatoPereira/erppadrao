// erppadrao - login/login.js
let tamanhoFonteAtual = 16;
let leitorAtivo = false;

function mudarFonte(direcao) {
    tamanhoFonteAtual += direcao;
    document.documentElement.style.fontSize = Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) {
        btn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Claro" : "🌙 Escuro";
    }
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

// LEITOR AUDIOVISUAL SEQUENCIAL AUTOMATIZADO (NÃO REQUER USO DO MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
    }
    
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
        if(erro && erro.trim() !== '') blocosTexto.push("Mensagem do sistema: " + erro);
        
        blocosTexto.push("Por favor, informe seu usuário no primeiro campo e sua senha no segundo campo.");

        // Transforma o array em um fluxo corrido de áudio pedagógico
        const textoCorrido = blocosTexto.join(". ");
        const utterance = new SpeechSynthesisUtterance(textoCorrido);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0; // Velocidade confortável de reprodução
        
        // 🔄 RESTAURA O BOTÃO AUTOMATICAMENTE QUANDO O ÁUDIO TERMINAR
        utterance.onend = function() {
            leitorAtivo = false;
            if (btn) {
                btn.innerText = "🔊 Ativar Leitor";
                btn.style.backgroundColor = "#0284c7";
            }
        };
        
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
}

// FUNÇÃO DE AUTENTICAÇÃO ASSÍNCRONA INTEGRADA
async function ejecutarAutenticacaoEstudantil() {
    const idEquipeInput = document.getElementById('id_equipe')?.value.trim();
    const senhaInput = document.getElementById('senha')?.value.trim();
    const msgErroDiv = document.getElementById('msg_erro');

    if (!idEquipeInput || !senhaInput) {
        window.speechSynthesis.cancel();
        alert("⚠️ Por favor, preencha todos os campos antes de continuar.");
        return;
    }

    // Reseta a caixa de erro antes de uma nova tentativa
    if (msgErroDiv) {
        msgErroDiv.style.display = 'none';
        msgErroDiv.innerText = '';
    }

    const dados = {
        id_equipe: idEquipeInput,
        senha: senhaInput
    };

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("O servidor retornou uma resposta inválida (HTML/Erro Interno).");
        }

        const r = await res.json();
        if (res.ok && r.status === 'sucesso') {
            window.speechSynthesis.cancel();
            window.location.href = r.redirecionar;
        } else {
            const erroTxt = r.message || "Credenciais incorretas.";
            if (msgErroDiv) {
                msgErroDiv.innerText = erroTxt;
                msgErroDiv.style.display = 'block';
                
                // Se o leitor de áudio estiver ativo, narra o erro imediatamente
                if (leitorAtivo) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance("Falha na Autenticação. " + erroTxt);
                    utterance.lang = 'pt-BR';
                    window.speechSynthesis.speak(utterance);
                }
            } else {
                alert("❌ Falha na Autenticação: " + erroTxt);
            }
        }
    } catch (erro) {
        console.error(erro);
        alert("❌ Erro de Comunicação: O servidor retornou uma resposta inesperada ou está inacessível.");
    }
}
