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
/* =========================  MÓDULO: PRODUCCIÓN → MAQUILADORES  v2.8.0  =========================
   Cambios aplicados:
   - Menú PRODUCCIÓN → Maquiladores; acción: + Nueva OT.
   - Campo “Nombre del maquilador”.
   - Merma pactada: SOLO GLOBAL en % (sin merma por línea).
   - Secciones (sin “Parte X”):
       Encabezado + Resumen | Detalle de pedido | Entrega de materiales | Insumos y extras | Recepción (al procesar)
   - Botones maestros (👁️ Vista previa, 💾 Guardar/Guardar recepción) arriba a la derecha.
   - Totales y precios destacados ($/g, $/pz, Mano de obra estimada).
   - PDF funcional con Blob (evita popup en blanco), título “ORDEN DE TRABAJO”, logo /logo.webp, firmas y leyenda legal.
   - Suma también el .925 devuelto (heurística por texto).
   - Ajuste de “galletas” (chips/pills) para que Entrega de materiales NO requiera scroll.
*/

/* === CSS fino (chips/pills compactos y tabla materiales sin scroll vertical) === */
(function injectMaquilaCSS(){
  var css = `
  .estado-global{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
  .estado-chip{background:#f1f5f9;border-radius:14px;padding:3px 8px;font-size:11px;font-weight:600;line-height:1}
  .estado-chip.bold{font-weight:800}
  .pill{background:#eef2f7;border-radius:14px;padding:3px 8px;font-weight:700;font-size:11px;line-height:1}
  .card .actions{gap:8px}
  .ot-sec3-wrap{overflow:visible!important} /* evita scroll innecesario en Entrega de materiales */
  .ot-sec3-wrap table input, .ot-sec3-wrap table select{height:30px}
  .ot-sec3-wrap table th, .ot-sec3-wrap table td{padding:3px 6px}
  `;
  var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
})();

/* ===== Hook de menú: PRODUCCIÓN → MAQUILADORES ===== */
(function initProduccionMenu(){
  var aside = document.querySelector('.left');
  if(!aside) return;
  if(document.querySelector('[data-root="produccion"]')) return;
  var btn = document.createElement('button');
  btn.className = 'side-item tree-btn';
  btn.setAttribute('data-root','produccion');
  btn.textContent = '🏭 Producción';
  var cat = document.querySelector('.left .tree-btn[data-root="catalogo"]');
  if(cat && cat.parentNode){ cat.parentNode.insertBefore(btn, cat); } else { aside.appendChild(btn); }
})();

/* ===== Extiende renderSubmenu para PRODUCCIÓN ===== */
(function patchRenderSubmenu(){
  var _orig = renderSubmenu;
  renderSubmenu = function(root){
    if(root !== 'produccion'){ _orig(root); return; }
    var host = qs('#subpanel'); if(!host) return; host.innerHTML='';
    var card = document.createElement('div'); card.className='card';
    var h2 = document.createElement('h2'); h2.textContent='Producción'; card.appendChild(h2);

    var actions = document.createElement('div'); actions.className='actions';
    var btnMaqui = document.createElement('button'); btnMaqui.className='btn'; btnMaqui.textContent='🧑‍🏭 Maquiladores';
    btnMaqui.addEventListener('click', function(){ renderMaquiladoresHome(); });
    actions.appendChild(btnMaqui);
    card.appendChild(actions);

    host.appendChild(card);
    renderMaquiladoresHome();
    ensureMobileToolbar && ensureMobileToolbar();
  };
})();

/* ===== Estado/persistencia ===== */
if(!DB.otsMaquila){ DB.otsMaquila = []; saveDB(DB); }
if(typeof DB.folioMaquila !== 'number'){ DB.folioMaquila = 0; saveDB(DB); }

/* ===== Home de Maquiladores ===== */
function renderMaquiladoresHome(){
  var host = qs('#subpanel'); if(!host) return;
  host.innerHTML = '';
  var card = document.createElement('div'); card.className='card';
  var h2 = document.createElement('h2'); h2.textContent='Maquiladores'; card.appendChild(h2);

  var actions = document.createElement('div'); actions.className='actions';
  var btnNew = document.createElement('button'); btnNew.className='btn-primary'; btnNew.textContent='+ Nueva OT';
  btnNew.addEventListener('click', function(){ abrirOTMaquilaNuevo(); });
  actions.appendChild(btnNew);

  var btnPend = document.createElement('button'); btnPend.className='btn-outline'; btnPend.textContent='OT pendientes';
  btnPend.addEventListener('click', function(){ listarOTMaquila(false); });
  actions.appendChild(btnPend);

  var btnCerr = document.createElement('button'); btnCerr.className='btn-outline'; btnCerr.textContent='OT cerradas';
  btnCerr.addEventListener('click', function(){ listarOTMaquila(true); });
  actions.appendChild(btnCerr);

  card.appendChild(actions);
  host.appendChild(card);
  listarOTMaquila(false);
}

/* ===== Crear / Listar OTs ===== */
function nuevoOTMaquilaBase(){
  DB.folioMaquila += 1;
  var id = 'M' + Date.now();
  var hoy = hoyStr();
  var prom = addDays(hoy, 15);
  var obj = {
    id: id,
    folio: DB.folioMaquila,
    fecha: hoy,
    hora: horaStr(),
    nombreMaquilador: '',
    promesaFecha: prom,
    promesaHora: '13:00',
    comentarios: '',
    mermaPactadaPct: 0,
    precioPorGramo: 0,
    precioPorPieza: 0,
    estimadoGr: 0,
    estimadoPzas: 0,
    evidencia: DB.evidencia || '',
    pedidoLineas: [ { descripcion:'', piezas:0, gramos:0, obs:'' } ],
    materiales: [ { materialId:'925', materialLibre:'', detalle:'', gramos:0, aleacion:0, subtotal:0, especificaciones:'' } ],
    extras: [ { material:'', piezas:0, gramos:0, obs:'' } ],
    recepcion: {
      fecha: hoy,
      hora: horaStr(),
      comentarios: '',
      lineas: [ { material:'terminado', detalle:'', gramos:0, piezas:0, obs:'' } ]
    },
    cerrado: false,
    totals: { gr999:0, gr925:0, grOtros:0 }
  };
  DB.otsMaquila.push(obj);
  saveDB(DB);
  return obj.id;
}

function listarOTMaquila(cerradas){
  var host = qs('#subpanel');
  var card = document.createElement('div'); card.className='card';
  var h2 = document.createElement('h2'); h2.textContent = cerradas ? 'OT cerradas' : 'OT pendientes';
  card.appendChild(h2);

  var lista = DB.otsMaquila.filter(function(x){ return !!x.cerrado === !!cerradas; }).sort(function(a,b){ return b.folio - a.folio; });
  if(lista.length === 0){
    var p = document.createElement('p'); p.textContent = 'Sin registros.'; card.appendChild(p);
    host.appendChild(card); return;
  }
  lista.forEach(function(m){
    var row = document.createElement('div'); row.className = 'actions';
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = 'OT '+String(m.folio).padStart(3,'0'); row.appendChild(pill);
    var btn = document.createElement('button'); btn.className='btn'; btn.textContent = cerradas ? 'Ver PDF' : 'Abrir / Procesar';
    btn.addEventListener('click', function(){ if(cerradas){ imprimirPDFMaquila(m,false); } else { abrirOTMaquilaExistente(m.id, true); } });
    row.appendChild(btn);
    card.appendChild(row);
  });
  host.appendChild(card);
}

/* ===== Abrir OT ===== */
function abrirOTMaquilaNuevo(){ var id = nuevoOTMaquilaBase(); abrirOTMaquilaExistente(id, false); }

function abrirOTMaquilaExistente(id, modoProcesar){
  var ot = DB.otsMaquila.find(function(x){ return x.id===id; });
  if(!ot){ toast('OT no encontrada'); return; }
  var titulo = 'Orden de trabajo ' + String(ot.folio).padStart(3,'0');

  openTab('otmaq-'+id, titulo, function(host){
    host.innerHTML = '';
    var card = document.createElement('div'); card.className='card';

    /* --- Barra maestra superior (extremo derecho) --- */
    var topbar = document.createElement('div');
    topbar.style.display = 'flex';
    topbar.style.justifyContent = 'flex-end';
    topbar.style.gap = '8px';
    topbar.style.marginBottom = '4px';

    var bVista = document.createElement('button'); bVista.className='btn'; bVista.textContent='👁️ Vista previa';
    bVista.title = 'Vista previa / PDF';
    bVista.addEventListener('click', function(){ imprimirPDFMaquila(ot, true); });
    topbar.appendChild(bVista);

    if(!modoProcesar){
      var bGuardar = document.createElement('button'); bGuardar.className='btn-primary'; bGuardar.textContent='💾 Guardar';
      bGuardar.addEventListener('click', function(){
        saveDB(DB);
        toast('OT guardada. Puedes procesarla en Producción → Maquiladores.');
        var view = qs('#view-otmaq-'+ot.id); if(view) view.remove();
        var tab = qs('[data-tab="otmaq-'+ot.id+'"]'); if(tab) tab.remove();
        renderMaquiladoresHome();
      });
      topbar.appendChild(bGuardar);
    } else if(!ot.cerrado){
      var bCerrar = document.createElement('button'); bCerrar.className='btn-primary'; bCerrar.textContent='💾 Guardar recepción / Cerrar';
      bCerrar.addEventListener('click', function(){ cerrarOTMaquila(ot); });
      topbar.appendChild(bCerrar);
    } else {
      var bPdf = document.createElement('button'); bPdf.className='btn'; bPdf.textContent='PDF final';
      bPdf.addEventListener('click', function(){ imprimirPDFMaquila(ot,false); });
      topbar.appendChild(bPdf);
    }
    card.appendChild(topbar);

    /* --- Encabezado + Resumen --- */
    var headerWrap = document.createElement('div'); headerWrap.className='grid';

    var dvLogo = document.createElement('div');
    var lbLogo = document.createElement('label'); lbLogo.textContent = 'ORDEN DE TRABAJO';
    var imgLogo = document.createElement('img'); imgLogo.src='/logo.webp'; imgLogo.alt='logo'; imgLogo.style.height='40px'; imgLogo.style.objectFit='contain';
    dvLogo.appendChild(lbLogo); dvLogo.appendChild(imgLogo);

    var dvFolio = document.createElement('div'); var lbFo = document.createElement('label'); lbFo.textContent='Folio';
    var inFo = document.createElement('input'); inFo.readOnly = true; inFo.value = String(ot.folio).padStart(3,'0'); inFo.style.color='#b91c1c';
    dvFolio.appendChild(lbFo); dvFolio.appendChild(inFo);

    var dvFecha = document.createElement('div'); var lbF = document.createElement('label'); lbF.textContent='Fecha';
    var inF = document.createElement('input'); inF.type='date'; inF.value=ot.fecha; inF.readOnly=!!modoProcesar; if(modoProcesar){ inF.classList.add('ro'); }
    inF.addEventListener('change', function(){ ot.fecha=inF.value; saveDB(DB); }); dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

    var dvMaq = document.createElement('div'); var lbM = document.createElement('label'); lbM.textContent='Nombre del maquilador';
    var inM = document.createElement('input'); inM.type='text'; inM.placeholder='Nombre completo'; inM.value=ot.nombreMaquilador; inM.readOnly=!!modoProcesar; if(modoProcesar){ inM.classList.add('ro'); }
    inM.addEventListener('input', function(){ ot.nombreMaquilador=inM.value; saveDB(DB); }); dvMaq.appendChild(lbM); dvMaq.appendChild(inM);

    var dvPromF = document.createElement('div'); var lbPF = document.createElement('label'); lbPF.textContent='Fecha promesa';
    var inPF = document.createElement('input'); inPF.type='date'; inPF.value=ot.promesaFecha; inPF.readOnly=!!modoProcesar; if(modoProcesar){ inPF.classList.add('ro'); }
    inPF.addEventListener('change', function(){ ot.promesaFecha=inPF.value; saveDB(DB); }); dvPromF.appendChild(lbPF); dvPromF.appendChild(inPF);

    var dvPromH = document.createElement('div'); var lbPH = document.createElement('label'); lbPH.textContent='Hora compromiso';
    var inPH = document.createElement('input'); inPH.type='time'; inPH.value=ot.promesaHora; inPH.readOnly=!!modoProcesar; if(modoProcesar){ inPH.classList.add('ro'); }
    inPH.addEventListener('change', function(){ ot.promesaHora=inPH.value; saveDB(DB); }); dvPromH.appendChild(lbPH); dvPromH.appendChild(inPH);

    var dvMer = document.createElement('div'); var lbMer = document.createElement('label'); lbMer.textContent='Merma pactada global (%)';
    var inMer = document.createElement('input'); inMer.type='number'; inMer.step='0.1'; inMer.min='0'; inMer.value=ot.mermaPactadaPct; inMer.readOnly=!!modoProcesar; if(modoProcesar){ inMer.classList.add('ro'); }
    inMer.addEventListener('input', function(){ ot.mermaPactadaPct=parseFloat(inMer.value||'0'); saveDB(DB); actualizarChips(); }); dvMer.appendChild(lbMer); dvMer.appendChild(inMer);

    var dvPG = document.createElement('div'); var lbPG = document.createElement('label'); lbPG.textContent='Precio pactado por gramo ($)';
    var inPG = document.createElement('input'); inPG.type='number'; inPG.step='0.01'; inPG.min='0'; inPG.value=ot.precioPorGramo; inPG.readOnly=!!modoProcesar; if(modoProcesar){ inPG.classList.add('ro'); }
    inPG.addEventListener('input', function(){ ot.precioPorGramo=parseFloat(inPG.value||'0'); saveDB(DB); actualizarChips(); }); dvPG.appendChild(lbPG); dvPG.appendChild(inPG);

    var dvPP = document.createElement('div'); var lbPP = document.createElement('label'); lbPP.textContent='Precio pactado por pieza ($)';
    var inPP = document.createElement('input'); inPP.type='number'; inPP.step='0.01'; inPP.min='0'; inPP.value=ot.precioPorPieza; inPP.readOnly=!!modoProcesar; if(modoProcesar){ inPP.classList.add('ro'); }
    inPP.addEventListener('input', function(){ ot.precioPorPieza=parseFloat(inPP.value||'0'); saveDB(DB); actualizarChips(); }); dvPP.appendChild(lbPP); dvPP.appendChild(inPP);

    var dvEG = document.createElement('div'); var lbEG = document.createElement('label'); lbEG.textContent='Grs estimados por entregar';
    var inEG = document.createElement('input'); inEG.type='number'; inEG.step='0.01'; inEG.min='0'; inEG.value=ot.estimadoGr; inEG.readOnly=!!modoProcesar; if(modoProcesar){ inEG.classList.add('ro'); }
    inEG.addEventListener('input', function(){ ot.estimadoGr=parseFloat(inEG.value||'0'); saveDB(DB); actualizarChips(); }); dvEG.appendChild(lbEG); dvEG.appendChild(inEG);

    var dvEP = document.createElement('div'); var lbEP = document.createElement('label'); lbEP.textContent='Pzs estimadas por entregar';
    var inEP = document.createElement('input'); inEP.type='number'; inEP.step='1'; inEP.min='0'; inEP.value=ot.estimadoPzas; inEP.readOnly=!!modoProcesar; if(modoProcesar){ inEP.classList.add('ro'); }
    inEP.addEventListener('input', function(){ ot.estimadoPzas=parseFloat(inEP.value||'0'); saveDB(DB); actualizarChips(); }); dvEP.appendChild(lbEP); dvEP.appendChild(inEP);

    var dvCom = document.createElement('div'); var lbC = document.createElement('label'); lbC.textContent='Comentarios (generales)';
    var txC = document.createElement('textarea'); txC.value=ot.comentarios; txC.readOnly=!!modoProcesar; if(modoProcesar){ txC.classList.add('ro'); }
    txC.addEventListener('input', function(){ ot.comentarios=txC.value; saveDB(DB); }); dvCom.appendChild(lbC); dvCom.appendChild(txC);

    headerWrap.appendChild(dvLogo);
    headerWrap.appendChild(dvFolio);
    headerWrap.appendChild(dvFecha);
    headerWrap.appendChild(dvMaq);
    headerWrap.appendChild(dvPromF);
    headerWrap.appendChild(dvPromH);
    headerWrap.appendChild(dvMer);
    headerWrap.appendChild(dvPG);
    headerWrap.appendChild(dvPP);
    headerWrap.appendChild(dvEG);
    headerWrap.appendChild(dvEP);
    headerWrap.appendChild(dvCom);
    card.appendChild(headerWrap);

    /* Evidencia global */
    var divEv = document.createElement('div'); divEv.className='actions';
    var cam = document.createElement('span'); cam.textContent='📷';
    var lbl = document.createElement('span'); lbl.textContent=' Cargar evidencia fotográfica (aplica a toda la OT)';
    var inFile = document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
    inFile.addEventListener('change', function(){
      if(inFile.files && inFile.files[0]){
        var r = new FileReader();
        r.onload = function(e){ ot.evidencia = e.target.result; saveDB(DB); toast('Foto cargada.'); };
        r.readAsDataURL(inFile.files[0]);
      }
    });
    divEv.appendChild(cam); divEv.appendChild(lbl); divEv.appendChild(inFile);
    card.appendChild(divEv);

    /* Chips / Resumen dinámico */
    var estadoWrap = document.createElement('div'); estadoWrap.className = 'estado-global'; card.appendChild(estadoWrap);
    var sumWrap = document.createElement('div'); sumWrap.className='actions'; sumWrap.style.flexWrap='wrap'; card.appendChild(sumWrap);

    function _is925(txt){
      var s = String(txt||'').toLowerCase();
      return s.indexOf('925')>-1 || s.indexOf('.925')>-1 || s.indexOf('plata 925')>-1 || s.indexOf('plata .925')>-1 || s.indexOf('sólida')>-1;
    }

    function actualizarChips(){
      var entGr = sumaSubtotales(ot.materiales);
      var g999=0, g925=0, gOtros=0;
      for(var i=0;i<ot.materiales.length;i++){
        var li = ot.materiales[i];
        var t = parseFloat(li.subtotal||0);
        if(li.materialId==='999'){ g999+=t; }
        else if(li.materialId==='925'){ g925+=t; }
        else { gOtros+=t; }
      }
      ot.totals.gr999=g999; ot.totals.gr925=g925; ot.totals.grOtros=gOtros;

      var manoEstim = (ot.estimadoGr*parseFloat(ot.precioPorGramo||0)) + (ot.estimadoPzas*parseFloat(ot.precioPorPieza||0));

      var devGr = 0, devGr925 = 0;
      if(ot.recepcion && ot.recepcion.lineas){
        for(var j=0;j<ot.recepcion.lineas.length;j++){
          var rl = ot.recepcion.lineas[j];
          var g = parseFloat(rl.gramos||0);
          devGr += g;
          if(_is925(rl.material) || _is925(rl.detalle)){ devGr925 += g; }
        }
      }
      var mermaRealAbs = devGr>0 ? Math.max(0, entGr - devGr) : 0;
      var mermaRealPct = devGr>0 && entGr>0 ? (mermaRealAbs/entGr)*100 : 0;

      estadoWrap.innerHTML='';
      var chips = [
        { t: 'Enviado: '+f2(entGr)+' g' },
        { t: 'Devuelto: '+(devGr>0?f2(devGr)+' g':'—') },
        { t: 'Dev .925: '+(devGr925>0?f2(devGr925)+' g':'—') },
        { t: 'Merma real: '+(devGr>0?f2(mermaRealAbs)+' g ('+mermaRealPct.toFixed(1)+'%)':'—') },
        { t: 'Merma pactada: '+f2(ot.mermaPactadaPct)+'%' },
        { t: '$/g: '+f2(ot.precioPorGramo), bold:true, c:'#0a3a74' },
        { t: '$/pz: '+f2(ot.precioPorPieza), bold:true, c:'#0a3a74' },
        { t: '$ Mano de obra estimada: '+f2(manoEstim), bold:true, c:'#0a3a74' }
      ];
      chips.forEach(function(ch){
        var s=document.createElement('span');
        s.className='estado-chip'+(ch.bold?' bold':'');
        s.textContent=ch.t;
        if(ch.c) s.style.color=ch.c;
        estadoWrap.appendChild(s);
      });

      sumWrap.innerHTML='';
      var a=document.createElement('span'); a.className='pill'; a.textContent='gr .999: '+f2(g999); sumWrap.appendChild(a);
      var b=document.createElement('span'); b.className='pill'; b.textContent='gr .925: '+f2(g925); sumWrap.appendChild(b);
      var c=document.createElement('span'); c.className='pill'; c.textContent='gr Otros: '+f2(gOtros); sumWrap.appendChild(c);
    }

    /* --- Detalle de pedido --- */
    var sec2 = document.createElement('div'); sec2.className='card';
    var h2b = document.createElement('h2'); h2b.textContent='Detalle de pedido'; sec2.appendChild(h2b);
    sec2.appendChild(tablaPedidoParaOT({
      lineas: ot.pedidoLineas,
      bloqueado: !!modoProcesar,
      onChange: function(){ saveDB(DB); }
    }));
    card.appendChild(sec2);

    /* --- Entrega de materiales --- */
    var sec3 = document.createElement('div'); sec3.className='card ot-sec3-wrap';
    var h3 = document.createElement('h2'); h3.textContent='Entrega de materiales'; sec3.appendChild(h3);
    sec3.appendChild(tablaMaterialesOT({
      lineas: ot.materiales,
      bloqueado: !!modoProcesar,
      onChange: function(){ saveDB(DB); actualizarChips(); }
    }));
    card.appendChild(sec3);

    /* --- Insumos y extras (informativo) --- */
    var sec4 = document.createElement('div'); sec4.className='card';
    var h4 = document.createElement('h2'); h4.textContent='Insumos y extras entregados (informativo)'; sec4.appendChild(h4);
    sec4.appendChild(tablaExtrasOT({
      lineas: ot.extras,
      bloqueado: !!modoProcesar,
      onChange: function(){ saveDB(DB); }
    }));
    card.appendChild(sec4);

    /* --- Recepción (solo procesar) --- */
    if(modoProcesar && !ot.cerrado){
      var sec5 = document.createElement('div'); sec5.className='card';
      var h5 = document.createElement('h2'); h5.textContent='Recepción del pedido'; sec5.appendChild(h5);

      var g = document.createElement('div'); g.className='grid';
      var d1 = document.createElement('div'); var l1 = document.createElement('label'); l1.textContent='Fecha recepción';
      var r1 = document.createElement('input'); r1.type='date'; r1.value=ot.recepcion.fecha; r1.addEventListener('change', function(){ ot.recepcion.fecha=r1.value; saveDB(DB); });
      d1.appendChild(l1); d1.appendChild(r1); g.appendChild(d1);

      var d2 = document.createElement('div'); var l2 = document.createElement('label'); l2.textContent='Hora recepción';
      var r2 = document.createElement('input'); r2.type='time'; r2.value=ot.recepcion.hora; r2.addEventListener('change', function(){ ot.recepcion.hora=r2.value; saveDB(DB); });
      d2.appendChild(l2); d2.appendChild(r2); g.appendChild(d2);

      var d6 = document.createElement('div'); var l6 = document.createElement('label'); l6.textContent='Comentarios recepción';
      var r6 = document.createElement('textarea'); r6.value=ot.recepcion.comentarios||''; r6.addEventListener('input', function(){ ot.recepcion.comentarios=r6.value; saveDB(DB); });
      d6.appendChild(l6); d6.appendChild(r6); g.appendChild(d6);
      sec5.appendChild(g);

      sec5.appendChild(tablaRecepcionOT({
        lineas: ot.recepcion.lineas,
        onChange: function(){ saveDB(DB); actualizarChips(); }
      }));
      card.appendChild(sec5);
    }

    host.appendChild(card);
    actualizarChips();
  });
}

