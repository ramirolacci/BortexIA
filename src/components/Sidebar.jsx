import React, { useState, useMemo } from 'react';
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
  Search
} from 'lucide-react';

function groupChatsByDate(chats) {
  const groups = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const lastWeekStart = todayStart - 86400000 * 7;

  chats.forEach(chat => {
    const time = chat.createdAt || 0;
    if (time >= todayStart) {
      groups.today.push(chat);
    } else if (time >= yesterdayStart) {
      groups.yesterday.push(chat);
    } else if (time >= lastWeekStart) {
      groups.lastWeek.push(chat);
    } else {
      groups.older.push(chat);
    }
  });

  return groups;
}

export default function Sidebar({
  isOpen,
  onToggle,
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onClearAllChats,
  onOpenSettings,
  onExport
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter(c => (c.title || '').toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const grouped = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

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

  const renderChatGroup = (title, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={title} className="sidebar-group">
        <div className="sidebar-group-title">{title}</div>
        {items.map(chat => {
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
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'closed'}`} aria-hidden={!isOpen}>
      <div className="sidebar-inner">
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

      <div style={{ padding: '0 12px' }}>
        <button className="new-chat-btn" onClick={onNewChat} style={{ margin: '12px 0 8px', width: '100%' }}>
          <span>Nuevo chat</span>
          <Plus size={16} />
        </button>

        {chats.length > 3 && (
          <div className="sidebar-search">
            <Search size={14} style={{ opacity: 0.5 }} />
            <input
              type="text"
              placeholder="Buscar en el historial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="icon-btn-subtle" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="chat-history">
        {chats.length === 0 ? (
          <div className="empty-sidebar">
            <MessageSquare size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <span>Aún no tienes conversaciones</span>
            <small>Tus chats se guardarán aquí automáticamente.</small>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="empty-sidebar">
            <span>No se encontraron resultados</span>
          </div>
        ) : (
          <>
            {renderChatGroup('Hoy', grouped.today)}
            {renderChatGroup('Ayer', grouped.yesterday)}
            {renderChatGroup('Últimos 7 días', grouped.lastWeek)}
            {renderChatGroup('Anteriores', grouped.older)}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-footer-btn" onClick={onOpenSettings} title="Configuración">
          <Settings size={16} />
          <span>Ajustes</span>
        </button>

        <div style={{ display: 'flex', gap: '4px' }}>
          {chats.length > 0 && (
            <button 
              className="sidebar-footer-btn" 
              onClick={onClearAllChats} 
              title="Borrar todo el historial"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button 
            className="sidebar-footer-btn" 
            onClick={onExport} 
            title="Exportar conversación en Markdown"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  </aside>
);
}
