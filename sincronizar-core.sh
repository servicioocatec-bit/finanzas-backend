#!/usr/bin/env bash
# Copia el núcleo maestro a las 3 caras de la app. Ejecutar tras editar shared/cfs-core.js
cd "$(dirname "$0")"
cp shared/cfs-core.js pwa/cfs-core.js
cp shared/cfs-core.js backend/public/cfs-core.js
cp shared/cfs-core.js desktop/app/cfs-core.js
echo "cfs-core.js sincronizado en pwa/, backend/public/ y desktop/app/"
