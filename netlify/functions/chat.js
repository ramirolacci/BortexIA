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
    const { messages = [], webSearch = false, model = 'gemini-3.8-flash', systemPrompt = '' } = body;

    // Prioridad: Header de usuario -> GEMINI_API_KEY de Netlify
    const clientKey = req.headers.get('x-api-key');
    const apiKey = (clientKey && clientKey.trim()) || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'El servidor de BortexIA no tiene configurada la variable GEMINI_API_KEY. Ve al panel de Netlify (Site configuration -> Environment variables) para agregar tu API key gratuita de Google.' 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

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

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      let msg = errData?.error?.message || `Error en la API (${geminiRes.status})`;
      if (geminiRes.status === 429) {
        msg = 'Límite de cuota temporal en Google (Error 429). Espera un momento y vuelve a enviar.';
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(geminiRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
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

