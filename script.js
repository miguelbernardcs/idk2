// ===== CONFIGURAÇÃO DO FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getDatabase, ref, push, onChildAdded, 
    get, set, child, update, onValue, query, orderByChild, equalTo, remove, onDisconnect 
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

const NOME_DO_CHAT = "Meu Chat";
const EMOJI = "💬";
let GRUPOS = ["Geral", "Trabalho", "Estudos", "Família"];

document.getElementById("tituloChat").textContent = NOME_DO_CHAT;
document.querySelector(".logo").textContent = EMOJI;
document.title = NOME_DO_CHAT;

let nome = localStorage.getItem("chat_usuario") || "";
let grupoAtual = "";
let recebendoHistorico = true;
let meusAmigos = [];
let mensagensNaoLidas = {};
let db, messagesRef, usuariosRef, amigosRef, canaisRef, presencaRef;
let unsubChat = null;
let unsubAmigos = null;
let unsubGlobalNotif = null;

const $nome = document.getElementById("telaNome");
const $criarSenha = document.getElementById("telaCriarSenha");
const $senha = document.getElementById("telaSenha");
const $appContainer = document.getElementById("appContainer");
const $msgs = document.getElementById("mensagens");
const $entrada = document.getElementById("entrada");
const $painelAmigos = document.getElementById("painelAmigos");

const app = initializeApp(firebaseConfig);
db = getDatabase(app);
messagesRef = ref(db, "messages");
usuariosRef = ref(db, "usuarios");
amigosRef = ref(db, "amigos");
canaisRef = ref(db, "canais");
presencaRef = ref(db, "presenca");

// ===== VERIFICAÇÃO DE SESSÃO AUTOMÁTICA =====
window.addEventListener("DOMContentLoaded", async () => {
    if (nome) {
        try {
            const snapshot = await get(child(usuariosRef, nome));
            if (snapshot.exists()) {
                mostrarGrupos();
            } else {
                localStorage.removeItem("chat_usuario");
                nome = "";
            }
        } catch (e) {
            mostrarGrupos();
        }
    }
});

// ===== MODAIS PERSONALIZADOS =====
let modalCallback = null;

function abrirModalPersonalizado({ icone, titulo, mensagem, tipo, placeholder = "" }) {
    return new Promise((resolve) => {
        const modal = document.getElementById("modalCustomizado");
        document.getElementById("modalIcone").textContent = icone || "💬";
        document.getElementById("modalTitulo").textContent = titulo;
        document.getElementById("modalMensagem").textContent = mensagem;
        
        const input = document.getElementById("modalInput");
        const btnCancelar = document.getElementById("modalBtnCancelar");
        
        if (tipo === "prompt") {
            input.classList.remove("oculto");
            input.value = "";
            input.placeholder = placeholder;
            btnCancelar.classList.remove("oculto");
            setTimeout(() => input.focus(), 50);
        } else if (tipo === "confirm") {
            input.classList.add("oculto");
            btnCancelar.classList.remove("oculto");
        } else {
            input.classList.add("oculto");
            btnCancelar.classList.add("oculto");
        }

        modal.classList.remove("oculto");
        modalCallback = resolve;
    });
}

window.fecharModalCustomizado = function(resultado) {
    const modal = document.getElementById("modalCustomizado");
    const input = document.getElementById("modalInput");
    
    let valor = true;
    if (!input.classList.contains("oculto")) {
        valor = resultado ? input.value : null;
    } else {
        valor = resultado;
    }

    modal.classList.add("oculto");
    if (modalCallback) {
        modalCallback(valor);
        modalCallback = null;
    }
};

// ===== MENU DE GESTÃO DE CONTA (MUDAR NOME / DELETAR) =====
window.abrirMenuConta = async function() {
    const acao = await abrirModalPersonalizado({
        icone: "⚙️",
        titulo: "Gerir Conta",
        mensagem: `O que pretendes fazer na conta de @${nome}?`,
        tipo: "confirm"
    });

    // Usamos o modal de confirmação como base, mas vamos perguntar especificamente
    // Para simplificar, abrimos prompts customizados em sequência se o utilizador quiser
};

