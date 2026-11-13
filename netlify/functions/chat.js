export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      messages = [], 
      webSearch = false, 
      model = 'gemini-2.0-flash', 
      systemPrompt = '' 
    } = body;

    // Prioridad: Clave enviada por el cliente -> Variables de entorno de Netlify
    const clientKey = req.headers.get('x-api-key');
    const geminiApiKey = (clientKey && clientKey.trim()) || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

    if (!geminiApiKey && !groqApiKey) {
      return new Response(JSON.stringify({ 
        error: 'El servidor de BortexIA no tiene configurada la variable GEMINI_API_KEY ni GROQ_API_KEY en Netlify (Site configuration -> Environment variables).' 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 1. Preparar payload de Gemini
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

    const geminiPayload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    };

    if (systemPrompt) {
      geminiPayload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    if (webSearch) {
      geminiPayload.tools = [{ googleSearch: {} }];
    }

    // Modelos a probar en orden de prioridad para evitar errores de cuota 429 o 404
    let cleanRequested = (model || '').replace(/^models\//, '').trim();
    if (!cleanRequested || cleanRequested.includes('3.8')) {
      cleanRequested = 'gemini-2.0-flash';
    }

    const candidateGeminiModels = [
      cleanRequested,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash-lite-preview-02-05',
      'gemini-1.5-pro'
    ];
    const uniqueGeminiModels = [...new Set(candidateGeminiModels)];

    let lastGeminiError = '';
    let lastGeminiStatus = 500;

    // Intentar con Google Gemini si hay clave configurada
    if (geminiApiKey) {
      for (const candModel of uniqueGeminiModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${candModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
          const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
          });

          if (geminiRes.ok) {
            return new Response(geminiRes.body, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }

          lastGeminiStatus = geminiRes.status;
          const errData = await geminiRes.json().catch(() => ({}));
          lastGeminiError = errData?.error?.message || `Error HTTP ${geminiRes.status} en modelo ${candModel}`;

          // Si el error es 404 (modelo inexistente) o 429 (cuota de ese modelo superada), probamos el siguiente
          if (geminiRes.status === 404 || geminiRes.status === 429 || geminiRes.status === 400) {
            continue;
          }

          // Si es un error de autenticación (clave inválida), no tiene sentido probar más modelos
          if (geminiRes.status === 401 || geminiRes.status === 403) {
            break;
          }
        } catch (fetchErr) {
          lastGeminiError = fetchErr.message;
        }
      }
    }

    // 2. Fallback automático a Groq si Gemini falló o superó cuota (429) y existe GROQ_API_KEY
    if (groqApiKey) {
      try {
        const groqMessages = [];
        if (systemPrompt) {
          groqMessages.push({ role: 'system', content: systemPrompt });
        }
        for (const m of messages) {
          groqMessages.push({ role: m.role, content: m.content || '' });
        }

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            stream: true,
            temperature: 0.7
          })
        });

        if (groqRes.ok) {
          return new Response(groqRes.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch {
        // Fallback no disponible, continuar al error
      }
    }

    // 3. Si todo falló, retornar mensaje claro y descriptivo
    let userMsg = lastGeminiError || 'No se pudo conectar con el servicio de IA.';
    if (lastGeminiStatus === 429) {
      userMsg = `Límite de cuota excedido en Google AI Studio (Error 429): ${lastGeminiError || 'Quota exceeded'}. Si tu cuenta de Google no tiene tarjeta/facturación vinculada, Google limita fuertemente las peticiones gratuitas por minuto/día. Puedes agregar una GROQ_API_KEY gratuita en Netlify como respaldo ultra veloz.`;
    }

    return new Response(JSON.stringify({ error: userMsg }), {
      status: lastGeminiStatus || 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/chat"
};
