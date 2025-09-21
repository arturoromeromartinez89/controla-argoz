<!-- /public/mod_administracion.js -->
<script>
// ================================================================
// ============  INICIO MÓDULO ADMINISTRACIÓN v1.0  ===============
// ============  (compact/UI – listo para pegar)   ===============
// ================================================================

(function initAdminBootstrap(){
  window.DB = window.DB || {};
  DB.admin = DB.admin || {
    consecutivoGasto: 0,
    consecutivoConc: 0,
    gastos: [],
    ingresos: [],
    conciliaciones: [],
    cuentas: [
      { id:'caja_plata',   nombre:'Caja de Plata' },
      { id:'caja_general', nombre:'Caja General'  },
      { id:'banco_mxn',    nombre:'Banco MXN'     }
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
  if (typeof window.saveDB === 'function') saveDB(DB);
})();

/* ===== Helpers mínimos (usan utilidades del index) ===== */
function moneyFmt(n){ return '$ ' + (Number(n||0)).toFixed(2); }
function moneyParse(s){
  if(typeof s === 'number') return s;
  const raw = String(s||'').replace(/^\s*\$\s*/,'').replace(/,/g,'');
  const n = parseFloat(raw); return isNaN(n)?0:n;
}
function nextGastoId(){ DB.admin.consecutivoGasto+=1; if(saveDB) saveDB(DB); return 'G'+Date.now(); }
function nextConcFolio(){ DB.admin.consecutivoConc+=1; if(saveDB) saveDB(DB); return DB.admin.consecutivoConc; }
function ctaNombre(id){ const c=DB.admin.cuentas.find(x=>x.id===id); return c?c.nombre:'—'; }
function ctaContNombre(id){ const c=DB.admin.cuentasContables.find(x=>x.id===id); return c?c.nombre:'—'; }

/* ================================================================
   RENDER: MÓDULO ADMINISTRACIÓN
================================================================ */
window.renderAdministracion = function(host){
  host.innerHTML = '';

  // Contenedor de módulo (submenu izquierda + hoja trabajo derecha)
  const mod = document.createElement('div');
  mod.className = 'module';

  // ---------- SUBMENU IZQUIERDO ----------
  const sub = document.createElement('div');
  sub.className = 'subcol';
  const box = document.createElement('div');
  box.className = 'subbox';

  function subBtn(txt, icon, onClick){
    const b = document.createElement('button');
    b.className = 'subbtn';
    b.innerHTML = icon + ' ' + txt;
    b.addEventListener('click', onClick);
    return b;
  }

  const bGastos   = subBtn('Gastos','💸', ()=>openGastos());
  const bConc     = subBtn('Conciliación de Cajas','🧾', ()=>openConciliacion());
  const bER       = subBtn('Estado de Resultados','📑', ()=>openER());
  const bDash     = subBtn('Dashboard','📊', ()=>openDash());

  box.appendChild(bGastos);
  box.appendChild(bConc);
  box.appendChild(bER);
  box.appendChild(bDash);
  sub.appendChild(box);

  // ---------- HOJA DE TRABAJO / VISTAS ----------
  const work = document.createElement('div');
  work.className = 'workcol';

  // Tabs (chips arriba del canvas de trabajo)
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const views = document.createElement('div');

  work.appendChild(tabs);
  work.appendChild(views);

  mod.appendChild(sub);
  mod.appendChild(work);
  host.appendChild(mod);

  /* ====== Motor de pestañas ====== */
  function openTab(id, title, painter){
    // chip
    let chip = tabs.querySelector(`.tab[data-tab="${id}"]`);
    if(!chip){
      chip = document.createElement('button');
      chip.className = 'tab';
      chip.dataset.tab = id;
      chip.textContent = title;
      chip.addEventListener('click', ()=>activate(id));
      tabs.appendChild(chip);
    }else{
      chip.textContent = title;
    }

    // view
    let view = views.querySelector(`#view-${id}`);
    if(!view){
      view = document.createElement('div');
      view.id = `view-${id}`;
      view.className = 'view';
      views.appendChild(view);
    }
    // pintar contenido
    view.innerHTML = '';
    painter(view);

    // activar
    activate(id);
  }
  function activate(id){
    tabs.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===id));
    views.querySelectorAll('.view').forEach(v=>v.style.display = (v.id===`view-${id}`)?'block':'none');
  }

  /* ===========================================================
     SUBMÓDULO: GASTOS (lista + alta/edición simple)
  ============================================================ */
  function openGastos(){
    openTab('admin-gastos','Admin · Gastos', (hostView)=>{
      const card = document.createElement('div'); card.className='card';

      // Toolbar superior
      const bar = document.createElement('div'); bar.className='ht-toolbar';
      const left = document.createElement('div'); left.className='ht-left';
      const bNew = document.createElement('button'); bNew.className='ht-btn ht-btn-blue'; bNew.textContent = '+ Registrar gasto';
      bNew.onclick = ()=>nuevoGasto();
      left.appendChild(bNew);
      bar.appendChild(left);
      card.appendChild(bar);

      // Filtros rápidos
      const g = document.createElement('div'); g.className='grid';
      const d1 = document.createElement('div'); d1.innerHTML = '<label>Fecha inicio</label><input type="date">';
      const d2 = document.createElement('div'); d2.innerHTML = '<label>Fecha fin</label><input type="date">';
      const d3 = document.createElement('div');
      d3.innerHTML = '<label>Tipo</label>';
      const selTipo=document.createElement('select');
      [['','TODOS'],['pagado','Pagado'],['por_pagar','Por pagar'],['recurrente','Recurrente']]
        .forEach(p=>{ const op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; selTipo.appendChild(op); });
      d3.appendChild(selTipo);
      const d4 = document.createElement('div');
      d4.innerHTML = '<label>Cuenta</label>';
      const selCta=document.createElement('select');
      const opAll=document.createElement('option'); opAll.value=''; opAll.textContent='Todas'; selCta.appendChild(opAll);
      DB.admin.cuentas.forEach(c=>{const op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; selCta.appendChild(op);});
      const bBuscar=document.createElement('button'); bBuscar.className='ht-btn'; bBuscar.textContent='Buscar';
      const wrapC4=document.createElement('div'); wrapC4.style.display='flex'; wrapC4.style.alignItems='end'; wrapC4.style.gap='8px';
      wrapC4.appendChild(selCta); wrapC4.appendChild(bBuscar);
      d4.appendChild(wrapC4);
      g.appendChild(d1); g.appendChild(d2); g.appendChild(d3); g.appendChild(d4);
      card.appendChild(g);

      // Tabla
      const tbl = document.createElement('table'); tbl.className='table';
      const thead=document.createElement('thead'); const trh=document.createElement('tr');
      ['Folio','Fecha','Tipo','Cuenta pago','Cuenta contable','Monto',''].forEach(h=>{
        const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
      });
      thead.appendChild(trh); tbl.appendChild(thead);
      const tbody=document.createElement('tbody'); tbl.appendChild(tbody);
      card.appendChild(tbl);

      hostView.appendChild(card);

      function pinta(){
        tbody.innerHTML='';
        const fi = d1.querySelector('input').value || '';
        const ff = d2.querySelector('input').value || '';
        const t  = selTipo.value;
        const c  = selCta.value;

        DB.admin.gastos.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).forEach(g=>{
          let ok=true;
          if(fi) ok = ok && g.fecha>=fi;
          if(ff) ok = ok && g.fecha<=ff;
          if(t)  ok = ok && g.tipo===t;
          if(c)  ok = ok && g.cuentaId===c;
          if(!ok) return;

          const tr=document.createElement('tr'); tr.style.cursor='pointer';
          tr.onclick=()=>abrirGasto(g.id);

          function td(t){ const d=document.createElement('td'); d.textContent=t; return d; }
          tr.appendChild(td(String(g.folio||0).padStart(3,'0')));
          tr.appendChild(td(g.fecha||''));
          tr.appendChild(td(g.tipo||''));
          tr.appendChild(td(ctaNombre(g.cuentaId)));
          tr.appendChild(td(ctaContNombre(g.cuentaContableId)));
          const dMonto=document.createElement('td'); dMonto.innerHTML = '<b style="color:#0a3a74">'+moneyFmt(g.monto||0)+'</b>'; tr.appendChild(dMonto);
          const dIcon=document.createElement('td'); dIcon.style.textAlign='right'; dIcon.textContent = g.bloqueado?'✏️':'💾'; tr.appendChild(dIcon);
          tbody.appendChild(tr);
        });
      }
      bBuscar.onclick=pinta; pinta();

      function nuevoGasto(){
        const g={
          id: nextGastoId(),
          folio: ++DB.admin.consecutivoGasto,
          ts: Date.now(),
          tipo:'pagado',
          fecha: (window.hoyStr? hoyStr(): new Date().toISOString().slice(0,10)),
          cuentaId:'',
          cuentaContableId:'',
          monto:0,
          bloqueado:false
        };
        DB.admin.gastos.push(g); if(saveDB) saveDB(DB);
        abrirGasto(g.id);
      }

      function abrirGasto(id){
        const g = DB.admin.gastos.find(x=>x.id===id); if(!g) return;
        openTab(`gasto-${g.id}`, `Gasto ${String(g.folio).padStart(3,'0')}`, (v)=>{
          const card=document.createElement('div'); card.className='card';

          // Toolbar
          const bar=document.createElement('div'); bar.className='ht-toolbar';
          const left=document.createElement('div'); left.className='ht-left';
          const bNuevo=document.createElement('button'); bNuevo.className='ht-btn'; bNuevo.textContent='Nuevo gasto';
          bNuevo.onclick = ()=>nuevoGasto();
          const bImp=document.createElement('button'); bImp.className='ht-btn'; bImp.textContent='🖨️ Imprimir';
          bImp.onclick=()=>alert('PDF: coming soon');
          const bWA=document.createElement('button'); bWA.className='ht-btn'; bWA.textContent='WhatsApp';
          bWA.onclick=()=>alert('Exporta el PDF y comparte por WhatsApp.');
          left.appendChild(bNuevo); left.appendChild(bImp); left.appendChild(bWA);
          bar.appendChild(left);

          const right=document.createElement('div');
          const bGuardar=document.createElement('button'); bGuardar.className='ht-btn ht-btn-blue'; bGuardar.textContent='GUARDAR';
          const bEditar=document.createElement('button'); bEditar.className='ht-btn'; bEditar.textContent='✏️ Editar';
          function paintRight(){
            right.innerHTML='';
            if(g.bloqueado) right.appendChild(bEditar); else right.appendChild(bGuardar);
          }
          bGuardar.onclick=()=>{
            if(!g.cuentaContableId){ alert('Selecciona la cuenta contable.'); return; }
            if(g.tipo==='pagado' && !g.cuentaId){ alert('Selecciona la cuenta de pago.'); return; }
            g.bloqueado=true; if(saveDB) saveDB(DB); paintRight(); lock(true);
            alert('Gasto guardado con éxito. Folio '+String(g.folio).padStart(3,'0'));
          };
          bEditar.onclick=()=>{ g.bloqueado=false; if(saveDB) saveDB(DB); paintRight(); lock(false); };
          paintRight();
          bar.appendChild(right);
          card.appendChild(bar);

          // Encabezado
          const grid=document.createElement('div'); grid.className='grid';

          const dT=document.createElement('div'); dT.innerHTML='<label>Tipo de gasto</label>';
          const sT=document.createElement('select');
          [['pagado','Pagado'],['por_pagar','Por pagar'],['recurrente','Recurrente']].forEach(p=>{
            const op=document.createElement('option'); op.value=p[0]; op.textContent=p[1]; if(g.tipo===p[0]) op.selected=true; sT.appendChild(op);
          });
          sT.onchange=()=>{ g.tipo=sT.value; if(saveDB) saveDB(DB); };
          dT.appendChild(sT);

          const dF=document.createElement('div'); dF.innerHTML='<label>Fecha</label>';
          const iF=document.createElement('input'); iF.type='date'; iF.value=g.fecha||'';
          iF.onchange=()=>{ g.fecha=iF.value; if(saveDB) saveDB(DB); };
          dF.appendChild(iF);

          const dC=document.createElement('div'); dC.innerHTML='<label>Cuenta de pago</label>';
          const sC=document.createElement('select'); const opV=document.createElement('option'); opV.value=''; opV.textContent='(Selecciona)'; sC.appendChild(opV);
          DB.admin.cuentas.forEach(c=>{ const op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; if(g.cuentaId===c.id) op.selected=true; sC.appendChild(op); });
          sC.onchange=()=>{ g.cuentaId=sC.value; if(saveDB) saveDB(DB); };
          dC.appendChild(sC);

          const dCC=document.createElement('div'); dCC.innerHTML='<label>Cuenta contable</label>';
          const sCC=document.createElement('select'); const op0=document.createElement('option'); op0.value=''; op0.textContent='(Selecciona)'; sCC.appendChild(op0);
          DB.admin.cuentasContables.forEach(cc=>{ const op=document.createElement('option'); op.value=cc.id; op.textContent=cc.nombre; if(g.cuentaContableId===cc.id) op.selected=true; sCC.appendChild(op); });
          sCC.onchange=()=>{ g.cuentaContableId=sCC.value; if(saveDB) saveDB(DB); };
          dCC.appendChild(sCC);

          const dM=document.createElement('div'); dM.innerHTML='<label>Monto</label>';
          const iM=document.createElement('input'); iM.type='text'; iM.value=moneyFmt(g.monto||0); iM.style.fontWeight='800';
          iM.oninput = ()=>{ g.monto = moneyParse(iM.value); if(saveDB) saveDB(DB); };
          iM.onblur  = ()=>{ iM.value = moneyFmt(moneyParse(iM.value)); };
          dM.appendChild(iM);

          grid.appendChild(dT); grid.appendChild(dF); grid.appendChild(dC); grid.appendChild(dCC); grid.appendChild(dM);
          card.appendChild(grid);

          v.appendChild(card);

          function lock(ro){
            [sT,iF,sC,sCC,iM].forEach(el=>{ el.disabled=ro; if(ro){el.classList.add('ro')}else{el.classList.remove('ro')} });
          }
          lock(!!g.bloqueado);
        });
      }
    });
  }

  /* ===========================================================
     SUBMÓDULO: CONCILIACIÓN (demo funcional ligera)
  ============================================================ */
  function openConciliacion(){
    openTab('admin-conc','Conciliación de caja / cuenta', (hostView)=>{
      const card=document.createElement('div'); card.className='card';

      const g=document.createElement('div'); g.className='grid';
      // Cuenta
      const dCta=document.createElement('div'); dCta.innerHTML='<label>Cuenta</label>';
      const sCta=document.createElement('select');
      DB.admin.cuentas.forEach(c=>{ const op=document.createElement('option'); op.value=c.id; op.textContent=c.nombre; sCta.appendChild(op); });
      dCta.appendChild(sCta);
      // Fechas
      const d1=document.createElement('div'); d1.innerHTML='<label>Desde</label><input type="date">';
      const d2=document.createElement('div'); d2.innerHTML='<label>Hasta</label><input type="date">';
      // Buscar
      const dB=document.createElement('div'); dB.innerHTML='<label>&nbsp;</label>';
      const bBuscar=document.createElement('button'); bBuscar.className='ht-btn'; bBuscar.textContent='Buscar';
      dB.appendChild(bBuscar);

      g.appendChild(dCta); g.appendChild(d1); g.appendChild(d2); g.appendChild(dB);
      card.appendChild(g);

      const chips=document.createElement('div'); chips.className='ht-toolbar'; card.appendChild(chips);

      const tIn=document.createElement('div'); tIn.className='card';
      tIn.innerHTML='<h2>Ingresos del periodo</h2>';
      const tblIn=document.createElement('table'); tblIn.className='table';
      tblIn.innerHTML='<thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th></tr></thead><tbody></tbody>';
      tIn.appendChild(tblIn);

      const tEg=document.createElement('div'); tEg.className='card';
      tEg.innerHTML='<h2>Egresos (pagados) del periodo</h2>';
      const tblEg=document.createElement('table'); tblEg.className='table';
      tblEg.innerHTML='<thead><tr><th>Fecha</th><th>Cuenta contable</th><th>Monto</th></tr></thead><tbody></tbody>';
      tEg.appendChild(tblEg);

      card.appendChild(tIn); card.appendChild(tEg);

      hostView.appendChild(card);

      bBuscar.onclick = ()=>{
        const tbodyIn=tblIn.querySelector('tbody');
        const tbodyEg=tblEg.querySelector('tbody');
        tbodyIn.innerHTML=''; tbodyEg.innerHTML=''; chips.innerHTML='';

        // Demo: sumariza la data guardada
        const fi = d1.querySelector('input').value || '0000-01-01';
        const ff = d2.querySelector('input').value || '9999-12-31';
        const cta = sCta.value;

        const ingresos = (DB.admin.ingresos||[]).filter(m=>m.cuentaId===cta && m.fecha>=fi && m.fecha<=ff);
        const gastos   = (DB.admin.gastos||[]).filter(g=>g.tipo==='pagado' && g.cuentaId===cta && g.fecha>=fi && g.fecha<=ff);

        let sumIn=0, sumEg=0;
        ingresos.forEach(m=>{
          sumIn += Number(m.monto||0);
          const tr=document.createElement('tr');
          tr.innerHTML=`<td>${m.fecha||''}</td><td>${m.concepto||'Ingreso'}</td><td>${moneyFmt(m.monto||0)}</td>`;
          tbodyIn.appendChild(tr);
        });
        gastos.forEach(g=>{
          sumEg += Number(g.monto||0);
          const tr=document.createElement('tr');
          tr.innerHTML=`<td>${g.fecha||''}</td><td>${ctaContNombre(g.cuentaContableId)}</td><td>${moneyFmt(g.monto||0)}</td>`;
          tbodyEg.appendChild(tr);
        });

        function chip(txt){
          const s=document.createElement('span');
          s.className='tab';
          s.textContent=txt;
          return s;
        }
        chips.appendChild(chip('Ingresos: '+moneyFmt(sumIn)));
        chips.appendChild(chip('Egresos: '+moneyFmt(sumEg)));
        chips.appendChild(chip('Saldo esperado: '+moneyFmt(sumIn - sumEg)));

        // Guardado rápido de conciliación (demo)
        const bGuardar=document.createElement('button'); bGuardar.className='ht-btn ht-btn-blue'; bGuardar.textContent='GUARDAR conciliación';
        bGuardar.onclick=()=>{
          const folio = nextConcFolio();
          DB.admin.conciliaciones.push({
            id:'C'+Date.now(), folio, cuentaId:cta, desde:fi, hasta:ff,
            ingresos:sumIn, egresos:sumEg, saldoEsperado:(sumIn-sumEg), bloqueado:true, ts:Date.now()
          });
          if(saveDB) saveDB(DB);
          alert('Conciliación guardada. Folio '+String(folio).padStart(3,'0'));
        };
        chips.appendChild(bGuardar);
      };
    });
  }

  /* ===========================================================
     SUBMÓDULOS: Placeholders
  ============================================================ */
  function openER(){
    openTab('admin-er','Estado de Resultados', (v)=>{
      const c=document.createElement('div'); c.className='card';
      c.innerHTML='<h2>Estado de Resultados</h2><p class="muted">(Próximamente: semana/quincena, ventas – gastos = utilidad.)</p>';
      v.appendChild(c);
    });
  }
  function openDash(){
    openTab('admin-dash','Dashboard Administrativo', (v)=>{
      const c=document.createElement('div'); c.className='card';
      c.innerHTML='<h2>Dashboard Administrativo</h2><p class="muted">(KPIs próximos.)</p>';
      v.appendChild(c);
    });
  }

  // Abrir por defecto
  bGastos.click();
};

// ================================================================
// ===================  FIN MÓDULO ADMINISTRACIÓN  =================
// ==========================  v1.0 (UI)  ==========================
// ================================================================
</script>
