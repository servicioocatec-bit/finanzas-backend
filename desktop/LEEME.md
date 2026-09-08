# Control Finanzas Studio — App de escritorio (Mac + Windows)

Este proyecto empaqueta la app como aplicación de escritorio con Electron y
genera los **instaladores**: `.dmg` para macOS y `.exe` para Windows.

## Qué necesitas (una sola vez)
- **Node.js** instalado en el computador donde vas a construir: https://nodejs.org (versión LTS).
- El `.dmg` de Mac **se construye en un Mac**, y el `.exe` de Windows **se construye en un PC con Windows**. No se puede generar el de Mac desde Windows ni al revés (limitación de Apple/Microsoft, no del proyecto).

## Construir el instalador

### En macOS
1. **Descomprime el .zip haciendo doble clic en Finder** (la utilidad de macOS conserva los permisos del script).
2. Doble clic en **`construir-mac.command`**.
   - Si dice *"no tienes los privilegios de acceso"* o *"desarrollador no identificado"*: **clic derecho sobre el archivo → Abrir → Abrir**. La primera vez hay que abrirlo así.
   - Si aun así no deja: abre Terminal una sola vez, escribe `chmod +x ` (con espacio al final), **arrastra el archivo a la ventana de Terminal** y presiona Enter. Luego vuelve a hacer doble clic.
3. Espera (la primera vez baja Electron, tarda unos minutos).
4. El `.dmg` queda en la carpeta **`instaladores/`** y se abre sola.

### En Windows
1. Doble clic en **`construir-windows.bat`**.
2. Espera a que termine.
3. El instalador `.exe` queda en la carpeta **`instaladores/`**.

> Si prefieres la consola: `npm install` y luego `npm run dist:mac` o `npm run dist:win`.

## Probar la app sin construir el instalador
`npm install` y luego `npm start` (abre la app directamente).

## El Asesor IA en la app de escritorio
La app funciona completa offline para registrar, presupuestar, importar cartolas
y exportar. El **Asesor IA** sí necesita internet y tu backend:
1. Despliega el servidor de la carpeta `asesor-ia-server` en Railway (ver su LEEME).
2. En la app → **Ajustes → Servidor del Asesor IA**, pega la URL
   `https://tu-servidor.up.railway.app/api/asesor`.

## Firma de código (opcional, para distribuir sin advertencias)
Sin firma, macOS y Windows mostrarán un aviso de "desarrollador no identificado"
la primera vez (el usuario igual puede abrir con clic derecho → Abrir).
Para venta a público conviene firmar:
- **macOS:** cuenta Apple Developer (USD 99/año) + notarización.
- **Windows:** certificado de firma de código (Authenticode).
electron-builder soporta ambos; cuando tengas los certificados se configuran aquí
en `package.json` → `build`.

## Notas técnicas
- El ícono está en `build/icon.png` (1024×1024). electron-builder genera
  automáticamente los formatos `.icns` (Mac) e `.ico` (Windows).
- Para que la app abra y cierre rápido y use poca memoria, está configurada con
  `contextIsolation` activado y sin acceso de Node desde la interfaz (más segura).

## Funciona sin internet
Las librerías (gráficos, exportación a Excel/PDF e íconos) van **empotradas** en la
app (carpeta `app/vendor`), así que registrar, presupuestar, ver gráficos y exportar
funcionan **sin conexión**. Solo el **Asesor IA** y los **pagos** necesitan internet
(porque hablan con tu servidor); si no hay red, la app avisa y el resto sigue operando.
