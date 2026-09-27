import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getDatabase, ref, push, onChildAdded, 
    get, set, child, update, onValue, remove, off, onChildRemoved 
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

document.getElementById("tituloChat").textContent = NOME_DO_CHAT;
document.getElementById("tituloChatHeader").textContent = NOME_DO_CHAT;
document.querySelector(".logo").textContent = EMOJI;
document.title = NOME_DO_CHAT;

let nome = "";
let grupoAtual = "";
let meusAmigos = [];
let db, messagesRef, usuariosRef, amigosRef, gruposRef, chamadasRef;
let unsubChat = null;
let unsubAmigos = null;

let mediaRecorder = null;
let audioChunks = [];
let peerConnection = null;
let localStream = null;
let remoteStream = null;

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const $nome         = document.getElementById("telaNome");
const $criarSenha   = document.getElementById("telaCriarSenha");
const $senha        = document.getElementById("telaSenha");
const $grupos       = document.getElementById("telaGrupos");
const $chat         = document.getElementById("telaChat");
const $msgs         = document.getElementById("mensagens");
const $entrada      = document.getElementById("entrada");
const $painelAmigos = document.getElementById("painelAmigos");
const $painelGrupo  = document.getElementById("painelGrupo");

const app = initializeApp(firebaseConfig);
db = getDatabase(app);
messagesRef = ref(db, "messages");
usuariosRef = ref(db, "usuarios");
amigosRef   = ref(db, "amigos");
gruposRef   = ref(db, "grupos");
chamadasRef = ref(db, "chamadas");

async function inicializarGruposPadrao() {
    const padrao = ["Geral", "Trabalho", "Estudos", "Família"];
    for (const g of padrao) {
        const snap = await get(child(gruposRef, g));
        if (!snap.exists()) {
            await set(child(gruposRef, g), { nome: g, privado: false, adm: "Sistema" });
        }
    }
}
inicializarGruposPadrao();

// AUTENTICAÇÃO E PERFIL
async function confirmarNome() {
    const nomeInput = document.getElementById("inputNome").value.trim();
    const erro = document.getElementById("erroNome");
    if (!nomeInput) return erro.textContent = "Digite um nome.";
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
    } catch (e) { erro.textContent = "Erro de conexão com o banco."; }
}

async function criarSenha() {
    const nova = document.getElementById("inputNovaSenha").value;
    const confirmar = document.getElementById("inputConfirmarSenha").value;
    const erro = document.getElementById("erroCriarSenha");
    if (nova.length < 4) return erro.textContent = "Mínimo 4 caracteres.";
    if (nova !== confirmar) return erro.textContent = "As senhas não conferem.";

    try {
        await set(child(usuariosRef, nome), { senha: nova });
        mostrarGrupos();
    } catch (e) { erro.textContent = "Erro ao salvar."; }
}

async function confirmarSenha() {
    const digitada = document.getElementById("inputSenha").value;
    const erro = document.getElementById("erroSenha");
    try {
        const snapshot = await get(child(usuariosRef, nome));
        if (snapshot.exists() && digitada === snapshot.val().senha) {
            mostrarGrupos();
        } else { erro.textContent = "Senha incorreta."; }
    } catch (e) { erro.textContent = "Erro de conexão."; }
}

async function alterarNomePerfil() {
    const novoNome = prompt("Digite seu novo nome de exibição:", nome);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === nome) return;
    const snap = await get(child(usuariosRef, novoNome.trim()));
    if (snap.exists()) return alert("Este nome já está em uso.");

    const senhaAtual = (await get(child(usuariosRef, nome))).val().senha;
    await remove(child(usuariosRef, nome));
    nome = novoNome.trim();
    await set(child(usuariosRef, nome), { senha: senhaAtual });

    document.getElementById("meuNome").textContent = `${nome} • ${grupoAtual}`;
    alert("Nome atualizado!");
}

async function excluirMinhaConta() {
    if (confirm("Deseja apagar sua conta permanentemente?")) {
        await remove(child(usuariosRef, nome));
        await remove(child(amigosRef, nome));
        location.reload();
    }
}

// GESTÃO DE GRUPOS PRIVADOS & ADM
function mostrarGrupos() {
    $criarSenha.classList.add("oculto");
    $senha.classList.add("oculto");
    $grupos.classList.remove("oculto");
    renderizarGrupos();
}

function renderizarGrupos() {
    const lista = document.getElementById("listaGrupos");
    onValue(gruposRef, (snapshot) => {
        lista.innerHTML = "";
        const dados = snapshot.val() || {};
        Object.keys(dados).forEach((gId) => {
            const g = dados[gId];
            const ehMembro = g.membros && g.membros[nome];
            if (!g.privado || ehMembro || g.adm === nome) {
                const btn = document.createElement("button");
                btn.className = "btn-grupo";
                btn.textContent = g.privado ? `🔒 ${g.nome}` : g.nome;
                btn.onclick = () => entrarNoGrupo(g.nome);
                lista.appendChild(btn);
            }
        });
    });
}

