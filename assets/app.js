import { CreateWebWorkerMLCEngine } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";

const $ = (selector) => document.querySelector(selector);

const $form = document.querySelector("form.composer");
const $textarea = document.querySelector(".composer textarea");
const $template = document.querySelector("#message-template");
const $messages = document.querySelector("main ul");
const $container = document.querySelector("main");
const $send = document.querySelector(".composer .send");
const $stop = document.querySelector(".composer .stop");
const $clear = document.querySelector(".composer .clear");
const $toggleSources = document.querySelector(".composer .toggle-sources");
const $sidebar = document.querySelector(".sidebar");
const $chatList = document.querySelector(".chat-list");
const $newChat = document.querySelector(".sidebar .new-chat");
const $info = document.querySelector("small");
const $body = document.body;
const $heroLogoBtn = document.querySelector(".hero__logo-btn");
const $sidebarToggle = document.querySelector(".sidebar__toggle");
const $exportMd = document.querySelector(".export-md");
const $exportJson = document.querySelector(".export-json");

const STORAGE_CHATS = "bortex:chats";
const STORAGE_CURRENT = "bortex:currentChatId";
const STORAGE_SOURCES = "bortex:withSources";

function uid() { return Math.random().toString(36).slice(2, 10); }

function save(obj) {
  try { localStorage.setItem(STORAGE_CHATS, JSON.stringify(obj)); } catch {}
}
function load() {
  try { const raw = localStorage.getItem(STORAGE_CHATS); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveCurrent(id) { try { localStorage.setItem(STORAGE_CURRENT, id || ""); } catch {} }
function loadCurrent() { try { return localStorage.getItem(STORAGE_CURRENT) || ""; } catch { return ""; } }
function saveWithSources(v) { try { localStorage.setItem(STORAGE_SOURCES, v ? "1" : "0"); } catch {} }
function loadWithSources() { try { return (localStorage.getItem(STORAGE_SOURCES) || "0") === "1"; } catch { return false; } }

function setEmptyState(isEmpty) { $body.setAttribute("data-empty", isEmpty ? "true" : "false"); }
function autosize() { $textarea.style.height = "auto"; $textarea.style.height = Math.min($textarea.scrollHeight, window.innerHeight * 0.4) + "px"; }

function addMessage(text, sender) {
  const clonedTemplate = $template.content.cloneNode(true);
  const $newMessage = clonedTemplate.querySelector(".message");
  const $who = $newMessage.querySelector("span");
  const $text = $newMessage.querySelector("p");
  const $sources = $newMessage.querySelector(".sources");
  $text.textContent = text;
  if (sender === "bot") { $who.innerHTML = '<img src="logo/iconomain.png" alt="Logo BortexIA" loading="lazy">'; } else { $who.textContent = "Tú"; }
  $newMessage.classList.add(sender);
  $messages.appendChild($newMessage);
  $container.scrollTop = $container.scrollHeight;
  return { textEl: $text, sourcesEl: $sources, li: $newMessage };
}

function addTyping() {
  const { textEl } = addMessage("", "bot");
  textEl.innerHTML = '<span class="typing"><span>Escribiendo</span><span class="dots"><i></i><i></i><i></i></span></span>';
  return textEl;
}

function renderMessages(list) {
  $messages.innerHTML = "";
  if (!Array.isArray(list) || list.length === 0) return;
  for (const m of list) {
    const sender = m.role === "assistant" ? "bot" : "user";
    const { textEl, sourcesEl } = addMessage(m.content, sender);
    if (sender === "bot" && m.sources && m.sources.length) {
      sourcesEl.hidden = false;
      sourcesEl.innerHTML = m.sources.map((u, i) => `<a href="${u}" target="_blank" rel="noopener">Fuente ${i+1}</a>`).join(" · ");
    }
  }
}

function renderChatList() {
  $chatList.innerHTML = "";
  for (const chat of chats) {
    const li = document.createElement("li");
    li.textContent = chat.title || "Nuevo chat";
    if (chat.id === currentChatId) li.classList.add("active");
    li.addEventListener("click", () => selectChat(chat.id));
    li.addEventListener("dblclick", () => {
      li.setAttribute("contenteditable", "true");
      li.focus();
      const range = document.createRange();
      range.selectNodeContents(li);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    li.addEventListener("blur", () => {
      if (li.getAttribute("contenteditable") === "true") {
        li.removeAttribute("contenteditable");
        const chatRef = chats.find(c => c.id === chat.id);
        if (chatRef) { chatRef.title = li.textContent.trim() || chatRef.title; save(chats); renderChatList(); }
      }
    });
    $chatList.appendChild(li);
  }
}

function createChat(initialMessage) {
  const id = uid();
  const title = initialMessage ? initialMessage.slice(0, 40) : "Nuevo chat";
  const chat = { id, title, messages: [], createdAt: Date.now() };
  chats.unshift(chat);
  save(chats);
  selectChat(id);
  return chat;
}

function selectChat(id) {
  currentChatId = id;
  saveCurrent(id);
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  setEmptyState(chat.messages.length === 0);
  renderChatList();
  renderMessages(chat.messages);
}

function getCurrentChat() { return chats.find(c => c.id === currentChatId); }

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;
  const set = new Set();
  let match;
  while ((match = urlRegex.exec(text)) !== null) { set.add(match[0].startsWith("http") ? match[0] : `https://${match[0]}`); }
  return Array.from(set).slice(0, 5);
}

let chats = load();
let currentChatId = loadCurrent();
let withSources = loadWithSources();
let end = false;
let abortController = null;

const SELECTED_MODEL = "Llama-3-8B-Instruct-q4f32_1-MLC-1k";
const workerUrl = new URL("../worker.js", import.meta.url);

const engine = await CreateWebWorkerMLCEngine(
  new Worker(workerUrl, { type: "module" }),
  SELECTED_MODEL,
  {
    initProgressCallback: (info) => {
      if ($info) $info.textContent = info.text;
      if (info.progress === 1 && !end) {
        end = true;
        $send?.removeAttribute("disabled");
        $toggleSources?.setAttribute("aria-pressed", withSources ? "true" : "false");
        if (!chats.length || !currentChatId) { 
          setEmptyState(true); 
          $sidebar.hidden = true; 
        } else { 
          // Si hay chats guardados, mostrar el sidebar
          const currentChat = chats.find(c => c.id === currentChatId);
          $sidebar.hidden = !currentChat || currentChat.messages.length === 0;
          selectChat(currentChatId); 
        }
        $textarea?.focus();
        updateLogoIndicator();
      }
    },
  }
);

$newChat?.addEventListener("click", () => { 
  const chat = createChat(""); 
  // Siempre mostrar sidebar cuando se presiona "Nuevo Chat" (ya hay chats previos)
  $sidebar.hidden = false; 
  selectChat(chat.id);
  updateLogoIndicator();
});

$toggleSources?.addEventListener("click", () => {
  withSources = !$toggleSources.hasAttribute("data-on");
  $toggleSources.toggleAttribute("data-on", withSources);
  $toggleSources.setAttribute("aria-pressed", withSources ? "true" : "false");
  saveWithSources(withSources);
});

$sidebarToggle?.addEventListener("click", () => { document.body.classList.toggle("sidebar-collapsed"); });
window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "b" && !e.metaKey && !e.ctrlKey && !e.altKey) { document.body.classList.toggle("sidebar-collapsed"); }});

