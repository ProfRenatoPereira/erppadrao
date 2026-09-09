let tamanhoFonteAtual = 16;
let leitorAtivo = false;

function mudarFonte(direcao) {
    tamanhoFonteAtual = Math.max(12, Math.min(24, tamanhoFonteAtual + direcao));
    document.documentElement.style.fontSize = tamanhoFonteAtual + 'px';
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('btn_tema');
    if (btn) btn.innerText = document.body.classList.contains('dark-mode') ? '☀️ Claro' : '🌙 Escuro';
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

function falarTexto(texto) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    window.speechSynthesis.speak(u);
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
        'Equipe conectada: ' + (document.getElementById('txt_equipe')?.innerText || ''),
        document.getElementById('txt_desc')?.innerText,
        document.getElementById('msg_erro')?.innerText,
        'Informe o nome da empresa no primeiro campo e o capital social no segundo campo para prosseguir.'
    ].filter(Boolean).map(x => x.trim()).filter(Boolean);

    const u = new SpeechSynthesisUtterance(textos.join('. '));
    u.lang = 'pt-BR';
    u.rate = 1.0;
    u.onend = () => {
        leitorAtivo = false;
        if (btn) {
            btn.innerText = '🔊 Ativar Leitor';
            btn.style.backgroundColor = '#0284c7';
        }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
}

function mostrarErroInicializacao(mensagem) {
    const div = document.getElementById('msg_erro');
    if (!div) return;
    div.innerText = '❌ ' + mensagem;
    div.style.display = 'block';
    if (leitorAtivo) falarTexto('Falha na inicialização. ' + mensagem);
}

async function salvarInicializacao(event) {
    event.preventDefault();

    const div = document.getElementById('msg_erro');
    const btn = document.getElementById('btn-inicializar');
    const nome = document.getElementById('nome_empresa')?.value.trim() || '';
    const capital = Number(document.getElementById('capital_total')?.value);

    if (div) {
        div.style.display = 'none';
        div.innerText = '';
    }

    if (!nome) {
        mostrarErroInicializacao('Informe o nome fantasia da empresa.');
        return;
    }

    if (!Number.isFinite(capital) || capital < 10000) {
        mostrarErroInicializacao('Informe um capital inicial válido de no mínimo R$ 10.000,00.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'INICIALIZANDO...';
    }

    try {
        const res = await fetch('/api/configuracao/inicializar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ nome_empresa: nome, capital_total: capital })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Resposta não JSON do servidor.');
        }

        const r = await res.json();

        if (res.ok && r.status === 'sucesso') {
            window.speechSynthesis.cancel();
            window.location.replace('/financeiro');
            return;
        }

        mostrarErroInicializacao(r.message || 'Erro ao persistir a configuração.');
    } catch (erro) {
        console.error('Erro na inicialização:', erro);
        mostrarErroInicializacao('O servidor retornou uma resposta inesperada ou está inacessível.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'ABRIR CONTA E INICIAR OPERAÇÕES 🚀';
        }
    }
}
