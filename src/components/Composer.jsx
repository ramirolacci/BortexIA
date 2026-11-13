import React, { useRef, useEffect } from 'react';
import { ArrowUp, Globe, Square } from 'lucide-react';

export default function Composer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  webSearch,
  setWebSearch,
  disabled
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="composer-wrapper">
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Pregunta lo que sea..."
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="composer-bottom">
          <div className="composer-actions-left">
            <button
              type="button"
              className={`web-search-toggle ${webSearch ? 'active' : ''}`}
              onClick={() => setWebSearch(!webSearch)}
              title="Buscar información en la web en tiempo real"
            >
              <Globe size={13} />
              <span>Búsqueda Web {webSearch ? 'Activada' : 'Desactivada'}</span>
            </button>
          </div>

          <div>
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
                disabled={!input.trim() || disabled}
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

