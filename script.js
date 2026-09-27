// ===== CONFIGURAÇÃO DO FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getDatabase, ref, push, onChildAdded, 
    get, set, child, update, onValue, query, orderByChild, equalTo 
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

// ⬇️ CONFIGURAÇÕES DA APLICAÇÃO
const NOME_DO_CHAT = "Meu Chat";
const EMOJI = "💬";
const GRUPOS = ["Geral", "Trabalho", "Estudos", "Família"];

// ===== APLICAR PERSONALIZAÇÃO =====
document.getElementById("tituloChat").textContent = NOME_DO_CHAT;
document.querySelector(".logo").textContent = EMOJI;
document.title = NOME_DO_CHAT;

// ===== ESTADO =====
let nome = "";
let grupoAtual = "";
let recebendoHistorico = true;
let meusAmigos = [];
let db, messagesRef, usuariosRef, amigosRef;
let unsubChat = null;
let unsubAmigos = null;

// ===== ELEMENTOS =====
const $nome        = document.getElementById("telaNome");
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
    if (dados.nome === nome) return;
    if (document.hasFocus()) {
        tocarSom();
        return;
    }
    tocarSom();
    const corpo = dados.tipo === "imagem"
        ? `${dados.nome} enviou uma imagem`
        : `${dados.nome}: ${dados.texto}`;
    mostrarNotificacao(NOME_DO_CHAT, corpo);
}

// ===== AUTENTICAÇÃO =====
async function confirmarNome() {
    const nomeInput = document.getElementById("inputNome").value.trim();
    const erro = document.getElementById("erroNome");

    if (!nomeInput) {
        erro.textContent = "Digite um nome.";
        return;
    }

    nome = nomeInput;

    try {
        const snapshot = await get(child(usuariosRef, nome));

        if (snapshot.exists()) {
            document.getElementById("nomeSenha").textContent = nome;
            $nome.classList.add("oculto");
            $senha.classList.remove("oculto");
            document.getElementById("inputSenha").focus();
        } else {
            document.getElementById("nomeCriar").textContent = nome;
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

// ===== NAVEGAÇÃO / GRUPOS =====
function mostrarGrupos() {
    $criarSenha.classList.add("oculto");
    $senha.classList.add("oculto");
    $appContainer.classList.remove("oculto");
    document.getElementById("meuNome").textContent = nome;
    renderizarGrupos();
    
    if (GRUPOS.length > 0) {
        entrarNoGrupo(GRUPOS[0]);
    }
}

function renderizarGrupos() {
    const lista = document.getElementById("listaGrupos");
    lista.innerHTML = "";
    GRUPOS.forEach((g) => {
        const btn = document.createElement("button");
        btn.className = "btn-grupo";
        btn.textContent = g;
        btn.onclick = () => entrarNoGrupo(g);
        lista.appendChild(btn);
    });
}

function entrarNoGrupo(grupo) {
    grupoAtual = grupo;
    document.getElementById("tituloChatHeader").textContent = grupo;

    document.querySelectorAll(".btn-grupo").forEach(btn => {
        btn.classList.toggle("ativo", btn.textContent === grupo);
    });

    $entrada.focus();
    pedirPermissaoNotificacao();
    iniciarChat();
    carregarAmigos();
}

// ===== AMIGOS (COM VALIDAÇÃO DE CONTA EXISTENTE) =====
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

function abrirAmigos() {
    $painelAmigos.classList.remove("oculto");
    carregarAmigos();
}

function fecharAmigos() {
    $painelAmigos.classList.add("oculto");
    if (unsubAmigos) { unsubAmigos(); unsubAmigos = null; }
}

async function adicionarAmigo() {
    const nomeAmigo = document.getElementById("inputAmigo").value.trim();
    if (!nomeAmigo) return;

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
        document.getElementById("inputAmigo").value = "";

    } catch (e) {
        console.error(e);
        alert("Erro ao verificar o usuário. Tente novamente.");
    }
}

async function removerAmigo(nomeAmigo) {
    const meuAmigosRef = child(amigosRef, nome);
    await update(meuAmigosRef, { [nomeAmigo]: null });
}

document.getElementById("inputAmigo").addEventListener("keydown", (e) => {
    if (e.key === "Enter") adicionarAmigo();
});

// ===== CHAT =====
function iniciarChat() {
    if (unsubChat) unsubChat();

    $msgs.innerHTML = `<div class="msg-sistema" id="placeholder">
        <span>👋</span><p>Bem-vindo ao grupo ${escapeHtml(grupoAtual)}!</p>
    </div>`;
    recebendoHistorico = true;

    const mensagensGrupoQuery = query(messagesRef, orderByChild("grupo"), equalTo(grupoAtual));

    unsubChat = onChildAdded(mensagensGrupoQuery, (snapshot) => {
        const dados = snapshot.val();
        renderizarMensagem(dados);
        notificar(dados);
    });
}

function renderizarMensagem(dados) {
    const placeholder = document.getElementById("placeholder");
    if (placeholder) placeholder.remove();

    const div = document.createElement("div");
    const ehAmigo = meusAmigos.includes(dados.nome);
    const badge = ehAmigo ? `<span class="amigo-badge">⭐</span>` : "";
    const nomeEscapado = escapeHtml(dados.nome);

    if (dados.tipo === "imagem") {
        div.className = `msg ${dados.nome === nome ? "msg-propria" : "msg-outra"}`;
        div.innerHTML = `<div class="msg-autor">${nomeEscapado}${badge}</div>
                         <img class="msg-img" src="${escapeHtml(dados.base64)}" alt="imagem">`;
    } else if (dados.tipo === "texto") {
        div.className = `msg ${dados.nome === nome ? "msg-propria" : "msg-outra"}`;
        div.innerHTML = `<div class="msg-autor">${nomeEscapado}${badge}</div>
                         <div class="msg-texto">${escapeHtml(dados.texto)}</div>`;
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

function escapeHtml(texto) {
    if (!texto) return "";
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

// ===== ENVIAR =====
function enviar() {
    const texto = $entrada.value.trim();
    if (!texto || !grupoAtual) return;
    push(messagesRef, {
        tipo: "texto", nome, texto,
        grupo: grupoAtual,
        timestamp: Date.now()
    });
    $entrada.value = "";
}

function enviarImagem(inputEl) {
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

// ===== EXPORTAR PARA O HTML (ONCLICK) =====
window.confirmarNome = confirmarNome;
window.criarSenha = criarSenha;
window.confirmarSenha = confirmarSenha;
window.abrirAmigos = abrirAmigos;
window.fecharAmigos = fecharAmigos;
window.adicionarAmigo = adicionarAmigo;
window.removerAmigo = removerAmigo;
window.enviar = enviar;
window.enviarImagem = enviarImagem;
