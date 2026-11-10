// Meta Conversions API (CAPI) — envia eventos do site pelo servidor.
//
// Rota: POST /api/meta
// Variáveis de ambiente (Netlify > Site configuration > Environment variables,
// escopo "Functions"):
//   META_PIXEL_ID          ID do pixel/conjunto de dados (ex.: 1154264370403111)
//   META_CAPI_TOKEN        token de acesso da API de Conversões (SECRETO)
//   META_GRAPH_VERSION     opcional, padrão "v23.0"
//   META_TEST_EVENT_CODE   opcional: código de teste do Gerenciador de Eventos
//
// O navegador manda os dados em texto puro; aqui eles são normalizados e
// criptografados (SHA-256) antes de ir para a Meta, como ela exige.
// O mesmo event_id é usado no pixel do navegador, então a Meta deduplica.

const ALLOWED_EVENTS = new Set(["Lead", "Contact"]);

type Body = {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  user_data?: {
    phone?: string;
    email?: string;
    name?: string;
    fbp?: string;
    fbc?: string;
    external_id?: string;
  };
  custom_data?: Record<string, unknown>;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw?: string): string | undefined {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length === 10 || d.length === 11) d = "55" + d; // número BR sem DDI
  return d.length >= 12 && d.length <= 15 ? d : undefined;
}

function normalizeText(raw?: string): string | undefined {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return v || undefined;
}

function cleanString(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  return v ? v.slice(0, max) : undefined;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const pixelId = Netlify.env.get("META_PIXEL_ID");
  const token = Netlify.env.get("META_CAPI_TOKEN");
  if (!pixelId || !token) {
    console.error("meta-capi: META_PIXEL_ID ou META_CAPI_TOKEN não configurados");
    return json({ ok: false, error: "not_configured" }, 500);
  }

  // Só aceita chamadas vindas do próprio site.
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  try {
    if (!origin || new URL(origin).host !== host) return json({ ok: false, error: "forbidden" }, 403);
  } catch {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let body: Body;
  try {
    const text = await req.text();
    if (text.length > 8000) return json({ ok: false, error: "too_large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const eventName = String(body.event_name || "");
  if (!ALLOWED_EVENTS.has(eventName)) return json({ ok: false, error: "event_not_allowed" }, 400);

  const u = body.user_data || {};
  const user_data: Record<string, unknown> = {
    client_ip_address: context?.ip || req.headers.get("x-nf-client-connection-ip") || undefined,
    client_user_agent: req.headers.get("user-agent") || undefined,
  };

  const phone = normalizePhone(u.phone);
  if (phone) user_data.ph = [await sha256(phone)];

  const email = cleanString(u.email, 200)?.toLowerCase();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) user_data.em = [await sha256(email)];

  const parts = String(u.name || "").trim().split(/\s+/).filter(Boolean);
  const fn = normalizeText(parts[0]);
  const ln = parts.length > 1 ? normalizeText(parts[parts.length - 1]) : undefined;
  if (fn) user_data.fn = [await sha256(fn)];
  if (ln) user_data.ln = [await sha256(ln)];

  const fbp = cleanString(u.fbp, 200);
  const fbc = cleanString(u.fbc, 600);
  if (fbp && /^fb\.\d\.\d+\.\d+$/.test(fbp)) user_data.fbp = fbp;
  if (fbc && /^fb\.\d\.\d+\./.test(fbc)) user_data.fbc = fbc;

  const externalId = cleanString(u.external_id, 100);
  if (externalId) user_data.external_id = [await sha256(externalId)];

  user_data.country = [await sha256("br")];

  const custom: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(body.custom_data || {}).slice(0, 15)) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue;
    if (typeof v === "number" && isFinite(v)) custom[k] = v;
    else if (typeof v === "string" && v.length <= 100) custom[k] = v;
  }

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: cleanString(body.event_id, 100),
    event_source_url: cleanString(body.event_source_url, 1000) || origin,
    action_source: "website",
    user_data,
    custom_data: custom,
  };

  const payload: Record<string, unknown> = { data: [event] };
  const testCode = Netlify.env.get("META_TEST_EVENT_CODE");
  if (testCode) payload.test_event_code = testCode;

  const version = Netlify.env.get("META_GRAPH_VERSION") || "v23.0";
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("meta-capi: erro da Meta", res.status, JSON.stringify(out).slice(0, 500));
      return json({ ok: false, error: "meta_error", status: res.status }, 502);
    }
    return json({ ok: true, events_received: out.events_received ?? null });
  } catch (e) {
    console.error("meta-capi: falha ao chamar a Meta", String(e));
    return json({ ok: false, error: "network" }, 502);
  }
};

export const config = { path: "/api/meta", method: "POST" };
