// ===== CONFIGURAÇÃO DO FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getDatabase, ref, push, onChildAdded, 
    get, set, child, update, onValue, query, orderByChild, equalTo, remove 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCxH1cHvQGzclxy82xTLylyt_s1hm63E84",
    authDomain: "whattsapp-2-d75f2.firebaseapp.com",
    databaseURL: "https://whattsapp-2-d75f2-default-rtdb.firebaseio.com",
    projectId: "whattsapp-2-d75f2",
    storageBucket: "whattsapp-2-d75f2.firebasestorage.app",
    messagingSenderId: "381309225011",
    appId: "1:381309225011:web:a0559ccbc8ee592c707b46",
    measurementId: "G-MQ374PRBNE"
};

// ⬇️ PERSONALIZAÇÃO
const NOME_DO_CHAT = "Meu Chat";
const EMOJI = "💬";
let GRUPOS = ["Geral", "Trabalho", "Estudos", "Família"];

// ===== APLICAR PERSONALIZAÇÃO =====
document.getElementById("tituloChat").textContent = NOME_DO_CHAT;
document.querySelector(".logo").textContent = EMOJI;
document.title = NOME_DO_CHAT;

// ===== ESTADO =====
let nome = "";
let grupoAtual = "";
let recebendoHistorico = true;
let meusAmigos = [];
let mensagensNaoLidas = {};
let db, messagesRef, usuariosRef, amigosRef, canaisRef, presencaRef;
let unsubChat = null;
let unsubAmigos = null;
let unsubGlobalNotif = null;

// ===== ELEMENTOS =====
const $nome         = document.getElementById("telaNome");
const $criarSenha = document.getElementById("telaCriarSenha");
const $senha      = document.getElementById("telaSenha");
const $appContainer = document.getElementById("appContainer");
const $msgs       = document.getElementById("mensagens");
const $entrada    = document.getElementById("entrada");
const $painelAmigos = document.getElementById("painelAmigos");

// ===== INICIALIZAÇÃO =====
const app = initializeApp(firebaseConfig);
db = getDatabase(app);
messagesRef = ref(db, "messages");
usuariosRef = ref(db, "usuarios");
amigosRef = ref(db, "amigos");
canaisRef = ref(db, "canais");
presencaRef = ref(db, "presenca");

// ===== MENU LATERAL (TRÊS BARRINHAS PARA TELEMÓVEL) =====
window.toggleSidebar = function() {
    document.querySelector(".sidebar").classList.toggle("ativa");
};

// ===== MUDAR TEMA (ESCURO / CLARO) =====
window.alternarTema = function() {
    document.body.classList.toggle("light-theme");
};

// ===== NOTIFICAÇÕES =====
function pedirPermissaoNotificacao() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function tocarSom() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
}

function mostrarNotificacao(titulo, corpo) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(titulo, { body: corpo });
    }
}

function notificar(dados) {
    if (dados.nome.toLowerCase() === nome) return;
    if (document.hasFocus()) {
        tocarSom();
        return;
    }
    tocarSom();
    const corpo = dados.tipo === "imagem"
        ? `${dados.nome} enviou uma imagem no grupo ${dados.grupo}`
        : `${dados.nome} (${dados.grupo}): ${dados.texto}`;
    mostrarNotificacao(NOME_DO_CHAT, corpo);
}

// ===== MONITORAR MENSAGENS GLOBAIS (INDICADOR DE NÃO LIDAS) =====
function iniciarOuvinteGlobal() {
    if (unsubGlobalNotif) unsubGlobalNotif();
    
    unsubGlobalNotif = onChildAdded(messagesRef, (snapshot) => {
        const dados = snapshot.val();
        if (!dados || !dados.grupo) return;
        
        if (dados.nome && dados.nome.toLowerCase() !== nome && dados.grupo !== grupoAtual) {
            mensagensNaoLidas[dados.grupo] = true;
            carregarCanaisDinâmicos();
        }
        
        notificar(dados);
    });
}

