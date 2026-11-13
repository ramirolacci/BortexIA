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
      model = 'gemini-2.5-flash', 
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

    let lastGeminiError = '';
    let lastGeminiStatus = 500;

    // 2. Intentar con Google Gemini si hay clave
    if (geminiApiKey) {
      let candidateModels = [];

      // Paso clave: Consultar ModelService.ListModels para saber qué modelos exactos tiene activos esta clave
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          const available = (listData.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));

          if (available.length > 0) {
            const cleanReq = (model || '').replace(/^models\//, '').trim();
            // Ordenar: primero el pedido si está disponible, luego los Flash, luego el resto
            const prioritized = [
              available.find(m => m === cleanReq),
              ...available.filter(m => m.includes('flash') && m !== cleanReq),
              ...available.filter(m => !m.includes('flash') && m !== cleanReq)
            ].filter(Boolean);
            candidateModels = [...new Set(prioritized)];
          }
        } else {
          const listErr = await listRes.json().catch(() => ({}));
          lastGeminiStatus = listRes.status;
          lastGeminiError = listErr?.error?.message || `Error HTTP ${listRes.status} al validar modelos con Google API`;
        }
      } catch (listErr) {
        // Fallback si la consulta de lista falla por red
      }

      // Si ListModels no arrojó lista, usar lista predeterminada con los modelos reales de Google
      if (candidateModels.length === 0) {
        const cleanReq = (model || '').replace(/^models\//, '').trim();
        candidateModels = [
          cleanReq || 'gemini-2.5-flash',
          'gemini-2.5-flash',
          'gemini-flash-latest',
          'gemini-2.5-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.8-flash',
          'gemini-2.5-pro'
        ];
      }

      // Probar los modelos disponibles
      for (const candModel of candidateModels) {
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

          // Si el error es 404 o 429, probamos el siguiente modelo
          if (geminiRes.status === 404 || geminiRes.status === 429 || geminiRes.status === 400) {
            continue;
          }

          // Si es 401/403 (clave rechazada), no tiene sentido continuar
          if (geminiRes.status === 401 || geminiRes.status === 403) {
            break;
          }
        } catch (fetchErr) {
          lastGeminiError = fetchErr.message;
        }
      }
    }

    // 3. Fallback automático a Groq si Gemini falló o superó cuota (429/404) y existe GROQ_API_KEY
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
        // Fallback no disponible
      }
    }

    // 4. Diagnóstico claro y amigable
    let userMsg = lastGeminiError || 'No se pudo conectar con el servicio de IA.';
    if (lastGeminiStatus === 404) {
      userMsg = `Google reportó que los modelos no están disponibles para esta API Key (Error 404): ${lastGeminiError}. Esto ocurre comúnmente si la clave fue generada en un proyecto de Google Cloud que no tiene habilitada la "Generative Language API", o si tiene restricciones de API. Verifica tu clave en https://aistudio.google.com/app/apikey (haz clic en 'Create API Key in new project').`;
    } else if (lastGeminiStatus === 429) {
      userMsg = `Límite de cuota alcanzado en Google AI Studio (Error 429): ${lastGeminiError}. Puedes agregar una GROQ_API_KEY gratuita en Netlify como respaldo ultra rápido.`;
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
