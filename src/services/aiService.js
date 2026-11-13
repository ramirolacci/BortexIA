/**
 * Servicio de IA para BortexIA
 * Soporta Google Gemini (con Google Search Grounding / Búsqueda web nativa y streaming)
 * y Groq Cloud (ultra velocidad Llama 3 / DeepSeek R1).
 */

export async function streamChatCompletion({
  provider = 'gemini',
  apiKey,
  model = 'gemini-1.5-flash',
  messages = [],
  webSearch = false,
  systemPrompt = '',
  signal,
  onChunk,
  onSources
}) {
  if (!apiKey) {
    throw new Error('No se ha configurado ninguna API Key. Ve a Ajustes para ingresar tu clave gratuita.');
  }

  if (provider === 'gemini') {
    return streamGemini({ apiKey, model, messages, webSearch, systemPrompt, signal, onChunk, onSources });
  } else if (provider === 'groq') {
    return streamGroq({ apiKey, model, messages, systemPrompt, signal, onChunk });
  } else {
    throw new Error(`Proveedor ${provider} no soportado`);
  }
}

async function streamGemini({ apiKey, model, messages, webSearch, systemPrompt, signal, onChunk, onSources }) {
  // Ajuste de modelo recomendado si no se especificó uno válido
  const actualModel = model.startsWith('gemini') ? model : 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Formatear mensajes para Gemini API
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  if (webSearch) {
    // Activa la búsqueda en Google nativa
    payload.tools = [{ googleSearch: {} }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Error de Gemini API (${response.status}): ${response.statusText}`;
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const discoveredSources = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') continue;

      try {
        const json = JSON.parse(dataStr);
        const candidate = json.candidates?.[0];
        if (!candidate) continue;

        // Extraer texto
        const text = candidate.content?.parts?.[0]?.text;
        if (text) {
          onChunk(text);
        }

        // Extraer fuentes de Grounding (búsqueda web)
        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web?.uri && !discoveredSources.some(s => s.url === chunk.web.uri)) {
              discoveredSources.push({
                title: chunk.web.title || 'Fuente web',
                url: chunk.web.uri
              });
            }
          }
          if (onSources && discoveredSources.length > 0) {
            onSources(discoveredSources);
          }
        }
      } catch (err) {
        // Ignorar chunks mal formateados
      }
    }
  }

  return { sources: discoveredSources };
}

async function streamGroq({ apiKey, model, messages, systemPrompt, signal, onChunk }) {
  const actualModel = model.includes('llama') || model.includes('deepseek') ? model : 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: actualModel,
      messages: formattedMessages,
      stream: true,
      temperature: 0.7
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Error de Groq API (${response.status}): ${response.statusText}`;
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') break;

      try {
        const json = JSON.parse(dataStr);
        const text = json.choices?.[0]?.delta?.content;
        if (text) {
          onChunk(text);
        }
      } catch {
        // Ignorar
      }
    }
  }

  return { sources: [] };
}