// ===== AUTENTICAÇÃO =====
async function confirmarNome() {
    const nomeInput = document.getElementById("inputNome").value.trim();
    const erro = document.getElementById("erroNome");

    if (!nomeInput) {
        erro.textContent = "Digite um nome.";
        return;
    }

    nome = nomeInput.toLowerCase();

    try {
        const snapshot = await get(child(usuariosRef, nome));

        if (snapshot.exists()) {
            document.getElementById("nomeSenha").textContent = nomeInput;
            $nome.classList.add("oculto");
            $senha.classList.remove("oculto");
            document.getElementById("inputSenha").focus();
        } else {
            document.getElementById("nomeCriar").textContent = nomeInput;
            $nome.classList.add("oculto");
            $criarSenha.classList.remove("oculto");
            document.getElementById("inputNovaSenha").focus();
        }
    } catch (e) {
        console.error(e);
        erro.textContent = "Erro de conexão com o banco de dados.";
    }
}

async function criarSenha() {
    const nova = document.getElementById("inputNovaSenha").value;
    const confirmar = document.getElementById("inputConfirmarSenha").value;
    const erro = document.getElementById("erroCriarSenha");

    if (nova.length < 4) {
        erro.textContent = "Mínimo 4 caracteres.";
        return;
    }
    if (nova !== confirmar) {
        erro.textContent = "As senhas não conferem.";
        return;
    }

    try {
        await set(child(usuariosRef, nome), { senha: nova });
        mostrarGrupos();
    } catch (e) {
        erro.textContent = "Erro ao salvar. Tente novamente.";
    }
}

async function confirmarSenha() {
    const digitada = document.getElementById("inputSenha").value;
    const erro = document.getElementById("erroSenha");

    try {
        const snapshot = await get(child(usuariosRef, nome));
        if (!snapshot.exists()) {
            erro.textContent = "Nome não encontrado.";
            return;
        }
        if (digitada === snapshot.val().senha) {
            mostrarGrupos();
        } else {
            erro.textContent = "Senha incorreta.";
        }
    } catch (e) {
        erro.textContent = "Algo deu errado. Tente novamente.";
    }
}