// Substituímos por funções diretas limpas no clique do nome:
window.abrirMenuConta = async function() {
    const escolha = await abrirModalPersonalizado({
        icone: "⚙️",
        titulo: "Opções de Conta",
        mensagem: "Escolhe uma opção:\n1. Digita 'Mudar' para alterar o teu nome\n2. Digita 'Deletar' para apagar a tua conta",
        tipo: "prompt",
        placeholder: "Mudar ou Deletar"
    });

    if (!escolha) return;
    const op = escolha.trim().toLowerCase();

    if (op === "mudar") {
        const novoNomeInput = await abrirModalPersonalizado({
            icone: "✏️",
            titulo: "Mudar Nome de Utilizador",
            mensagem: "Digite o novo nome pretendido:",
            tipo: "prompt",
            placeholder: "Novo nome..."
        });

        if (!novoNomeInput || !novoNomeInput.trim()) return;
        const novoNome = novoNomeInput.trim().toLowerCase();

        if (novoNome === nome) {
            await abrirModalPersonalizado({ icone: "⚠️", titulo: "Aviso", mensagem: "Esse já é o teu nome atual.", tipo: "alert" });
            return;
        }

        try {
            // Verifica se o nome já está em uso
            const snapshot = await get(child(usuariosRef, novoNome));
            if (snapshot.exists()) {
                await abrirModalPersonalizado({ icone: "❌", titulo: "Indisponível", mensagem: "Este nome já está em uso por outro utilizador!", tipo: "alert" });
                return;
            }

            // Pega os dados atuais da senha
            const dadosAtuais = (await get(child(usuariosRef, nome))).val();

            // Salva no novo nome e apaga o antigo
            await set(child(usuariosRef, novoNome), dadosAtuais);
            await remove(child(usuariosRef, nome));
            await remove(child(presencaRef, nome));

            // Atualiza sessão local
            nome = novoNome;
            localStorage.setItem("chat_usuario", nome);
            document.getElementById("meuNome").textContent = nome;
            
            await abrirModalPersonalizado({ icone: "✅", titulo: "Sucesso", mensagem: "Nome alterado com sucesso!", tipo: "alert" });
            location.reload();
        } catch (e) {
            await abrirModalPersonalizado({ icone: "❌", titulo: "Erro", mensagem: "Erro ao atualizar o nome.", tipo: "alert" });
        }

    } else if (op === "deletar") {
        const confirmarDel = await abrirModalPersonalizado({
            icone: "⚠️",
            titulo: "Eliminar Conta",
            mensagem: "Tens a certeza absoluta? Esta ação apaga os teus dados de acesso permanentemente.",
            tipo: "confirm"
        });

        if (confirmarDel) {
            try {
                await remove(child(usuariosRef, nome));
                await remove(child(amigosRef, nome));
                await remove(child(presencaRef, nome));
                localStorage.removeItem("chat_usuario");
                await abrirModalPersonalizado({ icone: "🗑️", titulo: "Conta Apagada", mensagem: "A tua conta foi eliminada.", tipo: "alert" });
                location.reload();
            } catch (e) {
                await abrirModalPersonalizado({ icone: "❌", titulo: "Erro", mensagem: "Erro ao eliminar a conta.", tipo: "alert" });
            }
        }
    }
};

// ===== MENU & TEMA =====
window.toggleSidebar = function() {
    document.querySelector(".sidebar").classList.toggle("ativa");
};

window.alternarTema = function() {
    document.body.classList.toggle("light-theme");
};

window.sairDaConta = function() {
    localStorage.removeItem("chat_usuario");
    location.reload();
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
    if (!nomeInput) { erro.textContent = "Digite um nome."; return; }
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
        erro.textContent = "Erro de conexão.";
    }
}