/* ===== Tablas ===== */
function tablaPedidoParaOT(cfg){
  var wrap = document.createElement('div');
  var actions = document.createElement('div'); actions.className='actions';
  var hint = document.createElement('div'); hint.className='hint'; hint.textContent='(Qué le pido al maquilador)';
  actions.appendChild(hint);
  if(!cfg.bloqueado){
    var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar';
    var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
    actions.appendChild(bAdd); actions.appendChild(bDel);
    bAdd.addEventListener('click', function(){ cfg.lineas.push({ descripcion:'', piezas:0, gramos:0, obs:'' }); rebuild(); cfg.onChange&&cfg.onChange(); });
    bDel.addEventListener('click', function(){ if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); cfg.onChange&&cfg.onChange(); } });
  }
  wrap.appendChild(actions);

  var table=document.createElement('table'); var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Descripción','Piezas','Gramos','Observaciones'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');

  function rebuild(){
    tbody.innerHTML='';
    cfg.lineas.forEach(function(li){
      var tr=document.createElement('tr');

      var td1=document.createElement('td'); var in1=document.createElement('input'); in1.type='text'; in1.value=li.descripcion; if(cfg.bloqueado){ in1.classList.add('ro'); in1.readOnly=true; }
      in1.addEventListener('input', function(){ li.descripcion=in1.value; cfg.onChange&&cfg.onChange(); }); td1.appendChild(in1); tr.appendChild(td1);

      var td2=document.createElement('td'); var in2=document.createElement('input'); in2.type='number'; in2.step='1'; in2.min='0'; in2.value=li.piezas; if(cfg.bloqueado){ in2.classList.add('ro'); in2.readOnly=true; }
      in2.addEventListener('input', function(){ li.piezas=parseFloat(in2.value||'0'); cfg.onChange&&cfg.onChange(); }); td2.appendChild(in2); tr.appendChild(td2);

      var td3=document.createElement('td'); var in3=document.createElement('input'); in3.type='number'; in3.step='0.01'; in3.min='0'; in3.value=li.gramos; if(cfg.bloqueado){ in3.classList.add('ro'); in3.readOnly=true; }
      in3.addEventListener('input', function(){ li.gramos=parseFloat(in3.value||'0'); cfg.onChange&&cfg.onChange(); }); td3.appendChild(in3); tr.appendChild(td3);

      var td4=document.createElement('td'); var in4=document.createElement('input'); in4.type='text'; in4.value=li.obs||''; if(cfg.bloqueado){ in4.classList.add('ro'); in4.readOnly=true; }
      in4.addEventListener('input', function(){ li.obs=in4.value; cfg.onChange&&cfg.onChange(); }); td4.appendChild(in4); tr.appendChild(td4);

      tbody.appendChild(tr);
    });
  }
  rebuild();
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function tablaMaterialesOT(cfg){
  var wrap=document.createElement('div');
  var actions=document.createElement('div'); actions.className='actions';
  var bAdd,bDel; if(!cfg.bloqueado){ bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar'; bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última'; actions.appendChild(bAdd); actions.appendChild(bDel); }
  wrap.appendChild(actions);

  var table=document.createElement('table'); var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Material','Detalle','Gr','Aleación','.Subt','Especificaciones'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');

  function renderRow(li){
    var tr=document.createElement('tr');

    var tdMat=document.createElement('td');
    var sel=document.createElement('select');
    var opL=document.createElement('option'); opL.value='libre'; opL.textContent='Material libre...'; sel.appendChild(opL);
    MATERIALES.forEach(function(m){ var op=document.createElement('option'); op.value=m.id; op.textContent=m.nombre; if(m.id===li.materialId){ op.selected=true; } sel.appendChild(op); });
    sel.disabled=!!cfg.bloqueado;
    tdMat.appendChild(sel);

    var inLibre=document.createElement('input'); inLibre.type='text'; inLibre.placeholder='Describe el material'; inLibre.value=li.materialLibre||''; inLibre.style.marginTop='4px';
    inLibre.readOnly=!!cfg.bloqueado; if(cfg.bloqueado){ inLibre.classList.add('ro'); }
    if(li.materialId!=='libre'){ inLibre.style.display='none'; }
    inLibre.addEventListener('input', function(){ li.materialLibre=inLibre.value; saveDB(DB); });
    tdMat.appendChild(inLibre);
    tr.appendChild(tdMat);

    var tdDet=document.createElement('td'); var inDet=document.createElement('input'); inDet.type='text'; inDet.value=li.detalle; if(cfg.bloqueado){ inDet.classList.add('ro'); inDet.readOnly=true; }
    inDet.addEventListener('input', function(){ li.detalle=inDet.value; saveDB(DB); }); tdDet.appendChild(inDet); tr.appendChild(tdDet);

    var tdGr=document.createElement('td'); var inGr=document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.min='0'; inGr.value=li.gramos; if(cfg.bloqueado){ inGr.classList.add('ro'); inGr.readOnly=true; }
    inGr.addEventListener('input', function(){ li.gramos=parseFloat(inGr.value||'0'); if(li.materialId==='999' && !inAle.readOnly){ var sug=li.gramos*0.07; inAle.value=f2(sug); li.aleacion=parseFloat(inAle.value||'0'); } recalc(); });
    tdGr.appendChild(inGr); tr.appendChild(tdGr);

    var tdAle=document.createElement('td'); var inAle=document.createElement('input'); inAle.type='number'; inAle.step='0.01'; inAle.min='0'; inAle.value=li.aleacion; inAle.readOnly=(li.materialId!=='999') || !!cfg.bloqueado; if(inAle.readOnly){ inAle.classList.add('ro'); }
    inAle.addEventListener('input', function(){ li.aleacion=parseFloat(inAle.value||'0'); recalc(); }); tdAle.appendChild(inAle); tr.appendChild(tdAle);

    var tdSub=document.createElement('td'); var inSub=document.createElement('input'); inSub.readOnly=true; inSub.value=f2(li.subtotal); inSub.classList.add('ro'); tdSub.appendChild(inSub); tr.appendChild(tdSub);

    var tdEsp=document.createElement('td'); var inEsp=document.createElement('input'); inEsp.type='text'; inEsp.value=li.especificaciones||''; if(cfg.bloqueado){ inEsp.classList.add('ro'); inEsp.readOnly=true; }
    inEsp.addEventListener('input', function(){ li.especificaciones=inEsp.value; saveDB(DB); }); tdEsp.appendChild(inEsp); tr.appendChild(tdEsp);

    sel.addEventListener('change', function(){
      li.materialId = sel.value;
      if(li.materialId==='libre'){
        inLibre.style.display = 'block';
        li.aleacion = 0; inAle.value = '0.00'; inAle.readOnly = true; inAle.classList.add('ro');
      }else{
        inLibre.style.display = 'none';
        inAle.readOnly = (li.materialId!=='999') || !!cfg.bloqueado;
        if(inAle.readOnly){ inAle.classList.add('ro'); } else { inAle.classList.remove('ro'); }
      }
      recalc();
    });

    function recalc(){
      li.subtotal = (parseFloat(li.gramos||0) + parseFloat(li.aleacion||0));
      inSub.value = f2(li.subtotal);
      cfg.onChange && cfg.onChange();
      saveDB(DB);
    }

    tbody.appendChild(tr);
  }

  function rebuild(){ tbody.innerHTML=''; cfg.lineas.forEach(renderRow); }
  rebuild();

  if(bAdd){
    bAdd.addEventListener('click', function(){
      cfg.lineas.push({ materialId:'925', materialLibre:'', detalle:'', gramos:0, aleacion:0, subtotal:0, especificaciones:'' });
      rebuild(); cfg.onChange && cfg.onChange();
    });
  }
  if(bDel){
    bDel.addEventListener('click', function(){
      if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); cfg.onChange && cfg.onChange(); }
    });
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function tablaExtrasOT(cfg){
  var wrap=document.createElement('div');
  var actions=document.createElement('div'); actions.className='actions';
  var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar';
  var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
  actions.appendChild(bAdd); actions.appendChild(bDel);
  wrap.appendChild(actions);

  var table=document.createElement('table'); var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Material (libre)','Piezas','Gramos','Observaciones'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');

  function renderRow(li){
    var tr=document.createElement('tr');
    var td1=document.createElement('td'); var in1=document.createElement('input'); in1.type='text'; in1.value=li.material||''; in1.addEventListener('input', function(){ li.material=in1.value; cfg.onChange&&cfg.onChange(); }); td1.appendChild(in1); tr.appendChild(td1);
    var td2=document.createElement('td'); var in2=document.createElement('input'); in2.type='number'; in2.step='1'; in2.min='0'; in2.value=li.piezas||0; in2.addEventListener('input', function(){ li.piezas=parseFloat(in2.value||'0'); cfg.onChange&&cfg.onChange(); }); td2.appendChild(in2); tr.appendChild(td2);
    var td3=document.createElement('td'); var in3=document.createElement('input'); in3.type='number'; in3.step='0.01'; in3.min='0'; in3.value=li.gramos||0; in3.addEventListener('input', function(){ li.gramos=parseFloat(in3.value||'0'); cfg.onChange&&cfg.onChange(); }); td3.appendChild(in3); tr.appendChild(td3);
    var td4=document.createElement('td'); var in4=document.createElement('input'); in4.type='text'; in4.value=li.obs||''; in4.addEventListener('input', function(){ li.obs=in4.value; cfg.onChange&&cfg.onChange(); }); td4.appendChild(in4); tr.appendChild(td4);
    tbody.appendChild(tr);
  }

  function rebuild(){ tbody.innerHTML=''; cfg.lineas.forEach(renderRow); }
  rebuild();

  bAdd.addEventListener('click', function(){ cfg.lineas.push({ material:'', piezas:0, gramos:0, obs:'' }); rebuild(); cfg.onChange&&cfg.onChange(); });
  bDel.addEventListener('click', function(){ if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); cfg.onChange&&cfg.onChange(); } });

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function tablaRecepcionOT(cfg){
  var wrap=document.createElement('div');
  var actions=document.createElement('div'); actions.className='actions';
  var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar';
  var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
  actions.appendChild(bAdd); actions.appendChild(bDel);
  wrap.appendChild(actions);

  var table=document.createElement('table'); var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Material/Concepto','Detalle','Gramos','Piezas','Observaciones'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');

  function renderRow(li){
    var tr=document.createElement('tr');
    var td1=document.createElement('td'); var in1=document.createElement('input'); in1.type='text'; in1.value=li.material||''; in1.placeholder='terminado / sobrante / libre'; 
    in1.addEventListener('input', function(){ li.material=in1.value; cfg.onChange&&cfg.onChange(); }); td1.appendChild(in1); tr.appendChild(td1);

    var td2=document.createElement('td'); var in2=document.createElement('input'); in2.type='text'; in2.value=li.detalle||''; in2.addEventListener('input', function(){ li.detalle=in2.value; cfg.onChange&&cfg.onChange(); }); td2.appendChild(in2); tr.appendChild(td2);

    var td3=document.createElement('td'); var in3=document.createElement('input'); in3.type='number'; in3.step='0.01'; in3.min='0'; in3.value=li.gramos||0; in3.addEventListener('input', function(){ li.gramos=parseFloat(in3.value||'0'); cfg.onChange&&cfg.onChange(); }); td3.appendChild(in3); tr.appendChild(td3);

    var td4=document.createElement('td'); var in4=document.createElement('input'); in4.type='number'; in4.step='1'; in4.min='0'; in4.value=li.piezas||0; in4.addEventListener('input', function(){ li.piezas=parseFloat(in4.value||'0'); cfg.onChange&&cfg.onChange(); }); td4.appendChild(in4); tr.appendChild(td4);

    var td5=document.createElement('td'); var in5=document.createElement('input'); in5.type='text'; in5.value=li.obs||''; in5.addEventListener('input', function(){ li.obs=in5.value; cfg.onChange&&cfg.onChange(); }); td5.appendChild(in5); tr.appendChild(td5);

    tbody.appendChild(tr);
  }

  function rebuild(){ tbody.innerHTML=''; cfg.lineas.forEach(renderRow); }
  rebuild();

  bAdd.addEventListener('click', function(){ cfg.lineas.push({ material:'terminado', detalle:'', gramos:0, piezas:0, obs:'' }); rebuild(); cfg.onChange&&cfg.onChange(); });
  bDel.addEventListener('click', function(){ if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); cfg.onChange&&cfg.onChange(); } });

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ===== Cierre OT ===== */
function cerrarOTMaquila(ot){
  var devGr = 0;
  if(ot.recepcion && ot.recepcion.lineas){
    for(var i=0;i<ot.recepcion.lineas.length;i++){ devGr += parseFloat(ot.recepcion.lineas[i].gramos||0); }
  }
  var entGr = sumaSubtotales(ot.materiales);
  if(devGr<=0){ alert('Captura la devolución (líneas con gramos devueltos).'); return; }

  var mermaAbs = Math.max(0, entGr - devGr);
  var mermaPct = entGr>0 ? (mermaAbs/entGr) : 0;
  var pact = parseFloat(ot.mermaPactadaPct||0)/100;
  if(mermaPct>pact){
    var ok = confirm('La merma real ('+(mermaPct*100).toFixed(1)+'%) excede la pactada ('+(pact*100).toFixed(1)+'%). ¿Cerrar de todos modos?');
    if(!ok) return;
  }

  ot.cerrado = true;
  saveDB(DB);
  toast('OT cerrada');
  imprimirPDFMaquila(ot, false);
}