// Función para actualizar el indicador del logo
function updateLogoIndicator() {
  if ($heroLogoBtn) {
    if (chats.length > 0) {
      $heroLogoBtn.classList.add("has-chats");
      $heroLogoBtn.setAttribute("title", "Ver historial de chats");
    } else {
      $heroLogoBtn.classList.remove("has-chats");
      $heroLogoBtn.setAttribute("title", "");
    }
  }
}

// Botón del logo para colapsar/expandir el sidebar
$heroLogoBtn?.addEventListener("click", () => {
  // Si el sidebar está oculto (hidden), mostrarlo
  if ($sidebar.hidden) {
    $sidebar.hidden = false;
    document.body.classList.remove("sidebar-collapsed");
  } else {
    // Si el sidebar está visible, alternar entre colapsado y expandido
    document.body.classList.toggle("sidebar-collapsed");
  }
});

$textarea.addEventListener("input", () => { autosize(); $send.toggleAttribute("disabled", $textarea.value.trim() === ""); });
$textarea.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $form.requestSubmit(); }});

$clear.addEventListener("click", () => {
  const chat = getCurrentChat();
  if (!chat) return;
  chat.messages = []; save(chats); setEmptyState(true); renderMessages([]);
});

$stop.addEventListener("click", () => { if (abortController) { abortController.abort(); } });