document.getElementById("inputNome").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarNome(); });
document.getElementById("inputNovaSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("inputConfirmarSenha").focus(); });
document.getElementById("inputConfirmarSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") criarSenha(); });
document.getElementById("inputSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarSenha(); });

// ===== NAVEGAÇÃO / CANAIS DINÂMICOS =====
function mostrarGrupos() {
    $criarSenha.classList.add("oculto");
    $senha.classList.add("oculto");
    $appContainer.classList.remove("oculto");
    document.getElementById("meuNome").textContent = nome;
    
    carregarCanaisDinâmicos();
    iniciarPresenca();
    iniciarOuvinteGlobal();
}

function carregarCanaisDinâmicos() {
    onValue(canaisRef, (snapshot) => {
        const customCanais = snapshot.val() ? Object.keys(snapshot.val()) : [];
        const todosCanais = [...new Set([...GRUPOS, ...customCanais])];
        renderizarListaCanais(todosCanais);
        if (!grupoAtual && todosCanais.length > 0) {
            entrarNoGrupo(todosCanais[0]);
        }
    });
}

function renderizarListaCanais(canais) {
    const lista = document.getElementById("listaGrupos");
    if (!lista) return;
    lista.innerHTML = "";
    canais.forEach((g) => {
        const btn = document.createElement("button");
        btn.className = "btn-grupo";
        if (g === grupoAtual) btn.classList.add("ativo");
        
        let htmlTexto = `<span># ${g}</span>`;
        if (mensagensNaoLidas[g] && g !== grupoAtual) {
            htmlTexto += `<span class="badge-novo">Novo</span>`;
        }
        
        btn.innerHTML = htmlTexto;
        btn.onclick = () => {
            entrarNoGrupo(g);
            if (window.innerWidth <= 768) toggleSidebar();
        };
        lista.appendChild(btn);
    });
}

window.abrirCriarCanal = async function() {
    const nomeNovo = prompt("Nome do novo canal:");
    if (!nomeNovo) return;
    const formatado = nomeNovo.trim().toLowerCase().replace(/\s+/g, '-');
    await set(child(canaisRef, formatado), true);
};

function entrarNoGrupo(grupo) {
    grupoAtual = grupo;
    document.getElementById("tituloChatHeader").textContent = `# ${grupo}`;
    
    mensagensNaoLidas[grupo] = false;
    carregarCanaisDinâmicos();

    $entrada.focus();
    pedirPermissaoNotificacao();
    iniciarChat();
    carregarAmigos();
}

// ===== PRESENÇA (UTILIZADORES ONLINE) =====
function iniciarPresenca() {
    const meuPresencaRef = child(presencaRef, nome);
    set(meuPresencaRef, true);
    
    onValue(presencaRef, (snapshot) => {
        const online = snapshot.val() ? Object.keys(snapshot.val()) : [];
        const listaOnline = document.getElementById("listaOnline");
        if (!listaOnline) return;
        listaOnline.innerHTML = "";
        online.forEach(u => {
            const div = document.createElement("div");
            div.className = "usuario-online-item";
            div.innerHTML = `<div class="ponto-verde"></div><span>${u}</span>`;
            listaOnline.appendChild(div);
        });
    });
}

// ===== AMIGOS =====
function carregarAmigos() {
    if (unsubAmigos) unsubAmigos();
    const meuAmigosRef = child(amigosRef, nome);
    unsubAmigos = onValue(meuAmigosRef, (snapshot) => {
        const dados = snapshot.val();
        meusAmigos = dados ? Object.keys(dados) : [];
        renderizarListaAmigos();
    });
}

function renderizarListaAmigos() {
    const lista = document.getElementById("listaAmigos");
    if (!lista) return;
    lista.innerHTML = "";
    if (meusAmigos.length === 0) {
        lista.innerHTML = `<p style="color:var(--texto-suave);font-size:0.85rem;">Nenhum amigo ainda.</p>`;
        return;
    }
    meusAmigos.forEach((amigo) => {
        const div = document.createElement("div");
        div.className = "amigo-item";
        div.innerHTML = `<span>⭐ ${escapeHtml(amigo)}</span>
                         <button class="remover" onclick="removerAmigo('${escapeHtml(amigo)}')">✕</button>`;
        lista.appendChild(div);
    });
}

window.abrirAmigos = function() {
    $painelAmigos.classList.remove("oculto");
    carregarAmigos();
}

window.fecharAmigos = function() {
    $painelAmigos.classList.add("oculto");
    if (unsubAmigos) { unsubAmigos(); unsubAmigos = null; }
}

window.adicionarAmigo = async function() {
    const inputEl = document.getElementById("inputAmigo");
    const nomeAmigoInput = inputEl.value.trim();
    if (!nomeAmigoInput) return;

    const nomeAmigo = nomeAmigoInput.toLowerCase();

    if (nomeAmigo === nome) {
        alert("Você não pode adicionar a si mesmo.");
        return;
    }

    try {
        const snapshot = await get(child(usuariosRef, nomeAmigo));

        if (!snapshot.exists()) {
            alert("Este usuário não existe!");
            return;
        }

        const meuAmigosRef = child(amigosRef, nome);
        await update(meuAmigosRef, { [nomeAmigo]: true });
        inputEl.value = "";

    } catch (e) {
        console.error(e);
        alert("Erro ao verificar o usuário. Tente novamente.");
    }
}

window.removerAmigo = async function(nomeAmigo) {
    const meuAmigosRef = child(amigosRef, nome);
    await update(meuAmigosRef, { [nomeAmigo]: null });
}

document.getElementById("inputAmigo")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") adicionarAmigo();
});

// ===== CHAT =====
function iniciarChat() {
    if (unsubChat) unsubChat();

    $msgs.innerHTML = `<div class="msg-sistema" id="placeholder">
        <span>👋</span><p>Bem-vindo ao canal #${escapeHtml(grupoAtual)}!</p>
    </div>`;
    recebendoHistorico = true;

    const mensagensGrupoQuery = query(messagesRef, orderByChild("grupo"), equalTo(grupoAtual));

    unsubChat = onChildAdded(mensagensGrupoQuery, (snapshot) => {
        renderizarMensagem(snapshot.key, snapshot.val());
    });
}