/* ===== PDF (Blob; suma dev .925) ===== */
function imprimirPDFMaquila(ot, isDraft){
  // Totales enviados
  var entGr = sumaSubtotales(ot.materiales);
  var g999=0, g925=0, gOtros=0;
  for(var i=0;i<ot.materiales.length;i++){
    var li = ot.materiales[i];
    var t = parseFloat(li.subtotal||0);
    if(li.materialId==='999'){ g999+=t; }
    else if(li.materialId==='925'){ g925+=t; }
    else { gOtros+=t; }
  }

  // Devueltos (incluye .925 por heurística)
  function _is925(txt){
    var s = String(txt||'').toLowerCase();
    return s.indexOf('925')>-1 || s.indexOf('.925')>-1 || s.indexOf('plata 925')>-1 || s.indexOf('plata .925')>-1 || s.indexOf('sólida')>-1;
  }
  var devGr = 0, devGr925 = 0;
  if(ot.recepcion && ot.recepcion.lineas){
    for(var j=0;j<ot.recepcion.lineas.length;j++){
      var rl = ot.recepcion.lineas[j];
      var g = parseFloat(rl.gramos||0);
      devGr += g;
      if(_is925(rl.material) || _is925(rl.detalle)){ devGr925 += g; }
    }
  }
  var mermaAbs = devGr>0 ? Math.max(0, entGr - devGr) : 0;
  var mermaPct = devGr>0 && entGr>0 ? (mermaAbs/entGr)*100 : 0;

  var diasTrans=0;
  try{
    var f1=new Date(ot.fecha);
    var f2=new Date(ot.recepcion && ot.recepcion.fecha ? ot.recepcion.fecha : ot.fecha);
    diasTrans = Math.round((f2 - f1) / (1000*60*60*24));
  }catch(e){}

  var manoEstim = (ot.estimadoGr*parseFloat(ot.precioPorGramo||0)) + (ot.estimadoPzas*parseFloat(ot.precioPorPieza||0));

  var css='@page{size:5.5in 8.5in;margin:8mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:11px;}h1{color:#0a2c4c;margin:4px 0}h2{color:#0a2c4c;margin:2px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:3px 4px;word-break:break-word}thead tr{background:#e7effa}.row{display:flex;gap:6px;margin:4px 0}.col{flex:1}.chips{margin:6px 0}.chip{background:#f1f5f9;border-radius:14px;padding:4px 8px;font-size:10px;margin-right:4px;font-weight:700}.signs{display:flex;gap:10px;margin-top:10px}.signs .b{flex:1;border-top:1px solid #94a3b8;padding-top:6px;text-align:center}.water{position:fixed;top:40%;left:16%;font-size:42px;color:#94a3b880;transform:rotate(-18deg);}';

  var H=[];
  H.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>OT '+String(ot.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
  if(isDraft){ H.push('<div class="water">BORRADOR</div>'); }

  H.push('<div class="row"><div class="col" style="max-width:120px"><img src="/logo.webp" alt="logo" style="max-width:100%;max-height:60px;object-fit:contain"></div><div class="col"><h1>ORDEN DE TRABAJO</h1></div></div>');
  H.push('<div class="row"><div class="col"><b>Folio:</b> '+String(ot.folio).padStart(3,'0')+'</div><div class="col"><b>Fecha:</b> '+ot.fecha+' '+ot.hora+'</div><div class="col"><b>Maquilador:</b> '+escapeHTML(ot.nombreMaquilador)+'</div></div>');
  H.push('<div class="row"><div class="col"><b>Promesa:</b> '+ot.promesaFecha+' '+ot.promesaHora+'</div><div class="col"><b>Merma pactada:</b> '+f2(ot.mermaPactadaPct)+'%</div><div class="col"><b>$ /g:</b> '+f2(ot.precioPorGramo)+'  <b>$ /pz:</b> '+f2(ot.precioPorPieza)+'</div><div class="col"><b>$ estimado:</b> '+f2(manoEstim)+'</div></div>');
  if(ot.evidencia){ H.push('<div class="row"><div class="col"><b>Evidencia:</b><br><img src="'+ot.evidencia+'" style="max-width:100%;max-height:120px;border:1px solid #cbd5e1"></div></div>'); }

  H.push('<div class="chips">');
  H.push('<span class="chip">Enviado: '+f2(entGr)+' g</span>');
  H.push('<span class="chip">Devuelto: '+(devGr>0?f2(devGr)+' g':'—')+'</span>');
  H.push('<span class="chip">Dev .925: '+(devGr925>0?f2(devGr925)+' g':'—')+'</span>');
  H.push('<span class="chip">Merma real: '+(devGr>0?f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)':'—')+'</span>');
  H.push('<span class="chip">gr .999: '+f2(g999)+'</span><span class="chip">gr .925: '+f2(g925)+'</span><span class="chip">gr Otros: '+f2(gOtros)+'</span>');
  H.push('</div>');

  // Detalle de pedido
  H.push('<h2>Detalle de pedido</h2><table><thead><tr><th>Descripción</th><th>Piezas</th><th>Gramos</th><th>Observaciones</th></tr></thead><tbody>');
  (ot.pedidoLineas||[]).forEach(function(p){
    H.push('<tr><td>'+escapeHTML(p.descripcion||'')+'</td><td>'+f2(p.piezas||0)+'</td><td>'+f2(p.gramos||0)+'</td><td>'+escapeHTML(p.obs||'')+'</td></tr>');
  });
  H.push('</tbody></table>');

  // Entrega de materiales
  H.push('<h2>Entrega de materiales</h2><table><thead><tr><th>Material</th><th>Detalle</th><th>Gr</th><th>Aleac.</th><th>Subt</th><th>Especificaciones</th></tr></thead><tbody>');
  (ot.materiales||[]).forEach(function(li){
    var mat = li.materialId==='libre' ? (li.materialLibre||'Libre') : nombreMaterial(li.materialId);
    H.push('<tr><td>'+escapeHTML(mat)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos||0)+'</td><td>'+f2(li.aleacion||0)+'</td><td>'+f2(li.subtotal||0)+'</td><td>'+escapeHTML(li.especificaciones||'')+'</td></tr>');
  });
  H.push('</tbody></table>');

  // Insumos y extras
  H.push('<h2>Insumos y extras entregados (informativo)</h2><table><thead><tr><th>Material</th><th>Piezas</th><th>Gramos</th><th>Observaciones</th></tr></thead><tbody>');
  (ot.extras||[]).forEach(function(ex){
    H.push('<tr><td>'+escapeHTML(ex.material||'')+'</td><td>'+f2(ex.piezas||0)+'</td><td>'+f2(ex.gramos||0)+'</td><td>'+escapeHTML(ex.obs||'')+'</td></tr>');
  });
  H.push('</tbody></table>');

  // Recepción
  if(ot.cerrado || (ot.recepcion && ot.recepcion.lineas && ot.recepcion.lineas.length>0)){
    H.push('<h2>Recepción del pedido</h2>');
    H.push('<div class="row"><div class="col"><b>Fecha recepción:</b> '+(ot.recepcion&&ot.recepcion.fecha?ot.recepcion.fecha:'')+'</div><div class="col"><b>Días transcurridos:</b> '+diasTrans+'</div></div>');
    H.push('<table><thead><tr><th>Material/Concepto</th><th>Detalle</th><th>Gramos</th><th>Piezas</th><th>Observaciones</th></tr></thead><tbody>');
    (ot.recepcion.lineas||[]).forEach(function(rl){
      H.push('<tr><td>'+escapeHTML(rl.material||'')+'</td><td>'+escapeHTML(rl.detalle||'')+'</td><td>'+f2(rl.gramos||0)+'</td><td>'+f2(rl.piezas||0)+'</td><td>'+escapeHTML(rl.obs||'')+'</td></tr>');
    });
    H.push('</tbody></table>');
  }

  // Firmas + Leyenda
  H.push('<div class="row"><div class="col"><b>Comentarios:</b> '+escapeHTML(ot.comentarios||'')+'</div></div>');
  H.push('<div class="signs"><div class="b">Nombre y firma MAQUILADOR</div><div class="b">Nombre y firma QUIEN ENTREGA</div></div>');
  H.push('<div style="margin-top:8px;font-size:10px;line-height:1.25"><b>RECONOCIMIENTO DE RECEPCIÓN Y OBLIGACIONES DEL MAQUILADOR.</b> Yo, ___________________________, con domicilio en _______________, declaro que recibí en depósito mercantil los materiales descritos en esta ORDEN DE TRABAJO (Folio '+String(ot.folio).padStart(3,'0')+'), obligándome a su conservación y devolución en la fecha promesa, en las cantidades y calidades indicadas, realizándose únicamente los procesos descritos. Soy responsable por menoscabos, daños o pérdidas causados por malicia o negligencia. En caso de faltante a la entrega (gramos o piezas no devueltos), pagaré su valor conforme al precio pactado y una pena convencional equivalente al ____% del valor del faltante. Asimismo, reconozco adeudar el precio pactado por los procesos: $/g '+f2(ot.precioPorGramo)+' y $/pz '+f2(ot.precioPorPieza)+', pagadero a la entrega. <b>Beneficiario:</b> ARTURO EMMANUEL ROMERO MARTINEZ.</div>');

  H.push('</body></html>');

  // OPEN via Blob (evita ventanas en blanco en algunos navegadores)
  var html = H.join('');
  var blob = new Blob([html], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  var w = window.open(url, '_blank', 'width=840,height=900');
  if(!w){ alert('Permite pop-ups.'); }
}

/* ===== FIN MÓDULO MAQUILADORES v2.8.0 ===== */

/* ================================================================
   ADMINISTRACIÓN v1.6 — Gastos + Conciliación (negativos OK)
   ➜ Pegar DENTRO del IIFE de app.js, justo antes del último `})();`
================================================================ */

/* ---------- PARCHE: clic en pestañas activa su vista ---------- */
(function fixTabClicksOnce(){
  var tabsHost = document.getElementById('tabs');
  if(!tabsHost || tabsHost.__patchedAdmin) return;
  tabsHost.__patchedAdmin = true;
  tabsHost.addEventListener('click', function(e){
    var tab = e.target.closest('.tab');
    if(!tab || e.target.classList.contains('x')) return;
    var id = tab.getAttribute('data-tab'); if(!id) return;
    Array.prototype.forEach.call(tabsHost.querySelectorAll('.tab'), function(t){ t.classList.remove('active'); });
    tab.classList.add('active');
    var viewsHost = document.getElementById('views');
    Array.prototype.forEach.call(viewsHost.querySelectorAll('.view'), function(v){ v.classList.remove('active'); });
    var v = document.getElementById('view-'+id);
    if(v) v.classList.add('active');
  });
})();

/* ------------------- Estado / Persistencia Admin ------------------- */
(function ensureAdminState(){
  if(!DB.admin){
    DB.admin = {
      consecutivoGasto: 0,
      consecutivoConc: 0,
      gastos: [],
      ingresos: [],
      conciliaciones: [],
      cuentas: [
        { id:'caja_plata',   nombre:'Caja de Plata', saldo:0 },
        { id:'caja_general', nombre:'Caja General',  saldo:0 },
        { id:'banco_mxn',    nombre:'Banco MXN',     saldo:0 }
      ],
      cuentasContables: [
        { id:'renta',         nombre:'Renta' },
        { id:'servicios',     nombre:'Servicios (luz/agua/internet)' },
        { id:'intereses',     nombre:'Intereses' },
        { id:'papeleria',     nombre:'Papelería' },
        { id:'mantenimiento', nombre:'Mantenimiento' },
        { id:'honorarios',    nombre:'Honorarios' },
        { id:'transporte',    nombre:'Transporte / Envíos' },
        { id:'viaticos',      nombre:'Viáticos' },
        { id:'publicidad',    nombre:'Publicidad / Marketing' },
        { id:'otros',         nombre:'Otros gastos' }
      ]
    };
    saveDB(DB);
  } else {
    DB.admin.gastos.forEach(function(g){ if(typeof g.bloqueado!=='boolean') g.bloqueado=false; });
    if(!Array.isArray(DB.admin.ingresos)) DB.admin.ingresos = [];
    if(!Array.isArray(DB.admin.conciliaciones)) DB.admin.conciliaciones = [];
    if(typeof DB.admin.consecutivoConc!=='number') DB.admin.consecutivoConc = 0;
    saveDB(DB);
  }
})();

/* --------------------- Utilidades locales Admin --------------------- */
function moneyFmt(n){ return '$ ' + (Number(n||0)).toFixed(2); }
function moneyParse(s){
  if(typeof s === 'number') return s;
  var raw = String(s||'').replace(/\s/g,'');
  // Permitir prefijo $ y coma como separador de miles; preservar signo negativo
  raw = raw.replace(/^\$/, '').replace(/,/g,'');
  var n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}
function nextGastoId(){ DB.admin.consecutivoGasto+=1; saveDB(DB); return 'G'+Date.now()+'-'+DB.admin.consecutivoGasto; }
function nextConcFolio(){ DB.admin.consecutivoConc+=1; saveDB(DB); return DB.admin.consecutivoConc; }
function nextId(prefix){ return (prefix||'X')+Date.now()+Math.floor(Math.random()*1000); }
function ctaNombre(id){ var c=DB.admin.cuentas.find(function(x){return x.id===id;}); return c?c.nombre:'—'; }
function ctaContNombre(id){ var c=DB.admin.cuentasContables.find(function(x){return x.id===id;}); return c?c.nombre:'—'; }

/* Semáforo (gasto): verde cuando campos obligatorios completos */
function gastoSemaforo(g){
  var okMonto = Number(g.monto||0) !== 0; // permitir negativos, pero ≠ 0
  var okCC    = !!g.cuentaContableId;
  if(!okMonto || !okCC) return {icon:'🔴', color:'#ef4444', label:'Incompleto'};
  return {icon:'🟢', color:'#16a34a', label:'Completo'};
}
function semaforoPanelRight(status){
  var box=document.createElement('div');
  box.style.marginLeft='auto';
  box.style.display='flex';
  box.style.alignItems='center';
  box.style.gap='8px';
  var ico=document.createElement('span'); ico.textContent=status.icon; ico.style.fontSize='21px';
  var lbl=document.createElement('b'); lbl.textContent=status.label; lbl.style.color=status.color;
  box.appendChild(ico); box.appendChild(lbl);
  return box;
}

/* ---------- Lógica de conciliación (flujo B clásico) ---------- */
function lastConciliacionBefore(cuentaId, fechaISO){
  var lst = DB.admin.conciliaciones
    .filter(function(c){ return c.cuentaId===cuentaId && c.hasta && c.hasta < fechaISO; })
    .sort(function(a,b){ return (b.hasta||'').localeCompare(a.hasta||''); });
  return lst[0] || null;
}
function movimientosIngresosEnPeriodo(cuentaId, desde, hasta){
  return DB.admin.ingresos.filter(function(m){ return m.cuentaId===cuentaId && m.fecha>=desde && m.fecha<=hasta; });
}
function movimientosGastosEnPeriodo(cuentaId, desde, hasta){
  return DB.admin.gastos.filter(function(g){
    if(g.tipo!=='pagado') return false;
    if(g.cuentaId!==cuentaId) return false;
    return (g.fecha>=desde && g.fecha<=hasta);
  });
}

/* ---------------------- Inyector botón lateral ---------------------- */
(function injectAdminButton(){
  var aside = document.querySelector('.left');
  if(!aside) return;
  if(aside.querySelector('[data-root="administracion"], [data-root="Administración"], [data-root="admin"]')) return;

  var btn = document.createElement('button');
  btn.className = 'side-item tree-btn';
  btn.setAttribute('data-root','administracion');
  btn.textContent = '🗄️ Administración';

  btn.addEventListener('click', function(){
    Array.prototype.forEach.call(document.querySelectorAll('.tree-btn'), function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    renderSubmenu('administracion');
  });

  var ref = aside.querySelector('.tree-btn[data-root="catalogo"]');
  if(ref && ref.parentNode){ ref.parentNode.insertBefore(btn, ref); }
  else { aside.appendChild(btn); }
})();

/* ----------------- renderSubmenu (parche Administración) ----------------- */
(function patchRenderSubmenu_Admin(){
  var _orig = renderSubmenu;
  renderSubmenu = function(root){
    var r = String(root||'').toLowerCase();
    if(r!=='admin' && r!=='administracion' && r!=='administración'){ _orig(root); return; }

    var host = qs('#subpanel'); if(!host) return;
    host.innerHTML = '';

    var card = document.createElement('div'); card.className='card';
    var h2 = document.createElement('h2'); h2.textContent = 'Administración'; card.appendChild(h2);

    var list = document.createElement('div'); list.className='actions';
    list.style.flexDirection='column'; list.style.alignItems='stretch';

    function nodeBtn(txt, icon, fn){
      var b = document.createElement('button'); b.className='btn'; b.style.justifyContent='flex-start';
      b.innerHTML = icon+' '+txt;
      b.addEventListener('click', fn);
      return b;
    }

    list.appendChild(nodeBtn('Gastos',                 '💸', function(){ adminGastos(); }));
    list.appendChild(nodeBtn('Conciliación de Cajas',  '🧾', function(){ adminConciliacion(); }));
    list.appendChild(nodeBtn('Estado de Resultados',   '📑', function(){ adminER(); }));
    list.appendChild(nodeBtn('Dashboard',              '📊', function(){ adminDashboard(); }));

    card.appendChild(list);
    host.appendChild(card);

    adminGastos();
  };
})();

/* ============================= SUBMÓDULOS ============================= */

/* ------------------ Estado de Resultados / Dashboard (placeholder) ------------------ */
function adminER(){
  openTab('admin-er','Admin · Estado de Resultados', function(host){
    host.innerHTML='';
    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Estado de Resultados'; c.appendChild(h);
    var p=document.createElement('p'); p.textContent='(Quincenas/periodos; integraremos ventas y gastos)'; c.appendChild(p);
    host.appendChild(c);
  });
}
function adminDashboard(){
  openTab('admin-dash','Admin · Dashboard', function(host){
    host.innerHTML='';
    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Dashboard Administrativo'; c.appendChild(h);
    var p=document.createElement('p'); p.textContent='(KPIs próximamente)'; c.appendChild(p);
    host.appendChild(c);
  });
}

/* -------------------- GASTOS: listado + alta/edición -------------------- */
function adminGastos(){
  openTab('admin-gastos','Admin · Gastos', function(host){
    host.innerHTML='';

    var c = document.createElement('div'); c.className='card';

    // Topbar LISTA: izq vacía / der +Registrar
    var topbar = document.createElement('div'); topbar.className='actions';
    var left = document.createElement('div'); left.style.display='flex'; left.style.gap='8px'; topbar.appendChild(left);
    var right = document.createElement('div'); right.style.marginLeft='auto';
    var bNew=document.createElement('button'); bNew.className='btn-primary'; bNew.textContent='+ Registrar gasto';
    bNew.addEventListener('click', function(){ adminGastoNuevo(); });
    right.appendChild(bNew);
    topbar.appendChild(right);
    c.appendChild(topbar);

    // Filtros
    var g=document.createElement('div'); g.className='grid';
    var f1=document.createElement('div'); var l1=document.createElement('label'); l1.textContent='Fecha inicio'; var i1=document.createElement('input'); i1.type='date'; f1.appendChild(l1); f1.appendChild(i1); g.appendChild(f1);
    var f2=document.createElement('div'); var l2=document.createElement('label'); l2.textContent='Fecha fin';    var i2=document.createElement('input'); i2.type='date'; f2.appendChild(l2); f2.appendChild(i2); g.appendChild(f2);
    var f3=document.createElement('div'); var l3=document.createElement('label'); l3.textContent='Tipo';        var s3=document.createElement('select'); [['','TODOS'],['pagado','Pagado'],['por_pagar','Por pagar'],['recurrente','Recurrente']].forEach(function(p){ var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; s3.appendChild(op); }); f3.appendChild(l3); f3.appendChild(s3); g.appendChild(f3);

    // Cuenta + botón Buscar (azul) a la derecha del selector
    var f4=document.createElement('div'); var l4=document.createElement('label'); l4.textContent='Cuenta';
    var s4=document.createElement('select'); var opAll=document.createElement('option'); opAll.value=''; opAll.textContent='Todas las cuentas'; s4.appendChild(opAll);
    DB.admin.cuentas.forEach(function(cu){ var op=document.createElement('option'); op.value=cu.id; op.textContent=cu.nombre; s4.appendChild(op); });
    var bFil=document.createElement('button'); bFil.className='btn'; bFil.textContent='Buscar';
    bFil.style.marginLeft='8px'; bFil.style.background='#0a3a74'; bFil.style.color='#fff'; bFil.style.border='1px solid #0a3a74';
    var wrapCta=document.createElement('div'); wrapCta.style.display='flex'; wrapCta.style.alignItems='end';
    wrapCta.appendChild(s4); wrapCta.appendChild(bFil);
    f4.appendChild(l4); f4.appendChild(wrapCta); g.appendChild(f4);

    c.appendChild(g);

    // Tabla
    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Tipo','Cuenta pago','Cuenta contable','Monto','Estatus',''].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl);

    function pinta(){
      tbody.innerHTML='';
      var rows = DB.admin.gastos.slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
      rows.forEach(function(gst){
        var ok=true;
        if(i1.value){ ok=ok && gst.fecha>=i1.value; }
        if(i2.value){ ok=ok && gst.fecha<=i2.value; }
        if(s3.value){ ok=ok && gst.tipo===s3.value; }
        if(s4.value){ ok=ok && gst.cuentaId===s4.value; }
        if(!ok) return;

        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ adminGastoAbrir(gst.id); });
        function tdHTML(html){ var d=document.createElement('td'); d.innerHTML=html; return d; }
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }

        var sem=gastoSemaforo(gst);

        tr.appendChild(td(String(gst.folio||0).toString().padStart(3,'0')));
        tr.appendChild(td(gst.fecha||'—'));
        tr.appendChild(td(gst.tipo||'—'));
        tr.appendChild(td(ctaNombre(gst.cuentaId)));
        tr.appendChild(td(ctaContNombre(gst.cuentaContableId)));
        tr.appendChild(tdHTML('<b style="color:#b45309">'+moneyFmt(gst.monto||0)+'</b>'));
        tr.appendChild(td(sem.label));
        var tdSem=document.createElement('td'); tdSem.style.textAlign='right'; tdSem.textContent=sem.icon; tdSem.title=sem.label; tdSem.style.fontSize='18px';
        tr.appendChild(tdSem);

        tbody.appendChild(tr);
      });
    }
    bFil.addEventListener('click', pinta);
    pinta();

    host.appendChild(c);
  });
}

