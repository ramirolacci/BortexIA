/**
 * Servicio de IA para BortexIA
 * Soporta modo Cloud Público (vía Netlify Functions con GEMINI_API_KEY oculta en servidor)
 * y modo Clave Personal (Google Gemini o Groq directo).
 */

export async function fetchGeminiModels(apiKey) {
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.models) return [];
    return data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(name => name.includes('gemini'));
  } catch (e) {
    console.error('Error fetching models', e);
    return [];
  }
}

export function isImageGenerationRequest(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    t.startsWith('/image') ||
    t.startsWith('genera una imagen') ||
    t.startsWith('crea una imagen') ||
    t.startsWith('dibuja una imagen') ||
    t.startsWith('generar una imagen')
  );
}

export function generateImageUrl(prompt) {
  const cleanPrompt = prompt
    .replace(/^\/image/i, '')
    .replace(/^genera una imagen de/i, '')
    .replace(/^crea una imagen de/i, '')
    .replace(/^dibuja una imagen de/i, '')
    .trim();
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
}

export async function streamChatCompletion({
  provider = 'gemini',
  apiKey,
  model = 'gemini-2.5-flash',
  messages = [],
  webSearch = false,
  systemPrompt = '',
  signal,
  onChunk,
  onSources
}) {
  const lastMsg = messages[messages.length - 1];
  
  // 1. Pedido de generación gráfica: 100% Gratis sin ninguna API Key
  if (lastMsg && isImageGenerationRequest(lastMsg.content)) {
    const imgUrl = generateImageUrl(lastMsg.content);
    onChunk(`¡Aquí tienes la imagen que me pediste!\n\n![${lastMsg.content}](${imgUrl})\n\n*(Generada con modelo Flux vía Pollinations.ai)*`);
    return { sources: [] };
  }

  // 2. Modo Groq (requiere su propia API Key de Groq)
  if (provider === 'groq') {
    if (!apiKey) {
      throw new Error('Para usar Groq Cloud necesitas ingresar tu clave gratuita en Ajustes.');
    }
    return streamGroq({ apiKey, model, messages, systemPrompt, signal, onChunk });
  }

  // 3. Modo Google Gemini:
  // Si el usuario tiene su propia clave personal en Ajustes, la usamos directo
  if (apiKey && apiKey.trim()) {
    return streamGeminiWithFallback({ apiKey, model, messages, webSearch, systemPrompt, signal, onChunk, onSources });
  }

  // Si no tiene clave (usuario común), usamos el backend serverless de Netlify (/api/chat)
  return streamNetlifyBackend({ model, messages, webSearch, systemPrompt, signal, onChunk, onSources });
}

async function streamNetlifyBackend({ model, messages, webSearch, systemPrompt, signal, onChunk, onSources }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'gemini-2.5-flash',
      messages,
      webSearch,
      systemPrompt
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor (${response.status})`);
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
        
        // Soporte universal: Gemini chunks (filtrando thoughts) y OpenAI/Groq chunks
        let text = '';
        const candidate = json.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            // Ignorar pensamientos internos de razonamiento en inglés (CoT)
            if (part.thought) continue;
            if (part.text) {
              text += part.text;
            }
          }
        } else if (json.choices?.[0]) {
          text = json.choices[0].delta?.content || json.choices[0].text || '';
        }

        if (text) {
          onChunk(text);
        }

        const groundingMetadata = candidate?.groundingMetadata;
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
      } catch {
        // Ignorar
      }
    }
  }

  return { sources: discoveredSources };
}

async function streamGeminiWithFallback(params) {
  let requestedModel = (params.model || '').replace(/^models\//, '');
  if (!requestedModel) {
    requestedModel = 'gemini-2.5-flash';
  }

  const modelCandidates = [
    requestedModel,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-2.5-pro'
  ].filter(Boolean);

  const uniqueModels = [...new Set(modelCandidates)];
  let lastError = null;

  for (const candidateModel of uniqueModels) {
    try {
      return await streamGeminiSingle({ ...params, model: candidateModel });
    } catch (err) {
      lastError = err;
      const errMsg = err.message || '';

      const match = errMsg.match(/use models\/([a-zA-Z0-9_.-]+)/i);
      if (match && match[1] && match[1] !== candidateModel) {
        const suggestedModel = match[1];
        console.info(`Google sugirió usar ${suggestedModel}. Reintentando automáticamente...`);
        try {
          return await streamGeminiSingle({ ...params, model: suggestedModel });
        } catch (subErr) {
          lastError = subErr;
        }
      }

      if (errMsg.includes('not found') || errMsg.includes('not supported') || errMsg.includes('404') || errMsg.includes('no longer available') || errMsg.includes('429')) {
        console.warn(`Modelo ${candidateModel} no disponible (${errMsg}), intentando con alternativa...`);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini disponible.');
}

async function streamGeminiSingle({ apiKey, model, messages, webSearch, systemPrompt, signal, onChunk, onSources }) {
  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contents = messages.map(m => {
    const parts = [];
    if (m.image?.dataUrl) {
      const base64Data = m.image.dataUrl.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: m.image.mimeType || 'image/jpeg',
          data: base64Data
        }
      });
    }
    if (m.content) {
      parts.push({ text: m.content });
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

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
    let message = errorData?.error?.message || `Error de Gemini API (${response.status}): ${response.statusText}`;
    if (response.status === 429) {
      message = 'Límite de cuota alcanzado en Google Gemini (Error 429). Espera 1 minuto para que se restablezca, o cambia a Groq Cloud en Ajustes (gratuito e instantáneo).';
    }
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

        let text = '';
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.thought) continue;
            if (part.text) {
              text += part.text;
            }
          }
        }

        if (text) {
          onChunk(text);
        }

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
      } catch {
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
    let message = errorData?.error?.message || `Error de Groq API (${response.status}): ${response.statusText}`;
    if (response.status === 429) {
      message = 'Límite de cuota temporal en Groq (Error 429). Espera unos segundos e intenta nuevamente.';
    }
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
