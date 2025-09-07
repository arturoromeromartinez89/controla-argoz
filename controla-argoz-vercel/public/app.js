/* CONTROL-A · app.js v2.0 estable
   - Evitar scroll horizontal (tablas fixed en CSS del index)
   - Mostrar disponibles en almacén origen y destino (solo folios cerrados)
   - Quitar foto por línea, botón global de evidencia
   - Salida visible desde inicio (bloqueada); editable solo al "Procesar"
   - Guardar entrada limpia la hoja y confirma mensaje
   - Pendientes en naranja con botón "Procesar este traspaso" (con checklist)
   - Vista previa = BORRADOR antes de cerrar
   - PDF final y WhatsApp solo cuando cerrado
   - Sin shorthand, sin comas colgantes
*/

(function(){
  "use strict";

  // ===== Utilidades UI =====
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
  function toast(msg){
    var t = qs('#toast'); if(!t) return;
    t.textContent = msg; t.style.display='block';
    setTimeout(function(){ t.style.display='none'; }, 2200);
  }

  // ===== Persistencia (localStorage) =====
  var STORAGE_KEY = 'CONTROL_A_DB';
  function loadDB(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){ return { traspasos: [], folio: 0 }; }
      var obj = JSON.parse(raw);
      if(!obj.traspasos){ obj.traspasos = []; }
      if(typeof obj.folio !== 'number'){ obj.folio = 0; }
      return obj;
    }catch(e){
      console.error('loadDB error', e);
      return { traspasos: [], folio: 0 };
    }
  }
  function saveDB(db){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch(e){ console.error('saveDB error', e); }
  }
  var DB = loadDB();

  // ===== Catálogo mínimo =====
  var ALMACENES = [
    { id: 'caja',  nombre: 'Caja fuerte' },
    { id: 'prod',  nombre: 'Producción' }
  ];
  var MATERIALES = [
    { id:'999', nombre:'Plata .999', aplicaAleacion:true,  tolMerma: 0.05 },
    { id:'925', nombre:'Plata .925 sólida', aplicaAleacion:false, tolMerma: 0.05 },
    { id:'limalla', nombre:'Limalla sólida', aplicaAleacion:false, tolMerma: 0.20 },
    { id:'limalla_negra', nombre:'Limalla negra', aplicaAleacion:false, tolMerma: 0.50 },
    { id:'tierras', nombre:'Tierras', aplicaAleacion:false, tolMerma: 0.70 },
    { id:'terminado', nombre:'Mercancía terminada', aplicaAleacion:false, tolMerma: 0.05 }
  ];

  // ===== Navegación lateral =====
  qsa('.tree-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      qsa('.tree-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var root = btn.getAttribute('data-root');
      renderSubmenu(root);
    });
  });

  function renderSubmenu(root){
    var host = qs('#subpanel');
    host.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'card';
    var h2 = document.createElement('h2');

    if(root === 'inventarios'){
      h2.textContent = 'Inventarios';
      card.appendChild(h2);

      var acciones = document.createElement('div');
      acciones.className = 'actions';
      var btnNew = document.createElement('button');
      btnNew.className = 'btn-primary';
      btnNew.textContent = '+ Nuevo traspaso';
      btnNew.addEventListener('click', function(){ abrirTraspasoNuevo(); });
      acciones.appendChild(btnNew);

      card.appendChild(acciones);
      host.appendChild(card);

      listarAbiertos();
    } else {
      h2.textContent = 'Submenú';
      card.appendChild(h2);
      host.appendChild(card);
    }
  }

  // ===== Tabs =====
  var viewsHost = qs('#views');
  var tabsHost = qs('#tabs');

  function openTab(id, titulo, renderFn){
    var tabBtn = qs('[data-tab="'+id+'"]', tabsHost);
    if(tabBtn){
      qsa('.tab', tabsHost).forEach(function(t){ t.classList.remove('active'); });
      tabBtn.classList.add('active');
      qsa('.view', viewsHost).forEach(function(v){ v.classList.remove('active'); });
      qs('#view-'+id, viewsHost).classList.add('active');
      return;
    }
    var tab = document.createElement('div');
    tab.className = 'tab active';
    tab.setAttribute('data-tab', id);
    tab.textContent = titulo;

    var x = document.createElement('span');
    x.className = 'x';
    x.textContent = ' ×';
    x.style.cursor = 'pointer';
    x.addEventListener('click', function(ev){
      ev.stopPropagation();
      var v = qs('#view-'+id, viewsHost);
      if(v) v.remove();
      tab.remove();
      var last = tabsHost.lastElementChild;
      if(last){
        last.classList.add('active');
        var vid = last.getAttribute('data-tab');
        var vv = qs('#view-'+vid, viewsHost);
        if(vv) vv.classList.add('active');
      }
    });

    tab.appendChild(x);
    qsa('.tab', tabsHost).forEach(function(t){ t.classList.remove('active'); });
    tabsHost.appendChild(tab);

    var view = document.createElement('div');
    view.className = 'view active';
    view.id = 'view-'+id';
    qsa('.view', viewsHost).forEach(function(v){ v.classList.remove('active'); });
    viewsHost.appendChild(view);

    renderFn(view);
  }

  // ===== Listado de folios abiertos (pendientes) =====
  function listarAbiertos(){
    var host = qs('#subpanel');
    var card = document.createElement('div');
    card.className = 'card';
    var h = document.createElement('h2');
    h.textContent = 'Traspasos pendientes';
    card.appendChild(h);

    var lst = DB.traspasos.filter(function(t){ return !t.cerrado; });
    if(lst.length === 0){
      var p = document.createElement('p');
      p.textContent = 'Sin folios abiertos.';
      card.appendChild(p);
    } else {
      lst.forEach(function(t){
        var fol = String(t.folio).padStart(3, '0');
        var row = document.createElement('div');
        row.className = 'actions';

        var pill = document.createElement('span');
        pill.className = 'pill orange';
        pill.textContent = 'Folio ' + fol;
        row.appendChild(pill);

        var btn = document.createElement('button');
        btn.className = 'btn-orange';
        btn.textContent = 'Procesar este traspaso';
        btn.addEventListener('click', function(){
          var msg = '¿Seguro que deseas procesar este traspaso?\n\nTen lista la siguiente información:\n• Mercancía terminada lista y pesada\n• Sobrante sólido pesado\n• Sobrante de limallas pesado';
          if(!confirm(msg)) return;
          abrirTraspasoExistente(t.id, true);
        });
        row.appendChild(btn);

        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  // ===== Crear nuevo traspaso =====
  function nuevoTraspasoBase(){
    DB.folio += 1;
    var id = 'T' + Date.now();
    var folioNum = DB.folio;

    var lineas = [];
    var i;
    for(i=0; i<3; i++){
      lineas.push({
        materialId: '925',
        detalle: '',
        gramos: 0,
        aleacion: 0,
        subtotal: 0
      });
    }

    // La salida se crea desde el inicio pero bloqueada
    var salidaLineas = lineas.map(function(li){
      return {
        materialId: li.materialId,
        detalle: li.detalle,
        gramos: 0,
        aleacion: 0,
        subtotal: 0
      };
    });

    var obj = {
      id: id,
      folio: folioNum,
      tipo: 'normal',
      fecha: hoyStr(),
      hora: horaStr(),
      saleDe: 'caja',
      entraA: 'prod',
      comentarios: '',
      totalGr: 0,
      lineasEntrada: lineas,
      salida: {
        creada: true,
        fecha: hoyStr(),
        hora: horaStr(),
        saleDe: 'prod',
        entraA: 'caja',
        comentarios: '',
        lineas: salidaLineas,
        totalGr: 0
      },
      cerrado: false
    };

    if(obj.saleDe === 'caja' && obj.entraA === 'prod'){ obj.tipo = 'prod'; }

    DB.traspasos.push(obj);
    saveDB(DB);
    return obj.id;
  }

  function abrirTraspasoNuevo(){
    var id = nuevoTraspasoBase();
    abrirTraspasoExistente(id, false);
  }

  // ===== Render de traspaso =====
  // modoProcesar = true → habilita edición de SALIDA y sus selects
  function abrirTraspasoExistente(id, modoProcesar){
    var tr = DB.traspasos.find(function(x){ return x.id === id; });
    if(!tr){ toast('No encontrado'); return; }

    var titulo = 'Traspaso ' + String(tr.folio).padStart(3, '0');

    openTab('trasp-' + id, titulo, function(host){
      host.innerHTML = '';

      var card = document.createElement('div');
      card.className = 'card';

      // ===== Encabezado ENTRADA =====
      var grid1 = document.createElement('div');
      grid1.className = 'grid';

      var dvFolio = document.createElement('div');
      var lbFo = document.createElement('label'); lbFo.textContent = 'Folio';
      var inFol = document.createElement('input'); inFol.readOnly = true; inFol.value = String(tr.folio).padStart(3,'0');
      dvFolio.appendChild(lbFo); dvFolio.appendChild(inFol);

      var dvFecha = document.createElement('div');
      var lbF = document.createElement('label'); lbF.textContent = 'Fecha';
      var inF = document.createElement('input'); inF.type = 'date'; inF.value = tr.fecha;
      inF.addEventListener('change', function(){ tr.fecha = inF.value; saveDB(DB); });
      dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

      var dvS = document.createElement('div');
      var lbS = document.createElement('label'); lbS.textContent = 'Sale de';
      var selS = document.createElement('select');
      ALMACENES.forEach(function(a){
        var op = document.createElement('option');
        op.value = a.id; op.textContent = a.nombre;
        if(a.id === tr.saleDe) op.selected = true;
        selS.appendChild(op);
      });
      selS.addEventListener('change', function(){
        tr.saleDe = selS.value;
        tr.tipo = (tr.saleDe === 'caja' && tr.entraA === 'prod') ? 'prod' : 'normal';
        saveDB(DB);
        inDisp.value = f2(calcDisponibles(tr.saleDe));
      });
      dvS.appendChild(lbS); dvS.appendChild(selS);

      var dvE = document.createElement('div');
      var lbE = document.createElement('label'); lbE.textContent = 'Entra a';
      var selE = document.createElement('select');
      ALMACENES.forEach(function(a){
        var op2 = document.createElement('option');
        op2.value = a.id; op2.textContent = a.nombre;
        if(a.id === tr.entraA) op2.selected = true;
        selE.appendChild(op2);
      });
      selE.addEventListener('change', function(){
        tr.entraA = selE.value;
        tr.tipo = (tr.saleDe === 'caja' && tr.entraA === 'prod') ? 'prod' : 'normal';
        saveDB(DB);
        inDisp2.value = f2(calcDisponibles(tr.entraA));
      });
      dvE.appendChild(lbE); dvE.appendChild(selE);

      var dvC = document.createElement('div');
      var lbC = document.createElement('label'); lbC.textContent = 'Comentarios';
      var txC = document.createElement('textarea'); txC.value = tr.comentarios;
      txC.addEventListener('input', function(){ tr.comentarios = txC.value; saveDB(DB); });
      dvC.appendChild(lbC); dvC.appendChild(txC);

      var dvT = document.createElement('div');
      var lbT = document.createElement('label'); lbT.textContent = 'Total GR. (entrada)';
      var inT = document.createElement('input'); inT.readOnly = true; inT.value = f2(tr.totalGr);
      dvT.appendChild(lbT); dvT.appendChild(inT);

      var dvDisp = document.createElement('div');
      var lbD = document.createElement('label'); lbD.textContent = 'Grs disponibles en almacén origen';
      var inDisp = document.createElement('input'); inDisp.readOnly = true; inDisp.value = f2(calcDisponibles(tr.saleDe));
      dvDisp.appendChild(lbD); dvDisp.appendChild(inDisp);

      var dvDisp2 = document.createElement('div');
      var lbD2 = document.createElement('label'); lbD2.textContent = 'Grs disponibles en almacén destino';
      var inDisp2 = document.createElement('input'); inDisp2.readOnly = true; inDisp2.value = f2(calcDisponibles(tr.entraA));
      dvDisp2.appendChild(lbD2); dvDisp2.appendChild(inDisp2);

      grid1.appendChild(dvFolio);
      grid1.appendChild(dvFecha);
      grid1.appendChild(dvS);
      grid1.appendChild(dvE);
      grid1.appendChild(dvC);
      grid1.appendChild(dvT);
      grid1.appendChild(dvDisp);
      grid1.appendChild(dvDisp2);

      card.appendChild(grid1);

      // ===== Tabla ENTRADA =====
      card.appendChild(tablaLineasWidget({
        titulo: 'ENTRADA',
        bloqueado: false,
        lineas: tr.lineasEntrada,
        onChange: function(){
          tr.totalGr = sumaSubtotales(tr.lineasEntrada);
          inT.value = f2(tr.totalGr);
          saveDB(DB);
        }
      }));

      // ===== Acciones ENTRADA =====
      var acts = document.createElement('div');
      acts.className = 'actions';

      var btnGuardar = document.createElement('button');
      btnGuardar.className = 'btn-primary';
      btnGuardar.textContent = 'Guardar entrada';
      btnGuardar.addEventListener('click', function(){
        if(!confirm('¿Seguro que deseas guardar la ENTRADA?')) return;
        saveDB(DB);
        toast('Traspaso de entrada creado exitosamente; puedes consultarlo en "Traspasos pendientes".');

        // cerrar tab y limpiar hoja (volver al submenú)
        var view = qs('#view-trasp-' + tr.id);
        if(view) view.remove();
        var tabBtn = qs('[data-tab="trasp-' + tr.id + '"]');
        if(tabBtn) tabBtn.remove();
        renderSubmenu('inventarios');
      });
      acts.appendChild(btnGuardar);

      var btnVista = document.createElement('button');
      btnVista.className = 'btn';
      btnVista.textContent = 'Vista previa';
      btnVista.addEventListener('click', function(){ imprimirPDF(tr, true); });
      acts.appendChild(btnVista);

      card.appendChild(acts);

      // ===== SALIDA (visible desde inicio) =====
      var bar = document.createElement('div');
      bar.className = 'card';

      var h3 = document.createElement('h2');
      h3.textContent = modoProcesar ? 'SALIDA (editable)' : 'SALIDA (bloqueada hasta procesar)';
      bar.appendChild(h3);

      // Header SALIDA (siempre visible; selects EDITABLES solo en modoProcesar)
      var g2 = document.createElement('div');
      g2.className = 'grid';

      var dvFS = document.createElement('div');
      var lbFS = document.createElement('label'); lbFS.textContent = 'Fecha salida';
      var inFS = document.createElement('input'); inFS.type = 'date'; inFS.value = tr.salida.fecha;
      inFS.readOnly = !modoProcesar;
      inFS.addEventListener('change', function(){ tr.salida.fecha = inFS.value; saveDB(DB); });
      if(!modoProcesar){ inFS.classList.add('ro'); }
      dvFS.appendChild(lbFS); dvFS.appendChild(inFS);
      g2.appendChild(dvFS);

      var dvSS = document.createElement('div');
      var lbSS = document.createElement('label'); lbSS.textContent = 'Sale de (salida)';
      var selSS = document.createElement('select');
      ALMACENES.forEach(function(a){
        var opS = document.createElement('option');
        opS.value = a.id; opS.textContent = a.nombre;
        if(a.id === tr.salida.saleDe) opS.selected = true;
        selSS.appendChild(opS);
      });
      selSS.disabled = !modoProcesar;
      selSS.addEventListener('change', function(){ tr.salida.saleDe = selSS.value; saveDB(DB); });
      dvSS.appendChild(lbSS); dvSS.appendChild(selSS);
      g2.appendChild(dvSS);

      var dvSE = document.createElement('div');
      var lbSE = document.createElement('label'); lbSE.textContent = 'Entra a (salida)';
      var selSE = document.createElement('select');
      ALMACENES.forEach(function(a){
        var opE = document.createElement('option');
        opE.value = a.id; opE.textContent = a.nombre;
        if(a.id === tr.salida.entraA) opE.selected = true;
        selSE.appendChild(opE);
      });
      selSE.disabled = !modoProcesar;
      selSE.addEventListener('change', function(){ tr.salida.entraA = selSE.value; saveDB(DB); });
      dvSE.appendChild(lbSE); dvSE.appendChild(selSE);
      g2.appendChild(dvSE);

      var dvCS = document.createElement('div');
      var lbCS = document.createElement('label'); lbCS.textContent = 'Comentarios (salida)';
      var txCS = document.createElement('textarea'); txCS.value = tr.salida.comentarios;
      txCS.readOnly = !modoProcesar;
      if(!modoProcesar){ txCS.classList.add('ro'); }
      txCS.addEventListener('input', function(){ tr.salida.comentarios = txCS.value; saveDB(DB); });
      dvCS.appendChild(lbCS); dvCS.appendChild(txCS);
      g2.appendChild(dvCS);

      var dvTS = document.createElement('div');
      var lbTS = document.createElement('label'); lbTS.textContent = 'Total GR. (salida)';
      var inTS = document.createElement('input'); inTS.readOnly = true; inTS.value = f2(tr.salida.totalGr);
      dvTS.appendChild(lbTS); dvTS.appendChild(inTS);
      g2.appendChild(dvTS);

      bar.appendChild(g2);

      // Tabla SALIDA
      bar.appendChild(tablaLineasWidget({
        titulo: 'SALIDA',
        bloqueado: !modoProcesar,
        lineas: tr.salida.lineas,
        onChange: function(){
          tr.salida.totalGr = sumaSubtotales(tr.salida.lineas);
          inTS.value = f2(tr.salida.totalGr);
          saveDB(DB);
        }
      }));

      // Acciones de SALIDA (solo en modoProcesar)
      if(modoProcesar){
        var acts2 = document.createElement('div');
        acts2.className = 'actions';

        var inJust = document.createElement('input');
        inJust.type = 'text';
        inJust.placeholder = 'Justificación (si regresas menos gramos — opcional)';
        inJust.style.minWidth = '280px';
        acts2.appendChild(inJust);

        var btnCerrar = document.createElement('button');
        btnCerrar.className = 'btn-primary';
        btnCerrar.textContent = 'Guardar SALIDA / Cerrar folio';
        btnCerrar.addEventListener('click', function(){ cerrarFolio(tr, inJust.value || ''); });
        acts2.appendChild(btnCerrar);

        var btnPdf = document.createElement('button');
        btnPdf.className = 'btn';
        btnPdf.textContent = 'PDF';
        btnPdf.addEventListener('click', function(){ if(tr.cerrado){ imprimirPDF(tr, false); } else { toast('Cierra el folio para generar PDF final.'); } });
        acts2.appendChild(btnPdf);

        var btnWA = document.createElement('button');
        btnWA.className = 'btn';
        btnWA.title = 'Enviar PDF por WhatsApp';
        btnWA.innerHTML = '📱 WhatsApp';
        btnWA.addEventListener('click', function(){
          if(!tr.cerrado){ toast('Disponible después de cerrar el folio.'); return; }
          compartirWhatsApp(tr);
        });
        acts2.appendChild(btnWA);

        bar.appendChild(acts2);
      }

      card.appendChild(bar);

      // Evidencia global
      var divEv = document.createElement('div');
      divEv.className = 'actions';
      var cam = document.createElement('span'); cam.textContent = '📷';
      var lbl = document.createElement('span'); lbl.textContent = ' Cargar evidencia en foto';
      var inFile = document.createElement('input'); inFile.type = 'file'; inFile.accept = 'image/*';
      divEv.appendChild(cam); divEv.appendChild(lbl); divEv.appendChild(inFile);
      card.appendChild(divEv);

      host.appendChild(card);
    });
  }

  // ===== Widget de tabla de líneas =====
  function tablaLineasWidget(cfg){
    // cfg: { titulo, bloqueado, lineas, onChange }
    var wrap = document.createElement('div');
    var h = document.createElement('h2'); h.textContent = cfg.titulo; wrap.appendChild(h);

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    var cols = ['#','Material','Detalle','Gr','Aleación','Subtotal'];
    var i;
    for(i=0; i<cols.length; i++){
      var th = document.createElement('th'); th.textContent = cols[i]; trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    function renderRow(idx){
      var li = cfg.lineas[idx];
      var tr = document.createElement('tr');

      // #
      var td0 = document.createElement('td'); td0.textContent = (idx+1); tr.appendChild(td0);

      // Material
      var td2 = document.createElement('td');
      var sel = document.createElement('select');
      MATERIALES.forEach(function(m){
        var op = document.createElement('option');
        op.value = m.id; op.textContent = m.nombre;
        if(m.id === li.materialId) op.selected = true;
        sel.appendChild(op);
      });
      sel.disabled = !!cfg.bloqueado;
      sel.addEventListener('change', function(){
        li.materialId = sel.value;
        if(li.materialId !== '999'){ li.aleacion = 0; inAle.value = '0.00'; }
        inAle.readOnly = (li.materialId !== '999') || !!cfg.bloqueado;
        if(inAle.readOnly){ inAle.classList.add('ro'); } else { inAle.classList.remove('ro'); }
        recalc();
      });
      td2.appendChild(sel);
      tr.appendChild(td2);

      // Detalle
      var td3 = document.createElement('td');
      var inDet = document.createElement('input'); inDet.type = 'text'; inDet.value = li.detalle;
      inDet.readOnly = !!cfg.bloqueado;
      if(inDet.readOnly){ inDet.classList.add('ro'); }
      inDet.addEventListener('input', function(){ li.detalle = inDet.value; saveDB(DB); });
      td3.appendChild(inDet);
      tr.appendChild(td3);

      // Gr
      var tdGr = document.createElement('td');
      var inGr = document.createElement('input'); inGr.type = 'number'; inGr.step = '0.01'; inGr.min = '0'; inGr.value = li.gramos;
      inGr.readOnly = !!cfg.bloqueado; if(inGr.readOnly){ inGr.classList.add('ro'); }
      inGr.addEventListener('input', function(){
        li.gramos = parseFloat(inGr.value || '0');
        if(li.materialId === '999' && !inAle.readOnly){
          var sugerida = li.gramos * 0.07;
          inAle.value = f2(sugerida);
          li.aleacion = parseFloat(inAle.value || '0');
        }
        recalc();
      });
      tdGr.appendChild(inGr);
      tr.appendChild(tdGr);

      // Aleación
      var tdAle = document.createElement('td');
      var inAle = document.createElement('input'); inAle.type = 'number'; inAle.step = '0.01'; inAle.min = '0'; inAle.value = li.aleacion;
      inAle.readOnly = (li.materialId !== '999') || !!cfg.bloqueado;
      if(inAle.readOnly){ inAle.classList.add('ro'); }
      inAle.addEventListener('input', function(){ li.aleacion = parseFloat(inAle.value || '0'); recalc(); });
      tdAle.appendChild(inAle);
      tr.appendChild(tdAle);

      // Subtotal
      var tdSub = document.createElement('td');
      var inSub = document.createElement('input'); inSub.readOnly = true; inSub.value = f2(li.subtotal);
      tdSub.appendChild(inSub);
      tr.appendChild(tdSub);

      function recalc(){
        li.subtotal = (parseFloat(li.gramos || 0) + parseFloat(li.aleacion || 0));
        inSub.value = f2(li.subtotal);
        if(typeof cfg.onChange === 'function'){ cfg.onChange(); }
        saveDB(DB);
      }

      tbody.appendChild(tr);
    }

    var r;
    for(r=0; r<cfg.lineas.length; r++){ renderRow(r); }

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // ===== Helpers de negocio =====
  function sumaSubtotales(arr){
    var s = 0;
    var i;
    for(i=0; i<arr.length; i++){ s += parseFloat(arr[i].subtotal || 0); }
    return s;
  }
  function hoyStr(){
    var d = new Date();
    var m = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+m+'-'+dd;
  }
  function horaStr(){
    var d = new Date();
    var hh = String(d.getHours()).padStart(2,'0');
    var mm = String(d.getMinutes()).padStart(2,'0');
    return hh+':'+mm;
  }
  function f2(n){ return (parseFloat(n||0)).toFixed(2); }

  // Inventario lógico por almacén (solo folios cerrados)
  function calcDisponibles(almacenId){
    var sum = 0;
    DB.traspasos.forEach(function(t){
      if(t.cerrado){
        if(t.entraA === almacenId){ sum += (parseFloat(t.totalGr || 0)); }
        if(t.salida && t.salida.creada){
          if(t.salida.saleDe === almacenId){ sum -= (parseFloat(t.salida.totalGr || 0)); }
          if(t.salida.entraA === almacenId){ sum += (parseFloat(t.salida.totalGr || 0)); }
        }
      }
    });
    return sum;
  }

  // ===== Cierre de folio (valida merma y terminado) =====
  function cerrarFolio(tr, justificacion){
    if(tr.tipo === 'prod'){
      var hayTerminado = tr.salida.lineas.some(function(li){
        return li.materialId === 'terminado' && (parseFloat(li.gramos||0) > 0 || parseFloat(li.aleacion||0) > 0);
      });
      if(!hayTerminado){
        var ex = prompt('No registraste "Mercancía terminada". Explica por qué (obligatorio para continuar):', '');
        if(!ex){ toast('No se puede cerrar sin explicación.'); return; }
        justificacion = ex;
      }
    }

    var ent = parseFloat(tr.totalGr || 0);
    var sal = parseFloat(tr.salida.totalGr || 0);
    var mermaAbs = Math.max(0, ent - sal);
    var mermaPct = ent > 0 ? (mermaAbs / ent) : 0;

    var tol = 0.05; // base
    tr.lineasEntrada.forEach(function(li){
      var mat = MATERIALES.find(function(m){ return m.id === li.materialId; });
      if(mat && mat.tolMerma > tol){ tol = mat.tolMerma; }
    });

    if(mermaPct > tol){
      alert('Según la información cargada se registra una merma superior al ' + String((tol*100).toFixed(0)) + '%.\nNo es posible cerrar este folio. Revisa tu línea de producción.');
      return;
    }

    tr.cerrado = true;
    tr.cerradoComentario = justificacion || '';

    saveDB(DB);
    toast('Folio cerrado');
    imprimirPDF(tr, false);
  }

  // ===== PDF + WhatsApp =====
  // isDraft = true → agrega marca de agua "BORRADOR"
  function imprimirPDF(tr, isDraft){
    var w = window.open('', '_blank', 'width=840,height=900');
    if(!w){ alert('Bloqueador de ventanas activo. Permite pop-ups para imprimir.'); return; }

    var dif = parseFloat(tr.salida.totalGr || 0) - parseFloat(tr.totalGr || 0);
    var mermaTxt = (dif < 0) ? ('MERMA: ' + f2(dif)) : 'MERMA: 0.00';

    var headCss = ''
      + '@page{size:5.5in 8.5in;margin:10mm;}'
      + 'body{font-family:system-ui,Segoe UI,Roboto,Arial; font-size:12px; color:#0f172a;}'
      + 'h1,h2{margin:2px 0 6px 0;color:#0a2c4c;}'
      + 'table{width:100%;border-collapse:collapse;table-layout:fixed;}'
      + 'th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;word-break:break-word;}'
      + 'thead tr{background:#e7effa;}'
      + '.row{display:flex;gap:8px;margin:6px 0;} .col{flex:1;}'
      + '.muted{color:#64748b;} .ok{color:#065f46;} .bad{color:#b91c1c;font-weight:bold;}'
      + '.sign{display:flex;justify-content:space-between;margin-top:18px;} .sign div{width:45%;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;}'
      + '.water{position:fixed;top:40%;left:15%;font-size:48px;color:#94a3b880;transform:rotate(-20deg);}';

    var html = [];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Folio '+String(tr.folio).padStart(3,'0')+' — CONTROL-A</title><style>'+headCss+'</style></head><body>');
    if(isDraft){ html.push('<div class="water">BORRADOR</div>'); }

    // ENTRADA
    html.push('<h1>Traspaso '+String(tr.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.fecha+' '+tr.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios:</b> '+escapeHTML(tr.comentarios)+'</div><div class="col"><b>Total GR (entrada):</b> '+f2(tr.totalGr)+'</div></div>');
    html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th><th>Aleación</th><th>Subtotal</th></tr></thead><tbody>');
    var i;
    for(i=0;i<tr.lineasEntrada.length;i++){
      var li = tr.lineasEntrada[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>');
    }
    html.push('</tbody></table>');

    // SALIDA
    html.push('<h2>Salida</h2>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.salida.fecha+' '+tr.salida.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.salida.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.salida.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios salida:</b> '+escapeHTML(tr.salida.comentarios)+'</div><div class="col"><b>Total GR (salida):</b> '+f2(tr.salida.totalGr)+'</div></div>');

    var signo = dif >= 0 ? '+' : '';
    var difClass = dif < 0 ? 'bad' : 'ok';
    html.push('<div class="row"><div class="col '+(dif<0?'bad':'ok')+'"><b>'+mermaTxt+'</b></div><div class="col '+difClass+'"><b>DIF:</b> '+signo+f2(dif)+'</div></div>');

    html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th><th>Aleación</th><th>Subtotal</th></tr></thead><tbody>');
    for(i=0;i<tr.salida.lineas.length;i++){
      var lo = tr.salida.lineas[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(lo.materialId)+'</td><td>'+escapeHTML(lo.detalle)+'</td><td>'+f2(lo.gramos)+'</td><td>'+f2(lo.aleacion)+'</td><td>'+f2(lo.subtotal)+'</td></tr>');
    }
    html.push('</tbody></table>');

    html.push('<div class="sign"><div>Entregó</div><div>Recibió</div></div>');

    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    try{ w.focus(); w.print(); }catch(e){}
  }

  function compartirWhatsApp(tr){
    // En esta demo: abrir impresión y el usuario comparte manualmente el PDF
    imprimirPDF(tr, false);
    toast('Guarda el PDF y compártelo por WhatsApp.');
  }

  // ===== Helpers varios =====
  function nombreAlmacen(id){
    var a = ALMACENES.find(function(x){ return x.id === id; });
    return a ? a.nombre : id;
  }
  function nombreMaterial(id){
    var m = MATERIALES.find(function(x){ return x.id === id; });
    return m ? m.nombre : id;
  }
  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g,function(m){
      var map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
      return map[m];
    });
  }

  // ===== Submenú inicial =====
  renderSubmenu('inicio');

})();