async function criarSenha() {
    const nova = document.getElementById("inputNovaSenha").value;
    const confirmar = document.getElementById("inputConfirmarSenha").value;
    const erro = document.getElementById("erroCriarSenha");
    if (nova.length < 4) { erro.textContent = "Mínimo 4 caracteres."; return; }
    if (nova !== confirmar) { erro.textContent = "As senhas não conferem."; return; }

    try {
        await set(child(usuariosRef, nome), { senha: nova });
        localStorage.setItem("chat_usuario", nome);
        mostrarGrupos();
    } catch (e) { erro.textContent = "Erro ao salvar."; }
}

async function confirmarSenha() {
    const digitada = document.getElementById("inputSenha").value;
    const erro = document.getElementById("erroSenha");
    try {
        const snapshot = await get(child(usuariosRef, nome));
        if (!snapshot.exists()) { erro.textContent = "Nome não encontrado."; return; }
        if (digitada === snapshot.val().senha) {
            localStorage.setItem("chat_usuario", nome);
            mostrarGrupos();
        } else { erro.textContent = "Senha incorreta."; }
    } catch (e) { erro.textContent = "Erro."; }
}

document.getElementById("inputNome").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarNome(); });
document.getElementById("inputNovaSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("inputConfirmarSenha").focus(); });
document.getElementById("inputConfirmarSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") criarSenha(); });
document.getElementById("inputSenha").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmarSenha(); });

