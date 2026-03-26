// ============================================================
// DEAC - Monitor de Vagas CETEL | Cloudflare Worker
// ============================================================
// Secrets (wrangler secret put):
//   LOGIN      - Matricula GCM  (ex: 9169971)
//   SENHA      - Senha do DEAC  (ex: 140633)
//   NTFY_TOPIC - Topico ntfy.sh (ex: deac-vagas-gcm)
//
// KV Namespace binding: CETEL_KV
// Cron trigger: a cada 5 minutos
// ============================================================

const BASE_URL = "https://www.gcmdeac.prefeitura.sp.gov.br";

// ──────────────────────────────────────────────────────────────
// ENTRY POINTS
// ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS — permite Next.js (Vercel) chamar o Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    // Helper para adicionar CORS em qualquer resposta JSON
    const jsonResp = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });

    // GET /sw.js → Service Worker
    if (request.method === "GET" && url.pathname === "/sw.js") {
      return new Response(getServiceWorker(), {
        headers: { "Content-Type": "application/javascript; charset=utf-8", "Service-Worker-Allowed": "/" },
      });
    }

    // GET /firebase-messaging-sw.js → Firebase exige esse nome exato para FCM background
    if (request.method === "GET" && url.pathname === "/firebase-messaging-sw.js") {
      return new Response(getServiceWorker(), {
        headers: { "Content-Type": "application/javascript; charset=utf-8", "Service-Worker-Allowed": "/" },
      });
    }

    // GET /manifest.json → PWA manifest
    if (request.method === "GET" && url.pathname === "/manifest.json") {
      return new Response(JSON.stringify({
        name: "DEAC Monitor",
        short_name: "DEAC",
        description: "Monitor de Vagas CETEL - GCM",
        start_url: "/",
        display: "standalone",
        background_color: "#080b12",
        theme_color: "#080b12",
        orientation: "portrait",
        icons: [
          { src: "https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png", sizes: "192x192", type: "image/png" },
          { src: "https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png", sizes: "512x512", type: "image/png" }
        ]
      }), { headers: { "Content-Type": "application/manifest+json" } });
    }

    // POST /push-subscribe → salva FCM token ou Web Push subscription no KV
    if (request.method === "POST" && url.pathname === "/push-subscribe") {
      try {
        const body = await request.json();
        // Se vier um fcmToken, salva separadamente
        if (body.fcmToken) {
          await env.CETEL_KV.put("fcm_token", body.fcmToken, { expirationTtl: 86400 * 60 });
        } else {
          await env.CETEL_KV.put("push_subscription", JSON.stringify(body), { expirationTtl: 86400 * 60 });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      } catch(e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    // DELETE /push-subscribe → remove subscription e FCM token
    if (request.method === "DELETE" && url.pathname === "/push-subscribe") {
      await env.CETEL_KV.delete("push_subscription");
      await env.CETEL_KV.delete("fcm_token");
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    // GET /sw-test → diagnóstico automático
    if (request.method === "GET" && url.pathname === "/sw-test") {
      const html = [
        '<!DOCTYPE html><html><head>',
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
        '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"><\/script>',
        '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"><\/script>',
        '<style>',
        'body{background:#080b12;color:#e2e8f0;font-family:monospace;padding:16px;font-size:13px}',
        '.step{background:#131926;border:1px solid #1e2a3a;border-radius:8px;padding:10px 12px;margin:6px 0}',
        '.ok{color:#10b981}.err{color:#ef4444}.wait{color:#f59e0b}',
        '<\/style>',
        '</head><body>',
        '<h3 style="margin-bottom:12px">🔔 FCM Auto-Test</h3>',
        '<div id="s1" class="step wait">1. Aguardando SW...</div>',
        '<div id="s2" class="step wait">2. Aguardando permissao...</div>',
        '<div id="s3" class="step wait">3. Aguardando FCM token...</div>',
        '<div id="s4" class="step wait">4. Aguardando salvar...</div>',
        '<script>',
        'function s(id,msg,cls){var e=document.getElementById(id);e.textContent=msg;e.className="step "+(cls||"wait");}',
        'async function run(){',
        '  try{',
        '    var reg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");',
        '    await navigator.serviceWorker.ready;',
        '    s("s1","1. SW registrado: "+reg.scope,"ok");',
        '  }catch(e){s("s1","1. SW ERRO: "+e,"err");return;}',
        '  try{',
        '    var p=await Notification.requestPermission();',
        '    if(p!=="granted"){s("s2","2. Permissao negada","err");return;}',
        '    s("s2","2. Permissao concedida","ok");',
        '  }catch(e){s("s2","2. ERRO: "+e,"err");return;}',
        '  try{',
        '    var app=firebase.apps.length?firebase.app():firebase.initializeApp({',
        '      apiKey:"AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo",',
        '      projectId:"deac-monitor",',
        '      messagingSenderId:"721222526794",',
        '      appId:"1:721222526794:web:a27fd0a5be737f815983b3"',
        '    });',
        '    var msg=firebase.messaging(app);',
        '    var reg2=await navigator.serviceWorker.ready;',
        '    var token=await msg.getToken({',
        '      vapidKey:"BGkAhffgOmpXgLJPuYOYgYy50QGcRkQ5M7WrRup3ALYh8Ij9Qjc_atcN2DOU_0BWpqv5YAFroHw6ENFW17fTWWc",',
        '      serviceWorkerRegistration:reg2',
        '    });',
        '    if(!token){s("s3","3. Token vazio","err");return;}',
        '    s("s3","3. Token: "+token.substring(0,40)+"...","ok");',
        '    var r=await fetch("/push-subscribe",{method:"POST",',
        '      headers:{"Content-Type":"application/json"},',
        '      body:JSON.stringify({fcmToken:token})});',
        '    var d=await r.json();',
        '    s("s4",d.ok?"4. Salvo! Acesse /push-test":"4. ERRO: "+JSON.stringify(d),d.ok?"ok":"err");',
        '  }catch(e){s("s3","3. FCM ERRO: "+e,"err");}',
        '}',
        'window.onload=run;',
        '<\/script>',
        '</body></html>'
      ].join("\n");
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // GET /push-debug → página standalone para registrar push
    // GET /push-debug → página standalone para registrar push
    if (request.method === "GET" && url.pathname === "/push-debug") {
      const vapidPub = env.VAPID_PUBLIC_KEY || "";
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8"/>' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
        '<title>Push Debug</title>' +
        '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"><\/script>' +
        '<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"><\/script>' +
        '<style>body{background:#080b12;color:#e2e8f0;font-family:monospace;padding:20px;font-size:14px}' +
        'button{background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:12px 18px;' +
        'font-size:14px;cursor:pointer;margin:6px 0;display:block;width:100%;text-align:left}' +
        'pre{background:#131926;border:1px solid #1e2a3a;border-radius:8px;padding:12px;' +
        'margin:10px 0;white-space:pre-wrap;word-break:break-all;min-height:60px;font-size:12px}' +
        '.ok{color:#10b981}.err{color:#ef4444}.warn{color:#f59e0b}</style></head><body>' +
        '<h3 style="margin-bottom:16px">🔔 Registrar FCM</h3>' +
        '<button id="b1">1. Registrar Service Worker</button>' +
        '<button id="b2">2. Obter FCM Token (Firebase)</button>' +
        '<button id="b3">3. Salvar token no servidor</button>' +
        '<button id="b4" style="background:#1e2a3a">Ver status</button>' +
        '<pre id="log">Pronto. Clique nos botoes em ordem.</pre>' +
        '<script>' +
        'var VAPID="' + vapidPub + '";' +
        'var swReg=null,fcmToken=null;' +
        'firebase.initializeApp({' +
        '  apiKey:"AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo",' +
        '  authDomain:"deac-monitor.firebaseapp.com",' +
        '  projectId:"deac-monitor",' +
        '  storageBucket:"deac-monitor.firebasestorage.app",' +
        '  messagingSenderId:"721222526794",' +
        '  appId:"1:721222526794:web:a27fd0a5be737f815983b3"' +
        '});' +
        'var messaging=firebase.messaging();' +
        'function log(m,t){var e=document.getElementById("log");e.textContent=m;e.className=t||"";}' +
        'document.getElementById("b1").onclick=function(){' +
        '  navigator.serviceWorker.register("/sw.js",{scope:"/"})' +
        '  .then(function(r){swReg=r;return navigator.serviceWorker.ready;})' +
        '  .then(function(r){swReg=r;log("SW registrado!","ok");})' +
        '  .catch(function(e){log("ERRO SW: "+e.message,"err");});' +
        '};' +
        'document.getElementById("b2").onclick=function(){' +
        '  Notification.requestPermission().then(function(p){' +
        '    if(p!=="granted"){log("Permissao negada","err");return;}' +
        '    navigator.serviceWorker.ready.then(function(r){' +
        '      swReg=r;' +
        '      return messaging.getToken({vapidKey:VAPID,serviceWorkerRegistration:r});' +
        '    }).then(function(t){' +
        '      if(!t){log("Token vazio - verifique Firebase Console","warn");return;}' +
        '      fcmToken=t;' +
        '      log("FCM Token obtido!\n"+t.substring(0,40)+"...","ok");' +
        '    }).catch(function(e){log("ERRO FCM: "+e.message,"err");});' +
        '  });' +
        '};' +
        'document.getElementById("b3").onclick=function(){' +
        '  if(!fcmToken){log("Faca o passo 2 primeiro","err");return;}' +
        '  fetch("/push-subscribe",{method:"POST",' +
        '    headers:{"Content-Type":"application/json"},' +
        '    body:JSON.stringify({fcmToken:fcmToken})})' +
        '  .then(function(r){return r.json();})' +
        '  .then(function(d){log(d.ok?"Salvo! Acesse /push-test para testar.":"ERRO: "+JSON.stringify(d),d.ok?"ok":"err");})' +
        '  .catch(function(e){log("ERRO: "+e.message,"err");});' +
        '};' +
        'document.getElementById("b4").onclick=function(){' +
        '  log("Token em memoria: "+(fcmToken?fcmToken.substring(0,40)+"...":"nenhum"),fcmToken?"ok":"warn");' +
        '};' +
        '<\/script></body></html>';
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // GET /push-test → envia push de teste
    // GET /push-test → envia push de teste
    // POST /send-test → envia notificação de teste customizada
    if (request.method === "POST" && url.pathname === "/send-test") {
      const body = await request.json();
      const { title, body: msg, priority, channels } = body;
      const result = {};
      const payload = {
        title: title || "DEAC Monitor — Teste",
        body:  msg   || "Notificação de teste.",
        url:   "https://www.gcmdeac.prefeitura.sp.gov.br",
      };

      // FCM
      if (channels?.fcm) {
        const fcmToken = await env.CETEL_KV.get("fcm_token");
        if (fcmToken) {
          result.fcm = await sendFCM(env, fcmToken, payload);
        } else {
          const subRaw = await env.CETEL_KV.get("push_subscription");
          if (subRaw) result.fcm = await sendWebPush(env, JSON.parse(subRaw), payload);
          else result.fcm = { ok: false, error: "Nenhum token FCM registrado" };
        }
      }

      // ntfy
      if (channels?.ntfy) {
        const ntfyPriority = priority === "urgent" ? "urgent" : priority === "default" ? "default" : "high";
        const topic  = env.NTFY_TOPIC || "gcmdeactest";
        const server = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
        const headers = {
          "Content-Type": "text/plain; charset=utf-8",
          "Title": payload.title,
          "Priority": ntfyPriority,
          "Tags": priority === "urgent" ? "rotating_light,sos" : "bell",
          "Icon": "https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png",
          "Click": payload.url,
        };
        if (env.NTFY_USER && env.NTFY_PASS) {
          headers["Authorization"] = "Basic " + btoa(unescape(encodeURIComponent(env.NTFY_USER + ":" + env.NTFY_PASS)));
        }
        try {
          const r = await fetch(server + "/" + topic, { method: "POST", headers, body: payload.body });
          result.ntfy = { ok: r.ok, status: r.status };
        } catch(e) {
          result.ntfy = { ok: false, error: e.message };
        }
      }

      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }

    // GET /push-test → envia push de teste (FCM V1 ou Web Push)
    if (request.method === "GET" && url.pathname === "/push-test") {
      const payload = {
        title: "DEAC Monitor — Teste",
        body: "Notificação funcionando! Toque para abrir o site DEAC.",
        url: "https://www.gcmdeac.prefeitura.sp.gov.br"
      };
      // Tenta FCM primeiro
      const fcmToken = await env.CETEL_KV.get("fcm_token");
      if (fcmToken) {
        const result = await sendFCM(env, fcmToken, payload);
        return new Response(JSON.stringify({ channel: "FCM", ...result }), { headers: { "Content-Type": "application/json" } });
      }
      // Fallback Web Push
      const subRaw = await env.CETEL_KV.get("push_subscription");
      if (subRaw) {
        const result = await sendWebPush(env, JSON.parse(subRaw), payload);
        return new Response(JSON.stringify({ channel: "WebPush", ...result }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: false, error: "Nenhuma subscription registrada" }), { headers: { "Content-Type": "application/json" } });
    }

    // GET /api  → executa check e retorna JSON
    if (request.method === "GET" && url.pathname === "/api") {
      const result = await runCheck(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // GET /data → retorna dados do KV para a UI (sem re-executar o check)
    if (request.method === "GET" && url.pathname === "/data") {
      return await serveData(env);
    }

    // GET /test-ntfy → envia notificação de teste para o canal
    if (request.method === "GET" && url.pathname === "/test-ntfy") {
      const topic = env.NTFY_TOPIC || "gcmdeactest";
      const server = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
      const testHeaders = {
        "Content-Type": "text/plain; charset=utf-8",
        "Title": "DEAC: Teste de notificacao",
        "Priority": "high",
        "Tags": "white_check_mark",
      };
      if (env.NTFY_USER && env.NTFY_PASS) {
        testHeaders["Authorization"] = "Basic " + btoa(unescape(encodeURIComponent(env.NTFY_USER + ":" + env.NTFY_PASS)));
      }
      const resp = await fetch(server + "/" + topic, {
        method: "POST",
        headers: testHeaders,
        body: "Se voce recebeu isso, o ntfy esta funcionando!\nServidor: " + server + "\nTopico: " + topic,
      });
      const authUsed = env.NTFY_USER ? "Basic " + btoa(unescape(encodeURIComponent(env.NTFY_USER + ":" + env.NTFY_PASS))) : "none";
      const result = { server: (env.NTFY_SERVER || "https://ntfy.sh"), topic, status: resp.status, statusText: resp.statusText, ok: resp.ok, authHeader: authUsed };
      await env.CETEL_KV.put("ntfy_last", JSON.stringify({ ts: new Date().toISOString(), ...result }), { expirationTtl: 86400 });
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // GET /ntfy-status → mostra resultado do último envio ntfy
    if (request.method === "GET" && url.pathname === "/ntfy-status") {
      const raw = await env.CETEL_KV.get("ntfy_last");
      return new Response(raw || '{"msg":"nenhum envio registrado"}', {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // POST /clear-snapshot → deleta snapshot do KV para forçar re-notificação
    if (request.method === "POST" && url.pathname === "/clear-snapshot") {
      const mes = getMesAtual();
      await env.CETEL_KV.delete("vagas_snapshot_" + mes.replace("/", "_"));
      return new Response(JSON.stringify({ ok: true, deleted: "vagas_snapshot_" + mes.replace("/", "_") }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // GET /env-check → verifica quais secrets estão configurados (não mostra valores)
    if (request.method === "GET" && url.pathname === "/env-check") {
      return new Response(JSON.stringify({
        NTFY_SERVER:  env.NTFY_SERVER  ? "✅ " + env.NTFY_SERVER : "❌ não configurado",
        NTFY_TOPIC:   env.NTFY_TOPIC   ? "✅ " + env.NTFY_TOPIC  : "❌ não configurado",
        NTFY_USER:    env.NTFY_USER    ? "✅ " + env.NTFY_USER   : "❌ não configurado",
        NTFY_PASS:    env.NTFY_PASS    ? "✅ (***)" : "❌ não configurado",
        LOGIN:        env.LOGIN        ? "✅ (***)" : "❌ não configurado",
        SENHA:        env.SENHA        ? "✅ (***)" : "❌ não configurado",
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // GET / → serve a interface HTML
    if (request.method === "GET") {
      return new Response(getHtml(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
};

// ──────────────────────────────────────────────────────────────
// FLUXO PRINCIPAL
// ──────────────────────────────────────────────────────────────
async function runCheck(env) {
  const log = [];
  try {
    const mesPosAtual = getMesAtual();
    log.push("mes=" + mesPosAtual);

    const session = await doLogin(env.LOGIN, env.SENHA);
    log.push("login ok");

    const formData = await loadControlForm(session, mesPosAtual);
    log.push("form ok | mesFalta=" + formData.mesFalta + " | plantao=" + formData.plantao + " | ultimaEscala=" + formData.ultimaEscala);

    await triggerFormEvents(session, formData, mesPosAtual);
    await submitControlForm(session, formData, mesPosAtual);

    const rawHtml = await fetchVagasGridRaw(session, formData, mesPosAtual);
    const vagas   = parseVagasTable(rawHtml, mesPosAtual);
    log.push("vagas=" + vagas.length);

    const alertas = await compareAndStore(env, vagas, mesPosAtual);
    if (alertas.length > 0) {
      // Envia ntfy (se configurado)
      if (env.NTFY_SERVER || env.NTFY_TOPIC) {
        await sendNtfy(env, alertas, mesPosAtual);
        log.push("ntfy enviado | alertas=" + alertas.length);
      }
      // Envia push notification (FCM V1 tem prioridade, fallback Web Push)
      const pushPayload = {
        title: alertas.length === 1 ? "DEAC: Nova vaga!" : "DEAC: " + alertas.length + " novas vagas!",
        body: alertas.map(a =>
          a.vaga.data + " " + (a.vaga.hora||"").substring(0,5) + " +" + (a.atual - a.anterior) + " vagas"
        ).join(", "),
        url: "https://www.gcmdeac.prefeitura.sp.gov.br"
      };
      const fcmToken = await env.CETEL_KV.get("fcm_token");
      if (fcmToken) {
        await sendFCM(env, fcmToken, pushPayload);
        log.push("FCM enviado");
      } else {
        const subRaw = await env.CETEL_KV.get("push_subscription");
        if (subRaw) {
          await sendWebPush(env, JSON.parse(subRaw), pushPayload);
          log.push("webpush enviado");
        }
      }
    }

    return { ok: true, ts: new Date().toISOString(), log, vagasCount: vagas.length, vagas, alertas };
  } catch (err) {
    return { ok: false, ts: new Date().toISOString(), error: err.message, stack: err.stack, log };
  }
}

// ──────────────────────────────────────────────────────────────
// UTILS – fetch que segue redirects MANUALMENTE acumulando cookies
// CF Workers com redirect:"follow" descarta Set-Cookie dos hops 302.
// ──────────────────────────────────────────────────────────────
async function fetchFollowingCookies(jar, url, options) {
  options = options || {};
  let currentUrl = url;
  let method = options.method || "GET";
  let body   = options.body;

  for (let hop = 0; hop < 10; hop++) {
    // Rebuilda Cookie com jar atualizado a cada hop
    const headers = Object.assign({}, options.headers || {});
    if (Object.keys(jar).length > 0) headers["Cookie"] = cookieString(jar);

    const resp = await fetch(currentUrl, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      redirect: "manual",
    });

    // Acumula Set-Cookie desta resposta
    const rawCookie = resp.headers.get("set-cookie");
    if (rawCookie) Object.assign(jar, parseCookieHeader(rawCookie));

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) return resp;
      currentUrl = loc.startsWith("http") ? loc : new URL(loc, currentUrl).toString();
      method = "GET";      // 302 sempre vira GET
      body   = undefined;
      options = {};        // limpa opções extras no redirect
      continue;
    }
    return resp;
  }
  throw new Error("Too many redirects: " + url);
}

// ──────────────────────────────────────────────────────────────
// PASSO 1 – LOGIN
// ──────────────────────────────────────────────────────────────
async function doLogin(login, senha) {
  const LOGIN_URL = BASE_URL + "/login_web/login_web.php";
  const jar = {};

  // GET inicial → session cookie + CSRF
  const initResp = await fetchFollowingCookies(jar, LOGIN_URL, {
    method: "GET",
    headers: buildHeaders(jar, BASE_URL + "/"),
  });
  const initHtml = await initResp.text();

  const scriptCaseInit = extractInputValue(initHtml, "script_case_init") || "4112";
  const csrfToken      = extractInputValue(initHtml, "csrf_token")       || "";

  // AJAX: valida senha (simula digitação)
  await fetchFollowingCookies(jar, LOGIN_URL, {
    method: "POST",
    headers: buildHeaders(jar, LOGIN_URL),
    body: "rs=ajax_login_web_validate_senha&rst=&rsrnd=" + rsrnd() +
          "&rsargs[]=" + encodeURIComponent(senha) +
          "&rsargs[]=" + encodeURIComponent(scriptCaseInit),
  });

  // AJAX: valida login (simula digitação)
  await fetchFollowingCookies(jar, LOGIN_URL, {
    method: "POST",
    headers: buildHeaders(jar, LOGIN_URL),
    body: "rs=ajax_login_web_validate_login&rst=&rsrnd=" + rsrnd() +
          "&rsargs[]=" + encodeURIComponent(login) +
          "&rsargs[]=" + encodeURIComponent(scriptCaseInit),
  });

  // Submit real do formulário de login
  await fetchFollowingCookies(jar, LOGIN_URL, {
    method: "POST",
    headers: buildHeaders(jar, LOGIN_URL),
    body: new URLSearchParams({
      nm_form_submit: "1", nmgp_idioma_novo: "", nmgp_schema_f: "",
      nmgp_url_saida: "", bok: "OK", nmgp_opcao: "alterar",
      nmgp_ancora: "", nmgp_num_form: "", nmgp_parms: "",
      script_case_init: scriptCaseInit, NM_cancel_return_new: "",
      csrf_token: csrfToken, _sc_force_mobile: "",
      login: login, dif: "", rf_voluntario: "", unidade: "",
      mes_falta: "janeiro/2026", dinicio: "", dfim: "",
      cargo: "", senha: senha, diferenciado: "",
    }).toString(),
  });

  // POST no menu para consolidar a sessão autenticada
  await fetchFollowingCookies(jar, BASE_URL + "/menu2_web/menu2_web.php", {
    method: "POST",
    headers: buildHeaders(jar, LOGIN_URL),
    body: new URLSearchParams({
      nmgp_parms: "",
      nmgp_url_saida: "/login_web/login_web.php",
      script_case_init: scriptCaseInit,
    }).toString(),
  });

  return { cookies: jar };
}

// ──────────────────────────────────────────────────────────────
// PASSO 2 – CARREGA FORMULÁRIO DE CONTROLE
// ──────────────────────────────────────────────────────────────
async function loadControlForm(session, mesPosAtual) {
  const CTRL_URL  = BASE_URL + "/control_grid_pos_r1_web_pl_cetel/control_grid_pos_r1_web_pl_cetel.php";
  const MENU_LINK = BASE_URL + "/menu2_web/menu2_web_form_php.php?sc_item_menu=item_25&sc_apl_menu=control_grid_pos_r1_web_pl_cetel&sc_apl_link=%2F&sc_usa_grupo=";

  // GET no link do menu
  await fetchFollowingCookies(session.cookies, MENU_LINK, {
    method: "GET",
    headers: buildHeaders(session.cookies, BASE_URL + "/menu2_web/menu2_web.php"),
  });

  // POST inicial do formulário de controle
  const ctrlResp = await fetchFollowingCookies(session.cookies, CTRL_URL, {
    method: "POST",
    headers: buildHeaders(session.cookies, MENU_LINK),
    body: new URLSearchParams({
      nmgp_parms: "nm_run_menu?#?1?@?nm_apl_menu?#?menu2_web?@?script_case_init?#?1",
      script_case_init: "1",
      nm_apl_menu: "menu2_web",
    }).toString(),
  });
  const html = await ctrlResp.text();

  const csrf           = extractInputValue(html, "csrf_token")       || "";
  const scriptCaseInit = extractInputValue(html, "script_case_init") || "1";
  const ultimaEscala   = extractInputValue(html, "ultima_escala")    || "";

  const mesFaltaOpts = extractAllOptions(html, "mes_falta");
  const plantaoOpts  = extractAllOptions(html, "plantao");
  const plantao3Opts = extractAllOptions(html, "plantao3");

  const mesFaltaRaw = firstOptionValue(mesFaltaOpts);
  const plantao     = firstOptionValue(plantaoOpts)  || "impardia";
  const plantao3    = firstOptionValue(plantao3Opts) || "Impar dia";

  // mesFalta deve ser "janeiro/2026", nunca data ISO "2026-03-06"
  const mesFalta = (mesFaltaRaw && /^[a-zA-Z]/.test(mesFaltaRaw))
    ? mesFaltaRaw : "janeiro/2026";

  // ultima_escala vazia quebra SQL (va.dt > ''). Usa ontem como fallback.
  const ultimaEscalaFinal = ultimaEscala || getYesterday();

  return {
    csrf, scriptCaseInit, mesFalta, plantao3, plantao,
    ultimaEscala: ultimaEscalaFinal,
    ctrlUrl: CTRL_URL,

  };
}

// ──────────────────────────────────────────────────────────────
// PASSO 3 – EVENTOS AJAX DO FORMULÁRIO
// ──────────────────────────────────────────────────────────────
async function triggerFormEvents(session, fd, mesPosAtual) {
  async function ajax(rs, args) {
    let body = "rst=&rsrnd=" + rsrnd() + "&rs=" + encodeURIComponent(rs);
    for (const a of args) body += "&rsargs[]=" + encodeURIComponent(a);
    await fetchFollowingCookies(session.cookies, fd.ctrlUrl, {
      method: "POST",
      headers: buildHeaders(session.cookies, fd.ctrlUrl),
      body,
    });
  }
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_event_mes_pos_onchange",  [mesPosAtual, fd.scriptCaseInit]);
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_refresh_mes_pos",         [mesPosAtual, "mes_falta_#fld#_plantao_#fld#_plantao3", fd.scriptCaseInit]);
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_validate_mes_pos",        [mesPosAtual, fd.scriptCaseInit]);
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_refresh_cmdo_e",          ["NN", mesPosAtual, "ugcm_e", fd.scriptCaseInit]);
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_validate_cmdo_e",         ["NN", fd.scriptCaseInit]);
  await ajax("ajax_control_grid_pos_r1_web_pl_cetel_validate_ugcm_e",         ["CETEL", fd.scriptCaseInit]);
}

// ──────────────────────────────────────────────────────────────
// PASSO 4 – SUBMIT DO FORMULÁRIO
// ──────────────────────────────────────────────────────────────
async function submitControlForm(session, fd, mesPosAtual) {
  await fetchFollowingCookies(session.cookies, fd.ctrlUrl, {
    method: "POST",
    headers: buildHeaders(session.cookies, fd.ctrlUrl),
    body: new URLSearchParams({
      nm_form_submit: "1", nmgp_idioma_novo: "", nmgp_schema_f: "",
      nmgp_url_saida: "", bok: "OK", nmgp_opcao: "alterar",
      nmgp_ancora: "", nmgp_num_form: "", nmgp_parms: "",
      script_case_init: fd.scriptCaseInit, NM_cancel_return_new: "",
      csrf_token: fd.csrf, _sc_force_mobile: "",
      mes_pos: mesPosAtual, mes_falta: fd.mesFalta,
      qtde_faltas: "", ultima_escala: fd.ultimaEscala,
      plantao3: fd.plantao3, plantao: fd.plantao,
      cmdo_e: "NN", ugcm_e: "CETEL",
    }).toString(),
  });
}

// ──────────────────────────────────────────────────────────────
// PASSO 5 – GRID DE VAGAS
// ──────────────────────────────────────────────────────────────
async function fetchVagasGridRaw(session, fd, mesPosAtual) {
  const GRID_URL = BASE_URL + "/grid_vagas_existentes_pos_web_cetel/grid_vagas_existentes_pos_web_cetel.php";

  // NÃO usar encodeURIComponent: URLSearchParams já encoda o valor inteiro.
  const nmgpParms =
    "var_mes_pos*scin"      + mesPosAtual         + "*scoutSC_glo_par_var_ender"           +
    "*scinvar_ender*scoutSC_glo_par_var_ender_1"                                           +
    "*scinvar_ender_1*scoutSC_glo_par_var_diferenciado"                                    +
    "*scinvar_diferenciado*scoutSC_glo_par_var_read1"                                      +
    "*scinvar_read1*scoutvar_plantao"                                                      +
    "*scin"                 + fd.plantao           + "*scoutSC_glo_par_var_mediad1"         +
    "*scinvar_mediad1*scoutSC_glo_par_var_usu"                                             +
    "*scinvar_usuario*scoutSC_glo_par_var_usuario"                                         +
    "*scinvar_usuario*scoutvar_mes_falta"                                                  +
    "*scin"                 + fd.mesFalta          + "*scoutvar_ult_escala"                 +
    "*scin"                 + fd.ultimaEscala      + "*scoutSC_glo_par_var_read_psicol"     +
    "*scinvar_read_psicol*scoutvar_cmdo_e"                                                 +
    "*scinNN*scoutvar_ugcm_e"                                                              +
    "*scinCETEL*scout";

  const resp = await fetchFollowingCookies(session.cookies, GRID_URL, {
    method: "POST",
    headers: buildHeaders(session.cookies, fd.ctrlUrl),
    body: new URLSearchParams({
      nmgp_parms: nmgpParms,
      nmgp_url_saida: "/control_grid_pos_r1_web_pl_cetel/control_grid_pos_r1_web_pl_cetel.php",
      script_case_init: fd.scriptCaseInit,
    }).toString(),
  });

  return decodeLatin1(await resp.arrayBuffer());
}

// ──────────────────────────────────────────────────────────────
// PARSER DA TABELA
// ──────────────────────────────────────────────────────────────
function parseVagasTable(html, mesPosAtual) {
  const tds = extractTdSample(html, 9999);
  const vagas = [];
  let i = 0;
  while (i < tds.length) {
    if (
      i + 5 < tds.length &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(tds[i + 1]) &&
      /^\d+$/.test(tds[i + 4]) &&
      /^\d+$/.test(tds[i + 5])
    ) {
      vagas.push({
        posto:        tds[i],
        data:         tds[i + 1],
        diaSemana:    tds[i + 2],
        hora:         tds[i + 3],
        vagasAbertas: parseInt(tds[i + 4], 10),
        vagasRem:     parseInt(tds[i + 5], 10),
        mes:          mesPosAtual,
        key:          tds[i + 1] + "_" + tds[i + 3],
      });
      i += 6;
      continue;
    }
    i++;
  }
  return vagas;
}

// ──────────────────────────────────────────────────────────────
// KV – COMPARA E ARMAZENA SNAPSHOT
// ──────────────────────────────────────────────────────────────
async function compareAndStore(env, vagasAtuais, mesPosAtual) {
  const KV_KEY = "vagas_snapshot_" + mesPosAtual.replace("/", "_");
  const alertas = [];
  let snapshotAnterior = {};
  try {
    const raw = await env.CETEL_KV.get(KV_KEY);
    if (raw) snapshotAnterior = JSON.parse(raw);
  } catch (_) {}

  const primeiraExecucao = Object.keys(snapshotAnterior).length === 0;

  for (const vaga of vagasAtuais) {
    const ant    = snapshotAnterior[vaga.key];
    const antRem = ant !== undefined ? ant.vagasRem : null;

    // notifica apenas quando vaga sai de 0 → N (surgiu vaga onde não havia)
    if (antRem === 0 && vaga.vagasRem > 0)
      alertas.push({ tipo: "NOVA_VAGA", vaga, anterior: 0, atual: vaga.vagasRem });

    // primeira execução: notifica vagas que já têm disponibilidade
    if (primeiraExecucao && vaga.vagasRem > 0)
      alertas.push({ tipo: "VAGA_EXISTENTE", vaga, anterior: 0, atual: vaga.vagasRem });
  }

  // Proteção: se DEAC retornou lista vazia mas havia snapshot anterior, ignora
  if (vagasAtuais.length === 0 && Object.keys(snapshotAnterior).length > 0) {
    return [];
  }

  const snap = {};
  for (const v of vagasAtuais)
    snap[v.key] = { vagasRem: v.vagasRem, vagasAbertas: v.vagasAbertas, data: v.data, hora: v.hora, diaSemana: v.diaSemana, posto: v.posto, ts: new Date().toISOString() };

  await env.CETEL_KV.put(KV_KEY, JSON.stringify(snap), { expirationTtl: 60 * 60 * 24 * 40 });

  const checkInfo = { ts: new Date().toISOString(), mes: mesPosAtual, total: vagasAtuais.length, alertas: alertas.length };
  await env.CETEL_KV.put("ultimo_check", JSON.stringify(checkInfo), { expirationTtl: 86400 * 7 });

  // Salva as últimas 5 notificações no histórico
  if (alertas.length > 0) {
    let historico = [];
    try {
      const raw = await env.CETEL_KV.get("historico_notificacoes");
      if (raw) historico = JSON.parse(raw);
    } catch (_) {}
    for (const a of alertas) {
      historico.unshift({
        ts: new Date().toISOString(),
        data: a.vaga.data,
        diaSemana: a.vaga.diaSemana,
        hora: a.vaga.hora,
        posto: a.vaga.posto,
        anterior: a.anterior,
        atual: a.atual,
        tipo: a.tipo,
      });
    }
    historico = historico.slice(0, 5);
    await env.CETEL_KV.put("historico_notificacoes", JSON.stringify(historico), { expirationTtl: 86400 * 40 });
  }

  return alertas;
}

// ──────────────────────────────────────────────────────────────
// NOTIFICAÇÃO – ntfy.sh
// ──────────────────────────────────────────────────────────────
async function sendNtfy(env, alertas, mesPosAtual) {
  const topic  = env.NTFY_TOPIC || "gcmdeactest";
  const titulo = alertas.length === 1
    ? "DEAC: Nova vaga! (" + mesPosAtual + ")"
    : "DEAC: " + alertas.length + " novas vagas! (" + mesPosAtual + ")";
  const body = alertas.map(a =>
    "📅 " + a.vaga.data + " (" + a.vaga.diaSemana + ") " + a.vaga.hora +
    " | Vagas: " + a.anterior + " → " + a.atual +
    " | " + a.vaga.posto
  ).join("\n");
  // NTFY_SERVER: URL base do servidor ntfy (ex: https://meu-ntfy.fly.dev)
  // Se não configurado, usa ntfy.sh público
  const server = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  const ntfyHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Title": titulo,
    "Priority": "high",
    "Tags": "rotating_light",
    "Icon": "https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png",
    "Click": "https://www.gcmdeac.prefeitura.sp.gov.br",
    "Actions": "view, Abrir DEAC, https://www.gcmdeac.prefeitura.sp.gov.br",
  };
  // Suporte a Basic Auth (servidor próprio com auth-default-access: deny-all)
  if (env.NTFY_USER && env.NTFY_PASS) {
    ntfyHeaders["Authorization"] = "Basic " + btoa(unescape(encodeURIComponent(env.NTFY_USER + ":" + env.NTFY_PASS)));
  }
  const resp = await fetch(server + "/" + topic, {
    method: "POST",
    headers: ntfyHeaders,
    body,
  });
  // Salva resultado do último envio para diagnóstico
  await env.CETEL_KV.put("ntfy_last", JSON.stringify({
    ts: new Date().toISOString(),
    topic,
    titulo,
    body,
    status: resp.status,
    statusText: resp.statusText,
  }), { expirationTtl: 86400 });
  return resp.status;
}

// ──────────────────────────────────────────────────────────────
// UTILS – Cookies
// ──────────────────────────────────────────────────────────────
function parseCookieHeader(raw) {
  const jar = {};
  if (!raw) return jar;
  const entries = raw.split(/,(?=[A-Za-z_][A-Za-z0-9_-]+=)/);
  for (const entry of entries) {
    const kv = entry.split(";")[0].trim();
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    const name  = kv.substring(0, eq).trim();
    const value = kv.substring(eq + 1).trim();
    if (name) jar[name] = value;
  }
  return jar;
}

function cookieString(jar) {
  return Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ");
}

// ──────────────────────────────────────────────────────────────
// UTILS – Headers HTTP
// ──────────────────────────────────────────────────────────────
function buildHeaders(jar, referer) {
  const h = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Content-Type":    "application/x-www-form-urlencoded",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Cache-Control":   "no-cache",
    "Pragma":          "no-cache",
  };
  if (referer) h["Referer"] = referer;
  if (jar && Object.keys(jar).length > 0) h["Cookie"] = cookieString(jar);
  return h;
}

function rsrnd() { return String(Date.now()); }

// ──────────────────────────────────────────────────────────────
// UTILS – HTML / Parsing
// ──────────────────────────────────────────────────────────────
function extractInputValue(html, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = new RegExp(`name=["']${esc}["'][^>]*value=["']([^"']*)["']`, "i").exec(html);
  if (m) return m[1];
  m = new RegExp(`value=["']([^"']*)["'][^>]*name=["']${esc}["']`, "i").exec(html);
  return m ? m[1] : "";
}

function extractAllOptions(html, name) {
  const esc  = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selM = new RegExp(`<select[^>]*name=["']${esc}["'][^>]*>([\\s\\S]*?)<\\/select>`, "i").exec(html);
  if (!selM) return [];
  const results = [];
  const optRe = /<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)/gi;
  let om;
  while ((om = optRe.exec(selM[1])) !== null)
    results.push({ value: om[1].trim(), label: om[2].trim() });
  return results;
}

function firstOptionValue(opts) {
  for (const o of opts) { if (o.value) return o.value; }
  return null;
}

function extractTdSample(html, max) {
  const tdRe = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
  const out = [];
  let m;
  while ((m = tdRe.exec(html)) !== null && out.length < max) {
    const clean = m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&#040;/g, "(").replace(/&#041;/g, ")")
      .replace(/\s+/g, " ").trim();
    if (clean) out.push(clean);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// UTILS – Decode iso-8859-1
// ──────────────────────────────────────────────────────────────
function decodeLatin1(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return str;
}

// ──────────────────────────────────────────────────────────────
// INTERFACE – Serve dados do KV para a UI
// ──────────────────────────────────────────────────────────────
async function serveData(env) {
  const mesPosAtual = getMesAtual();
  const KV_KEY = "vagas_snapshot_" + mesPosAtual.replace("/", "_");

  let vagas = [], historico = [], ultimoCheck = null;
  try {
    const snap = await env.CETEL_KV.get(KV_KEY);
    if (snap) {
      const obj = JSON.parse(snap);
      vagas = Object.values(obj);
    }
  } catch (_) {}
  try {
    const h = await env.CETEL_KV.get("historico_notificacoes");
    if (h) historico = JSON.parse(h);
  } catch (_) {}
  try {
    const u = await env.CETEL_KV.get("ultimo_check");
    if (u) ultimoCheck = JSON.parse(u);
  } catch (_) {}

  return new Response(JSON.stringify({ vagas, historico, ultimoCheck, mes: mesPosAtual }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// ──────────────────────────────────────────────────────────────
// WEB PUSH
// ──────────────────────────────────────────────────────────────
async function sendWebPush(env, subscription, payload) {
  const pubKey  = env.VAPID_PUBLIC_KEY;
  const privKey = env.VAPID_PRIVATE_KEY;
  if (!pubKey || !privKey) return { ok: false, error: "VAPID keys not configured" };

  try {
    const endpoint = subscription.endpoint;
    const p256dh   = subscription.keys.p256dh;
    const auth     = subscription.keys.auth;

    // Build VAPID JWT
    const origin   = new URL(endpoint).origin;
    const vapidJwt = await buildVapidJwt(privKey, pubKey, origin);

    // Encrypt payload using Web Push encryption (RFC 8291)
    const encrypted = await encryptWebPush(p256dh, auth, JSON.stringify(payload));

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": "vapid t=" + vapidJwt + ", k=" + pubKey,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
      },
      body: encrypted,
    });

    let body = "";
    try { body = await resp.text(); } catch(_) {}
    return { ok: resp.ok, status: resp.status, body: body.substring(0, 200) };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

async function buildVapidJwt(privKeyB64, pubKeyB64, audience) {
  const header  = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:deac@monitor.local" };

  const enc = s => btoa(JSON.stringify(s)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const msg = enc(header) + "." + enc(payload);

  // Import private key
  const privRaw = base64UrlDecode(privKeyB64);
  const privKey = await crypto.subtle.importKey(
    "pkcs8", toPkcs8Der(privRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    new TextEncoder().encode(msg)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return msg + "." + sigB64;
}

async function encryptWebPush(p256dhB64, authB64, plaintext) {
  const p256dh  = base64UrlDecode(p256dhB64);
  const authKey = base64UrlDecode(authB64);
  const salt    = crypto.getRandomValues(new Uint8Array(16));

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  // Import receiver public key
  const recvPub = await crypto.subtle.importKey("raw", p256dh, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: recvPub }, ephemeral.privateKey, 256);
  const sharedKey  = new Uint8Array(sharedBits);

  // HKDF auth secret → PRK (RFC 8291)
  const encoder   = new TextEncoder();
  const prkKey    = await crypto.subtle.importKey("raw", authKey, { name: "HKDF" }, false, ["deriveBits"]);
  const prkInfo   = concat(encoder.encode("WebPush: info "), p256dh, ephPubRaw);
  const ikm       = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sharedKey, info: prkInfo }, prkKey, 256));

  // Derive CEK and NONCE via HKDF
  const ikmKey    = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const cekInfo   = concat(encoder.encode("Content-Encoding: aes128gcm "), new Uint8Array(1));
  const nonceInfo = concat(encoder.encode("Content-Encoding: nonce "),     new Uint8Array(1));
  const cekBits   = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo   }, ikmKey, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, ikmKey, 96);
  const cek       = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);

  // Encrypt content
  const data = concat(encoder.encode(plaintext), new Uint8Array([2])); // padding delimiter
  const ct   = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, cek, data));

  // Build aes128gcm content-encoding header
  const header = new Uint8Array(21 + ephPubRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // rs
  header[20] = ephPubRaw.length;
  header.set(ephPubRaw, 21);

  return concat(header, ct);
}

function concat(...arrays) {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function base64UrlDecode(s) {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function toPkcs8Der(rawPriv) {
  // Wrap raw 32-byte P-256 private key in PKCS#8 DER
  const prefix = new Uint8Array([
    0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,
    0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,
    0x01,0x04,0x20
  ]);
  return concat(prefix, rawPriv);
}

// ──────────────────────────────────────────────────────────────
// FCM V1 — Firebase Cloud Messaging
// ──────────────────────────────────────────────────────────────
async function getFCMAccessToken(env) {
  // Build JWT for Google OAuth2 using Service Account
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const privateKeyPem = env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64 = o => btoa(JSON.stringify(o)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const msg = b64(header) + "." + b64(payload);

  // Parse PEM private key
  const pemBody = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const derBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", derBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(msg)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const jwt = msg + "." + sigB64;

  // Exchange JWT for access token
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });
  const data = await resp.json();
  return data.access_token;
}

async function sendFCM(env, fcmToken, payload) {
  try {
    const projectId  = env.FCM_PROJECT_ID || "deac-monitor";
    const accessToken = await getFCMAccessToken(env);

    const resp = await fetch(
      "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            // data-only: SW acorda e exibe a notificação manualmente
            data: {
              title: payload.title,
              body: payload.body,
              url: payload.url || "https://www.gcmdeac.prefeitura.sp.gov.br",
            },
            android: {
              priority: "high",
            },
            webpush: {
              headers: {
                Urgency: "high",
              },
              fcm_options: {
                link: payload.url || "https://www.gcmdeac.prefeitura.sp.gov.br",
              },
            },
          },
        }),
      }
    );

    const body = await resp.json();
    return { ok: resp.ok, status: resp.status, body };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────────
// SERVICE WORKER (entregue em /sw.js)
// ──────────────────────────────────────────────────────────────
function getServiceWorker() {
  return `
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

console.log('[SW] firebase-messaging-sw.js carregado');

firebase.initializeApp({
  apiKey: "AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo",
  authDomain: "deac-monitor.firebaseapp.com",
  projectId: "deac-monitor",
  storageBucket: "deac-monitor.firebasestorage.app",
  messagingSenderId: "721222526794",
  appId: "1:721222526794:web:a27fd0a5be737f815983b3"
});

const messaging = firebase.messaging();
const DEAC_URL = 'https://www.gcmdeac.prefeitura.sp.gov.br';

console.log('[SW] Firebase messaging inicializado');

// Handle background FCM messages (data-only)
messaging.onBackgroundMessage(payload => {
  console.log('[SW] onBackgroundMessage recebido:', JSON.stringify(payload));
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = d.title || n.title || 'DEAC Monitor';
  const body  = d.body  || n.body  || 'Nova vaga disponivel!';
  const url   = d.url   || DEAC_URL;
  self.registration.showNotification(title, {
    body,
    icon: 'https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png',
    badge: 'https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png',
    data: { url },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
});

// Also handle standard Web Push as fallback
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(_) { return; }
  // Skip if already handled by FCM
  if (data.from) return;
  e.waitUntil(
    self.registration.showNotification(data.title || 'DEAC Monitor', {
      body: data.body || '',
      icon: 'https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png',
      data: { url: data.url || DEAC_URL },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || DEAC_URL;
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
`;
}

// ──────────────────────────────────────────────────────────────
// INTERFACE – HTML da UI
// ──────────────────────────────────────────────────────────────
function getHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>DEAC – Monitor de Vagas</title>
<link rel="manifest" href="/manifest.json"/>
<meta name="theme-color" content="#060910"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="DEAC Monitor"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"></script>
<style>
:root{
  --bg:#060910;--surface:#0b0f1a;--card:#0f1520;--card2:#131b28;
  --border:#1a2236;--border2:#1f2a40;
  --accent:#3b7ef6;--accent2:#5b9aff;
  --green:#0ec97f;--green-bg:#051a10;--green-border:#0a3020;
  --yellow:#f5a623;--yellow-bg:#1a1200;--yellow-border:#2a2000;
  --red:#f04e4e;--red-bg:#1a0505;--red-border:#2a0808;
  --text:#dde4f0;--text2:#7a8ba8;--text3:#3a4a60;
  --font:'Outfit',sans-serif;--mono:'DM Mono',monospace;
  --radius:14px;--radius-sm:8px;
  --safe-bottom:env(safe-area-inset-bottom,0px);
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);min-height:100vh;overflow-x:hidden;padding-bottom:calc(16px + var(--safe-bottom))}
body::after{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 40% at 50% -10%,rgba(59,126,246,.07),transparent);pointer-events:none;z-index:0}

/* ── LOGIN ── */
#login-screen{position:fixed;inset:0;background:var(--bg);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px}
#login-screen.hidden{display:none}
.login-box{width:100%;max-width:360px;background:var(--card);border:1px solid var(--border2);border-radius:24px;padding:36px 28px}
.login-logo{display:block;height:44px;object-fit:contain;margin-bottom:20px}
.login-title{font-size:24px;font-weight:800;margin-bottom:4px}
.login-sub{font-size:13px;color:var(--text2);margin-bottom:28px}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text2);margin-bottom:5px}
.field input{width:100%;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:11px 13px;font-size:14px;font-family:var(--mono);color:var(--text);outline:none;transition:border-color .2s}
.field input:focus{border-color:var(--accent)}
.login-btn{width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-family:var(--font);font-weight:700;cursor:pointer;margin-top:6px;transition:all .2s}
.login-btn:active{transform:scale(.98)}
.login-err{color:var(--red);font-size:12px;margin-top:10px;text-align:center;min-height:16px}

/* ── HEADER ── */
header{background:rgba(6,9,16,.85);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 16px;height:56px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:50}
.h-logo{height:26px;object-fit:contain}
.h-title{font-size:14px;font-weight:700;color:var(--text2)}
.h-title span{color:var(--accent2)}
.h-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.btn-logout{background:transparent;border:1px solid var(--border2);color:var(--text2);border-radius:8px;padding:5px 11px;font-size:12px;font-family:var(--font);cursor:pointer;transition:all .2s}
.btn-logout:hover{border-color:var(--red);color:var(--red)}

/* ── STATUS BAR ── */
.status-bar{padding:8px 16px;display:flex;align-items:center;gap:8px;font-size:12px;font-family:var(--mono);background:var(--surface);border-bottom:1px solid var(--border);overflow-x:auto;white-space:nowrap}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,201,127,.4)}50%{box-shadow:0 0 0 4px rgba(14,201,127,0)}}
.stat{color:var(--text2);font-size:11px}
.stat b{color:var(--text)}
.btn-sm{background:var(--card);border:1px solid var(--border2);color:var(--text2);border-radius:7px;padding:4px 10px;font-size:11px;font-family:var(--mono);cursor:pointer;transition:all .2s;white-space:nowrap;flex-shrink:0}
.btn-sm:hover{background:var(--border);color:var(--text)}
.btn-sm.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.btn-sm.primary:hover{background:var(--accent2)}
.btn-sm:disabled{opacity:.4;cursor:not-allowed}
.btn-push-sm{background:var(--card);border:1px solid var(--border2);color:var(--text2);border-radius:7px;padding:4px 9px;font-size:13px;cursor:pointer;transition:all .2s;flex-shrink:0}
.btn-push-sm.active{border-color:var(--green);color:var(--green)}

/* ── MAIN LAYOUT ── */
.main{position:relative;z-index:1;padding:16px}
.grid{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
@media(max-width:720px){.grid{grid-template-columns:1fr}}

/* ── DATE GROUPS ── */
.vagas-wrap{display:flex;flex-direction:column;gap:8px}

/* ── FILTER TABS ── */
.filter-row{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.filter-row::-webkit-scrollbar{display:none}
.ftab{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text2);transition:all .15s;white-space:nowrap;flex-shrink:0}
.ftab.active{background:var(--accent);border-color:var(--accent);color:#fff}

/* ── DATE CARD ── */
.date-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;animation:fadeUp .3s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.date-header{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--card2);border-bottom:1px solid var(--border)}
.date-num{font-size:22px;font-weight:800;font-family:var(--mono);line-height:1}
.date-info{flex:1}
.date-month{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text3)}
.date-weekday{font-size:13px;font-weight:600;color:var(--text2)}
.date-total{font-size:12px;font-family:var(--mono);font-weight:600;color:var(--text2);text-align:right}
.date-total.has{color:var(--green)}
.date-total.none{color:var(--text3)}

/* ── HORÁRIOS ── */
.horas-grid{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px}
.hora-chip{display:flex;align-items:center;gap:7px;border-radius:10px;padding:8px 12px;border:1px solid;min-width:90px;flex:1;transition:all .2s}
.hora-chip.many{background:var(--green-bg);border-color:var(--green-border);color:var(--green)}
.hora-chip.few{background:var(--yellow-bg);border-color:var(--yellow-border);color:var(--yellow)}
.hora-chip.none{background:var(--red-bg);border-color:var(--red-border);color:var(--red);opacity:.6}
.hora-chip.prio{box-shadow:0 0 0 1px var(--yellow)}
.hora-time{font-size:13px;font-weight:600;font-family:var(--mono)}
.hora-count{font-size:19px;font-weight:800;font-family:var(--mono);line-height:1;margin-left:auto}
.hora-label{font-size:9px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;opacity:.7;margin-top:1px}
.hora-star{font-size:10px}

/* ── CALENDAR ── */
.cal-mini{margin-bottom:6px}
.cal-grid-mini{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-h{font-size:9px;font-weight:700;color:var(--text3);text-align:center;padding:2px 0}
.cal-d{height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;font-family:var(--mono)}
.cal-d.empty,.cal-d.odd-day{color:var(--text3);opacity:.25}
.cal-d.past{color:var(--text3);opacity:.35}
.cal-d.no-vaga{color:var(--red);background:var(--red-bg)}
.cal-d.has-vaga{color:var(--green);background:var(--green-bg)}
.cal-d.priority-vaga{color:var(--yellow);background:var(--yellow-bg)}
.cal-d.today{box-shadow:0 0 0 1px var(--accent)}

/* ── SIDE PANEL ── */
.side{display:flex;flex-direction:column;gap:10px}

/* ── ACCORDION ── */
.acc{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.acc-head{display:flex;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;user-select:none;transition:background .15s}
.acc-head:hover{background:var(--card2)}
.acc-icon{font-size:15px}
.acc-label{font-size:12px;font-weight:700;letter-spacing:.5px;flex:1}
.acc-badge{background:var(--accent);color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;font-family:var(--mono)}
.acc-arrow{color:var(--text3);font-size:12px;transition:transform .2s}
.acc.open .acc-arrow{transform:rotate(180deg)}
.acc-body{display:none;border-top:1px solid var(--border)}
.acc.open .acc-body{display:block}

/* ── QUICK BTNS ── */
.qbtns{display:flex;flex-direction:column;gap:5px;padding:10px}
.qbtn{background:var(--surface);border:1px solid var(--border2);color:var(--text);border-radius:9px;padding:9px 12px;font-size:12px;font-family:var(--font);font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;transition:all .2s;width:100%}
.qbtn:hover{background:var(--border);border-color:var(--border2)}
.qbtn.danger:hover{background:var(--red-bg);border-color:var(--red);color:var(--red)}
.qbtn .qi{font-size:14px;flex-shrink:0}

/* ── TEST PANEL ── */
.test-wrap{padding:10px;display:flex;flex-direction:column;gap:8px}
.tinput{width:100%;background:var(--surface);border:1px solid var(--border2);border-radius:9px;padding:8px 11px;font-size:13px;font-family:var(--mono);color:var(--text);outline:none;transition:border-color .2s}
.tinput:focus{border-color:var(--accent)}
textarea.tinput{resize:vertical;min-height:60px}
.tlabel{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--text3)}
.tchannels{display:flex;gap:6px}
.tch{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:7px 8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text2);transition:all .2s;user-select:none}
.tch.on{background:#1a2a3a;border-color:var(--accent);color:var(--accent2)}
.tprio{display:flex;gap:5px}
.tpr{flex:1;background:var(--surface);border:1px solid var(--border2);border-radius:7px;padding:5px 6px;font-size:11px;font-weight:600;cursor:pointer;color:var(--text2);transition:all .15s;font-family:var(--font);text-align:center}
.tpr.sel{background:#1a2a3a;border-color:var(--accent);color:var(--accent2)}
.tsend{width:100%;background:var(--accent);border:none;border-radius:9px;padding:10px;font-size:13px;font-family:var(--font);font-weight:700;color:#fff;cursor:pointer;transition:all .2s}
.tsend:hover{background:var(--accent2)}
.tsend:disabled{opacity:.4;cursor:not-allowed}
.tlog{font-size:11px;font-family:var(--mono);color:var(--text2);min-height:14px;word-break:break-all}
.tlog.ok{color:var(--green)}.tlog.err{color:var(--red)}

/* ── HISTÓRICO ── */
.hist-list{display:flex;flex-direction:column;gap:5px;padding:8px}
.hist-item{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 11px}
.hist-top{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.hist-date{font-size:13px;font-weight:700;font-family:var(--mono)}
.hist-badge{margin-left:auto;background:var(--green);color:#fff;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700;font-family:var(--mono)}
.hist-posto{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-ts{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:2px}

/* ── EMPTY ── */
.empty{color:var(--text2);font-size:13px;padding:20px;text-align:center;background:var(--card);border-radius:10px;border:1px dashed var(--border)}

/* ── TOAST ── */
.toast{position:fixed;bottom:calc(20px + var(--safe-bottom));left:50%;transform:translateX(-50%);background:var(--card2);border:1px solid var(--border2);border-radius:12px;padding:10px 16px;font-size:13px;z-index:300;animation:slideUp .25s ease;box-shadow:0 8px 32px rgba(0,0,0,.5);white-space:nowrap}
.toast.hidden{display:none}
@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

/* ── RUN BAR ── */
.run-bar{height:2px;position:fixed;top:0;left:0;right:0;z-index:400;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .3s}
.run-bar.on{animation:runbar 1.5s ease infinite}
@keyframes runbar{0%{transform:scaleX(0);opacity:1}70%{transform:scaleX(.85);opacity:1}100%{transform:scaleX(1);opacity:0}}

/* ── SECTION TITLE ── */
.sec-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.sec-title .pill{background:var(--accent);color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;letter-spacing:0;font-weight:700}
</style>
</head>
<body>

<div class="run-bar" id="run-bar"></div>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-box">
    <img src="https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png" class="login-logo" alt="GCM"/>
    <div class="login-title">Monitor de Vagas</div>
    <div class="login-sub">CETEL — Acesso restrito</div>
    <div class="field"><label>Usuário</label><input type="text" id="lu" placeholder="deac" autocomplete="username"/></div>
    <div class="field"><label>Senha</label><input type="password" id="lp" placeholder="••••••" autocomplete="current-password"/></div>
    <button class="login-btn" onclick="doLogin()">Entrar</button>
    <div class="login-err" id="login-err"></div>
  </div>
</div>

<!-- APP -->
<div id="app" style="display:none">
  <header>
    <img src="https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png" class="h-logo" alt="GCM"/>
    <div class="h-title">Monitor <span>CETEL</span></div>
    <div class="h-right">
      <span class="stat" id="mes-badge" style="margin-right:4px"></span>
      <button class="btn-logout" onclick="logout()">Sair</button>
    </div>
  </header>

  <div class="status-bar">
    <div class="pulse"></div>
    <div class="stat">Check: <b id="ultimo-check">–</b></div>
    <div class="stat">Disp: <b id="total-vagas">–</b></div>
    <button class="btn-sm" id="btn-refresh" onclick="loadData()">↻</button>
    <button class="btn-sm primary" id="btn-run" onclick="runCheck()">▶ Verificar</button>
    <button class="btn-push-sm" id="btn-push" onclick="togglePush()" title="Push">🔔<span id="push-label"></span></button>
  </div>

  <div class="main">
    <div class="grid">
      <!-- LEFT -->
      <div>
        <!-- CAL -->
        <div class="sec-title">📅 Calendário</div>
        <div class="cal-mini" style="margin-bottom:16px">
          <div class="cal-grid-mini" id="cal-grid"></div>
        </div>

        <!-- FILTERS -->
        <div class="filter-row">
          <button class="ftab active" onclick="setFilter('todas',this)">Todas</button>
          <button class="ftab" onclick="setFilter('disponiveis',this)">Com vagas</button>
          <button class="ftab" onclick="setFilter('06h',this)">06h</button>
          <button class="ftab" onclick="setFilter('11h',this)">11h</button>
          <button class="ftab" onclick="setFilter('13h',this)">13h</button>
          <button class="ftab" onclick="setFilter('priority',this)">⭐ Prio</button>
        </div>

        <!-- VAGAS -->
        <div class="sec-title">📋 Vagas <span class="pill" id="vagas-pill">0</span></div>
        <div class="vagas-wrap" id="vagas-list"></div>
      </div>

      <!-- RIGHT -->
      <div class="side">

        <!-- AÇÕES RÁPIDAS -->
        <div class="acc open" id="acc-acoes">
          <div class="acc-head" onclick="toggleAcc('acoes')">
            <span class="acc-icon">⚡</span>
            <span class="acc-label">Ações rápidas</span>
            <span class="acc-arrow">▾</span>
          </div>
          <div class="acc-body">
            <div class="qbtns">
              <button class="qbtn" onclick="window.open('https://www.gcmdeac.prefeitura.sp.gov.br','_blank')"><span class="qi">🌐</span> Abrir site DEAC</button>
              <button class="qbtn" onclick="runCheck()"><span class="qi">🔄</span> Verificar agora</button>
              <button class="qbtn danger" onclick="clearSnapshot()"><span class="qi">🗑️</span> Resetar snapshot</button>
            </div>
          </div>
        </div>

        <!-- CALENDÁRIO LATERAL (mobile esconde) -->

        <!-- ENVIAR TESTE -->
        <div class="acc" id="acc-test">
          <div class="acc-head" onclick="toggleAcc('test')">
            <span class="acc-icon">📡</span>
            <span class="acc-label">Enviar teste</span>
            <span class="acc-arrow">▾</span>
          </div>
          <div class="acc-body">
            <div class="test-wrap">
              <input type="text" class="tinput" id="test-title" placeholder="Título" value="DEAC Monitor — Teste"/>
              <textarea class="tinput" id="test-body" placeholder="Mensagem...">Notificação de teste.</textarea>
              <div class="tlabel" style="margin-top:2px">Canal</div>
              <div class="tchannels">
                <div class="tch on" id="ch-fcm" onclick="toggleCh(event,'fcm')">📲 PWA</div>
                <div class="tch on" id="ch-ntfy" onclick="toggleCh(event,'ntfy')">🔔 ntfy</div>
              </div>
              <div class="tlabel">Prioridade</div>
              <div class="tprio">
                <button class="tpr" id="prio-default" onclick="setPrio('default')">Normal</button>
                <button class="tpr sel" id="prio-high" onclick="setPrio('high')">Alta</button>
                <button class="tpr" id="prio-urgent" onclick="setPrio('urgent')">🚨 Urgente</button>
              </div>
              <button class="tsend" id="test-send-btn" onclick="sendTestNotif()">▶ Enviar</button>
              <div class="tlog" id="test-log"></div>
            </div>
          </div>
        </div>

        <!-- HISTÓRICO -->
        <div class="acc open" id="acc-hist">
          <div class="acc-head" onclick="toggleAcc('hist')">
            <span class="acc-icon">🔔</span>
            <span class="acc-label">Notificações</span>
            <span class="acc-badge" id="hist-pill">0</span>
            <span class="acc-arrow">▾</span>
          </div>
          <div class="acc-body">
            <div class="hist-list" id="hist-list"></div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<div class="toast hidden" id="toast"></div>

<script>
// ── AUTH ──
const USERS = { deac: 'deac99' };
function doLogin(){
  const u=document.getElementById('lu').value.trim();
  const p=document.getElementById('lp').value.trim();
  const err=document.getElementById('login-err');
  if(USERS[u]&&USERS[u]===p){
    sessionStorage.setItem('auth','1');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').style.display='block';
    loadData();
  } else { err.textContent='Usuário ou senha incorretos.'; document.getElementById('lp').value=''; }
}
function logout(){
  sessionStorage.removeItem('auth');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').style.display='none';
}
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!document.getElementById('login-screen').classList.contains('hidden')) doLogin();
});
if(sessionStorage.getItem('auth')==='1'){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').style.display='block';
}

// ── ACCORDION ──
function toggleAcc(id){
  document.getElementById('acc-'+id).classList.toggle('open');
}

// ── DATA ──
let allVagas=[], currentFilter='todas';
const DIAS_UTEIS=['Segunda-Feira','Terca-Feira','Quarta-Feira','Quinta-Feira','Sexta_Feira'];
function isPriority(v){ return v.hora&&v.hora.startsWith('06:')&&DIAS_UTEIS.includes(v.diaSemana); }
function fmtTs(iso){
  if(!iso) return '–';
  const d=new Date(iso);
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function setFilter(f,el){
  currentFilter=f;
  document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderVagas();
}
function toast(msg,icon='✅'){
  const t=document.getElementById('toast');
  t.innerHTML=icon+' '+msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'),3000);
}
function setLoading(on){
  document.getElementById('run-bar').className='run-bar'+(on?' on':'');
}

// ── CALENDAR ──
function renderCalendar(vagas){
  const grid=document.getElementById('cal-grid');
  const now=new Date(), year=now.getUTCFullYear(), month=now.getUTCMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const todayD=now.getUTCDate();
  const vagaMap={};
  for(const v of vagas){
    const d=parseInt(v.data.split('/')[0],10);
    if(!vagaMap[d]) vagaMap[d]={rem:0,hasPriority:false};
    vagaMap[d].rem+=v.vagasRem;
    if(isPriority(v)&&v.vagasRem>0) vagaMap[d].hasPriority=true;
  }
  const days=['D','S','T','Q','Q','S','S'];
  let html=days.map(d=>'<div class="cal-h">'+d+'</div>').join('');
  for(let i=0;i<firstDay;i++) html+='<div class="cal-d empty"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const info=vagaMap[d], isPast=d<todayD, isToday=d===todayD, isOdd=d%2!==0;
    let cls='cal-d';
    if(isPast) cls+=' past';
    else if(isOdd) cls+=' odd-day';
    else if(!info||info.rem===0) cls+=' no-vaga';
    else if(info.hasPriority) cls+=' priority-vaga';
    else cls+=' has-vaga';
    if(isToday) cls+=' today';
    html+='<div class="'+cls+'">'+d+'</div>';
  }
  grid.innerHTML=html;
}

// ── RENDER VAGAS (grouped by date) ──
function renderVagas(){
  const list=document.getElementById('vagas-list');
  let vagas=[...allVagas];

  if(currentFilter==='disponiveis') vagas=vagas.filter(v=>v.vagasRem>0);
  if(currentFilter==='priority')    vagas=vagas.filter(v=>isPriority(v));
  if(currentFilter==='06h')         vagas=vagas.filter(v=>v.hora&&v.hora.startsWith('06:'));
  if(currentFilter==='11h')         vagas=vagas.filter(v=>v.hora&&v.hora.startsWith('11:'));
  if(currentFilter==='13h')         vagas=vagas.filter(v=>v.hora&&v.hora.startsWith('13:'));

  const comVaga=allVagas.filter(v=>v.vagasRem>0).length;
  document.getElementById('vagas-pill').textContent=comVaga+' c/ vagas';

  if(!vagas.length){ list.innerHTML='<div class="empty">Nenhuma vaga encontrada.</div>'; return; }

  // Group by date
  const groups={};
  for(const v of vagas){
    if(!groups[v.data]) groups[v.data]={data:v.data,diaSemana:v.diaSemana,horas:[]};
    groups[v.data].horas.push(v);
  }

  // Sort dates
  const sorted=Object.values(groups).sort((a,b)=>{
    const da=a.data.split('/').reverse().join('');
    const db=b.data.split('/').reverse().join('');
    return da.localeCompare(db);
  });

  list.innerHTML=sorted.map((g,gi)=>{
    const totalRem=g.horas.reduce((s,h)=>s+h.vagasRem,0);
    const totalCls=totalRem===0?'none':'has';

    // Sort horas by time
    const horasSorted=[...g.horas].sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));

    const horasHtml=horasSorted.map(h=>{
      const rem=h.vagasRem;
      const hora=(h.hora||'').substring(0,5);
      const prio=isPriority(h);
      let cls='hora-chip ';
      if(rem===0) cls+='none';
      else if(rem<=2) cls+='few';
      else cls+='many';
      if(prio) cls+=' prio';
      return \`<div class="\${cls}">
        <div>
          <div class="hora-time">\${hora}</div>
          <div class="hora-label">\${rem===0?'lotado':rem<=2?'poucas':'vagas'}</div>
        </div>
        \${prio?'<span class="hora-star">⭐</span>':''}
        <div class="hora-count">\${rem}</div>
      </div>\`;
    }).join('');

    const [dia,mes]=g.data.split('/');
    const meses=['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesNome=meses[parseInt(mes,10)]||mes;

    return \`<div class="date-card" style="animation-delay:\${gi*0.04}s">
      <div class="date-header">
        <div class="date-num">\${dia}</div>
        <div class="date-info">
          <div class="date-month">\${mesNome} · \${g.data.split('/')[2]||''}</div>
          <div class="date-weekday">\${g.diaSemana}</div>
        </div>
        <div class="date-total \${totalCls}">\${totalRem} vagas</div>
      </div>
      <div class="horas-grid">\${horasHtml}</div>
    </div>\`;
  }).join('');
}

// ── RENDER HISTÓRICO ──
function renderHistorico(historico){
  const list=document.getElementById('hist-list');
  document.getElementById('hist-pill').textContent=historico.length;
  if(!historico.length){ list.innerHTML='<div class="empty" style="margin:8px">Nenhuma notificação ainda.</div>'; return; }
  list.innerHTML=historico.map((h,i)=>{
    const hora=(h.hora||'').substring(0,5);
    const diff=h.atual-h.anterior;
    return \`<div class="hist-item">
      <div class="hist-top">
        <span style="font-size:15px">🔔</span>
        <span class="hist-date">\${h.data} \${hora}</span>
        <span class="hist-badge">+\${diff}</span>
      </div>
      <div class="hist-posto">\${h.diaSemana} — \${h.posto||''}</div>
      <div class="hist-ts">\${fmtTs(h.ts)}</div>
    </div>\`;
  }).join('');
}

// ── LOAD DATA ──
async function loadData(){
  const btn=document.getElementById('btn-refresh');
  btn.disabled=true; btn.textContent='↻';
  setLoading(true);
  try{
    const res=await fetch('/data');
    const d=await res.json();
    allVagas=d.vagas||[];
    document.getElementById('mes-badge').textContent=d.mes||'';
    document.getElementById('total-vagas').textContent=allVagas.reduce((s,v)=>s+v.vagasRem,0);
    if(d.ultimoCheck) document.getElementById('ultimo-check').textContent=fmtTs(d.ultimoCheck.ts);
    renderCalendar(allVagas);
    renderVagas();
    renderHistorico(d.historico||[]);
  }catch(e){ toast('Erro ao carregar','❌'); }
  finally{ btn.disabled=false; btn.textContent='↻'; setLoading(false); }
}

// ── RUN CHECK ──
async function runCheck(){
  const btn=document.getElementById('btn-run');
  btn.disabled=true; btn.textContent='⏳';
  setLoading(true);
  try{
    const res=await fetch('/api');
    const d=await res.json();
    allVagas=d.vagas||[];
    document.getElementById('total-vagas').textContent=allVagas.reduce((s,v)=>s+v.vagasRem,0);
    document.getElementById('ultimo-check').textContent=fmtTs(d.ts);
    renderCalendar(allVagas);
    renderVagas();
    if(d.alertas&&d.alertas.length>0) toast(d.alertas.length+' nova(s) vaga(s)!','🚨');
    else toast('Verificado — '+allVagas.reduce((s,v)=>s+v.vagasRem,0)+' vagas disponíveis','✅');
    await loadData();
  }catch(e){ toast('Erro na verificação','❌'); }
  finally{ btn.disabled=false; btn.textContent='▶ Verificar'; setLoading(false); }
}

// ── CLEAR SNAPSHOT ──
async function clearSnapshot(){
  if(!confirm('Resetar snapshot?')) return;
  try{ await fetch('/clear-snapshot',{method:'POST'}); toast('Snapshot resetado!','🗑️'); }
  catch(e){ toast('Erro ao resetar','❌'); }
}

// ── TEST PANEL ──
const testChannels={fcm:true,ntfy:true};
let testPriority='high';
function toggleCh(e,ch){
  e.preventDefault();
  testChannels[ch]=!testChannels[ch];
  document.getElementById('ch-'+ch).classList.toggle('on',testChannels[ch]);
}
function setPrio(p){
  testPriority=p;
  ['default','high','urgent'].forEach(k=>document.getElementById('prio-'+k).classList.toggle('sel',k===p));
}
async function sendTestNotif(){
  const title=document.getElementById('test-title').value.trim()||'DEAC Monitor — Teste';
  const body=document.getElementById('test-body').value.trim()||'Notificação de teste.';
  const logEl=document.getElementById('test-log');
  const btn=document.getElementById('test-send-btn');
  if(!testChannels.fcm&&!testChannels.ntfy){ logEl.textContent='Selecione ao menos um canal.'; logEl.className='tlog err'; return; }
  btn.disabled=true; logEl.textContent='Enviando...'; logEl.className='tlog';
  try{
    const resp=await fetch('/send-test',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title,body,priority:testPriority,channels:testChannels})});
    const data=await resp.json();
    const results=[];
    if(data.fcm)  results.push('PWA:'+(data.fcm.ok?'✅':'❌ '+(data.fcm.error||data.fcm.status)));
    if(data.ntfy) results.push('ntfy:'+(data.ntfy.ok?'✅':'❌ '+(data.ntfy.error||data.ntfy.status)));
    logEl.textContent=results.join(' · ');
    logEl.className='tlog '+(data.fcm?.ok||data.ntfy?.ok?'ok':'err');
  }catch(e){ logEl.textContent='Erro: '+e.message; logEl.className='tlog err'; }
  finally{ btn.disabled=false; }
}

// ── PWA + FCM ──
const VAPID_PUB='BGkAhffgOmpXgLJPuYOYgYy50QGcRkQ5M7WrRup3ALYh8Ij9Qjc_atcN2DOU_0BWpqv5YAFroHw6ENFW17fTWWc';
const FB_CONFIG={apiKey:"AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo",authDomain:"deac-monitor.firebaseapp.com",projectId:"deac-monitor",storageBucket:"deac-monitor.firebasestorage.app",messagingSenderId:"721222526794",appId:"1:721222526794:web:a27fd0a5be737f815983b3"};

async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  try{ await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'}); }
  catch(e){ console.warn('SW:',e); }
}

async function togglePush(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)){ toast('Push não suportado','❌'); return; }
  const btn=document.getElementById('btn-push');
  btn.disabled=true;
  try{
    let reg=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'});
    reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();
    if(existing){
      await existing.unsubscribe();
      await fetch('/push-subscribe',{method:'DELETE'});
      document.getElementById('push-label').textContent='';
      btn.classList.remove('active');
      toast('Notificações desativadas','🔕');
    } else {
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){ toast('Permissão negada','❌'); btn.disabled=false; return; }
      let fcmToken=null;
      try{
        const app=firebase.apps.length?firebase.app():firebase.initializeApp(FB_CONFIG);
        const msg=firebase.messaging(app);
        fcmToken=await msg.getToken({vapidKey:VAPID_PUB,serviceWorkerRegistration:reg});
      }catch(e){ console.warn('FCM:',e); }
      let body;
      if(fcmToken){ body=JSON.stringify({fcmToken}); }
      else{
        const pad='='.repeat((4-VAPID_PUB.length%4)%4);
        const raw=atob(VAPID_PUB.replace(/-/g,'+').replace(/_/g,'/')+pad);
        const key=new Uint8Array(raw.length);
        for(let i=0;i<raw.length;i++) key[i]=raw.charCodeAt(i);
        const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
        body=JSON.stringify(sub.toJSON());
      }
      const r=await fetch('/push-subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body});
      const res=await r.json();
      if(res.ok){
        document.getElementById('push-label').textContent='✓';
        btn.classList.add('active');
        toast('Notificações ativadas! '+(fcmToken?'(FCM)':'(WebPush)'),'🔔');
      } else { toast('Erro: '+JSON.stringify(res),'❌'); }
    }
  }catch(e){ toast('Erro: '+e.message,'❌'); }
  finally{ btn.disabled=false; }
}

async function checkPushStatus(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)) return;
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    const btn=document.getElementById('btn-push');
    if(sub){ document.getElementById('push-label').textContent='✓'; btn.classList.add('active'); }
    else { document.getElementById('push-label').textContent=''; btn.classList.remove('active'); }
  }catch(_){}
}

setInterval(loadData, 5*60*1000);
if(sessionStorage.getItem('auth')==='1') loadData();
registerSW().then(checkPushStatus);
</script>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────
// UTILS – Data
// ──────────────────────────────────────────────────────────────
function getMesAtual() {
  const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const now = new Date();
  return meses[now.getUTCMonth()] + "/" + now.getUTCFullYear();
}

function getYesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.getUTCFullYear() + "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(d.getUTCDate()).padStart(2, "0");
}
