/* =====================================================================
   Control Finanzas Studio — Backend (licencias + Flow + Asesor IA)
   ---------------------------------------------------------------------
   Servicio INDEPENDIENTE de Acopia:
     · Repo propio en GitHub (ej. "finanzas-backend")
     · Servicio propio en Railway con su PROPIO volumen en /data
     · Prefijo de órdenes "CFS-" para no chocar con las de Acopia en Flow
     · Base de datos propia en /data/db.json

   Variables de entorno (Railway → Variables):
     ANTHROPIC_API_KEY   (obligatoria) clave sk-ant-... para el Asesor IA
     FLOW_API_KEY        (obligatoria) apiKey de tu comercio Flow
     FLOW_SECRET_KEY     (obligatoria) secretKey de Flow (firma)
     FLOW_API_URL        (opcional)    https://www.flow.cl/api  (producción)
                                       https://sandbox.flow.cl/api (pruebas, por defecto)
     PUBLIC_URL          (obligatoria) URL pública de ESTE servicio,
                                       ej. https://finanzas-backend.up.railway.app
     MODEL               (opcional)    claude-sonnet-4-6 (def.) | claude-haiku-4-5-20251001
     ALLOWED_ORIGIN      (opcional)    dominio de tu app (vacío = cualquiera)
     IA_LIMITE_DIA       (opcional)    consultas IA por licencia/día (def. 40)
     DATA_DIR            (opcional)    carpeta de datos (def. /data)
   ===================================================================== */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false })); // Flow envía el webhook como form-urlencoded

/* ---------- Config ---------- */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const FLOW_API_KEY = process.env.FLOW_API_KEY || '';
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || '';
const FLOW_API_URL = (process.env.FLOW_API_URL || 'https://sandbox.flow.cl/api').replace(/\/$/, '');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const MODEL = process.env.MODEL || 'claude-sonnet-4-6';
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').trim();
const IA_LIMITE_DIA = parseInt(process.env.IA_LIMITE_DIA || '40', 10);
const LIMITE_EQUIPOS = parseInt(process.env.LIMITE_EQUIPOS || '2', 10); // equipos por licencia
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'db.json');

/* ---------- Planes (precios en CLP, enteros) ---------- */
const PLANES = {
  pro_mensual: { nombre: 'Pro mensual', dias: 30, monto: 4990 },
  pro_anual:   { nombre: 'Pro anual',   dias: 365, monto: 49900 }
};

/* ---------- Base de datos en archivo (escritura atómica) ---------- */
function asegurarDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }
function leerDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch (_) { return { licencias: {}, ordenes: {} }; }
}
function guardarDB(db) {
  asegurarDir();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH); // atómico: evita corromper el archivo
}
let DB = (asegurarDir(), leerDB());

