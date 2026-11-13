import React, { useState } from 'react';
import { X, ExternalLink, Key, Cpu, RefreshCw } from 'lucide-react';
import { fetchGeminiModels } from '../services/aiService';

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [formData, setFormData] = useState(settings);
  const [dynamicModels, setDynamicModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState('');

  if (!isOpen) return null;

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
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración de IA</h2>
          <button className="icon-btn-subtle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Proveedor de IA</label>
            <select
              className="form-select"
              value={formData.provider}
              onChange={(e) => {
                const prov = e.target.value;
                handleChange('provider', prov);
                if (prov === 'gemini') {
                  handleChange('model', 'gemini-3.8-flash');
                } else {
                  handleChange('model', 'llama-3.3-70b-versatile');
                }
              }}
            >
              <option value="gemini">Google Gemini (Gratis + Búsqueda Web Google)</option>
              <option value="groq">Groq Cloud (Gratis + Ultra Velocidad Llama 3.3)</option>
            </select>
          </div>

          {formData.provider === 'gemini' ? (
            <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} />
                  <span>Gemini API Key</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="AIzaSy..."
                  value={formData.geminiKey || ''}
                  onChange={(e) => handleChange('geminiKey', e.target.value)}
                />
                <span className="form-helper">
                  Consigue tu API Key 100% gratis en{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </a>{' '}
                  (Hasta 1,500 consultas por día sin poner tarjeta).
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

                <select
                  className="form-select"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                >
                  {dynamicModels.length > 0 ? (
                    dynamicModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))
                  ) : (
                    <>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recomendado oficial por Google)</option>
                      <option value="gemini-3.8-pro">Gemini 3.8 Pro (Razonamiento avanzado)</option>
                      <option value="gemini-3.8-flash-latest">Gemini 3.8 Flash Latest</option>
                    </>
                  )}
                </select>
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
                <select
                  className="form-select"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                >
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recomendado)</option>
                  <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill 70B (Razonamiento)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra veloz)</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Instrucciones de Sistema (System Prompt)</label>
            <textarea
              className="form-input"
              rows={3}
              value={formData.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              placeholder="Instrucciones para la personalidad o comportamiento de la IA..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
