/* CONTROL-A · app.js v2.5.0
   Cambios clave solicitados:
   1) Formato de "ciclo único" en TRASPASOS:
      - Evidencia fotográfica y Estado Global (Entrada, Salida, Dif, Merma, Estado) al tope de la hoja.
      - Botonera GLOBAL (Vista previa, PDF final/WhatsApp si cerrado, Guardar ENTRADA o Guardar SALIDA/Cerrar según fase).
      - La merma/diferencia/estado son del ciclo completo (no solo “salida”).
      - Si aún NO hay salida: NO mostrar gramos ni % de merma/diferencia (se ven como "—", sin colores).
   2) Versión móvil:
      - Botón flotante (⬅️) para ocultar/mostrar el submenú y permitir scroll cómodo.
      - Estilos inyectados para móviles: scroll activado y layout más legible.
   3) PDF:
      - Evidencia fotográfica colocada arriba, como parte del ciclo.
      - Si no hay salida todavía, el PDF NO muestra merma/diferencia (sin %/gr) ni estado con color.
   Base previa (v2.4.2) conservada: folio rojo en PDF, tablas, firmas, CSV en pedidos, etc.
   Sin shorthand, sin comas colgantes, sin errores de comillas.
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

  // ===== Estilos inyectados (mejoras móvil + colapsado) =====
  (function injectStyles(){
    var css = ''
      + '@media(max-width:768px){'
      + '  body{overflow:auto;}'
      + '  .mobile-toolbar{position:fixed;z-index:9999;bottom:16px;left:16px;}'
      + '  .mobile-toolbar button{background:#0a2c4c;color:#fff;border:1px solid #0a2c4c;border-radius:28px;padding:10px 14px;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.2);}'
      + '  #subpanel.collapsed{display:none !important;}'
      + '  .card{padding:10px;}'
      + '  input, select, textarea{font-size:16px !important;height:40px;}'
      + '  textarea{height:80px;}'
      + '}'
      + '.estado-global{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}'
      + '.estado-chip{background:#f1f5f9;border-radius:16px;padding:6px 10px;font-size:12px;}'
      + '.estado-chip.bold{font-weight:700;}'
      + '.barra-global{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;}'
      + '.barra-global .btn-primary{background:#0a2c4c;color:#fff;border:1px solid #0a2c4c;}'
      + '.barra-global .btn{background:#fff;border:1px solid #94a3b8;}';
    var st = document.createElement('style');
    st.type = 'text/css';
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  })();

  // ===== Persistencia (localStorage) =====
  var STORAGE_KEY = 'CONTROL_A_DB';
  function loadDB(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        return { traspasos: [], folio: 0, evidencia: '', pedidos: [], folioPedidos: 0 };
      }
      var obj = JSON.parse(raw);
      if(!obj.traspasos){ obj.traspasos = []; }
      if(typeof obj.folio !== 'number'){ obj.folio = 0; }
      if(typeof obj.evidencia !== 'string'){ obj.evidencia = ''; }
      if(!obj.pedidos){ obj.pedidos = []; }
      if(typeof obj.folioPedidos !== 'number'){ obj.folioPedidos = 0; }
      return obj;
    }catch(e){
      return { traspasos: [], folio: 0, evidencia: '', pedidos: [], folioPedidos: 0 };
    }
  }
  function saveDB(db){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch(e){ console.error('saveDB error', e); }
  }
  var DB = loadDB();

  // ===== Catálogos/Constantes =====
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

  // ===== Helpers =====
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
  function addDays(isoDate, n){
    var p = isoDate.split('-');
    var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
    d.setDate(d.getDate()+n);
    var m = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+m+'-'+dd;
  }
  function f2(n){ return (parseFloat(n||0)).toFixed(2); }
  function nombreAlmacen(id){
    var a = ALMACENES.find(function(x){ return x.id===id; });
    return a ? a.nombre : id;
  }
  function nombreMaterial(id){
    var m = MATERIALES.find(function(x){ return x.id===id; });
    return m ? m.nombre : id;
  }
  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g,function(m){
      var map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
      return map[m];
    });
  }

  // ===== Navegación lateral =====
  qsa('.tree-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      qsa('.tree-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var root = btn.getAttribute('data-root');
      renderSubmenu(root);
    });
  });

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
    view.id = 'view-'+id;
    qsa('.view', viewsHost).forEach(function(v){ v.classList.remove('active'); });
    viewsHost.appendChild(view);

    renderFn(view);
  }

  // ===== Submenús =====
  function renderSubmenu(root){
    var host = qs('#subpanel');
    if(!host){ return; }
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

      var btnAbiertos = document.createElement('button');
      btnAbiertos.className = 'btn-outline';
      btnAbiertos.textContent = 'Traspasos pendientes';
      btnAbiertos.addEventListener('click', function(){ listarAbiertos(true); });
      acciones.appendChild(btnAbiertos);

      var btnCerrados = document.createElement('button');
      btnCerrados.className = 'btn-outline';
      btnCerrados.textContent = 'Folios cerrados';
      btnCerrados.addEventListener('click', function(){ listarCerrados(); });
      acciones.appendChild(btnCerrados);

      card.appendChild(acciones);
      host.appendChild(card);
      listarAbiertos(false);
      ensureMobileToolbar();
      return;
    }

    if(root === 'pedidos'){
      h2.textContent = 'Pedidos';
      card.appendChild(h2);

      var accionesP = document.createElement('div');
      accionesP.className = 'actions';
      var btnNuevoP = document.createElement('button');
      btnNuevoP.className = 'btn-primary';
      btnNuevoP.textContent = '+ Nuevo pedido';
      btnNuevoP.addEventListener('click', function(){ abrirPedidoNuevo(); });
      accionesP.appendChild(btnNuevoP);

      var btnPend = document.createElement('button');
      btnPend.className = 'btn-outline';
      btnPend.textContent = 'Pedidos pendientes';
      btnPend.addEventListener('click', function(){ listarPedidosPendientes(true); });
      accionesP.appendChild(btnPend);

      var btnTodos = document.createElement('button');
      btnTodos.className = 'btn-outline';
      btnTodos.textContent = 'Todos los pedidos';
      btnTodos.addEventListener('click', function(){ listarPedidosTodos(); });
      accionesP.appendChild(btnTodos);

      card.appendChild(accionesP);
      host.appendChild(card);
      listarPedidosPendientes(false);
      ensureMobileToolbar();
      return;
    }

    h2.textContent = 'Submenú';
    card.appendChild(h2);
    host.appendChild(card);
    ensureMobileToolbar();
  }

  // ===== Móvil: toolbar para colapsar submenú y permitir scroll =====
  function ensureMobileToolbar(){
    var existing = qs('.mobile-toolbar');
    if(existing){ return; }
    var toolbar = document.createElement('div');
    toolbar.className = 'mobile-toolbar';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '⬅️ Menú';
    btn.title = 'Ocultar/mostrar menú';
    btn.addEventListener('click', function(){
      var sp = qs('#subpanel');
      if(!sp){ return; }
      if(sp.classList.contains('collapsed')){
        sp.classList.remove('collapsed');
        btn.textContent = '⬅️ Menú';
      }else{
        sp.classList.add('collapsed');
        btn.textContent = '➡️ Menú';
      }
    });
    toolbar.appendChild(btn);
    document.body.appendChild(toolbar);
  }

  // =====================================================================
  // =========================  MÓDULO: TRASPASOS  =======================
  // =====================================================================

  function listarAbiertos(mostrarTituloExtra){
    var host = qs('#subpanel');
    var card = document.createElement('div'); card.className = 'card';
    if(mostrarTituloExtra){ var h = document.createElement('h2'); h.textContent = 'Traspasos pendientes'; card.appendChild(h); }

    var lst = DB.traspasos.filter(function(t){ return !t.cerrado; });
    if(lst.length === 0){
      var p = document.createElement('p'); p.textContent = 'Sin folios abiertos.'; card.appendChild(p);
    } else {
      lst.forEach(function(t){
        var fol = String(t.folio).padStart(3, '0');
        var row = document.createElement('div'); row.className = 'actions';
        var pill = document.createElement('span'); pill.className = 'pill orange'; pill.textContent = 'Folio ' + fol; row.appendChild(pill);
        var btn = document.createElement('button'); btn.className = 'btn-orange'; btn.textContent = 'Procesar este traspaso';
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

  function listarCerrados(){
    var host = qs('#subpanel');
    var card = document.createElement('div'); card.className = 'card';
    var h = document.createElement('h2'); h.textContent = 'Folios cerrados'; card.appendChild(h);

    var lst = DB.traspasos.filter(function(t){ return !!t.cerrado; }).sort(function(a,b){ return b.folio - a.folio; });
    if(lst.length===0){
      var p = document.createElement('p'); p.textContent = 'Aún no hay folios cerrados.'; card.appendChild(p);
    }else{
      lst.forEach(function(t){
        var row = document.createElement('div'); row.className='actions';
        var pill = document.createElement('span'); pill.className='pill'; pill.textContent='Folio '+String(t.folio).padStart(3,'0'); row.appendChild(pill);
        var btn = document.createElement('button'); btn.className='btn'; btn.textContent='Abrir PDF'; btn.addEventListener('click', function(){ imprimirPDF(t, false); }); row.appendChild(btn);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  function nuevoTraspasoBase(){
    DB.folio += 1;
    var id = 'T' + Date.now();
    var folioNum = DB.folio;

    var lineas = [];
    var i;
    for(i=0; i<3; i++){
      lineas.push({ materialId:'925', detalle:'', gramos:0, aleacion:0, subtotal:0 });
    }
    var salidaLineas = lineas.map(function(li){
      return { materialId: li.materialId, detalle: li.detalle, gramos:0, aleacion:0, subtotal:0 };
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
      salida: { creada: true, fecha: hoyStr(), hora: horaStr(), saleDe: 'prod', entraA: 'caja', comentarios: '', lineas: salidaLineas, totalGr: 0 },
      cerrado: false
    };
    if(obj.saleDe === 'caja' && obj.entraA === 'prod'){ obj.tipo = 'prod'; }

    DB.traspasos.push(obj);
    saveDB(DB);
    return obj.id;
  }
  function abrirTraspasoNuevo(){ var id = nuevoTraspasoBase(); abrirTraspasoExistente(id, false); }

  function abrirTraspasoExistente(id, modoProcesar){
    var tr = DB.traspasos.find(function(x){ return x.id === id; });
    if(!tr){ toast('No encontrado'); return; }
    if(!tr.salida || !tr.salida.lineas){
      tr.salida = { creada:true, fecha:hoyStr(), hora:horaStr(), saleDe:'prod', entraA:'caja', comentarios:'', lineas:[], totalGr:0 };
      saveDB(DB);
    }
    if(tr.salida.lineas.length===0){
      var i; for(i=0;i<3;i++){ tr.salida.lineas.push({ materialId:'925', detalle:'', gramos:0, aleacion:0, subtotal:0 }); }
      saveDB(DB);
    }

    var titulo = 'Traspaso ' + String(tr.folio).padStart(3,'0');
    openTab('trasp-'+id, titulo, function(host){
      host.innerHTML = '';
      var card = document.createElement('div'); card.className = 'card';

      // ===== Encabezado GLOBAL del ciclo =====
      var head = document.createElement('div'); head.className = 'grid';

      var dvFolio = document.createElement('div'); var lbFo = document.createElement('label'); lbFo.textContent='Folio';
      var inFol = document.createElement('input'); inFol.readOnly=true; inFol.value=String(tr.folio).padStart(3,'0'); inFol.style.color='#b91c1c'; dvFolio.appendChild(lbFo); dvFolio.appendChild(inFol);

      var dvFecha = document.createElement('div'); var lbF = document.createElement('label'); lbF.textContent='Fecha';
      var inF = document.createElement('input'); inF.type='date'; inF.value=tr.fecha; inF.readOnly=!!modoProcesar; if(modoProcesar){ inF.classList.add('ro'); }
      inF.addEventListener('change', function(){ tr.fecha=inF.value; saveDB(DB); }); dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

      var dvS = document.createElement('div'); var lbS = document.createElement('label'); lbS.textContent='Sale de';
      var selS = document.createElement('select'); ALMACENES.forEach(function(a){ var op=document.createElement('option'); op.value=a.id; op.textContent=a.nombre; if(a.id===tr.saleDe) op.selected=true; selS.appendChild(op); });
      selS.disabled=!!modoProcesar; selS.addEventListener('change', function(){ tr.saleDe=selS.value; tr.tipo=(tr.saleDe==='caja' && tr.entraA==='prod')?'prod':'normal'; saveDB(DB); inDisp.value=f2(calcDisponibles(tr.saleDe)); });
      dvS.appendChild(lbS); dvS.appendChild(selS);

      var dvE = document.createElement('div'); var lbE = document.createElement('label'); lbE.textContent='Entra a';
      var selE = document.createElement('select'); ALMACENES.forEach(function(a){ var op2=document.createElement('option'); op2.value=a.id; op2.textContent=a.nombre; if(a.id===tr.entraA) op2.selected=true; selE.appendChild(op2); });
      selE.disabled=!!modoProcesar; selE.addEventListener('change', function(){ tr.entraA=selE.value; tr.tipo=(tr.saleDe==='caja' && tr.entraA==='prod')?'prod':'normal'; saveDB(DB); inDisp2.value=f2(calcDisponibles(tr.entraA)); });
      dvE.appendChild(lbE); dvE.appendChild(selE);

      var dvC = document.createElement('div'); var lbC=document.createElement('label'); lbC.textContent='Comentarios generales';
      var txC=document.createElement('textarea'); txC.value=tr.comentarios; txC.readOnly=!!modoProcesar; if(modoProcesar){ txC.classList.add('ro'); }
      txC.addEventListener('input', function(){ tr.comentarios=txC.value; saveDB(DB); }); dvC.appendChild(lbC); dvC.appendChild(txC);

      var dvDisp=document.createElement('div'); var lbD=document.createElement('label'); lbD.textContent='Grs disponibles en almacén origen';
      var inDisp=document.createElement('input'); inDisp.readOnly=true; inDisp.value=f2(calcDisponibles(tr.saleDe)); dvDisp.appendChild(lbD); dvDisp.appendChild(inDisp);

      var dvDisp2=document.createElement('div'); var lbD2=document.createElement('label'); lbD2.textContent='Grs disponibles en almacén destino';
      var inDisp2=document.createElement('input'); inDisp2.readOnly=true; inDisp2.value=f2(calcDisponibles(tr.entraA)); dvDisp2.appendChild(lbD2); dvDisp2.appendChild(inDisp2);

      head.appendChild(dvFolio); head.appendChild(dvFecha); head.appendChild(dvS); head.appendChild(dvE);
      head.appendChild(dvC); head.appendChild(dvDisp); head.appendChild(dvDisp2);
      card.appendChild(head);

      // ===== Evidencia GLOBAL (arriba, para todo el ciclo) =====
      var divEv=document.createElement('div'); divEv.className='actions';
      var cam=document.createElement('span'); cam.textContent='📷'; var lbl=document.createElement('span'); lbl.textContent=' Cargar evidencia fotográfica (aplica a TODA la hoja)';
      var inFile=document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
      inFile.addEventListener('change', function(){ if(inFile.files && inFile.files[0]){ cargarEvidencia(inFile.files[0]); } });
      divEv.appendChild(cam); divEv.appendChild(lbl); divEv.appendChild(inFile);
      card.appendChild(divEv);

      // ===== Estado GLOBAL (chips) =====
      var estadoWrap = document.createElement('div'); estadoWrap.className = 'estado-global';
      card.appendChild(estadoWrap);
      actualizarEstadoGlobal(estadoWrap, tr);

      // ===== Botonera GLOBAL (aplica a toda la hoja) =====
      var barraGlobal = document.createElement('div'); barraGlobal.className = 'barra-global';
      // Vista previa siempre disponible
      var bVista = document.createElement('button'); bVista.className='btn'; bVista.textContent='Vista previa';
      bVista.addEventListener('click', function(){ imprimirPDF(tr, true); });
      barraGlobal.appendChild(bVista);

      // Guardar ENTRADA si aún no procesas salida
      if(!modoProcesar){
        var bGuardarEntrada = document.createElement('button'); bGuardarEntrada.className='btn-primary'; bGuardarEntrada.textContent='Guardar ENTRADA';
        bGuardarEntrada.addEventListener('click', function(){
          if(!confirm('¿Seguro que deseas guardar la ENTRADA?')) return;
          saveDB(DB);
          toast('Traspaso de entrada creado exitosamente; puedes consultarlo en "Traspasos pendientes".');
          var view = qs('#view-trasp-'+tr.id); if(view) view.remove();
          var tabBtn = qs('[data-tab="trasp-'+tr.id+'"]'); if(tabBtn) tabBtn.remove();
          renderSubmenu('inventarios');
        });
        barraGlobal.appendChild(bGuardarEntrada);
      }

      // PDF final y WhatsApp si ya está cerrado
      if(tr.cerrado){
        var bPdf = document.createElement('button'); bPdf.className='btn'; bPdf.textContent='PDF final';
        bPdf.addEventListener('click', function(){ imprimirPDF(tr, false); });
        barraGlobal.appendChild(bPdf);

        var bWA = document.createElement('button'); bWA.className='btn'; bWA.title='Enviar PDF por WhatsApp'; bWA.innerHTML='📱 WhatsApp';
        bWA.addEventListener('click', function(){ compartirWhatsApp(tr); });
        barraGlobal.appendChild(bWA);
      }

      // Guardar SALIDA / Cerrar folio cuando estás en modo procesar
      if(modoProcesar && !tr.cerrado){
        var inJust=document.createElement('input'); inJust.type='text'; inJust.placeholder='Justificación (si regresas menos gramos — opcional)'; inJust.style.minWidth='280px';
        barraGlobal.appendChild(inJust);
        var bCerrar=document.createElement('button'); bCerrar.className='btn-primary'; bCerrar.textContent='Guardar SALIDA / Cerrar folio';
        bCerrar.addEventListener('click', function(){ cerrarFolio(tr, inJust.value || ''); });
        barraGlobal.appendChild(bCerrar);
      }

      card.appendChild(barraGlobal);

      // ===== Bloque ENTRADA =====
      var gridEntrada = document.createElement('div'); gridEntrada.className = 'grid';

      var dvT = document.createElement('div'); var lbT=document.createElement('label'); lbT.textContent='Total GR. (entrada)';
      var inT=document.createElement('input'); inT.readOnly=true; inT.value=f2(tr.totalGr); dvT.appendChild(lbT); dvT.appendChild(inT);

      gridEntrada.appendChild(dvT);
      card.appendChild(gridEntrada);

      card.appendChild(tablaLineasWidget({
        titulo: 'ENTRADA',
        bloqueado: !!modoProcesar,
        lineas: tr.lineasEntrada,
        onChange: function(){
          tr.totalGr = sumaSubtotales(tr.lineasEntrada);
          inT.value = f2(tr.totalGr);
          saveDB(DB);
          actualizarEstadoGlobal(estadoWrap, tr);
        }
      }));

      // ===== Bloque SALIDA =====
      var bar=document.createElement('div'); bar.className='card';
      var h3=document.createElement('h2'); h3.textContent = modoProcesar ? 'SALIDA (editable)' : 'SALIDA (bloqueada hasta procesar)'; bar.appendChild(h3);

      var g2=document.createElement('div'); g2.className='grid';
      var dvFS=document.createElement('div'); var lbFS=document.createElement('label'); lbFS.textContent='Fecha salida';
      var inFS=document.createElement('input'); inFS.type='date'; inFS.value=tr.salida.fecha; inFS.readOnly=!modoProcesar; if(!modoProcesar){ inFS.classList.add('ro'); }
      inFS.addEventListener('change', function(){ tr.salida.fecha=inFS.value; saveDB(DB); }); dvFS.appendChild(lbFS); dvFS.appendChild(inFS); g2.appendChild(dvFS);

      var dvSS=document.createElement('div'); var lbSS=document.createElement('label'); lbSS.textContent='Sale de (salida)';
      var selSS=document.createElement('select'); ALMACENES.forEach(function(a){ var opS=document.createElement('option'); opS.value=a.id; opS.textContent=a.nombre; if(a.id===tr.salida.saleDe) opS.selected=true; selSS.appendChild(opS); });
      selSS.disabled=!modoProcesar; selSS.addEventListener('change', function(){ tr.salida.saleDe=selSS.value; saveDB(DB); }); dvSS.appendChild(lbSS); dvSS.appendChild(selSS); g2.appendChild(dvSS);

      var dvSE=document.createElement('div'); var lbSE=document.createElement('label'); lbSE.textContent='Entra a (salida)';
      var selSE=document.createElement('select'); ALMACENES.forEach(function(a){ var opE=document.createElement('option'); opE.value=a.id; opE.textContent=a.nombre; if(a.id===tr.salida.entraA) opE.selected=true; selSE.appendChild(opE); });
      selSE.disabled=!modoProcesar; selSE.addEventListener('change', function(){ tr.salida.entraA=selSE.value; saveDB(DB); }); dvSE.appendChild(lbSE); dvSE.appendChild(selSE); g2.appendChild(dvSE);

      var dvCS=document.createElement('div'); var lbCS=document.createElement('label'); lbCS.textContent='Comentarios (salida)';
      var txCS=document.createElement('textarea'); txCS.value=tr.salida.comentarios; txCS.readOnly=!modoProcesar; if(!modoProcesar){ txCS.classList.add('ro'); }
      txCS.addEventListener('input', function(){ tr.salida.comentarios=txCS.value; saveDB(DB); }); dvCS.appendChild(lbCS); dvCS.appendChild(txCS); g2.appendChild(dvCS);

      var dvTS=document.createElement('div'); var lbTS=document.createElement('label'); lbTS.textContent='Total GR. (salida)';
      var inTS=document.createElement('input'); inTS.readOnly=true; inTS.value=f2(tr.salida.totalGr); dvTS.appendChild(lbTS); dvTS.appendChild(inTS); g2.appendChild(dvTS);
      bar.appendChild(g2);

      bar.appendChild(tablaLineasWidget({
        titulo: 'SALIDA',
        bloqueado: !modoProcesar,
        lineas: tr.salida.lineas,
        onChange: function(){
          tr.salida.totalGr = sumaSubtotales(tr.salida.lineas);
          inTS.value = f2(tr.salida.totalGr);
          saveDB(DB);
          actualizarEstadoGlobal(estadoWrap, tr);
        }
      }));

      card.appendChild(bar);
      host.appendChild(card);
    });
  }

  // ===== Estado Global (Entrada/Salida/Dif/Merma/Estado con reglas) =====
  function actualizarEstadoGlobal(wrap, tr){
    var ent = parseFloat(tr.totalGr || 0);
    var sal = parseFloat(tr.salida && tr.salida.totalGr ? tr.salida.totalGr : 0);
    var tieneSalida = sal > 0;
    var dif = tieneSalida ? (sal - ent) : 0;
    var mermaAbs = tieneSalida ? Math.max(0, ent - sal) : 0;
    var mermaPct = tieneSalida && ent > 0 ? (mermaAbs/ent)*100 : 0;

    var estado = 'Pendiente de salida';
    var color = '#334155'; // neutro
    if(tieneSalida){
      estado = 'OK';
      color = '#065f46';
      if(mermaPct > 2.5 && mermaPct < 4.5){
        estado = 'Atento';
        color = '#b45309';
      }
      if(mermaPct >= 4.5){
        estado = 'Excede';
        color = '#b91c1c';
      }
    }

    wrap.innerHTML = '';
    var chips = [];
    chips.push({ t: 'Entrada: '+f2(ent)+' g', bold:false, c:'' });
    chips.push({ t: 'Salida: '+(tieneSalida?f2(sal)+' g':'—'), bold:false, c:'' });
    chips.push({ t: 'Dif: '+(tieneSalida?(dif>=0?'+':'')+f2(dif)+' g':'—'), bold:false, c:'' });
    chips.push({ t: 'Merma: '+(tieneSalida?(f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)'):'—'), bold:false, c:'' });
    chips.push({ t: 'Estado: '+estado, bold:true, c:color });

    var i;
    for(i=0;i<chips.length;i++){
      var chip = document.createElement('span');
      chip.className = 'estado-chip' + (chips[i].bold ? ' bold' : '');
      chip.textContent = chips[i].t;
      if(chips[i].bold && chips[i].c){ chip.style.color = chips[i].c; }
      wrap.appendChild(chip);
    }
  }

  // ===== Tabla de líneas (Traspasos) =====
  function tablaLineasWidget(cfg){
    // cfg: { titulo, bloqueado, lineas, onChange? }
    var wrap = document.createElement('div');

    var topBar = document.createElement('div'); topBar.className='actions';
    var h = document.createElement('h2'); h.textContent = cfg.titulo; topBar.appendChild(h);
    var spacer = document.createElement('div'); spacer.style.flex='1'; topBar.appendChild(spacer);
    var bAdd, bDel;
    if(!cfg.bloqueado){
      bAdd = document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea';
      bDel = document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
      topBar.appendChild(bAdd); topBar.appendChild(bDel);
    }
    wrap.appendChild(topBar);

    var table=document.createElement('table');
    var thead=document.createElement('thead');
    var trh=document.createElement('tr');

    var headers = [
      {t:'#', w:'6%'},
      {t:'Material', w:'22%'},
      {t:'Detalle', w:'28%'},
      {t:'Gr', w:'12%'},
      {t:'Aleación', w:'14%'},
      {t:'Subtotal', w:'18%'}
    ];
    var i;
    for(i=0;i<headers.length;i++){
      var th=document.createElement('th'); th.textContent=headers[i].t; th.style.width=headers[i].w; trh.appendChild(th);
    }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody=document.createElement('tbody');

    function rebuild(){
      tbody.innerHTML = '';
      var r;
      for(r=0; r<cfg.lineas.length; r++){ renderRow(r); }
    }

    function renderRow(idx){
      var li = cfg.lineas[idx];
      var tr = document.createElement('tr');

      var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);

      var td2=document.createElement('td');
      var sel=document.createElement('select'); sel.style.width='100%';
      MATERIALES.forEach(function(m){
        var op=document.createElement('option'); op.value=m.id; op.textContent=m.nombre; if(m.id===li.materialId) op.selected=true; sel.appendChild(op);
      });
      sel.disabled=!!cfg.bloqueado;
      sel.addEventListener('change', function(){
        li.materialId=sel.value;
        if(li.materialId!=='999'){ li.aleacion=0; inAle.value='0.00'; }
        inAle.readOnly=(li.materialId!=='999') || !!cfg.bloqueado;
        if(inAle.readOnly){ inAle.classList.add('ro'); } else { inAle.classList.remove('ro'); }
        recalc();
      });
      td2.appendChild(sel); tr.appendChild(td2);

      var td3=document.createElement('td');
      var inDet=document.createElement('input'); inDet.type='text'; inDet.value=li.detalle; inDet.style.width='100%';
      inDet.style.fontSize='16px'; inDet.style.height='40px';
      inDet.readOnly=!!cfg.bloqueado; if(inDet.readOnly){ inDet.classList.add('ro'); }
      inDet.addEventListener('input', function(){ li.detalle=inDet.value; saveDB(DB); });
      td3.appendChild(inDet); tr.appendChild(td3);

      var tdGr=document.createElement('td');
      var inGr=document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.min='0'; inGr.value=li.gramos; inGr.style.width='100%';
      inGr.placeholder='0.00'; inGr.inputMode='decimal';
      inGr.style.fontSize='16px'; inGr.style.height='40px'; inGr.style.textAlign='right';
      inGr.readOnly=!!cfg.bloqueado; if(inGr.readOnly){ inGr.classList.add('ro'); }
      inGr.addEventListener('input', function(){
        li.gramos=parseFloat(inGr.value||'0');
        if(li.materialId==='999' && !inAle.readOnly){
          var sugerida=li.gramos*0.07; inAle.value=f2(sugerida); li.aleacion=parseFloat(inAle.value||'0');
        }
        recalc();
      });
      tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdAle=document.createElement('td');
      var inAle=document.createElement('input'); inAle.type='number'; inAle.step='0.01'; inAle.min='0'; inAle.value=li.aleacion; inAle.style.width='100%';
      inAle.placeholder='0.00'; inAle.inputMode='decimal';
      inAle.style.fontSize='16px'; inAle.style.height='40px'; inAle.style.textAlign='right';
      inAle.readOnly=(li.materialId!=='999') || !!cfg.bloqueado; if(inAle.readOnly){ inAle.classList.add('ro'); }
      inAle.addEventListener('input', function(){ li.aleacion=parseFloat(inAle.value||'0'); recalc(); });
      tdAle.appendChild(inAle); tr.appendChild(tdAle);

      var tdSub=document.createElement('td');
      var inSub=document.createElement('input'); inSub.readOnly=true; inSub.value=f2(li.subtotal); inSub.style.width='100%';
      inSub.style.fontSize='16px'; inSub.style.height='40px'; inSub.style.textAlign='right';
      tdSub.appendChild(inSub); tr.appendChild(tdSub);

      function recalc(){
        li.subtotal = (parseFloat(li.gramos||0) + parseFloat(li.aleacion||0));
        inSub.value = f2(li.subtotal);
        if(typeof cfg.onChange === 'function'){ cfg.onChange(); }
        saveDB(DB);
      }

      tbody.appendChild(tr);
    }

    // render inicial
    rebuild();

    // botones internos
    if(bAdd){
      bAdd.addEventListener('click', function(){
        cfg.lineas.push({ materialId:'925', detalle:'', gramos:0, aleacion:0, subtotal:0 });
        rebuild();
        if(typeof cfg.onChange === 'function'){ cfg.onChange(); }
      });
    }
    if(bDel){
      bDel.addEventListener('click', function(){
        if(cfg.lineas.length>1){ cfg.lineas.pop(); }
        rebuild();
        if(typeof cfg.onChange === 'function'){ cfg.onChange(); }
      });
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // ===== Helpers de negocio =====
  function sumaSubtotales(arr){
    var s=0; var i;
    for(i=0;i<arr.length;i++){ s += parseFloat(arr[i].subtotal||0); }
    return s;
  }
  function calcDisponibles(almacenId){
    var sum=0;
    DB.traspasos.forEach(function(t){
      if(t.cerrado){
        if(t.entraA===almacenId){ sum += parseFloat(t.totalGr||0); }
        if(t.salida && t.salida.creada){
          if(t.salida.saleDe===almacenId){ sum -= parseFloat(t.salida.totalGr||0); }
          if(t.salida.entraA===almacenId){ sum += parseFloat(t.salida.totalGr||0); }
        }
      }
    });
    return sum;
  }

  function cerrarFolio(tr, justificacion){
    if(tr.tipo==='prod'){
      var hayTerminado = tr.salida.lineas.some(function(li){
        return li.materialId==='terminado' && (parseFloat(li.gramos||0)>0 || parseFloat(li.aleacion||0)>0);
      });
      if(!hayTerminado){
        var ex = prompt('No registraste "Mercancía terminada". Explica por qué (obligatorio para continuar):','');
        if(!ex){ toast('No se puede cerrar sin explicación.'); return; }
        justificacion = ex;
      }
    }

    var ent=parseFloat(tr.totalGr||0);
    var sal=parseFloat(tr.salida.totalGr||0);
    var mermaAbs=Math.max(0, ent - sal);
    var mermaPct = ent>0 ? (mermaAbs/ent) : 0;

    var tol=0.05;
    tr.lineasEntrada.forEach(function(li){
      var mat=MATERIALES.find(function(m){ return m.id===li.materialId; });
      if(mat && mat.tolMerma>tol){ tol=mat.tolMerma; }
    });

    if(sal<=0){
      alert('No puedes cerrar el folio sin capturar SALIDA.');
      return;
    }

    if(mermaPct>tol){
      alert('Según la información cargada se registra una merma superior al '+String((tol*100).toFixed(0))+'%.\nNo es posible cerrar este folio. Revisa tu línea de producción.');
      return;
    }

    tr.cerrado=true;
    tr.cerradoComentario=justificacion||'';
    saveDB(DB);
    toast('Folio cerrado');
    imprimirPDF(tr, false);
  }

  function imprimirPDF(tr, isDraft){
    var w = window.open('', '_blank', 'width=840,height=900');
    if(!w){ alert('Permite pop-ups para imprimir.'); return; }

    var ent = parseFloat(tr.totalGr||0);
    var sal = parseFloat(tr.salida && tr.salida.totalGr ? tr.salida.totalGr : 0);
    var tieneSalida = sal > 0;
    var dif = tieneSalida ? (sal - ent) : 0;
    var mermaAbs = tieneSalida ? Math.max(0, ent - sal) : 0;
    var mermaPct = tieneSalida && ent>0 ? (mermaAbs/ent)*100 : 0;

    var estado = 'Pendiente de salida';
    if(tieneSalida){
      estado = 'OK';
      if(mermaPct > 2.5 && mermaPct < 4.5){ estado = 'Atento'; }
      if(mermaPct >= 4.5){ estado = 'Excede'; }
    }

    var headCss='@page{size:5.5in 8.5in;margin:10mm;}'
      + 'body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}'
      + 'h1.red{color:#b91c1c;} h2{margin:2px 0 6px 0;color:#0a2c4c;}'
      + 'table{width:100%;border-collapse:collapse;table-layout:fixed;}'
      + 'th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;word-break:break-word;}'
      + 'thead tr{background:#e7effa;}'
      + '.row{display:flex;gap:8px;margin:6px 0;}.col{flex:1;}'
      + '.signs{display:flex;justify-content:space-between;margin-top:18px;} .signs div{width:45%;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;}'
      + '.water{position:fixed;top:40%;left:15%;font-size:48px;color:#94a3b880;transform:rotate(-20deg);}'
      + '.chips{margin:8px 0;} .chip{background:#f1f5f9;border-radius:16px;padding:6px 10px;margin-right:6px;font-size:12px;font-weight:600;}';

    var html=[];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Folio '+String(tr.folio).padStart(3,'0')+'</title><style>'+headCss+'</style></head><body>');
    if(isDraft){ html.push('<div class="water">BORRADOR</div>'); }

    html.push('<h1 class="red">Traspaso '+String(tr.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.fecha+' '+tr.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios:</b> '+escapeHTML(tr.comentarios)+'</div><div class="col"><b>Total GR (entrada):</b> '+f2(ent)+'</div></div>');

    // Evidencia global arriba, para reforzar ciclo único
    if(DB.evidencia){ html.push('<h3>Evidencia fotográfica</h3><img src="'+DB.evidencia+'" style="max-width:100%;max-height:300px;border:1px solid #ccc">'); }

    // Chips de estado global
    html.push('<div class="chips">');
    html.push('<span class="chip">Entrada: '+f2(ent)+' g</span>');
    html.push('<span class="chip">Salida: '+(tieneSalida?f2(sal)+' g':'—')+'</span>');
    html.push('<span class="chip">Dif: '+(tieneSalida?(dif>=0?'+':'')+f2(dif)+' g':'—')+'</span>');
    html.push('<span class="chip">Merma: '+(tieneSalida?(f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)'):'—')+'</span>');
    html.push('<span class="chip">Estado: '+estado+'</span>');
    html.push('</div>');

    // ENTRADA
    html.push('<h2>Entrada</h2>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:22%">Material</th><th style="width:28%">Detalle</th><th style="width:12%">Gr</th><th style="width:14%">Aleación</th><th style="width:18%">Subtotal</th></tr></thead><tbody>');
    var i;
    for(i=0;i<tr.lineasEntrada.length;i++){
      var li=tr.lineasEntrada[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>');
    }
    html.push('</tbody></table>');
    html.push('<div class="signs"><div>Entregó (entrada)</div><div>Recibió (entrada)</div></div>');

    // SALIDA
    html.push('<h2>Salida</h2>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.salida.fecha+' '+(tr.salida.hora||'')+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.salida.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.salida.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios salida:</b> '+escapeHTML(tr.salida.comentarios||'')+'</div><div class="col"><b>Total GR (salida):</b> '+f2(sal)+'</div></div>');

    // Solo mostrar dif/merma si hay salida capturada
    if(tieneSalida){
      var signo = dif>=0 ? '+' : '';
      html.push('<div class="row"><div class="col"><b>MERMA:</b> '+f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)</div><div class="col"><b>DIF:</b> '+signo+f2(dif)+'</div></div>');
    }

    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:22%">Material</th><th style="width:28%">Detalle</th><th style="width:12%">Gr</th><th style="width:14%">Aleación</th><th style="width:18%">Subtotal</th></tr></thead><tbody>');
    for(i=0;i<tr.salida.lineas.length;i++){
      var lo=tr.salida.lineas[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(lo.materialId)+'</td><td>'+escapeHTML(lo.detalle)+'</td><td>'+f2(lo.gramos)+'</td><td>'+f2(lo.aleacion)+'</td><td>'+f2(lo.subtotal)+'</td></tr>');
    }
    html.push('</tbody></table>');
    html.push('<div class="signs"><div>Entregó (salida)</div><div>Recibió (salida)</div></div>');

    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    try{ w.focus(); w.print(); }catch(e){}
  }
  function compartirWhatsApp(tr){ imprimirPDF(tr,false); toast('Guarda el PDF y compártelo por WhatsApp.'); }
  function cargarEvidencia(file){ var r=new FileReader(); r.onload=function(e){ DB.evidencia=e.target.result; saveDB(DB); toast('Foto cargada.'); }; r.readAsDataURL(file); }

  // =====================================================================
  // ===========================  MÓDULO: PEDIDOS  =======================
  // =====================================================================

  function listarPedidosPendientes(mostrarTitulo){
    var host = qs('#subpanel');
    var card = document.createElement('div'); card.className='card';
    if(mostrarTitulo){ var h=document.createElement('h2'); h.textContent='Pedidos pendientes'; card.appendChild(h); }

    var cont = document.createElement('div'); cont.className='card';
    var lst = DB.pedidos.filter(function(p){ return p.estatus!=='finalizado'; }).sort(function(a,b){ return b.folio - a.folio; });

    if(lst.length===0){
      var p=document.createElement('p'); p.textContent='Sin pedidos pendientes.'; cont.appendChild(p);
    }else{
      lst.forEach(function(ped){
        var row=document.createElement('div'); row.className='actions';
        var pill=document.createElement('span'); pill.className='pill';
        if(ped.estatus==='pendiente'){ pill.className+=' orange'; }
        else if(ped.estatus==='proceso'){ pill.style.background='#dbeafe'; pill.style.color='#1d4ed8'; }
        else if(ped.estatus==='finalizado'){ pill.style.background='#dcfce7'; pill.style.color='#166534'; }
        pill.textContent='Pedido '+String(ped.folio).padStart(3,'0')+' · '+ped.estatus;
        row.appendChild(pill);

        var btnAbrir=document.createElement('button'); btnAbrir.className='btn'; btnAbrir.textContent='Abrir';
        btnAbrir.addEventListener('click', function(){ abrirPedidoExistente(ped.id); });
        row.appendChild(btnAbrir);

        cont.appendChild(row);
      });
    }
    host.appendChild(card);
    host.appendChild(cont);
  }

  function listarPedidosTodos(){
    var host=qs('#subpanel');
    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent='Todos los pedidos'; card.appendChild(h);

    var lst=DB.pedidos.slice().sort(function(a,b){ return b.folio - a.folio; });
    if(lst.length===0){
      var p=document.createElement('p'); p.textContent='Aún no hay pedidos.'; card.appendChild(p);
    }else{
      lst.forEach(function(ped){
        var row=document.createElement('div'); row.className='actions';
        var pill=document.createElement('span'); pill.className='pill'; pill.textContent='Pedido '+String(ped.folio).padStart(3,'0')+' · '+ped.estatus; row.appendChild(pill);
        var btn=document.createElement('button'); btn.className='btn'; btn.textContent='Abrir'; btn.addEventListener('click', function(){ abrirPedidoExistente(ped.id); }); row.appendChild(btn);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  function nuevoPedidoBase(){
    DB.folioPedidos += 1;
    var id = 'P' + Date.now();
    var fecha = hoyStr();
    var obj = {
      id: id,
      folio: DB.folioPedidos,
      fecha: fecha,
      promesa: addDays(fecha, 15),
      tipo: 'cliente',
      cliente: '',
      observaciones: '',
      estatus: 'pendiente',
      lineas: [
        { codigo:'', descripcion:'', piezas:0, gramos:0, obs:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, obs:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, obs:'' }
      ]
    };
    DB.pedidos.push(obj);
    saveDB(DB);
    return obj.id;
  }
  function abrirPedidoNuevo(){ var id=nuevoPedidoBase(); abrirPedidoExistente(id); }

  function abrirPedidoExistente(id){
    var ped = DB.pedidos.find(function(x){ return x.id===id; });
    if(!ped){ toast('No encontrado'); return; }
    var titulo='Pedido '+String(ped.folio).padStart(3,'0');

    openTab('pedido-'+id, titulo, function(host){
      host.innerHTML='';

      var card=document.createElement('div'); card.className='card';

      // Encabezado
      var grid=document.createElement('div'); grid.className='grid';

      var dvFolio=document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio';
      var inFo=document.createElement('input'); inFo.readOnly=true; inFo.value=String(ped.folio).padStart(3,'0');
      dvFolio.appendChild(lbFo); dvFolio.appendChild(inFo);

      var dvFecha=document.createElement('div'); var lbF=document.createElement('label'); lbF.textContent='Fecha';
      var inF=document.createElement('input'); inF.type='date'; inF.value=ped.fecha;
      inF.addEventListener('change', function(){ ped.fecha=inF.value; if(!ped.promesa || ped.promesa===''){ ped.promesa=addDays(ped.fecha,15); inProm.value=ped.promesa; } saveDB(DB); });
      dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

      var dvProm=document.createElement('div'); var lbPr=document.createElement('label'); lbPr.textContent='Fecha promesa';
      var inProm=document.createElement('input'); inProm.type='date'; inProm.value=ped.promesa; inProm.addEventListener('change', function(){ ped.promesa=inProm.value; saveDB(DB); });
      dvProm.appendChild(lbPr); dvProm.appendChild(inProm);

      var dvTipo=document.createElement('div'); var lbT=document.createElement('label'); lbT.textContent='Tipo de pedido';
      var selT=document.createElement('select'); var op1=document.createElement('option'); op1.value='cliente'; op1.textContent='Cliente';
      var op2=document.createElement('option'); op2.value='stock'; op2.textContent='Pedido de stock';
      if(ped.tipo==='cliente'){ op1.selected=true; } else { op2.selected=true; }
      selT.appendChild(op1); selT.appendChild(op2);
      selT.addEventListener('change', function(){ ped.tipo=selT.value; saveDB(DB); });
      dvTipo.appendChild(lbT); dvTipo.appendChild(selT);

      var dvCliente=document.createElement('div'); var lbC=document.createElement('label'); lbC.textContent='Cliente';
      var inC=document.createElement('input'); inC.type='text'; inC.placeholder='Nombre del cliente'; inC.value=ped.cliente; inC.addEventListener('input', function(){ ped.cliente=inC.value; saveDB(DB); });
      dvCliente.appendChild(lbC); dvCliente.appendChild(inC);

      var dvObs=document.createElement('div'); var lbO=document.createElement('label'); lbO.textContent='Observaciones';
      var txO=document.createElement('textarea'); txO.value=ped.observaciones; txO.addEventListener('input', function(){ ped.observaciones=txO.value; saveDB(DB); });
      dvObs.appendChild(lbO); dvObs.appendChild(txO);

      var dvEst=document.createElement('div'); var lbE=document.createElement('label'); lbE.textContent='Estatus';
      var pill=document.createElement('input'); pill.readOnly=true; pill.value=ped.estatus;
      if(ped.estatus==='pendiente'){ pill.style.background='#fed7aa'; pill.style.color='#9a3412'; }
      if(ped.estatus==='proceso'){ pill.style.background='#dbeafe'; pill.style.color='#1d4ed8'; }
      if(ped.estatus==='finalizado'){ pill.style.background='#dcfce7'; pill.style.color='#166534'; }
      dvEst.appendChild(lbE); dvEst.appendChild(pill);

      grid.appendChild(dvFolio); grid.appendChild(dvFecha); grid.appendChild(dvProm); grid.appendChild(dvTipo);
      grid.appendChild(dvCliente); grid.appendChild(dvObs); grid.appendChild(dvEst);
      card.appendChild(grid);

      // Botonera de estatus
      var estBar=document.createElement('div'); estBar.className='actions';
      if(ped.estatus==='pendiente'){
        var bAceptar=document.createElement('button'); bAceptar.textContent='Aceptar'; bAceptar.className='btn';
        bAceptar.style.background='#16a34a'; bAceptar.style.color='#fff'; bAceptar.style.border='1px solid #16a34a';
        bAceptar.addEventListener('click', function(){ ped.estatus='proceso'; saveDB(DB); toast('Pedido aceptado → En proceso'); abrirPedidoExistente(ped.id); renderSubmenu('pedidos'); });
        estBar.appendChild(bAceptar);
      }
      if(ped.estatus==='proceso'){
        var bFin=document.createElement('button'); bFin.textContent='Finalizar'; bFin.className='btn';
        bFin.style.background='#16a34a'; bFin.style.color='#fff'; bFin.style.border='1px solid #16a34a';
        bFin.addEventListener('click', function(){ ped.estatus='finalizado'; saveDB(DB); toast('Pedido finalizado'); abrirPedidoExistente(ped.id); renderSubmenu('pedidos'); });
        estBar.appendChild(bFin);
      }
      card.appendChild(estBar);

      // Importar Excel (CSV) — botón verde arriba de líneas
      var importBar=document.createElement('div'); importBar.className='actions';
      var impBtn=document.createElement('button'); impBtn.className='btn'; impBtn.innerHTML='⬆️ 🟩 Excel (CSV)';
      impBtn.style.background='#16a34a'; impBtn.style.color='#fff'; impBtn.style.border='1px solid #16a34a';
      var fileIn=document.createElement('input'); fileIn.type='file'; fileIn.accept='.csv'; fileIn.style.display='none';
      impBtn.addEventListener('click', function(){ fileIn.click(); });
      fileIn.addEventListener('change', function(){
        if(!fileIn.files || !fileIn.files[0]) return;
        importarCSVEnPedido(fileIn.files[0], ped);
      });
      importBar.appendChild(impBtn); importBar.appendChild(fileIn);
      card.appendChild(importBar);

      // Líneas del pedido (widget autogestionado, sin IVA)
      card.appendChild(tablaLineasPedido({
        lineas: ped.lineas,
        onChange: function(){ saveDB(DB); }
      }));

      // Acciones guardar/vista
      var acts=document.createElement('div'); acts.className='actions';
      var bGuardar=document.createElement('button'); bGuardar.className='btn-primary'; bGuardar.textContent='Guardar pedido';
      bGuardar.addEventListener('click', function(){
        if(!confirm('¿Guardar este pedido?')) return;
        saveDB(DB);
        toast('Pedido creado exitosamente; puedes consultarlo en "Pedidos pendientes".');
        var view=qs('#view-pedido-'+ped.id); if(view) view.remove();
        var tabBtn=qs('[data-tab="pedido-'+ped.id+'"]'); if(tabBtn) tabBtn.remove();
        renderSubmenu('pedidos');
      });
      acts.appendChild(bGuardar);

      var bVista=document.createElement('button'); bVista.className='btn'; bVista.textContent='Vista previa';
      bVista.addEventListener('click', function(){ vistaPreviaPedido(ped); });
      acts.appendChild(bVista);

      card.appendChild(acts);
      host.appendChild(card);
    });
  }

  function tablaLineasPedido(cfg){
    // cfg: { lineas, onChange? } — el widget maneja agregar/eliminar
    var wrap=document.createElement('div');

    var top=document.createElement('div'); top.className='actions';
    var h=document.createElement('h2'); h.textContent='Líneas del pedido'; top.appendChild(h);
    var sp=document.createElement('div'); sp.style.flex='1'; top.appendChild(sp);
    var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea';
    var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
    top.appendChild(bAdd); top.appendChild(bDel);
    wrap.appendChild(top);

    var table=document.createElement('table');
    var thead=document.createElement('thead');
    var trh=document.createElement('tr');
    var headers=[{t:'#',w:'6%'},{t:'Código',w:'16%'},{t:'Descripción',w:'42%'},{t:'Piezas',w:'12%'},{t:'Gramos',w:'12%'},{t:'Observaciones',w:'12%'}];
    var i;
    for(i=0;i<headers.length;i++){ var th=document.createElement('th'); th.textContent=headers[i].t; th.style.width=headers[i].w; trh.appendChild(th); }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody=document.createElement('tbody');

    function rebuild(){
      tbody.innerHTML = '';
      var r;
      for(r=0;r<cfg.lineas.length;r++){ renderRow(r); }
      if(typeof cfg.onChange==='function'){ cfg.onChange(); }
    }

    function renderRow(idx){
      var li=cfg.lineas[idx];
      var tr=document.createElement('tr');

      var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);

      var tdCod=document.createElement('td'); var inCod=document.createElement('input'); inCod.type='text'; inCod.value=li.codigo; inCod.style.width='100%';
      inCod.style.fontSize='16px'; inCod.style.height='40px';
      inCod.addEventListener('input', function(){ li.codigo=inCod.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdCod.appendChild(inCod); tr.appendChild(tdCod);

      var tdDesc=document.createElement('td'); var inDesc=document.createElement('input'); inDesc.type='text'; inDesc.value=li.descripcion; inDesc.style.width='100%';
      inDesc.style.fontSize='16px'; inDesc.style.height='40px';
      inDesc.addEventListener('input', function(){ li.descripcion=inDesc.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdDesc.appendChild(inDesc); tr.appendChild(tdDesc);

      var tdPz=document.createElement('td'); var inPz=document.createElement('input'); inPz.type='number'; inPz.step='1'; inPz.min='0'; inPz.value=li.piezas; inPz.style.width='100%';
      inPz.placeholder='0.00'; inPz.style.fontSize='16px'; inPz.style.height='40px'; inPz.style.textAlign='right';
      inPz.addEventListener('input', function(){ li.piezas=parseFloat(inPz.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdPz.appendChild(inPz); tr.appendChild(tdPz);

      var tdGr=document.createElement('td'); var inGr=document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.min='0'; inGr.value=li.gramos; inGr.style.width='100%';
      inGr.placeholder='0.00'; inGr.style.fontSize='16px'; inGr.style.height='40px'; inGr.style.textAlign='right';
      inGr.addEventListener('input', function(){ li.gramos=parseFloat(inGr.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdObs=document.createElement('td'); var inObs=document.createElement('input'); inObs.type='text'; inObs.value=li.obs||''; inObs.style.width='100%';
      inObs.style.fontSize='16px'; inObs.style.height='40px';
      inObs.addEventListener('input', function(){ li.obs=inObs.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdObs.appendChild(inObs); tr.appendChild(tdObs);

      tbody.appendChild(tr);
    }

    // Render inicial
    rebuild();

    bAdd.addEventListener('click', function(){
      cfg.lineas.push({ codigo:'', descripcion:'', piezas:0, gramos:0, obs:'' });
      rebuild();
    });
    bDel.addEventListener('click', function(){
      if(cfg.lineas.length>1){ cfg.lineas.pop(); }
      rebuild();
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function importarCSVEnPedido(file, ped){
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var text=e.target.result;
        var delim = (text.indexOf(';')>-1 && text.indexOf(',')===-1) ? ';' : ',';
        var rows=text.split(/\r?\n/).filter(function(l){ return l.trim().length>0; });
        if(rows.length===0){ toast('CSV vacío'); return; }
        var header=rows[0].split(delim).map(function(h){ return h.trim().toLowerCase(); });
        function idxCampo(names){
          var i, j;
          for(i=0;i<header.length;i++){
            var h=header[i];
            for(j=0;j<names.length;j++){
              if(h===names[j]) return i;
            }
          }
          return -1;
        }
        var idxCodigo   = idxCampo(['codigo','código','code','sku']);
        var idxDesc     = idxCampo(['descripcion','descripción','description']);
        var idxPiezas   = idxCampo(['piezas','pz','pcs']);
        var idxGramos   = idxCampo(['gramos','gr','g']);
        var idxObs      = idxCampo(['obs','observaciones','nota']);

        var nuevas=[];
        var r;
        for(r=1;r<rows.length;r++){
          var cols=rows[r].split(delim);
          if(cols.join('').trim()===''){ continue; }
          var li={
            codigo: idxCodigo>-1 ? String(cols[idxCodigo]).trim() : '',
            descripcion: idxDesc>-1 ? String(cols[idxDesc]).trim() : '',
            piezas: idxPiezas>-1 ? parseFloat(cols[idxPiezas]||'0') : 0,
            gramos: idxGramos>-1 ? parseFloat(cols[idxGramos]||'0') : 0,
            obs: idxObs>-1 ? String(cols[idxObs]).trim() : ''
          };
          nuevas.push(li);
        }
        if(nuevas.length===0){ toast('No se detectaron líneas válidas.'); return; }
        ped.lineas = nuevas;
        saveDB(DB);
        toast('Líneas importadas: '+nuevas.length);
        abrirPedidoExistente(ped.id);
      }catch(err){
        console.error(err);
        toast('Error al leer CSV');
      }
    };
    reader.readAsText(file);
  }

  function vistaPreviaPedido(ped){
    var w=window.open('', '_blank', 'width=840,height=900');
    if(!w){ alert('Permite pop-ups para imprimir.'); return; }
    var css='@page{size:5.5in 8.5in;margin:10mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}h1{color:#0a2c4c}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:4px 6px}thead tr{background:#e7effa}.row{display:flex;gap:8px;margin:6px 0}.col{flex:1}';
    var html=[];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido '+String(ped.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
    html.push('<h1>Pedido '+String(ped.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+ped.fecha+'</div><div class="col"><b>Promesa:</b> '+ped.promesa+'</div><div class="col"><b>Tipo:</b> '+ped.tipo+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Cliente:</b> '+escapeHTML(ped.cliente)+'</div><div class="col"><b>Estatus:</b> '+ped.estatus+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Observaciones:</b> '+escapeHTML(ped.observaciones)+'</div></div>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:16%">Código</th><th style="width:42%">Descripción</th><th style="width:12%">Piezas</th><th style="width:12%">Gramos</th><th style="width:12%">Obs.</th></tr></thead><tbody>');
    var i; for(i=0;i<ped.lineas.length;i++){
      var li=ped.lineas[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+escapeHTML(li.codigo)+'</td><td>'+escapeHTML(li.descripcion)+'</td><td>'+f2(li.piezas)+'</td><td>'+f2(li.gramos)+'</td><td>'+escapeHTML(li.obs||'')+'</td></tr>');
    }
    html.push('</tbody></table></body></html>');
    w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
  }

  // ===== Exponer mínimas funciones globales usadas por botones preexistentes
  window.imprimirPDF = imprimirPDF;
  window.compartirWhatsApp = compartirWhatsApp;

  // ===== Submenú inicial
  renderSubmenu('inicio');
// =====================  MÓDULO: PRODUCCIÓN → MAQUILADORES  =====================
  // Este bloque no reemplaza nada existente; extiende el sistema con PRODUCCIÓN → Maquiladores.

  // 1) Migración mínima en caliente para nuevos campos de BD
  (function ensureMaquilaInit(){
    try{
      if(!DB.maquilaOT){ DB.maquilaOT = []; }
      if(typeof DB.folioMaquila !== 'number'){ DB.folioMaquila = 0; }
    }catch(e){ /* noop */ }
  })();

  // 2) Enrutar submenú: producimos una envoltura de renderSubmenu para manejar 'produccion'
  var _renderSubmenu = renderSubmenu;
  renderSubmenu = function(root){
    if(root === 'produccion'){
      var host = qs('#subpanel');
      if(!host){ return; }
      host.innerHTML = '';

      var card = document.createElement('div'); card.className = 'card';
      var h2 = document.createElement('h2'); h2.textContent = 'Producción'; card.appendChild(h2);

      // Submenú específico de Producción
      var m = document.createElement('div'); m.className = 'card';
      var h3 = document.createElement('h2'); h3.textContent = 'Maquiladores'; m.appendChild(h3);

      var acciones = document.createElement('div'); acciones.className = 'actions';
      var bNueva = document.createElement('button'); bNueva.className = 'btn-primary'; bNueva.textContent = '+ Nueva OT';
      bNueva.addEventListener('click', function(){ abrirOTNueva(); }); acciones.appendChild(bNueva);

      var bPend = document.createElement('button'); bPend.className = 'btn-outline'; bPend.textContent = 'OT pendientes';
      bPend.addEventListener('click', function(){ listarOTPendientes(true); }); acciones.appendChild(bPend);

      var bCerr = document.createElement('button'); bCerr.className = 'btn-outline'; bCerr.textContent = 'OT cerradas';
      bCerr.addEventListener('click', function(){ listarOTCerradas(); }); acciones.appendChild(bCerr);

      m.appendChild(acciones);
      host.appendChild(card);
      host.appendChild(m);

      // Lista inicial
      listarOTPendientes(false);
      ensureMobileToolbar();
      return;
    }
    // Cualquier otro root sigue el flujo original
    _renderSubmenu(root);
  };

  // 3) Helpers específicos de Maquila
  function f0(n){ return (parseFloat(n||0)).toFixed(0); }
  function sumaCantGramos(lineas){
    var s = 0; var i;
    for(i=0;i<lineas.length;i++){
      if(String(lineas[i].unidad||'g') === 'g'){
        s += parseFloat(lineas[i].cant||0);
      }
    }
    return s;
  }

  // 4) CRUD básico de OT
  function nuevoOTBase(){
    DB.folioMaquila += 1;
    var id = 'M' + Date.now();
    var fecha = hoyStr();
    var obj = {
      id: id,
      folio: DB.folioMaquila,
      fecha: fecha,
      hora: horaStr(),
      saleDe: 'caja',
      maquilador: '',
      promesaFecha: addDays(fecha, 15),
      promesaHora: '13:00',
      comentarios: '',
      mermaPactadaDefault: { tipo: '%', valor: 0 },
      evidencia: '',
      entrada: {
        lineas: [
          { materialId: '925', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_gramo', precio: 0, subtotal: 0 },
          { materialId: '925', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_gramo', precio: 0, subtotal: 0 },
          { materialId: '925', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_gramo', precio: 0, subtotal: 0 }
        ],
        total: 0
      },
      devolucion: {
        creada: false,
        fecha: fecha,
        hora: horaStr(),
        comentarios: '',
        lineas: [
          { materialId: 'terminado', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_pieza', precio: 0, subtotal: 0 },
          { materialId: 'terminado', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_pieza', precio: 0, subtotal: 0 },
          { materialId: 'terminado', detalle: '', unidad: 'g', cant: 0, precioTipo: 'por_pieza', precio: 0, subtotal: 0 }
        ],
        total: 0
      },
      cerrado: false
    };
    DB.maquilaOT.push(obj);
    saveDB(DB);
    return obj.id;
  }
  function abrirOTNueva(){ var id = nuevoOTBase(); abrirOTExistente(id, false); }

  function listarOTPendientes(mostrarTitulo){
    var host = qs('#subpanel'); if(!host){ return; }
    var card = document.createElement('div'); card.className = 'card';
    if(mostrarTitulo){ var h=document.createElement('h2'); h.textContent='OT pendientes'; card.appendChild(h); }

    var lst = DB.maquilaOT.filter(function(o){ return !o.cerrado; }).sort(function(a,b){ return b.folio - a.folio; });
    if(lst.length === 0){ var p=document.createElement('p'); p.textContent='Sin OT pendientes.'; card.appendChild(p); }
    else{
      lst.forEach(function(o){
        var row = document.createElement('div'); row.className = 'actions';
        var pill = document.createElement('span'); pill.className='pill orange'; pill.textContent='OT ' + String(o.folio).padStart(3,'0'); row.appendChild(pill);
        var bAbr = document.createElement('button'); bAbr.className='btn-orange'; bAbr.textContent='Procesar esta OT';
        bAbr.addEventListener('click', function(){ abrirOTExistente(o.id, true); });
        row.appendChild(bAbr);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }
  function listarOTCerradas(){
    var host = qs('#subpanel'); if(!host){ return; }
    var card = document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent='OT cerradas'; card.appendChild(h);
    var lst = DB.maquilaOT.filter(function(o){ return !!o.cerrado; }).sort(function(a,b){ return b.folio - a.folio; });
    if(lst.length === 0){ var p=document.createElement('p'); p.textContent='Aún no hay OT cerradas.'; card.appendChild(p); }
    else{
      lst.forEach(function(o){
        var row=document.createElement('div'); row.className='actions';
        var pill=document.createElement('span'); pill.className='pill'; pill.textContent='OT '+String(o.folio).padStart(3,'0'); row.appendChild(pill);
        var bPDF=document.createElement('button'); bPDF.className='btn'; bPDF.textContent='Abrir PDF'; bPDF.addEventListener('click', function(){ imprimirPDFOT(o, false); }); row.appendChild(bPDF);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  // 5) UI de una OT
  function abrirOTExistente(id, modoDevolucion){
    var ot = DB.maquilaOT.find(function(x){ return x.id === id; });
    if(!ot){ toast('No encontrada'); return; }

    var titulo = 'OT ' + String(ot.folio).padStart(3, '0');
    openTab('ot-'+id, titulo, function(host){
      host.innerHTML = '';
      var card = document.createElement('div'); card.className = 'card';

      // Encabezado global
      var head = document.createElement('div'); head.className = 'grid';

      var dvFolio = document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio';
      var inFo=document.createElement('input'); inFo.readOnly=true; inFo.value=String(ot.folio).padStart(3,'0'); inFo.style.color='#b91c1c'; dvFolio.appendChild(lbFo); dvFolio.appendChild(inFo);

      var dvFecha=document.createElement('div'); var lbF=document.createElement('label'); lbF.textContent='Fecha';
      var inF=document.createElement('input'); inF.type='date'; inF.value=ot.fecha; inF.readOnly=!!modoDevolucion; if(modoDevolucion){ inF.classList.add('ro'); }
      inF.addEventListener('change', function(){ ot.fecha=inF.value; saveDB(DB); }); dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

      var dvAlm=document.createElement('div'); var lbA=document.createElement('label'); lbA.textContent='Sale de';
      var selA=document.createElement('select'); ALMACENES.forEach(function(a){ var op=document.createElement('option'); op.value=a.id; op.textContent=a.nombre; if(a.id===ot.saleDe) op.selected=true; selA.appendChild(op); });
      selA.disabled=!!modoDevolucion; selA.addEventListener('change', function(){ ot.saleDe=selA.value; saveDB(DB); }); dvAlm.appendChild(lbA); dvAlm.appendChild(selA);

      var dvMaq=document.createElement('div'); var lbM=document.createElement('label'); lbM.textContent='Maquilador';
      var inM=document.createElement('input'); inM.type='text'; inM.placeholder='Nombre completo'; inM.value=ot.maquilador; inM.readOnly=false;
      inM.addEventListener('input', function(){ ot.maquilador=inM.value; saveDB(DB); }); dvMaq.appendChild(lbM); dvMaq.appendChild(inM);

      var dvPromF=document.createElement('div'); var lbPF=document.createElement('label'); lbPF.textContent='Fecha promesa';
      var inPF=document.createElement('input'); inPF.type='date'; inPF.value=ot.promesaFecha; inPF.addEventListener('change', function(){ ot.promesaFecha=inPF.value; saveDB(DB); actualizarEstadoOT(estadoWrap, ot); }); dvPromF.appendChild(lbPF); dvPromF.appendChild(inPF);

      var dvPromH=document.createElement('div'); var lbPH=document.createElement('label'); lbPH.textContent='Hora promesa';
      var inPH=document.createElement('input'); inPH.type='time'; inPH.value=ot.promesaHora; inPH.addEventListener('change', function(){ ot.promesaHora=inPH.value; saveDB(DB); }); dvPromH.appendChild(lbPH); dvPromH.appendChild(inPH);

      var dvMerma=document.createElement('div'); var lbMe=document.createElement('label'); lbMe.textContent='Merma pactada (default)';
      var inMe=document.createElement('input'); inMe.type='number'; inMe.step='0.1'; inMe.min='0'; inMe.value=ot.mermaPactadaDefault && typeof ot.mermaPactadaDefault.valor==='number' ? ot.mermaPactadaDefault.valor : 0;
      inMe.addEventListener('input', function(){ ot.mermaPactadaDefault = { tipo:'%', valor: parseFloat(inMe.value||'0') }; saveDB(DB); }); dvMerma.appendChild(lbMe); dvMerma.appendChild(inMe);

      var dvCom=document.createElement('div'); var lbC=document.createElement('label'); lbC.textContent='Comentarios generales';
      var txC=document.createElement('textarea'); txC.value=ot.comentarios||''; txC.addEventListener('input', function(){ ot.comentarios=txC.value; saveDB(DB); }); dvCom.appendChild(lbC); dvCom.appendChild(txC);

      head.appendChild(dvFolio); head.appendChild(dvFecha); head.appendChild(dvAlm); head.appendChild(dvMaq);
      head.appendChild(dvPromF); head.appendChild(dvPromH); head.appendChild(dvMerma); head.appendChild(dvCom);
      card.appendChild(head);

      // Evidencia global
      var divEv=document.createElement('div'); divEv.className='actions';
      var cam=document.createElement('span'); cam.textContent='📷'; var lbl=document.createElement('span'); lbl.textContent=' Cargar evidencia fotográfica (aplica a TODA la OT)';
      var inFile=document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
      inFile.addEventListener('change', function(){ if(inFile.files && inFile.files[0]){ cargarEvidenciaOT(ot, inFile.files[0]); } });
      divEv.appendChild(cam); divEv.appendChild(lbl); divEv.appendChild(inFile);
      card.appendChild(divEv);

      // Estado global
      var estadoWrap=document.createElement('div'); estadoWrap.className='estado-global';
      card.appendChild(estadoWrap);
      actualizarEstadoOT(estadoWrap, ot);

      // Botonera global
      var barra=document.createElement('div'); barra.className='barra-global';
      var bVista=document.createElement('button'); bVista.className='btn'; bVista.textContent='Vista previa'; bVista.addEventListener('click', function(){ imprimirPDFOT(ot, true); }); barra.appendChild(bVista);

      if(!modoDevolucion){
        var bGuardarEntrada=document.createElement('button'); bGuardarEntrada.className='btn-primary'; bGuardarEntrada.textContent='Guardar ENTRADA a maquilador';
        bGuardarEntrada.addEventListener('click', function(){ saveDB(DB); toast('OT creada; la verás en "OT pendientes".'); var v=qs('#view-ot-'+ot.id); if(v) v.remove(); var t=qs('[data-tab="ot-'+ot.id+'"]'); if(t) t.remove(); renderSubmenu('produccion'); });
        barra.appendChild(bGuardarEntrada);
      }

      if(ot.cerrado){
        var bPDF=document.createElement('button'); bPDF.className='btn'; bPDF.textContent='PDF final'; bPDF.addEventListener('click', function(){ imprimirPDFOT(ot, false); }); barra.appendChild(bPDF);
        var bWA=document.createElement('button'); bWA.className='btn'; bWA.textContent='📱 WhatsApp'; bWA.addEventListener('click', function(){ compartirWhatsAppOT(ot); }); barra.appendChild(bWA);
      }

      if(modoDevolucion && !ot.cerrado){
        var bCerrar=document.createElement('button'); bCerrar.className='btn-primary'; bCerrar.textContent='Guardar DEVOLUCIÓN / Cerrar OT';
        bCerrar.addEventListener('click', function(){ cerrarOT(ot); });
        barra.appendChild(bCerrar);
      }
      card.appendChild(barra);

      // ENTRADA (al maquilador)
      var g1=document.createElement('div'); g1.className='grid';
      var dvTE=document.createElement('div'); var lbTE=document.createElement('label'); lbTE.textContent='Total ENTRADA (g)';
      var inTE=document.createElement('input'); inTE.readOnly=true; inTE.value=f2(ot.entrada.total||0); dvTE.appendChild(lbTE); dvTE.appendChild(inTE); g1.appendChild(dvTE);
      card.appendChild(g1);

      card.appendChild(tablaLineasMaquila({
        titulo: 'ENTRADA a maquilador',
        bloqueado: !!modoDevolucion,
        lineas: ot.entrada.lineas,
        mostrarPrecio: true,
        onChange: function(){ ot.entrada.total = recalcTotales(ot.entrada.lineas); inTE.value=f2(ot.entrada.total); saveDB(DB); actualizarEstadoOT(estadoWrap, ot); }
      }));

      // DEVOLUCIÓN (del maquilador)
      var bar=document.createElement('div'); bar.className='card';
      var h3=document.createElement('h2'); h3.textContent = modoDevolucion ? 'DEVOLUCIÓN (editable)' : 'DEVOLUCIÓN (bloqueada hasta procesar)'; bar.appendChild(h3);

      var g2=document.createElement('div'); g2.className='grid';
      var dvFD=document.createElement('div'); var lbFD=document.createElement('label'); lbFD.textContent='Fecha devolución';
      var inFD=document.createElement('input'); inFD.type='date'; inFD.value=ot.devolucion.fecha; inFD.readOnly=!modoDevolucion; if(!modoDevolucion){ inFD.classList.add('ro'); }
      inFD.addEventListener('change', function(){ ot.devolucion.fecha=inFD.value; saveDB(DB); }); dvFD.appendChild(lbFD); dvFD.appendChild(inFD); g2.appendChild(dvFD);

      var dvHD=document.createElement('div'); var lbHD=document.createElement('label'); lbHD.textContent='Hora devolución';
      var inHD=document.createElement('input'); inHD.type='time'; inHD.value=ot.devolucion.hora||''; inHD.readOnly=!modoDevolucion; if(!modoDevolucion){ inHD.classList.add('ro'); }
      inHD.addEventListener('change', function(){ ot.devolucion.hora=inHD.value; saveDB(DB); }); dvHD.appendChild(lbHD); dvHD.appendChild(inHD); g2.appendChild(dvHD);

      var dvCD=document.createElement('div'); var lbCD=document.createElement('label'); lbCD.textContent='Comentarios (devolución)';
      var txCD=document.createElement('textarea'); txCD.value=ot.devolucion.comentarios||''; txCD.readOnly=!modoDevolucion; if(!modoDevolucion){ txCD.classList.add('ro'); }
      txCD.addEventListener('input', function(){ ot.devolucion.comentarios=txCD.value; saveDB(DB); }); dvCD.appendChild(lbCD); dvCD.appendChild(txCD); g2.appendChild(dvCD);

      var dvTD=document.createElement('div'); var lbTD=document.createElement('label'); lbTD.textContent='Total DEVOLUCIÓN (g)';
      var inTD=document.createElement('input'); inTD.readOnly=true; inTD.value=f2(ot.devolucion.total||0); dvTD.appendChild(lbTD); dvTD.appendChild(inTD); g2.appendChild(dvTD);

      bar.appendChild(g2);

      bar.appendChild(tablaLineasMaquila({
        titulo: 'DEVOLUCIÓN del maquilador',
        bloqueado: !modoDevolucion,
        lineas: ot.devolucion.lineas,
        mostrarPrecio: true,
        onChange: function(){ ot.devolucion.total = recalcTotales(ot.devolucion.lineas); inTD.value=f2(ot.devolucion.total); saveDB(DB); actualizarEstadoOT(estadoWrap, ot); }
      }));

      card.appendChild(bar);
      host.appendChild(card);
    });
  }

  // 6) Estado global de la OT
  function actualizarEstadoOT(wrap, ot){
    var entG = sumaCantGramos(ot.entrada.lineas);
    var devG = sumaCantGramos(ot.devolucion.lineas);
    var tieneDev = devG > 0;
    var dif = tieneDev ? (devG - entG) : 0;
    var mermaAbs = tieneDev ? Math.max(0, entG - devG) : 0;
    var mermaPct = tieneDev && entG > 0 ? (mermaAbs / entG) * 100 : 0;

    var estado = 'Pendiente de devolución';
    var color = '#334155';
    if(tieneDev){
      estado = 'OK'; color = '#065f46';
      if(mermaPct > 2.5 && mermaPct < 4.5){ estado = 'Atento'; color = '#b45309'; }
      if(mermaPct >= 4.5){ estado = 'Excede'; color = '#b91c1c'; }
    }

    // Días a promesa
    var diasProm = '';
    try{
      var hoy = new Date();
      var pf = new Date(ot.promesaFecha + 'T' + (ot.promesaHora||'00:00') + ':00');
      var ms = pf.getTime() - hoy.getTime();
      var d = Math.ceil(ms / (1000*60*60*24));
      diasProm = isNaN(d) ? '' : (d>=0 ? ('Faltan ' + d + ' d') : ('Venció hace ' + Math.abs(d) + ' d'));
    }catch(e){ diasProm = ''; }

    wrap.innerHTML = '';
    function chip(txt, bold, c){ var s=document.createElement('span'); s.className='estado-chip'+(bold?' bold':''); s.textContent=txt; if(bold && c){ s.style.color=c; } wrap.appendChild(s); }
    chip('Entregado: ' + f2(entG) + ' g', false, '');
    chip('Devuelto: ' + (tieneDev ? f2(devG)+' g' : '—'), false, '');
    chip('Dif: ' + (tieneDev ? ((dif>=0?'+':'') + f2(dif) + ' g') : '—'), false, '');
    chip('Merma: ' + (tieneDev ? (f2(mermaAbs) + ' g (' + mermaPct.toFixed(1) + '%)') : '—'), false, '');
    if(diasProm){ chip(diasProm, false, ''); }
    chip('Estado: ' + estado, true, color);
  }

  // 7) Widget de líneas para Maquila (entrada/devolución)
  function recalcTotales(arr){
    var s = 0; var i;
    for(i=0;i<arr.length;i++){
      var li = arr[i];
      var sub = 0;
      var cant = parseFloat(li.cant||0);
      var precio = parseFloat(li.precio||0);
      var tipo = String(li.precioTipo||'por_gramo');
      if(tipo==='por_gramo'){ sub = cant * precio; }
      else if(tipo==='por_pieza'){ sub = cant * precio; }
      else if(tipo==='proceso_fijo'){ sub = precio; }
      li.subtotal = sub;
      s += sub;
    }
    return s;
  }
  function tablaLineasMaquila(cfg){
    // cfg: { titulo, bloqueado, lineas, mostrarPrecio, onChange? }
    var wrap = document.createElement('div');

    var top = document.createElement('div'); top.className='actions';
    var h = document.createElement('h2'); h.textContent = cfg.titulo; top.appendChild(h);
    var sp = document.createElement('div'); sp.style.flex='1'; top.appendChild(sp);
    var bAdd, bDel;
    if(!cfg.bloqueado){
      bAdd = document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea';
      bDel = document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
      top.appendChild(bAdd); top.appendChild(bDel);
    }
    wrap.appendChild(top);

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    var cols = [
      {t:'#', w:'5%'},
      {t:'Material', w:'18%'},
      {t:'Detalle', w:'26%'},
      {t:'Unidad', w:'8%'},
      {t:'Cantidad', w:'12%'}
    ];
    if(cfg.mostrarPrecio){ cols.push({t:'Precio tipo', w:'16%'}); cols.push({t:'Precio', w:'10%'}); cols.push({t:'Subtotal', w:'15%'}); }
    var i;
    for(i=0;i<cols.length;i++){ var th=document.createElement('th'); th.textContent=cols[i].t; th.style.width=cols[i].w; trh.appendChild(th); }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody = document.createElement('tbody');

    function rebuild(){ tbody.innerHTML=''; var r; for(r=0;r<cfg.lineas.length;r++){ renderRow(r); } }

    function renderRow(idx){
      var li = cfg.lineas[idx];
      var tr = document.createElement('tr');

      var tdIdx = document.createElement('td'); tdIdx.textContent = (idx+1); tr.appendChild(tdIdx);

      var tdMat = document.createElement('td');
      var selM = document.createElement('select'); selM.style.width='100%';
      MATERIALES.forEach(function(m){ var op=document.createElement('option'); op.value=m.id; op.textContent=m.nombre; if(m.id===li.materialId){ op.selected=true; } selM.appendChild(op); });
      selM.disabled=!!cfg.bloqueado; selM.addEventListener('change', function(){ li.materialId=selM.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
      tdMat.appendChild(selM); tr.appendChild(tdMat);

      var tdDet = document.createElement('td');
      var inDet = document.createElement('input'); inDet.type='text'; inDet.value=li.detalle||''; inDet.style.width='100%';
      inDet.readOnly=!!cfg.bloqueado; if(inDet.readOnly){ inDet.classList.add('ro'); }
      inDet.addEventListener('input', function(){ li.detalle=inDet.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
      tdDet.appendChild(inDet); tr.appendChild(tdDet);

      var tdUni = document.createElement('td');
      var selU = document.createElement('select'); var opG=document.createElement('option'); opG.value='g'; opG.textContent='g'; var opP=document.createElement('option'); opP.value='pza'; opP.textContent='pza';
      selU.appendChild(opG); selU.appendChild(opP); selU.value = String(li.unidad||'g');
      selU.disabled=!!cfg.bloqueado; selU.addEventListener('change', function(){ li.unidad=selU.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
      tdUni.appendChild(selU); tr.appendChild(tdUni);

      var tdCant = document.createElement('td');
      var inCant = document.createElement('input'); inCant.type='number'; inCant.step='0.01'; inCant.min='0'; inCant.value=li.cant||0; inCant.style.width='100%'; inCant.style.textAlign='right';
      inCant.readOnly=!!cfg.bloqueado; if(inCant.readOnly){ inCant.classList.add('ro'); }
      inCant.addEventListener('input', function(){ li.cant=parseFloat(inCant.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
      tdCant.appendChild(inCant); tr.appendChild(tdCant);

      if(cfg.mostrarPrecio){
        var tdPT = document.createElement('td');
        var selPT = document.createElement('select');
        var opt1=document.createElement('option'); opt1.value='por_gramo'; opt1.textContent='por gramo';
        var opt2=document.createElement('option'); opt2.value='por_pieza'; opt2.textContent='por pieza';
        var opt3=document.createElement('option'); opt3.value='proceso_fijo'; opt3.textContent='proceso fijo';
        selPT.appendChild(opt1); selPT.appendChild(opt2); selPT.appendChild(opt3);
        selPT.value = String(li.precioTipo||'por_gramo'); selPT.disabled=!!cfg.bloqueado;
        selPT.addEventListener('change', function(){ li.precioTipo=selPT.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
        tdPT.appendChild(selPT); tr.appendChild(tdPT);

        var tdPr = document.createElement('td'); var inPr=document.createElement('input'); inPr.type='number'; inPr.step='0.01'; inPr.min='0'; inPr.value=li.precio||0; inPr.style.width='100%'; inPr.style.textAlign='right';
        inPr.readOnly=!!cfg.bloqueado; if(inPr.readOnly){ inPr.classList.add('ro'); }
        inPr.addEventListener('input', function(){ li.precio=parseFloat(inPr.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); });
        tdPr.appendChild(inPr); tr.appendChild(tdPr);

        var tdSub = document.createElement('td'); var inSub=document.createElement('input'); inSub.readOnly=true; inSub.value=f2(li.subtotal||0); inSub.style.width='100%'; inSub.style.textAlign='right';
        tdSub.appendChild(inSub); tr.appendChild(tdSub);

        // Recalc en caliente
        function recalcRow(){ li.subtotal = 0; var c=parseFloat(inCant.value||'0'); var p=parseFloat(inPr.value||'0'); var t=selPT.value; if(t==='por_gramo'||t==='por_pieza'){ li.subtotal = c*p; } else if(t==='proceso_fijo'){ li.subtotal = p; } inSub.value=f2(li.subtotal); if(typeof cfg.onChange==='function'){ cfg.onChange(); } saveDB(DB); }
        inCant.addEventListener('input', recalcRow);
        inPr.addEventListener('input', recalcRow);
        selPT.addEventListener('change', recalcRow);
      }

      tbody.appendChild(tr);
    }

    rebuild();

    if(bAdd){ bAdd.addEventListener('click', function(){ cfg.lineas.push({ materialId:'925', detalle:'', unidad:'g', cant:0, precioTipo:'por_gramo', precio:0, subtotal:0 }); rebuild(); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); }
    if(bDel){ bDel.addEventListener('click', function(){ if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); if(typeof cfg.onChange==='function'){ cfg.onChange(); } } }); }

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  // 8) Cerrar OT con validaciones básicas
  function cerrarOT(ot){
    var entG = sumaCantGramos(ot.entrada.lineas);
    var devG = sumaCantGramos(ot.devolucion.lineas);
    if(devG <= 0){ alert('Captura la DEVOLUCIÓN antes de cerrar.'); return; }

    // Merma pactada default por hoja (si existe). Si el usuario puso una línea con merma menor, se puede registrar manualmente en comentarios.
    var tol = (ot.mermaPactadaDefault && typeof ot.mermaPactadaDefault.valor==='number') ? (ot.mermaPactadaDefault.valor/100.0) : 0.05;
    var mermaAbs = Math.max(0, entG - devG);
    var mermaPct = entG>0 ? (mermaAbs/entG) : 0;
    if(mermaPct > tol){
      alert('Merma superior al '+String((tol*100).toFixed(1))+'% según la promesa pactada. Revisa la OT.');
      return;
    }

    ot.cerrado = true;
    saveDB(DB);
    toast('OT cerrada');
    imprimirPDFOT(ot, false);
  }

  // 9) PDF con evidencia y leyenda legal
  function imprimirPDFOT(ot, isDraft){
    var w = window.open('', '_blank', 'width=840,height=900'); if(!w){ alert('Permite pop-ups para imprimir.'); return; }

    var entG = sumaCantGramos(ot.entrada.lineas);
    var devG = sumaCantGramos(ot.devolucion.lineas);
    var tieneDev = devG > 0;
    var dif = tieneDev ? (devG - entG) : 0;
    var mermaAbs = tieneDev ? Math.max(0, entG - devG) : 0;
    var mermaPct = tieneDev && entG>0 ? (mermaAbs/entG)*100 : 0;

    var estado = 'Pendiente de devolución';
    if(tieneDev){ estado = 'OK'; if(mermaPct>2.5 && mermaPct<4.5){ estado='Atento'; } if(mermaPct>=4.5){ estado='Excede'; } }

    var css='@page{size:5.5in 8.5in;margin:10mm}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px}h1.red{color:#b91c1c}h2{margin:2px 0 6px 0;color:#0a2c4c}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left}thead tr{background:#e7effa}.row{display:flex;gap:8px;margin:6px 0}.col{flex:1}.signs{display:flex;justify-content:space-between;margin-top:18px}.signs div{width:45%;border-top:1px solid #94a3b8;padding-top:6px;text-align:center}.water{position:fixed;top:40%;left:15%;font-size:48px;color:#94a3b880;transform:rotate(-20deg)}.chips{margin:8px 0}.chip{background:#f1f5f9;border-radius:16px;padding:6px 10px;margin-right:6px;font-size:12px;font-weight:600}';

    var html=[]; html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>OT '+String(ot.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
    if(isDraft){ html.push('<div class="water">BORRADOR</div>'); }

    html.push('<h1 class="red">OT '+String(ot.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+ot.fecha+' '+(ot.hora||'')+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(ot.saleDe)+'</div><div class="col"><b>Maquilador:</b> '+escapeHTML(ot.maquilador||'')+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Promesa:</b> '+escapeHTML(ot.promesaFecha||'')+' '+escapeHTML(ot.promesaHora||'')+'</div><div class="col"><b>Comentarios:</b> '+escapeHTML(ot.comentarios||'')+'</div></div>');

    if(ot.evidencia){ html.push('<h3>Evidencia fotográfica</h3><img src="'+ot.evidencia+'" style="max-width:100%;max-height:300px;border:1px solid #ccc">'); }

    html.push('<div class="chips">');
    html.push('<span class="chip">Entregado: '+f2(entG)+' g</span>');
    html.push('<span class="chip">Devuelto: '+(tieneDev?f2(devG)+' g':'—')+'</span>');
    html.push('<span class="chip">Dif: '+(tieneDev?((dif>=0?'+':'')+f2(dif)+' g'):'—')+'</span>');
    html.push('<span class="chip">Merma: '+(tieneDev?(f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)'):'—')+'</span>');
    html.push('<span class="chip">Estado: '+estado+'</span>');
    html.push('</div>');

    // ENTRADA
    html.push('<h2>Entrada a maquilador</h2>');
    html.push('<table><thead><tr><th style="width:5%">#</th><th style="width:18%">Material</th><th style="width:26%">Detalle</th><th style="width:8%">Unidad</th><th style="width:12%">Cantidad</th><th style="width:16%">Precio tipo</th><th style="width:10%">Precio</th><th style="width:15%">Subtotal</th></tr></thead><tbody>');
    var i; for(i=0;i<ot.entrada.lineas.length;i++){ var li=ot.entrada.lineas[i]; html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+escapeHTML(li.unidad||'g')+'</td><td>'+f2(li.cant||0)+'</td><td>'+escapeHTML((li.precioTipo||'').replace('_',' '))+'</td><td>'+f2(li.precio||0)+'</td><td>'+f2(li.subtotal||0)+'</td></tr>'); }
    html.push('</tbody></table>');
    html.push('<div class="signs"><div>Entregó (ARGOZMX)</div><div>Recibió (Maquilador)</div></div>');

    // DEVOLUCIÓN
    html.push('<h2>Devolución del maquilador</h2>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+escapeHTML(ot.devolucion.fecha||'')+' '+escapeHTML(ot.devolucion.hora||'')+'</div><div class="col"><b>Comentarios devolución:</b> '+escapeHTML(ot.devolucion.comentarios||'')+'</div></div>');
    html.push('<table><thead><tr><th style="width:5%">#</th><th style="width:18%">Material</th><th style="width:26%">Detalle</th><th style="width:8%">Unidad</th><th style="width:12%">Cantidad</th><th style="width:16%">Precio tipo</th><th style="width:10%">Precio</th><th style="width:15%">Subtotal</th></tr></thead><tbody>');
    for(i=0;i<ot.devolucion.lineas.length;i++){ var lo=ot.devolucion.lineas[i]; html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(lo.materialId)+'</td><td>'+escapeHTML(lo.detalle||'')+'</td><td>'+escapeHTML(lo.unidad||'g')+'</td><td>'+f2(lo.cant||0)+'</td><td>'+escapeHTML((lo.precioTipo||'').replace('_',' '))+'</td><td>'+f2(lo.precio||0)+'</td><td>'+f2(lo.subtotal||0)+'</td></tr>'); }
    html.push('</tbody></table>');
    if(tieneDev){ html.push('<div class="row"><div class="col"><b>MERMA:</b> '+f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)</div><div class="col"><b>DIF:</b> '+(dif>=0?'+':'')+f2(dif)+' g</div></div>'); }

    // Leyenda legal básica (depósito mercantil + pena convencional)
    html.push('<h2>Reconocimiento y obligaciones</h2>');
    html.push('<p style="font-size:11px;line-height:1.4">RECONOCIMIENTO DE RECEPCIÓN Y OBLIGACIONES DEL MAQUILADOR. Yo, ___________________________, con domicilio en ___________________________, declaro que recibí en depósito mercantil de ARGOZMX los materiales descritos en la presente Orden de Trabajo (OT Folio '+String(ot.folio).padStart(3,'0')+'), obligándome a su conservación y devolución en la fecha promesa, en las cantidades y calidades indicadas, realizando únicamente los procesos descritos. Reconozco que soy responsable por menoscabos, daños o pérdidas causados por malicia o negligencia. En caso de faltante a la entrega (gramos o piezas no devueltos), pagaré su valor a $________ por gramo/pieza, además de una pena convencional equivalente al ______% del valor del faltante. Asimismo, reconozco adeudar a ARGOZMX el precio pactado por los procesos: $________ por (gramo/pieza/proceso fijo), pagadero a la entrega.</p>');
    html.push('<div class="signs"><div>Nombre y firma del maquilador (depositario)</div><div>Nombre y firma quien entrega (ARGOZMX)</div></div>');

    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    try{ w.focus(); w.print(); }catch(e){}
  }
  function compartirWhatsAppOT(ot){ imprimirPDFOT(ot,false); toast('Guarda el PDF y compártelo por WhatsApp.'); }
  function cargarEvidenciaOT(ot, file){ var r=new FileReader(); r.onload=function(e){ ot.evidencia=e.target.result; saveDB(DB); toast('Foto cargada.'); }; r.readAsDataURL(file); }

// ===================  FIN MÓDULO: PRODUCCIÓN → MAQUILADORES  ===================

})();
