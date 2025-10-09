import { CreateWebWorkerMLCEngine } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";

const $ = (selector) => document.querySelector(selector);

const $form = document.querySelector("form.composer");
const $textarea = document.querySelector(".composer textarea");
const $template = document.querySelector("#message-template");
const $messages = document.querySelector("ul");
const $container = document.querySelector("main");
const $send = document.querySelector(".composer .send");
const $stop = document.querySelector(".composer .stop");
const $clear = document.querySelector(".composer .clear");
const $toggleSources = document.querySelector(".composer .toggle-sources");
const $sidebar = document.querySelector(".sidebar");
const $chatList = document.querySelector(".chat-list");
const $newChat = document.querySelector(".sidebar .new-chat");
const $info = document.querySelector("small");
const $loading = document.querySelector(".loading");
const $body = document.body;

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
        $loading?.parentNode?.removeChild($loading);
        $send?.removeAttribute("disabled");
        $toggleSources?.setAttribute("aria-pressed", withSources ? "true" : "false");
        if (!chats.length || !currentChatId) { setEmptyState(true); $sidebar.hidden = true; }
        else { $sidebar.hidden = false; selectChat(currentChatId); }
        $textarea?.focus();
      }
    },
  }
);

$newChat?.addEventListener("click", () => { const chat = createChat(""); $sidebar.hidden = false; selectChat(chat.id); });

$toggleSources?.addEventListener("click", () => {
  withSources = !$toggleSources.hasAttribute("data-on");
  $toggleSources.toggleAttribute("data-on", withSources);
  $toggleSources.setAttribute("aria-pressed", withSources ? "true" : "false");
  saveWithSources(withSources);
});

for (const s of document.querySelectorAll(".suggestion")) {
  s.addEventListener("click", () => {
    $textarea.value = s.getAttribute("data-fill") || ""; autosize(); $textarea.focus();
    $send.toggleAttribute("disabled", $textarea.value.trim() === "");
  });
}

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

  $textarea.value = ""; autosize();

  let chat = getCurrentChat();
  if (!chat) { chat = createChat(messageText); $sidebar.hidden = false; }
  setEmptyState(false);
  renderChatList();

  const userMessage = { role: "user", content: messageText };
  chat.messages.push(userMessage); save(chats);

  const { textEl: botTextEl, sourcesEl } = addMessage("", "bot");
  const typingEl = addTyping();

  $send.setAttribute("disabled", "");
  $stop.hidden = false;

  abortController = new AbortController();

  let systemHint = "";
  if (withSources) {
    systemHint = "\nInstrucción: cuando sea posible, incluye 2-4 fuentes confiables como URLs al final de tu respuesta.";
  }

  let reply = "";
  try {
    const chunks = await engine.chat.completions.create({ messages: [...chat.messages, ...(systemHint ? [{ role: "system", content: systemHint }] : [])], stream: true });
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
  } catch (err) {
    if (err?.message !== "aborted") { botTextEl.textContent = "Ha ocurrido un error. Intenta de nuevo."; }
  } finally {
    abortController = null;
    typingEl?.parentElement?.parentElement?.remove();
    $stop.hidden = true;
    $send.removeAttribute("disabled");
    $container.scrollTop = $container.scrollHeight;
    $textarea.focus();
    renderChatList();
  }
});

