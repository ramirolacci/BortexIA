import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Globe, Square, Paperclip, Mic, MicOff, X, Image as ImageIcon } from 'lucide-react';

export default function Composer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  webSearch,
  setWebSearch,
  attachedImage,
  setAttachedImage,
  disabled
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Manejo de atajo Enter y pegado de imágenes desde portapapeles
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (input.trim() || attachedImage)) {
        onSend();
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          readImageFile(file);
        }
      }
    }
  };

  const readImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage({
        dataUrl: event.target.result,
        mimeType: file.type,
        name: file.name || 'captura.png'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      readImageFile(file);
    }
    e.target.value = '';
  };

  // Reconocimiento de voz nativo (Web Speech API)
  const toggleSpeech = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="composer-wrapper">
      <div className="composer-box">
        {/* Previsualización de imagen adjunta */}
        {attachedImage && (
          <div className="attached-preview">
            <div className="attached-thumb-box">
              <img src={attachedImage.dataUrl} alt="Adjunto" className="attached-thumb" />
              <button 
                type="button" 
                className="remove-attach-btn" 
                onClick={() => setAttachedImage(null)}
                title="Quitar imagen"
              >
                <X size={12} />
              </button>
            </div>
            <span className="attached-name">{attachedImage.name}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Pregunta lo que sea o pega una imagen (Ctrl + V)..."
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
        />

        <div className="composer-bottom">
          <div className="composer-actions-left">
            {/* Input oculto para adjuntar archivo */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileChange}
            />

            <button
              type="button"
              className="icon-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar imagen (Visión)"
            >
              <Paperclip size={16} />
            </button>

            <button
              type="button"
              className={`icon-action-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleSpeech}
              title={isListening ? 'Detener dictado de voz' : 'Dictar por voz'}
            >
              {isListening ? <MicOff size={16} color="#ef4444" /> : <Mic size={16} />}
            </button>

            <button
              type="button"
              className={`web-search-toggle ${webSearch ? 'active' : ''}`}
              onClick={() => setWebSearch(!webSearch)}
              title="Buscar información en la web en tiempo real"
            >
              <Globe size={13} />
              <span>Búsqueda Web {webSearch ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {input.trim() && (
              <button 
                type="button" 
                className="icon-action-btn"
                onClick={() => setInput('')}
                title="Limpiar texto"
              >
                <X size={14} />
              </button>
            )}

            {isStreaming ? (
              <button
                type="button"
                className="send-btn stop"
                onClick={onStop}
                title="Detener generación"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                disabled={(!input.trim() && !attachedImage) || disabled}
                onClick={onSend}
                title="Enviar mensaje (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
