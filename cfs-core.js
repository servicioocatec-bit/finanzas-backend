/* ============================================================================
   cfs-core.js · Núcleo compartido de Control Finanzas Studio
   ----------------------------------------------------------------------------
   Lógica común a las 4 caras de la app (PWA, escritorio web, escritorio
   Electron y backend). EDITAR SOLO ESTE ARCHIVO: las copias en pwa/,
   desktop/app/ y backend/public/ se generan desde aquí (ver sincronizar-core).
   Expone window.CFSCore. No toca el DOM salvo en renderReglasCat().
   ============================================================================ */
(function (global) {
  'use strict';

  function _norm(s) { return String(s == null ? '' : s).toLowerCase(); }

  /* ---- Reglas base de auto-categorización (EGRESOS) ---- */
  var REGLAS_BASE = [
    [/pedidosya|uber ?eats|rappi|cornershop|justo/, 'Alimentación', 'Delivery'],
    [/superm|lider|jumbo|santa isabel|unimarc|tottus|acuenta|mayorista|almac|erbi|big john|ok market|oxxo/, 'Alimentación', 'Supermercado'],
    [/mcdonald|burger|kfc|doggis|restau|food|sushi|pizza|cafe|caffe|starbucks|sbx|juan maestro|telepizza/, 'Alimentación', 'Restaurante'],
    [/botiller|licor|the bros|vinos/, 'Alimentación', 'Otros'],
    [/copec|shell|petrobras|aramco|bencina|combustible|enex|terpel/, 'Transporte', 'Bencina'],
    [/cabify|didi|\bbeat\b|uber(?! ?eats)/, 'Transporte', 'Uber / taxi'],
    [/\btag\b|autopista|costanera|vespucio|peaje/, 'Transporte', 'TAG / peajes'],
    [/cruz verde|salcobrand|ahumada|farmacia/, 'Salud', 'Medicamentos'],
    [/\benel\b|\bcge\b|frontel|saesa|edelmag/, 'Servicios básicos', 'Luz'],
    [/gtd|mundo pacifico|\bvtr\b|movistar|entel|\bwom\b|claro|internet|fibra/, 'Servicios básicos', 'Internet'],
    [/aguas|essbio|esval|nuevosur|smapa/, 'Vivienda', 'Agua'],
    [/netflix|spotify|disney|\bhbo\b|\bmax\b|prime video|youtube|paramount|crunchyroll/, 'Suscripciones', 'Streaming'],
    [/google|apple\.com|itunes|microsoft|adobe|openai|anthropic|chatgpt|dropbox|notion|canva/, 'Suscripciones', 'Software'],
    [/zara|falabella|paris|ripley|h&m|hites|corona|dijon/, 'Ocio y bienestar', 'Ropa'],
    [/cajero|redbanc|giro/, 'Otros gastos', 'Varios']
  ];

  /* Categoriza un egreso. reglasUsuario: [{kw,cat,sub}] tiene prioridad. */
  function catEgreso(desc, reglasUsuario) {
    var d = _norm(desc);
    var ru = reglasUsuario || [];
    for (var i = 0; i < ru.length; i++) {
      var r = ru[i];
      if (r && r.kw && d.indexOf(_norm(r.kw)) > -1) return { cat: r.cat, sub: r.sub || '' };
    }
    for (var j = 0; j < REGLAS_BASE.length; j++) {
      if (REGLAS_BASE[j][0].test(d)) return { cat: REGLAS_BASE[j][1], sub: REGLAS_BASE[j][2] };
    }
    return null;
  }

  function catIngreso(desc) {
    var d = _norm(desc);
    if (/sueldo|remuneraci|honorari|n[oó]mina/.test(d)) return { cat: 'Sueldo', sub: 'Sueldo líquido' };
    if (/transf|abono|dep[oó]sito|traspaso/.test(d)) return { cat: 'Transferencias', sub: 'Otros' };
    return { cat: 'Otros ingresos', sub: '' };
  }

  /* Elimina definitivamente los tombstones (deleted:true) con updatedAt más
     antiguo que 'dias' (por defecto 120). Devuelve un arreglo nuevo. */
  function purgarTombstones(arr, dias) {
    var lim = Date.now() - (dias || 120) * 86400000;
    return (arr || []).filter(function (m) {
      return !(m && m.deleted && (m.updatedAt || 0) < lim);
    });
  }

  /* Normaliza una descripción para comparaciones (quita ciudad/país y símbolos). */
  function normDesc(s) {
    return _norm(s)
      .replace(/\b(chl|cl|coquimbo|santiago|la serena|las condes|santa maria|elqui|vina|valparaiso|providencia)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);
  }

  var $ = function (id) { return document.getElementById(id); };

  /* ---- Editor de reglas de categorización (UI compartida) ----
     Renderiza dentro de #containerId. Usa los globales PLAN_EGRESOS, CONFIG y
     guardar() de la app anfitriona. actualizarFn (opcional) se llama al cambiar. */
  function renderReglasCat(containerId, actualizarFn) {
    var box = $(containerId);
    if (!box) return;
    var CFG = global.CONFIG || {};
    if (!Array.isArray(CFG.reglasCat)) CFG.reglasCat = [];
    var cats = (global.PLAN_EGRESOS || []).map(function (e) { return e.cat; });
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    var opts = cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');

    var lista = CFG.reglasCat.map(function (r, i) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.15);font-size:.82rem">' +
        '<span style="flex:1;min-width:0"><strong>' + esc(r.kw) + '</strong> <span style="opacity:.7">→ ' + esc(r.cat) + (r.sub ? ' / ' + esc(r.sub) : '') + '</span></span>' +
        '<button type="button" data-cfs-del="' + i + '" style="border:none;background:none;color:#f06070;cursor:pointer;font-size:.95rem;padding:4px">✕</button>' +
        '</div>';
    }).join('') || '<div style="opacity:.6;font-size:.8rem;padding:6px 0">Aún no hay reglas propias. La app ya trae categorización automática; aquí puedes añadir las tuyas (ej: "TUU" → Alimentación).</div>';

    box.innerHTML =
      '<div style="font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin-bottom:10px">Reglas de categorización</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<input id="cfs-rk" placeholder="Palabra clave (ej: TUU, RedGloba)" style="width:100%;padding:.7rem .85rem;border-radius:10px;border:1px solid rgba(128,128,128,.3);background:rgba(128,128,128,.06);color:inherit;font:inherit">' +
        '<div style="display:flex;gap:8px">' +
          '<select id="cfs-rc" style="flex:1;padding:.7rem .5rem;border-radius:10px;border:1px solid rgba(128,128,128,.3);background:rgba(128,128,128,.06);color:inherit;font:inherit">' + opts + '</select>' +
          '<select id="cfs-rs" style="flex:1;padding:.7rem .5rem;border-radius:10px;border:1px solid rgba(128,128,128,.3);background:rgba(128,128,128,.06);color:inherit;font:inherit"></select>' +
        '</div>' +
        '<button type="button" id="cfs-radd" style="padding:.6rem 1rem;border-radius:10px;border:none;background:linear-gradient(135deg,#0e7c5a,#34d399);color:#fff;font-weight:600;cursor:pointer">+ Agregar regla</button>' +
      '</div>' +
      '<div style="margin-top:10px">' + lista + '</div>';

    function pintarSubs() {
      var it = (global.PLAN_EGRESOS || []).find(function (e) { return e.cat === $('cfs-rc').value; });
      $('cfs-rs').innerHTML = (it ? it.subs : []).map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    }
    pintarSubs();
    $('cfs-rc').onchange = pintarSubs;
    $('cfs-radd').onclick = function () {
      var kw = ($('cfs-rk').value || '').trim();
      if (!kw) return;
      CFG.reglasCat.push({ kw: kw, cat: $('cfs-rc').value, sub: $('cfs-rs').value });
      if (typeof global.guardar === 'function') global.guardar();
      renderReglasCat(containerId, actualizarFn);
      if (typeof actualizarFn === 'function') actualizarFn();
    };
    Array.prototype.forEach.call(box.querySelectorAll('[data-cfs-del]'), function (b) {
      b.onclick = function () {
        CFG.reglasCat.splice(+b.getAttribute('data-cfs-del'), 1);
        if (typeof global.guardar === 'function') global.guardar();
        renderReglasCat(containerId, actualizarFn);
        if (typeof actualizarFn === 'function') actualizarFn();
      };
    });
  }

  global.CFSCore = {
    version: '1.0.0',
    catEgreso: catEgreso,
    catIngreso: catIngreso,
    purgarTombstones: purgarTombstones,
    normDesc: normDesc,
    renderReglasCat: renderReglasCat,
    _norm: _norm
  };
})(typeof window !== 'undefined' ? window : this);
