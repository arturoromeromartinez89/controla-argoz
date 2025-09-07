/* CONTROL-A · app.js v2.5.0
   Módulos: Traspasos + Pedidos
   Cambios de Pedidos:
   - Botón verde "Importar Excel (CSV)" con iconos ↑ y X, arriba de las líneas (input file oculto)
   - Fecha promesa: default = fecha + 15 días naturales; editable; deja de auto-recalcularse si se edita
   - Se elimina columna IVA (tabla, importador y vista previa)
   - Estatus por pedido: "Pendiente de aceptar" (naranja) -> "En proceso" (azul) -> "Finalizado" (verde)
     * Botón Aceptar (verde) pasa a "En proceso"
     * Botón Finalizar (verde) pasa a "Finalizado" (y cierra el pedido)
   - Submenú de pedidos muestra pastilla con color según estatus
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
        return { traspasos:[], folio:0, evidencia:'', pedidos:[], pedFolio:0 };
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

  // ===== Catálogos (Traspasos) =====
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
  function sumDays(iso, days){
    var d=new Date(iso); if(isNaN(d)) d=new Date();
    d.setDate(d.getDate()+days);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
  }
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
    view.id = 'view-'+id';
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

      // (Importar Excel/CSV SOLO dentro de la hoja de pedido)
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
  //                                    TRASPASOS (igual que v2.4.1)
  // =====================================================================================
  // ... [SECCIÓN DE TRASPASOS SIN CAMBIOS — por brevedad no se repite aquí]
  // Copia aquí tu sección de Traspasos tal como la tienes en v2.4.1 (o la última estable).
  // =====================================================================================

  // =====================================================================================
  //                                        PEDIDOS
  // =====================================================================================

  function listarPedidosPendientes(mostrarTitulo){
    var host=qs('#subpanel');
    var card=document.createElement('div'); card.className='card';
    if(mostrarTitulo){ var h=document.createElement('h2'); h.textContent='Pedidos pendientes'; card.appendChild(h); }
    var lst=DB.pedidos
      .filter(function(p){ return !p.cerrado; })
      .sort(function(a,b){ return b.folio - a.folio; });

    if(lst.length===0){
      var p=document.createElement('p'); p.textContent='Sin pedidos pendientes.'; card.appendChild(p);
    }else{
      lst.forEach(function(ped){
        var row=document.createElement('div'); row.className='actions';
        var pill=document.createElement('span'); pill.className='pill';
        var est=ped.estatus||'pendiente';
        if(est==='pendiente'){ pill.style.background='#fed7aa'; pill.style.color='#9a3412'; pill.textContent='Pendiente de aceptar'; }
        else if(est==='proceso'){ pill.style.background='#dbeafe'; pill.style.color='#1e40af'; pill.textContent='En proceso'; }
        else { pill.style.background='#dcfce7'; pill.style.color='#166534'; pill.textContent='Finalizado'; }
        row.appendChild(pill);

        var fol=document.createElement('span'); fol.className='pill'; fol.textContent='Pedido '+String(ped.folio).padStart(3,'0')+' · '+(ped.cliente||'-');
        row.appendChild(fol);

        var btn=document.createElement('button'); btn.className='btn'; btn.textContent='Abrir'; btn.addEventListener('click', function(){ abrirPedidoExistente(ped.id); }); row.appendChild(btn);
        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  function nuevoPedidoBase(){
    DB.pedFolio += 1;
    var id='P'+Date.now();
    var fecha=hoyStr();
    var prom=sumDays(fecha,15); // promesa default 15 días
    var obj={
      id:id,
      folio:DB.pedFolio,
      fecha:fecha,
      promesa:prom,
      _promesaAuto:true,       // se apaga si el usuario edita la promesa
      tipo:'cliente',          // 'cliente' | 'stock'
      cliente:'',
      estatus:'pendiente',     // 'pendiente' | 'proceso' | 'finalizado'
      observaciones:'',
      lineas:[
        { codigo:'', descripcion:'', piezas:0, gramos:0, observaciones:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, observaciones:'' },
        { codigo:'', descripcion:'', piezas:0, gramos:0, observaciones:'' }
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
    // saneo para pedidos viejos
    if(!ped.promesa){ ped.promesa=sumDays(ped.fecha||hoyStr(),15); ped._promesaAuto=true; }
    if(!ped.estatus){ ped.estatus='pendiente'; }
    if(!Array.isArray(ped.lineas)){ ped.lineas=[]; }
    var titulo='Pedido '+String(ped.folio).padStart(3,'0');

    openTab('ped-'+id, titulo, function(host){
      host.innerHTML='';
      var card=document.createElement('div'); card.className='card';

      var grid=document.createElement('div'); grid.className='grid';

      var dvFolio=document.createElement('div'); var lbFo=document.createElement('label'); lbFo.textContent='Folio'; var inFo=document.createElement('input'); inFo.readOnly=true; inFo.value=String(ped.folio).padStart(3,'0'); dvFolio.appendChild(lbFo); dvFolio.appendChild(inFo);

      var dvFecha=document.createElement('div'); var lbFe=document.createElement('label'); lbFe.textContent='Fecha'; var inFe=document.createElement('input'); inFe.type='date'; inFe.value=ped.fecha;
      inFe.addEventListener('change',function(){
        ped.fecha=inFe.value||hoyStr();
        if(ped._promesaAuto){ ped.promesa = sumDays(ped.fecha,15); }
        saveDB(DB); // no redibujo para que no parpadee
      });
      dvFecha.appendChild(lbFe); dvFecha.appendChild(inFe);

      var dvProm=document.createElement('div'); var lbPr=document.createElement('label'); lbPr.textContent='Fecha promesa (editable)'; var inPr=document.createElement('input'); inPr.type='date'; inPr.value=ped.promesa;
      inPr.addEventListener('change',function(){ ped.promesa=inPr.value; ped._promesaAuto=false; saveDB(DB); });
      dvProm.appendChild(lbPr); dvProm.appendChild(inPr);

      var dvTipo=document.createElement('div'); var lbTi=document.createElement('label'); lbTi.textContent='Tipo de pedido'; var selTi=document.createElement('select');
      var op1=document.createElement('option'); op1.value='cliente'; op1.textContent='Cliente'; selTi.appendChild(op1);
      var op2=document.createElement('option'); op2.value='stock'; op2.textContent='Stock'; selTi.appendChild(op2);
      selTi.value=ped.tipo; selTi.addEventListener('change',function(){ ped.tipo=selTi.value; saveDB(DB); });
      dvTipo.appendChild(lbTi); dvTipo.appendChild(selTi);

      var dvCli=document.createElement('div'); var lbCl=document.createElement('label'); lbCl.textContent='Cliente'; var inCl=document.createElement('input'); inCl.type='text'; inCl.value=ped.cliente; inCl.placeholder='Nombre del cliente'; inCl.addEventListener('input',function(){ ped.cliente=inCl.value; saveDB(DB); }); dvCli.appendChild(lbCl); dvCli.appendChild(inCl);

      var dvObs=document.createElement('div'); var lbOb=document.createElement('label'); lbOb.textContent='Observaciones'; var txOb=document.createElement('textarea'); txOb.value=ped.observaciones; txOb.addEventListener('input',function(){ ped.observaciones=txOb.value; saveDB(DB); }); dvObs.appendChild(lbOb); dvObs.appendChild(txOb);

      // Estatus + botones
      var dvSt=document.createElement('div'); var lbSt=document.createElement('label'); lbSt.textContent='Estatus'; 
      var tag=document.createElement('span'); tag.className='pill';
      function pintarTag(){
        var est=ped.estatus;
        if(est==='pendiente'){ tag.textContent='Pendiente de aceptar'; tag.style.background='#fed7aa'; tag.style.color='#9a3412'; }
        else if(est==='proceso'){ tag.textContent='En proceso'; tag.style.background='#dbeafe'; tag.style.color='#1e40af'; }
        else { tag.textContent='Finalizado'; tag.style.background='#dcfce7'; tag.style.color='#166534'; }
      }
      pintarTag();
      dvSt.appendChild(lbSt); dvSt.appendChild(tag);

      grid.appendChild(dvFolio); grid.appendChild(dvFecha); grid.appendChild(dvProm);
      grid.appendChild(dvTipo);  grid.appendChild(dvCli);   grid.appendChild(dvObs);
      grid.appendChild(dvSt);
      card.appendChild(grid);

      // Acciones de estatus
      var stActs=document.createElement('div'); stActs.className='actions';
      var btnAceptar=document.createElement('button'); 
      btnAceptar.textContent='Aceptar'; 
      btnAceptar.style.background='#16a34a'; btnAceptar.style.color='#fff'; btnAceptar.style.border='1px solid #16a34a'; btnAceptar.className='btn';
      btnAceptar.addEventListener('click',function(){
        ped.estatus='proceso'; saveDB(DB); pintarTag(); renderSubmenu('pedidos'); toast('Pedido aceptado (en proceso).');
      });
      var btnFinal=document.createElement('button');
      btnFinal.textContent='Finalizar';
      btnFinal.style.background='#16a34a'; btnFinal.style.color='#fff'; btnFinal.style.border='1px solid #16a34a'; btnFinal.className='btn';
      btnFinal.addEventListener('click',function(){
        ped.estatus='finalizado'; ped.cerrado=true; saveDB(DB); pintarTag(); renderSubmenu('pedidos'); toast('Pedido finalizado.');
      });
      stActs.appendChild(btnAceptar); stActs.appendChild(btnFinal);
      card.appendChild(stActs);

      // Tabla + Importador CSV (botón verde arriba de las líneas)
      card.appendChild(tablaLineasPedido({
        lineas: ped.lineas,
        onAdd: function(){ ped.lineas.push({codigo:'',descripcion:'',piezas:0,gramos:0,observaciones:''}); recalcPedido(ped); saveDB(DB); abrirPedidoExistente(ped.id); },
        onDel: function(){ if(ped.lineas.length>1){ ped.lineas.pop(); } recalcPedido(ped); saveDB(DB); abrirPedidoExistente(ped.id); },
        onChange: function(){ recalcPedido(ped); saveDB(DB); },
        onImport: function(file){ leerCSVyCargarLineas(file, ped); }
      }));

      var acts=document.createElement('div'); acts.className='actions';

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

    // Barra superior con botón Importar (verde) + título + agregar/eliminar
    var top=document.createElement('div'); top.className='actions';

    // Botón verde "Importar Excel (CSV)" con iconos
    var inpFile=document.createElement('input'); inpFile.type='file'; inpFile.accept='.csv,.CSV'; inpFile.style.display='none';
    var btnImp=document.createElement('button'); btnImp.className='btn';
    btnImp.style.background='#16a34a'; btnImp.style.border='1px solid #16a34a'; btnImp.style.color='#fff';
    btnImp.innerHTML='⬆️ <span style="font-weight:700">X</span> Importar Excel (CSV)';
    btnImp.addEventListener('click', function(){ inpFile.click(); });
    inpFile.addEventListener('change', function(){
      var f=inpFile.files && inpFile.files[0] ? inpFile.files[0] : null;
      if(!f) return;
      if(typeof cfg.onImport==='function'){ cfg.onImport(f); }
      inpFile.value='';
    });
    top.appendChild(btnImp);
    top.appendChild(inpFile);

    var h=document.createElement('h2'); h.textContent='Líneas del pedido'; top.appendChild(h);
    var sp=document.createElement('div'); sp.style.flex='1'; top.appendChild(sp);
    var bAdd=document.createElement('button'); bAdd.className='btn'; bAdd.textContent='+ Agregar línea'; bAdd.addEventListener('click', function(){ if(typeof cfg.onAdd==='function'){ cfg.onAdd(); } }); top.appendChild(bAdd);
    var bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='– Eliminar última'; bDel.addEventListener('click', function(){ if(typeof cfg.onDel==='function'){ cfg.onDel(); } }); top.appendChild(bDel);
    wrap.appendChild(top);

    var table=document.createElement('table');
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    // Sin IVA
    var headers=[{t:'#',w:'6%'},{t:'Código',w:'16%'},{t:'Descripción',w:'40%'},{t:'Piezas',w:'12%'},{t:'Gramos',w:'14%'},{t:'Observaciones',w:'12%'}];
    var i; for(i=0;i<headers.length;i++){ var th=document.createElement('th'); th.textContent=headers[i].t; th.style.width=headers[i].w; trh.appendChild(th); }
    thead.appendChild(trh); table.appendChild(thead);

    var tbody=document.createElement('tbody');

    function renderRow(idx){
      var li=cfg.lineas[idx];
      var tr=document.createElement('tr');

      var td0=document.createElement('td'); td0.textContent=(idx+1); tr.appendChild(td0);

      var tdCod=document.createElement('td'); var inCod=document.createElement('input'); inCod.type='text'; inCod.value=li.codigo||''; inCod.style.width='100%'; inCod.addEventListener('input',function(){ li.codigo=inCod.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdCod.appendChild(inCod); tr.appendChild(tdCod);

      var tdDes=document.createElement('td'); var inDes=document.createElement('input'); inDes.type='text'; inDes.value=li.descripcion||''; inDes.style.width='100%'; inDes.addEventListener('input',function(){ li.descripcion=inDes.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdDes.appendChild(inDes); tr.appendChild(tdDes);

      var tdPz=document.createElement('td'); var inPz=document.createElement('input'); inPz.type='number'; inPz.min='0'; inPz.step='1'; inPz.value=li.piezas||0; inPz.style.width='100%'; inPz.addEventListener('input',function(){ li.piezas=parseInt(inPz.value||'0',10); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdPz.appendChild(inPz); tr.appendChild(tdPz);

      var tdGr=document.createElement('td'); var inGr=document.createElement('input'); inGr.type='number'; inGr.min='0'; inGr.step='0.01'; inGr.value=li.gramos||0; inGr.style.width='100%'; inGr.addEventListener('input',function(){ li.gramos=parseFloat(inGr.value||'0'); if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdObs=document.createElement('td'); var inObs=document.createElement('input'); inObs.type='text'; inObs.value=li.observaciones||''; inObs.style.width='100%'; inObs.addEventListener('input',function(){ li.observaciones=inObs.value; if(typeof cfg.onChange==='function'){ cfg.onChange(); } }); tdObs.appendChild(inObs); tr.appendChild(tdObs);

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

      if(idxCodigo<0 && idxPiezas<0 && idxGramos<0){
        alert('No se reconocieron columnas clave. Encabezados esperados: Código, Piezas, Gramos, Observaciones.');
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
    var estTxt = ped.estatus==='pendiente' ? 'Pendiente de aceptar' : (ped.estatus==='proceso' ? 'En proceso' : 'Finalizado');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+ped.fecha+'</div><div class="col"><b>Fecha promesa:</b> '+(ped.promesa||'')+'</div><div class="col"><b>Estatus:</b> '+estTxt+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Tipo:</b> '+(ped.tipo==='cliente'?'Cliente':'Stock')+'</div><div class="col"><b>Cliente:</b> '+escapeHTML(ped.cliente||'-')+'</div><div class="col"><b>Observaciones:</b> '+escapeHTML(ped.observaciones||'')+'</div></div>');
    html.push('<table><thead><tr><th style="width:6%">#</th><th style="width:16%">Código</th><th style="width:40%">Descripción</th><th style="width:12%">Piezas</th><th style="width:14%">Gramos</th><th style="width:12%">Observaciones</th></tr></thead><tbody>');
    var i; for(i=0;i<ped.lineas.length;i++){
      var li=ped.lineas[i];
      html.push('<tr><td>'+(i+1)+'</td><td>'+escapeHTML(li.codigo||'')+'</td><td>'+escapeHTML(li.descripcion||'')+'</td><td>'+(li.piezas||0)+'</td><td>'+f2(li.gramos||0)+'</td><td>'+escapeHTML(li.observaciones||'')+'</td></tr>');
    }
    html.push('</tbody></table>');
    html.push('</body></html>');
    w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
  }

  // ===== Submenú inicial =====
  renderSubmenu('inicio');

  // Exponer helpers usados por otros botones (Traspasos)
  window.imprimirPDF = function(){};
  window.compartirWhatsApp = function(){};
  window.cargarEvidencia = function(){};

})();
