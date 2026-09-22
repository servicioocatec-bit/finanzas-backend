# Fix — "borro/edito pero el movimiento sigue apareciendo"

Fecha: 2026-09-21

## Causa raíz
La sincronización con el backend está diseñada para "borrado suave" (tombstones):
el servidor guarda los registros marcados `deleted:true` y los reenvía para que el
merge funcione. Pero el cliente borraba movimientos con **borrado duro**
(`movimientos.filter(m=>m.id!==id)`), sin dejar tombstone. Resultado:

- Al borrar, el movimiento desaparecía local… pero el servidor seguía teniéndolo
  y en el siguiente sync (`_aplicarRemoto`/al volver a la app) lo **reinyectaba**.
- Al editar, no se actualizaba `updatedAt`, así que el merge "último gana" quedaba
  empatado y una descarga vieja podía **revertir** la edición.

Los "recurrentes" ya usaban borrado suave; los movimientos no. Esa era la diferencia.

## Cambios (en pwa, desktop y backend/public)
- `eliminar()`: ahora borrado suave → `m.deleted=true; m.updatedAt=Date.now()`.
- `borrarTodo()`: borrado suave de todo el período.
- `submitMov()`: cada alta/edición setea `updatedAt` (para que el merge resuelva bien).
- Se ocultan los `deleted:true` en TODO lo que lee movimientos:
  `movsPeriodo`, cálculo de saldo/fondo, gráficos anuales y el dedupe de cartola.
- Respaldo JSON excluye tombstones.
- **backend/public/index.html**: la lista de movimientos NO tenía botones de
  editar/eliminar (esa versión era la que servía el servidor). Se agregaron.

El servidor (server.js) ya soportaba tombstones; no requirió cambios.

## Segunda pasada — "dejarlo 100% operativo"
- **backend/public/index-desktop.html**: era un 4º archivo cliente (el que el
  servidor sirve a navegadores de ESCRITORIO vía `/app/index-desktop.html`) y
  tenía los mismos bugs. Se le aplicó todo el fix de borrado suave + updatedAt.
- Asesor IA: se eliminó el fallback que llamaba directo a `api.anthropic.com`
  desde el navegador (habría expuesto la API key y fallaba por CORS). Ahora, sin
  backend configurado, muestra un mensaje claro. El camino real es `/api/asesor`
  del server, que ya usa `ANTHROPIC_API_KEY` del lado servidor. ✔
- Pruebas ejecutadas (navegador headless, Chromium):
  - PWA standalone, móvil servido (/app/), escritorio servido (index-desktop.html):
    agregar → editar → BORRAR → recargar. En los 4, el borrado NO reaparece,
    la edición persiste, 0 errores de JS reales.
  - Servidor Express: arranca, `GET /` responde, `POST /api/datos` sin licencia → 402. ✔

Archivos cliente ahora consistentes (4): pwa, desktop/app, backend/public/index.html,
backend/public/index-desktop.html.

## Tercera pasada — unificación + features (todo junto)
- **Núcleo compartido `cfs-core.js`**: se creó un solo archivo con la lógica común
  (categorización + reglas, purga de tombstones, helpers) usado por las 4 caras.
  Maestro en `shared/cfs-core.js`; copiado a pwa/, backend/public/ y desktop/app/.
  Para actualizar: editar el maestro y correr `./sincronizar-core.sh`.
- **Editor de reglas de categorización** (Ajustes): el usuario agrega reglas propias
  "palabra clave → categoría/subcategoría" (ej: TUU → Alimentación). Se guardan en
  CONFIG.reglasCat y tienen prioridad sobre las reglas base. UI compartida en el núcleo.
- **Purga automática de borrados**: al cargar, se eliminan definitivamente los
  movimientos deleted:true con más de 120 días (evita que los tombstones crezcan sin fin).
- **Service Workers** actualizados a cfs-v2 (cachean cfs-core.js; fuerza que las PWA ya
  instaladas reciban la actualización).
- **Dedupe**: se mantuvo EXACTO (fecha+monto+descripción) a propósito, para no borrar por
  error dos gastos distintos del mismo día y monto. La mejora "difusa" queda pendiente y opt-in.
- Pruebas (navegador headless, las 4 caras): núcleo cargado, categorización con reglas,
  purga, agregar/editar/borrar con persistencia tras recarga, editor de reglas presente.
  Cero errores de JS.
