import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import Composer from './components/Composer';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import { 
  getChats, 
  saveChats, 
  getCurrentChatId, 
  saveCurrentChatId, 
  getSettings, 
  saveSettings 
} from './services/storage';
import { streamChatCompletion } from './services/aiService';
import { AlertCircle, Menu, Plus, VenetianMask, Sparkles, Globe, Image as ImageIcon, ExternalLink } from 'lucide-react';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function extractLinksFromMessages(messages) {
  const sourcesMap = new Map();

  for (const m of messages) {
    if (m.sources && Array.isArray(m.sources)) {
      for (const s of m.sources) {
        if (s.url && !sourcesMap.has(s.url)) {
          let domain = '';
          try {
            domain = new URL(s.url).hostname.replace(/^www\./, '');
          } catch {
            domain = 'web';
          }
          sourcesMap.set(s.url, {
            title: s.title || s.url,
            url: s.url,
            domain
          });
        }
      }
    }

    if (m.content) {
      const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      while ((match = mdRegex.exec(m.content)) !== null) {
        const title = match[1];
        const url = match[2];
        if (!sourcesMap.has(url)) {
          try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            sourcesMap.set(url, { title, url, domain });
          } catch {
            // Ignorar URLs inválidas
          }
        }
      }
    }
  }

  return Array.from(sourcesMap.values());
}

function extractImagesFromMessages(messages) {
  const images = [];

  for (const m of messages) {
    if (m.image?.dataUrl) {
      images.push({
        url: m.image.dataUrl,
        title: 'Imagen adjunta por el usuario',
        from: 'user'
      });
    }

    if (m.content) {
      const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      while ((match = imgRegex.exec(m.content)) !== null) {
        const alt = match[1] || 'Imagen';
        const url = match[2];
        if (!images.some(img => img.url === url)) {
          images.push({
            url,
            title: alt,
            from: 'assistant'
          });
        }
      }
    }
  }

  return images;
}

function getModelDisplayName(settings) {
  if (settings.provider === 'groq') {
    if (settings.model.includes('3.1')) return 'Llama 3.1 8B (Groq)';
    if (settings.model.includes('3.2')) return 'Llama 3.2 11B (Groq)';
    if (settings.model.includes('70b') || settings.model.includes('3.3')) return 'Llama 3.3 70B (Groq)';
    return `${settings.model} (Groq)`;
  }
  if (settings.model.includes('3.8')) return 'Gemini 3.8 Flash';
  if (settings.model.includes('3.5')) return 'Gemini 3.5 Flash-Lite';
  if (settings.model.includes('3.1')) return 'Gemini 3.1 Pro';
  if (settings.model.includes('flash-latest')) return 'Gemini Flash Latest';
  return 'Gemini 3.8 Flash';
}

