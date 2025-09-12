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



})();
