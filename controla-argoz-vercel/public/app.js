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
/* =========================  PRODUCCIÓN → MAQUILADORES con SUCURSALES  ========================= */

/* === Estilos finos ya existentes se mantienen === */

/* ===== Estado/persistencia (ampliado) ===== */
if(!DB.otsMaquila){ DB.otsMaquila = []; saveDB(DB); }
// folios por sucursal ya están en DB.folios.maquila (Parte A)

/* ===== Home de Maquiladores (filtra por sucursal) ===== */
function renderMaquiladoresHome(){
  var host = qs('#subpanel'); if(!host) return;
  host.innerHTML = '';

  var card = document.createElement('div'); card.className='card';
  var h2 = document.createElement('h2');
  var sucId = sucursalActual();
  h2.textContent = 'Maquiladores · ' + nombreSucursal(sucId) + ' (' + sucId + ')';
  card.appendChild(h2);

  var actions = document.createElement('div'); actions.className='actions';

  var btnNew = document.createElement('button'); btnNew.className='btn-primary'; btnNew.textContent='+ Nueva OT';
  btnNew.addEventListener('click', function(){ abrirOTMaquilaNuevo(); });
  actions.appendChild(btnNew);

  var btnPend = document.createElement('button'); btnPend.className='btn-outline'; btnPend.textContent='OT pendientes (esta sucursal)';
  btnPend.addEventListener('click', function(){ listarOTMaquila(false, false); });
  actions.appendChild(btnPend);

  var btnCerr = document.createElement('button'); btnCerr.className='btn-outline'; btnCerr.textContent='OT cerradas (esta sucursal)';
  btnCerr.addEventListener('click', function(){ listarOTMaquila(true, false); });
  actions.appendChild(btnCerr);

  // toggle opcional: ver todas (consolidado)
  var btnAll = document.createElement('button'); btnAll.className='btn'; btnAll.textContent='Ver TODAS (consolidado)';
  btnAll.addEventListener('click', function(){ listarOTMaquila(null, true); });
  actions.appendChild(btnAll);

  card.appendChild(actions);
  host.appendChild(card);

  listarOTMaquila(false, false);
}