// ===== NAVEGAÇÃO / CANAIS =====
function mostrarGrupos() {
    $nome.classList.add("oculto");
    $criarSenha.classList.add("oculto");
    $senha.classList.add("oculto");
    $appContainer.classList.remove("oculto");
    document.getElementById("meuNome").textContent = `${nome} ⚙️`;
    document.getElementById("meuNome").title = "Gerir Conta";
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
    const nomeNovo = await abrirModalPersonalizado({
        icone: "➕",
        titulo: "Criar Novo Canal",
        mensagem: "Digite o nome para o novo canal:",
        tipo: "prompt",
        placeholder: "Ex: Jogos, Filmes..."
    });

    if (!nomeNovo || !nomeNovo.trim()) return;
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

// ===== PRESENÇA AUTOMÁTICA =====
function iniciarPresenca() {
    const meuPresencaRef = child(presencaRef, nome);
    set(meuPresencaRef, "online");
    onDisconnect(meuPresencaRef).set("offline");
    
    onValue(presencaRef, (snapshot) => {
        const dados = snapshot.val() || {};
        const listaOnline = document.getElementById("listaOnline");
        if (!listaOnline) return;
        listaOnline.innerHTML = "";
        
        Object.keys(dados).forEach(u => {
            const status = dados[u];
            const div = document.createElement("div");
            div.className = "usuario-online-item";
            
            if (status === "online") {
                div.innerHTML = `<div class="ponto-verde"></div><span>${u}</span>`;
            } else {
                div.innerHTML = `<div class="ponto-vermelho"></div><span>${u} (offline)</span>`;
            }
            listaOnline.appendChild(div);
        });
    });
}

// ===== AMIGOS =====
function carregarAmigos() {
    if (unsubAmigos) unsubAmigos();
    unsubAmigos = onValue(child(amigosRef, nome), (snapshot) => {
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

window.abrirAmigos = () => { $painelAmigos.classList.remove("oculto"); carregarAmigos(); };
window.fecharAmigos = () => { $painelAmigos.classList.add("oculto"); if (unsubAmigos) { unsubAmigos(); unsubAmigos = null; } };

window.adicionarAmigo = async function() {
    const inputEl = document.getElementById("inputAmigo");
    const nomeAmigo = inputEl.value.trim().toLowerCase();
    if (!nomeAmigo) return;

    if (nomeAmigo === nome) {
        await abrirModalPersonalizado({ icone: "⚠️", titulo: "Aviso", mensagem: "Você não pode adicionar a si mesmo.", tipo: "alert" });
        return;
    }

    try {
        const snapshot = await get(child(usuariosRef, nomeAmigo));
        if (!snapshot.exists()) {
            await abrirModalPersonalizado({ icone: "❌", titulo: "Erro", mensagem: "Este usuário não existe!", tipo: "alert" });
            return;
        }
        await update(child(amigosRef, nome), { [nomeAmigo]: true });
        inputEl.value = "";
    } catch (e) {
        await abrirModalPersonalizado({ icone: "❌", titulo: "Erro", mensagem: "Erro ao verificar o usuário.", tipo: "alert" });
    }
};

window.removerAmigo = async (amigo) => {
    await update(child(amigosRef, nome), { [amigo]: null });
};

document.getElementById("inputAmigo")?.addEventListener("keydown", (e) => { if (e.key === "Enter") adicionarAmigo(); });

// ===== CHAT =====
function iniciarChat() {
    if (unsubChat) unsubChat();
    $msgs.innerHTML = `<div class="msg-sistema" id="placeholder"><span>👋</span><p>Bem-vindo ao canal #${escapeHtml(grupoAtual)}!</p></div>`;
    recebendoHistorico = true;

    const mensagensGrupoQuery = query(messagesRef, orderByChild("grupo"), equalTo(grupoAtual));
    unsubChat = onChildAdded(mensagensGrupoQuery, (snapshot) => {
        renderizarMensagem(snapshot.key, snapshot.val());
    });
}

function formatarHora(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
        div.innerHTML = `${cabecalhoHtml}<img class="msg-img" src="${escapeHtml(dados.base64)}" alt="imagem"><div class="msg-hora">${horaFormatada}</div>`;
    } else if (dados.tipo === "texto") {
        div.innerHTML = `${cabecalhoHtml}<div class="msg-texto">${escapeHtml(dados.texto)}</div><div class="msg-hora">${horaFormatada}</div>`;
    } else {
        div.className = "msg-sistema";
        div.textContent = dados;
    }

    if (recebendoHistorico) div.classList.add("historico");
    $msgs.appendChild(div);
    $msgs.scrollTop =$msgs.scrollHeight;

    if (recebendoHistorico && $msgs.children.length >= 5) recebendoHistorico = false;
}

window.apagarMensagem = async function(idMsg) {
    const confirmar = await abrirModalPersonalizado({
        icone: "🗑️",
        titulo: "Apagar Mensagem",
        mensagem: "Tens a certeza que pretendes apagar esta mensagem?",
        tipo: "confirm"
    });

    if (confirmar) {
        try {
            await remove(child(messagesRef, idMsg));
            document.getElementById(`msg-${idMsg}`)?.remove();
        } catch (e) {
            console.error(e);
        }
    }
};

function escapeHtml(texto) {
    if (!texto) return "";
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

window.enviar = function() {
    const texto = $entrada.value.trim();
    if (!texto || !grupoAtual) return;
    push(messagesRef, { tipo: "texto", nome, texto, grupo: grupoAtual, timestamp: Date.now() });
    $entrada.value = "";
};

window.enviarImagem = function(inputEl) {
    const file = inputEl.files[0];
    if (!file || !grupoAtual) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        push(messagesRef, { tipo: "imagem", nome, base64: e.target.result, grupo: grupoAtual, timestamp: Date.now() });
    };
    reader.readAsDataURL(file);
    inputEl.value = "";
};

$entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });

// Exports
window.confirmarNome = confirmarNome;
window.criarSenha = criarSenha;
window.confirmarSenha = confirmarSenha;
window.abrirAmigos = abrirAmigos;
window.fecharAmigos = fecharAmigos;
window.adicionarAmigo = adicionarAmigo;
window.removerAmigo = removerAmigo;
window.enviar = enviar;
window.enviarImagem = enviarImagem;