$form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const messageText = $textarea.value.trim();
  if (messageText === "") return;
  
  // Verificar que el engine esté listo
  if (!end || !engine) {
    alert("La IA aún se está cargando. Espera un momento.");
    return;
  }

  $textarea.value = ""; autosize();

  let chat = getCurrentChat();
  if (!chat) { 
    chat = createChat(messageText);
    // Solo mostrar sidebar si hay más de 1 chat
    $sidebar.hidden = chats.length <= 1;
  }
  setEmptyState(false);
  renderChatList();

  const userMessage = { role: "user", content: messageText };
  chat.messages.push(userMessage); save(chats);
  
  // Mostrar el mensaje del usuario
  addMessage(messageText, "user");

  // Mostrar indicador de "escribiendo" del bot
  const { textEl: botTextEl, sourcesEl } = addMessage("", "bot");
  botTextEl.innerHTML = '<span class="typing"><span>Escribiendo</span><span class="dots"><i></i><i></i><i></i></span></span>';

  $send.setAttribute("disabled", "");
  $stop.hidden = false;

  abortController = new AbortController();

  let systemHint = "";
  if (withSources) {
    systemHint = "Instrucción: cuando sea posible, incluye 2-4 fuentes confiables como URLs al final de tu respuesta.";
  }

  let reply = "";
  try {
    // Preparar los mensajes con el system prompt al principio si existe
    let messagesToSend = [...chat.messages];
    if (systemHint) {
      messagesToSend = [{ role: "system", content: systemHint }, ...chat.messages];
    }
    
    console.log("Enviando mensaje a la IA:", messagesToSend);
    const chunks = await engine.chat.completions.create({ 
      messages: messagesToSend, 
      stream: true 
    });
    
    for await (const chunk of chunks) {
      if (abortController.signal.aborted) throw new Error("aborted");
      const choice = chunk.choices[0];
      const content = (choice?.delta?.content) ?? "";
      reply += content;
      botTextEl.textContent = reply;
    }

    const urls = withSources ? extractUrls(reply) : [];
    if (urls.length) {
      sourcesEl.hidden = false;
      sourcesEl.innerHTML = urls.map((u, i) => `<a href="${u}" target="_blank" rel="noopener">Fuente ${i+1}</a>`).join(" · ");
    }

    chat.messages.push({ role: "assistant", content: reply, sources: urls });
    save(chats);
    
    // Mostrar sidebar solo después de recibir la primera respuesta completa
    // Esto permite crear nuevos chats una vez que ya tienes una conversación
    if (reply && chat.messages.length >= 2) {
      $sidebar.hidden = false;
    }
    
    // Actualizar indicador del logo
    updateLogoIndicator();
  } catch (err) {
    if (err?.message !== "aborted") { 
      console.error("Error en el chat:", err);
      botTextEl.textContent = `Error: ${err.message || "Problema de conexión con la IA"}`;
    }
  } finally {
    abortController = null;
    $stop.hidden = true;
    $send.removeAttribute("disabled");
    $container.scrollTop = $container.scrollHeight;
    $textarea.focus();
    renderChatList();
  }
});

function toMarkdown(chat) {
  const lines = [`# ${chat.title}`, "", ...chat.messages.map(m => (m.role === "user" ? `**Tú:** ${m.content}` : `**Bortex:** ${m.content}`))];
  return lines.join("\n\n");
}

$exportMd?.addEventListener("click", () => {
  const chat = getCurrentChat(); if (!chat) return;
  const blob = new Blob([toMarkdown(chat)], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${chat.title || 'chat'}.md`; a.click(); URL.revokeObjectURL(a.href);
});

$exportJson?.addEventListener("click", () => {
  const chat = getCurrentChat(); if (!chat) return;
  const blob = new Blob([JSON.stringify(chat, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${chat.title || 'chat'}.json`; a.click(); URL.revokeObjectURL(a.href);
});

// ============================================
// UNIVERSO ANIMADO - FONDO DE ESTRELLAS 3D
// ============================================

const canvas = document.getElementById("universe");
const ctx = canvas.getContext("2d");

let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);

const starCount = 2000;
const stars = [];
const fov = 200; // field of view
let centerX = width / 2;
let centerY = height / 2;
let mouseX = 10;
let mouseY = 10;
let scrollDepth = 1;

// Generate stars
for (let i = 0; i < starCount; i++) {
  stars.push({
    x: (Math.random() - 0.5) * 2000,
    y: (Math.random() - 0.5) * 2000,
    z: Math.random() * 2000
  });
}

function animate() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < starCount; i++) {
    let star = stars[i];
    star.z -= 2 + scrollDepth * 0.05;

    if (star.z <= 1) {
      star.z = 2000;
    }

    const scale = fov / (fov + star.z);
    const x2d = (star.x + mouseX * 5) * scale + centerX;
    const y2d = (star.y + mouseY * 5) * scale + centerY;

    const brightness = 1 - star.z / 2000;
    ctx.beginPath();
    ctx.arc(x2d, y2d, scale * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.fill();
  }

  requestAnimationFrame(animate);
}

// Mouse perspective tilt
document.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX - centerX) / centerX;
  mouseY = (e.clientY - centerY) / centerY;
});

// Scroll depth control
document.addEventListener("wheel", (e) => {
  scrollDepth += e.deltaY * 0.05;
  if (scrollDepth < -200) scrollDepth = -50;
  if (scrollDepth > 500) scrollDepth = 500;
});

// Resize
window.addEventListener("resize", () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  centerX = width / 2;
  centerY = height / 2;
});

animate();

