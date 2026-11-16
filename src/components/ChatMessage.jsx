import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink, Globe, Share2, ThumbsUp, ThumbsDown } from 'lucide-react';

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-header">
        <span>{language || 'código'}</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function ChatMessage({ message, isLast, isStreaming }) {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

  const handleCopyMessage = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareMessage = () => {
    if (!message.content) return;
    if (navigator.share) {
      navigator.share({
        title: 'Respuesta de BortexIA',
        text: message.content
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(message.content);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const handleFeedback = (type) => {
    setFeedback(prev => prev === type ? null : type);
  };

  if (isUser) {
    return (
      <div className="message-row user">
        <div className="user-bubble">
          {message.image?.dataUrl && (
            <div style={{ marginBottom: '8px' }}>
              <img 
                src={message.image.dataUrl} 
                alt="Imagen adjunta" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '260px', 
                  borderRadius: '10px', 
                  display: 'block' 
                }} 
              />
            </div>
          )}
          {message.content && <div>{message.content}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant">
      <img src="/logo/iconomain.png" alt="BortexIA" className="message-avatar" />
      <div className="assistant-body">
        {hasSources && (
          <div className="sources-section">
            <div className="sources-header">
              <Globe size={13} />
              <span>Fuentes consultadas</span>
            </div>
            <div className="sources-grid">
              {message.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-chip"
                  title={source.url}
                >
                  <span className="source-chip-title">{source.title || source.url}</span>
                  <ExternalLink size={10} style={{ opacity: 0.6 }} />
                </a>
              ))}
            </div>
          </div>
        )}

        {message.content ? (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img({ node, ...props }) {
                  return (
                    <img 
                      {...props} 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '450px', 
                        borderRadius: '12px', 
                        margin: '12px 0', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        display: 'block'
                      }} 
                    />
                  );
                },
                table({ node, ...props }) {
                  return (
                    <div className="table-responsive-wrapper">
                      <table {...props} />
                    </div>
                  );
                },
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  if (!inline && match) {
                    return <CodeBlock language={match[1]} value={codeString} />;
                  }
                  if (!inline && codeString.includes('\n')) {
                    return <CodeBlock language="" value={codeString} />;
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : isStreaming ? (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        ) : null}

        {message.content && (!isStreaming || !isLast) && (
          <div className="message-action-bar">
            <button 
              type="button" 
              className={`action-bar-btn ${copied ? 'active' : ''}`} 
              onClick={handleCopyMessage}
              title={copied ? "Copiado al portapapeles" : "Copiar respuesta"}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>

            <button 
              type="button" 
              className={`action-bar-btn ${shared ? 'active' : ''}`} 
              onClick={handleShareMessage}
              title={shared ? "Texto copiado" : "Compartir respuesta"}
            >
              {shared ? <Check size={14} /> : <Share2 size={14} />}
            </button>

            <button 
              type="button" 
              className={`action-bar-btn ${feedback === 'up' ? 'active' : ''}`} 
              onClick={() => handleFeedback('up')}
              title="Buena respuesta"
            >
              <ThumbsUp size={14} />
            </button>

            <button 
              type="button" 
              className={`action-bar-btn ${feedback === 'down' ? 'active' : ''}`} 
              onClick={() => handleFeedback('down')}
              title="Mala respuesta"
            >
              <ThumbsDown size={14} />
            </button>

            {hasSources && (
              <span className="action-bar-source-badge" title="Fuentes web citadas">
                <Globe size={11} />
                <span>{message.sources.length} {message.sources.length === 1 ? 'fuente' : 'fuentes'}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
