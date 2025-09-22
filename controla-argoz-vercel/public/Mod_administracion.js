/* =========================================================
   MOD · ADMINISTRACIÓN v1.0 (compact/UI)
   - Usa la misma UI base que Inventarios (grids, cards, tabs)
   - Define: window.renderAdministracion(host)
   ========================================================= */

(function(){
  "use strict";

  // Utilidades pequeñas (reusa las globales si existen)
  var f2 = window.f2 || function(n){ return (parseFloat(n||0)).toFixed(2); };
  var hoyStr = window.hoyStr || function(){ return new Date().toISOString().slice(0,10); };

  // Bootstrap de estado admin en DB
  if(!window.DB) window.DB = {};
  if(!DB.admin){
    DB.admin = {
      consecutivoGasto: 0,
      consecutivoConc: 0,
      gastos: [],
      ingresos: [],
      conciliaciones: [],
      cuentas: [
        { id:'caja_plata',   nombre:'Caja de Plata' },
        { id:'caja_general', nombre:'Caja General' },
        { id:'banco_mxn',    nombre:'Banco MXN' }
      ],
      cuentasContables: [
        { id:'renta', nombre:'Renta' },
        { id:'servicios', nombre:'Servicios (luz/agua/internet)' },
        { id:'mantenimiento', nombre:'Mantenimiento' },
        { id:'honorarios', nombre:'Honorarios' },
        { id:'otros', nombre:'Otros gastos' }
      ]
    };
    window.saveDB && saveDB(DB);
  }

  function ctaNombre(id){
    var c = (DB.admin.cuentas||[]).find(function(x){return x.id===id;});
    return c ? c.nombre : '—';
  }
  function ctaContNombre(id){
    var c = (DB.admin.cuentasContables||[]).find(function(x){return x.id===id;});
    return c ? c.nombre : '—';
  }

  function openTab(scopedHost, id, titulo, renderFn){
    // pequeño manejador de tabs dentro del módulo
    var tabs = scopedHost.querySelector('.tabs');
    var views = scopedHost.querySelector('.views');
    var btn = tabs.querySelector('[data-tab="'+id+'"]');
    if(btn){
      tabs.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
      btn.classList.add('active');
      views.querySelectorAll('.view').forEach(function(v){v.style.display='none';});
      views.querySelector('#view-'+id).style.display='block';
      return;
    }
    var t = document.createElement('button');
    t.className='tab active';
    t.setAttribute('data-tab',id);
    t.textContent=titulo;
    tabs.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
    tabs.appendChild(t);

    views.querySelectorAll('.view').forEach(function(v){v.style.display='none';});
    var v=document.createElement('div');
    v.className='view';
    v.id='view-'+id;
    v.style.display='block';
    views.appendChild(v);

    t.addEventListener('click', function(){
      tabs.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
      t.classList.add('active');
      views.querySelectorAll('.view').forEach(function(vw){vw.style.display='none';});
      v.style.display='block';
    });

    renderFn(v);
  }

  /* ====== SUBVISTAS ====== */

  function uiGastos(v){
    v.innerHTML='';
    var card=document.createElement('div'); card.className='card';
    var h=document.createElement('h2'); h.textContent='Gastos'; card.appendChild(h);

    // filtros rápidos
    var g=document.createElement('div'); g.className='grid';
    var d1=document.createElement('div'); d1.innerHTML='<label>Desde</label><input type="date" id="ga-desde">';
    var d2=document.createElement('div'); d2.innerHTML='<label>Hasta</label><input type="date" id="ga-hasta">';
    var d3=document.createElement('div');
    var sCta=document.createElement('select');
    (DB.admin.cuentas||[]).forEach(function(c){
      var op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; sCta.appendChild(op);
    });
    var l3=document.createElement('label'); l3.textContent='Cuenta de pago';
    d3.appendChild(l3); d3.appendChild(sCta);
    var d4=document.createElement('div');
    var bBuscar=document.createElement('button'); bBuscar.className='ht-btn'; bBuscar.textContent='Buscar';
    d4.appendChild(document.createElement('label')); d4.appendChild(bBuscar);
    g.appendChild(d1); g.appendChild(d2); g.appendChild(d3); g.appendChild(d4);
    card.appendChild(g);

    // tabla
    var tbl=document.createElement('table'); tbl.className='table';
    var thead=document.createElement('thead'); var trh=document.createElement('tr');
    ['Folio','Fecha','Cuenta pago','Cuenta contable','Monto'].forEach(function(t){
      var th=document.createElement('th'); th.textContent=t; trh.appendChild(th);
    });
    thead.appendChild(trh); tbl.appendChild(thead);
    var tbody=document.createElement('tbody'); tbl.appendChild(tbody);
    card.appendChild(tbl);

    // alta rápida
    var right=document.createElement('div'); right.className='right';
    var bNuevo=document.createElement('button'); bNuevo.className='ht-btn ht-btn-blue'; bNuevo.textContent='+ Registrar gasto';
    right.appendChild(bNuevo); card.appendChild(right);

    function pinta(){
      tbody.innerHTML='';
      var rows=DB.admin.gastos||[];
      rows.forEach(function(gst){
        var ok=true, des=v.querySelector('#ga-desde').value, has=v.querySelector('#ga-hasta').value;
        if(des){ ok=ok && gst.fecha>=des; }
        if(has){ ok=ok && gst.fecha<=has; }
        if(sCta.value){ ok=ok && gst.cuentaId===sCta.value; }
        if(!ok) return;
        var tr=document.createElement('tr');
        function td(t){ var d=document.createElement('td'); d.textContent=t; return d; }
        tr.appendChild(td(String(gst.folio||0).toString().padStart(3,'0')));
        tr.appendChild(td(gst.fecha||''));
        tr.appendChild(td(ctaNombre(gst.cuentaId)));
        tr.appendChild(td(ctaContNombre(gst.cuentaContableId)));
        tr.appendChild(td('$ '+f2(gst.monto||0)));
        tbody.appendChild(tr);
      });
    }

    bBuscar.addEventListener('click', pinta);
    bNuevo.addEventListener('click', function(){
      DB.admin.consecutivoGasto+=1;
      var g={
        id:'G'+Date.now(), folio:DB.admin.consecutivoGasto,
        fecha:hoyStr(), cuentaId:(DB.admin.cuentas[0]||{}).id||'',
        cuentaContableId:(DB.admin.cuentasContables[0]||{}).id||'',
        monto:0
      };
      DB.admin.gastos.push(g); window.saveDB && saveDB(DB);
      pinta();
      alert('Gasto creado: folio '+String(g.folio).padStart(3,'0')+'. Edición detallada la integramos después.');
    });

    pinta();
    v.appendChild(card);
  }

  function uiConciliacion(v){
    v.innerHTML='';
    var c=document.createElement('div'); c.className='card';
    var h=document.createElement('h2'); h.textContent='Conciliación de Cajas'; c.appendChild(h);

    var g=document.createElement('div'); g.className='grid';
    var d1=document.createElement('div'); var l1=document.createElement('label'); l1.textContent='Cuenta';
    var s=document.createElement('select'); (DB.admin.cuentas||[]).forEach(function(ct){
      var op=document.createElement('option'); op.value=ct.id; op.textContent=ct.nombre; s.appendChild(op);
    });
    d1.appendChild(l1); d1.appendChild(s); g.appendChild(d1);

    var d2=document.createElement('div'); d2.innerHTML='<label>Desde</label><input type="date" id="co-desde">';
    var d3=document.createElement('div'); d3.innerHTML='<label>Hasta</label><input type="date" id="co-hasta">';
    var d4=document.createElement('div'); var b=document.createElement('button'); b.className='ht-btn'; b.textContent='Calcular'; d4.appendChild(document.createElement('label')); d4.appendChild(b);
    g.appendChild(d2); g.appendChild(d3); g.appendChild(d4);
    c.appendChild(g);

    var res=document.createElement('div'); res.className='tabs'; c.appendChild(res);
    var chips=document.createElement('div'); chips.className='card'; chips.style.marginTop='8px'; c.appendChild(chips);

    b.addEventListener('click', function(){
      var desde=v.querySelector('#co-desde').value||'0000-01-01';
      var hasta=v.querySelector('#co-hasta').value||'9999-12-31';
      var cuenta=s.value;
      var ins=(DB.admin.ingresos||[]).filter(function(m){return m.cuentaId===cuenta && m.fecha>=desde && m.fecha<=hasta;});
      var egs=(DB.admin.gastos||[]).filter(function(g){return g.cuentaId===cuenta && g.tipo!=='por_pagar' && g.fecha>=desde && g.fecha<=hasta;});
      var sumIn=ins.reduce(function(a,x){return a+(+x.monto||0);},0);
      var sumEg=egs.reduce(function(a,x){return a+(+x.monto||0);},0);
      chips.innerHTML='<b>Ingresos:</b> $ '+f2(sumIn)+' &nbsp; <b>Egresos:</b> $ '+f2(sumEg)+' &nbsp; <b>Saldo esperado:</b> $ '+f2(sumIn-sumEg);
    });

    v.appendChild(c);
  }

  function uiER(v){
    v.innerHTML='';
    var c=document.createElement('div'); c.className='card';
    c.innerHTML='<h2>Estado de Resultados</h2><p class="muted">Próxima iteración.</p>';
    v.appendChild(c);
  }

  function uiDashboard(v){
    v.innerHTML='';
    var c=document.createElement('div'); c.className='card';
    c.innerHTML='<h2>Dashboard</h2><p class="muted">Próxima iteración.</p>';
    v.appendChild(c);
  }

  /* ====== RENDER PRINCIPAL ====== */
  function renderUI(host){
    host.innerHTML='';
    var mod=document.createElement('div'); mod.className='module';

    // Submenú
    var sub=document.createElement('div'); sub.className='subcol';
    var subbox=document.createElement('div'); subbox.className='subbox';
    function sb(txt,fn){
      var b=document.createElement('button'); b.className='subbtn'; b.textContent=txt; b.addEventListener('click',fn); return b;
    }
    subbox.appendChild(sb('Gastos', function(){ openTab(mod,'gastos','Gastos', uiGastos); }));
    subbox.appendChild(sb('Conciliación de Cajas', function(){ openTab(mod,'conc','Conciliación', uiConciliacion); }));
    subbox.appendChild(sb('Estado de Resultados', function(){ openTab(mod,'er','Estado de Resultados', uiER); }));
    subbox.appendChild(sb('Dashboard', function(){ openTab(mod,'dash','Dashboard', uiDashboard); }));
    sub.appendChild(subbox);

    // Hoja de trabajo
    var work=document.createElement('div'); work.className='workcol';
    var tabs=document.createElement('div'); tabs.className='tabs';
    var views=document.createElement('div'); views.className='views';
    work.appendChild(tabs); work.appendChild(views);

    mod.appendChild(sub); mod.appendChild(work);
    host.appendChild(mod);

    // abre por defecto "Gastos"
    openTab(mod,'gastos','Gastos', uiGastos);
  }

  // Export para el router del index
  window.renderAdministracion = function(host){ renderUI(host); };

})();
