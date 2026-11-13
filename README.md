# BortexIA 2.0

> Asistente de Inteligencia Artificial moderno, minimalista y ligero. Desarrollado con **React**, **Vite** y potenciado por modelos en la nube de nivel profesional con tiers 100% gratuitos.

---

## ⚡ Principales Características

- **Diseño Minimalista "Menos es Más":** Interfaz sobria inspirada en ChatGPT y Claude, eliminando distracciones visuales pesadas. Cero uso excesivo de GPU o congelamientos.
- **Inferencia Instantánea en la Nube:** Dejó atrás la inferencia local pesada (WebLLM de 4 GB) para responder al instante en cualquier navegador o dispositivo.
- **Modo Búsqueda Web (Estilo Perplexity):** Capacidad de consultar información en internet en tiempo real y citar las fuentes y enlaces originales utilizando Google Search Grounding.
- **100% Gratuito:** Diseñado para funcionar con los tiers gratuitos permanentes de **Google Gemini API** (hasta 1,500 peticiones diarias gratis sin tarjeta) o **Groq Cloud API** (velocidad de 300+ tokens/segundo).
- **Streaming en Vivo:** Respuestas generadas token a token en tiempo real.
- **Formato Markdown Completo:** Soporte para código fuente con botón para copiar, tablas, citas y listas.
- **Historial Persistente y Exportación:** Guarda tus conversaciones en `localStorage` y expórtalas a archivos Markdown (.md).

---

## 🛠️ Tecnologías

- **Frontend:** React 19, Vite, Lucide Icons, React Markdown, Remark GFM.
- **Package Manager:** `pnpm`.
- **Integración de IA:** Google Gemini API (Grounding Search + Streaming SSE) & Groq Cloud API.

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
pnpm install
```

### 2. Ejecutar en modo desarrollo
```bash
pnpm run dev
```

### 3. Obtener tu API Key Gratuita
- **Google Gemini (Recomendado):** Obtén tu clave en [Google AI Studio](https://aistudio.google.com/app/apikey) sin tarjeta de crédito.
- Abre **Ajustes** en la aplicación y pega tu clave. ¡Listo para usar!

