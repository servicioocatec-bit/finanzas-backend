const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let win;

function crearVentana() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b1220',
    title: 'Control Finanzas Studio',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); }
  });
}

// Menú mínimo y profesional (copiar/pegar, zoom, recargar)
function crearMenu() {
  const esMac = process.platform === 'darwin';
  const template = [
    ...(esMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Archivo',
      submenu: [esMac ? { role: 'close', label: 'Cerrar' } : { role: 'quit', label: 'Salir' }]
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    { role: 'windowMenu', label: 'Ventana' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName('Control Finanzas Studio');

app.whenReady().then(() => {
  crearMenu();
  crearVentana();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
