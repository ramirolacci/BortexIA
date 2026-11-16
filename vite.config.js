import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function netlifyFunctionsDevPlugin() {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Interceptar peticiones a /api/chat en desarrollo local (localhost:3000)
        if (req.url && req.url.startsWith('/api/chat')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
            res.end();
            return;
          }

          try {
            // Cargar dinámicamente el handler de Netlify
            const mod = await server.ssrLoadModule('/netlify/functions/chat.js');
            const handler = mod.default;

            // Leer cuerpo de la petición
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyStr = Buffer.concat(buffers).toString('utf-8');

            const host = req.headers.host || 'localhost:3000';
            const protocol = req.socket?.encrypted ? 'https' : 'http';
            const fullUrl = `${protocol}://${host}${req.url}`;

            const headers = new Headers();
            for (const [key, val] of Object.entries(req.headers)) {
              if (val) headers.set(key, Array.isArray(val) ? val.join(', ') : val);
            }

            const standardReq = new Request(fullUrl, {
              method: req.method,
              headers,
              body: req.method !== 'GET' && req.method !== 'HEAD' && bodyStr ? bodyStr : undefined
            });

            // Invocar el handler serverless
            const response = await handler(standardReq);

            res.statusCode = response.status;
            for (const [key, val] of response.headers.entries()) {
              res.setHeader(key, val);
            }

            // Transmitir respuesta streaming (SSE)
            if (response.body) {
              const reader = response.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            } else {
              res.end();
            }
          } catch (err) {
            console.error('Error en /api/chat (Vite dev server):', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Error en servidor local' }));
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.GROQ_API_KEY) process.env.GROQ_API_KEY = env.GROQ_API_KEY;

  return {
    plugins: [react(), netlifyFunctionsDevPlugin()],
    server: {
      port: 3000,
      open: true
    }
  };
});