/* ---------- CORS ---------- */
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN || '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ===================== Utilidades de licencia ===================== */
function nuevaLicencia() {
  const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CFS-${seg()}-${seg()}-${seg()}`;
}
function estadoLicencia(key) {
  const l = DB.licencias[key];
  if (!l) return { activa: false, plan: 'free' };
  const activa = l.vence && Date.now() < l.vence;
  return { activa, plan: activa ? 'pro' : 'free', vence: l.vence || null, email: l.email || '' };
}
function extenderLicencia(key, email, planId) {
  const plan = PLANES[planId]; if (!plan) return null;
  const l = DB.licencias[key] || { email, plan: planId, creado: Date.now(), pagos: [], dispositivos: [] };
  const base = (l.vence && l.vence > Date.now()) ? l.vence : Date.now();
  l.email = email || l.email;
  l.plan = planId;
  l.vence = base + plan.dias * 24 * 60 * 60 * 1000;
  l.pagos = l.pagos || [];
  l.dispositivos = l.dispositivos || [];
  DB.licencias[key] = l;
  guardarDB(DB);
  return l;
}
/* Autoriza un equipo para una licencia. Registra el equipo si hay cupo;
   si se alcanzó el límite y el equipo es nuevo, rechaza. Sin device (apps
   antiguas) no bloquea. Devuelve {ok, nuevo}. */
function autorizarDispositivo(l, device, registrar) {
  if (!l) return { ok: false };
  if (!device) return { ok: true };
  l.dispositivos = l.dispositivos || [];
  if (l.dispositivos.includes(device)) return { ok: true };
  if (registrar && l.dispositivos.length < LIMITE_EQUIPOS) { l.dispositivos.push(device); return { ok: true, nuevo: true }; }
  return { ok: false, motivo: 'limite' };
}

/* ===================== Firma Flow ===================== */
function firmarFlow(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  for (const k of keys) toSign += k + params[k];
  return crypto.createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex');
}
async function flowPost(servicio, params) {
  const body = { ...params, apiKey: FLOW_API_KEY };
  body.s = firmarFlow(body);
  const form = new URLSearchParams(body);
  const r = await fetch(`${FLOW_API_URL}${servicio}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
async function flowGet(servicio, params) {
  const body = { ...params, apiKey: FLOW_API_KEY };
  body.s = firmarFlow(body);
  const qs = new URLSearchParams(body).toString();
  const r = await fetch(`${FLOW_API_URL}${servicio}?${qs}`, { method: 'GET' });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

/* ===================== Salud ===================== */
app.get('/', (_req, res) => res.json({
  ok: true, servicio: 'finanzas-backend', modelo: MODEL,
  flow: FLOW_API_URL.includes('sandbox') ? 'sandbox' : 'produccion',
  planes: Object.keys(PLANES)
}));

/* ===================== Licencias ===================== */
// Consultar estado de una licencia (atando el equipo que consulta)
app.get('/api/licencia/estado', (req, res) => {
  const key = String(req.query.licencia || '').trim();
  const device = String(req.query.device || '').trim();
  const est = estadoLicencia(key);
  const l = DB.licencias[key];
  const equipos = l ? (l.dispositivos || []).length : 0;
  if (!key || !est.activa || !l) {
    return res.json({ ok: true, ...est, equipos, limiteEquipos: LIMITE_EQUIPOS });
  }
  const auth = autorizarDispositivo(l, device, true);
  if (auth.nuevo) guardarDB(DB);
  if (!auth.ok) {
    // Licencia pagada, pero este equipo excede el límite permitido
    return res.json({ ok: true, activa: false, plan: 'free', vence: est.vence, motivo: 'limite', equipos: (l.dispositivos || []).length, limiteEquipos: LIMITE_EQUIPOS });
  }
  res.json({ ok: true, ...est, equipos: (l.dispositivos || []).length, limiteEquipos: LIMITE_EQUIPOS });
});

// Desvincular los equipos de una licencia (requiere licencia + correo que coincida)
app.post('/api/licencia/liberar', (req, res) => {
  const key = String((req.body && req.body.licencia) || '').trim();
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const l = DB.licencias[key];
  if (!l) return res.status(404).json({ ok: false, error: 'Licencia no encontrada.' });
  if (l.email && email && l.email.toLowerCase() !== email) return res.status(403).json({ ok: false, error: 'El correo no coincide con la licencia.' });
  l.dispositivos = [];
  guardarDB(DB);
  res.json({ ok: true });
});

/* ===================== Pago (Flow) ===================== */
// La app pide crear un pago; devolvemos la URL de Flow para abrir en el navegador
app.post('/api/pago/crear', async (req, res) => {
  try {
    if (!FLOW_API_KEY || !FLOW_SECRET_KEY) return res.status(500).json({ ok: false, error: 'Flow no configurado en el servidor.' });
    if (!PUBLIC_URL) return res.status(500).json({ ok: false, error: 'Falta PUBLIC_URL en el servidor.' });
    let { email = '', plan = 'pro_mensual', licencia = '' } = req.body || {};
    email = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Correo inválido.' });
    const planDef = PLANES[plan]; if (!planDef) return res.status(400).json({ ok: false, error: 'Plan inválido.' });

    // Si no trae licencia, generamos una nueva (gratuita hasta que pague)
    const key = (licencia && DB.licencias[licencia]) ? licencia : nuevaLicencia();
    if (!DB.licencias[key]) { DB.licencias[key] = { email, plan, creado: Date.now(), pagos: [] }; guardarDB(DB); }

    const commerceOrder = `CFS-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`; // prefijo CFS = sin choque con Acopia
    const params = {
      commerceOrder,
      subject: `Control Finanzas Studio — ${planDef.nombre}`,
      currency: 'CLP',
      amount: planDef.monto,
      email,
      urlConfirmation: `${PUBLIC_URL}/api/pago/confirmar`,
      urlReturn: `${PUBLIC_URL}/api/pago/retorno`,
      optional: JSON.stringify({ licencia: key, plan })
    };
    const r = await flowPost('/payment/create', params);
    if (!r.ok || !r.data || !r.data.url || !r.data.token) {
      console.error('Flow create error', r.status, r.data);
      return res.status(502).json({ ok: false, error: 'No se pudo iniciar el pago en Flow.' });
    }
    DB.ordenes[commerceOrder] = { token: r.data.token, email, plan, licencia: key, estado: 'pendiente', creado: Date.now() };
    guardarDB(DB);
    // Flow indica abrir url + "?token=" + token
    res.json({ ok: true, url: `${r.data.url}?token=${r.data.token}`, licencia: key });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Error interno.' }); }
});

// Webhook que llama Flow al confirmar el pago (server-to-server)
app.post('/api/pago/confirmar', async (req, res) => {
  try {
    const token = (req.body && req.body.token) || (req.query && req.query.token);
    if (!token) return res.status(400).send('sin token');
    const r = await flowGet('/payment/getStatus', { token });
    const d = r.data || {};
    // status: 1 pendiente, 2 pagado, 3 rechazado, 4 anulado
    const orden = DB.ordenes[d.commerceOrder];
    if (d.status === 2 && orden) {
      let planId = orden.plan, key = orden.licencia;
      try { const o = JSON.parse(d.optional || '{}'); if (o.plan) planId = o.plan; if (o.licencia) key = o.licencia; } catch (_) {}
      extenderLicencia(key, orden.email, planId);
      orden.estado = 'pagado'; (DB.licencias[key].pagos = DB.licencias[key].pagos || []).push({ commerceOrder: d.commerceOrder, monto: d.amount, fecha: Date.now() });
      guardarDB(DB);
    } else if (orden) {
      orden.estado = (d.status === 3 ? 'rechazado' : d.status === 4 ? 'anulado' : 'pendiente');
      guardarDB(DB);
    }
    res.status(200).send('ok'); // Flow espera 200
  } catch (e) { console.error(e); res.status(200).send('ok'); }
});

// Verificación de respaldo: si el webhook no llegó, la app puede pedir que
// re-consultemos a Flow el estado de los pagos pendientes de una licencia.
app.post('/api/pago/verificar', async (req, res) => {
  try {
    const key = String((req.body && req.body.licencia) || '').trim();
    if (!key) return res.json({ ok: true, activada: false, ...estadoLicencia('') });
    let activada = false;
    const pendientes = Object.entries(DB.ordenes).filter(([, o]) => o.licencia === key && o.estado === 'pendiente');
    for (const [commerceOrder, orden] of pendientes) {
      try {
        const r = await flowGet('/payment/getStatus', { token: orden.token });
        const d = r.data || {};
        if (d.status === 2) {
          let planId = orden.plan;
          try { const o = JSON.parse(d.optional || '{}'); if (o.plan) planId = o.plan; } catch (_) {}
          extenderLicencia(key, orden.email, planId);
          orden.estado = 'pagado';
          (DB.licencias[key].pagos = DB.licencias[key].pagos || []).push({ commerceOrder, monto: d.amount, fecha: Date.now() });
          guardarDB(DB);
          activada = true;
        } else if (d.status === 3 || d.status === 4) {
          orden.estado = (d.status === 3 ? 'rechazado' : 'anulado'); guardarDB(DB);
        }
      } catch (_) { /* si una orden falla, seguimos con las demás */ }
    }
    res.json({ ok: true, activada, ...estadoLicencia(key) });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Error interno.' }); }
});

// Página de retorno cuando el usuario vuelve desde Flow
app.all('/api/pago/retorno', (_req, res) => {
  res.set('content-type', 'text/html; charset=utf-8').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago — Control Finanzas Studio</title><style>body{font-family:system-ui,sans-serif;background:#0b1220;color:#eaf0f8;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}.c{max-width:440px}.mk{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#0e7c5a,#34d399);margin:0 auto 18px}h1{font-size:1.4rem;margin:0 0 8px}p{color:#aebccd;line-height:1.5}</style></head><body><div class="c"><div class="mk"></div><h1>¡Gracias!</h1><p>Tu pago se está procesando. Vuelve a <b>Control Finanzas Studio</b> y presiona <b>“Revisar mi plan”</b> en Ajustes para activar tu cuenta Pro.</p><p>Puedes cerrar esta ventana.</p></div></body></html>`);
});

/* ===================== Asesor IA (solo Pro) ===================== */
const IA_PERSONA = `Eres un asesor financiero personal experto en el contexto chileno: pesos (CLP), UF, sistema de salud Isapre/Fonasa, AFP, créditos de consumo y la realidad de los hogares en Chile. Hablas en español de Chile, cercano pero profesional. Das consejos prácticos, concretos y accionables, priorizados por impacto. Usa SOLO las cifras entregadas; no inventes datos. No entregues asesoría de inversión regulada específica; cuando corresponda aclara que no reemplazas a un asesor certificado. Sé conciso y usa secciones cortas con viñetas.`;

function dentroDeCuotaIA(lic) {
  const hoy = new Date().toISOString().slice(0, 10);
  const u = lic.usoIA || { fecha: hoy, conteo: 0 };
  if (u.fecha !== hoy) { u.fecha = hoy; u.conteo = 0; }
  lic.usoIA = u;
  return u.conteo < IA_LIMITE_DIA;
}

app.post('/api/asesor', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en el servidor.' });
    const key = String((req.body && req.body.licencia) || '').trim();
    const est = estadoLicencia(key);
    if (!est.activa) return res.status(402).json({ ok: false, error: 'El Asesor IA es parte del plan Pro. Activa tu plan para usarlo.', plan: 'free' });

    const lic = DB.licencias[key];
    const device = String((req.body && req.body.device) || '').trim();
    const auth = autorizarDispositivo(lic, device, true);
    if (auth.nuevo) guardarDB(DB);
    if (!auth.ok) return res.status(402).json({ ok: false, error: 'Esta licencia ya está activa en el máximo de equipos permitidos.', plan: 'free', motivo: 'limite' });

    if (!dentroDeCuotaIA(lic)) { guardarDB(DB); return res.status(429).json({ ok: false, error: 'Alcanzaste el máximo de consultas IA por hoy. Intenta mañana.' }); }

    let { resumen = '', pregunta = '', modo = 'analisis' } = req.body || {};
    resumen = String(resumen).slice(0, 8000); pregunta = String(pregunta).slice(0, 500);
    if (!resumen.trim()) return res.status(400).json({ ok: false, error: 'Sin datos para analizar.' });

    const instr = modo === 'pregunta'
      ? `Pregunta del usuario: "${pregunta}"\n\nResponde concreto y accionable usando sus datos.`
      : `Entrega: (1) un diagnóstico breve de la salud financiera, (2) entre 3 y 5 recomendaciones priorizadas y accionables, y (3) un "próximo paso" concreto para este mes.`;
    const prompt = `${IA_PERSONA}\n\n${resumen}\n\n${instr}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) { const t = await r.text(); console.error('Anthropic', r.status, t); return res.status(502).json({ ok: false, error: 'El modelo no respondió (HTTP ' + r.status + ').' }); }
    const data = await r.json();
    const texto = (data.content || []).map(b => b.type === 'text' ? b.text : '').join('\n').trim();
    lic.usoIA.conteo++; guardarDB(DB);
    res.json({ ok: true, texto });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Error interno.' }); }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Finanzas backend en :${PORT} · ${MODEL} · Flow ${FLOW_API_URL}`));
}
module.exports = { app, firmarFlow, estadoLicencia, extenderLicencia, nuevaLicencia, PLANES };
