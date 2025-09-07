/* CONTROL-A · app.js v2.0
   Ajustes solicitados:
   - Evitar scroll horizontal (table-layout fixed)
   - Mostrar disponibles en almacén destino además de origen
   - Quitar columna "Foto" en líneas, dejar botón global de evidencia
   - Salida visible desde inicio pero bloqueada hasta procesar
   - Guardar entrada limpia hoja y confirma mensaje
   - Folios pendientes en naranja con botón "Procesar este traspaso"
   - Vista previa = BORRADOR antes de guardar
   - PDF final solo después de guardar
   - WhatsApp (ícono) solo activo cuando guardado/cerrado
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
  { id:'999', nombre:'Plata .999', aplicaAleacion:true, tolMerma: 0.05 },
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

    host.appendChild(card);
    host.appendChild(acciones);

    listarAbiertos('');
  }else{
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
  x.className = 'x'; x.textContent = ' ×'; x.style.cursor = 'pointer';
  x.addEventListener('click', function(ev){
    ev.stopPropagation();
    var v = qs('#view-'+id, viewsHost); if(v) v.remove();
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

// ===== Listado pendientes =====
function listarAbiertos(){
  var host = qs('#subpanel');
  var card = document.createElement('div');
  card.className = 'card';
  var h = document.createElement('h2');
  h.textContent = 'Traspasos pendientes';
  card.appendChild(h);

  var lst = DB.traspasos.filter(function(t){ return !t.cerrado; });
  if(lst.length===0){
    var p = document.createElement('p'); p.textContent='Sin folios abiertos.'; card.appendChild(p);
  }else{
    lst.forEach(function(t){
      var fol = String(t.folio).padStart(3,'0');
      var row = document.createElement('div');
      row.className = 'actions';
      var pill = document.createElement('span');
      pill.className = 'pill orange';
      pill.textContent = 'Folio '+fol;
      row.appendChild(pill);
      var btn = document.createElement('button');
      btn.className = 'btn-orange';
      btn.textContent = 'Procesar este traspaso';
      btn.addEventListener('click', function(){ abrirTraspasoExistente(t.id,true); });
      row.appendChild(btn);
      card.appendChild(row);
    });
  }
  host.appendChild(card);
}

// ===== Nuevo traspaso =====
function nuevoTraspasoBase(){
  DB.folio += 1;
  var id = 'T'+Date.now();
  var folioNum = DB.folio;

  var lineas = [];
  for(var i=0;i<3;i++){
    lineas.push({materialId:'925',detalle:'',gramos:0,aleacion:0,subtotal:0});
  }

  var obj = {
    id:id, folio:folioNum, tipo:'normal', fecha:hoyStr(), hora:horaStr(),
    saleDe:'caja', entraA:'prod', comentarios:'',
    totalGr:0, lineasEntrada:lineas,
    salida:{creada:true,fecha:hoyStr(),hora:horaStr(),saleDe:'prod',entraA:'caja',
      comentarios:'',lineas:lineas.map(function(li){return{materialId:li.materialId,detalle:li.detalle,gramos:0,aleacion:0,subtotal:0};}), totalGr:0},
    cerrado:false
  };
  if(obj.saleDe==='caja'&&obj.entraA==='prod'){ obj.tipo='prod'; }

  DB.traspasos.push(obj); saveDB(DB);
  return obj.id;
}
function abrirTraspasoNuevo(){
  var id=nuevoTraspasoBase();
  abrirTraspasoExistente(id,false);
}

// ===== Render traspaso =====
function abrirTraspasoExistente(id,modoProcesar){
  var tr=DB.traspasos.find(function(x){return x.id===id;});
  if(!tr){toast('No encontrado');return;}
  var titulo='Traspaso '+String(tr.folio).padStart(3,'0');
  openTab('trasp-'+id,titulo,function(host){
    host.innerHTML='';
    var card=document.createElement('div'); card.className='card';

    // Header Entrada
    var grid1=document.createElement('div'); grid1.className='grid';
    var dvFolio=document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio';
    var inFol=document.createElement('input'); inFol.value=String(tr.folio).padStart(3,'0'); inFol.readOnly=true;
    dvFolio.appendChild(lbFo); dvFolio.appendChild(inFol);

    var dvFecha=document.createElement('div'); var lbF=document.createElement('label'); lbF.textContent='Fecha';
    var inF=document.createElement('input'); inF.type='date'; inF.value=tr.fecha;
    inF.addEventListener('change',function(){tr.fecha=inF.value;saveDB(DB);});
    dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

    var dvS=document.createElement('div'); var lbS=document.createElement('label'); lbS.textContent='Sale de';
    var selS=document.createElement('select');
    ALMACENES.forEach(function(a){var op=document.createElement('option');op.value=a.id;op.textContent=a.nombre;if(a.id===tr.saleDe)op.selected=true;selS.appendChild(op);});
    selS.addEventListener('change',function(){tr.saleDe=selS.value;saveDB(DB);});
    dvS.appendChild(lbS); dvS.appendChild(selS);

    var dvE=document.createElement('div'); var lbE=document.createElement('label'); lbE.textContent='Entra a';
    var selE=document.createElement('select');
    ALMACENES.forEach(function(a){var op=document.createElement('option');op.value=a.id;op.textContent=a.nombre;if(a.id===tr.entraA)op.selected=true;selE.appendChild(op);});
    selE.addEventListener('change',function(){tr.entraA=selE.value;saveDB(DB);});
    dvE.appendChild(lbE); dvE.appendChild(selE);

    var dvC=document.createElement('div'); var lbC=document.createElement('label'); lbC.textContent='Comentarios';
    var txC=document.createElement('textarea'); txC.value=tr.comentarios; txC.addEventListener('input',function(){tr.comentarios=txC.value;saveDB(DB);});
    dvC.appendChild(lbC); dvC.appendChild(txC);

    var dvT=document.createElement('div'); var lbT=document.createElement('label'); lbT.textContent='Total GR. entrada';
    var inT=document.createElement('input'); inT.readOnly=true; inT.value=f2(tr.totalGr);
    dvT.appendChild(lbT); dvT.appendChild(inT);

    var dvDisp=document.createElement('div'); var lbD=document.createElement('label'); lbD.textContent='Grs disponibles en almacén origen';
    var inD=document.createElement('input'); inD.readOnly=true; inD.value=f2(calcDisponibles(tr.saleDe));
    dvDisp.appendChild(lbD); dvDisp.appendChild(inD);

    var dvDisp2=document.createElement('div'); var lbD2=document.createElement('label'); lbD2.textContent='Grs disponibles en almacén destino';
    var inD2=document.createElement('input'); inD2.readOnly=true; inD2.value=f2(calcDisponibles(tr.entraA));
    dvDisp2.appendChild(lbD2); dvDisp2.appendChild(inD2);

    grid1.appendChild(dvFolio);grid1.appendChild(dvFecha);grid1.appendChild(dvS);grid1.appendChild(dvE);
    grid1.appendChild(dvC);grid1.appendChild(dvT);grid1.appendChild(dvDisp);grid1.appendChild(dvDisp2);
    card.appendChild(grid1);

    // Tabla Entrada
    card.appendChild(tablaLineasWidget({
      titulo:'ENTRADA', bloqueado:false, lineas:tr.lineasEntrada,
      onChange:function(){ tr.totalGr=sumaSubtotales(tr.lineasEntrada); inT.value=f2(tr.totalGr); saveDB(DB); }
    }));

    // Acciones Entrada
    var acts=document.createElement('div'); acts.className='actions';
    var btnGuardar=document.createElement('button'); btnGuardar.className='btn-primary'; btnGuardar.textContent='Guardar entrada';
    btnGuardar.addEventListener('click',function(){
      if(!confirm('¿Guardar entrada?')) return;
      saveDB(DB);
      toast('Traspaso de entrada creado exitosamente; consulta en "Traspasos pendientes"');
      // cerrar tab y resetear
      var view=qs('#view-trasp-'+tr.id); if(view)view.remove();
      var tabBtn=qs('[data-tab="trasp-'+tr.id+'"]'); if(tabBtn)tabBtn.remove();
      renderSubmenu('inventarios');
    });
    acts.appendChild(btnGuardar);

    var btnVista=document.createElement('button'); btnVista.className='btn'; btnVista.textContent='Vista previa';
    btnVista.addEventListener('click',function(){ imprimirPDF(tr,false); });
    acts.appendChild(btnVista);

    card.appendChild(acts);

    // SALIDA
    var bar=document.createElement('div'); bar.className='card';
    var h3=document.createElement('h2'); h3.textContent='SALIDA (bloqueada hasta procesar)'; bar.appendChild(h3);
    // Solo habilitado si se abre en modoProcesar
    bar.appendChild(tablaLineasWidget({
      titulo:'SALIDA', bloqueado:!modoProcesar, lineas:tr.salida.lineas,
      onChange:function(){ tr.salida.totalGr=sumaSubtotales(tr.salida.lineas); saveDB(DB); }
    }));
    if(modoProcesar){
      var btnCerrar=document.createElement('button'); btnCerrar.className='btn-orange'; btnCerrar.textContent='Cerrar folio';
      btnCerrar.addEventListener('click',function(){ cerrarFolio(tr); });
      bar.appendChild(btnCerrar);
    }
    card.appendChild(bar);

    // Evidencia global
    var divEv=document.createElement('div'); divEv.className='actions';
    var cam=document.createElement('span'); cam.textContent='📷'; divEv.appendChild(cam);
    var lbl=document.createElement('span'); lbl.textContent='Cargar evidencia en foto'; divEv.appendChild(lbl);
    var inFile=document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
    divEv.appendChild(inFile);
    card.appendChild(divEv);

    host.appendChild(card);
  });
}

// ===== Tabla de líneas =====
function tablaLineasWidget(cfg){
  var wrap=document.createElement('div');
  var h=document.createElement('h2'); h.textContent=cfg.titulo; wrap.appendChild(h);
  var table=document.createElement('table'); var thead=document.createElement('thead');
  var trh=document.createElement('tr'); ['#','Material','Detalle','Gr','Aleación','Subtotal'].forEach(function(t){
    var th=document.createElement('th'); th.textContent=t; trh.appendChild(th);
  }); thead.appendChild(trh); table.appendChild(thead);
  var tbody=document.createElement('tbody');
  cfg.lineas.forEach(function(li,idx){
    var tr=document.createElement('tr');
    var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);
    var td2=document.createElement('td'); var sel=document.createElement('select');
    MATERIALES.forEach(function(m){var op=document.createElement('option');op.value=m.id;op.textContent=m.nombre;if(m.id===li.materialId)op.selected=true;sel.appendChild(op);});
    sel.disabled=cfg.bloqueado; sel.addEventListener('change',function(){li.materialId=sel.value; recalc();}); td2.appendChild(sel); tr.appendChild(td2);
    var td3=document.createElement('td'); var inDet=document.createElement('input'); inDet.value=li.detalle; inDet.readOnly=cfg.bloqueado;
    inDet.addEventListener('input',function(){li.detalle=inDet.value; saveDB(DB);}); td3.appendChild(inDet); tr.appendChild(td3);
    var tdGr=document.createElement('td'); var inGr=document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.value=li.gramos;
    inGr.readOnly=cfg.bloqueado; inGr.addEventListener('input',function(){li.gramos=parseFloat(inGr.value||0); if(li.materialId==='999'){li.aleacion=li.gramos*0.07;} recalc();});
    tdGr.appendChild(inGr); tr.appendChild(tdGr);
    var tdAle=document.createElement('td'); var inAle=document.createElement('input'); inAle.type='number'; inAle.step='0.01'; inAle.value=li.aleacion;
    inAle.readOnly=(li.materialId!=='999')||cfg.bloqueado; inAle.addEventListener('input',function(){li.aleacion=parseFloat(inAle.value||0); recalc();});
    tdAle.appendChild(inAle); tr.appendChild(tdAle);
    var tdSub=document.createElement('td'); var inSub=document.createElement('input'); inSub.readOnly=true; inSub.value=f
