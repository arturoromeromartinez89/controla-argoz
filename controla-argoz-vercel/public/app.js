/* CONTROL-A · app.js v2.4.1
   Módulos: Traspasos (previo) + Pedidos
   Cambios en esta versión:
   - Importar Excel (CSV) SOLO desde la hoja de trabajo del pedido (no aparece en el submenú)
   - Se elimina cualquier referencia a abrirImportadorCSV en el submenú
   - Mantiene: confirmación y limpieza tras guardar, listado de pedidos pendientes, etc.
*/

(function(){
  "use strict";

  // ===== Utilidades UI =====
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
  function toast(msg){ var t=qs('#toast'); if(!t)return; t.textContent=msg; t.style.display='block'; setTimeout(function(){ t.style.display='none'; },2200); }

  // ===== Persistencia =====
  var STORAGE_KEY='CONTROL_A_DB';
  function loadDB(){
    try{
      var raw=localStorage.getItem(STORAGE_KEY);
      if(!raw){
        return {
          traspasos:[], folio:0, evidencia:'',
          pedidos:[], pedFolio:0
        };
      }
      var obj=JSON.parse(raw);
      if(!obj.traspasos){ obj.traspasos=[]; }
      if(typeof obj.folio!=='number'){ obj.folio=0; }
      if(typeof obj.evidencia!=='string'){ obj.evidencia=''; }
      if(!obj.pedidos){ obj.pedidos=[]; }
      if(typeof obj.pedFolio!=='number'){ obj.pedFolio=0; }
      return obj;
    }catch(e){
      return { traspasos:[], folio:0, evidencia:'', pedidos:[], pedFolio:0 };
    }
  }
  function saveDB(db){ try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(db)); }catch(e){ console.error('saveDB error',e); } }
  var DB=loadDB();

  // ===== Catálogos =====
  var ALMACENES=[{id:'caja',nombre:'Caja fuerte'},{id:'prod',nombre:'Producción'}];
  var MATERIALES=[
    {id:'999',nombre:'Plata .999',aplicaAleacion:true,tolMerma:0.05},
    {id:'925',nombre:'Plata .925 sólida',aplicaAleacion:false,tolMerma:0.05},
    {id:'limalla',nombre:'Limalla sólida',aplicaAleacion:false,tolMerma:0.20},
    {id:'limalla_negra',nombre:'Limalla negra',aplicaAleacion:false,tolMerma:0.50},
    {id:'tierras',nombre:'Tierras',aplicaAleacion:false,tolMerma:0.70},
    {id:'terminado',nombre:'Mercancía terminada',aplicaAleacion:false,tolMerma:0.05}
  ];

  // ===== Helpers =====
  function hoyStr(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0'); }
  function horaStr(){ var d=new Date(); return String(d.getHours()).padStart(2,'0')+":"+String(d.getMinutes()).padStart(2,'0'); }
  function f2(n){ return (parseFloat(n||0)).toFixed(2); }
  function nombreAlmacen(id){ var a=ALMACENES.find(function(x){ return x.id===id; }); return a? a.nombre:id; }
  function nombreMaterial(id){ var m=MATERIALES.find(function(x){ return x.id===id; }); return m? m.nombre:id; }
  function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g,function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; }); }

  // ===== TABS =====
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

  // ===== SUBMENÚS =====
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

      var btnAbiertos = document.createElement('button');
      btnAbiertos.className = 'btn-outline';
      btnAbiertos.textContent = 'Traspasos pendientes';
      btnAbiertos.addEventListener('click', function(){ listarTraspasosAbiertos(true); });
      acciones.appendChild(btnAbiertos);

      var btnCerrados = document.createElement('button');
      btnCerrados.className = 'btn-outline';
      btnCerrados.textContent = 'Folios cerrados';
      btnCerrados.addEventListener('click', function(){ listarTraspasosCerrados(); });
      acciones.appendChild(btnCerrados);

      card.appendChild(acciones);
      host.appendChild(card);

      listarTraspasosAbiertos(false);
    }
    else if(root === 'pedidos'){
      h2.textContent = 'Pedidos';
      card.appendChild(h2);

      var acciones2 = document.createElement('div');
      acciones2.className = 'actions';

      var btnNewP = document.createElement('button');
      btnNewP.className = 'btn-primary';
      btnNewP.textContent = '+ Nuevo pedido';
      btnNewP.addEventListener('click', function(){ abrirPedidoNuevo(); });
      acciones2.appendChild(btnNewP);

      var btnPend = document.createElement('button');
      btnPend.className = 'btn-outline';
      btnPend.textContent = 'Pedidos pendientes';
      btnPend.addEventListener('click', function(){ listarPedidosPendientes(true); });
      acciones2.appendChild(btnPend);

      // (Importar CSV se quitó del submenú a petición: solo dentro de la hoja del pedido)

      card.appendChild(acciones2);
      host.appendChild(card);

      listarPedidosPendientes(false);
    }
    else{
      h2.textContent = 'Submenú';
      card.appendChild(h2);
      host.appendChild(card);
    }
  }

  // =====================================================================================
  //                                    TRASPASOS (EXISTENTE)
  // =====================================================================================

  function listarTraspasosAbiertos(mostrarTituloExtra){
    var host = qs('#subpanel');
    var card = document.createElement('div');
    card.className = 'card';
    if(mostrarTituloExtra){
      var h = document.createElement('h2'); h.textContent = 'Traspasos pendientes'; card.appendChild(h);
    }
    var lst = DB.traspasos.filter(function(t){ return !t.cerrado; });
    if(lst.length === 0){
      var p = document.createElement('p'); p.textContent = 'Sin folios abiertos.'; card.appendChild(p);
    }else{
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
  function listarTraspasosCerrados(){
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
      id:id, folio:folioNum, tipo:'normal', fecha:hoyStr(), hora:horaStr(),
      saleDe:'caja', entraA:'prod', comentarios:'', totalGr:0,
      lineasEntrada: lineas,
      salida: { creada:true, fecha:hoyStr(), hora:horaStr(), saleDe:'prod', entraA:'caja', comentarios:'', lineas: salidaLineas, totalGr:0 },
      cerrado:false
    };
    if(obj.saleDe==='caja' && obj.entraA==='prod'){ obj.tipo='prod'; }
    DB.traspasos.push(obj); saveDB(DB);
    return obj.id;
  }
  function abrirTraspasoNuevo(){ var id = nuevoTraspasoBase(); abrirTraspasoExistente(id, false); }

  function abrirTraspasoExistente(id, modoProcesar){
    var tr = DB.traspasos.find(function(x){ return x.id===id; });
    if(!tr){ toast('No encontrado'); return; }
    if(!tr.salida || !tr.salida.lineas){
      tr.salida = { creada:true, fecha:hoyStr(), hora:horaStr(), saleDe:'prod', entraA:'caja', comentarios:'', lineas:[], totalGr:0 };
      saveDB(DB);
    }
    if(tr.salida.lineas.length===0){
      var i; for(i=0;i<3;i++){ tr.salida.lineas.push({ materialId:'925', detalle:'', gramos:0, aleacion:0, subtotal:0 }); }
      saveDB(DB);
    }

    var titulo = 'Traspaso ' + String(tr.folio).padStart(3, '0');

    openTab('trasp-' + id, titulo, function(host){
      host.innerHTML='';
      var card = document.createElement('div'); card.className='card';

      var grid1 = document.createElement('div'); grid1.className='grid';
      var dvFolio = document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio'; var inFol=document.createElement('input'); inFol.readOnly=true; inFol.value=String(tr.folio).padStart(3,'0'); dvFolio.appendChild(lbFo); dvFolio.appendChild(inFol);
      var dvFecha = document.createElement('div'); var lbF=document.createElement('label'); lbF.textContent='Fecha'; var inF=document.createElement('input'); inF.type='date'; inF.value=tr.fecha; inF.readOnly=!!modoProcesar; if(modoProcesar){ inF.classList.add('ro'); } inF.addEventListener('change',function(){ tr.fecha=inF.value; saveDB(DB); }); dvFecha.appendChild(lbF); dvFecha.appendChild(inF);
      var dvS = document.createElement('div'); var lbS=document.createElement('label'); lbS.textContent='Sale de'; var selS=document.createElement('select'); ALMACENES.forEach(function(a){ var op=document.createElement('option'); op.value=a.id; op.textContent=a.nombre; if(a.id===tr.saleDe) op.selected=true; selS.appendChild(op); }); selS.disabled=!!modoProcesar; selS.addEventListener('change',function(){ tr.saleDe=selS.value; tr.tipo=(tr.saleDe==='caja' && tr.entraA==='prod')?'prod':'normal'; saveDB(DB); inDisp.value=f2(calcDisponibles(tr.saleDe)); }); dvS.appendChild(lbS); dvS.appendChild(selS);
      var dvE = document.createElement('div'); var lbE=document.createElement('label'); lbE.textContent='Entra a'; var selE=document.createElement('select'); ALMACENES.forEach(function(a){ var op2=document.createElement('option'); op2.value=a.id; op2.textContent=a.nombre; if(a.id===tr.entraA) op2.selected=true; selE.appendChild(op2); }); selE.disabled=!!modoProcesar; selE.addEventListener('change',function(){ tr.entraA=selE.value; tr.tipo=(tr.saleDe==='caja' && tr.entraA==='prod')?'prod':'normal'; saveDB(DB); inDisp2.value=f2(calcDisponibles(tr.entraA)); }); dvE.appendChild(lbE); dvE.appendChild(selE);
      var dvC = document.createElement('div'); var lbC=document.createElement('label'); lbC.textContent='Comentarios'; var txC=document.createElement('textarea'); txC.value=tr.comentarios; txC.readOnly=!!modoProcesar; if(modoProcesar){ txC.classList.add('ro'); } txC.addEventListener('input',function(){ tr.comentarios=txC.value; saveDB(DB); }); dvC.appendChild(lbC); dvC.appendChild(txC);
      var dvT = document.createElement('div'); var lbT=document.createElement('label'); lbT.textContent='Total GR. (entrada)'; var inT=document.createElement('input'); inT.readOnly=true; inT.value=f2(tr.totalGr); dvT.appendChild(lbT); dvT.appendChild(inT);
      var dvDisp=document.createElement('div'); var lbD=document.createElement('label'); lbD.textContent='Grs disponibles en almacén origen'; var inDisp=document.createElement('input'); inDisp.readOnly=true; inDisp.value=f2(calcDisponibles(tr.saleDe)); dvDisp.appendChild(lbD); dvDisp.appendChild(inDisp);
      var dvDisp2=document.createElement('div'); var lbD2=document.createElement('label'); lbD2.textContent='Grs disponibles en almacén destino'; var inDisp2=document.createElement('input'); inDisp2.readOnly=true; inDisp2.value=f2(calcDisponibles(tr.entraA)); dvDisp2.appendChild(lbD2); dvDisp2.appendChild(inDisp2);
      grid1.appendChild(dvFolio); grid1.appendChild(dvFecha); grid1.appendChild(dvS); grid1.appendChild(dvE); grid1.appendChild(dvC); grid1.appendChild(dvT); grid1.appendChild(dvDisp); grid1.appendChild(dvDisp2);
      card.appendChild(grid1);

      card.appendChild(tablaLineasTraspaso({
        titulo:'ENTRADA', bloqueado:!!modoProcesar, lineas:tr.lineasEntrada,
        onAdd:function(){ tr.lineasEntrada.push({materialId:'925',detalle:'',gramos:0,aleacion:0,subtotal:0}); tr.totalGr=sumaSubtotales(tr.lineasEntrada); saveDB(DB); abrirTraspasoExistente(tr.id, modoProcesar); },
        onDel:function(){ if(tr.lineasEntrada.length>1){ tr.lineasEntrada.pop(); } tr.totalGr=sumaSubtotales(tr.lineasEntrada); saveDB(DB); abrirTraspasoExistente(tr.id, modoProcesar); },
        onChange:function(){ tr.totalGr=sumaSubtotales(tr.lineasEntrada); inT.value=f2(tr.totalGr); saveDB(DB); }
      }));

      if(!modoProcesar){
        var acts=document.createElement('div'); acts.className='actions';
        var btnGuardar=document.createElement('button'); btnGuardar.className='btn-primary'; btnGuardar.textContent='Guardar entrada';
        btnGuardar.addEventListener('click',function(){
          if(!confirm('¿Seguro que deseas guardar la ENTRADA?')) return;
          saveDB(DB);
          toast('Traspaso de entrada creado exitosamente; puedes consultarlo en "Traspasos pendientes".');
          var view=qs('#view-trasp-'+tr.id); if(view) view.remove();
          var tabBtn=qs('[data-tab="trasp-'+tr.id+'"]'); if(tabBtn) tabBtn.remove();
          renderSubmenu('inventarios');
        });
        acts.appendChild(btnGuardar);
        var btnVista=document.createElement('button'); btnVista.className='btn'; btnVista.textContent='Vista previa'; btnVista.addEventListener('click',function(){ imprimirPDF(tr,true); }); acts.appendChild(btnVista);
        card.appendChild(acts);
      }

      var bar=document.createElement('div'); bar.className='card';
      var h3=document.createElement('h2'); h3.textContent=modoProcesar?'SALIDA (editable)':'SALIDA (bloqueada hasta procesar)'; bar.appendChild(h3);
      var g2=document.createElement('div'); g2.className='grid';
      var dvFS=document.createElement('div'); var lbFS=document.createElement('label'); lbFS.textContent='Fecha salida'; var inFS=document.createElement('input'); inFS.type='date'; inFS.value=tr.salida.fecha; inFS.readOnly=!modoProcesar; if(!modoProcesar){ inFS.classList.add('ro'); } inFS.addEventListener('change',function(){ tr.salida.fecha=inFS.value; saveDB(DB); }); dvFS.appendChild(lbFS); dvFS.appendChild(inFS); g2.appendChild(dvFS);
      var dvSS=document.createElement('div'); var lbSS=document.createElement('label'); lbSS.textContent='Sale de (salida)'; var selSS=document.createElement('select'); ALMACENES.forEach(function(a){ var opS=document.createElement('option'); opS.value=a.id; opS.textContent=a.nombre; if(a.id===tr.salida.saleDe) opS.selected=true; selSS.appendChild(opS); }); selSS.disabled=!modoProcesar; selSS.addEventListener('change',function(){ tr.salida.saleDe=selSS.value; saveDB(DB); }); dvSS.appendChild(lbSS); dvSS.appendChild(selSS); g2.appendChild(dvSS);
      var dvSE=document.createElement('div'); var lbSE=document.createElement('label'); lbSE.textContent='Entra a (salida)'; var selSE=document.createElement('select'); ALMACENES.forEach(function(a){ var opE=document.createElement('option'); opE.value=a.id; opE.textContent=a.nombre; if(a.id===tr.salida.entraA) opE.selected=true; selSE.appendChild(opE); }); selSE.disabled=!modoProcesar; selSE.addEventListener('change',function(){ tr.salida.entraA=selSE.value; saveDB(DB); }); dvSE.appendChild(lbSE); dvSE.appendChild(selSE); g2.appendChild(dvSE);
      var dvCS=document.createElement('div'); var lbCS=document.createElement('label'); lbCS.textContent='Comentarios (salida)'; var txCS=document.createElement('textarea'); txCS.value=tr.salida.comentarios; txCS.readOnly=!modoProcesar; if(!modoProcesar){ txCS.classList.add('ro'); } txCS.addEventListener('input',function(){ tr.salida.comentarios=txCS.value; saveDB(DB); }); dvCS.appendChild(lbCS); dvCS.appendChild(txCS); g2.appendChild(dvCS);
      var dvTS=document.createElement('div'); var lbTS=document.createElement('label'); lbTS.textContent='Total GR. (salida)'; var inTS=document.createElement('input'); inTS.readOnly=true; inTS.value=f2(tr.salida.totalGr); dvTS.appendChild(lbTS); dvTS.appendChild(inTS); g2.appendChild(dvTS);
      bar.appendChild(g2);

      bar.appendChild(tablaLineasTraspaso({
        titulo:'SALIDA', bloqueado:!modoProcesar, lineas:tr.salida.lineas,
        onAdd:function(){ tr.salida.lineas.push({materialId:'925',detalle:'',gramos:0,aleacion:0,subtotal:0}); tr.salida.totalGr=sumaSubtotales(tr.salida.lineas); saveDB(DB); abrirTraspasoExistente(tr.id, modoProcesar); },
        onDel:function(){ if(tr.salida.lineas.length>1){ tr.salida.lineas.pop(); } tr.salida.totalGr=sumaSubtotales(tr.salida.lineas); saveDB(DB); abrirTraspasoExistente(tr.id, modoProcesar); },
        onChange:function(){ tr.salida.totalGr=sumaSubtotales(tr.salida.lineas); inTS.value=f2(tr.salida.totalGr); saveDB(DB); }
      }));

      if(modoProcesar){
        var acts2=document.createElement('div'); acts2.className='actions';
        var inJust=document.createElement('input'); inJust.type='text'; inJust.placeholder='Justificación (si regresas menos gramos — opcional)'; inJust.style.minWidth='280px'; acts2.appendChild(inJust);
        var btnCerrar=document.createElement('button'); btnCerrar.className='btn-primary'; btnCerrar.textContent='Guardar SALIDA / Cerrar folio'; btnCerrar.addEventListener('click',function(){ cerrarFolio(tr, inJust.value || ''); }); acts2.appendChild(btnCerrar);
        var btnPdf=document.createElement('button'); btnPdf.className='btn'; btnPdf.textContent='PDF'; btnPdf.addEventListener('click',function(){ if(tr.cerrado){ imprimirPDF(tr,false); } else { toast('Cierra el folio para generar PDF final.'); } }); acts2.appendChild(btnPdf);
        var btnWA=document.createElement('button'); btnWA.className='btn'; btnWA.title='Enviar PDF por WhatsApp'; btnWA.innerHTML='📱 WhatsApp'; btnWA.addEventListener('click',function(){ if(!tr.cerrado){ toast('Disponible después de cerrar el folio.'); return; } compartirWhatsApp(tr); }); acts2.appendChild(btnWA);
        bar.appendChild(acts2);
      }

      card.appendChild(bar);

      var divEv=document.createElement('div'); divEv.className='actions';
      var cam=document.createElement('span'); cam.textContent='📷';
      var lbl=document.createElement('span'); lbl.textContent=' Cargar evidencia en foto';
      var inFile=document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
      inFile.addEventListener('change',function(){ if(inFile.files && inFile.files[0]){ cargarEvidencia(inFile.files[0]); } });
      divEv.appendChild(cam); divEv.appendChild(lbl); divEv.appendChild(inFile);
      card.appendChild(divEv);

      host.appendChild(card);
    });
  }

  function tablaLineasTraspaso(cfg){
    var wrap=document.createElement('div');
    var topBar=document.createElement('div'); topBar.className='actions';
    var h=document.createElement('h2'); h.textContent=cfg.titulo; topBar.appendChild(h);
    var spacer=document.createElement('div'); spacer.style.flex='1'; topBar.appendChild(spacer);
    if(!cfg.bloqueado){
      var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea'; bAdd.addEventListener('click',function(){ if(typeof cfg.onAdd==='function'){ cfg.onAdd(); } }); topBar.appendChild(bAdd);
      var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última'; bDel.addEventListener('click',function(){ if(typeof cfg.onDel==='function'){ cfg.onDel(); } }); topBar.appendChild(bDel);
    }
    wrap.appendChild(topBar);

    var table=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    var headers=[{t:'#',w:'6%'},{t:'Material',w:'22%'},{t:'Detalle',w:'28%'},{t:'Gr',w:'12%'},{t:'Aleación',w:'14%'},{t:'Subtotal',w:'18%'}];
    var i; for(i=0;i<headers.length;i++){ var th=document.createElement('th'); th.textContent=headers[i].t; th.style.width=headers[i].w; trh.appendChild(th); }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody=document.createElement('tbody');

    function renderRow(idx){
      var li=cfg.lineas[idx];
      var tr=document.createElement('tr');

      var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);

      var td2=document.createElement('td');
      var sel=document.createElement('select'); sel.style.width='100%';
      MATERIALES.forEach(function(m){ var op=document.createElement('option'); op.value=m.id; op.textContent=m.nombre; if(m.id===li.materialId) op.selected=true; sel.appendChild(op); });
      sel.disabled=!!cfg.bloqueado;
      sel.addEventListener('change', function(){
        li.materialId = sel.value;
        if(li.materialId !== '999'){ li.aleacion=0; inAle.value='0.00'; }
        inAle.readOnly=(li.materialId!=='999') || !!cfg.bloqueado;
        if(inAle.readOnly){ inAle.classList.add('ro'); } else { inAle.classList.remove('ro'); }
        recalc();
      });
      td2.appendChild(sel); tr.appendChild(td2);

      var td3=document.createElement('td');
      var inDet=document.createElement('input'); inDet.type='text'; inDet.value=li.detalle; inDet.style.width='100%';
      inDet.readOnly=!!cfg.bloqueado; if(inDet.readOnly){ inDet.classList.add('ro'); }
      inDet.addEventListener('input', function(){ li.detalle=inDet.value; saveDB(DB); });
      td3.appendChild(inDet); tr.appendChild(td3);

      var tdGr=document.createElement('td');
      var inGr=document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.min='0'; inGr.value=li.gramos; inGr.style.width='100%';
      inGr.readOnly=!!cfg.bloqueado; if(inGr.readOnly){ inGr.classList.add('ro'); }
      inGr.addEventListener('input', function(){
        li.gramos=parseFloat(inGr.value||'0');
        if(li.materialId==='999' && !inAle.readOnly){
          var sugerida=li.gramos*0.07;
          inAle.value=f2(sugerida);
          li.aleacion=parseFloat(inAle.value||'0');
        }
        recalc();
      });
      tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdAle=document.createElement('td');
      var inAle=document.createElement('input'); inAle.type='number'; inAle.step='0.01'; inAle.min='0'; inAle.value=li.aleacion; inAle.style.width='100%';
      inAle.readOnly=(li.materialId!=='999') || !!cfg.bloqueado; if(inAle.readOnly){ inAle.classList.add('ro'); }
      inAle.addEventListener('input', function(){ li.aleacion=parseFloat(inAle.value||'0'); recalc(); });
      tdAle.appendChild(inAle); tr.appendChild(tdAle);

      var tdSub=document.createElement('td');
      var inSub=document.createElement('input'); inSub.readOnly=true; inSub.value=f2(li.subtotal); inSub.style.width='100%';
      tdSub.appendChild(inSub); tr.appendChild(tdSub);

      function recalc(){
        li.subtotal=(parseFloat(li.gramos||0)+parseFloat(li.aleacion||0));
        inSub.value=f2(li.subtotal);
        if(typeof cfg.onChange==='function'){ cfg.onChange(); }
        saveDB(DB);
      }
      tbody.appendChild(tr);
    }

    var r; for(r=0;r<cfg.lineas.length;r++){ renderRow(r); }
    table.appendChild(tbody); wrap.appendChild(table);
    return wrap;
  }

  function sumaSubtotales(arr){ var s=0, i; for(i=0;i<arr.length;i++){ s+=parseFloat(arr[i].subtotal||0); } return s; }
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
        var ex = prompt('No registraste "Mercancía terminada". Explica por qué (obligatorio para continuar):', '');
        if(!ex){ toast('No se puede cerrar sin explicación.'); return; }
        justificacion = ex;
      }
    }
    var ent = parseFloat(tr.totalGr||0);
    var sal = parseFloat(tr.salida.totalGr||0);
    var mermaAbs = Math.max(0, ent - sal);
    var mermaPct = ent>0 ? (mermaAbs/ent) : 0;

    var tol=0.05;
    tr.lineasEntrada.forEach(function(li){
      var mat=MATERIALES.find(function(m){ return m.id===li.materialId; });
      if(mat && mat.tolMerma>tol){ tol=mat.tolMerma; }
    });
    if(mermaPct>tol){
      alert('Según la información cargada se registra una merma superior al '+String((tol*100).toFixed(0))+'%.\nNo es posible cerrar este folio. Revisa tu línea de producción.');
      return;
    }
    tr.cerrado=true; tr.cerradoComentario=justificacion||''; saveDB(DB); toast('Folio cerrado'); imprimirPDF(tr,false);
  }

  function imprimirPDF(tr,isDraft){
    var w=window.open('', '_blank','width=840,height=900'); if(!w){ alert('Permite pop-ups para imprimir.'); return; }
    var dif=parseFloat(tr.salida.totalGr||0)-parseFloat(tr.totalGr||0);
    var mermaAbs=Math.max(0,parseFloat(tr.totalGr||0)-parseFloat(tr.salida.totalGr||0));
    var mermaPct=(parseFloat(tr.totalGr||0)>0)? (mermaAbs/parseFloat(tr.totalGr||0))*100:0;
    var headCss='@page{size:5.5in 8.5in;margin:10mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}h1.red{color:#b91c1c;}h2{margin:2px 0 6px 0;color:#0a2c4c;}table{width:100%;border-collapse:collapse;table-layout:fixed;}th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;word-break:break-word;}thead tr{background:#e7effa;}.row{display:flex;gap:8px;margin:6px 0;}.col{flex:1;}.signs{display:flex;justify-content:space-between;margin-top:18px;}.signs div{width:45%;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;}.water{position:fixed;top:40%;left:15%;font-size:48px;color:#94a3b880;transform:rotate(-20deg);}';
    var html=[];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Folio '+String(tr.folio).padStart(3,'0')+'</title><style>'+headCss+'</style></head><body>');
    if(isDraft){ html.push('<div class="water">BORRADOR</div>'); }
    html.push('<h1 class="red">Traspaso '+String(tr.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.fecha+' '+tr.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios:</b> '+escapeHTML(tr.comentarios)+'</div><div class="col"><b>Total GR (entrada):</b> '+f2(tr.totalGr)+'</div></div>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:22%">Material</th><th style="width:28%">Detalle</th><th style="width:12%">Gr</th><th style="width:14%">Aleación</th><th style="width:18%">Subtotal</th></tr></thead><tbody>');
    tr.lineasEntrada.forEach(function(li,i){ html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>'); });
    html.push('</tbody></table>');
    html.push('<div class="signs"><div>Entregó (entrada)</div><div>Recibió (entrada)</div></div>');
    html.push('<h2>Salida</h2>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.salida.fecha+' '+tr.salida.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.salida.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.salida.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios salida:</b> '+escapeHTML(tr.salida.comentarios)+'</div><div class="col"><b>Total GR (salida):</b> '+f2(tr.salida.totalGr)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>MERMA:</b> '+f2(mermaAbs)+' g ('+mermaPct.toFixed(1)+'%)</div><div class="col"><b>DIF:</b> '+(dif>=0?'+':'')+f2(dif)+'</div></div>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:22%">Material</th><th style="width:28%">Detalle</th><th style="width:12%">Gr</th><th style="width:14%">Aleación</th><th style="width:18%">Subtotal</th></tr></thead><tbody>');
    tr.salida.lineas.forEach(function(li,i){ html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>'); });
    html.push('</tbody></table>');
    html.push('<div class="signs"><div>Entregó (salida)</div><div>Recibió (salida)</div></div>');
    if(DB.evidencia){ html.push('<h3>Evidencia fotográfica</h3><img src="'+DB.evidencia+'" style="max-width:100%;max-height:300px;border:1px solid #ccc"/>'); }
    html.push('</body></html>');
    w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
  }
  function compartirWhatsApp(tr){ imprimirPDF(tr,false); toast('Guarda el PDF y compártelo por WhatsApp.'); }
  function cargarEvidencia(file){ var r=new FileReader(); r.onload=function(e){ DB.evidencia=e.target.result; saveDB(DB); toast('Foto cargada.'); }; r.readAsDataURL(file); }

  // =====================================================================================
  //                                        PEDIDOS (NUEVO)
  // =====================================================================================

  function listarPedidosPendientes(mostrarTitulo){
    var host=qs('#subpanel');
    var card=document.createElement('div'); card.className='card';
    if(mostrarTitulo){ var h=document.createElement('h2'); h.textContent='Pedidos pendientes'; card.appendChild(h); }
    var lst=DB.pedidos.filter(function(p){ return !p.cerrado; }).sort(function(a,b){ return b.folio - a.folio; });
    if(lst.length===0){
      var p=document.createElement('p'); p.textContent='Sin pedidos pendientes.'; card.appendChild(p);
    }else{
      lst.forEach(function(ped){
        var row=document.createElement('div'); row.className='actions';
        var pill=document.createElement('span'); pill.className='pill orange'; pill.textContent='Pedido '+String(ped.folio).padStart(3,'0')+' · '+(ped.cliente||'-'); row.appendChild(pill);
        var btn=document.createElement('button'); btn.className='btn'; btn.textContent='Abrir'; btn.addEventListener('click', function(){ abrirPedidoExistente(ped.id); }); row.appendChild(btn);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  function nuevoPedidoBase(){
    DB.pedFolio += 1;
    var id='P'+Date.now();
    var obj={
      id:id,
      folio:DB.pedFolio,
      fecha:hoyStr(),
      tipo:'cliente',     // 'cliente' | 'stock'
      cliente:'',
      estado:'Borrador',
      observaciones:'',
      lineas:[
        { codigo:'', descripcion:'', piezas:0, gramos:0, iva:0, observaciones:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, iva:0, observaciones:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, iva:0, observaciones:'' }
      ],
      totales:{ piezas:0, gramos:0 },
      cerrado:false
    };
    DB.pedidos.push(obj); saveDB(DB);
    return obj.id;
  }
  function abrirPedidoNuevo(){ var id=nuevoPedidoBase(); abrirPedidoExistente(id); }

  function abrirPedidoExistente(id){
    var ped=DB.pedidos.find(function(p){ return p.id===id; });
    if(!ped){ toast('No encontrado'); return; }
    var titulo='Pedido '+String(ped.folio).padStart(3,'0');

    openTab('ped-'+id, titulo, function(host){
      host.innerHTML='';
      var card=document.createElement('div'); card.className='card';

      var grid=document.createElement('div'); grid.className='grid';

      var dvFolio=document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio'; var inFo=document.createElement('input'); inFo.readOnly=true; inFo.value=String(ped.folio).padStart(3,'0'); dvFolio.appendChild(lbFo); dvFolio.appendChild(inFo);

      var dvFecha=document.createElement('div'); var lbFe=document.createElement('label'); lbFe.textContent='Fecha'; var inFe=document.createElement('input'); inFe.type='date'; inFe.value=ped.fecha; inFe.addEventListener('change',function(){ ped.fecha=inFe.value; saveDB(DB); }); dvFecha.appendChild(lbFe); dvFecha.appendChild(inFe);

      var dvTipo=document.createElement('div'); var lbTi=document.createElement('label'); lbTi.textContent='Tipo de pedido'; var selTi=document.createElement('select');
      var op1=document.createElement('option'); op1.value='cliente'; op1.textContent='Cliente'; selTi.appendChild(op1);
      var op2=document.createElement('option'); op2.value='stock'; op2.textContent='Stock'; selTi.appendChild(op2);
      selTi.value=ped.tipo; selTi.addEventListener('change',function(){ ped.tipo=selTi.value; saveDB(DB); });
      dvTipo.appendChild(lbTi); dvTipo.appendChild(selTi);

      var dvCli=document.createElement('div'); var lbCl=document.createElement('label'); lbCl.textContent='Cliente'; var inCl=document.createElement('input'); inCl.type='text'; inCl.value=ped.cliente; inCl.placeholder='Nombre del cliente'; inCl.addEventListener('input',function(){ ped.cliente=inCl.value; saveDB(DB); }); dvCli.appendChild(lbCl); dvCli.appendChild(inCl);

      var dvObs=document.createElement('div'); var lbOb=document.createElement('label'); lbOb.textContent='Observaciones'; var txOb=document.createElement('textarea'); txOb.value=ped.observaciones; txOb.addEventListener('input',function(){ ped.observaciones=txOb.value; saveDB(DB); }); dvObs.appendChild(lbOb); dvObs.appendChild(txOb);

      grid.appendChild(dvFolio); grid.appendChild(dvFecha); grid.appendChild(dvTipo); grid.appendChild(dvCli); grid.appendChild(dvObs);
      card.appendChild(grid);

      // Tabla + Importador CSV (aquí va el importador)
      card.appendChild(tablaLineasPedido({
        lineas: ped.lineas,
        onAdd: function(){ ped.lineas.push({codigo:'',descripcion:'',piezas:0,gramos:0,iva:0,observaciones:''}); recalcPedido(ped); saveDB(DB); abrirPedidoExistente(ped.id); },
        onDel: function(){ if(ped.lineas.length>1){ ped.lineas.pop(); } recalcPedido(ped); saveDB(DB); abrirPedidoExistente(ped.id); },
        onChange: function(){ recalcPedido(ped); saveDB(DB); }
      }));

      var acts=document.createElement('div'); acts.className='actions';

      // Importador CSV SOLO aquí
      var inpFile=document.createElement('input'); inpFile.type='file'; inpFile.accept='.csv,.CSV,.xlsx,.xls';
      inpFile.addEventListener('change', function(){
        var f=inpFile.files && inpFile.files[0] ? inpFile.files[0] : null;
        if(!f) return;
        var name=f.name.toLowerCase();
        if(name.endsWith('.xlsx') || name.endsWith('.xls')){
          alert('Por ahora el importador acepta CSV (desde Excel: Archivo → Guardar como → CSV). Sube el CSV y lo cargamos.');
          inpFile.value='';
          return;
        }
        leerCSVyCargarLineas(f, ped);
      });
      acts.appendChild(inpFile);

      var btnGuardar=document.createElement('button'); btnGuardar.className='btn-primary'; btnGuardar.textContent='Guardar pedido';
      btnGuardar.addEventListener('click', function(){
        if(!ped.cliente || ped.cliente.trim()===''){ alert('Escribe el nombre del cliente.'); return; }
        if(!confirm('¿Seguro que deseas guardar este pedido?')) return;
        saveDB(DB);
        toast('Pedido creado exitosamente; puedes consultarlo en "Pedidos pendientes".');
        var view=qs('#view-ped-'+ped.id); if(view) view.remove();
        var tabBtn=qs('[data-tab="ped-'+ped.id+'"]'); if(tabBtn) tabBtn.remove();
        renderSubmenu('pedidos');
      });
      acts.appendChild(btnGuardar);

      var btnVista=document.createElement('button'); btnVista.className='btn'; btnVista.textContent='Vista previa';
      btnVista.addEventListener('click', function(){ vistaPreviaPedido(ped); });
      acts.appendChild(btnVista);

      card.appendChild(acts);
      host.appendChild(card);
    });
  }

  function tablaLineasPedido(cfg){
    var wrap=document.createElement('div');
    var top=document.createElement('div'); top.className='actions';
    var h=document.createElement('h2'); h.textContent='Líneas del pedido'; top.appendChild(h);
    var sp=document.createElement('div'); sp.style.flex='1'; top.appendChild(sp);
    var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea'; bAdd.addEventListener('click', function(){ if(typeof cfg.onAdd==='function'){ cfg.onAdd(); } }); top.appendChild(bAdd);
    var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última'; bDel.addEventListener('click', function(){ if(typeof cfg.onDel==='function'){ cfg.onDel(); } }); top.appendChild(bDel);
    wrap.appendChild(top);

    var table=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    var headers=[{t:'#',w:'6%'},{t:'Código',w:'16%'},{t:'Descripción',w:'36%'},{t:'Piezas',w:'10%'},{t:'Gramos',w:'12%'},{t:'IVA',w:'8%'},{t:'Observaciones',w:'12%'}];
    var i; for(i=0;i<headers.length;i++){ var th=document.createElement('th'); th.textContent=headers[i].t; th.style.width=headers[i].w; trh.appendChild(th); }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody=document.createElement('tbody');

    function renderRow(idx){
      var li=cfg.lineas[idx];
      var tr=document.createElement('tr');

      var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);

      var tdCod=document.createElement('td'); var inCod=document.createElement('input'); inCod.type='text'; inCod.value=li.codigo; inCod.style.width='100%'; inCod.addEventListener('input',function(){ li.codigo=inCod.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdCod.appendChild(inCod); tr.appendChild(tdCod);

      var tdDes=document.createElement('td'); var inDes=document.createElement('input'); inDes.type='text'; inDes.value=li.descripcion; inDes.style.width='100%'; inDes.addEventListener('input',function(){ li.descripcion=inDes.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdDes.appendChild(inDes); tr.appendChild(tdDes);

      var tdPz=document.createElement('td'); var inPz=document.createElement('input'); inPz.type='number'; inPz.min='0'; inPz.step='1'; inPz.value=li.piezas; inPz.style.width='100%'; inPz.addEventListener('input',function(){ li.piezas=parseInt(inPz.value||'0',10); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdPz.appendChild(inPz); tr.appendChild(tdPz);

      var tdGr=document.createElement('td'); var inGr=document.createElement('input'); inGr.type='number'; inGr.min='0'; inGr.step='0.01'; inGr.value=li.gramos; inGr.style.width='100%'; inGr.addEventListener('input',function(){ li.gramos=parseFloat(inGr.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdIva=document.createElement('td'); var inIva=document.createElement('input'); inIva.type='number'; inIva.min='0'; inIva.max='16'; inIva.step='1'; inIva.value=li.iva; inIva.style.width='100%'; inIva.addEventListener('input',function(){ li.iva=parseFloat(inIva.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdIva.appendChild(inIva); tr.appendChild(tdIva);

      var tdObs=document.createElement('td'); var inObs=document.createElement('input'); inObs.type='text'; inObs.value=li.observaciones; inObs.style.width='100%'; inObs.addEventListener('input',function(){ li.observaciones=inObs.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdObs.appendChild(inObs); tr.appendChild(tdObs);

      tbody.appendChild(tr);
    }

    var r; for(r=0;r<cfg.lineas.length;r++){ renderRow(r); }
    table.appendChild(tbody); wrap.appendChild(table);
    return wrap;
  }

  function recalcPedido(ped){
    var piezas=0, gramos=0, i;
    for(i=0;i<ped.lineas.length;i++){
      piezas += parseInt(ped.lineas[i].piezas||0,10);
      gramos += parseFloat(ped.lineas[i].gramos||0);
    }
    ped.totales={ piezas:piezas, gramos:gramos };
  }

  function leerCSVyCargarLineas(file, ped){
    var reader=new FileReader();
    reader.onload=function(ev){
      var text=ev.target.result || '';
      var firstLine=text.split(/\r?\n/)[0] || '';
      var sep=','; if(firstLine.indexOf(';')>=0){ sep=';'; } if(firstLine.indexOf('\t')>=0){ sep='\t'; }
      var rows=text.split(/\r?\n/).filter(function(r){ return r.trim().length>0; });
      if(rows.length===0){ alert('El CSV está vacío.'); return; }

      var headers = rows[0].split(sep).map(function(s){ return s.replace(/^"|"$/g,'').trim(); });
      function idxOf(names){
        var i, j;
        for(i=0;i<names.length;i++){
          j=headers.findIndex(function(h){ return h.toLowerCase()===names[i].toLowerCase(); });
          if(j>=0) return j;
        }
        return -1;
      }
      var idxCodigo = idxOf(['Código','Codigo','SKU','Clave','Code']);
      var idxPiezas = idxOf(['Piezas','Pz','Piezas (Pz)','Cantidad','Cant']);
      var idxGramos = idxOf(['Gramos','Gr','Grs']);
      var idxObs    = idxOf(['Observaciones','Obs','Detalle','Descripcion','Descripción']);
      var idxIVA    = idxOf(['IVA (0 ó 16)','IVA','Impuesto']);

      if(idxCodigo<0 && idxPiezas<0 && idxGramos<0){
        alert('No se reconocieron columnas clave. Encabezados esperados: Código, Piezas, Gramos, Observaciones, IVA.');
        return;
      }

      var i;
      var nuevas=[];
      for(i=1;i<rows.length;i++){
        var cols = rows[i].split(sep).map(function(s){ return s.replace(/^"|"$/g,'').trim(); });
        if(cols.length===1 && cols[0]==='') continue;

        var li={
          codigo: idxCodigo>=0 ? cols[idxCodigo] : '',
          descripcion: idxObs>=0 ? cols[idxObs] : '',
          piezas: idxPiezas>=0 ? parseInt(cols[idxPiezas]||'0',10) : 0,
          gramos: idxGramos>=0 ? parseFloat(cols[idxGramos]||'0') : 0,
          iva: idxIVA>=0 ? parseFloat(cols[idxIVA]||'0') : 0,
          observaciones: ''
        };
        var sumEmpty = (li.codigo+li.descripcion).trim()==='' && li.piezas===0 && li.gramos===0;
        if(sumEmpty) continue;
        nuevas.push(li);
      }

      if(nuevas.length===0){ alert('No se encontraron líneas válidas en el CSV.'); return; }

      ped.lineas = nuevas;
      recalcPedido(ped);
      saveDB(DB);
      abrirPedidoExistente(ped.id);
      toast('Líneas cargadas desde CSV.');
    };
    reader.readAsText(file, 'utf-8');
  }

  function vistaPreviaPedido(ped){
    var w=window.open('', '_blank','width=840,height=900'); if(!w){ alert('Permite pop-ups.'); return; }
    var css='@page{size:5.5in 8.5in;margin:10mm;}body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;}h1{color:#0a2c4c;margin:0 0 6px 0;}table{width:100%;border-collapse:collapse;table-layout:fixed;}th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;word-break:break-word;}thead tr{background:#e7effa;}.row{display:flex;gap:8px;margin:6px 0;}.col{flex:1;}.water{position:fixed;top:40%;left:10%;font-size:48px;color:#94a3b880;transform:rotate(-20deg);}';
    var html=[];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido '+String(ped.folio).padStart(3,'0')+'</title><style>'+css+'</style></head><body>');
    html.push('<div class="water">BORRADOR</div>');
    html.push('<h1>Pedido '+String(ped.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+ped.fecha+'</div><div class="col"><b>Tipo:</b> '+(ped.tipo==='cliente'?'Cliente':'Stock')+'</div><div class="col"><b>Cliente:</b> '+escapeHTML(ped.cliente||'-')+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Observaciones:</b> '+escapeHTML(ped.observaciones||'')+'</div><div class="col"><b>Total Piezas:</b> '+(ped.totales? ped.totales.piezas:0)+'</div><div class="col"><b>Total Gramos:</b> '+(ped.totales? f2(ped.totales.gramos):'0.00')+'</div></div>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:16%">Código</th><th style="width:36%">Descripción</th><th style="width:10%">Piezas</th><th style="width:12%">Gramos</th><th style="width:8%">IVA</th><th style="width:12%">Observaciones</th></tr></thead><tbody>');
    var i; for(i=0;i<ped.lineas.length;i++){
      var li=ped.lineas[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+escapeHTML(li.codigo||'')+'</td><td>'+escapeHTML(li.descripcion||'')+'</td><td>'+(li.piezas||0)+'</td><td>'+f2(li.gramos||0)+'</td><td>'+f2(li.iva||0)+'</td><td>'+escapeHTML(li.observaciones||'')+'</td></tr>');
    }
    html.push('</tbody></table>');
    html.push('</body></html>');
    w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
  }

  // ===== Submenú inicial =====
  renderSubmenu('inicio');

  // Exponer helpers usados por botones
  window.imprimirPDF=imprimirPDF;
  window.compartirWhatsApp=compartirWhatsApp;
  window.cargarEvidencia=cargarEvidencia;

})();
