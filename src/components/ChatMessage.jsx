import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink, Globe } from 'lucide-react';

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

  if (isUser) {
    return (
      <div className="message-row user">
        <div className="user-bubble">{message.content}</div>
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
      </div>
    </div>
  );
}

