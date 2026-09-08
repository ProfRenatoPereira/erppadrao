let tamanhoFonteAtual = 16;
let leitorAtivo = false;

function mudarFonte(direcao) {
    tamanhoFonteAtual += direcao;
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual));
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) {
        btn.innerText = document.body.classList.contains('dark-mode') ? '☀️ Claro' : '🌙 Escuro';
    }
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function falarTexto(texto) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;
    const btn = document.getElementById('btn-leitor-audio');

    if (btn) {
        btn.innerText = leitorAtivo ? '🔇 Desativar Leitor' : '🔊 Ativar Leitor';
        btn.style.backgroundColor = leitorAtivo ? '#ef4444' : '#0284c7';
    }

    if (!leitorAtivo) {
        window.speechSynthesis.cancel();
        return;
    }

    const textos = [
        document.getElementById('txt_titulo')?.innerText,
        document.getElementById('txt_sub')?.innerText,
        document.getElementById('txt_desc')?.innerText,
        document.getElementById('msg_erro')?.innerText,
        'Informe o identificador da equipe no primeiro campo e a senha no segundo campo.'
    ].filter(Boolean).map(t => t.trim()).filter(Boolean);

    const utterance = new SpeechSynthesisUtterance(textos.join('. '));
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.onend = () => {
        leitorAtivo = false;
        if (btn) {
            btn.innerText = '🔊 Ativar Leitor';
            btn.style.backgroundColor = '#0284c7';
        }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function mostrarErroLogin(mensagem) {
    const div = document.getElementById('msg_erro');
    if (!div) return;

    div.innerText = '❌ ' + mensagem;
    div.style.display = 'block';

    if (leitorAtivo) {
        falarTexto('Falha na autenticação. ' + mensagem);
    }
}

async function executarAutenticacaoEstudantil(event) {
    if (event) event.preventDefault();

    const idEquipe = document.getElementById('id_equipe')?.value.trim() || '';
    const senha = document.getElementById('senha')?.value || '';
    const btn = document.getElementById('btn-login');
    const div = document.getElementById('msg_erro');

    if (div) {
        div.style.display = 'none';
        div.innerText = '';
    }

    if (!idEquipe || !senha) {
        mostrarErroLogin('Preencha o usuário e a senha.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'VALIDANDO...';
    }

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id_equipe: idEquipe, senha: senha })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Resposta não JSON do servidor.');
        }

        const resultado = await res.json();

        if (res.ok && resultado.status === 'sucesso') {
            window.speechSynthesis.cancel();
            window.location.replace(resultado.redirecionar || '/');
            return;
        }

        mostrarErroLogin(resultado.message || 'Credenciais inválidas.');
    } catch (erro) {
        console.error('Erro no login:', erro);
        mostrarErroLogin('Não foi possível comunicar com o servidor. Tente novamente.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'VALIDAR CREDENCIAIS DE ACESSO';
        }
    }
}
