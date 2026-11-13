import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import Composer from './components/Composer';
import SettingsModal from './components/SettingsModal';
import { 
  getChats, 
  saveChats, 
  getCurrentChatId, 
  saveCurrentChatId, 
  getSettings, 
  saveSettings 
} from './services/storage';
import { streamChatCompletion } from './services/aiService';
import { AlertCircle, Menu, Plus } from 'lucide-react';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function getModelDisplayName(settings) {
  if (settings.provider === 'groq') {
    if (settings.model.includes('deepseek')) return 'DeepSeek R1 (Groq)';
    if (settings.model.includes('3.1')) return 'Llama 3.1 8B (Groq)';
    return 'Llama 3.3 70B (Groq)';
  }
  if (settings.model.includes('2.0')) return 'Gemini 2.0 Flash';
  if (settings.model.includes('8b')) return 'Gemini 1.5 Flash 8B';
  if (settings.model.includes('1.5-pro')) return 'Gemini 1.5 Pro';
  if (settings.model.includes('1.5')) return 'Gemini 1.5 Flash';
  return 'Google Gemini';
}

export default function App() {
  const [chats, setChats] = useState(() => getChats());
  const [currentChatId, setCurrentChatId] = useState(() => getCurrentChatId());
  const [settings, setSettings] = useState(() => getSettings());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [webSearch, setWebSearch] = useState(() => settings.webSearchEnabled);
  const [errorBanner, setErrorBanner] = useState(null);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Detección reactiva de tamaño de pantalla sin alterar Desktop
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && !isSidebarOpen) {
        // En desktop mantenemos el estado
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    saveCurrentChatId(currentChatId);
  }, [currentChatId]);

  const currentChat = chats.find(c => c.id === currentChatId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages, isStreaming]);

  const handleNewChat = () => {
    const newChat = {
      id: generateId(),
      title: 'Nuevo chat',
      createdAt: Date.now(),
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setInput('');
    setAttachedImage(null);
    setErrorBanner(null);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectChat = (id) => {
    setCurrentChatId(id);
    setErrorBanner(null);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteChat = (id) => {
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentChatId === id) {
        setCurrentChatId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleRenameChat = (id, newTitle) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleClearAllChats = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar todas las conversaciones del historial?')) {
      setChats([]);
      setCurrentChatId(null);
      setErrorBanner(null);
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    }
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setWebSearch(newSettings.webSearchEnabled);
    setErrorBanner(null);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSend = async (customText) => {
    const textToSend = (customText || input).trim();
    if ((!textToSend && !attachedImage) || isStreaming) return;

    const currentApiKey = settings.provider === 'gemini' ? settings.geminiKey : settings.groqKey;
    const isImageGeneration = textToSend.toLowerCase().startsWith('genera una imagen') || 
                              textToSend.toLowerCase().startsWith('crea una imagen') ||
                              textToSend.toLowerCase().startsWith('/image');

    // Solo exigimos clave al usuario si seleccionó Groq (Gemini usa el backend por defecto)
    if (settings.provider === 'groq' && !currentApiKey && !isImageGeneration) {
      setErrorBanner('Para usar Groq Cloud necesitas configurar tu API Key gratuita en Ajustes.');
      setIsSettingsOpen(true);
      return;
    }

    setErrorBanner(null);
    setInput('');
    const sentImage = attachedImage;
    setAttachedImage(null);

    let activeChatId = currentChatId;
    let updatedChats = [...chats];
    let chatIndex = updatedChats.findIndex(c => c.id === activeChatId);

    const titleText = textToSend || 'Imagen adjunta';

    if (chatIndex === -1) {
      const newChat = {
        id: generateId(),
        title: titleText.slice(0, 36) + (titleText.length > 36 ? '...' : ''),
        createdAt: Date.now(),
        messages: []
      };
      updatedChats = [newChat, ...updatedChats];
      activeChatId = newChat.id;
      chatIndex = 0;
      setCurrentChatId(activeChatId);
    } else if (updatedChats[chatIndex].messages.length === 0) {
      updatedChats[chatIndex].title = titleText.slice(0, 36) + (titleText.length > 36 ? '...' : '');
    }

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: textToSend,
      image: sentImage,
      createdAt: Date.now()
    };

    const assistantMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: Date.now()
    };

    updatedChats[chatIndex].messages = [
      ...updatedChats[chatIndex].messages,
      userMessage,
      assistantMessage
    ];

    setChats(updatedChats);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const conversationHistory = updatedChats[chatIndex].messages
        .slice(0, -1)
        .map(m => ({ role: m.role, content: m.content, image: m.image }));

      await streamChatCompletion({
        provider: settings.provider,
        apiKey: currentApiKey,
        model: settings.model,
        messages: conversationHistory,
        webSearch: webSearch && settings.provider === 'gemini',
        systemPrompt: settings.systemPrompt,
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          setChats(prevChats => {
            const copy = [...prevChats];
            const targetChat = copy.find(c => c.id === activeChatId);
            if (!targetChat) return prevChats;
            const msgs = [...targetChat.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content += chunk;
            }
            return copy;
          });
        },
        onSources: (sources) => {
          setChats(prevChats => {
            const copy = [...prevChats];
            const targetChat = copy.find(c => c.id === activeChatId);
            if (!targetChat) return prevChats;
            const msgs = [...targetChat.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.sources = sources;
            }
            return copy;
          });
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errMsg = err.message || 'Ocurrió un error inesperado al consultar la IA.';
        setErrorBanner(errMsg);
        setChats(prevChats => {
          const copy = [...prevChats];
          const targetChat = copy.find(c => c.id === activeChatId);
          if (!targetChat) return prevChats;
          const msgs = [...targetChat.messages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = lastMsg.content 
              ? `${lastMsg.content}\n\n⚠️ *${errMsg}*`
              : `⚠️ *${errMsg}*`;
          }
          return copy;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleExport = () => {
    if (!currentChat || currentChat.messages.length === 0) {
      alert('No hay mensajes para exportar en este chat.');
      return;
    }

    const mdContent = `# ${currentChat.title}\n\n` + currentChat.messages.map(m => {
      const header = m.role === 'user' ? '### Tú' : '### BortexIA';
      let sourcesText = '';
      if (m.sources && m.sources.length) {
        sourcesText = '\n\n**Fuentes:**\n' + m.sources.map(s => `- [${s.title}](${s.url})`).join('\n');
      }
      return `${header}\n\n${m.content}${sourcesText}\n\n---`;
    }).join('\n\n');

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasMessages = currentChat && currentChat.messages.length > 0;
  const activeModelName = getModelDisplayName(settings);

  return (
    <div className={`app-layout ${isMobile ? 'is-mobile' : ''}`}>
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onClearAllChats={handleClearAllChats}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExport={handleExport}
        isMobile={isMobile}
      />

      {/* Backdrop oscuro para cerrar el Sidebar en Mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="sidebar-backdrop-mobile"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            {/* Botón de Menú solo en Mobile */}
            <button 
              type="button"
              className="icon-btn-subtle mobile-menu-btn" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Abrir menú"
            >
              <Menu size={20} />
            </button>

            <span className="top-bar-title">
              {currentChat ? currentChat.title : 'BortexIA'}
            </span>
          </div>

          <div className="top-bar-right">
            {/* Botón rápido de Nuevo Chat en Mobile */}
            <button
              type="button"
              className="icon-btn-subtle mobile-new-chat-btn"
              onClick={handleNewChat}
              title="Nuevo chat"
            >
              <Plus size={18} />
            </button>

            {/* Nombre del modelo en TopBar como texto plano sin encapsular */}
            <span className="top-bar-model-text">
              {activeModelName}
            </span>
          </div>
        </header>

        {errorBanner && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '10px 16px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorBanner}</span>
            </div>
            <button 
              className="icon-btn-subtle" 
              onClick={() => setErrorBanner(null)}
              style={{ color: '#fca5a5' }}
            >
              ✕
            </button>
          </div>
        )}

        <main className="messages-container">
          {!hasMessages ? (
            <div className="empty-state">
              <img src="/logo/iconomain.png" alt="BortexIA Logo" className="empty-state-logo" />
              <h1>¿En qué te puedo ayudar hoy?</h1>
              <p>Haz cualquier pregunta, pide ideas, crea imágenes o escribe código.</p>
            </div>
          ) : (
            <div className="messages-inner">
              {currentChat.messages.map((message, idx) => (
                <ChatMessage
                  key={message.id || idx}
                  message={message}
                  isLast={idx === currentChat.messages.length - 1}
                  isStreaming={isStreaming && idx === currentChat.messages.length - 1}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <Composer
          input={input}
          setInput={setInput}
          onSend={() => handleSend()}
          onStop={handleStop}
          isStreaming={isStreaming}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
          attachedImage={attachedImage}
          setAttachedImage={setAttachedImage}
          disabled={false}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
