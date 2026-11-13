import React, { useState, useRef, useEffect } from 'react';
import { X, ExternalLink, Key, Cpu, RefreshCw } from 'lucide-react';
import { fetchGeminiModels } from '../services/aiService';
import CustomSelect from './CustomSelect';

const PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini (Gratis + Búsqueda Web Google)' },
  { value: 'groq', label: 'Groq Cloud (Gratis + Ultra Velocidad Llama 3.3)' }
];

const DEFAULT_GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recomendado)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Alta cuota)' },
  { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B (Ultra liviano)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Razonamiento profundo)' }
];

const GROQ_MODEL_OPTIONS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Recomendado)' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B (Razonamiento)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Ultra veloz)' }
];

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [formData, setFormData] = useState(settings);
  const [dynamicModels, setDynamicModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings, isOpen]);

  // Auto-ajuste de altura hacia abajo para el textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 72)}px`;
    }
  }, [formData.systemPrompt, isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleSmoothClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFetchModels = async () => {
    if (!formData.geminiKey) {
      setModelStatus('Ingresa primero tu Gemini API Key');
      return;
    }
    setLoadingModels(true);
    setModelStatus('Consultando modelos de Google...');
    const models = await fetchGeminiModels(formData.geminiKey);
    setLoadingModels(false);
    if (models.length > 0) {
      setDynamicModels(models);
      setModelStatus(`¡${models.length} modelos detectados!`);
      if (!models.includes(formData.model)) {
        handleChange('model', models[0]);
      }
    } else {
      setModelStatus('No se pudieron obtener modelos. Revisa tu clave.');
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave(formData);
    handleSmoothClose();
  };

  const currentGeminiOptions = dynamicModels.length > 0
    ? dynamicModels.map(m => ({ value: m, label: m }))
    : DEFAULT_GEMINI_MODELS;

  return (
    <div 
      className={`modal-overlay ${isClosing ? 'closing' : 'opening'}`} 
      onClick={handleSmoothClose}
    >
      <div 
        className={`modal-card ${isClosing ? 'closing' : 'opening'}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Configuración de IA</h2>
          <button className="icon-btn-subtle" onClick={handleSmoothClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Proveedor de IA</label>
            <CustomSelect
              value={formData.provider}
              options={PROVIDER_OPTIONS}
              onChange={(prov) => {
                handleChange('provider', prov);
                if (prov === 'gemini') {
                  handleChange('model', 'gemini-2.0-flash');
                } else {
                  handleChange('model', 'llama-3.3-70b-versatile');
                }
              }}
            />
          </div>

          {formData.provider === 'gemini' ? (
            <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} />
                  <span>Gemini API Key (Opcional)</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Opcional: BortexIA ya incluye conexión por defecto..."
                  value={formData.geminiKey || ''}
                  onChange={(e) => handleChange('geminiKey', e.target.value)}
                />
                <span className="form-helper">
                  BortexIA ya responde al público por defecto. Si deseas usar tu propia cuota personal sin límites compartidos, puedes ingresar tu clave gratuita de{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>.
                </span>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} />
                    <span>Modelo de Gemini</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={loadingModels || !formData.geminiKey}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={11} className={loadingModels ? 'spin' : ''} />
                    <span>Detectar disponibles</span>
                  </button>
                </div>

                <CustomSelect
                  value={formData.model}
                  options={currentGeminiOptions}
                  onChange={(val) => handleChange('model', val)}
                />

                {modelStatus && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {modelStatus}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} />
                  <span>Groq API Key</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="gsk_..."
                  value={formData.groqKey || ''}
                  onChange={(e) => handleChange('groqKey', e.target.value)}
                />
                <span className="form-helper">
                  Consigue tu API Key gratuita en{' '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
                    Groq Cloud Console <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>{' '}
                  (Inferencia instantánea a 300+ tokens/segundo).
                </span>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} />
                  <span>Modelo Groq</span>
                </label>
                <CustomSelect
                  value={formData.model}
                  options={GROQ_MODEL_OPTIONS}
                  onChange={(val) => handleChange('model', val)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Instrucciones de Sistema (System Prompt)</label>
            <textarea
              ref={textareaRef}
              className="form-input form-textarea"
              rows={3}
              value={formData.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              placeholder="Instrucciones para la personalidad o comportamiento de la IA..."
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary">
              Guardar Cambios
            </button>
            <button type="button" className="btn-secondary" onClick={handleSmoothClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