async function criarNovoGrupo() {
    const nomeG = document.getElementById("inputNovoGrupo").value.trim();
    if (!nomeG) return;

    await set(child(gruposRef, nomeG), {
        nome: nomeG,
        privado: true,
        adm: nome,
        membros: { [nome]: true }
    });

    document.getElementById("inputNovoGrupo").value = "";
    entrarNoGrupo(nomeG);
}

async function entrarNoGrupo(grupo) {
    grupoAtual = grupo;
    $grupos.classList.add("oculto");
    $chat.classList.remove("oculto");
    document.getElementById("meuNome").textContent = `${nome} • ${grupo}`;
    document.getElementById("tituloChatHeader").textContent = grupo;
    $entrada.focus();

    // Checar se o usuário é o ADM do grupo
    const snap = await get(child(gruposRef, `${grupoAtual}/adm`));
    const btnGerenciar = document.getElementById("btnGerenciarGrupo");
    if (snap.exists() && snap.val() === nome) {
        btnGerenciar.classList.remove("oculto");
    } else {
        btnGerenciar.classList.add("oculto");
    }

    iniciarChat();
    carregarAmigos();
    escutarChamadasEntrando();
}

function mudarGrupo() {
    $chat.classList.add("oculto");
    $grupos.classList.remove("oculto");
    renderizarGrupos();
}

// PAINEL DE ADM (MEMBROS DO GRUPO)
function abrirGerenciadorGrupo() {
    $painelGrupo.classList.remove("oculto");
    carregarMembrosGrupo();
}

function fecharGerenciadorGrupo() { $painelGrupo.classList.add("oculto"); }

function carregarMembrosGrupo() {
    const lista = document.getElementById("listaMembrosGrupo");
    onValue(child(gruposRef, `${grupoAtual}/membros`), (snap) => {
        lista.innerHTML = "";
        const membros = snap.val() || {};
        Object.keys(membros).forEach((m) => {
            const div = document.createElement("div");
            div.className = "amigo-item";
            div.innerHTML = `<span>👤 ${m}</span>
                             ${m !== nome ? `<button class="remover" onclick="removerMembro('${m}')">✕</button>` : ''}`;
            lista.appendChild(div);
        });
    });
}

async function adicionarMembro() {
    const novoM = document.getElementById("inputNovoMembro").value.trim();
    if (!novoM) return;
    const snap = await get(child(usuariosRef, novoM));
    if (!snap.exists()) return alert("Usuário não encontrado.");

    await update(child(gruposRef, `${grupoAtual}/membros`), { [novoM]: true });
    document.getElementById("inputNovoMembro").value = "";
}

async function removerMembro(membro) {
    await remove(child(gruposRef, `${grupoAtual}/membros/${membro}`));
}

// AMIGOS
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
    lista.innerHTML = "";
    if (meusAmigos.length === 0) {
        return lista.innerHTML = `<p style="color:var(--texto-suave);font-size:0.85rem;">Nenhum amigo ainda.</p>`;
    }
    meusAmigos.forEach((amigo) => {
        const div = document.createElement("div");
        div.className = "amigo-item";
        div.innerHTML = `<span>⭐ ${amigo}</span><button class="remover" onclick="removerAmigo('${amigo}')">✕</button>`;
        lista.appendChild(div);
    });
}

function abrirAmigos() { $painelAmigos.classList.remove("oculto"); carregarAmigos(); }
function fecharAmigos() { $painelAmigos.classList.add("oculto"); }

async function adicionarAmigo() {
    const nomeAmigo = document.getElementById("inputAmigo").value.trim();
    if (!nomeAmigo || nomeAmigo === nome) return;
    await update(child(amigosRef, nome), { [nomeAmigo]: true });
    document.getElementById("inputAmigo").value = "";
}

async function removerAmigo(nomeAmigo) {
    await update(child(amigosRef, nome), { [nomeAmigo]: null });
}

// CHAT E MENSAGENS
function iniciarChat() {
    if (unsubChat) unsubChat();
    $msgs.innerHTML = `<div class="msg-sistema" id="placeholder"><span>👋</span><p>Bem-vindo! Suas mensagens aparecerão aqui.</p></div>`;

    unsubChat = onChildAdded(messagesRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados.grupo === grupoAtual) renderizarMensagem(dados);
    });
}

function renderizarMensagem(dados) {
    const placeholder = document.getElementById("placeholder");
    if (placeholder) placeholder.remove();

    const div = document.createElement("div");
    const ehAmigo = meusAmigos.includes(dados.nome);
    const badge = ehAmigo ? `<span class="amigo-badge">⭐</span>` : "";

    div.className = `msg ${dados.nome === nome ? "msg-propria" : "msg-outra"}`;

    if (dados.tipo === "imagem") {
        div.innerHTML = `<div class="msg-autor">${dados.nome}${badge}</div><img class="msg-img" src="${dados.base64}" alt="imagem">`;
    } else if (dados.tipo === "audio") {
        div.innerHTML = `<div class="msg-autor">${dados.nome}${badge}</div><audio controls src="${dados.audio}"></audio>`;
    } else {
        div.innerHTML = `<div class="msg-autor">${dados.nome}${badge}</div><div class="msg-texto">${escapeHtml(dados.texto)}</div>`;
    }

    $msgs.appendChild(div);
    $msgs.scrollTop =$msgs.scrollHeight;
}

function escapeHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

function enviar() {
    const texto = $entrada.value.trim();
    if (!texto) return;
    push(messagesRef, { tipo: "texto", nome, texto, grupo: grupoAtual, timestamp: Date.now() });
    $entrada.value = "";
}

function enviarImagem(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        push(messagesRef, { tipo: "imagem", nome, base64: e.target.result, grupo: grupoAtual, timestamp: Date.now() });
    };
    reader.readAsDataURL(file);
    inputEl.value = "";
}

// ÁUDIO E VÍDEOCHAMADA (WEBRTC)
async function iniciarGravacaoAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            const reader = new FileReader();
            reader.onloadend = () => {
                push(messagesRef, { tipo: "audio", nome, audio: reader.result, grupo: grupoAtual, timestamp: Date.now() });
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
    } catch (err) { alert("Microfone indisponível."); }
}

function pararGravacaoAudio() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
}

async function iniciarChamada(comVideo = true) {
    try {
        const callRef = child(chamadasRef, grupoAtual);
        await remove(callRef);

        localStream = await navigator.mediaDevices.getUserMedia({ video: comVideo, audio: true });
        remoteStream = new MediaStream();

        document.getElementById("containerVideo").classList.remove("oculto");
        document.getElementById("localVideo").srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
            document.getElementById("remoteVideo").srcObject = remoteStream;
        };

        const offerCandidates = child(callRef, "offerCandidates");
        const answerCandidates = child(callRef, "answerCandidates");

        peerConnection.onicecandidate = (e) => { if (e.candidate) push(offerCandidates, e.candidate.toJSON()); };

        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        await set(child(callRef, "offer"), { sdp: offerDescription.sdp, type: offerDescription.type, de: nome });

        onValue(child(callRef, "answer"), (snap) => {
            const data = snap.val();
            if (data && !peerConnection.currentRemoteDescription) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            }
        });

        onChildAdded(answerCandidates, (snap) => peerConnection.addIceCandidate(new RTCIceCandidate(snap.val())));
    } catch (err) { alert("Erro na chamada: " + err.message); }
}

function escutarChamadasEntrando() {
    const callRef = child(chamadasRef, grupoAtual);
    onValue(child(callRef, "offer"), async (snap) => {
        const data = snap.val();
        if (data && data.de !== nome && !peerConnection) {
            if (confirm(`${data.de} está chamando. Atender?`)) atenderChamada(data);
        }
    });
    onChildRemoved(callRef, () => desligarChamadaLocal());
}

async function atenderChamada(offerData) {
    try {
        const callRef = child(chamadasRef, grupoAtual);
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        remoteStream = new MediaStream();

        document.getElementById("containerVideo").classList.remove("oculto");
        document.getElementById("localVideo").srcObject = localStream;

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (e) => {
            e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
            document.getElementById("remoteVideo").srcObject = remoteStream;
        };

        const offerCandidates = child(callRef, "offerCandidates");
        const answerCandidates = child(callRef, "answerCandidates");

        peerConnection.onicecandidate = (e) => { if (e.candidate) push(answerCandidates, e.candidate.toJSON()); };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData));
        const answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);

        await set(child(callRef, "answer"), { sdp: answerDescription.sdp, type: answerDescription.type });

        onChildAdded(offerCandidates, (snap) => peerConnection.addIceCandidate(new RTCIceCandidate(snap.val())));
    } catch (err) { alert("Erro ao atender: " + err.message); }
}

async function desligarChamada() {
    await remove(child(chamadasRef, grupoAtual));
    desligarChamadaLocal();
}

function desligarChamadaLocal() {
    if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    document.getElementById("containerVideo").classList.add("oculto");
}

// EXPORTAÇÕES GLOBAIS
window.confirmarNome = confirmarNome;
window.criarSenha = criarSenha;
window.confirmarSenha = confirmarSenha;
window.alterarNomePerfil = alterarNomePerfil;
window.excluirMinhaConta = excluirMinhaConta;
window.mudarGrupo = mudarGrupo;
window.criarNovoGrupo = criarNovoGrupo;
window.abrirGerenciadorGrupo = abrirGerenciadorGrupo;
window.fecharGerenciadorGrupo = fecharGerenciadorGrupo;
window.adicionarMembro = adicionarMembro;
window.removerMembro = removerMembro;
window.abrirAmigos = abrirAmigos;
window.fecharAmigos = fecharAmigos;
window.adicionarAmigo = adicionarAmigo;
window.removerAmigo = removerAmigo;
window.enviar = enviar;
window.enviarImagem = enviarImagem;
window.iniciarGravacaoAudio = iniciarGravacaoAudio;
window.pararGravacaoAudio = pararGravacaoAudio;
window.iniciarChamada = iniciarChamada;
window.desligarChamada = desligarChamada;

$entrada.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });
