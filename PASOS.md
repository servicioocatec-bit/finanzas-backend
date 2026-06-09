# PASOS — Dejar todo andando (guia rapida)

Sigue el orden. Marca cada casilla [x] cuando termines. Tiempo total: ~25 min.

--------------------------------------------------------------------
## 0. Llaves que necesitas (tenlas a mano antes de empezar)
- [ ] Clave de Anthropic: console.anthropic.com -> API Keys -> Create  (empieza con sk-ant-)
- [ ] Cuenta en sandbox.flow.cl (entorno de PRUEBA) -> copia su apiKey y secretKey
      (Tus llaves REALES de Flow las usas recien al final, en el paso 9.)

--------------------------------------------------------------------
## 1. Subir el backend a GitHub (repo NUEVO)
- [ ] Descomprime finanzas-backend.zip
- [ ] github.com -> New -> nombre: finanzas-backend -> Create repository
- [ ] En el repo vacio: "uploading an existing file" -> arrastra server.js,
      package.json y los .md -> Commit changes
  (Repo nuevo. NO uses el de Acopia.)

## 2. Desplegar en Railway
- [ ] railway.app -> New Project -> Deploy from GitHub repo -> elige finanzas-backend
- [ ] Espera a que el build quede en verde

## 3. Agregar el volumen (su base de datos propia, separada de Acopia)
- [ ] Servicio -> Volumes -> New Volume -> Mount path:  /data

## 4. Cargar las variables (lo mas facil: Raw Editor)
- [ ] Servicio -> Variables -> Raw Editor -> pega ESTO y reemplaza los valores:

ANTHROPIC_API_KEY=sk-ant-AQUI-TU-CLAVE
FLOW_API_KEY=APIKEY-SANDBOX
FLOW_SECRET_KEY=SECRETKEY-SANDBOX
FLOW_API_URL=https://sandbox.flow.cl/api
MODEL=claude-sonnet-4-6
IA_LIMITE_DIA=40

  (PUBLIC_URL la agregas en el paso 5, cuando tengas el dominio.)

## 5. Dominio + prueba de vida
- [ ] Servicio -> Settings -> Networking -> Generate Domain  (copia la URL)
- [ ] Variables -> agrega:  PUBLIC_URL=https://TU-DOMINIO.up.railway.app
      (igual al dominio, con https://, SIN barra al final)
- [ ] Abre esa URL en el navegador. Debe decir:
      {"ok":true,"servicio":"finanzas-backend",...,"flow":"sandbox",...}
      Si lo ves, el servidor esta vivo.

## 6. Conectar la app
- [ ] Abre la app -> Ajustes -> Servidor (backend) -> pega la URL BASE
      (sin /api/...). Ej: https://TU-DOMINIO.up.railway.app

## 7. Probar el pago (en sandbox)
- [ ] Ajustes -> Tu plan -> escribe tu correo -> boton "Pro mensual"
- [ ] Se abre Flow -> completa el pago de prueba
- [ ] Vuelve a la app -> "Revisar mi plan" -> debe decir PRO ACTIVO
- [ ] Entra a "Asesor IA" -> "Analizar mis finanzas" -> debe responder
- [ ] Guarda tu clave de licencia CFS-XXXX-XXXX-XXXX (sirve para otro equipo)

## 8. (Opcional) Cambiar el precio
- [ ] En server.js, objeto PLANES:
      pro_mensual monto 4990, pro_anual monto 49900  -> editalo a tu gusto
      (puedes editarlo en GitHub y Railway redepliega solo)

## 9. Pasar a PRODUCCION (cobrar de verdad)
- [ ] Variables -> cambia:
      FLOW_API_URL=https://www.flow.cl/api
      FLOW_API_KEY=tu-apikey-REAL
      FLOW_SECRET_KEY=tu-secretkey-REAL
- [ ] Redeploy. La raiz del dominio ahora debe decir "flow":"produccion".

## 10. Generar los instaladores
- [ ] Mac: descomprime el zip de escritorio en Finder -> clic derecho en
      construir-mac.command -> Abrir -> sale el .dmg
- [ ] Windows: doble clic en construir-windows.bat -> sale el .exe

--------------------------------------------------------------------
## Si algo falla
- El plan no se activa tras pagar  -> casi siempre PUBLIC_URL quedo vacia o con
  una barra "/" al final. Debe ser identica al dominio de Railway.
- La IA dice "requiere plan Pro"   -> aun no estas Pro: pulsa "Revisar mi plan",
  o revisa que pegaste bien la clave de licencia.
- La raiz del dominio no responde  -> revisa que el build de Railway este verde
  y que ANTHROPIC_API_KEY / FLOW_* esten cargadas.
- "from an unidentified developer" al abrir el .command -> clic derecho -> Abrir.

## No se cruza con Acopia
Repo, servicio Railway y volumen propios; las ordenes llevan prefijo CFS-.
Puedes usar la misma cuenta Flow que Acopia sin que se mezclen.
