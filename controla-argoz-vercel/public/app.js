/* CONTROL-A · app.js v1.9.9 (core mínimo estable)
   - Sin shorthand de propiedades (para evitar "Invalid shorthand property initializer")
   - Inventarios → Traspasos: Entrada + Proceso de SALIDA (misma pantalla)
   - Validaciones de merma y tolerancias especiales
   - PDF (media carta) y botón WhatsApp (solo PDF)
*/

(function(){
  "use strict";

  // ===== Utilidades UI =====
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
  function toast(msg){
    var t = qs('#toast'); if(!t) return;
    t.textContent = msg; t.style.display='block';
    setTimeout(function(){ t.style.display='none'; }, 1800);
  }

  // ===== Persistencia (localStorage) =====
  var STORAGE_KEY = 'CONTROL_A_DB';
  function loadDB(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){ return { traspasos: [], catalogo: { materiales: [], clientes: [] }, folio: 0 }; }
      var obj = JSON.parse(raw);
      if(!obj.traspasos){ obj.traspasos = []; }
      if(!obj.catalogo){ obj.catalogo = { materiales: [], clientes: [] }; }
      if(typeof obj.folio !== 'number'){ obj.folio = 0; }
      return obj;
    }catch(e){
      console.error('loadDB error', e);
      return { traspasos: [], catalogo: { materiales: [], clientes: [] }, folio: 0 };
    }
  }
  function saveDB(db){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }catch(e){
      console.error('saveDB error', e);
    }
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

  // Submenú por sección
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
      btnNew.addEventListener('click', function(){
        abrirTraspasoNuevo();
      });
      var btnAbiertos = document.createElement('button');
      btnAbiertos.className = 'btn-outline';
      btnAbiertos.textContent = 'Folios pendientes';
      btnAbiertos.addEventListener('click', function(){
        listarAbiertos();
      });
      acciones.appendChild(btnNew);
      acciones.appendChild(btnAbiertos);
      card.appendChild(acciones);

      var busc = document.createElement('input');
      busc.type = 'text';
      busc.placeholder = 'Buscar folio...';
      busc.style.width = '100%';
      busc.addEventListener('input', function(){
        listarAbiertos(busc.value.trim());
      });
      card.appendChild(busc);

      host.appendChild(card);
      // Carga lista inicial
      listarAbiertos('');
    }
    else{
      h2.textContent = 'Submenú';
      card.appendChild(h2);
      host.appendChild(card);
    }
  }

  // ===== Tabs (hojas de trabajo) =====
  var viewsHost = qs('#views');
  var tabsHost = qs('#tabs');

  function openTab(id, titulo, renderFn){
    // si ya existe, activar
    var tabBtn = qs('[data-tab="'+id+'"]', tabsHost);
    if(tabBtn){
      qsa('.tab', tabsHost).forEach(function(t){ t.classList.remove('active'); });
      tabBtn.classList.add('active');
      qsa('.view', viewsHost).forEach(function(v){ v.classList.remove('active'); });
      qs('#view-'+id, viewsHost).classList.add('active');
      return;
    }
    // crear
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
      // activar el último
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

  // ===== Inventarios: listado de abiertos =====
  function listarAbiertos(filtro){
    var host = qs('#subpanel');
    var card = document.createElement('div');
    card.className = 'card';
    var h = document.createElement('h2');
    h.textContent = 'Traspasos abiertos (máx 3 en Producción)';
    card.appendChild(h);

    var lst = DB.traspasos.filter(function(t){ return !t.cerrado; });
    if(filtro){
      lst = lst.filter(function(t){
        var fol = String(t.folio).padStart(3,'0');
        return fol.indexOf(filtro) >= 0;
      });
    }

    if(lst.length === 0){
      var p = document.createElement('p');
      p.textContent = 'Sin folios abiertos.';
      card.appendChild(p);
    }else{
      lst.forEach(function(t){
        var fol = String(t.folio).padStart(3,'0');
        var row = document.createElement('div');
        row.className = 'actions';
        var pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = 'Folio '+fol+' · '+(t.tipo === 'prod' ? 'Traspaso para producción' : 'Traspaso entre almacenes');
        row.appendChild(pill);

        var btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = 'Abrir';
        btn.addEventListener('click', function(){
          abrirTraspasoExistente(t.id);
        });
        row.appendChild(btn);

        card.appendChild(row);
      });
    }
    host.appendChild(card);
  }

  // ===== Crear nuevo traspaso (Entrada) =====
  function nuevoTraspasoBase(){
    DB.folio += 1;
    var id = 'T'+Date.now();
    var folioNum = DB.folio;

    // 3 líneas por defecto
    var lineas = [];
    for(var i=0;i<3;i++){
      lineas.push({
        foto: '',
        materialId: '925',
        detalle: '',
        gramos: 0,
        aleacion: 0,
        subtotal: 0
      });
    }

    var obj = {
      id: id,
      folio: folioNum,
      tipo: 'normal',             // 'normal' o 'prod' (se determina por almacenes)
      fecha: hoyStr(),
      hora: horaStr(),
      saleDe: 'caja',             // editable en Entrada
      entraA: 'prod',             // editable en Entrada
      comentarios: '',
      cerrradoComentario: '',
      totalGr: 0,
      lineasEntrada: lineas,
      // Sección de salida (se crea al procesar)
      salida: {
        creada: false,
        fecha: hoyStr(),
        hora: horaStr(),
        saleDe: 'prod',
        entraA: 'caja',
        comentarios: '',
        lineas: [],
        totalGr: 0
      },
      cerrado: false
    };

    // Definir si es traspaso para producción
    if(obj.saleDe === 'caja' && obj.entraA === 'prod'){
      obj.tipo = 'prod';
    }

    DB.traspasos.push(obj);
    saveDB(DB);
    return obj.id;
  }

  function abrirTraspasoNuevo(){
    var id = nuevoTraspasoBase();
    abrirTraspasoExistente(id);
  }

  // ===== Render de traspaso (Entrada + Salida al procesar) =====
  function abrirTraspasoExistente(id){
    var tr = DB.traspasos.find(function(x){ return x.id === id; });
    if(!tr){ toast('No encontrado'); return; }
    var titulo = 'Traspaso '+String(tr.folio).padStart(3,'0');
    openTab('trasp-'+id, titulo, function(host){
      host.innerHTML = '';
      var card = document.createElement('div');
      card.className = 'card';

      // Header de entrada (siempre visible; si ya está procesado, campos en gris)
      var entradaBloq = tr.salida.creada; // si ya se procesó, bloquear
      var grid1 = document.createElement('div');
      grid1.className = 'grid';

      // Fecha (date)
      var dvFecha = document.createElement('div');
      var lbF = document.createElement('label'); lbF.textContent = 'Fecha';
      var inF = document.createElement('input');
      inF.type = 'date';
      inF.value = tr.fecha;
      inF.readOnly = entradaBloq;
      inF.addEventListener('change', function(){ tr.fecha = inF.value; saveDB(DB); });
      dvFecha.appendChild(lbF); dvFecha.appendChild(inF);

      // Sale de / Entra a
      var dvS = document.createElement('div');
      var lbS = document.createElement('label'); lbS.textContent = 'Sale de';
      var selS = document.createElement('select');
      ALMACENES.forEach(function(a){
        var op = document.createElement('option');
        op.value = a.id; op.textContent = a.nombre;
        if(a.id === tr.saleDe) op.selected = true;
        selS.appendChild(op);
      });
      selS.disabled = entradaBloq;
      selS.addEventListener('change', function(){
        tr.saleDe = selS.value;
        tr.tipo = (tr.saleDe === 'caja' && tr.entraA === 'prod') ? 'prod' : 'normal';
        saveDB(DB);
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
      selE.disabled = entradaBloq;
      selE.addEventListener('change', function(){
        tr.entraA = selE.value;
        tr.tipo = (tr.saleDe === 'caja' && tr.entraA === 'prod') ? 'prod' : 'normal';
        saveDB(DB);
      });
      dvE.appendChild(lbE); dvE.appendChild(selE);

      // Comentarios
      var dvC = document.createElement('div');
      var lbC = document.createElement('label'); lbC.textContent = 'Comentarios';
      var txC = document.createElement('textarea');
      txC.value = tr.comentarios;
      txC.readOnly = false;
      txC.addEventListener('input', function(){ tr.comentarios = txC.value; saveDB(DB); });
      if(entradaBloq){ txC.classList.add('ro'); txC.readOnly = true; }
      dvC.appendChild(lbC); dvC.appendChild(txC);

      // Folio + Total + Gramos disponibles del almacén de ENTRADA seleccionado
      var dvFolio = document.createElement('div');
      var lbFo = document.createElement('label'); lbFo.textContent = 'Folio';
      var inFol = document.createElement('input'); inFol.value = String(tr.folio).padStart(3,'0'); inFol.readOnly = true;
      dvFolio.appendChild(lbFo); dvFolio.appendChild(inFol);

      var dvTotal = document.createElement('div');
      var lbT = document.createElement('label'); lbT.textContent = 'TOTAL GR.';
      var inTot = document.createElement('input'); inTot.readOnly = true; inTot.value = f2(tr.totalGr);
      dvTotal.appendChild(lbT); dvTotal.appendChild(inTot);

      var dvDisp = document.createElement('div');
      var lbD = document.createElement('label'); lbD.textContent = 'Grs disponibles en tu almacén';
      var inDisp = document.createElement('input'); inDisp.readOnly = true;
      inDisp.value = f2(calcDisponibles(tr.saleDe));
      dvDisp.appendChild(lbD); dvDisp.appendChild(inDisp);

      grid1.appendChild(dvFecha);
      grid1.appendChild(dvS);
      grid1.appendChild(dvE);
      grid1.appendChild(dvC);
      grid1.appendChild(dvFolio);
      grid1.appendChild(dvTotal);
      grid1.appendChild(dvDisp);

      card.appendChild(grid1);

      // Tabla Entrada
      card.appendChild(tablaLineasWidget({
        titulo: 'ENTRADA POR TRASPASO',
        bloqueado: entradaBloq,
        lineas: tr.lineasEntrada,
        onChange: function(){
          tr.totalGr = sumaSubtotales(tr.lineasEntrada);
          inTot.value = f2(tr.totalGr);
          saveDB(DB);
        }
      }));

      // Acciones Entrada
      var acts = document.createElement('div');
      acts.className = 'actions';
      var btnGuardar = document.createElement('button');
      btnGuardar.className='btn-primary';
      btnGuardar.textContent='Guardar entrada';
      btnGuardar.disabled = entradaBloq;
      btnGuardar.addEventListener('click', function(){
        if(!confirm('¿Seguro que deseas guardar la ENTRADA?')) return;
        saveDB(DB);
        toast('Entrada guardada');
        // mostrar botón procesar
        btnProcesar.style.display='inline-block';
      });
      acts.appendChild(btnGuardar);

      var btnVista = document.createElement('button');
      btnVista.className='btn';
      btnVista.textContent='Vista previa';
      btnVista.addEventListener('click', function(){ imprimirPDF(tr, false); });
      acts.appendChild(btnVista);

      var btnWA = document.createElement('button');
      btnWA.className='btn';
      btnWA.title='Enviar PDF por WhatsApp';
      btnWA.textContent='🟢 WhatsApp';
      btnWA.addEventListener('click', function(){ compartirWhatsApp(tr); });
      acts.appendChild(btnWA);

      var btnProcesar = document.createElement('button');
      btnProcesar.className='btn-warn';
      btnProcesar.textContent='Procesar (crear SALIDA)';
      btnProcesar.style.display = tr.salida.creada ? 'none':'inline-block';
      btnProcesar.addEventListener('click', function(){
        // crear sección salida
        tr.salida.creada = true;
        tr.salida.saleDe = tr.entraA; // invertimos
        tr.salida.entraA = tr.saleDe;
        tr.salida.fecha = hoyStr();
        tr.salida.hora  = horaStr();
        // Clonar estructura de líneas
        tr.salida.lineas = tr.lineasEntrada.map(function(li){
          return { foto: '', materialId: li.materialId, detalle: li.detalle, gramos: 0, aleacion: 0, subtotal: 0 };
        });
        saveDB(DB);
        abrirTraspasoExistente(tr.id); // re-render
        toast('Sección SALIDA creada');
      });
      acts.appendChild(btnProcesar);

      card.appendChild(acts);

      // ===== SALIDA (aparece después de procesar) =====
      if(tr.salida.creada){
        var bar = document.createElement('div');
        bar.className='card';
        var h3 = document.createElement('h2'); h3.textContent='SALIDA DE LÍNEA DE PRODUCCIÓN';
        bar.appendChild(h3);

        // Header SALIDA (editable)
        var g2 = document.createElement('div');
        g2.className='grid';

        // Fecha salida
        var dvFS = document.createElement('div');
        var lbFS = document.createElement('label'); lbFS.textContent='Fecha';
        var inFS = document.createElement('input'); inFS.type='date'; inFS.value = tr.salida.fecha;
        inFS.addEventListener('change', function(){ tr.salida.fecha = inFS.value; saveDB(DB); });
        dvFS.appendChild(lbFS); dvFS.appendChild(inFS);
        g2.appendChild(dvFS);

        // Sale de / Entra a (invertidos por default, pero EDITABLES)
        var dvSS = document.createElement('div');
        var lbSS = document.createElement('label'); lbSS.textContent='Sale de';
        var selSS = document.createElement('select');
        ALMACENES.forEach(function(a){
          var opS = document.createElement('option');
          opS.value = a.id; opS.textContent = a.nombre;
          if(a.id === tr.salida.saleDe) opS.selected = true;
          selSS.appendChild(opS);
        });
        selSS.addEventListener('change', function(){ tr.salida.saleDe = selSS.value; saveDB(DB); });
        dvSS.appendChild(lbSS); dvSS.appendChild(selSS);
        g2.appendChild(dvSS);

        var dvSE = document.createElement('div');
        var lbSE = document.createElement('label'); lbSE.textContent='Entra a';
        var selSE = document.createElement('select');
        ALMACENES.forEach(function(a){
          var opE = document.createElement('option');
          opE.value = a.id; opE.textContent = a.nombre;
          if(a.id === tr.salida.entraA) opE.selected = true;
          selSE.appendChild(opE);
        });
        selSE.addEventListener('change', function(){ tr.salida.entraA = selSE.value; saveDB(DB); });
        dvSE.appendChild(lbSE); dvSE.appendChild(selSE);
        g2.appendChild(dvSE);

        // Comentarios salida
        var dvCS = document.createElement('div');
        var lbCS = document.createElement('label'); lbCS.textContent='Comentarios (salida)';
        var txCS = document.createElement('textarea'); txCS.value = tr.salida.comentarios;
        txCS.addEventListener('input', function(){ tr.salida.comentarios = txCS.value; saveDB(DB); });
        dvCS.appendChild(lbCS); dvCS.appendChild(txCS);
        g2.appendChild(dvCS);

        // Total salida
        var dvTS = document.createElement('div');
        var lbTS = document.createElement('label'); lbTS.textContent='TOTAL GR. (salida)';
        var inTS = document.createElement('input'); inTS.readOnly=true; inTS.value=f2(tr.salida.totalGr);
        dvTS.appendChild(lbTS); dvTS.appendChild(inTS);
        g2.appendChild(dvTS);

        bar.appendChild(g2);

        // Tabla SALIDA
        bar.appendChild(tablaLineasWidget({
          titulo: 'SALIDA',
          bloqueado: false,
          lineas: tr.salida.lineas,
          onChange: function(){
            tr.salida.totalGr = sumaSubtotales(tr.salida.lineas);
            inTS.value = f2(tr.salida.totalGr);
            saveDB(DB);
          }
        }));

        // Acciones SALIDA
        var acts2 = document.createElement('div');
        acts2.className='actions';

        var inJust = document.createElement('input');
        inJust.type='text';
        inJust.placeholder='Justificación (si regresas menos gramos — opcional)';
        inJust.style.minWidth='280px';
        acts2.appendChild(inJust);

        var btnCerrar = document.createElement('button');
        btnCerrar.className='btn-primary';
        btnCerrar.textContent='Guardar SALIDA / Cerrar folio';
        btnCerrar.addEventListener('click', function(){
          if(tr.tipo === 'prod'){
            // Validar que haya mercancía terminada en SALIDA (o pedir explicación)
            var hayTerminado = tr.salida.lineas.some(function(li){ return li.materialId === 'terminado' && (li.gramos>0 || li.aleacion>0); });
            if(!hayTerminado){
              var ex = prompt('No registraste "Mercancía terminada". Explica por qué (obligatorio para continuar):','');
              if(!ex){ toast('No se puede cerrar sin explicación.'); return; }
            }
          }

          // Validación mermas
          var ent = tr.totalGr;
          var sal = tr.salida.totalGr;
          var dif = sal - ent; // positivo: crecimiento, negativo: merma
          var mermaAbs = Math.max(0, ent - sal);
          var mermaPct = ent>0 ? (mermaAbs/ent) : 0;

          // tolerancias especiales por línea (si hay limalla/negra/tierras)
          var tol = 0.05; // default
          tr.lineasEntrada.forEach(function(li){
            var mat = MATERIALES.find(function(m){ return m.id===li.materialId; });
            if(mat && mat.tolMerma > tol) tol = mat.tolMerma;
          });

          if(mermaPct > tol){
            alert('Según la información cargada se registra una merma superior al '+(tol*100).toFixed(0)+'%.\nNo es posible cerrar este folio. Revisa tu línea de producción.');
            return;
          }

          // Registrar justificación (opcional)
          tr.cerradoComentario = inJust.value || '';

          // Ajustar inventarios lógicos (a nivel demo)
          aplicarInventariosLogicos(tr);

          tr.cerrado = true;
          saveDB(DB);

          toast('Folio cerrado');
          imprimirPDF(tr, true);
          abrirTraspasoExistente(tr.id); // re-render para deshabilitar botones
        });
        acts2.appendChild(btnCerrar);

        var btnPdf = document.createElement('button');
        btnPdf.className='btn';
        btnPdf.textContent='PDF';
        btnPdf.addEventListener('click', function(){ imprimirPDF(tr, true); });
        acts2.appendChild(btnPdf);

        var btnWA2 = document.createElement('button');
        btnWA2.className='btn';
        btnWA2.title='Enviar PDF por WhatsApp';
        btnWA2.textContent='🟢 WhatsApp';
        btnWA2.addEventListener('click', function(){ compartirWhatsApp(tr); });
        acts2.appendChild(btnWA2);

        bar.appendChild(acts2);
        card.appendChild(bar);
      }

      // Si está cerrado, grisar botones de edición de entrada y dejar PDF activo
      if(tr.cerrado){
        btnVista.disabled = false;
        btnWA.disabled = false;
        btnGuardar.disabled = true;
      }

      host.appendChild(card);
    });
  }

  // ===== Widget de tabla de líneas (común) =====
  function tablaLineasWidget(cfg){
    // cfg: { titulo, bloqueado, lineas, onChange }
    var wrap = document.createElement('div');
    var h = document.createElement('h2'); h.textContent = cfg.titulo;
    wrap.appendChild(h);

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var trh = document.createElement('tr');
    ['#','Foto','Material','Detalle','Gr','Aleación','Subtotal'].forEach(function(t){
      var th = document.createElement('th'); th.textContent = t; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    var tbody = document.createElement('tbody');

    function renderRow(idx){
      var li = cfg.lineas[idx];
      var tr = document.createElement('tr');

      // #
      var td0 = document.createElement('td'); td0.textContent = (idx+1);
      tr.appendChild(td0);

      // Foto (solo preview básico; no almacenamos binario en esta demo)
      var td1 = document.createElement('td');
      var inFile = document.createElement('input'); inFile.type='file'; inFile.accept='image/*';
      inFile.disabled = !!cfg.bloqueado;
      inFile.addEventListener('change', function(){
        li.foto = inFile.files && inFile.files[0] ? inFile.files[0].name : '';
      });
      td1.appendChild(inFile);
      tr.appendChild(td1);

      // Material
      var td2 = document.createElement('td');
      var sel = document.createElement('select');
      MATERIALES.forEach(function(m){
        var op = document.createElement('option'); op.value = m.id; op.textContent = m.nombre;
        if(m.id === li.materialId) op.selected = true;
        sel.appendChild(op);
      });
      sel.disabled = !!cfg.bloqueado;
      sel.addEventListener('change', function(){
        li.materialId = sel.value;
        // Si es .999, sugerir aleación 7% cuando cambie Gr
        // También, si NO es .999, aleación input se pone readonly/ro visual
        inAle.readOnly = (sel.value !== '999');
        if(inAle.readOnly){ inAle.classList.add('ro'); inAle.value = '0.00'; li.aleacion = 0; }
        else { inAle.classList.remove('ro'); }
        recalc();
      });
      td2.appendChild(sel);
      tr.appendChild(td2);

      // Detalle
      var td3 = document.createElement('td');
      var inDet = document.createElement('input'); inDet.type='text'; inDet.value = li.detalle;
      inDet.readOnly = !!cfg.bloqueado;
      inDet.addEventListener('input', function(){ li.detalle = inDet.value; saveDB(DB); });
      td3.appendChild(inDet); tr.appendChild(td3);

      // Gr (primero), Aleación (después)
      var tdGr = document.createElement('td');
      var inGr = document.createElement('input'); inGr.type='number'; inGr.step='0.01'; inGr.min='0'; inGr.value = li.gramos;
      inGr.readOnly = !!cfg.bloqueado;
      inGr.addEventListener('input', function(){
        li.gramos = parseFloat(inGr.value||'0');
        // Si material es .999, proponer aleación 7%
        var mat = MATERIALES.find(function(m){ return m.id===li.materialId; });
        if(mat && li.materialId==='999'){
          var sugerida = li.gramos * 0.07;
          if(!inAle.readOnly){ inAle.value = f2(sugerida); li.aleacion = parseFloat(inAle.value||'0'); }
        }
        recalc();
      });
      tdGr.appendChild(inGr); tr.appendChild(tdGr);

      var tdAle = document.createElement('td');
      var inAle = document.createElement('input'); inAle.type='number'; inAle.step='0.01'; inAle.min='0'; inAle.value = li.aleacion;
      inAle.readOnly = (li.materialId!=='999') || !!cfg.bloqueado;
      if(inAle.readOnly){ inAle.classList.add('ro'); }
      inAle.addEventListener('input', function(){ li.aleacion = parseFloat(inAle.value||'0'); recalc(); });
      tdAle.appendChild(inAle); tr.appendChild(tdAle);

      // Subtotal = Gr + Aleación
      var tdSub = document.createElement('td');
      var inSub = document.createElement('input'); inSub.readOnly = true; inSub.value = f2(li.subtotal);
      tdSub.appendChild(inSub); tr.appendChild(tdSub);

      function recalc(){
        li.subtotal = (parseFloat(li.gramos||0) + parseFloat(li.aleacion||0));
        inSub.value = f2(li.subtotal);
        if(typeof cfg.onChange === 'function'){ cfg.onChange(); }
        saveDB(DB);
      }

      tbody.appendChild(tr);
    }

    // render todas
    cfg.lineas.forEach(function(_, idx){ renderRow(idx); });

    table.appendChild(tbody);
    wrap.appendChild(table);

    return wrap;
  }

  // ===== Helpers de negocios =====
  function sumaSubtotales(arr){
    var s = 0;
    for(var i=0;i<arr.length;i++){ s += parseFloat(arr[i].subtotal||0); }
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

  // Inventario lógico muy simple por almacén (demo)
  function calcDisponibles(almacenId){
    var sum = 0;
    // entradas (a ese almacén) menos salidas (desde ese almacén), pero solo de folios CERRADOS
    DB.traspasos.forEach(function(t){
      if(t.cerrado){
        // Entrada cerrada: sumó a entraA
        if(t.entraA === almacenId){ sum += t.totalGr; }
        // Salida cerrada: restó de saleDe
        if(t.salida && t.salida.creada){
          if(t.salida.saleDe === almacenId){ sum -= t.salida.totalGr; }
          if(t.salida.entraA === almacenId){ sum += t.salida.totalGr; }
        }
      }
    });
    return sum;
  }

  function aplicarInventariosLogicos(t){
    // En esta demo el inventario visible se calcula "on the fly"
    // aquí no hacemos nada, pero dejamos el hook para futuras integraciones
    return;
  }

  // ===== PDF & WhatsApp =====
  function imprimirPDF(tr, cerrado){
    // Construcción simplificada: abrimos una ventana de impresión con el layout
    var w = window.open('','_blank','width=800,height=900');
    var html = [];
    html.push('<!DOCTYPE html><html><head><meta charset="utf-8"/>');
    html.push('<title>Folio '+String(tr.folio).padStart(3,'0')+' — CONTROL-A</title>');
    html.push('<style>@page{size:5.5in 8.5in;margin:10mm}body{font-family:system-ui,Segoe UI,Roboto; font-size:12px} h1{margin:0 0 6px 0} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#e7effa} .row{display:flex;gap:8px;margin-bottom:8px} .col{flex:1}</style>');
    html.push('</head><body>');
    html.push('<h1>Traspaso '+String(tr.folio).padStart(3,'0')+'</h1>');
    html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.fecha+' '+tr.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.entraA)+'</div></div>');
    html.push('<div class="row"><div class="col"><b>Comentarios:</b> '+(escapeHTML(tr.comentarios))+'</div><div class="col"><b>Total GR (entrada):</b> '+f2(tr.totalGr)+'</div></div>');
    html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th><th>Aleación</th><th>Subtotal</th></tr></thead><tbody>');
    tr.lineasEntrada.forEach(function(li, i){
      html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>');
    });
    html.push('</tbody></table>');

    if(tr.salida && tr.salida.creada){
      html.push('<h2>Salida</h2>');
      html.push('<div class="row"><div class="col"><b>Fecha:</b> '+tr.salida.fecha+' '+tr.salida.hora+'</div><div class="col"><b>Sale de:</b> '+nombreAlmacen(tr.salida.saleDe)+'</div><div class="col"><b>Entra a:</b> '+nombreAlmacen(tr.salida.entraA)+'</div></div>');
      html.push('<div class="row"><div class="col"><b>Comentarios salida:</b> '+escapeHTML(tr.salida.comentarios)+'</div><div class="col"><b>Total GR (salida):</b> '+f2(tr.salida.totalGr)+'</div></div>');
      // Merma / Dif
      var dif = tr.salida.totalGr - tr.totalGr;
      var signo = dif>=0 ? '+' : '';
      html.push('<div class="row"><div class="col"><b>MERMA:</b> '+(dif<0?'<span style="color:red;font-weight:bold">'+f2(dif)+'</span>':'')+'</div><div class="col"><b>DIF:</b> '+signo+f2(dif)+'</div></div>');
      html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th><th>Aleación</th><th>Subtotal</th></tr></thead><tbody>');
      tr.salida.lineas.forEach(function(li, i){
        html.push('<tr><td>'+(i+1)+'</td><td>'+nombreMaterial(li.materialId)+'</td><td>'+escapeHTML(li.detalle)+'</td><td>'+f2(li.gramos)+'</td><td>'+f2(li.aleacion)+'</td><td>'+f2(li.subtotal)+'</td></tr>');
      });
      html.push('</tbody></table>');
    }

    html.push('</body></html>');
    w.document.write(html.join(''));
    w.document.close();
    w.focus();
    w.print();
  }

  function compartirWhatsApp(tr){
    // Exportar el mismo contenido de imprimir a un blob y abrir esquema WA
    // En web puro no adjuntamos archivo binario directo al chat (se requiere API),
    // así que abrimos ventana de impresión para que lo guarden y lo envíen manualmente.
    imprimirPDF(tr, tr.cerrado);
    toast('Abre el PDF y compártelo por WhatsApp.');
  }

  // ===== Helpers varios =====
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
      var map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' };
      return map[m];
    });
  }

  // Cargar submenú inicial
  renderSubmenu('inicio');

})();