/* ------------------------ Alta / Edición de Gasto ------------------------ */
function adminGastoNuevo(){
  var g={
    id: nextGastoId(),
    folio: DB.admin.consecutivoGasto,
    ts: Date.now(),
    tipo: 'pagado',          // pagado | por_pagar | recurrente
    fecha: hoyStr(),
    cuentaId: '',            // obligatoria si “pagado”
    cuentaContableId: '',    // obligatoria
    monto: 0,
    bloqueado: false,        // se vuelve true al guardar
    // por pagar
    fechaDevengo: '',
    pagado: false,
    // recurrente
    periodicidad: 'mensual',
    diaMes: 1,
    diaSemana: 'viernes',
    cadaDias: 30,
    evidencia: ''
  };
  DB.admin.gastos.push(g); saveDB(DB);
  adminGastoAbrir(g.id);
}

function adminGastoAbrir(id){
  var g = DB.admin.gastos.find(function(x){ return x.id===id; });
  if(!g) return;

  openTab('admin-gasto-'+g.id, 'Registrar nuevo gasto', function(host){
    host.innerHTML='';

    var card=document.createElement('div'); card.className='card';

    // ======= Toolbar superior =======
    var tb=document.createElement('div'); tb.className='actions'; card.appendChild(tb);

    // IZQ: [Nuevo gasto][Imprimir][WhatsApp]
    var left=document.createElement('div'); left.style.display='flex'; left.style.gap='8px';
    var bNuevo=document.createElement('button'); bNuevo.className='btn'; bNuevo.textContent='Nuevo gasto';
    bNuevo.addEventListener('click', function(){ adminGastoNuevo(); });
    var bImp=document.createElement('button'); bImp.className='btn'; bImp.textContent='🖨️ Imprimir';
    bImp.addEventListener('click', function(){ adminGastoImprimir(g); });
    var bWA=document.createElement('button'); bWA.className='btn'; bWA.textContent='WhatsApp';
    bWA.addEventListener('click', function(){ adminGastoWhatsApp(g); });
    left.appendChild(bNuevo); left.appendChild(bImp); left.appendChild(bWA);
    tb.appendChild(left);

    // DER: [GUARDAR] o [✏️ Editar]
    var right=document.createElement('div'); right.style.marginLeft='auto';
    var bGuardar=document.createElement('button'); bGuardar.textContent='GUARDAR'; bGuardar.className='btn-primary';
    var bEditar=document.createElement('button'); bEditar.textContent='✏️ Editar'; bEditar.className='btn-warn';
    function renderRight(){
      right.innerHTML='';
      if(g.bloqueado){ right.appendChild(bEditar); }
      else { right.appendChild(bGuardar); }
    }
    bGuardar.addEventListener('click', function(){
      if(!g.cuentaContableId){ alert('Selecciona la cuenta contable.'); return; }
      if(Number(g.monto||0)===0){ alert('Captura un monto distinto de cero (se permiten negativos).'); return; }
      if(g.tipo==='pagado' && !g.cuentaId){ alert('En “Pagado”, la cuenta de pago es obligatoria.'); return; }
      g.bloqueado=true; saveDB(DB);
      alert('Gasto guardado con éxito. Folio '+String(g.folio).toString().padStart(3,'0'));
      renderRight();
      renderLockState();
      refreshSem();
    });
    bEditar.addEventListener('click', function(){
      g.bloqueado=false; saveDB(DB);
      renderRight();
      renderLockState();
      refreshSem();
    });
    renderRight();
    tb.appendChild(right);

    // ======= Encabezado + Semáforo a la derecha =======
    var headRow=document.createElement('div'); headRow.style.display='flex'; headRow.style.gap='12px'; headRow.style.alignItems='flex-start';
    var head=document.createElement('div'); head.className='grid'; head.style.flex='1';

    // Tipo
    var dT=document.createElement('div'); var lT=document.createElement('label'); lT.textContent='Tipo de gasto';
    var sT=document.createElement('select'); [['pagado','Pagado'],['por_pagar','Por pagar'],['recurrente','Recurrente']].forEach(function(p){ var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(g.tipo===p[0]) op.selected=true; sT.appendChild(op); });
    sT.addEventListener('change', function(){ g.tipo=sT.value; saveDB(DB); renderVars(); refreshSem(); });
    dT.appendChild(lT); dT.appendChild(sT); head.appendChild(dT);

    // Fecha
    var dF=document.createElement('div'); var lF=document.createElement('label'); lF.textContent='Fecha';
    var iF=document.createElement('input'); iF.type='date'; iF.value=g.fecha||hoyStr(); iF.addEventListener('change', function(){ g.fecha=iF.value; saveDB(DB); });
    dF.appendChild(lF); dF.appendChild(iF); head.appendChild(dF);

    // Cuenta pago
    var dC=document.createElement('div'); var lC=document.createElement('label'); lC.textContent='Cuenta de pago';
    var sC=document.createElement('select'); var opV=document.createElement('option'); opV.value=''; opV.textContent='(Selecciona)'; sC.appendChild(opV);
    DB.admin.cuentas.forEach(function(cu){ var op=document.createElement('option'); op.value=cu.id; op.textContent=cu.nombre; if(g.cuentaId===cu.id) op.selected=true; sC.appendChild(op); });
    sC.addEventListener('change', function(){ g.cuentaId=sC.value; saveDB(DB); refreshSem(); });
    dC.appendChild(lC); dC.appendChild(sC); head.appendChild(dC);

    // Cuenta contable
    var dCC=document.createElement('div'); var lCC=document.createElement('label'); lCC.textContent='Cuenta contable';
    var sCC=document.createElement('select'); var op0=document.createElement('option'); op0.value=''; op0.textContent='(Selecciona)'; sCC.appendChild(op0);
    DB.admin.cuentasContables.forEach(function(cc){ var op=document.createElement('option'); op.value=cc.id; op.textContent=cc.nombre; if(g.cuentaContableId===cc.id) op.selected=true; sCC.appendChild(op); });
    sCC.addEventListener('change', function(){ g.cuentaContableId=sCC.value; saveDB(DB); refreshSem(); });
    dCC.appendChild(lCC); dCC.appendChild(sCC); head.appendChild(dCC);

    // Monto: acepta negativos; formatea SOLO en blur
    var dM=document.createElement('div'); var lM=document.createElement('label'); lM.textContent='Monto';
    var iM=document.createElement('input'); iM.type='text'; iM.value=moneyFmt(g.monto||0); iM.style.fontWeight='800'; iM.style.color='#059669';
    iM.addEventListener('input', function(){
      // No forzar formato; permitir "-", "-.", etc.
      g.monto = moneyParse(iM.value);
      saveDB(DB); refreshSem();
    });
    iM.addEventListener('blur', function(){
      iM.value = moneyFmt(moneyParse(iM.value));
      g.monto = moneyParse(iM.value);
      saveDB(DB); refreshSem();
    });
    dM.appendChild(lM); dM.appendChild(iM); head.appendChild(dM);

    headRow.appendChild(head);

    // Semáforo global (gasto)
    var semDiv = semaforoPanelRight(gastoSemaforo(g));
    headRow.appendChild(semDiv);
    card.appendChild(headRow);

    // ======= Variables por tipo =======
    var varsCard=document.createElement('div'); varsCard.className='card';
    var varsGrid=document.createElement('div'); varsGrid.className='grid'; varsCard.appendChild(varsGrid);
    card.appendChild(varsCard);

    // ======= Evidencia =======
    var ev=document.createElement('div'); ev.className='actions';
    var evLbl=document.createElement('span'); evLbl.textContent='📷 Evidencia (ticket/factura)';
    var evIn=document.createElement('input'); evIn.type='file'; evIn.accept='image/*';
    var prev=document.createElement('div'); prev.className='preview';
    evIn.addEventListener('change', function(){
      if(evIn.files && evIn.files[0]){
        var r=new FileReader(); r.onload=function(e){ g.evidencia=e.target.result; saveDB(DB); paintPrev(); }; r.readAsDataURL(evIn.files[0]);
      }
    });
    function paintPrev(){ prev.innerHTML=''; if(g.evidencia){ var im=document.createElement('img'); im.src=g.evidencia; prev.appendChild(im); } }
    paintPrev();
    ev.appendChild(evLbl); ev.appendChild(evIn); ev.appendChild(prev);
    card.appendChild(ev);

    host.appendChild(card);

    function refreshSem(){
      var nuevo = semaforoPanelRight(gastoSemaforo(g));
      semDiv.replaceWith(nuevo); semDiv=nuevo;
    }

    function renderVars(){
      varsGrid.innerHTML='';
      if(g.tipo==='pagado'){
        var note=document.createElement('div'); note.innerHTML='<b>Pagado:</b> La <u>cuenta de pago</u> es obligatoria. La conciliación se realiza en la hoja de <b>Conciliación</b>.';
        varsGrid.appendChild(note);
      }
      if(g.tipo==='por_pagar'){
        var d1=document.createElement('div'); var l1=document.createElement('label'); l1.textContent='Fecha compromiso / devengo';
        var i1=document.createElement('input'); i1.type='date'; i1.value=g.fechaDevengo||''; i1.addEventListener('change', function(){ g.fechaDevengo=i1.value; saveDB(DB); refreshSem(); });
        d1.appendChild(l1); d1.appendChild(i1); varsGrid.appendChild(d1);

        var d2=document.createElement('div'); var l2=document.createElement('label'); l2.textContent='Marcar como pagado';
        var c2=document.createElement('input'); c2.type='checkbox'; c2.checked=!!g.pagado; c2.addEventListener('change', function(){ g.pagado=c2.checked; saveDB(DB); refreshSem(); });
        d2.appendChild(l2); d2.appendChild(c2); varsGrid.appendChild(d2);
      }
      if(g.tipo==='recurrente'){
        var dP=document.createElement('div'); var lP=document.createElement('label'); lP.textContent='Periodicidad';
        var sP=document.createElement('select');
        [['mensual','Mensual (día del mes)'],['quincenal','Quincenal (1/16)'],['semanal','Semanal (día de la semana)'],['cada_x_dias','Cada X días']].forEach(function(p){ var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(g.periodicidad===p[0]) op.selected=true; sP.appendChild(op); });
        sP.addEventListener('change', function(){ g.periodicidad=sP.value; saveDB(DB); renderVars(); });
        dP.appendChild(lP); dP.appendChild(sP); varsGrid.appendChild(dP);

        if(g.periodicidad==='mensual'){
          var dM=document.createElement('div'); var lM=document.createElement('label'); lM.textContent='Día del mes (1–31)';
          var iM2=document.createElement('input'); iM2.type='number'; iM2.min='1'; iM2.max='31'; iM2.value=g.diaMes||1;
          iM2.addEventListener('input', function(){ g.diaMes=parseInt(iM2.value||'1',10); saveDB(DB); });
          dM.appendChild(lM); dM.appendChild(iM2); varsGrid.appendChild(dM);
        } else if(g.periodicidad==='quincenal'){
          var dQ=document.createElement('div'); dQ.innerHTML='Se generará el cargo los días <b>1</b> y <b>16</b> de cada mes.'; varsGrid.appendChild(dQ);
        } else if(g.periodicidad==='semanal'){
          var dS=document.createElement('div'); var lS=document.createElement('label'); lS.textContent='Día de la semana';
          var sS=document.createElement('select'); ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'].forEach(function(dia){ var op=document.createElement('option'); op.value=dia; op.textContent=dia; if(g.diaSemana===dia) op.selected=true; sS.appendChild(op); });
          sS.addEventListener('change', function(){ g.diaSemana=sS.value; saveDB(DB); });
          dS.appendChild(lS); dS.appendChild(sS); varsGrid.appendChild(dS);
        } else if(g.periodicidad==='cada_x_dias'){
          var dX=document.createElement('div'); var lX=document.createElement('label'); lX.textContent='Cada cuántos días';
          var iX=document.createElement('input'); iX.type='number'; iX.min='1'; iX.value=g.cadaDias||30; iX.addEventListener('input', function(){ g.cadaDias=parseInt(iX.value||'1',10); saveDB(DB); });
          dX.appendChild(lX); dX.appendChild(iX); varsGrid.appendChild(dX);
        }

        var note=document.createElement('div'); note.innerHTML='Cada ocurrencia deberá <b>conciliarse</b> en la hoja de Conciliación cuando se pague.';
        varsGrid.appendChild(note);
      }
    }

    function renderLockState(){
      var ro = g.bloqueado;
      [sT,iF,sC,sCC,iM].forEach(function(inp){
        inp.disabled = ro; if(ro){ inp.classList.add('ro'); } else { inp.classList.remove('ro'); }
      });
    }

    renderVars();
    renderLockState();

    // Impresión / WhatsApp
    function adminGastoHTML(g){
      var css='@page{size:5.5in 8.5in;margin:10mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}h1{color:#0a2c4c}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:4px 6px}thead tr{background:#e7effa}.row{display:flex;gap:8px;margin:6px 0}.col{flex:1}';
      var H=[];
      H.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gasto '+String(g.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
      H.push('<h1>Gasto '+String(g.folio).padStart(3,'0')+'</h1>');
      H.push('<div class="row"><div class="col"><b>Fecha:</b> '+(g.fecha||'')+'</div><div class="col"><b>Tipo:</b> '+g.tipo+'</div></div>');
      H.push('<div class="row"><div class="col"><b>Cuenta pago:</b> '+ctaNombre(g.cuentaId)+'</div><div class="col"><b>Cuenta contable:</b> '+ctaContNombre(g.cuentaContableId)+'</div></div>');
      H.push('<div class="row"><div class="col"><b>Monto:</b> '+moneyFmt(g.monto||0)+'</div><div class="col"><b>Estatus:</b> '+gastoSemaforo(g).label+'</div></div>');
      if(g.evidencia){ H.push('<h3>Evidencia</h3><img src="'+g.evidencia+'" style="max-width:100%;max-height:320px;border:1px solid #ccc">'); }
      H.push('</body></html>');
      return H.join('');
    }
    window.adminGastoImprimir = function(g){
      var w=window.open('', '_blank', 'width=840,height=900');
      if(!w){ alert('Permite pop-ups para imprimir.'); return; }
      w.document.write(adminGastoHTML(g)); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
    };
    window.adminGastoWhatsApp = function(g){
      adminGastoImprimir(g);
      toast && toast('Exporta el PDF y compártelo por WhatsApp.');
    };
  });
}

