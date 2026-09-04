# Backend de Control Finanzas Studio (licencias + Flow + Asesor IA)

Este servicio es **independiente de Acopia**: repo propio, servicio propio en
Railway, su propio volumen y prefijo de órdenes `CFS-`. Puedes usar la **misma
cuenta de Flow** que Acopia sin que se crucen, porque cada orden lleva ese prefijo.

## 1. Subir a GitHub (repo NUEVO)
Crea un repositorio nuevo, por ejemplo **`finanzas-backend`** (NO lo mezcles con
`acopia-licencias`). Arrastra estos archivos:
- `server.js`
- `package.json`
- (opcional) `LEEME-DESPLIEGUE.md`

## 2. Crear el servicio en Railway
1. railway.app → **New Project** → **Deploy from GitHub repo** → elige `finanzas-backend`.
2. Railway instala y arranca solo (`npm start`).
3. **Agrega un Volumen** (Railway → servicio → **Volumes** → New Volume) montado en **`/data`**.
   Es su almacenamiento propio; no compartas el volumen de Acopia.

## 3. Variables (Railway → Variables)
| Variable | Valor | ¿Obligatoria? |
|---|---|---|
| `ANTHROPIC_API_KEY` | tu clave `sk-ant-...` | **Sí** (para la IA) |
| `FLOW_API_KEY` | apiKey de tu comercio Flow | **Sí** (para cobrar) |
| `FLOW_SECRET_KEY` | secretKey de Flow | **Sí** |
| `FLOW_API_URL` | `https://sandbox.flow.cl/api` (pruebas) · `https://www.flow.cl/api` (producción) | Recomendada |
| `PUBLIC_URL` | la URL pública de ESTE servicio, ej. `https://finanzas-backend.up.railway.app` | **Sí** |
| `MODEL` | `claude-sonnet-4-6` (def.) o `claude-haiku-4-5-20251001` (más barato) | No |
| `ALLOWED_ORIGIN` | dominio de tu app (vacío = cualquiera) | No |
| `IA_LIMITE_DIA` | consultas IA por licencia/día (def. 40) | No |
| `LIMITE_EQUIPOS` | equipos permitidos por licencia (def. 2) | No |
| `TRIAL_DIAS` | días de prueba gratis por equipo al instalar (def. 10). Solo desbloquea **exportar Excel/PDF e importar cartola**; el Asesor IA nunca entra en la prueba, siempre exige Pro pagado | No |

## 4. Dominio
Railway → **Settings** → **Generate Domain**. Copia esa URL en `PUBLIC_URL`
(redeploy) y úsala también en la app.

## 5. Conectar la app
En **Control Finanzas Studio → Ajustes → Servidor (backend)** pega solo la
**URL base** (sin `/api/...`):
```
https://finanzas-backend.up.railway.app
```
De ahí la app arma sola el Asesor IA y los pagos.

## Cómo funciona el cobro
1. El usuario pone su correo en **Ajustes → Tu plan** y elige **Pro mensual/anual**.
2. La app pide al backend crear el pago; se abre **Flow** en el navegador.
3. Al pagar, Flow llama al webhook `PUBLIC_URL/api/pago/confirmar` (server-to-server),
   el backend verifica el estado y activa la licencia con su fecha de vencimiento.
4. El usuario vuelve a la app y pulsa **“Revisar mi plan”** → queda Pro y se
   desbloquea el Asesor IA.

La **clave de licencia** (`CFS-XXXX-XXXX-XXXX`) se guarda en la app; sirve para
reactivar el plan en otro equipo (la pega en *Activar licencia*).

## Precios
Edita el objeto `PLANES` en `server.js` (montos en CLP enteros). Por defecto:
Pro mensual $4.990 · Pro anual $49.900 · Negocio mensual $12.990 · Negocio anual $124.900.

El plan **Negocio** incluye todo lo de Pro (exportar, cartola, Asesor IA) más el
módulo Negocio en la app: categorías de PyME, IVA débito/crédito fiscal,
cotizaciones/facturas simples en PDF y cuentas por cobrar/pagar. No es
facturación electrónica del SII (eso exige certificado digital e inscripción
legal aparte); son documentos de cobro en PDF para uso interno.

## Pruebas
1. Empieza con `FLOW_API_URL=https://sandbox.flow.cl/api` y credenciales de
   sandbox de Flow. Haz un pago de prueba completo.
2. Verifica que la raíz del dominio responde `{"ok":true,...,"flow":"sandbox"}`.
3. Cuando funcione, cambia a producción (`https://www.flow.cl/api`) con tus
   credenciales reales.

## Nota sobre renovación automática
Hoy cada pago suma su período (30 o 365 días) a la licencia. Para cobro
**recurrente automático** se usa la API de Suscripciones de Flow (planes +
customer + subscription), igual que en Acopia; el código está organizado para
incorporarlo después sin rehacer lo demás.