/* ===== Crear / Listar OTs por sucursal ===== */
function nuevoOTMaquilaBase(){
  var sucId = sucursalActual();
  var folioNum = nextFolioMaquila(sucId);
  var id = 'M' + Date.now();
  var hoy = hoyStr();

  var obj = {
    id: id,
    sucursalId: sucId,                // 🔴 sucursal dueña de la OT
    folio: folioNum,                  // número por sucursal
    fecha: hoy,
    hora: horaStr(),
    nombreMaquilador: '',
    promesaFecha: addDays(hoy, 15),
    promesaHora: '13:00',
    comentarios: '',
    mermaPactadaPct: 0,
    precioPorGramo: 0,
    precioPorPieza: 0,
    estimadoGr: 0,
    estimadoPzas: 0,
    evidencia: DB.evidencia || '',
    pedidoLineas: [ { descripcion:'', piezas:0, gramos:0, obs:'' } ],
    materiales:   [ { materialId:'925', materialLibre:'', detalle:'', gramos:0, aleacion:0, subtotal:0, especificaciones:'' } ],
    extras:       [ { material:'', piezas:0, gramos:0, obs:'' } ],
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

function listarOTMaquila(cerradas /* true/false/null */, verTodas /* bool */){
  var host = qs('#subpanel');
  var card = document.createElement('div'); card.className='card';
  var sucId = sucursalActual();

  var titulo = 'OT ' + (cerradas===true?'cerradas':cerradas===false?'pendientes':'(todas)') + (verTodas?' (consolidado)':' · '+sucId);
  var h2 = document.createElement('h2'); h2.textContent = titulo; card.appendChild(h2);

  var lista = DB.otsMaquila
    .filter(function(x){
      var okSuc = verTodas ? true : (x.sucursalId === sucId);
      var okCerr = (cerradas===null) ? true : (!!x.cerrado === !!cerradas);
      return okSuc && okCerr;
    })
    .sort(function(a,b){
      // ordenar: primero por sucursal, luego por folio desc
      if(a.sucursalId!==b.sucursalId){ return a.sucursalId < b.sucursalId ? -1 : 1; }
      return b.folio - a.folio;
    });

  if(lista.length === 0){
    var p = document.createElement('p'); p.textContent = 'Sin registros.'; card.appendChild(p);
    host.appendChild(card); return;
  }

  lista.forEach(function(m){
    var row = document.createElement('div'); row.className = 'actions';
    var pill = document.createElement('span'); pill.className = 'pill';
    pill.textContent = m.sucursalId + '-' + String(m.folio).padStart(3,'0');
    row.appendChild(pill);
    var btn = document.createElement('button'); btn.className='btn'; btn.textContent = m.cerrado ? 'Ver PDF' : 'Abrir / Procesar';
    btn.addEventListener('click', function(){ if(m.cerrado){ imprimirPDFMaquila(m,false); } else { abrirOTMaquilaExistente(m.id, true); } });
    row.appendChild(btn);
    card.appendChild(row);
  });
  host.appendChild(card);
}

/* ===== Abrir OT (agrega selector visual de sucursal — bloqueado si ya guardada) ===== */
function abrirOTMaquilaNuevo(){ var id = nuevoOTMaquilaBase(); abrirOTMaquilaExistente(id, false); }

function abrirOTMaquilaExistente(id, modoProcesar){
  var ot = DB.otsMaquila.find(function(x){ return x.id===id; });
  if(!ot){ toast('OT no encontrada'); return; }
  var titulo = 'OT ' + ot.sucursalId + '-' + String(ot.folio).padStart(3,'0');

  openTab('otmaq-'+ot.id, titulo, function(host){
    host.innerHTML = '';
    var card = document.createElement('div'); card.className='card';

    /* --- Barra maestra superior --- */
    var topbar = document.createElement('div');
    topbar.style.display = 'flex';
    topbar.style.justifyContent = 'flex-end';
    topbar.style.gap = '8px';
    topbar.style.marginBottom = '4px';

    // 👁️ Vista previa
    var bVista = document.createElement('button'); bVista.className='btn'; bVista.textContent='👁️ Vista previa';
    bVista.title = 'Vista previa / PDF';
    bVista.addEventListener('click', function(){ imprimirPDFMaquila(ot, true); });
    topbar.appendChild(bVista);

    if(!modoProcesar){
      var bGuardar = document.createElement('button'); bGuardar.className='btn-primary'; bGuardar.textContent='💾 Guardar';
      bGuardar.addEventListener('click', function(){
        // Validación: la OT pertenece a UNA sucursal y no mezcla inventarios
        if(!ot.sucursalId){ alert('Selecciona sucursal.'); return; }
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

    // Sucursal (bloqueado si ya hay datos capturados o en modo procesar)
    var dvSuc = document.createElement('div');
    var lbSuc = document.createElement('label'); lbSuc.textContent='Sucursal (dueña de la OT)';
    var selSuc = document.createElement('select');
    SUCURSALES.forEach(function(s){
      var op=document.createElement('option'); op.value=s.id; op.textContent=s.nombre + ' ('+s.id+')';
      if(s.id===ot.sucursalId){ op.selected=true; }
      selSuc.appendChild(op);
    });
    // regla: no permitir cambiar sucursal si ya guardaste (para no mezclar inventario)
    var bloqueaSucursal = !!modoProcesar || !!ot.materiales?.some(function(li){return (li.gramos||0)>0 || (li.aleacion||0)>0;});
    selSuc.disabled = bloqueaSucursal;
    if(bloqueaSucursal){ selSuc.classList.add('ro'); }
    selSuc.addEventListener('change', function(){ ot.sucursalId = selSuc.value; saveDB(DB); });
    dvSuc.appendChild(lbSuc); dvSuc.appendChild(selSuc);

    var dvLogo = document.createElement('div');
    var lbLogo = document.createElement('label'); lbLogo.textContent = 'ORDEN DE TRABAJO';
    var imgLogo = document.createElement('img'); imgLogo.src='/logo.webp'; imgLogo.alt='logo'; imgLogo.style.height='40px'; imgLogo.style.objectFit='contain';
    dvLogo.appendChild(lbLogo); dvLogo.appendChild(imgLogo);

    var dvFolio = document.createElement('div'); var lbFo = document.createElement('label'); lbFo.textContent='Folio';
    var inFo = document.createElement('input'); inFo.readOnly = true;
    inFo.value = (ot.sucursalId||'') + '-' + String(ot.folio).padStart(3,'0');
    inFo.style.color='#b91c1c';
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

    headerWrap.appendChild(dvSuc);
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

    /* Evidencia global (igual que antes) */
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

    /* Chips / Resumen dinámico (sin cambios visuales) */
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
        { t: 'Sucursal: '+(ot.sucursalId||'—') },
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

    /* --- Detalle de pedido (igual UI, solo amarrado a sucursal de la OT) --- */
    var sec2 = document.createElement('div'); sec2.className='card';
    var h2b = document.createElement('h2'); h2b.textContent='Detalle de pedido'; sec2.appendChild(h2b);
    sec2.appendChild(tablaPedidoParaOT({
      lineas: ot.pedidoLineas,
      bloqueado: !!modoProcesar,
      onChange: function(){ saveDB(DB); }
    }));
    card.appendChild(sec2);

    /* --- Entrega de materiales (valida contra sucursal de la OT; no mezcla) --- */
    var sec3 = document.createElement('div'); sec3.className='card ot-sec3-wrap';
    var h3 = document.createElement('h2'); h3.textContent='Entrega de materiales'; sec3.appendChild(h3);
    sec3.appendChild(tablaMaterialesOT({
      lineas: ot.materiales,
      bloqueado: !!modoProcesar,
      onChange: function(){
        // Regla: no inventarios mezclados (ya garantizada por tener una sola sucursal en la OT)
        // (Si más adelante ligas existencias por almacén+sucursal, aquí validas contra disponibles)
        saveDB(DB); actualizarChips();
      }
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

/* ===== Cierre OT (merma real → gasto sucursal; asiento pendiente) ===== */
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

  // Marca cierre
  ot.cerrado = true;
  saveDB(DB);

  // 🔴 Genera “asiento pendiente” para la sucursal (la valuación $ la haces en tu submenú de valorización mensual)
  if(mermaAbs>0){
    DB.pendientesContables.push({
      id: 'AS'+Date.now(),
      modulo: 'maquila',
      tipo: 'gasto_merma',
      sucursalId: ot.sucursalId,
      fecha: hoyStr(),
      referencia: ot.sucursalId+'-'+String(ot.folio).padStart(3,'0'),
      gramos: mermaAbs,              // se expresa en gramos
      valorUnitario: null,           // se completa al valorizar por “última compra” (submódulo mensual)
      monto: null,                   // se calculará entonces
      detalles: 'Merma real en cierre de OT'
    });
    saveDB(DB);
  }

  toast('OT cerrada');
  imprimirPDFMaquila(ot, false);
}

/* ===== PDF (agrega sucursal al encabezado) ===== */
function imprimirPDFMaquila(ot, isDraft){
  // ... (conserva toda tu lógica previa)

  // Reemplaza SOLO la cabecera que imprime folio por esta línea:
  // H.push('<div class="row"><div class="col"><b>Folio:</b> '+String(ot.folio).padStart(3,'0')+'</div>...
  // por:
  //   '<b>Folio:</b> '+(ot.sucursalId||'')+'-'+String(ot.folio).padStart(3,'0')

  // Dentro de la versión completa que ya tienes, edita la línea del folio así:
  // (un ejemplo de inserción directa)
  // ...
  // H.push('<div class="row"><div class="col"><b>Folio:</b> '+(ot.sucursalId||'')+'-'+String(ot.folio).padStart(3,'0')+'</div><div class="col"><b>Fecha:</b> '+ot.fecha+' '+ot.hora+'</div><div class="col"><b>Maquilador:</b> '+escapeHTML(ot.nombreMaquilador)+'</div></div>');
  // H.push('<div class="row"><div class="col"><b>Sucursal:</b> '+(ot.sucursalId||'')+' — '+nombreSucursal(ot.sucursalId)+'</div><div class="col"><b>Promesa:</b> '+ot.promesaFecha+' '+ot.promesaHora+'</div><div class="col"><b>Merma pactada:</b> '+f2(ot.mermaPactadaPct)+'%</div><div class="col"><b>$ estimado:</b> '+f2(manoEstim)+'</div></div>');
  // ...
}


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

/* ================================================================
   PERSONAL · Traspasos de plata v1.0
   - Lista + alta de traspasos (sale de / entra a)
   - Aplica egreso de gramos al GUARDAR (bloquea hoja)
   - Código de traspaso para recepción externa; estado ABIERTO/CERRADO
=================================================================*/

/* --- Estado y folios --- */
(function PER_ensureTraspasos(){
  if(!DB.personal) DB.personal = {};
  if(!Array.isArray(DB.personal.traspasos)) DB.personal.traspasos = [];
  if(typeof DB.personal.folioTrasp !== 'number') DB.personal.folioTrasp = 0;
  saveDB(DB);
})();
function PER_nextTraspId(){ return 'PTRS'+Date.now(); }
function PER_nextTraspFolio(){ DB.personal.folioTrasp+=1; saveDB(DB); return DB.personal.folioTrasp; }
function PER_makeTraspCode(t){ return ['TRF', String(t.folio).padStart(3,'0'), t.fecha.replaceAll('-',''), Math.round(Number(t.gramos||0)*100)].join('-'); }

/* --- Entrada de menú: Traspasos --- */
/* Reemplazamos suavemente el render del submenú para añadir “Traspasos de plata”
   sin cambiar el resto de estructura. */
(function PER_patchMenuAddTraspasos(){
  var _old = PER_renderSubmenu;
  PER_renderSubmenu = function(){
    _old();
    // Inserta el botón extra si no existe
    var host = qs('#subpanel'); if(!host) return;
    var card = host.querySelector('.card'); if(!card) return;
    var list = card.querySelector('.actions'); if(!list) return;

    if(!list.querySelector('[data-per-menu="traspasos"]')){
      var btn=document.createElement('button');
      btn.className='btn'; btn.style.justifyContent='flex-start';
      btn.setAttribute('data-per-menu','traspasos');
      btn.innerHTML='🔁 Traspasos de plata';
      btn.addEventListener('click', PER_traspasosList);
      list.appendChild(btn);
    }
  };
})();

/* --- Lista de traspasos --- */
function PER_traspasosList(){
  openTab('per-tras','Personal · Traspasos de plata', function(host){
    host.innerHTML='';

    // Header
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';
    var bNew=document.createElement('button'); bNew.className='btn'; bNew.textContent='＋ Nuevo traspaso';
    bNew.addEventListener('click', PER_traspasoNuevo);
    left.appendChild(bNew); top.appendChild(left); host.appendChild(top);

    // Tabla
    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Listado de traspasos'; c.appendChild(h);

    var tbl=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Sale de','Entra a','Gramos','Código','Estatus',' '].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    c.appendChild(tbl); host.appendChild(c);

    function pinta(){
      tbody.innerHTML='';
      DB.personal.traspasos.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0);}).forEach(function(t){
        var tr=document.createElement('tr'); tr.style.cursor='pointer';
        tr.addEventListener('click', function(){ PER_traspasoAbrir(t.id); });
        function td(x){ var e=document.createElement('td'); e.textContent=x; return e; }
        var saleDe = (DB.personal.cuentas.find(function(c){return c.id===t.cuentaSalidaId;})||{}).nombre || '—';
        var entraA = t.destinoTipo==='abierto' ? 'Abierto (pendiente)' : (t.destinoNombre||'—');
        tr.appendChild(td(String(t.folio).padStart(3,'0')));
        tr.appendChild(td(t.fecha||'—'));
        tr.appendChild(td(saleDe));
        tr.appendChild(td(entraA));
        tr.appendChild(td(Number(t.gramos||0).toFixed(2)+' g'));
        tr.appendChild(td(t.codigo||'—'));
        tr.appendChild(td(t.estatus||'ABIERTO'));
        var tdArrow=document.createElement('td'); tdArrow.textContent='›'; tdArrow.style.textAlign='right'; tr.appendChild(tdArrow);
        tbody.appendChild(tr);
      });
    }
    pinta();
  });
}

/* --- Nuevo / Abrir traspaso --- */
function PER_traspasoNuevo(){
  var t={
    id: PER_nextTraspId(),
    folio: PER_nextTraspFolio(),
    ts: Date.now(),
    bloqueado:false,
    fecha: hoyStr(),
    cuentaSalidaId: (function(){
      var metal = DB.personal.cuentas.find(function(c){return c.tipo==='metal';});
      return metal ? metal.id : '';
    })(),
    destinoTipo:'abierto',      // abierto | cuenta
    destinoNombre:'',           // Texto libre (ej. "Plata Taller · Caja")
    destinoCuentaId:'',         // (opcional si en mismo sistema)
    gramos:0,
    notas:'',
    estatus:'ABIERTO',
    codigo:'' ,                 // TRF-...
    invMovId:null               // vínculo con movimiento (egreso) aplicado
  };
  DB.personal.traspasos.push(t); saveDB(DB);
  PER_traspasoAbrir(t.id);
}

function PER_traspasoAbrir(id){
  var t=DB.personal.traspasos.find(function(x){return x.id===id;}); if(!t) return;

  openTab('per-tras-'+t.id, t.bloqueado?('Traspaso '+String(t.folio).padStart(3,'0')):'Registrar traspaso de plata', function(host){
    host.innerHTML='';

    // Barra superior
    var top=document.createElement('div'); top.className='actions'; top.style.justifyContent='space-between';
    var left=document.createElement('div'); left.className='actions';

    var bCerrar=document.createElement('button'); bCerrar.className='btn';
    bCerrar.textContent='✔️ Cerrar traspaso';
    bCerrar.disabled = (t.estatus==='CERRADO');
    bCerrar.addEventListener('click', function(){
      if(t.estatus==='CERRADO'){ return; }
      t.estatus='CERRADO';
      t.fechaCierre = hoyStr();
      t.bloqueado = true;
      saveDB(DB);
      alert('Traspaso cerrado.');
      PER_traspasoAbrir(t.id);
    });
    left.appendChild(bCerrar);

    var right=document.createElement('div'); right.className='actions';
    var bMain=document.createElement('button');
    if(t.bloqueado){
      bMain.className='btn'; bMain.textContent='✏️ Editar';
      bMain.addEventListener('click', function(){ t.bloqueado=false; saveDB(DB); PER_traspasoAbrir(t.id); });
    }else{
      bMain.className='btn-primary'; bMain.textContent='GUARDAR';
      bMain.addEventListener('click', function(){
        // Validaciones
        if(!t.cuentaSalidaId){ alert('Selecciona la cuenta de salida.'); return; }
        var cta=DB.personal.cuentas.find(function(c){return c.id===t.cuentaSalidaId && c.tipo==='metal';});
        if(!cta){ alert('La cuenta de salida debe ser de plata (g).'); return; }
        if(Number(t.gramos||0) <= 0){ alert('Captura los gramos a traspasar (> 0).'); return; }

        // Genera código si no existe
        if(!t.codigo){ t.codigo = PER_makeTraspCode(t); }

        // Aplica egreso de gramos (crea movimiento vinculado si aún no aplicado)
        if(!t.invMovId){
          var mov={
            id: PER_nextInvId(), folio: PER_nextInvFolio(), ts: Date.now(),
            bloqueado:true, fecha: t.fecha, cuentaId: t.cuentaSalidaId,
            tipo:'egreso', unidad:'metal', gramos: Number(t.gramos||0), monto: 0,
            concepto: 'Traspaso: '+(t.destinoTipo==='abierto'?'Abierto':(t.destinoNombre||'Destino')),
            evidencia:''
          };
          DB.personal.invMovs.push(mov);
          PER_applyMov(mov,+1); // resta gramos
          mov.__aplicado = true;
          t.invMovId = mov.id;
        }

        t.bloqueado=true;
        saveDB(DB);
        alert('Traspaso guardado con folio '+String(t.folio).padStart(3,'0')+'\nCódigo: '+t.codigo);
        PER_traspasoAbrir(t.id);
      });
    }
    right.appendChild(bMain);

    top.appendChild(left); top.appendChild(right); host.appendChild(top);

    // Hoja
    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent = t.bloqueado?('TRASPASO FOLIO '+String(t.folio).padStart(3,'0')):'Registrar traspaso de plata';
    card.appendChild(h);

    var g=document.createElement('div'); g.className='grid';

    // Fecha
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Fecha';
      var i=document.createElement('input'); i.type='date'; i.value=t.fecha||hoyStr();
      if(t.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('change', function(){ t.fecha=i.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    // Sale de (solo cuentas metal personales)
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Sale de (plata personal)';
      var s=document.createElement('select'); var op0=document.createElement('option'); op0.value=''; op0.textContent='(Selecciona)'; s.appendChild(op0);
      DB.personal.cuentas.filter(function(c){return c.tipo==='metal';}).forEach(function(c){
        var op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; if(t.cuentaSalidaId===c.id) op.selected=true; s.appendChild(op);
      });
      if(t.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ t.cuentaSalidaId=s.value; saveDB(DB); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    })();

    // Entra a (abierto o especificar destino)
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Entra a';
      var s=document.createElement('select');
      [['abierto','Abierto (pendiente de recepción)'],['cuenta','Seleccionar/Escribir destino']].forEach(function(p){
        var op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(t.destinoTipo===p[0]) op.selected=true; s.appendChild(op);
      });
      if(t.bloqueado){ s.disabled=true; s.classList.add('ro'); }
      s.addEventListener('change', function(){ t.destinoTipo=s.value; saveDB(DB); renderDestino(); });
      dv.appendChild(l); dv.appendChild(s); g.appendChild(dv);
    })();

    // Gramos
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Gramos a traspasar';
      var i=document.createElement('input'); i.type='number'; i.step='0.01'; i.min='0.01'; i.value=Number(t.gramos||0);
      if(t.bloqueado){ i.readOnly=true; i.classList.add('ro'); }
      i.addEventListener('input', function(){ t.gramos=parseFloat(i.value||'0'); saveDB(DB); });
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    // Código (solo lectura una vez generado)
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Código de traspaso';
      var i=document.createElement('input'); i.type='text'; i.readOnly=true; i.className='ro';
      i.value = t.codigo || '(se generará al GUARDAR)';
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    // Estatus
    (function(){
      var dv=document.createElement('div'); var l=document.createElement('label'); l.textContent='Estatus';
      var i=document.createElement('input'); i.readOnly=true; i.className='ro'; i.value=t.estatus || 'ABIERTO';
      dv.appendChild(l); dv.appendChild(i); g.appendChild(dv);
    })();

    card.appendChild(g);

    // Notas
    var dN=document.createElement('div'); dN.className='grid';
    var dvN=document.createElement('div'); var lN=document.createElement('label'); lN.textContent='Notas';
    var tN=document.createElement('textarea'); tN.value=t.notas||''; if(t.bloqueado){ tN.readOnly=true; tN.classList.add('ro'); }
    tN.addEventListener('input', function(){ t.notas=tN.value; saveDB(DB); });
    dvN.appendChild(lN); dvN.appendChild(tN); dN.appendChild(dvN);
    card.appendChild(dN);

    host.appendChild(card);

    function renderDestino(){
      var old=qs('#per-destino-wrap', host); if(old) old.remove();
      if(t.destinoTipo!=='cuenta') return;
      var wrap=document.createElement('div'); wrap.className='card'; wrap.id='per-destino-wrap';
      var gg=document.createElement('div'); gg.className='grid';

      // Nombre libre del destino (ej. “Taller · Caja de plata”)
      var dv1=document.createElement('div'); var l1=document.createElement('label'); l1.textContent='Destino (texto)';
      var i1=document.createElement('input'); i1.type='text'; i1.value=t.destinoNombre||'';
      if(t.bloqueado){ i1.readOnly=true; i1.classList.add('ro'); }
      i1.addEventListener('input', function(){ t.destinoNombre=i1.value; saveDB(DB); });
      dv1.appendChild(l1); dv1.appendChild(i1); gg.appendChild(dv1);

      // (Opcional) ID de cuenta destino si está en el mismo sistema (para referencia)
      var dv2=document.createElement('div'); var l2=document.createElement('label'); l2.textContent='Cuenta destino (opcional, si existe en sistema)';
      var i2=document.createElement('input'); i2.type='text'; i2.placeholder='p.ej. taller_caja_plata'; i2.value=t.destinoCuentaId||'';
      if(t.bloqueado){ i2.readOnly=true; i2.classList.add('ro'); }
      i2.addEventListener('input', function(){ t.destinoCuentaId=i2.value; saveDB(DB); });
      dv2.appendChild(l2); dv2.appendChild(i2); gg.appendChild(dv2);

      wrap.appendChild(gg); host.appendChild(wrap);
    }
    renderDestino();
  });
}

/* =========================  INFRA: SUCURSALES (GLOBAL)  ========================= */
(function initSucursalesInfra(){
  // 1) Catálogo fijo por ahora (puedes expandirlo luego desde Configuración)
  var SUCURSALES = [
    { id:'TAL', nombre:'Taller' },
    { id:'ART', nombre:'Arturo' }
  ];
  window.SUCURSALES = SUCURSALES; // disponible global

  // 2) Persistencia/migración
  if(!window.DB){ window.DB = {}; }
  if(!DB.sucursalActualId){ DB.sucursalActualId = 'TAL'; }
  if(!DB.folios){
    DB.folios = { maquila: { TAL:0, ART:0 } }; // folios independientes por sucursal
  }else{
    // migra faltantes
    DB.folios.maquila = DB.folios.maquila || {};
    if(typeof DB.folios.maquila.TAL !== 'number'){ DB.folios.maquila.TAL = 0; }
    if(typeof DB.folios.maquila.ART !== 'number'){ DB.folios.maquila.ART = 0; }
  }
  if(!DB.pendientesContables){ DB.pendientesContables = []; } // asientos diferidos (merma, etc.)
  if(!DB.otsMaquila){ DB.otsMaquila = []; }

  // util
  function save(){ try{ saveDB(DB); }catch(e){} }

  // 3) Selector fijo en barra superior (mismo look & feel)
  if(!document.querySelector('#sucursal-switcher')){
    var top = document.querySelector('.topbar') || document.body;
    var wrap = document.createElement('div');
    wrap.id = 'sucursal-switcher';
    wrap.style.position = 'fixed';
    wrap.style.top = '8px';
    wrap.style.right = '12px';
    wrap.style.zIndex = '9999';
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.alignItems = 'center';

    var lbl = document.createElement('span');
    lbl.textContent = 'Sucursal:';
    lbl.className = 'pill';
    lbl.style.cursor = 'default';

    var sel = document.createElement('select');
    sel.className = 'pill';
    sel.style.height = '28px';
    SUCURSALES.forEach(function(s){
      var op = document.createElement('option');
      op.value = s.id; op.textContent = s.nombre + ' ('+s.id+')';
      if(s.id === DB.sucursalActualId) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function(){
      DB.sucursalActualId = sel.value;
      save();
      toast('Sucursal activa: ' + sel.value);
      // refrescar vistas actuales que dependan de sucursal:
      var activeTab = document.querySelector('#tabs .tab.active');
      if(activeTab){
        var id = activeTab.getAttribute('data-tab') || '';
        // si es una lista, recárgala; si es una OT abierta, solo actualiza chips
        if(id.startsWith('otmaq-')){ /* no cerramos, solo dejamos en sesión */ }
        // re-render del submenú actual si existe:
        try{ renderSubmenu && renderSubmenu(document.querySelector('.tree-btn.active')?.getAttribute('data-root')); }catch(e){}
      }
    });

    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    top.appendChild(wrap);
  }

  // 4) Helpers globales
  window.sucursalActual = function(){ return DB.sucursalActualId || 'TAL'; };
  window.nombreSucursal = function(id){
    var s = SUCURSALES.find(function(x){ return x.id===id; });
    return s ? s.nombre : id;
  };
  window.nextFolioMaquila = function(sucId){
    var sid = sucId || sucursalActual();
    DB.folios.maquila[sid] = (DB.folios.maquila[sid]||0) + 1;
    save();
    return DB.folios.maquila[sid];
  };
})();


})();