/* ------------------------- Conciliación de Cajas ------------------------- */
function adminConciliacion(){
  openTab('admin-conc','Conciliación de caja / cuenta', function(host){
    host.innerHTML='';

    var card=document.createElement('div'); card.className='card';

    // ===== Toolbar superior: imprimir/wa (izq) + Guardar/Editar (der) + semáforo global der-der =====
    var tb=document.createElement('div'); tb.className='actions'; card.appendChild(tb);
    var left=document.createElement('div'); left.style.display='flex'; left.style.gap='8px';
    var bImp=document.createElement('button'); bImp.className='btn'; bImp.textContent='🖨️ Imprimir';
    var bWA=document.createElement('button'); bWA.className='btn'; bWA.textContent='WhatsApp';
    left.appendChild(bImp); left.appendChild(bWA);
    tb.appendChild(left);

    var right=document.createElement('div'); right.style.marginLeft='auto'; tb.appendChild(right);
    var bGuardar=document.createElement('button'); bGuardar.textContent='GUARDAR'; bGuardar.className='btn-primary';
    var bEditar=document.createElement('button'); bEditar.textContent='✏️ Editar'; bEditar.className='btn-warn';

    // Semáforo global (placeholder, se actualiza con pintar())
    var semWrap=document.createElement('div'); semWrap.style.marginLeft='12px'; tb.appendChild(semWrap);
    function setConcSemaforo(color, label, icon){
      semWrap.innerHTML='';
      var box=semaforoPanelRight({icon:icon||'🟡', color:color||'#f59e0b', label:label||'Por conciliar'});
      semWrap.appendChild(box);
    }
    setConcSemaforo('#f59e0b','Por conciliar','🟡');

    // ===== Filtros principales =====
    var g=document.createElement('div'); g.className='grid';
    var dCta=document.createElement('div'); var lCta=document.createElement('label'); lCta.textContent='Cuenta';
    var sCta=document.createElement('select'); DB.admin.cuentas.forEach(function(c){ var op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; sCta.appendChild(op); });
    dCta.appendChild(lCta); dCta.appendChild(sCta); g.appendChild(dCta);

    var dDesde=document.createElement('div'); var l1=document.createElement('label'); l1.textContent='Desde'; var iDesde=document.createElement('input'); iDesde.type='date'; dDesde.appendChild(l1); dDesde.appendChild(iDesde); g.appendChild(dDesde);
    var dHasta=document.createElement('div'); var l2=document.createElement('label'); l2.textContent='Hasta'; var iHasta=document.createElement('input'); iHasta.type='date'; dHasta.appendChild(l2); dHasta.appendChild(iHasta); g.appendChild(dHasta);

    var dBtn=document.createElement('div'); var lB=document.createElement('label'); lB.textContent=' '; 
    var bBuscar=document.createElement('button'); bBuscar.className='btn'; bBuscar.textContent='Buscar';
    bBuscar.style.background='#0a3a74'; bBuscar.style.color='#fff'; bBuscar.style.border='1px solid #0a3a74';
    dBtn.appendChild(lB); dBtn.appendChild(bBuscar); g.appendChild(dBtn);

    card.appendChild(g);

    // ===== Resumen chips =====
    var resumen=document.createElement('div'); resumen.className='actions'; card.appendChild(resumen);

    // ===== Tablas (sin semáforo por línea) =====
    var tIn=document.createElement('div'); tIn.className='card';
    var hIn=document.createElement('h2'); hIn.textContent='Ingresos del periodo'; tIn.appendChild(hIn);
    var tblIn=document.createElement('table'); var thIn=document.createElement('thead'); var trhIn=document.createElement('tr');
    ['Fecha','Concepto','Monto'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trhIn.appendChild(th); }); thIn.appendChild(trhIn); tblIn.appendChild(thIn);
    var tbIn=document.createElement('tbody'); tblIn.appendChild(tbIn); tIn.appendChild(tblIn);

    var tEg=document.createElement('div'); tEg.className='card';
    var hEg=document.createElement('h2'); hEg.textContent='Egresos (gastos pagados) del periodo'; tEg.appendChild(hEg);
    var tblEg=document.createElement('table'); var thEg=document.createElement('thead'); var trhEg=document.createElement('tr');
    ['Fecha','Cuenta contable','Monto'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trhEg.appendChild(th); }); thEg.appendChild(trhEg); tblEg.appendChild(thEg);
    var tbEg=document.createElement('tbody'); tblEg.appendChild(tbEg); tEg.appendChild(tblEg);

    // ===== Totales, saldo real y guardar =====
    var barra=document.createElement('div'); barra.className='actions';
    var saldoRealWrap=document.createElement('div'); var lSR=document.createElement('label'); lSR.textContent='Saldo real contado/estado bancario';
    var iSaldoReal=document.createElement('input'); iSaldoReal.type='text'; iSaldoReal.placeholder='$ 0.00';
    // Aceptar negativos: NO formatear en input, SOLO en blur
    iSaldoReal.addEventListener('input', function(){ /* permitir -, -., etc. */ updateSemaforo(); });
    iSaldoReal.addEventListener('blur', function(){ iSaldoReal.value = moneyFmt(moneyParse(iSaldoReal.value)); updateSemaforo(); });
    saldoRealWrap.appendChild(lSR); saldoRealWrap.appendChild(iSaldoReal);
    barra.appendChild(saldoRealWrap);

    function renderRight(canEdit){
      right.innerHTML='';
      if(canEdit){ right.appendChild(bGuardar); }
      else { right.appendChild(bEditar); }
    }
    var current=null;
    bEditar.addEventListener('click', function(){
      if(!current){ return; }
      current.bloqueado=false; saveDB(DB);
      renderRight(true); setTitle(current);
      setConcSemaforo('#f59e0b','Por conciliar','🟡');
      lockUI(false);
    });

    card.appendChild(tIn);
    card.appendChild(tEg);
    card.appendChild(barra);

    host.appendChild(card);

    function setTitle(conc){
      var title = 'Conciliación de caja / cuenta';
      if(conc && conc.bloqueado){
        title = 'CONCILIACIÓN FOLIO '+String(conc.folio).padStart(3,'0')+': A FECHA '+(conc.hasta||'');
      }
      var tabBtn = document.querySelector('[data-tab="admin-conc"]');
      if(tabBtn){ tabBtn.textContent = title; }
    }

    function lockUI(ro){
      [sCta,iDesde,iHasta,bBuscar,iSaldoReal].forEach(function(el){
        el.disabled = ro; if(ro){ el.classList.add('ro'); } else { el.classList.remove('ro'); }
      });
    }

    function pintar(){
      tbIn.innerHTML=''; tbEg.innerHTML=''; resumen.innerHTML='';

      var cuentaId=sCta.value;
      var desde=iDesde.value || '0000-01-01';
      var hasta=iHasta.value || '9999-12-31';

      var prev=lastConciliacionBefore(cuentaId, desde);
      var saldoInicial = prev ? Number(prev.saldoReal||0) : 0;

      var ins = movimientosIngresosEnPeriodo(cuentaId, desde, hasta);
      var egs = movimientosGastosEnPeriodo(cuentaId, desde, hasta);

      var sumIn = 0, sumEg = 0;

      ins.forEach(function(m){
        sumIn += Number(m.monto||0);
        var tr=document.createElement('tr');
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
        tr.appendChild(td(m.fecha||'')); tr.appendChild(td(m.concepto||'Ingreso')); tr.appendChild(td(moneyFmt(m.monto||0)));
        tbIn.appendChild(tr);
      });

      egs.forEach(function(g){
        sumEg += Number(g.monto||0);
        var tr=document.createElement('tr');
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
        tr.appendChild(td(g.fecha||'')); tr.appendChild(td(ctaContNombre(g.cuentaContableId))); tr.appendChild(td(moneyFmt(g.monto||0)));
        tbEg.appendChild(tr);
      });

      var saldoEsperado = saldoInicial + sumIn - sumEg;

      function chip(txt){ var s=document.createElement('span'); s.className='pill'; s.textContent=txt; return s; }
      resumen.appendChild(chip('Saldo inicial: '+moneyFmt(saldoInicial)));
      resumen.appendChild(chip('Ingresos: '+moneyFmt(sumIn)));
      resumen.appendChild(chip('Egresos: '+moneyFmt(sumEg)));
      resumen.appendChild(chip('Saldo esperado: '+moneyFmt(saldoEsperado)));

      bGuardar.onclick = function(){
        var real = moneyParse(iSaldoReal.value||'0');
        var dif = real - saldoEsperado;

        ins.forEach(function(m){ m.conciliado=true; });
        egs.forEach(function(g){ g.conciliado=true; });

        var folio = nextConcFolio();
        current = {
          id: nextId('C'),
          folio: folio,
          ts: Date.now(),
          cuentaId: cuentaId,
          desde: desde,
          hasta: hasta,
          saldoInicial: saldoInicial,
          ingresos: sumIn,
          egresos: sumEg,
          saldoEsperado: saldoEsperado,
          saldoReal: real,
          diferencia: dif,
          movsGastoIds: egs.map(function(x){return x.id;}),
          movsIngresoIds: ins.map(function(x){return x.id;}),
          bloqueado: true
        };
        DB.admin.conciliaciones.push(current);
        saveDB(DB);

        alert('Conciliación guardada. Folio '+String(folio).padStart(3,'0')+'. Diferencia: '+moneyFmt(dif));
        renderRight(false);
        lockUI(true);
        setTitle(current);
        setConcSemaforo(dif===0?'#16a34a':'#f59e0b', dif===0?'Conciliado':'Por conciliar', dif===0?'🟢':'🟡');
      };

      updateSemaforo = function(){
        var real = moneyParse(iSaldoReal.value||'0');
        var dif = real - saldoEsperado;
        if(!sCta.value || !iDesde.value || !iHasta.value){ setConcSemaforo('#f59e0b','Por conciliar','🟡'); return; }
        setConcSemaforo(dif===0?'#16a34a':'#f59e0b', dif===0?'Conciliado':'Por conciliar', dif===0?'🟢':'🟡');
      };

      renderRight(true);
      lockUI(false);
      setTitle(null);
      updateSemaforo();
    }

    var updateSemaforo=function(){};
    bBuscar.addEventListener('click', pintar);

    // Impresión / WhatsApp
    function concHTML(obj, previewData){
      var css='@page{size:5.5in 8.5in;margin:10mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}h1{color:#0a2c4c}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:4px 6px}thead tr{background:#e7effa}.row{display:flex;gap:8px;margin:6px 0}.col{flex:1}';
      var title = obj && obj.bloqueado ? ('CONCILIACIÓN FOLIO '+String(obj.folio).padStart(3,'0')+': A FECHA '+(obj.hasta||'')) : 'Conciliación de caja / cuenta';
      var H=[];
      H.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+title+'</title><style>'+css+'</style></head><body>');
      H.push('<h1>'+title+'</h1>');
      var info = obj || previewData || {};
      H.push('<div class="row"><div class="col"><b>Cuenta:</b> '+ctaNombre(info.cuentaId||'')+'</div><div class="col"><b>Periodo:</b> '+(info.desde||'')+' a '+(info.hasta||'')+'</div></div>');
      H.push('<div class="row"><div class="col"><b>Saldo inicial:</b> '+moneyFmt(info.saldoInicial||0)+'</div><div class="col"><b>Ingresos:</b> '+moneyFmt(info.ingresos||0)+'</div><div class="col"><b>Egresos:</b> '+moneyFmt(info.egresos||0)+'</div><div class="col"><b>Saldo esperado:</b> '+moneyFmt(info.saldoEsperado||0)+'</div></div>');
      H.push('<div class="row"><div class="col"><b>Saldo real:</b> '+moneyFmt(info.saldoReal||0)+'</div><div class="col"><b>Diferencia:</b> '+moneyFmt((info.saldoReal||0)-(info.saldoEsperado||0))+'</div></div>');
      H.push('</body></html>');
      return H.join('');
    }
    bImp.addEventListener('click', function(){
      var w=window.open('', '_blank', 'width=840,height=900');
      if(!w){ alert('Permite pop-ups para imprimir.'); return; }
      var dataPreview = {
        cuentaId: sCta.value, desde: iDesde.value, hasta: iHasta.value,
        saldoInicial: 0, ingresos: 0, egresos: 0, saldoEsperado: 0, saldoReal: moneyParse(iSaldoReal.value||'0')
      };
      w.document.write(concHTML(current, dataPreview)); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
    });
    bWA.addEventListener('click', function(){
      bImp.click(); toast && toast('Exporta el PDF y compártelo por WhatsApp.');
    });
  });
}

/* ======================= FIN MÓDULO ADMINISTRACIÓN ======================= */

/* ================================================================
   MÓDULO: VENTAS v1.0
   - Submenú (+ Nueva venta | Ventas abiertas | Historial)
   - Hoja de trabajo de Venta con factor de plata (saldo en metal)
   - PDF presentable para cliente
   - Botonera: Nuevo | Imprimir | WhatsApp | Guardar/Editar (lock)
   ➜ Pegar dentro del IIFE de app.js, antes del último "})();"
=================================================================*/

/* ---------- Estado en DB ---------- */
(function ensureVentasState(){
  if(!DB.ventas){ DB.ventas = []; }
  if(typeof DB.folioVenta !== 'number'){ DB.folioVenta = 0; }
  saveDB(DB);
})();

/* ---------- Inyector de botón lateral (si faltara) ---------- */
(function injectVentasButton(){
  var aside = document.querySelector('.left');
  if(!aside) return;
  if(aside.querySelector('[data-root="ventas"]')) return; // ya existe
  var btn = document.createElement('button');
  btn.className = 'side-item tree-btn';
  btn.setAttribute('data-root','ventas');
  btn.textContent = '🧾 Ventas';
  // lo insertamos donde solía ir
  var ref = aside.querySelector('.tree-btn[data-root="inventarios"]');
  if(ref && ref.parentNode){ ref.parentNode.insertBefore(btn, ref.nextSibling); }
  else { aside.appendChild(btn); }
})();

/* ---------- Hook al renderSubmenu para VENTAS ---------- */
(function patchRenderSubmenu_Ventas(){
  var _orig = renderSubmenu;
  renderSubmenu = function(root){
    if(String(root||'').toLowerCase()!=='ventas'){ _orig(root); return; }

    var host = qs('#subpanel'); if(!host) return;
    host.innerHTML = '';

    var card = document.createElement('div'); card.className='card';
    var h2 = document.createElement('h2'); h2.textContent = 'Ventas'; card.appendChild(h2);

    var list = document.createElement('div'); list.className='actions'; list.style.flexDirection='column'; list.style.alignItems='stretch';

    function mkBtn(txt, icon, fn){
      var b = document.createElement('button'); b.className='btn'; b.style.justifyContent='flex-start';
      b.innerHTML = icon+' '+txt; b.addEventListener('click', fn); return b;
    }
    list.appendChild(mkBtn('+ Nueva venta','➕', function(){ abrirVentaNueva(); }));
    list.appendChild(mkBtn('Ventas abiertas','📂', function(){ listarVentas(false); }));
    list.appendChild(mkBtn('Historial','📜', function(){ listarVentas(true); }));

    card.appendChild(list);
    host.appendChild(card);

    // Por defecto mostramos abiertas
    listarVentas(false);
  };
})();

/* ---------- Utilidades ---------- */
function nextVentaId(){
  DB.folioVenta += 1; saveDB(DB);
  return { id: 'V'+Date.now(), folio: DB.folioVenta };
}
function v_money(n){ return '$ ' + (Number(n||0)).toFixed(2); }
function v_num(n){ return (Number(n||0)).toFixed(2); }

/* Totales de líneas */
function ventaCalcularTotales(v){
  var pz=0, gr=0, sub=0, desc=0, neto=0;
  (v.lineas||[]).forEach(function(li){
    var precio = Number(li.precio||0);
    var base = Number(li.gramos||0); // cobro por gramo (simple y claro)
    var imp = base * precio;
    var d = Math.min(Math.max(Number(li.desc||0),0),100);
    var dMonto = imp * (d/100);
    var net = imp - dMonto;

    li._importe = net;
    pz += Number(li.piezas||0);
    gr += Number(li.gramos||0);
    sub += imp;
    desc += dMonto;
    neto += net;
  });
  v.totales = { piezas:pz, gramos:gr, subtotal:sub, descuento:desc, total:neto };
  // saldos: dinero y metal
  var factor = Number(v.factorPlata||0);
  v.saldoDinero = neto;
  v.saldoPlataGr = gr * Math.max(factor,0); // 0 = sólo mano de obra
}

/* ---------- Crear / listar ---------- */
function nuevaVentaBase(){
  var nx = nextVentaId();
  var obj = {
    id: nx.id,
    folio: nx.folio,
    fecha: hoyStr(),
    cliente: '',
    comentarios: '',
    factorPlata: 0, // 0 = sólo MO; 1 = 1:1; permite decimales
    cerrado: false,
    lineas: [
      { codigo:'', descripcion:'', piezas:0, gramos:0, precio:0, desc:0 },
      { codigo:'', descripcion:'', piezas:0, gramos:0, precio:0, desc:0 },
      { codigo:'', descripcion:'', piezas:0, gramos:0, precio:0, desc:0 }
    ],
    totales: { piezas:0, gramos:0, subtotal:0, descuento:0, total:0 },
    saldoDinero: 0,
    saldoPlataGr: 0
  };
  ventaCalcularTotales(obj);
  DB.ventas.push(obj); saveDB(DB);
  return obj.id;
}
function abrirVentaNueva(){ var id = nuevaVentaBase(); abrirVenta(id, false); }

function listarVentas(cerradas){
  var host = qs('#subpanel'); if(!host) return;
  var list = document.createElement('div'); list.className='card';
  var h = document.createElement('h2'); h.textContent = cerradas?'Historial de ventas':'Ventas abiertas'; list.appendChild(h);

  var tbl=document.createElement('table');
  var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Folio','Fecha','Cliente','Factor Plata','Total $','Saldo Plata (gr)','Estatus','Acciones'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); tbl.appendChild(thead);
  var tbody=document.createElement('tbody'); tbl.appendChild(tbody);

  DB.ventas.slice().sort(function(a,b){ return b.folio - a.folio; }).forEach(function(v){
    if(!!v.cerrado !== !!cerradas) return;
    ventaCalcularTotales(v);
    var tr=document.createElement('tr');
    function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
    tr.appendChild(td(String(v.folio).padStart(3,'0')));
    tr.appendChild(td(v.fecha||''));
    tr.appendChild(td(v.cliente||''));
    tr.appendChild(td(v_num(v.factorPlata)));
    tr.appendChild(td(v_money(v.saldoDinero)));
    tr.appendChild(td(v_num(v.saldoPlataGr)));
    tr.appendChild(td(v.cerrado?'Cerrada':'Abierta'));
    var tda=document.createElement('td');
    var b=document.createElement('button'); b.className='btn'; b.textContent = v.cerrado?'Ver PDF':'Abrir';
    b.addEventListener('click', function(){ v.cerrado ? imprimirPDFVenta(v,false) : abrirVenta(v.id, false); });
    tda.appendChild(b); tr.appendChild(tda);
    tbody.appendChild(tr);
  });

  list.appendChild(tbl);
  host.appendChild(list);
}

