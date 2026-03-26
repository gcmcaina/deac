# DEAC Monitor — Next.js

Interface Next.js para o Monitor de Vagas CETEL da GCM.

## Stack
- **Next.js 14** (App Router)
- **Vercel** (hospedagem gratuita)
- **Cloudflare Worker** (backend/API — não alterado)

## Deploy na Vercel

### 1. Instale as dependências
```bash
npm install
```

### 2. Teste local
```bash
npm run dev
```
Acesse http://localhost:3000

### 3. Deploy na Vercel

**Opção A — Via CLI:**
```bash
npm i -g vercel
vercel
```

**Opção B — Via GitHub:**
1. Suba o projeto para um repositório GitHub
2. Acesse https://vercel.com
3. Clique em "Add New Project"
4. Importe o repositório
5. Em "Environment Variables", adicione:
   - `NEXT_PUBLIC_WORKER_URL` = `https://deacscan.gcmcaina.workers.dev`
6. Clique em "Deploy"

## Variáveis de Ambiente

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_WORKER_URL` | URL do Cloudflare Worker |

## Login
- **Usuário:** `deac`
- **Senha:** `deac99`

## Estrutura
```
src/
  app/
    layout.tsx       # Root layout
    page.tsx         # Entry point
    globals.css      # Global styles
  components/
    Dashboard.tsx    # Main page
    Login.tsx        # Login screen
    Sidebar.tsx      # Left sidebar (calendar, actions, test, history)
    DateCard.tsx     # Vaga card grouped by date
    Calendar.tsx     # Mini calendar
  lib/
    types.ts         # TypeScript types
    utils.ts         # Helper functions
public/
  firebase-messaging-sw.js  # Service Worker FCM
  manifest.json             # PWA manifest
```

## CORS no Worker

Para o Next.js poder chamar o Worker, adicione os headers CORS no Worker.
Edite o `deac-worker.js` e no início do `fetch handler` adicione:

```js
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

E em cada `return new Response(...)`, adicione os corsHeaders.
