const STORAGE_CHATS_KEY = 'bortex_chats';
const STORAGE_CURRENT_CHAT_KEY = 'bortex_current_chat';
const STORAGE_SETTINGS_KEY = 'bortex_settings';

export const defaultSettings = {
  provider: 'gemini', // 'gemini' | 'groq'
  geminiKey: '',
  groqKey: '',
  model: 'gemini-2.0-flash',
  webSearchEnabled: true,
  systemPrompt: 'Eres BortexIA, un asistente de inteligencia artificial útil, preciso, analítico y conciso. Responde en español por defecto con formato Markdown claro.'
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = { ...defaultSettings, ...JSON.parse(raw) };
    
    // Normalización de modelos en localStorage
    if (!parsed.model || parsed.model.includes('3.8') || parsed.model.includes('2.5')) {
      parsed.model = 'gemini-2.0-flash';
      saveSettings(parsed);
    }
    
    return parsed;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings', err);
  }
}

export function getChats() {
  try {
    const raw = localStorage.getItem(STORAGE_CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChats(chats) {
  try {
    localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error('Error saving chats', err);
  }
}

export function getCurrentChatId() {
  try {
    return localStorage.getItem(STORAGE_CURRENT_CHAT_KEY) || null;
  } catch {
    return null;
  }
}

export function saveCurrentChatId(id) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_CURRENT_CHAT_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_CURRENT_CHAT_KEY);
    }
  } catch (err) {
    console.error('Error saving current chat id', err);
  }
}