/* ---------- Editor de Venta ---------- */
function abrirVenta(id, readOnly){
  var v = DB.ventas.find(function(x){ return x.id===id; });
  if(!v){ toast('Venta no encontrada'); return; }

  var tabId = 'venta-'+v.id;
  var titulo = 'Venta '+String(v.folio).padStart(3,'0');

  openTab(tabId, titulo, function(host){
    host.innerHTML='';

    // recalcula siempre
    ventaCalcularTotales(v);

    /* --- Barra superior (iconos izq + Guardar/Editar der) --- */
    var top = document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';

    var left = document.createElement('div'); left.className='actions';
    var bNuevo=document.createElement('button'); bNuevo.className='btn'; bNuevo.textContent='➕ Nuevo'; 
    bNuevo.addEventListener('click', function(){ abrirVentaNueva(); });
    var bPDF=document.createElement('button'); bPDF.className='btn'; bPDF.textContent='🖨️ Imprimir';
    bPDF.addEventListener('click', function(){ imprimirPDFVenta(v,true); });
    var bWA=document.createElement('button'); bWA.className='btn'; bWA.textContent='🟢 WhatsApp';
    bWA.addEventListener('click', function(){ imprimirPDFVenta(v,false); toast('Guarda el PDF y compártelo por WhatsApp.'); });
    left.appendChild(bNuevo); left.appendChild(bPDF); left.appendChild(bWA);

    var right = document.createElement('div'); right.className='actions';
    var bGuardar=document.createElement('button');
    function paintGuardar(){
      bGuardar.className = v.cerrado ? 'btn' : 'btn-primary';
      bGuardar.textContent = v.cerrado ? 'Editar' : 'GUARDAR';
    }
    paintGuardar();
    bGuardar.addEventListener('click', function(){
      if(v.cerrado){
        v.cerrado=false; saveDB(DB); paintGuardar(); renderForm(); toast('Modo edición habilitado.');
      }else{
        // validaciones mínimas
        if(!v.fecha){ alert('Fecha requerida'); return; }
        ventaCalcularTotales(v);
        v.cerrado=true; saveDB(DB); paintGuardar(); renderForm(); toast('Venta guardada y bloqueada.');
      }
    });
    right.appendChild(bGuardar);

    top.appendChild(left); top.appendChild(right);
    host.appendChild(top);

    /* --- Contenedor del formulario --- */
    var card = document.createElement('div'); card.className='card';
    host.appendChild(card);

    function ro(input, lock){
      if(lock){ input.readOnly=true; input.classList.add('ro'); }
      else{ input.readOnly=false; input.classList.remove('ro'); }
    }

    function renderForm(){
      card.innerHTML='';

      // Header
      var header=document.createElement('div'); header.className='grid';
      var dFolio=document.createElement('div'); var lFolio=document.createElement('label'); lFolio.textContent='Folio'; 
      var iFolio=document.createElement('input'); iFolio.readOnly=true; iFolio.value=String(v.folio).padStart(3,'0'); iFolio.style.color='#b91c1c'; 
      dFolio.appendChild(lFolio); dFolio.appendChild(iFolio); header.appendChild(dFolio);

      var dFecha=document.createElement('div'); var lFecha=document.createElement('label'); lFecha.textContent='Fecha';
      var iFecha=document.createElement('input'); iFecha.type='date'; iFecha.value=v.fecha||hoyStr();
      iFecha.addEventListener('change', function(){ v.fecha=iFecha.value; saveDB(DB); });
      ro(iFecha, v.cerrado); dFecha.appendChild(lFecha); dFecha.appendChild(iFecha); header.appendChild(dFecha);

      var dCliente=document.createElement('div'); var lCli=document.createElement('label'); lCli.textContent='Cliente';
      var iCli=document.createElement('input'); iCli.type='text'; iCli.value=v.cliente||'';
      iCli.addEventListener('input', function(){ v.cliente=iCli.value; saveDB(DB); });
      ro(iCli, v.cerrado); dCliente.appendChild(lCli); dCliente.appendChild(iCli); header.appendChild(dCliente);

      var dFactor=document.createElement('div'); var lFac=document.createElement('label'); lFac.textContent='Factor de Plata (gr por gr)';
      var iFac=document.createElement('input'); iFac.type='number'; iFac.step='0.01'; iFac.value=v.factorPlata;
      iFac.addEventListener('input', function(){ v.factorPlata=parseFloat(iFac.value||'0'); ventaCalcularTotales(v); saveDB(DB); paintChips(); });
      ro(iFac, v.cerrado); dFactor.appendChild(lFac); dFactor.appendChild(iFac); header.appendChild(dFactor);

      var dCom=document.createElement('div'); var lCom=document.createElement('label'); lCom.textContent='Comentarios';
      var tCom=document.createElement('textarea'); tCom.value=v.comentarios||'';
      tCom.addEventListener('input', function(){ v.comentarios=tCom.value; saveDB(DB); });
      ro(tCom, v.cerrado); dCom.appendChild(lCom); dCom.appendChild(tCom); header.appendChild(dCom);

      card.appendChild(header);

      // Chips (saldos)
      var chips=document.createElement('div'); chips.className='actions';
      function pill(txt){ var s=document.createElement('span'); s.className='pill'; s.textContent=txt; return s; }
      function paintChips(){
        chips.innerHTML='';
        ventaCalcularTotales(v);
        chips.appendChild(pill('PZ: '+v_num(v.totales.piezas)));
        chips.appendChild(pill('GR: '+v_num(v.totales.gramos)));
        chips.appendChild(pill('Subtotal: '+v_money(v.totales.subtotal)));
        chips.appendChild(pill('Desc: '+v_money(v.totales.descuento)));
        chips.appendChild(pill('Total: '+v_money(v.totales.total)));
        var metal = v_num(v.saldoPlataGr);
        var money = v_money(v.saldoDinero);
        chips.appendChild(pill('Saldo en plata: '+metal+' g'));
        chips.appendChild(pill('Saldo en dinero: '+money));
      }
      paintChips();
      card.appendChild(chips);

      // Tabla de líneas
      card.appendChild(tablaLineasVenta({
        bloqueado: v.cerrado,
        lineas: v.lineas,
        onChange: function(){ ventaCalcularTotales(v); saveDB(DB); paintChips(); }
      }));
    }

    renderForm();
  });
}

