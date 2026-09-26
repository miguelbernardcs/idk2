import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getDatabase, ref, push, onChildAdded, onValue, set, remove, off 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxH1cHvQGzclxy82xTLylyt_s1hm63E84",
  authDomain: "whattsapp-2-d75f2.firebaseapp.com",
  databaseURL: "https://whattsapp-2-d75f2-default-rtdb.firebaseio.com",
  projectId: "whattsapp-2-d75f2",
  storageBucket: "whattsapp-2-d75f2.appspot.com",
  messagingSenderId: "381309225011",
  appId: "1:381309225011:web:a0559ccbc8ee592c707b46"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUserId = localStorage.getItem("userId") || "user_" + Math.random().toString(36).substring(2, 9);
let currentUserName = localStorage.getItem("userName") || "Utilizador";
let currentGroup = "geral"; 
let mediaRecorder = null;
let audioChunks = [];
let localStream = null;
let activeListenerRef = null;

localStorage.setItem("userId", currentUserId);

set(ref(db, `usuarios/${currentUserId}`), {
  id: currentUserId,
  nome: currentUserName
});

// --- PERFIL E CONTA ---
export function atualizarNome(novoNome) {
  if (!novoNome || !novoNome.trim()) return;
  currentUserName = novoNome.trim();
  localStorage.setItem("userName", currentUserName);
  set(ref(db, `usuarios/${currentUserId}/nome`), currentUserName);
  alert("Nome alterado com sucesso!");
}

export function excluirConta() {
  if (confirm("Tem certeza que deseja apagar a sua conta?")) {
    remove(ref(db, `usuarios/${currentUserId}`));
    localStorage.clear();
    location.reload();
  }
}

// --- GRUPOS E MEMBROS ---
export function criarGrupoPrivado(nomeGrupo) {
  if (!nomeGrupo || !nomeGrupo.trim()) return;
  const novoGrupoId = "grupo_" + Date.now();
  
  set(ref(db, `grupos/${novoGrupoId}`), {
    id: novoGrupoId,
    nome: nomeGrupo,
    privado: true,
    membros: {
      [currentUserId]: true
    }
  });

  alert(`Grupo "${nomeGrupo}" criado com sucesso!`);
  mudeDeGrupo(novoGrupoId);
}

export function adicionarMembroAoGrupo(idNovoMembro) {
  if (!idNovoMembro || !idNovoMembro.trim()) return alert("Digite o ID do usuário.");
  set(ref(db, `grupos/${currentGroup}/membros/${idNovoMembro.trim()}`), true)
    .then(() => alert("Membro adicionado!"))
    .catch((err) => alert("Erro ao adicionar: " + err.message));
}

export function removerMembroDoGrupo(idMembro) {
  if (!idMembro || !idMembro.trim()) return alert("Digite o ID do usuário.");
  remove(ref(db, `grupos/${currentGroup}/membros/${idMembro.trim()}`))
    .then(() => alert("Membro removido do grupo!"))
    .catch((err) => alert("Erro ao remover: " + err.message));
}

export function carregarMeusGrupos() {
  const listaGruposElement = document.getElementById("lista-grupos");
  if (!listaGruposElement) return;

  const gruposRef = ref(db, "grupos");
  onValue(gruposRef, (snapshot) => {
    listaGruposElement.innerHTML = "";
    const grupos = snapshot.val() || {};

    Object.keys(grupos).forEach((grupoId) => {
      const grupo = grupos[grupoId];
      if (grupoId === "geral" || !grupo.privado || (grupo.membros && grupo.membros[currentUserId])) {
        const item = document.createElement("li");
        item.innerText = grupo.nome || grupoId;
        item.onclick = () => mudeDeGrupo(grupoId);
        listaGruposElement.appendChild(item);
      }
    });
  });
}

export function mudeDeGrupo(nomeDoGrupo) {
  currentGroup = nomeDoGrupo;
  document.getElementById("nome-grupo-atual").innerText = nomeDoGrupo;
  const chatBox = document.getElementById("chat-box");
  if (chatBox) chatBox.innerHTML = "";

  if (activeListenerRef) off(activeListenerRef);

  activeListenerRef = ref(db, `mensagens/${currentGroup}`);
  onChildAdded(activeListenerRef, (snapshot) => {
    exibirMensagem(snapshot.val());
  });
}

// --- MENSAGENS E ÁUDIO ---
export function enviarMensagemTexto() {
  const input = document.getElementById("input-msg");
  if (input.value.trim() !== "") {
    enviarMensagem(input.value);
    input.value = "";
  }
}

export function enviarMensagem(texto, imagemBase64 = null, audioBase64 = null) {
  const novaMsg = {
    usuarioId: currentUserId,
    autor: currentUserName,
    texto: texto || "",
    imagem: imagemBase64 || null,
    audio: audioBase64 || null,
    timestamp: Date.now()
  };

  push(ref(db, `mensagens/${currentGroup}`), novaMsg);
}

export async function iniciarGravacaoAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => enviarMensagem("", null, reader.result);
    };

    mediaRecorder.start();
  } catch (err) {
    alert("Erro no microfone: " + err.message);
  }
}

export function pararGravacaoAudio() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

// --- CHAMADAS DE VÍDEO/VOZ ---
export async function iniciarChamada(comVideo = true) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: comVideo, audio: true });
    const localVideo = document.getElementById("localVideo");
    if (localVideo) localVideo.srcObject = localStream;

    set(ref(db, `chamadas/${currentGroup}/${currentUserId}`), { status: "online", video: comVideo });
  } catch (err) {
    alert("Erro na chamada: " + err.message);
  }
}

export function desligarChamada() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  remove(ref(db, `chamadas/${currentGroup}/${currentUserId}`));
  const localVideo = document.getElementById("localVideo");
  if (localVideo) localVideo.srcObject = null;
}

function exibirMensagem(msg) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${msg.usuarioId === currentUserId ? 'enviada' : 'recebida'}`;

  let conteudo = `<strong>${msg.autor}:</strong> ${msg.texto}`;
  if (msg.imagem) conteudo += `<br><img src="${msg.imagem}" style="max-width:200px; border-radius:8px;">`;
  if (msg.audio) conteudo += `<br><audio controls src="${msg.audio}"></audio>`;

  msgDiv.innerHTML = conteudo;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Torna global para botões HTML
window.atualizarNome = atualizarNome;
window.excluirConta = excluirConta;
window.criarGrupoPrivado = criarGrupoPrivado;
window.adicionarMembroAoGrupo = adicionarMembroAoGrupo;
window.removerMembroDoGrupo = removerMembroDoGrupo;
window.enviarMensagemTexto = enviarMensagemTexto;
window.iniciarGravacaoAudio = iniciarGravacaoAudio;
window.pararGravacaoAudio = pararGravacaoAudio;
window.iniciarChamada = iniciarChamada;
window.desligarChamada = desligarChamada;

document.addEventListener("DOMContentLoaded", () => {
  carregarMeusGrupos();
  mudeDeGrupo("geral");
  const userIdSpan = document.getElementById("meu-user-id");
  if (userIdSpan) userIdSpan.innerText = currentUserId;
});
