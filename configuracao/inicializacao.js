// ==========================================================================
// TERADMAS ERP v2.6
// ARQUIVO: configuracao/inicializacao.js
// Fluxo: Constituição → Financeiro → Quotas → Setores
// ==========================================================================

let tamanhoFonteAtual = 16;
let leitorAtivo = false;

function mudarFonte(direcao) {
    tamanhoFonteAtual += direcao;

    document.documentElement.style.fontSize =
        Math.max(12, Math.min(24, tamanhoFonteAtual)) + 'px';
}

function alternarModoEscuro() {
    document.body.classList.remove('alto-contraste');
    document.body.classList.toggle('dark-mode');

    const btn = document.getElementById('btn_tema');

    if (btn) {
        btn.innerText = document.body.classList.contains('dark-mode')
            ? "☀️ Claro"
            : "🌙 Escuro";
    }
}

function alternarAltoContraste() {
    document.body.classList.remove('dark-mode');
    document.body.classList.toggle('alto-contraste');
}

// ==========================================================================
// LEITOR DE ÁUDIO
// ==========================================================================

function alternarLeitorAudio() {
    leitorAtivo = !leitorAtivo;

    const btn = document.getElementById('btn-leitor-audio');

    if (btn) {
        btn.innerText = leitorAtivo
            ? "🔇 Desativar Leitor"
            : "🔊 Ativar Leitor";

        btn.style.backgroundColor = leitorAtivo
            ? "#ef4444"
            : "#0284c7";
    }

    if (leitorAtivo) {
        window.speechSynthesis.cancel();

        const blocos = [
            document.getElementById('txt_titulo')?.innerText,
            document.getElementById('txt_sub')?.innerText,
            "Equipe conectada: " +
                document.getElementById('txt_equipe')?.innerText,
            document.getElementById('txt_desc')?.innerText,
            document.getElementById('msg_erro')?.innerText,
            "Informe o nome de fantasia da empresa no primeiro campo " +
            "e insira o valor total do capital social no segundo campo " +
            "para prosseguir."
        ];

        const blocosValidos = blocos.filter(
            b => b && b.trim() !== ''
        );

        const utterance = new SpeechSynthesisUtterance(
            blocosValidos.join(". ")
        );

        utterance.lang = 'pt-BR';

        utterance.onend = function () {
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

// ==========================================================================
// INICIALIZAÇÃO DA EMPRESA
// ==========================================================================

async function salvarInicializacao(e) {
    e.preventDefault();

    window.speechSynthesis.cancel();

    const msgErroDiv = document.getElementById('msg_erro');

    if (msgErroDiv) {
        msgErroDiv.style.display = 'none';
        msgErroDiv.innerText = '';
    }

    const nomeInput = document.getElementById('nome_empresa');
    const capitalInput = document.getElementById('capital_total');

    const dados = {
        nome_empresa: nomeInput?.value.trim() || '',
        capital_total: parseFloat(capitalInput?.value) || 0
    };

    // Proteção adicional no cliente
    if (!dados.nome_empresa) {
        mostrarErroInicializacao(
            "Informe o nome fantasia da empresa."
        );
        return;
    }

    if (!Number.isFinite(dados.capital_total) ||
        dados.capital_total <= 0) {

        mostrarErroInicializacao(
            "Informe um capital inicial válido."
        );
        return;
    }

    try {
        const res = await fetch(
            '/api/configuracao/inicializar',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            }
        );

        const contentType =
            res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error(
                "O servidor retornou uma resposta inválida."
            );
        }

        const r = await res.json();

        if (res.ok && r.status === 'sucesso') {

            /*
             * NOVO FLUXO:
             *
             * A constituição apenas registra a empresa.
             * A divisão de capital é realizada no Financeiro.
             */
            window.location.href = '/financeiro';

            return;
        }

        mostrarErroInicializacao(
            r.message ||
            "Erro crítico de persistência."
        );

    } catch (err) {

        console.error(
            "Erro na comunicação assíncrona:",
            err
        );

        mostrarErroInicializacao(
            "O servidor retornou uma resposta inesperada " +
            "ou está inacessível. Tente novamente."
        );
    }
}

// ==========================================================================
// MENSAGEM ACESSÍVEL DE ERRO
// ==========================================================================

function mostrarErroInicializacao(mensagem) {

    const msgErroDiv =
        document.getElementById('msg_erro');

    if (msgErroDiv) {

        msgErroDiv.innerText = "❌ " + mensagem;
        msgErroDiv.style.display = 'block';

        if (leitorAtivo) {

            window.speechSynthesis.cancel();

            const utterance =
                new SpeechSynthesisUtterance(
                    "Falha na inicialização. " + mensagem
                );

            utterance.lang = 'pt-BR';

            window.speechSynthesis.speak(
                utterance
            );
        }

    } else {
        alert("❌ " + mensagem);
    }
}