export default function App() {
  const [chats, setChats] = useState(() => getChats());
  const [currentChatId, setCurrentChatId] = useState(() => getCurrentChatId());
  const [settings, setSettings] = useState(() => getSettings());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [webSearch, setWebSearch] = useState(() => settings.webSearchEnabled);
  const [errorBanner, setErrorBanner] = useState(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [incognitoMessages, setIncognitoMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('answer'); // 'answer' | 'sources' | 'images'

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

  const currentChat = isIncognito ? null : chats.find(c => c.id === currentChatId);
  const activeMessages = isIncognito ? incognitoMessages : (currentChat ? currentChat.messages : []);
  const allSources = extractLinksFromMessages(activeMessages);
  const allImages = extractImagesFromMessages(activeMessages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, isStreaming]);

  const handleToggleIncognito = () => {
    setIsIncognito(prev => {
      const next = !prev;
      setIncognitoMessages([]);
      setInput('');
      setAttachedImage(null);
      setErrorBanner(null);
      setActiveTab('answer');
      return next;
    });
  };

  const handleNewChat = () => {
    setActiveTab('answer');
    if (isIncognito) {
      setIncognitoMessages([]);
      setInput('');
      setAttachedImage(null);
      setErrorBanner(null);
      if (isMobile) {
        setIsSidebarOpen(false);
      }
      return;
    }

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
    setActiveTab('answer');
    if (isIncognito) {
      setIsIncognito(false);
      setIncognitoMessages([]);
    }
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
    setIsClearAllModalOpen(true);
  };

  const handleConfirmClearAll = () => {
    setChats([]);
    setCurrentChatId(null);
    setErrorBanner(null);
    if (isMobile) {
      setIsSidebarOpen(false);
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
    setActiveTab('answer');
    const sentImage = attachedImage;
    setAttachedImage(null);

    // Modo Incógnito: flujo volátil en memoria sin tocar localStorage
    if (isIncognito) {
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

      const historyToSend = [...incognitoMessages, userMessage];
      setIncognitoMessages([...historyToSend, assistantMessage]);
      setIsStreaming(true);

      abortControllerRef.current = new AbortController();
      let incognitoAccumulatedText = '';

      try {
        const conversationHistory = historyToSend.map(m => ({ 
          role: m.role, 
          content: m.content, 
          image: m.image 
        }));

        await streamChatCompletion({
          provider: settings.provider,
          apiKey: currentApiKey,
          model: settings.model,
          messages: conversationHistory,
          webSearch: webSearch && settings.provider === 'gemini',
          systemPrompt: settings.systemPrompt,
          signal: abortControllerRef.current.signal,
          onChunk: (chunk) => {
            incognitoAccumulatedText += chunk;
            setIncognitoMessages(prev => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = {
                  ...last,
                  content: incognitoAccumulatedText
                };
              }
              return copy;
            });
          },
          onSources: (sources) => {
            setIncognitoMessages(prev => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = {
                  ...last,
                  sources
                };
              }
              return copy;
            });
          }
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          const errMsg = err.message || 'Ocurrió un error inesperado al consultar la IA.';
          setErrorBanner(errMsg);
          setIncognitoMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              last.content = last.content 
                ? `${last.content}\n\n⚠️ *${errMsg}*`
                : `⚠️ *${errMsg}*`;
            }
            return copy;
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
      return;
    }

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
    let accumulatedText = '';

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
          accumulatedText += chunk;
          setChats(prevChats => {
            return prevChats.map(c => {
              if (c.id !== activeChatId) return c;
              const msgs = [...c.messages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                msgs[msgs.length - 1] = {
                  ...lastMsg,
                  content: accumulatedText
                };
              }
              return { ...c, messages: msgs };
            });
          });
        },
        onSources: (sources) => {
          setChats(prevChats => {
            return prevChats.map(c => {
              if (c.id !== activeChatId) return c;
              const msgs = [...c.messages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                msgs[msgs.length - 1] = {
                  ...lastMsg,
                  sources
                };
              }
              return { ...c, messages: msgs };
            });
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
    const exportMessages = isIncognito ? incognitoMessages : (currentChat ? currentChat.messages : []);
    const exportTitle = isIncognito ? 'Chat Incógnito' : (currentChat ? currentChat.title : 'Chat');

    if (!exportMessages || exportMessages.length === 0) {
      alert('No hay mensajes para exportar en este chat.');
      return;
    }

    const mdContent = `# ${exportTitle}\n\n` + exportMessages.map(m => {
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
    a.download = `${exportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasMessages = activeMessages.length > 0;
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
            {/* Botón de Modo Incógnito (Estilo Perplexity) */}
            <button
              type="button"
              className={`icon-btn-subtle incognito-toggle-btn ${isIncognito ? 'active' : ''}`}
              onClick={handleToggleIncognito}
              title={isIncognito ? 'Desactivar modo incógnito' : 'Activar modo incógnito'}
            >
              <VenetianMask size={18} />
            </button>

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

        {hasMessages && (
          <div className="chat-tabs-bar">
            <div className="chat-tabs-inner">
              <button 
                type="button" 
                className={`chat-tab-btn ${activeTab === 'answer' ? 'active' : ''}`}
                onClick={() => setActiveTab('answer')}
              >
                <Sparkles size={14} />
                <span>Respuesta</span>
              </button>

              <button 
                type="button" 
                className={`chat-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
                onClick={() => setActiveTab('sources')}
              >
                <Globe size={14} />
                <span>Enlaces</span>
                {allSources.length > 0 && (
                  <span className="tab-count-badge">{allSources.length}</span>
                )}
              </button>

              <button 
                type="button" 
                className={`chat-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
                onClick={() => setActiveTab('images')}
              >
                <ImageIcon size={14} />
                <span>Imágenes</span>
                {allImages.length > 0 && (
                  <span className="tab-count-badge">{allImages.length}</span>
                )}
              </button>
            </div>
          </div>
        )}

        <main className="messages-container">
          {!hasMessages ? (
            <div className="empty-state">
              {isIncognito ? (
                <>
                  <div className="incognito-hero-icon">
                    <VenetianMask size={32} />
                  </div>
                  <h1>Estás en modo incógnito</h1>
                  <p>Las preguntas y respuestas de esta sesión no se guardarán en tu historial y caducan al salir.</p>
                </>
              ) : (
                <>
                  <img src="/logo/iconomain.png" alt="BortexIA Logo" className="empty-state-logo" />
                  <h1>¿En qué te puedo ayudar hoy?</h1>
                  <p>Haz cualquier pregunta, pide ideas, crea imágenes o escribe código.</p>
                </>
              )}
            </div>
          ) : activeTab === 'sources' ? (
            <div className="tab-content-container">
              {allSources.length === 0 ? (
                <div className="tab-empty-state">
                  <Globe size={36} className="tab-empty-icon" />
                  <h3>No hay enlaces en esta conversación</h3>
                  <p>Cuando la IA consulte la web o cite páginas de internet, aparecerán organizadas aquí para acceder fácilmente a cada fuente.</p>
                </div>
              ) : (
                <div className="sources-tab-grid">
                  {allSources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="source-tab-card"
                    >
                      <div className="source-card-top">
                        <span className="source-domain">{source.domain}</span>
                        <ExternalLink size={13} className="source-open-icon" />
                      </div>
                      <div className="source-title">{source.title}</div>
                      <span className="source-url-text">{source.url}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'images' ? (
            <div className="tab-content-container">
              {allImages.length === 0 ? (
                <div className="tab-empty-state">
                  <ImageIcon size={36} className="tab-empty-icon" />
                  <h3>No hay imágenes en esta conversación</h3>
                  <p>Las imágenes que adjuntes con el clip o las que pidas generar aparecerán reunidas aquí en una galería.</p>
                </div>
              ) : (
                <div className="images-tab-grid">
                  {allImages.map((img, idx) => (
                    <div key={idx} className="image-tab-card">
                      <img src={img.url} alt={img.title} />
                      <div className="image-card-footer">
                        <span className="image-card-title">{img.title}</span>
                        <a 
                          href={img.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="image-download-link"
                          title="Abrir imagen"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="messages-inner">
              {activeMessages.map((message, idx) => (
                <ChatMessage
                  key={message.id || idx}
                  message={message}
                  isLast={idx === activeMessages.length - 1}
                  isStreaming={isStreaming && idx === activeMessages.length - 1}
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
          isIncognito={isIncognito}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <ConfirmModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirm={handleConfirmClearAll}
        title="¿Eliminar todas las conversaciones?"
        message="¿Estás seguro de que deseas eliminar todas las conversaciones del historial? Esta acción no se puede deshacer."
        confirmText="Aceptar"
        cancelText="Cancelar"
      />
    </div>
  );
}
