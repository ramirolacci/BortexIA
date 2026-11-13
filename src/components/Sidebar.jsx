import React, { useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Settings, 
  Download, 
  PanelLeftClose, 
  PanelLeft
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onToggle,
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings,
  onExport
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartRename = (e, chat) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = (e, id) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="brand-title">
          <img src="/logo/iconomain.png" alt="BortexIA" className="brand-logo" />
          <span>BortexIA</span>
        </div>
        <button 
          className="icon-btn-subtle" 
          onClick={onToggle}
          title="Cerrar barra lateral"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <span>Nuevo chat</span>
        <Plus size={16} />
      </button>

      <div className="chat-history">
        {chats.map((chat) => {
          const isActive = chat.id === currentChatId;
          const isEditing = chat.id === editingId;

          return (
            <div
              key={chat.id}
              className={`chat-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '4px' }}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(e, chat.id);
                      if (e.key === 'Escape') handleCancelRename(e);
                    }}
                    style={{
                      flex: 1,
                      background: '#18181b',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: '0.84rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                  <button className="icon-btn-subtle" onClick={(e) => handleSaveRename(e, chat.id)}>
                    <Check size={14} />
                  </button>
                  <button className="icon-btn-subtle" onClick={handleCancelRename}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                    <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span className="chat-item-title">{chat.title || 'Chat sin título'}</span>
                  </div>
                  <div className="chat-item-actions">
                    <button 
                      className="icon-btn-subtle" 
                      title="Renombrar"
                      onClick={(e) => handleStartRename(e, chat)}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      className="icon-btn-subtle delete" 
                      title="Eliminar"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={onOpenSettings}>
          <Settings size={16} />
          <span>Ajustes</span>
        </button>
        <button 
          className="sidebar-footer-btn" 
          onClick={onExport} 
          title="Exportar conversación actual"
        >
          <Download size={16} />
        </button>
      </div>
    </aside>
  );
}

