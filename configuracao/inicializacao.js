// erppadrao - configuracao/inicializacao.js
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

// LEITOR AUDIOVISUAL SEQUENCIAL CONTÍNUO (NÃO REQUER PASSAR O MOUSE)
function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');
    
    if (btn) {
        btn.innerText = leitorAtivo ? "🔇 Desativar Leitor" : "🔊 Ativar Leitor";
        btn.style.backgroundColor = leitorAtivo ? "#ef4444" : "#0284c7";
    }
    
    if (leitorAtivo) {
        window.speechSynthesis.cancel();
        const blocos = [
            document.getElementById('txt_titulo')?.innerText,
            document.getElementById('txt_sub')?.innerText,
            "Equipe conectada: " + document.getElementById('txt_equipe')?.innerText,
            document.getElementById('txt_desc')?.innerText,
            document.getElementById('msg_erro')?.innerText,
            "Informe o nome de fantasia da empresa no primeiro campo de texto e insira o valor total do capital social no segundo campo numérico para prosseguir."
        ];
        
        // Remove blocos vazios ou nulos antes de narrar
        const blocosValidos = blocos.filter(b => b && b.trim() !== '');
        
        const utterance = new SpeechSynthesisUtterance(blocosValidos.join(". "));
        utterance.lang = 'pt-BR';
        
        // Restaura o botão automaticamente quando a leitura terminar por completo
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

// SALVAMENTO ASSÍNCRONO COM TRATAMENTO E ALERTA ACESSÍVEL DE ERROS
async function salvarInicializacao(e) {
    e.preventDefault();
    window.speechSynthesis.cancel();
    
    const msgErroDiv = document.getElementById('msg_erro');
    if (msgErroDiv) {
        msgErroDiv.style.display = 'none';
        msgErroDiv.innerText = '';
    }
    
    const dados = {
        nome_empresa: document.getElementById('nome_empresa').value.trim(),
        capital_total: parseFloat(document.getElementById('capital_total').value) || 0
    };

    try {
        const res = await fetch('/api/configuracao/inicializar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});

        // Proteção contra respostas do servidor que não sejam JSON (Páginas de erro HTML)
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("O servidor retornou uma resposta inválida (HTML/Erro Interno).");
        }

        const r = await res.json();
        
        if (res.ok && r.status === 'sucesso') {
            // 🌟 CORREÇÃO DE FLUXO: Redireciona para o painel principal (Grid) unificado
            window.location.href = '/grid'; 
        } else {
            const erroTxt = r.message || "Erro crítico de persistência. Verifique os dados informados.";
            if (msgErroDiv) {
                msgErroDiv.innerText = "❌ " + erroTxt;
                msgErroDiv.style.display = 'block';
                
                if (leitorAtivo) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance("Falha na inicialização. " + erroTxt);
                    utterance.lang = 'pt-BR';
                    window.speechSynthesis.speak(utterance);
                }
            } else {
                alert("❌ Erro: " + erroTxt);
            }
        }
    } catch (err) {
        console.error("Erro na comunicação assíncrona:", err);
        if (msgErroDiv) {
            msgErroDiv.innerText = "❌ O servidor retornou uma resposta inesperada ou está inacessível. Tente novamente.";
            msgErroDiv.style.display = 'block';
        } else {
            alert("❌ Erro de Comunicação: Falha ao processar a requisição no servidor.");
        }
    }
}
