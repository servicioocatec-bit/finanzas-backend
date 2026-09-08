#!/bin/bash
# ============================================================
#  Construir instalador para macOS (.dmg)
#  Doble clic sobre este archivo. Requiere Node.js instalado
#  (https://nodejs.org). Genera el .dmg en la carpeta "instaladores".
# ============================================================
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Control Finanzas Studio — generando instalador para macOS"
echo "  --------------------------------------------------------"

if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠ No se encontró Node.js. Instálalo desde https://nodejs.org y vuelve a intentar."
  echo ""
  read -r -p "  Presiona Enter para cerrar..."
  exit 1
fi

echo "  • Node.js: $(node -v)"
echo "  • Instalando dependencias (la primera vez tarda unos minutos)..."
npm install || { echo "  ✗ Falló npm install"; read -r -p "Enter para cerrar..."; exit 1; }

echo "  • Construyendo el .dmg..."
npm run dist:mac || { echo "  ✗ Falló la construcción"; read -r -p "Enter para cerrar..."; exit 1; }

echo ""
echo "  ✓ Listo. El instalador está en la carpeta 'instaladores'."
open instaladores 2>/dev/null
read -r -p "  Presiona Enter para cerrar..."