/* ---------- Tabla líneas de venta ---------- */
function tablaLineasVenta(cfg){
  var wrap=document.createElement('div');

  var actions=document.createElement('div'); actions.className='actions';
  if(!cfg.bloqueado){
    var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea';
    var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última';
    actions.appendChild(bAdd); actions.appendChild(bDel);
    bAdd.addEventListener('click', function(){ cfg.lineas.push({ codigo:'', descripcion:'', piezas:0, gramos:0, precio:0, desc:0 }); rebuild(); cfg.onChange&&cfg.onChange(); });
    bDel.addEventListener('click', function(){ if(cfg.lineas.length>1){ cfg.lineas.pop(); rebuild(); cfg.onChange&&cfg.onChange(); } });
  }
  wrap.appendChild(actions);

  var table=document.createElement('table');
  var thead=document.createElement('thead'); var trh=document.createElement('tr');
  ['Código','Descripción','Piezas','Gramos','$/gr','% Desc','$ Neto'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');

  function renderRow(li){
    var tr=document.createElement('tr');

    function mkInput(val, type, step){
      var i=document.createElement('input'); i.type=type||'text'; if(step) i.step=step;
      i.value=(type==='number')?Number(val||0):String(val||''); 
      if(cfg.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      return i;
    }
    // Código
    var td1=document.createElement('td'); var i1=mkInput(li.codigo); i1.addEventListener('input', function(){ li.codigo=i1.value; cfg.onChange&&cfg.onChange(); }); td1.appendChild(i1); tr.appendChild(td1);
    // Descripción
    var td2=document.createElement('td'); var i2=mkInput(li.descripcion); i2.addEventListener('input', function(){ li.descripcion=i2.value; cfg.onChange&&cfg.onChange(); }); td2.appendChild(i2); tr.appendChild(td2);
    // Piezas
    var td3=document.createElement('td'); var i3=mkInput(li.piezas,'number','1'); i3.addEventListener('input', function(){ li.piezas=parseFloat(i3.value||'0'); cfg.onChange&&cfg.onChange(); }); td3.appendChild(i3); tr.appendChild(td3);
    // Gramos
    var td4=document.createElement('td'); var i4=mkInput(li.gramos,'number','0.01'); i4.addEventListener('input', function(){ li.gramos=parseFloat(i4.value||'0'); cfg.onChange&&cfg.onChange(); }); td4.appendChild(i4); tr.appendChild(td4);
    // $/gr
    var td5=document.createElement('td'); var i5=mkInput(li.precio,'number','0.01'); i5.addEventListener('input', function(){ li.precio=parseFloat(i5.value||'0'); cfg.onChange&&cfg.onChange(); }); td5.appendChild(i5); tr.appendChild(td5);
    // % desc
    var td6=document.createElement('td'); var i6=mkInput(li.desc,'number','0.01'); i6.addEventListener('input', function(){ li.desc=parseFloat(i6.value||'0'); cfg.onChange&&cfg.onChange(); }); td6.appendChild(i6); tr.appendChild(td6);
    // Neto (read-only)
    var td7=document.createElement('td'); var i7=mkInput(li._importe||0,'text'); i7.readOnly=true; i7.classList.add('ro'); i7.value=v_money(li._importe||0); td7.appendChild(i7); tr.appendChild(td7);

    tbody.appendChild(tr);
  }

  function rebuild(){ tbody.innerHTML=''; cfg.lineas.forEach(renderRow); }
  rebuild();

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ---------- PDF ---------- */
function imprimirPDFVenta(v, isDraft){
  ventaCalcularTotales(v);

  var css='@page{size:Letter;margin:12mm}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;color:#0f172a}h1{margin:4px 0;color:#0a2c4c}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #e5e7eb;padding:4px 6px;word-break:break-word}thead tr{background:#e7effa}.row{display:flex;gap:8px;margin:6px 0}.col{flex:1}.chips{margin:6px 0}.chip{background:#f1f5f9;border-radius:14px;padding:4px 8px;font-weight:700;margin-right:6px}.water{position:fixed;top:40%;left:18%;font-size:52px;color:#94a3b880;transform:rotate(-18deg);}';
  var H=[];
  H.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Venta '+String(v.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
  if(isDraft){ H.push('<div class="water">BORRADOR</div>'); }
  H.push('<div class="row"><div class="col" style="max-width:140px"><img src="/logo.webp" style="max-width:100%;max-height:64px;object-fit:contain"></div><div class="col"><h1>NOTA DE VENTA</h1></div></div>');
  H.push('<div class="row"><div class="col"><b>Folio:</b> '+String(v.folio).padStart(3,'0')+'</div><div class="col"><b>Fecha:</b> '+(v.fecha||'')+'</div><div class="col"><b>Cliente:</b> '+escapeHTML(v.cliente||'')+'</div><div class="col"><b>Factor Plata:</b> '+v_num(v.factorPlata)+'</div></div>');
  H.push('<div class="row"><div class="col"><b>Comentarios:</b> '+escapeHTML(v.comentarios||'')+'</div></div>');

  H.push('<div class="chips">');
  H.push('<span class="chip">PZ: '+v_num(v.totales.piezas)+'</span>');
  H.push('<span class="chip">GR: '+v_num(v.totales.gramos)+'</span>');
  H.push('<span class="chip">Subtotal: '+v_money(v.totales.subtotal)+'</span>');
  H.push('<span class="chip">Descuento: '+v_money(v.totales.descuento)+'</span>');
  H.push('<span class="chip">Total: '+v_money(v.totales.total)+'</span>');
  H.push('<span class="chip">Saldo en plata: '+v_num(v.saldoPlataGr)+' g</span>');
  H.push('<span class="chip">Saldo en dinero: '+v_money(v.saldoDinero)+'</span>');
  H.push('</div>');

  H.push('<table><thead><tr><th style="width:8%">Código</th><th>Descripción</th><th style="width:8%">Pz</th><th style="width:12%">Gr</th><th style="width:12%">$/gr</th><th style="width:10%">% Desc</th><th style="width:14%">$ Neto</th></tr></thead><tbody>');
  (v.lineas||[]).forEach(function(li,idx){
    H.push('<tr><td>'+escapeHTML(li.codigo||'')+'</td><td>'+escapeHTML(li.descripcion||'')+'</td><td>'+v_num(li.piezas||0)+'</td><td>'+v_num(li.gramos||0)+'</td><td>'+v_money(li.precio||0)+'</td><td>'+v_num(li.desc||0)+'</td><td>'+v_money(li._importe||0)+'</td></tr>');
  });
  H.push('</tbody></table>');

  H.push('</body></html>');
  var html=H.join('');
  var w=window.open('', '_blank', 'width=840,height=900');
  if(!w){ alert('Permite pop-ups para imprimir.'); return; }
  w.document.write(html); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
}

/* ===================================================================
   PERSONAL · MASTER v2.0 (UNIFICADO)
   Pegar UNA sola vez dentro del IIFE de app.js (antes del último `})();`)
   - Evita redefinir renderSubmenu múltiples veces
   - Inyector del botón "👨‍👩‍👧 Personal" (idempotente)
   - Submenús: Dashboard | Cuentas y Movimientos | Inventario de Plata
                | Deudas | Ingresos | Presupuestos | Activos varios
   - Dashboard: Balance General (Activos, Pasivos, Capital) + spot $/g
                + Calendario semanal (pagos/ingresos/presupuestos)
   - Listados + hojas con GUARDAR→bloquea y ✏️ Editar→desbloquea
   - Todos los “＋ Nuevo …” abren su hoja correspondiente
====================================================================*/

/* ---------- Utilidades base (aprovecha helpers globales si existen) ---------- */
function PER_money(n){ return '$ ' + (Number(n||0)).toFixed(2); }
function PER_parseMoney(s){ return isNaN(s) ? parseFloat(String(s||'').replace(/[^\d.-]/g,''))||0 : Number(s); }
function PER_f2(n){ return (Number(n||0)).toFixed(2); }
function PER_parseISO(d){ try{ var p=d.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }catch(e){ return new Date(); } }
function PER_fmtISO(dt){ var m=String(dt.getMonth()+1).padStart(2,'0'); var d=String(dt.getDate()).padStart(2,'0'); return dt.getFullYear()+'-'+m+'-'+d; }
function PER_startOfWeek(d){ var dt=(d instanceof Date)?new Date(d):PER_parseISO(d||hoyStr()); var day=(dt.getDay()+6)%7; dt.setDate(dt.getDate()-day); dt.setHours(0,0,0,0); return dt; }
function PER_addDays(dt,n){ var x=new Date(dt); x.setDate(x.getDate()+n); return x; }
function PER_nextByFreq(dateISO,freq,xdays,dom){
  var d=PER_parseISO(dateISO||hoyStr());
  if(freq==='mensual'){
    var day = dom || d.getDate(); var m=d.getMonth()+1,y=d.getFullYear();
    if(m===12){y+=1;m=1;}else{m+=1;}
    return PER_fmtISO(new Date(y,m-1,Math.min(day,28)));
  }else if(freq==='quincenal'){
    var day2=d.getDate(); if(day2<=15) return PER_fmtISO(new Date(d.getFullYear(),d.getMonth(),16));
    var m2=d.getMonth()+1,y2=d.getFullYear(); if(m2===12){y2+=1;m2=1;}else{m2+=1;}
    return PER_fmtISO(new Date(y2,m2-1,1));
  }else if(freq==='semanal'){
    return PER_fmtISO(PER_addDays(d,7));
  }else if(freq==='cada_x_dias'){
    return PER_fmtISO(PER_addDays(d, Math.max(1, parseInt(xdays||'1',10))));
  }
  return PER_fmtISO(PER_addDays(d,30));
}

/* ---------- Asegura estado DB.personal y catálogos ---------- */
(function PER_ensureState(){
  if(!DB.personal){
    DB.personal = {};
  }
  // Cuentas solicitadas
  if(!Array.isArray(DB.personal.cuentas)) DB.personal.cuentas=[];
  [
    { id:'pers_caja_plata',  nombre:'Caja de Plata Personal',     tipo:'metal',  saldoGr:0, saldo:0 },
    { id:'pers_banco_sant',  nombre:'Banco Santander Personal',   tipo:'dinero', saldo:0 },
    { id:'pers_banco_bbva',  nombre:'Bancomer Personal',          tipo:'dinero', saldo:0 },
    { id:'pers_banco_nu',    nombre:'Nu Personal',                tipo:'dinero', saldo:0 },
    { id:'pers_mp',          nombre:'Mercado Pago Personal',      tipo:'dinero', saldo:0 },
    { id:'pers_ef_arturo',   nombre:'Efectivo Arturo',            tipo:'dinero', saldo:0 },
    { id:'pers_ef_steph',    nombre:'Efectivo Stephanie',         tipo:'dinero', saldo:0 }
  ].forEach(function(ct){
    if(!DB.personal.cuentas.some(function(x){return x.id===ct.id;})){ DB.personal.cuentas.push(ct); }
  });

  // Catálogo familiar (Otros arriba)
  if(!Array.isArray(DB.personal.cuentasContables)){
    DB.personal.cuentasContables = [
      { id:'otros',           nombre:'Otros gastos' },
      { id:'super',           nombre:'Super / Despensa' },
      { id:'renta',           nombre:'Renta / Hipoteca' },
      { id:'servicios',       nombre:'Servicios (luz/agua/internet/gas)' },
      { id:'colegiaturas',    nombre:'Colegios / Educación' },
      { id:'salud',           nombre:'Salud / Seguros' },
      { id:'transporte',      nombre:'Transporte / Combustible' },
      { id:'entretenimiento', nombre:'Entretenimiento' },
      { id:'ropa',            nombre:'Ropa / Calzado' },
      { id:'mascotas',        nombre:'Mascotas' },
      { id:'viajes',          nombre:'Viajes' },
      { id:'mantenimiento',   nombre:'Mantenimiento hogar/auto' },
      { id:'donativos',       nombre:'Donativos' },
      { id:'ahorro',          nombre:'Ahorro / Inversión' }
    ];
  }

  // Folios y colecciones
  if(typeof DB.personal.folioInv      !== 'number') DB.personal.folioInv=0;
  if(typeof DB.personal.folioDeuda    !== 'number') DB.personal.folioDeuda=0;
  if(typeof DB.personal.folioIngreso  !== 'number') DB.personal.folioIngreso=0;
  if(typeof DB.personal.folioPres     !== 'number') DB.personal.folioPres=0;
  if(typeof DB.personal.folioActivo   !== 'number') DB.personal.folioActivo=0;

  if(!Array.isArray(DB.personal.invMovs))      DB.personal.invMovs=[];
  if(!Array.isArray(DB.personal.deudas))       DB.personal.deudas=[];
  if(!Array.isArray(DB.personal.ingresos))     DB.personal.ingresos=[];
  if(!Array.isArray(DB.personal.presupuestos)) DB.personal.presupuestos=[];
  if(!Array.isArray(DB.personal.activos))      DB.personal.activos=[];

  if(!DB.personal.parametros) DB.personal.parametros={};
  if(typeof DB.personal.parametros.spotPlata !== 'number') DB.personal.parametros.spotPlata = 20; // $/g

  saveDB(DB);
})();

/* ---------- Inyector seguro del botón lateral "Personal" ---------- */
(function PER_injectBtn(){
  var aside=document.querySelector('.left');
  if(!aside) return;
  if(aside.querySelector('[data-root="personal"]')) return;
  var btn=document.createElement('button');
  btn.className='side-item tree-btn';
  btn.setAttribute('data-root','personal');
  btn.textContent='👨‍👩‍👧 Personal';
  var ref = aside.querySelector('.tree-btn[data-root="catalogo"]');
  if(ref && ref.parentNode){ ref.parentNode.insertBefore(btn, ref); } else { aside.appendChild(btn); }
  btn.addEventListener('click', function(){
    document.querySelectorAll('.tree-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    PER_renderSubmenu();
  });
})();

/* ---------- Pestañas: click = activa su vista (patch idempotente) ---------- */
(function PER_tabsPatch(){
  var tabs=document.getElementById('tabs');
  if(!tabs || tabs.__perPatch) return;
  tabs.__perPatch=true;
  tabs.addEventListener('click', function(e){
    var tab=e.target.closest('.tab');
    if(!tab || e.target.classList.contains('x')) return;
    var id=tab.getAttribute('data-tab'); if(!id) return;
    tabs.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
    tab.classList.add('active');
    var views=document.getElementById('views');
    views.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
    var v=document.getElementById('view-'+id);
    if(v) v.classList.add('active');
  });
})();

/* ---------- Submenú Personal (único patch) ---------- */
function PER_renderSubmenu(){
  var host = qs('#subpanel'); if(!host) return;
  host.innerHTML='';
  var card=document.createElement('div'); card.className='card';
  var h2=document.createElement('h2'); h2.textContent='Personal'; card.appendChild(h2);

  var list=document.createElement('div'); list.className='actions';
  list.style.flexDirection='column'; list.style.alignItems='stretch';

  function add(txt,icon,fn){
    var b=document.createElement('button'); b.className='btn'; b.style.justifyContent='flex-start';
    b.innerHTML=icon+' '+txt; b.addEventListener('click',fn); return b;
  }

  list.appendChild(add('Dashboard','📊', PER_dashboard));
  list.appendChild(add('Cuentas y Movimientos','📦', PER_movsList));
  list.appendChild(add('Inventario de Plata','🥈', PER_plataList));
  list.appendChild(add('Deudas','💳', PER_deudasList));
  list.appendChild(add('Ingresos','💵', PER_ingresosList));
  list.appendChild(add('Presupuestos','📝', PER_presupuestosList));
  list.appendChild(add('Activos varios','🛠️', PER_activosList));
  card.appendChild(list);
  host.appendChild(card);

  // Abre Dashboard por defecto
  PER_dashboard();
}

/* ===================================================================
   DASHBOARD: Balance General + Calendario semanal
====================================================================*/
function PER_totales(){
  var spot = Number(DB.personal.parametros.spotPlata||0);
  var totalDin=0, totalGr=0;
  DB.personal.cuentas.forEach(function(c){
    if(c.tipo==='dinero') totalDin += Number(c.saldo||0);
    if(c.tipo==='metal')  totalGr += Number(c.saldoGr||0);
  });
  var activosVarios = DB.personal.activos.reduce(function(s,a){ return s + Number(a.cantidad||0)*Number(a.precio||0); }, 0);
  var activos = totalDin + totalGr*spot + activosVarios;

  var pasivos = DB.personal.deudas.reduce(function(s,d){
    // usa saldoPendiente si existe; si no, usa saldoActual/montoOriginal
    var v = (d.saldoPendiente!=null)? d.saldoPendiente : (d.saldoActual!=null? d.saldoActual : (d.montoOriginal||0));
    return s + Number(v||0);
  },0);

  return {spot, totalDin, totalGr, activosVarios, activos, pasivos, capital: activos-pasivos};
}

function PER_dashboard(){
  openTab('per-dash','Personal · Dashboard', function(host){
    host.innerHTML='';

    // KPI / Balance
    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent='Balance General (Personal)'; card.appendChild(h);

    var ctl=document.createElement('div'); ctl.className='actions';
    var l=document.createElement('label'); l.textContent='Precio de plata ($/g)';
    var i=document.createElement('input'); i.type='number'; i.step='0.01'; i.value=DB.personal.parametros.spotPlata||0;
    i.addEventListener('input', function(){ DB.personal.parametros.spotPlata=parseFloat(i.value||'0'); saveDB(DB); pintaKPIs(); });
    ctl.appendChild(l); ctl.appendChild(i);
    card.appendChild(ctl);

    var kpis=document.createElement('div'); kpis.className='grid'; card.appendChild(kpis);

    var boxCtas=document.createElement('div'); boxCtas.className='card';
    var hC=document.createElement('h2'); hC.textContent='Cuentas'; boxCtas.appendChild(hC);
    var gridC=document.createElement('div'); gridC.className='grid'; boxCtas.appendChild(gridC);

    host.appendChild(card);
    host.appendChild(boxCtas);

    function pintaKPIs(){
      var t=PER_totales();
      kpis.innerHTML='';
      [
        ['Activos', PER_money(t.activos)],
        ['Pasivos (Deudas)', PER_money(t.pasivos)],
        ['Capital', PER_money(t.capital)],
        ['Dinero en cuentas', PER_money(t.totalDin)],
        ['Plata (g)', PER_f2(t.totalGr)+' g'],
        ['Activos varios', PER_money(t.activosVarios)],
        ['$ por g', PER_money(t.spot)]
      ].forEach(function(row){
        var b=document.createElement('div');
        var ll=document.createElement('label'); ll.textContent=row[0];
        var v=document.createElement('input'); v.readOnly=true; v.className='ro'; v.value=row[1];
        b.appendChild(ll); b.appendChild(v); kpis.appendChild(b);
      });

      gridC.innerHTML='';
      DB.personal.cuentas.forEach(function(c){
        var b=document.createElement('div');
        var ll=document.createElement('label'); ll.textContent=c.nombre + (c.tipo==='metal'?' (g)':'');
        var v=document.createElement('input'); v.readOnly=true; v.className='ro';
        v.value = (c.tipo==='metal') ? (PER_f2(c.saldoGr||0)+' g  ≈  '+PER_money((c.saldoGr||0)*t.spot))
                                     : PER_money(c.saldo||0);
        b.appendChild(ll); b.appendChild(v); gridC.appendChild(b);
      });
    }
    pintaKPIs();

    /* ---- Calendario semanal ---- */
    var wrap=document.createElement('div'); wrap.className='card';
    var h2=document.createElement('h2'); h2.textContent='Semana actual'; wrap.appendChild(h2);

    var weekStart = PER_startOfWeek(hoyStr());
    var grid=document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(7,minmax(160px,1fr))'; grid.style.gap='10px';

    var dias=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    for(var iDay=0;iDay<7;iDay++){
      (function(iDay){
        var dayBox=document.createElement('div'); dayBox.className='card';
        var dte=PER_addDays(weekStart,iDay);
        var title=document.createElement('div'); title.innerHTML='<b>'+dias[iDay]+'</b> · '+PER_fmtISO(dte);
        dayBox.appendChild(title);

        var bag=document.createElement('div'); bag.className='actions'; bag.style.flexDirection='column'; bag.style.alignItems='stretch';

        DB.personal.deudas.forEach(function(d){
          if(d.proximaFecha===PER_fmtISO(dte) && Number((d.saldoPendiente!=null?d.saldoPendiente:d.saldoActual)||0)>0){
            var pill=document.createElement('button'); pill.className='btn-warn';
            pill.style.justifyContent='space-between';
            var tasaM=Number(d.tasaAnual||0)/12/100;
            var base=(d.saldoPendiente!=null?d.saldoPendiente:d.saldoActual)||0;
            var interes=Math.max(0,Number(base)*tasaM);
            pill.innerHTML='💳 '+(d.acreedor||'Deuda')+'<span><b>'+PER_money(interes)+'</b> interés</span>';
            pill.addEventListener('click', function(){ PER_deudaAbrir(d.id); });
            bag.appendChild(pill);
          }
        });

        DB.personal.ingresos.forEach(function(ing){
          if(ing.proximaFecha===PER_fmtISO(dte)){
            var pill2=document.createElement('button'); pill2.className='btn';
            pill2.style.justifyContent='space-between';
            pill2.innerHTML='💵 '+(ing.descripcion||'Ingreso')+'<span><b>'+PER_money(ing.monto||0)+'</b></span>';
            pill2.addEventListener('click', function(){ PER_ingresoAbrir(ing.id); });
            bag.appendChild(pill2);
          }
        });

        DB.personal.presupuestos.forEach(function(p){
          if(p.fechaObjetivo===PER_fmtISO(dte)){
            var pill3=document.createElement('button'); pill3.className='btn';
            pill3.style.justifyContent='space-between';
            pill3.innerHTML='📝 '+(p.concepto||'Presupuesto')+'<span><b>'+PER_money(p.monto||0)+'</b></span>';
            pill3.addEventListener('click', function(){ PER_presupuestoAbrir(p.id); });
            bag.appendChild(pill3);
          }
        });

        dayBox.appendChild(bag); grid.appendChild(dayBox);
      })(iDay);
    }
    wrap.appendChild(grid); host.appendChild(wrap);
  });
}

/* ===================================================================
   CUENTAS Y MOVIMIENTOS (dinero/metal) + INVENTARIO DE PLATA
====================================================================*/
function PER_nextInvId(){ return 'PIM'+Date.now(); }
function PER_nextInvFolio(){ DB.personal.folioInv+=1; saveDB(DB); return DB.personal.folioInv; }
function PER_applyMov(mov, sign){
  var cta=DB.personal.cuentas.find(function(c){return c.id===mov.cuentaId;});
  if(!cta) return;
  var s=(sign||1)* (mov.tipo==='egreso'?-1:1);
  if(cta.tipo==='dinero'){ cta.saldo = Number(cta.saldo||0) + s*Number(mov.monto||0); }
  else { cta.saldoGr = Number(cta.saldoGr||0) + s*Number(mov.gramos||0); }
  saveDB(DB);
}

function PER_movsList(){
  openTab('per-movs','Personal · Cuentas y Movimientos', function(host){
    host.innerHTML='';

    // Header acciones
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo movimiento';
    bNew.addEventListener('click', function(){ PER_movNuevo(); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    // Saldos
    var resumen=document.createElement('div'); resumen.className='card';
    var h=document.createElement('h2'); h.textContent='Saldos'; resumen.appendChild(h);
    var grid=document.createElement('div'); grid.className='grid';
    DB.personal.cuentas.forEach(function(c){
      var d=document.createElement('div');
      var l=document.createElement('label'); l.textContent=c.nombre+(c.tipo==='metal'?' (g)':'');
      var i=document.createElement('input'); i.readOnly=true; i.className='ro';
      i.value=(c.tipo==='metal')? (PER_f2(c.saldoGr||0)+' g') : PER_money(c.saldo||0);
      d.appendChild(l); d.appendChild(i); grid.appendChild(d);
    });
    resumen.appendChild(grid); host.appendChild(resumen);

    // Filtros + tabla
    var card=document.createElement('div'); card.className='card';
    var h2=document.createElement('h2'); h2.textContent='Movimientos'; card.appendChild(h2);

    var gf=document.createElement('div'); gf.className='grid';
    var dC=document.createElement('div'); var lC=document.createElement('label'); lC.textContent='Cuenta';
    var sC=document.createElement('select'); var opAll=document.createElement('option'); opAll.value=''; opAll.textContent='Todas'; sC.appendChild(opAll);
    DB.personal.cuentas.forEach(function(c){ var op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; sC.appendChild(op); });
    dC.appendChild(lC); dC.appendChild(sC); gf.appendChild(dC);
    var dF1=document.createElement('div'); var lF1=document.createElement('label'); lF1.textContent='Desde'; var iF1=document.createElement('input'); iF1.type='date';
    dF1.appendChild(lF1); dF1.appendChild(iF1); gf.appendChild(dF1);
    var dF2=document.createElement('div'); var lF2=document.createElement('label'); lF2.textContent='Hasta'; var iF2=document.createElement('input'); iF2.type='date';
    dF2.appendChild(lF2); dF2.appendChild(iF2); gf.appendChild(dF2);
    card.appendChild(gf);

    var rowAct=document.createElement('div'); rowAct.className='actions';
    var spacer=document.createElement('div'); spacer.style.flex='1';
    var bBuscar=document.createElement('button'); bBuscar.className='btn'; bBuscar.textContent='Buscar';
    bBuscar.style.background='#0a3a74'; bBuscar.style.color='#fff'; bBuscar.style.border='1px solid #0a3a74';
    rowAct.appendChild(spacer); rowAct.appendChild(bBuscar); card.appendChild(rowAct);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Cuenta','Tipo','Unidad','Cantidad','Concepto',' '].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    card.appendChild(tbl); host.appendChild(card);

    function pintar(){
      tbody.innerHTML='';
      DB.personal.invMovs.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(m){
        var ok=true;
        if(sC.value) ok=ok && m.cuentaId===sC.value;
        if(iF1.value) ok=ok && m.fecha>=iF1.value;
        if(iF2.value) ok=ok && m.fecha<=iF2.value;
        if(!ok) return;

        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_movAbrir(m.id); });
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
        var cta=(DB.personal.cuentas.find(function(c){return c.id===m.cuentaId;})||{}).nombre || '—';
        var unidad=(m.unidad==='metal')?'Gramos':'Dinero';
        var cant=(m.unidad==='metal')? (PER_f2(m.gramos||0)+' g') : PER_money(m.monto||0);
        tr.appendChild(td(String(m.folio).padStart(3,'0')));
        tr.appendChild(td(m.fecha||'—'));
        tr.appendChild(td(cta));
        tr.appendChild(td(m.tipo||'—'));
        tr.appendChild(td(unidad));
        tr.appendChild(td(cant));
        tr.appendChild(td(m.concepto||''));
        var tda=document.createElement('td'); tda.textContent='›'; tda.style.textAlign='right'; tr.appendChild(tda);
        tbody.appendChild(tr);
      });
    }
    bBuscar.addEventListener('click', pintar);
    pintar();
  });
}

// Inventario de plata (atajo a movimientos filtrados a metal)
function PER_plataList(){
  openTab('per-plata','Personal · Inventario de Plata', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo ingreso de plata';
    bNew.addEventListener('click', function(){ PER_movNuevo('metal','ingreso'); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    var ctaPlata = DB.personal.cuentas.find(function(c){return c.tipo==='metal';});
    var saldoCard=document.createElement('div'); saldoCard.className='card';
    var h=document.createElement('h2'); h.textContent='Saldo de plata'; saldoCard.appendChild(h);
    var box=document.createElement('div'); box.className='grid';
    var d=document.createElement('div'); var l=document.createElement('label'); l.textContent=ctaPlata?ctaPlata.nombre+' (g)':'Plata (g)';
    var inp=document.createElement('input'); inp.readOnly=true; inp.className='ro'; inp.value=PER_f2((ctaPlata&&ctaPlata.saldoGr)||0)+' g';
    d.appendChild(l); d.appendChild(inp); box.appendChild(d); saldoCard.appendChild(box); host.appendChild(saldoCard);

    // Reutilizamos la lista de movimientos con filtro a metal
    var card=document.createElement('div'); card.className='card';
    var h2=document.createElement('h2'); h2.textContent='Movimientos de plata'; card.appendChild(h2);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Tipo','Gramos','Concepto',' '].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    card.appendChild(tbl); host.appendChild(card);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.invMovs.filter(function(m){
        var cta=DB.personal.cuentas.find(function(c){return c.id===m.cuentaId;});
        return cta && cta.tipo==='metal';
      }).sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(m){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_movAbrir(m.id); });
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
        tr.appendChild(td(String(m.folio).padStart(3,'0')));
        tr.appendChild(td(m.fecha||'—'));
        tr.appendChild(td(m.tipo||'—'));
        tr.appendChild(td(PER_f2(m.gramos||0)+' g'));
        tr.appendChild(td(m.concepto||''));
        var tda=document.createElement('td'); tda.textContent='›'; tda.style.textAlign='right'; tr.appendChild(tda);
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

function PER_movNuevo(forceUnidad, forceTipo){
  var mov={
    id: PER_nextInvId(),
    folio: PER_nextInvFolio(),
    ts: Date.now(),
    bloqueado: false,
    fecha: hoyStr(),
    cuentaId: '',
    tipo: forceTipo || 'ingreso',   // ingreso | egreso
    unidad: forceUnidad || 'dinero',// dinero | metal (se ajusta por cuenta)
    monto: 0,
    gramos: 0,
    concepto: '',
    evidencia: ''
  };
  // si fuerza metal, preselecciona cuenta metal
  if(forceUnidad==='metal'){
    var metal=DB.personal.cuentas.find(function(c){return c.tipo==='metal';});
    if(metal) mov.cuentaId=metal.id;
  }
  DB.personal.invMovs.push(mov); saveDB(DB);
  PER_movAbrir(mov.id);
}

function PER_movAbrir(id){
  var m=DB.personal.invMovs.find(function(x){return x.id===id;}); if(!m) return;

  openTab('per-mov-'+m.id, m.bloqueado?('Movimiento '+String(m.folio).padStart(3,'0')):'Registrar movimiento', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo movimiento';
    bNew.addEventListener('click', function(){ PER_movNuevo(); });
    var bPrint=document.createElement('button'); bPrint.className='btn'; bPrint.textContent='🖨️ Imprimir';
    bPrint.addEventListener('click', function(){ alert('PDF del movimiento.'); });
    var bWA=document.createElement('button'); bWA.className='btn'; bWA.textContent='WhatsApp';
    bWA.addEventListener('click', function(){ alert('Enviar PDF por WhatsApp.'); });
    left.appendChild(bNew); left.appendChild(bPrint); left.appendChild(bWA); top.appendChild(left);

    var right=document.createElement('div'); right.className='actions';
    var bMain=document.createElement('button');
    if(m.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ m.bloqueado=false; saveDB(DB); PER_movAbrir(m.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        if(!m.cuentaId){ alert('Selecciona la cuenta.'); return; }
        var cta=DB.personal.cuentas.find(function(c){return c.id===m.cuentaId;});
        if(!cta){ alert('Cuenta inválida.'); return; }
        if(cta.tipo==='dinero' && !(Number(m.monto||0))) { alert('Captura un monto.'); return; }
        if(cta.tipo==='metal'  && !(Number(m.gramos||0))) { alert('Captura gramos.'); return; }
        if(m.__aplicado){ PER_applyMov(m,-1); }
        PER_applyMov(m,+1);
        m.__aplicado=true; m.bloqueado=true; saveDB(DB);
        alert('Movimiento guardado con folio '+String(m.folio).padStart(3,'0'));
        PER_movAbrir(m.id);
      });
    }
    right.appendChild(bMain); top.appendChild(right); host.appendChild(top);

    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent=m.bloqueado?('Movimiento '+String(m.folio).padStart(3,'0')):'Registrar movimiento'; card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    // Fecha
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Fecha';
      var i=document.createElement('input'); i.type='date'; i.value=m.fecha; if(m.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('change', function(){ m.fecha=i.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    // Cuenta
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Cuenta';
      var s=document.createElement('select'); var op0=document.createElement('option'); op0.value=''; op0.textContent='(Selecciona)'; s.appendChild(op0);
      DB.personal.cuentas.forEach(function(c){ var op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; if(m.cuentaId===c.id) op.selected=true; s.appendChild(op); });
      if(m.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ m.cuentaId=s.value; var cta=DB.personal.cuentas.find(function(c){return c.id===m.cuentaId;}); m.unidad=cta&&cta.tipo==='metal'?'metal':'dinero'; saveDB(DB); renderUnidad(); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    })();

    // Tipo
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Tipo de movimiento';
      var s=document.createElement('select'); [['ingreso','Ingreso'],['egreso','Egreso']].forEach(function(p){ var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(m.tipo===p[0]) op.selected=true; s.appendChild(op); });
      if(m.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ m.tipo=s.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    })();

    // Concepto
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Concepto / Descripción';
      var i=document.createElement('input'); i.type='text'; i.value=m.concepto||''; if(m.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ m.concepto=i.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    card.appendChild(g); host.appendChild(card);

    function renderUnidad(){
      var old=qs('#per-unidad',host); if(old) old.remove();
      var wrap=document.createElement('div'); wrap.className='card'; wrap.id='per-unidad';
      var gg=document.createElement('div'); gg.className='grid';
      var cta=DB.personal.cuentas.find(function(c){return c.id===m.cuentaId;});
      var esMetal = cta? cta.tipo==='metal' : (m.unidad==='metal');

      if(esMetal){
        var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Gramos (permite negativos)';
        var i=document.createElement('input'); i.type='number'; i.step='0.01'; i.value=Number(m.gramos||0);
        if(m.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
        i.addEventListener('input', function(){ m.gramos=parseFloat(i.value||'0'); saveDB(DB); });
        dv.appendChild(l); dv.appendChild(i); gg.appendChild(dv);
      }else{
        var dv2=document.createElement('div'); var l2=document.createElement('label'); l2.textContent='Monto (permite negativos)';
        var i2=document.createElement('input'); i2.type='text'; i2.value=PER_money(m.monto||0); i2.style.fontWeight='800';
        if(m.bloqueado){ i2.readOnly=true; i2.classList.add('ro'); }
        i2.addEventListener('focus', function(){ if(m.bloqueado) return; i2.value=String(PER_parseMoney(i2.value)); });
        i2.addEventListener('blur', function(){ if(m.bloqueado) return; m.monto=PER_parseMoney(i2.value); i2.value=PER_money(m.monto); saveDB(DB); });
        dv2.appendChild(l2); dv2.appendChild(i2); gg.appendChild(dv2);
      }

      wrap.appendChild(gg); host.appendChild(wrap);
    }
    renderUnidad();
  });
}

/* ===================================================================
   DEUDAS
====================================================================*/
function PER_nextDeudaId(){ return 'PDEU'+Date.now(); }
function PER_nextDeudaFolio(){ DB.personal.folioDeuda+=1; saveDB(DB); return DB.personal.folioDeuda; }

function PER_deudasList(){
  openTab('per-deu','Personal · Deudas', function(host){
    host.innerHTML='';
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nueva deuda';
    bNew.addEventListener('click', function(){ PER_deudaNueva(); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Listado de deudas'; c.appendChild(h);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Acreedor','Saldo','Próxima fecha','Frecuencia'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl); host.appendChild(c);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.deudas.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(d){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_deudaAbrir(d.id); });
        function td(x){ var e=document.createElement('td'); e.textContent=x; return e; }
        var saldo = (d.saldoPendiente!=null?d.saldoPendiente:(d.saldoActual!=null?d.saldoActual:d.montoOriginal))||0;
        tr.appendChild(td(String(d.folio).padStart(3,'0')));
        tr.appendChild(td(d.acreedor||'—'));
        tr.appendChild(td(PER_money(saldo)));
        tr.appendChild(td(d.proximaFecha||'—'));
        tr.appendChild(td(d.frecuencia||'mensual'));
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

function PER_deudaNueva(){
  var d={
    id: PER_nextDeudaId(),
    folio: PER_nextDeudaFolio(),
    ts: Date.now(),
    bloqueado: false,
    acreedor: '',
    montoOriginal: 0,
    saldoPendiente: 0,     // usaremos este como saldo principal
    tasaAnual: 0,
    frecuencia: 'mensual', // mensual | quincenal | semanal | cada_x_dias
    diaMes: 15,
    cadaDias: 30,
    proximaFecha: hoyStr(),
    notas: ''
  };
  DB.personal.deudas.push(d); saveDB(DB);
  PER_deudaAbrir(d.id);
}

function PER_deudaAbrir(id){
  var d=DB.personal.deudas.find(function(x){return x.id===id;}); if(!d) return;

  openTab('per-deu-'+d.id, d.bloqueado?('Deuda '+String(d.folio).padStart(3,'0')):'Registrar deuda', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bPago=document.createElement('button'); bPago.className='btn'; bPago.textContent='Registrar pago';
    bPago.addEventListener('click', function(){ PER_deudaPagoDialog(d); });
    left.appendChild(bPago); top.appendChild(left);

    var right=document.createElement('div'); right.className='actions';
    var bMain=document.createElement('button');
    if(d.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ d.bloqueado=false; saveDB(DB); PER_deudaAbrir(d.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        if(!d.acreedor){ alert('Acreedor requerido'); return; }
        if(Number(d.montoOriginal||0)<=0){ alert('Monto original > 0'); return; }
        if(Number(d.saldoPendiente||0)<=0){ d.saldoPendiente = Number(d.montoOriginal||0); }
        // reprograma próxima fecha
        if(d.frecuencia==='mensual'){ d.proximaFecha=PER_nextByFreq(d.proximaFecha,'mensual',null,d.diaMes||15); }
        else if(d.frecuencia==='quincenal'){ d.proximaFecha=PER_nextByFreq(d.proximaFecha,'quincenal'); }
        else if(d.frecuencia==='semanal'){ d.proximaFecha=PER_nextByFreq(d.proximaFecha,'semanal'); }
        else if(d.frecuencia==='cada_x_dias'){ d.proximaFecha=PER_nextByFreq(d.proximaFecha,'cada_x_dias',d.cadaDias||30); }
        d.bloqueado=true; saveDB(DB);
        alert('Deuda guardada con folio '+String(d.folio).padStart(3,'0'));
        PER_deudaAbrir(d.id);
      });
    }
    right.appendChild(bMain); top.appendChild(right); host.appendChild(top);

    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent=d.bloqueado?('DEUDA FOLIO '+String(d.folio).padStart(3,'0')):'Registrar deuda'; card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    function text(label,val,setter,typ){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type=typ||'text'; i.value=val||''; if(d.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ setter(i.value); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }
    function money(label,val,setter){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type='text'; i.value=PER_money(val||0); i.style.fontWeight='800'; if(d.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('focus', function(){ if(d.bloqueado) return; i.value=String(PER_parseMoney(i.value)); });
      i.addEventListener('blur', function(){ if(d.bloqueado) return; var v=PER_parseMoney(i.value); setter(v); saveDB(DB); i.value=PER_money(v); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }
    function select(label,val,opts,setter){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var s=document.createElement('select'); opts.forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; if(val===o[0]) op.selected=true; s.appendChild(op); });
      if(d.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ setter(s.value); saveDB(DB); PER_deudaAbrir(d.id); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    }

    text('Acreedor', d.acreedor, function(v){ d.acreedor=v; });
    money('Monto original', d.montoOriginal, function(v){ d.montoOriginal=v; });
    money('Saldo pendiente', d.saldoPendiente, function(v){ d.saldoPendiente=v; });
    text('Tasa anual (%)', d.tasaAnual, function(v){ d.tasaAnual=parseFloat(v||'0'); }, 'number');

    select('Frecuencia', d.frecuencia, [['mensual','Mensual'],['quincenal','Quincenal'],['semanal','Semanal'],['cada_x_dias','Cada X días']], function(v){ d.frecuencia=v; });

    if(d.frecuencia==='mensual' || d.frecuencia==='quincenal'){
      text('Día del mes (1-31)', d.diaMes, function(v){ d.diaMes=parseInt(v||'15',10); }, 'number');
    }else if(d.frecuencia==='cada_x_dias'){
      text('Cada cuántos días', d.cadaDias, function(v){ d.cadaDias=parseInt(v||'30',10); }, 'number');
    }

    text('Próxima fecha', d.proximaFecha, function(v){ d.proximaFecha=v; }, 'date');

    // Notas
    var dN=document.createElement('div'); var lN=document.createElement('label'); lN.textContent='Notas';
    var tN=document.createElement('textarea'); tN.value=d.notas||''; if(d.bloqueado){ tN.readOnly=true; tN.classList.add('ro'); }
    tN.addEventListener('input', function(){ d.notas=tN.value; saveDB(DB); });
    dN.appendChild(lN); dN.appendChild(tN); g.appendChild(dN);

    card.appendChild(g); host.appendChild(card);
  });
}

function PER_deudaPagoDialog(d){
  var tipo=prompt('Tipo de pago (interes | capital | ambos)','ambos'); if(!tipo) return; tipo=tipo.toLowerCase();
  var monto=parseFloat(prompt('Monto total pagado ($)','0')||'0'); if(!(monto>0)){ alert('Monto inválido'); return; }
  var tasaM=Number(d.tasaAnual||0)/12/100;
  var interesEst=Math.max(0, Number(d.saldoPendiente||0)*tasaM);
  var pagInt=0, pagCap=0;
  if(tipo==='interes'){ pagInt=Math.min(monto,interesEst); }
  else if(tipo==='capital'){ pagCap=Math.min(monto, Number(d.saldoPendiente||0)); }
  else { pagInt=Math.min(interesEst,monto); pagCap=Math.max(0, monto-pagInt); pagCap=Math.min(pagCap, Number(d.saldoPendiente||0)); }
  d.saldoPendiente=Math.max(0, Number(d.saldoPendiente||0)-pagCap);
  d.proximaFecha = PER_nextByFreq(d.proximaFecha||hoyStr(), d.frecuencia, d.cadaDias||30, d.diaMes||15);
  saveDB(DB);
  alert('Pago registrado. Interés: '+PER_money(pagInt)+' · Capital: '+PER_money(pagCap)+' · Saldo: '+PER_money(d.saldoPendiente));
  PER_deudaAbrir(d.id);
}

/* ===================================================================
   INGRESOS
====================================================================*/
function PER_nextIngresoId(){ return 'PING'+Date.now(); }
function PER_nextIngresoFolio(){ DB.personal.folioIngreso+=1; saveDB(DB); return DB.personal.folioIngreso; }

function PER_ingresosList(){
  openTab('per-ing','Personal · Ingresos', function(host){
    host.innerHTML='';
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo ingreso';
    bNew.addEventListener('click', function(){ PER_ingresoNuevo(); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Listado de ingresos'; c.appendChild(h);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Descripción','Monto','Próxima fecha','Frecuencia'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl); host.appendChild(c);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.ingresos.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(i){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_ingresoAbrir(i.id); });
        function td(x){ var e=document.createElement('td'); e.textContent=x; return e; }
        tr.appendChild(td(String(i.folio).padStart(3,'0')));
        tr.appendChild(td(i.descripcion||'—'));
        tr.appendChild(td(PER_money(i.monto||0)));
        tr.appendChild(td(i.proximaFecha||'—'));
        tr.appendChild(td(i.frecuencia||'mensual'));
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

function PER_ingresoNuevo(){
  var i={
    id: PER_nextIngresoId(),
    folio: PER_nextIngresoFolio(),
    ts: Date.now(),
    bloqueado:false,
    descripcion:'',
    monto:0,
    frecuencia:'quincenal', // mensual | quincenal | semanal | cada_x_dias
    diaMes:1,
    cadaDias:15,
    proximaFecha:hoyStr(),
    notas:''
  };
  DB.personal.ingresos.push(i); saveDB(DB);
  PER_ingresoAbrir(i.id);
}

function PER_ingresoAbrir(id){
  var ing=DB.personal.ingresos.find(function(x){return x.id===id;}); if(!ing) return;

  openTab('per-ing-'+ing.id, ing.bloqueado?('Ingreso '+String(ing.folio).padStart(3,'0')):'Registrar ingreso', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='flex-end';
    var bMain=document.createElement('button');
    if(ing.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ ing.bloqueado=false; saveDB(DB); PER_ingresoAbrir(ing.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        if(!ing.descripcion){ alert('Descripción requerida'); return; }
        if(Number(ing.monto||0)<=0){ alert('Monto > 0'); return; }
        if(ing.frecuencia==='mensual'){ ing.proximaFecha=PER_nextByFreq(ing.proximaFecha,'mensual',null,ing.diaMes||1); }
        else if(ing.frecuencia==='quincenal'){ ing.proximaFecha=PER_nextByFreq(ing.proximaFecha,'quincenal'); }
        else if(ing.frecuencia==='semanal'){ ing.proximaFecha=PER_nextByFreq(ing.proximaFecha,'semanal'); }
        else if(ing.frecuencia==='cada_x_dias'){ ing.proximaFecha=PER_nextByFreq(ing.proximaFecha,'cada_x_dias',ing.cadaDias||15); }
        ing.bloqueado=true; saveDB(DB);
        alert('Ingreso guardado con folio '+String(ing.folio).padStart(3,'0'));
        PER_ingresoAbrir(ing.id);
      });
    }
    top.appendChild(bMain); host.appendChild(top);

    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent=ing.bloqueado?('INGRESO FOLIO '+String(ing.folio).padStart(3,'0')):'Registrar ingreso'; card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    function field(label, val, prop, type){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type=type||'text'; i.value=val||'';
      if(ing.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ ing[prop] = (i.type==='number')? parseFloat(i.value||'0') : i.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }

    field('Descripción', ing.descripcion, 'descripcion', 'text');
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Monto ($)';
      var i=document.createElement('input'); i.type='text'; i.value=PER_money(ing.monto||0); i.style.fontWeight='800';
      if(ing.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('focus', function(){ if(ing.bloqueado) return; i.value=String(PER_parseMoney(i.value)); });
      i.addEventListener('blur', function(){ if(ing.bloqueado) return; ing.monto=PER_parseMoney(i.value); i.value=PER_money(ing.monto); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    // Frecuencia
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Frecuencia';
      var s=document.createElement('select'); [['mensual','Mensual'],['quincenal','Quincenal'],['semanal','Semanal'],['cada_x_dias','Cada X días']].forEach(function(p){ var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(ing.frecuencia===p[0]) op.selected=true; s.appendChild(op); });
      if(ing.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ ing.frecuencia=s.value; saveDB(DB); PER_ingresoAbrir(ing.id); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    })();

    if(ing.frecuencia==='mensual'){
      field('Día del mes (1–31)', ing.diaMes, 'diaMes', 'number');
    }else if(ing.frecuencia==='cada_x_dias'){
      field('Cada cuántos días', ing.cadaDias, 'cadaDias', 'number');
    }

    field('Próxima fecha', ing.proximaFecha, 'proximaFecha', 'date');

    var dN=document.createElement('div'); var lN=document.createElement('label'); lN.textContent='Notas';
    var tN=document.createElement('textarea'); tN.value=ing.notas||'';
    if(ing.bloqueado){ tN.readOnly=true; tN.classList.add('ro'); }
    tN.addEventListener('input', function(){ ing.notas=tN.value; saveDB(DB); });
    dN.appendChild(lN); dN.appendChild(tN); g.appendChild(dN);

    card.appendChild(g); host.appendChild(card);
  });
}

/* ===================================================================
   PRESUPUESTOS  (＋ corregido: abre siempre)
====================================================================*/
function PER_nextPresId(){ return 'PPRE'+Date.now(); }
function PER_nextPresFolio(){ DB.personal.folioPres+=1; saveDB(DB); return DB.personal.folioPres; }

function PER_presupuestosList(){
  openTab('per-pre','Personal · Presupuestos', function(host){
    host.innerHTML='';
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo presupuesto';
    bNew.addEventListener('click', function(){ PER_presupuestoNuevo(); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Listado de presupuestos'; c.appendChild(h);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Concepto','Fecha objetivo','Monto'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl); host.appendChild(c);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.presupuestos.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(p){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_presupuestoAbrir(p.id); });
        function td(x){ var e=document.createElement('td'); e.textContent=x; return e; }
        tr.appendChild(td(String(p.folio).padStart(3,'0')));
        tr.appendChild(td(p.concepto||'—'));
        tr.appendChild(td(p.fechaObjetivo||'—'));
        tr.appendChild(td(PER_money(p.monto||0)));
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

function PER_presupuestoNuevo(){
  var p={
    id: PER_nextPresId(),
    folio: PER_nextPresFolio(),
    ts: Date.now(),
    bloqueado:false,
    concepto:'',
    fechaObjetivo: hoyStr(),
    monto:0,
    notas:''
  };
  DB.personal.presupuestos.push(p); saveDB(DB);
  PER_presupuestoAbrir(p.id);
}

function PER_presupuestoAbrir(id){
  var p=DB.personal.presupuestos.find(function(x){return x.id===id;}); if(!p) return;

  openTab('per-pre-'+p.id, p.bloqueado?('Presupuesto '+String(p.folio).padStart(3,'0')):'Registrar presupuesto', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='flex-end';
    var bMain=document.createElement('button');
    if(p.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ p.bloqueado=false; saveDB(DB); PER_presupuestoAbrir(p.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        if(!p.concepto){ alert('Concepto requerido'); return; }
        if(Number(p.monto||0)<=0){ alert('Monto > 0'); return; }
        p.bloqueado=true; saveDB(DB);
        alert('Presupuesto guardado con folio '+String(p.folio).padStart(3,'0'));
        PER_presupuestoAbrir(p.id);
      });
    }
    top.appendChild(bMain); host.appendChild(top);

    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent=p.bloqueado?('PRESUPUESTO FOLIO '+String(p.folio).padStart(3,'0')):'Registrar presupuesto'; card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    function field(label,val,prop,type){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type=type||'text'; i.value=val||'';
      if(p.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ p[prop]=(i.type==='number')?parseFloat(i.value||'0'):i.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }
    field('Concepto', p.concepto,'concepto','text');
    field('Fecha objetivo', p.fechaObjetivo,'fechaObjetivo','date');
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Monto ($)';
      var i=document.createElement('input'); i.type='text'; i.value=PER_money(p.monto||0); i.style.fontWeight='800';
      if(p.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('focus', function(){ if(p.bloqueado) return; i.value=String(PER_parseMoney(i.value)); });
      i.addEventListener('blur', function(){ if(p.bloqueado) return; p.monto=PER_parseMoney(i.value); i.value=PER_money(p.monto); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    var dN=document.createElement('div'); var lN=document.createElement('label'); lN.textContent='Notas';
    var tN=document.createElement('textarea'); tN.value=p.notas||''; if(p.bloqueado){ tN.readOnly=true; tN.classList.add('ro'); }
    tN.addEventListener('input', function(){ p.notas=tN.value; saveDB(DB); });
    dN.appendChild(lN); dN.appendChild(tN); g.appendChild(dN);

    card.appendChild(g); host.appendChild(card);
  });
}

/* ===================================================================
   ACTIVOS VARIOS
====================================================================*/
function PER_nextActId(){ return 'PACT'+Date.now(); }
function PER_nextActFolio(){ DB.personal.folioActivo+=1; saveDB(DB); return DB.personal.folioActivo; }

function PER_activosList(){
  openTab('per-act','Personal · Activos varios', function(host){
    host.innerHTML='';
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo activo';
    bNew.addEventListener('click', function(){ PER_activoNuevo(); });
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Listado de activos'; c.appendChild(h);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Descripción','Cantidad','PU','Total'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl); host.appendChild(c);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.activos.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(a){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_activoAbrir(a.id); });
        function td(x){ var e=document.createElement('td'); e.textContent=x; return e; }
        tr.appendChild(td(String(a.folio).padStart(3,'0')));
        tr.appendChild(td(a.fecha||'—'));
        tr.appendChild(td(a.descripcion||'—'));
        tr.appendChild(td(a.cantidad||0));
        tr.appendChild(td(PER_money(a.precio||0)));
        tr.appendChild(td(PER_money(Number(a.cantidad||0)*Number(a.precio||0))));
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

function PER_activoNuevo(){
  var a={ id:PER_nextActId(), folio:PER_nextActFolio(), ts:Date.now(), bloqueado:false,
          fecha:hoyStr(), descripcion:'', cantidad:1, precio:0 };
  DB.personal.activos.push(a); saveDB(DB);
  PER_activoAbrir(a.id);
}

function PER_activoAbrir(id){
  var a=DB.personal.activos.find(function(x){return x.id===id;}); if(!a) return;

  openTab('per-act-'+a.id, a.bloqueado?('Activo '+String(a.folio).padStart(3,'0')):'Registrar activo', function(host){
    host.innerHTML='';

    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='flex-end';
    var bMain=document.createElement('button');
    if(a.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ a.bloqueado=false; saveDB(DB); PER_activoAbrir(a.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        if(!a.descripcion){ alert('Descripción requerida'); return; }
        if(Number(a.cantidad||0)<=0){ alert('Cantidad > 0'); return; }
        if(Number(a.precio||0)<=0){ alert('Precio > 0'); return; }
        a.bloqueado=true; saveDB(DB);
        alert('Activo guardado con folio '+String(a.folio).padStart(3,'0'));
        PER_activoAbrir(a.id);
      });
    }
    top.appendChild(bMain); host.appendChild(top);

    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent=a.bloqueado?('ACTIVO FOLIO '+String(a.folio).padStart(3,'0')):'Registrar activo'; card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    function txt(label,val,setter,typ){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type=typ||'text'; i.value=val||''; if(a.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ setter(i.value); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }
    function num(label,val,setter){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent=label;
      var i=document.createElement('input'); i.type='number'; i.value=val||0; if(a.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ setter(parseFloat(i.value||'0')); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    }

    txt('Descripción', a.descripcion, function(v){ a.descripcion=v; });
    num('Cantidad', a.cantidad, function(v){ a.cantidad=v; });
    num('Precio unitario', a.precio, function(v){ a.precio=v; });

    card.appendChild(g); host.appendChild(card);
  });
}


})();

