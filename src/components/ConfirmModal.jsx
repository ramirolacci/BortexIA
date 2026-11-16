import React, { useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Eliminar todas las conversaciones?',
  message = '¿Estás seguro de que deseas eliminar todas las conversaciones del historial? Esta acción no se puede deshacer.',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
}) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleSmoothClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  const handleConfirm = () => {
    onConfirm();
    handleSmoothClose();
  };

  return (
    <div 
      className={`modal-overlay ${isClosing ? 'closing' : 'opening'}`} 
      onClick={handleSmoothClose}
    >
      <div 
        className={`modal-card confirm-modal-card ${isClosing ? 'closing' : 'opening'}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-badge">
            <Trash2 size={20} />
          </div>
          <button className="icon-btn-subtle" onClick={handleSmoothClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className="modal-actions confirm-modal-actions">
          <button 
            type="button" 
            className="btn-danger" 
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleSmoothClose}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