// Formatar timestamp para hora (ex: 14:30)
function formatarHora(timestamp) {
    if (!timestamp) return "";
    const data = new Date(timestamp);
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
}

function renderizarMensagem(idMsg, dados) {
    const placeholder = document.getElementById("placeholder");
    if (placeholder) placeholder.remove();

    if (document.getElementById(`msg-${idMsg}`)) return;

    const div = document.createElement("div");
    const autorMin = dados.nome ? dados.nome.toLowerCase() : "";
    const ehAmigo = meusAmigos.includes(autorMin);
    const badge = ehAmigo ? `<span class="amigo-badge">⭐</span>` : "";
    const nomeEscapado = escapeHtml(dados.nome);
    const inicial = dados.nome ? dados.nome.charAt(0).toUpperCase() : "?";
    const horaFormatada = formatarHora(dados.timestamp);
    const ehMinha = autorMin === nome;

    div.className = `msg ${ehMinha ? "msg-propria" : "msg-outra"}`;
    div.id = `msg-${idMsg}`;

    const cabecalhoHtml = `
        <div class="msg-cabecalho">
            <div class="msg-avatar">${inicial}</div>
            <div class="msg-autor">${nomeEscapado}${badge}</div>
            ${ehMinha ? `<button class="btn-apagar" onclick="apagarMensagem('${idMsg}')" title="Apagar">🗑️</button>` : ''}
        </div>
    `;

    if (dados.tipo === "imagem") {
        div.innerHTML = `${cabecalhoHtml}
                         <img class="msg-img" src="${escapeHtml(dados.base64)}" alt="imagem">
                         <div class="msg-hora">${horaFormatada}</div>`;
    } else if (dados.tipo === "texto") {
        div.innerHTML = `${cabecalhoHtml}
                         <div class="msg-texto">${escapeHtml(dados.texto)}</div>
                         <div class="msg-hora">${horaFormatada}</div>`;
    } else {
        div.className = "msg-sistema";
        div.textContent = dados;
    }

    if (recebendoHistorico) div.classList.add("historico");
    $msgs.appendChild(div);
    $msgs.scrollTop =$msgs.scrollHeight;

    if (recebendoHistorico && $msgs.children.length >= 5) {
        recebendoHistorico = false;
    }
}

window.apagarMensagem = async function(idMsg) {
    if (confirm("Tens a certeza que pretendes apagar esta mensagem?")) {
        try {
            await remove(child(messagesRef, idMsg));
            document.getElementById(`msg-${idMsg}`)?.remove();
        } catch (e) {
            alert("Erro ao apagar mensagem.");
        }
    }
};

function escapeHtml(texto) {
    if (!texto) return "";
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// ===== ENVIAR =====
window.enviar = function() {
    const texto = $entrada.value.trim();
    if (!texto || !grupoAtual) return;
    push(messagesRef, {
        tipo: "texto", nome, texto,
        grupo: grupoAtual,
        timestamp: Date.now()
    });
    $entrada.value = "";
}

window.enviarImagem = function(inputEl) {
    const file = inputEl.files[0];
    if (!file || !grupoAtual) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        push(messagesRef, {
            tipo: "imagem", nome, base64: e.target.result,
            grupo: grupoAtual,
            timestamp: Date.now()
        });
    };
    reader.readAsDataURL(file);
    inputEl.value = "";
}

$entrada.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enviar();
});

// ===== EXPORTAR PARA O HTML =====
window.confirmarNome = confirmarNome;
window.criarSenha = criarSenha;
window.confirmarSenha = confirmarSenha;
window.abrirAmigos = abrirAmigos;
window.fecharAmigos = fecharAmigos;
window.adicionarAmigo = adicionarAmigo;
window.removerAmigo = removerAmigo;
window.enviar = enviar;
window.enviarImagem = enviarImagem;
