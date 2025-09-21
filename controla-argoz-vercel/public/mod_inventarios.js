// =====================================================================
// ============  INICIO MÓDULO INVENTARIO · v1.6 (compact/UI)  ==========
// =====================================================================

/* ===== Bootstrap de DB ===== */
(function initDB(){
  window.DB = window.DB || {};
  DB.folios = DB.folios || {entrada:0,salida:0,traspaso:0};
  DB.movInv = DB.movInv || { entradas:[], salidas:[], traspasos:[], conciliaciones:[] };
  DB.stock  = DB.stock  || { GEN:{}, PROD:{}, ART:{}, COB:{} };
  window.saveDB = window.saveDB || (db=>localStorage.setItem('erp_taller_db',JSON.stringify(db)));
  window.hoyStr = window.hoyStr || (()=>new Date().toISOString().slice(0,10));
  window.f2     = window.f2     || (x=>(parseFloat(x||0)).toFixed(2));
  window.escapeHTML = window.escapeHTML || (s=>(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])));
})();

/* ===== Catálogos ===== */
const INV_ALM = [
  {id:'GEN', nombre:'ALMACEN GENERAL PLATA'},
  {id:'PROD',nombre:'ALMACEN PRODUCCIÓN'},
  {id:'ART', nombre:'ALMACEN PLATA ARTURO'},
  {id:'COB', nombre:'ALMACEN PLATA POR COBRAR'}
];
const INV_MAT = [
  {id:'999',  nombre:'Plata .999 (fina)'},
  {id:'925',  nombre:'Plata .925 (General sólida)'},
  {id:'LMD',  nombre:'Plata .925 limalla dura'},
  {id:'LMN',  nombre:'Plata .925 limalla negra'},
  {id:'OTRO', nombre:'Plata .925 de otro tipo'},
  {id:'TERM', nombre:'Plata .925 producto terminado'},
  {id:'ALC',  nombre:'Plata por Aleación'}
];
function invNameAlm(id){const x=INV_ALM.find(a=>a.id===id);return x?x.nombre:id}
function invNameMat(id){const x=INV_MAT.find(m=>m.id===id);return x?x.nombre:id}
function invGet(alm,mat){const v=parseFloat((DB.stock[alm]||{})[mat]||0);return isFinite(v)?v:0}
function invSet(alm,mat,g){DB.stock[alm]=DB.stock[alm]||{};DB.stock[alm][mat]=parseFloat(g)||0}
function invAdd(alm,mat,g){invSet(alm,mat, invGet(alm,mat)+(parseFloat(g)||0))}
function invSub(alm,mat,g){const cur=invGet(alm,mat),q=parseFloat(g)||0;if(cur<q) throw new Error('Inventario insuficiente de '+invNameMat(mat)+' en '+invNameAlm(alm)); invSet(alm,mat,cur-q)}
function nextFolio(tp){
  if(tp==='EN'){DB.folios.entrada++; saveDB(DB); return 'EN-'+String(DB.folios.entrada).padStart(3,'0')}
  if(tp==='SA'){DB.folios.salida++;  saveDB(DB); return 'SA-'+String(DB.folios.salida).padStart(3,'0')}
  if(tp==='TR'){DB.folios.traspaso++;saveDB(DB); return 'TR-'+String(DB.folios.traspaso).padStart(3,'0')}
  if(tp==='CI'){return 'CI-'+String((DB.movInv.conciliaciones.length+1)).padStart(3,'0')}
  return 'XX-000'
}

/* ===== CSS compacto módulo ===== */
(function injectInvCSS(){
  const id='inv-compact-css';
  if(document.getElementById(id)) return;
  const css = `
  /* Compactación general */
  .module{font-size:13px}
  .module input, .module select, .module textarea{font-size:13px}
  .module .ht-btn{font-size:12px; padding:6px 10px}
  .module .subbtn{ font-size:13px !important; padding:6px 8px !important; display:block; width:100%; text-align:left; margin-bottom:8px; }
  .module .tab{ font-size:12px !important; padding:4px 8px !important; }
  .module .card h2{ font-size:17px !important; }

  /* Estatus (semaforo) */
  .status-pill{display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:4px 10px; border-radius:999px;}
  .status-ok{background:#e8f7ec; color:#166534;}
  .status-warn{background:#fff7ed; color:#b45309;}
  .dot{width:10px;height:10px;border-radius:999px;}
  .dot.ok{background:#16a34a;}
  .dot.warn{background:#f59e0b;}

  /* Chip total existencias */
  .chip-total{display:inline-flex;align-items:center;gap:8px;background:#ecfdf5;color:#065f46;border-radius:999px;padding:6px 12px;font-weight:700}
  `;
  const s=document.createElement('style'); s.id=id; s.textContent=css; document.head.appendChild(s);
})();

/* ===== Hoja de trabajo helpers ===== */
window.HT = window.HT || {
  mountToolbar(root,opts){
    const bar=document.createElement('div'); bar.className='ht-toolbar';
    const left=document.createElement('div'); left.className='ht-left';
    const bNew=document.createElement('button'); bNew.type='button'; bNew.className='ht-btn ht-btn-blue'; bNew.textContent='+ Nuevo '+(opts.docName||'documento'); bNew.onclick=opts.onNew; left.appendChild(bNew);
    const bPrint=document.createElement('button'); bPrint.type='button'; bPrint.className='ht-btn'; bPrint.textContent='🖨️ Imprimir';
    bPrint.onclick=()=>{ if(root.dataset.saved!=='true'){alert('Debes guardar primero el documento para poder generar el PDF');return;} opts.onPrint&&opts.onPrint(); };
    const bSave=document.createElement('button'); bSave.type='button'; bSave.className='ht-btn ht-btn-blue'; bSave.textContent='💾 Guardar'; bSave.dataset.mode='save';
    bSave.onclick=async()=>{ if(bSave.dataset.mode==='edit'){HT.setEditable(root,true);HT._toggle(bSave,true);root.dataset.saved='false';return;}
      if(!confirm('¿Guardar este documento?')) return;
      const r=await (opts.onSave?opts.onSave():true); const ok=(r===true)||(r&&r.ok); const folio=(r&&r.folio)||root.dataset.folio||'';
      if(!ok) return; HT.markSaved(root,folio); HT.setEditable(root,false); HT._toggle(bSave,false);
    };
    bar.appendChild(left); bar.appendChild(bPrint); bar.appendChild(bSave);
    const old=root.querySelector(':scope>.ht-toolbar'); if(old) old.remove(); root.prepend(bar);
  },
  setEditable(root,on){ root.querySelectorAll('[data-edit]').forEach(el=>{ if(on){el.classList.remove('locked'); el.removeAttribute('disabled');} else {el.classList.add('locked'); el.setAttribute('disabled','disabled');} }); },
  markSaved(root,folio){ root.dataset.saved='true'; if(folio) root.dataset.folio=folio; alert(folio?('Documento guardado · Folio '+folio):'Documento guardado'); },
  _toggle(btn,isSave){ if(isSave){btn.textContent='💾 Guardar';btn.dataset.mode='save';} else {btn.textContent='✏️ Editar';btn.dataset.mode='edit';} }
};

function makeLinesTable(cfg){
  const wrap=document.createElement('div');
  const tb=document.createElement('table'); tb.className='table';
  tb.innerHTML='<thead><tr><th style="width:6%">#</th><th style="width:34%">Material</th><th style="width:40%">Descripción</th><th style="width:20%">Gramos</th></tr></thead><tbody></tbody>';
  const body=tb.querySelector('tbody'); wrap.appendChild(tb);

  function paint(){
    body.innerHTML='';
    cfg.lineas.forEach((li,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+(idx+1)+'</td>';
      const tdM=document.createElement('td');
      const sel=document.createElement('select'); INV_MAT.forEach(m=>{const op=document.createElement('option');op.value=m.id;op.textContent=m.nombre+(m.id==='TERM'?' (solo ventas)':''); sel.appendChild(op);});
      sel.value=li.materialId; sel.disabled=!cfg.editable; sel.onchange=()=>{ li.materialId=sel.value; if(li.materialId==='TERM'){ alert('Producto terminado solo se usa en Ventas.'); li.materialId='925'; sel.value='925'; } cfg.onChange&&cfg.onChange(); saveDB(DB); };
      tdM.appendChild(sel); tr.appendChild(tdM);

      const tdD=document.createElement('td');
      const tx=document.createElement('input'); tx.type='text'; tx.value=li.detalle||''; tx.style.width='100%'; if(cfg.editable){tx.setAttribute('data-edit','')} else {tx.classList.add('locked'); tx.setAttribute('disabled','disabled')}
      tx.oninput=()=>{ li.detalle=tx.value; saveDB(DB); };
      tdD.appendChild(tx); tr.appendChild(tdD);

      const tdG=document.createElement('td');
      const gr=document.createElement('input'); gr.type='number'; gr.step='0.01'; gr.min='0'; gr.value=li.gramos||0; gr.style.width='100%'; gr.style.textAlign='right';
      if(cfg.editable){gr.setAttribute('data-edit','')} else {gr.classList.add('locked'); gr.setAttribute('disabled','disabled')}
      gr.oninput=()=>{ li.gramos=parseFloat(gr.value||0); cfg.onChange&&cfg.onChange(); saveDB(DB); };
      tdG.appendChild(gr); tr.appendChild(tdG);

      body.appendChild(tr);
    });
  }
  paint();

  if(cfg.editable){
    const act=document.createElement('div'); act.className='ht-toolbar';
    const add=document.createElement('button'); add.type='button'; add.className='ht-btn'; add.textContent='+ Agregar línea';
    const del=document.createElement('button'); del.type='button'; del.className='ht-btn'; del.textContent='– Eliminar última';
    add.onclick=()=>{ cfg.lineas.push({materialId:'925',detalle:'',gramos:0}); paint(); cfg.onChange&&cfg.onChange(); saveDB(DB); };
    del.onclick=()=>{ if(cfg.lineas.length>1){ cfg.lineas.pop(); paint(); cfg.onChange&&cfg.onChange(); saveDB(DB); } };
    act.appendChild(add); act.appendChild(del); wrap.appendChild(act);
  }
  return wrap;
}

/* ===== Layout seguro del módulo ===== */
function ensureWorkArea(){
  const moduleHost=document.getElementById('moduleHost');
  const cont = moduleHost && moduleHost.querySelector('.module .workcol');
  if(!cont){
    moduleHost.innerHTML='';
    const mod=document.createElement('div'); mod.className='module';
    const sub=document.createElement('div'); sub.className='subcol';
    const box=document.createElement('div'); box.className='card'; box.innerHTML='<h2>Inventarios</h2><div class="subbox" id="inv-subbox"></div>';
    sub.appendChild(box);
    const work=document.createElement('div'); work.className='workcol card';
    work.innerHTML='<div class="tabs" id="inv-tabs"></div><div id="inv-views"></div>';
    mod.appendChild(sub); mod.appendChild(work); moduleHost.appendChild(mod);
    return {tabs:work.querySelector('#inv-tabs'), views:work.querySelector('#inv-views'), subbox:box.querySelector('#inv-subbox')};
  }
  return {
    tabs: document.getElementById('inv-tabs'),
    views: document.getElementById('inv-views'),
    subbox: document.querySelector('.module .subcol .subbox') || document.querySelector('.module .subcol .card .subbox')
  };
}

/* ===== Render raíz del módulo (submenú) ===== */
function renderInventarios(host){
  host.innerHTML='';
  const mod=document.createElement('div'); mod.className='module';

  const sub=document.createElement('div'); sub.className='subcol';
  const box=document.createElement('div'); box.className='card';
  box.innerHTML='<h2>Inventarios</h2><div class="subbox" id="inv-subbox"></div>';
  sub.appendChild(box);

  const work=document.createElement('div'); work.className='workcol card';
  work.innerHTML='<div class="tabs" id="inv-tabs"></div><div id="inv-views"></div>';

  mod.appendChild(sub); mod.appendChild(work);
  host.appendChild(mod);

  const list = box.querySelector('#inv-subbox');
  list.innerHTML = [
    `<button type="button" class="subbtn" data-act="consultar">🔎 Consultar</button>`,
    `<button type="button" class="subbtn" data-act="existencias">📦 Existencias</button>`,
    `<button type="button" class="subbtn" data-act="entrada">📥 Entrada</button>`,
    `<button type="button" class="subbtn" data-act="salida">📤 Salida</button>`,
    `<button type="button" class="subbtn" data-act="traspasos">🔁 Traspasos</button>`,
    `<button type="button" class="subbtn" data-act="conciliar">📋 Hacer inventario (conciliar)</button>`
  ].join('');

  list.addEventListener('click', (ev)=>{
    const b = ev.target.closest('.subbtn'); if(!b) return;
    const act=b.dataset.act;
    try{
      if(act==='consultar') return openConsulta();
      if(act==='existencias') return openExistencias();
      if(act==='entrada') return openEntrada();
      if(act==='salida')  return openSalida();
      if(act==='traspasos') return openTraspasosHome();
      if(act==='conciliar') return openConciliacion(); // ahora cada clic abre hoja nueva
    }catch(e){
      console.error('Error al abrir hoja', e);
      alert('Ocurrió un error al abrir la hoja.');
    }
  });
}

/* ===== helpers de tabs ===== */
function invHost(){
  let tabs=document.getElementById('inv-tabs');
  let views=document.getElementById('inv-views');
  if(!tabs || !views){
    const fixed=ensureWorkArea();
    tabs=fixed.tabs; views=fixed.views;
  }
  return {tabs,views};
}
function invOpenTab(id,title,mount){
  const {tabs,views}=invHost();
  tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  views.querySelectorAll('.view').forEach(v=>v.style.display='none');

  let tab=tabs.querySelector('.tab[data-id="'+id+'"]');
  let view=views.querySelector('#view-'+id);

  if(!tab){
    tab=document.createElement('button'); tab.type='button'; tab.className='tab active'; tab.dataset.id=id; tab.textContent=title; tabs.appendChild(tab);
    view=document.createElement('div'); view.className='view'; view.id='view-'+id; views.appendChild(view);
    tab.onclick=()=>{ tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); views.querySelectorAll('.view').forEach(v=>v.style.display='none'); tab.classList.add('active'); view.style.display='block'; };
    try{ if(typeof mount==='function') mount(view); }catch(e){ console.error(e); view.innerHTML='<div class="card"><p class="muted">Error al montar la hoja.</p></div>'; }
  }
  tab.classList.add('active'); view.style.display='block';
}

/* ========================== ENTRADA ========================== */
function openEntrada(){
  const doc = { id:'EN'+Date.now(), folio:nextFolio('EN'), fecha:hoyStr(), motivo:'COMPRA', destino:'GEN', comentario:'', lineas:[
    {materialId:'925',detalle:'',gramos:0},{materialId:'999',detalle:'',gramos:0},{materialId:'LMD',detalle:'',gramos:0},{materialId:'LMN',detalle:'',gramos:0},{materialId:'ALC',detalle:'',gramos:0}
  ], total:0 };
  invOpenTab(doc.id, 'Entrada '+doc.folio, (v)=>mountEntrada(v,doc));
}
function mountEntrada(host,doc){
  host.innerHTML='';
  const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=doc.folio;

  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const totalEl=document.createElement('div'); totalEl.className='money'; totalEl.textContent='0.00 g'; totalWrap.appendChild(totalEl);
  const setTotal=(g)=>{ totalEl.textContent=f2(g)+' g'; };

  HT.mountToolbar(sheet,{docName:'entrada',
    onNew: openEntrada,
    onSave: ()=>{
      if(doc.destino!=='GEN'){ alert('Por ahora las Entradas solo van a ALMACEN GENERAL PLATA.'); return false; }
      let t=0; doc.lineas.forEach(li=>{
        const g=parseFloat(li.gramos||0); if(g<=0) return;
        if(li.materialId==='TERM'){ alert('Producto terminado solo se usa en Ventas.'); return false; }
        if(li.materialId==='ALC'){ invAdd('GEN','925',g); } else { invAdd('GEN', li.materialId, g); }
        t+=g;
      });
      doc.total=t; DB.movInv.entradas.push(JSON.parse(JSON.stringify(doc))); saveDB(DB);
      return {ok:true, folio:doc.folio};
    },
    onPrint: ()=>printEntrada(doc)
  });

  const enc=document.createElement('div'); enc.className='grid';
  enc.innerHTML=
    '<div><label>Folio</label><input value="'+doc.folio+'" disabled></div>'+
    '<div><label>Fecha</label><input data-field="fecha" data-edit type="date" value="'+doc.fecha+'"></div>'+
    '<div><label>Motivo</label><select data-field="motivo" data-edit><option>COMPRA</option><option>DONACION</option><option>PRESTAMO</option><option>REPOSICIÓN</option></select></div>'+
    '<div><label>Destino</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-field="coment" data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);

  enc.querySelector('[data-field="fecha"]').onchange = e=>{doc.fecha=e.target.value; saveDB(DB)};
  enc.querySelector('[data-field="motivo"]').value = doc.motivo;
  enc.querySelector('[data-field="motivo"]').onchange = e=>{doc.motivo=e.target.value; saveDB(DB)};
  enc.querySelector('[data-field="coment"]').value = doc.comentario;
  enc.querySelector('[data-field="coment"]').oninput = e=>{doc.comentario=e.target.value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({
    lineas:doc.lineas,
    editable:true,
    onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); setTotal(s); }
  }));

  sheet.appendChild(totalWrap);
  HT.setEditable(sheet,true);
  host.appendChild(sheet);
}
function printEntrada(doc){
  const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800}';
  const html=[];
  html.push('<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+doc.folio+'</title></head><body>');
  html.push('<h2>Entrada <span class="folio">'+doc.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+doc.fecha+'</div><div class="col"><b>Motivo:</b> '+doc.motivo+'</div><div class="col"><b>Destino:</b> '+invNameAlm('GEN')+'</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gramos</th></tr></thead><tbody>');
  doc.lineas.forEach((li,i)=>{ if(parseFloat(li.gramos||0)<=0) return; html.push('<tr><td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>'); });
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
}

/* =========================== SALIDA ========================== */
function openSalida(){
  const doc = { id:'SA'+Date.now(), folio:nextFolio('SA'), fecha:hoyStr(), origen:'GEN', comentario:'', lineas:[
    {materialId:'925',detalle:'',gramos:0},{materialId:'LMD',detalle:'',gramos:0},{materialId:'LMN',detalle:'',gramos:0},{materialId:'OTRO',detalle:'',gramos:0},{materialId:'999',detalle:'',gramos:0}
  ], total:0 };
  invOpenTab(doc.id, 'Salida '+doc.folio, (v)=>mountSalida(v,doc));
}
function mountSalida(host,doc){
  host.innerHTML='';
  const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=doc.folio;

  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const totalEl=document.createElement('div'); totalEl.className='money'; totalEl.textContent='0.00 g'; totalWrap.appendChild(totalEl);
  const setTotal=(g)=>{ totalEl.textContent=f2(g)+' g'; };

  HT.mountToolbar(sheet,{docName:'salida',
    onNew: openSalida,
    onSave: ()=>{
      if(doc.origen!=='GEN'){ alert('Por ahora las Salidas solo salen de ALMACEN GENERAL PLATA.'); return false; }
      let t=0;
      try{
        doc.lineas.forEach(li=>{ const g=parseFloat(li.gramos||0); if(g<=0) return; if(li.materialId==='TERM'){throw new Error('Producto terminado solo se usa en Ventas.')} invSub('GEN', li.materialId, g); t+=g; });
      }catch(err){ alert(err.message); return false; }
      doc.total=t; DB.movInv.salidas.push(JSON.parse(JSON.stringify(doc))); saveDB(DB);
      return {ok:true, folio:doc.folio};
    },
    onPrint: ()=>printSalida(doc)
  });

  const enc=document.createElement('div'); enc.className='grid';
  enc.innerHTML=
    '<div><label>Folio</label><input value="'+doc.folio+'" disabled></div>'+
    '<div><label>Fecha</label><input data-field="fecha" data-edit type="date" value="'+doc.fecha+'"></div>'+
    '<div><label>Origen</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-field="coment" data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);

  enc.querySelector('[data-field="fecha"]').onchange = e=>{doc.fecha=e.target.value; saveDB(DB)};
  enc.querySelector('[data-field="coment"]').value = doc.comentario;
  enc.querySelector('[data-field="coment"]').oninput = e=>{doc.comentario=e.target.value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({
    lineas:doc.lineas, editable:true,
    onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); setTotal(s); }
  }));

  sheet.appendChild(totalWrap);
  HT.setEditable(sheet,true);
  host.appendChild(sheet);
}
function printSalida(doc){
  const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800}';
  const html=['<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+doc.folio+'</title></head><body>'];
  html.push('<h2>Salida <span class="folio">'+doc.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+doc.fecha+'</div><div class="col"><b>Origen:</b> '+invNameAlm('GEN')+'</div><div class="col"><b>Total:</b> '+f2(doc.total)+' g</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody>');
  doc.lineas.forEach((li,i)=>{ if(parseFloat(li.gramos||0)<=0) return; html.push('<tr><td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>'); });
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
}

/* ========================= TRASPASOS ========================= */
function openTraspasosHome(){ invOpenTab('TRHOME', 'Traspasos', mountTraspasosHome); }
function mountTraspasosHome(host){
  host.innerHTML='';
  const card=document.createElement('div'); card.className='card'; card.style.marginBottom='10px';
  const bar=document.createElement('div'); bar.className='ht-toolbar';
  const bNew=document.createElement('button'); bNew.type='button'; bNew.className='ht-btn ht-btn-blue'; bNew.textContent='+ Nuevo traspaso (salida)';
  bNew.onclick=openNuevoTraspaso; bar.appendChild(bNew); card.appendChild(bar);
  host.appendChild(card);

  const secP=document.createElement('div'); secP.className='card'; secP.innerHTML='<h2>Traspasos pendientes</h2>';
  const pend=DB.movInv.traspasos.filter(t=>!t.cerrado).sort((a,b)=>b.num-a.num);
  if(pend.length===0){ secP.innerHTML+='<p class="muted">Sin pendientes.</p>'; }
  else{
    pend.forEach(t=>{
      const row=document.createElement('div'); row.className='ht-toolbar';
      row.innerHTML='<span class="ht-btn">'+t.folio+'</span><span>'+invNameAlm(t.origen)+' → '+invNameAlm(t.destino)+' · '+t.fecha+'</span>';
      const bAbr=document.createElement('button'); bAbr.className='ht-btn'; bAbr.type='button'; bAbr.textContent='Abrir'; bAbr.onclick=()=>openTraspasoDetalle(t.id);
      const bOk=document.createElement('button'); bOk.className='ht-btn ht-btn-blue'; bOk.type='button'; bOk.textContent='Aceptar en destino'; bOk.onclick=()=>aceptarTraspaso(t.id);
      row.appendChild(bAbr); row.appendChild(bOk); secP.appendChild(row);
    });
  }
  host.appendChild(secP);

  const secC=document.createElement('div'); secC.className='card'; secC.innerHTML='<h2>Traspasos cerrados</h2>';
  const cer=DB.movInv.traspasos.filter(t=>!!t.cerrado).sort((a,b)=>b.num-a.num);
  if(cer.length===0){ secC.innerHTML+='<p class="muted">Aún no hay cerrados.</p>'; }
  else{
    cer.forEach(t=>{
      const row=document.createElement('div'); row.className='ht-toolbar';
      row.innerHTML='<span class="ht-btn">'+t.folio+'</span><span>'+invNameAlm(t.origen)+' → '+invNameAlm(t.destino)+' · '+t.fecha+'</span>';
      const bPdf=document.createElement('button'); bPdf.className='ht-btn'; bPdf.type='button'; bPdf.textContent='PDF'; bPdf.onclick=()=>pdfTraspaso(t,false);
      row.appendChild(bPdf); secC.appendChild(row);
    });
  }
  host.appendChild(secC);
}

function openNuevoTraspaso(){
  const t={ id:'TR'+Date.now(), num:(DB.folios.traspaso+1), folio:nextFolio('TR'), fecha:hoyStr(), origen:'GEN', destino:'PROD', comentario:'', lineas:[
    {materialId:'925',detalle:'',gramos:0},{materialId:'LMD',detalle:'',gramos:0},{materialId:'LMN',detalle:'',gramos:0},{materialId:'OTRO',detalle:'',gramos:0}
  ], total:0, cerrado:false };
  invOpenTab(t.id, 'Traspaso '+t.folio, v=>mountTraspaso(v,t));
}
function mountTraspaso(host,t){
  host.innerHTML='';
  const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=t.folio;

  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const totalEl=document.createElement('div'); totalEl.className='money'; totalEl.textContent='0.00 g'; totalWrap.appendChild(totalEl);
  const setTotal=(g)=>{ totalEl.textContent=f2(g)+' g'; };

  HT.mountToolbar(sheet,{docName:'traspaso (salida)',
    onNew: openNuevoTraspaso,
    onSave: ()=>{
      let total=0; try{ t.lineas.forEach(li=>{ const g=parseFloat(li.gramos||0); if(g<=0) return; invSub(t.origen, li.materialId, g); total+=g; }); }catch(e){ alert(e.message); return false; }
      t.total=total; DB.movInv.traspasos.push(JSON.parse(JSON.stringify(t))); saveDB(DB); return {ok:true, folio:t.folio};
    },
    onPrint: ()=>pdfTraspaso(t,true)
  });

  const enc=document.createElement('div'); enc.className='grid';
  enc.innerHTML='<div><label>Folio</label><input value="'+t.folio+'" disabled></div>'+
    '<div><label>Fecha</label><input data-field="fecha" data-edit type="date" value="'+t.fecha+'"></div>'+
    '<div><label>Sale de</label>'+selAlm(t.origen,true)+'</div>'+
    '<div><label>Entra a</label>'+selAlm(t.destino,true)+'</div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-field="coment" data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);
  function selAlm(val,edit){ let s='<select '+(edit?'data-edit':'disabled')+' data-field="alm">'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`}); return s+'</select>' }

  enc.querySelector('[data-field="fecha"]').onchange = e=>{t.fecha=e.target.value; saveDB(DB)};
  const alms=enc.querySelectorAll('[data-field="alm"]');
  alms[0].onchange = e=>{t.origen=e.target.value; saveDB(DB)};
  alms[1].onchange = e=>{t.destino=e.target.value; saveDB(DB)};
  enc.querySelector('[data-field="coment"]').value = t.comentario;
  enc.querySelector('[data-field="coment"]').oninput = e=>{t.comentario=e.target.value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({
    lineas:t.lineas, editable:true,
    onChange:()=>{ let s=0; t.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); setTotal(s); }
  }));

  sheet.appendChild(totalWrap);
  HT.setEditable(sheet,true);
  host.appendChild(sheet);
}

function openTraspasoDetalle(id){
  const t=DB.movInv.traspasos.find(x=>x.id===id); if(!t){alert('No encontrado');return}
  invOpenTab('TRDET'+id, 'Traspaso '+t.folio, view=>{
    view.innerHTML='';
    const card=document.createElement('div'); card.className='card';
    const h=document.createElement('h2'); h.textContent='Detalle'; card.appendChild(h);
    const p=document.createElement('p'); p.textContent=invNameAlm(t.origen)+' → '+invNameAlm(t.destino)+' · '+t.fecha; card.appendChild(p);
    const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th></tr></thead><tbody></tbody>'; const body=tb.querySelector('tbody');
    t.lineas.forEach((li,i)=>{ const tr=document.createElement('tr'); tr.innerHTML='<td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td>'; body.appendChild(tr); });
    card.appendChild(tb);
    const bar=document.createElement('div'); bar.className='ht-toolbar';
    const bPdf=document.createElement('button'); bPdf.className='ht-btn'; bPdf.type='button'; bPdf.textContent='PDF'; bPdf.onclick=()=>pdfTraspaso(t,false);
    bar.appendChild(bPdf);
    if(!t.cerrado){ const bOk=document.createElement('button'); bOk.className='ht-btn ht-btn-blue'; bOk.type='button'; bOk.textContent='Aceptar en destino'; bOk.onclick=()=>{ aceptarTraspaso(t.id) }; bar.appendChild(bOk); }
    card.appendChild(bar); view.appendChild(card);
  });
}
function aceptarTraspaso(id){
  const t=DB.movInv.traspasos.find(x=>x.id===id); if(!t){alert('No encontrado');return}
  if(t.cerrado){alert('Ya cerrado.');return}
  t.lineas.forEach(li=>{ const g=parseFloat(li.gramos||0); if(g<=0) return; invAdd(t.destino, li.materialId, g); });
  t.cerrado=true; t.aceptado=hoyStr(); saveDB(DB);
  alert('Traspaso aceptado en destino.');
  openTraspasosHome();
}
function pdfTraspaso(t,borrador){
  const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800} .water{position:fixed;top:40%;left:18%;font-size:46px;color:#9ca3af80;transform:rotate(-18deg);}';
  const html=['<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+t.folio+'</title></head><body>'];
  if(borrador) html.push('<div class="water">BORRADOR</div>');
  html.push('<h2>Traspaso <span class="folio">'+t.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+t.fecha+'</div><div class="col"><b>Sale de:</b> '+invNameAlm(t.origen)+'</div><div class="col"><b>Entra a:</b> '+invNameAlm(t.destino)+'</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th></tr></thead><tbody>');
  t.lineas.forEach((li,i)=>{ html.push('<tr><td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>');});
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
}

/* ================== CONCILIACIÓN (mejorada + view) ================== */
function openConciliacion(){
  const id='CONC'+Date.now(); // pestaña única cada vez
  invOpenTab(id, 'Conciliación de Inventario', view=>mountConciliacion(view, null));
}
function mountConciliacion(host,loadedDoc){
  host.innerHTML='';
  const sheet=document.createElement('div'); sheet.className='ht-sheet';
  sheet.dataset.saved = loadedDoc ? 'true' : 'false';
  const readOnly = !!loadedDoc;

  // Modelo
  const model = loadedDoc || {
    id:'CI'+Date.now(),
    folio: nextFolio('CI'),
    fecha: hoyStr(),
    almacen: 'GEN',
    ajusteFinal: 0,
    filas: INV_MAT.filter(m=>m.id!=='TERM').map(m=>({mat:m.id, conteo:0}))
  };

  let totalDif = 0;
  let ajuste    = model.ajusteFinal || 0;

  function statusClass(){ return Math.abs(totalDif+ajuste)<0.0000001 ? 'ok' : 'warn'; }
  function statusText(){  return Math.abs(totalDif+ajuste)<0.0000001 ? 'Conciliado' : 'Por conciliar'; }

  HT.mountToolbar(sheet,{docName:'conciliación',
    onNew: openConciliacion,
    onSave: ()=>{
      const alm=sel.value; let totalAdj=0;
      rows.forEach(r=>{ const sis=invGet(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis);
        if(Math.abs(dif)>0){ if(dif>0){ invAdd(alm,r.mat,dif) } else { try{ invSub(alm,r.mat,-dif) }catch(e){ alert(e.message) } } totalAdj+=dif; }
      });
      if(Math.abs(ajuste)>0){ if(ajuste>0){ invAdd(alm,'925',ajuste) } else { try{ invSub(alm,'925',-ajuste) }catch(e){ alert(e.message) } totalAdj+=ajuste; }
      model.fecha = fecha.value; model.almacen = alm; model.ajusteFinal = ajuste; model.filas = JSON.parse(JSON.stringify(rows));
      // Folio ya lo tiene (creado arriba)
      DB.movInv.conciliaciones.push(JSON.parse(JSON.stringify({ id:model.id, folio:model.folio, fecha:model.fecha, almacen:model.almacen, filas:model.filas, totalAjuste:totalAdj, ajusteFinal:ajuste })));
      saveDB(DB);
      return {ok:true, folio:model.folio};
    },
    onPrint: ()=>{
      const alm=sel.value; const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
      const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .status{display:inline-flex;gap:6px;align-items:center;font-weight:700} .dot{width:10px;height:10px;border-radius:999px}';
      const ok = (Math.abs(totalDif+ajuste)<0.0001);
      const html=['<html><head><meta charset="utf-8"><style>'+css+'</style><title>Conciliación</title></head><body>'];
      html.push('<h2>Conciliación de Inventario <span style="color:#b91c1c">('+model.folio+')</span></h2>');
      html.push('<div class="row"><div class="col"><b>Fecha al:</b> '+fecha.value+'</div><div class="col"><b>Almacén:</b> '+invNameAlm(alm)+'</div><div class="col status"><span class="dot" style="background:'+(ok?'#16a34a':'#f59e0b')+'"></span> '+(ok?'Conciliado':'Por conciliar')+'</div></div>');
      html.push('<table><thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia (g)</th></tr></thead><tbody>');
      rows.forEach(r=>{ const sis=invGet(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis); html.push('<tr><td>'+invNameMat(r.mat)+'</td><td>'+f2(sis)+'</td><td>'+f2(r.conteo||0)+'</td><td>'+f2(dif)+'</td></tr>'); });
      html.push('</tbody></table>');
      html.push('<p><b>Ajuste final:</b> '+f2(ajuste)+' g · <b>Diferencia total post-ajuste:</b> '+f2(totalDif+ajuste)+' g</p>');
      html.push('</body></html>');
      w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
    }
  });

  const top=document.createElement('div'); top.className='grid';
  top.innerHTML='<div><label>Almacén</label>'+selAlm(model.almacen,!readOnly)+'</div><div><label>Fecha al</label><input '+(readOnly?'disabled':'data-edit')+' type="date" value="'+(model.fecha||hoyStr())+'"></div><div style="display:flex;align-items:end;justify-content:flex-end"><span class="status-pill status-'+(statusClass())+'"><span class="dot '+statusClass()+'"></span> '+statusText()+'</span></div>';
  sheet.appendChild(top);
  function selAlm(val,edit){ let s='<select '+(edit?'data-edit':'disabled')+'>'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`}); return s+'</select>' }
  const sel=top.querySelector('select'); const fecha=top.querySelector('input[type="date"]');

  const box=document.createElement('div'); box.className='card'; box.innerHTML='<h2>Conteos por material</h2>';
  const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia</th></tr></thead><tbody></tbody><tfoot><tr><th colspan="3" style="text-align:right">Diferencia total:</th><th class="totaldif">0.00</th></tr><tr><th colspan="3" style="text-align:right">Ajuste final (± g):</th><th>'+(readOnly?('<span class="ajusteRO">'+f2(ajuste)+'</span>'):'<input data-edit type="number" step="0.01" value="'+f2(ajuste)+'" style="width:100%;text-align:right" class="ajuste">')+'</th></tr><tr><th colspan="3" style="text-align:right">Total posterior a ajuste:</th><th class="post">0.00</th></tr></tfoot>'; 
  const body=tb.querySelector('tbody'); const cellTotal=tb.querySelector('.totaldif'); const cellPost=tb.querySelector('.post'); const inAjuste=tb.querySelector('.ajuste');
  box.appendChild(tb); sheet.appendChild(box);

  const rows = INV_MAT.filter(m=>m.id!=='TERM').map(m=>{
    const exist= (model.filas||[]).find(x=>x.mat===m.id);
    return {mat:m.id, conteo: exist? (parseFloat(exist.conteo||0)) : 0, sis:0, dif:0};
  });

  function recompute(){
    const alm=sel.value;
    totalDif = 0;
    rows.forEach(r=>{ r.sis=invGet(alm,r.mat); r.dif=(parseFloat(r.conteo||0)-r.sis); });
    totalDif = rows.reduce((a,b)=>a+(b.dif||0),0);
    cellTotal.textContent=f2(totalDif);
    cellPost.textContent=f2(totalDif + ajuste);
    // Estatus
    const pill = sheet.querySelector('.status-pill');
    const ok = Math.abs(totalDif+ajuste)<0.0000001;
    pill.className='status-pill '+(ok?'status-ok':'status-warn');
    pill.innerHTML='<span class="dot '+(ok?'ok':'warn')+'"></span> '+(ok?'Conciliado':'Por conciliar');
  }
  function paint(){
    const alm=sel.value;
    body.innerHTML='';
    rows.forEach(r=>{
      r.sis=invGet(alm,r.mat);
      const tr=document.createElement('tr');
      tr.innerHTML='<td>'+invNameMat(r.mat)+'</td><td class="sis">'+f2(r.sis)+'</td><td>'+(readOnly?('<span>'+f2(r.conteo||0)+'</span>'):'<input data-edit type="number" step="0.01" value="'+(r.conteo||0)+'" style="width:100%;text-align:right">')+'</td><td class="dif">0.00</td>';
      const tdSis=tr.querySelector('.sis'); const tdDif=tr.querySelector('.dif');
      const inC = readOnly? null : tr.querySelector('input');
      function upd(){
        r.sis=invGet(alm,r.mat); tdSis.textContent=f2(r.sis);
        r.dif=(parseFloat(r.conteo||0)-r.sis); tdDif.textContent=f2(r.dif);
        recompute();
      }
      if(inC){
        inC.oninput=()=>{ r.conteo=parseFloat(inC.value||0); upd(); };
      }
      upd();
      body.appendChild(tr);
    });
  }
  paint();

  if(!readOnly){
    if(inAjuste){ inAjuste.oninput=()=>{ ajuste=parseFloat(inAjuste.value||0); recompute(); }; }
    sel.onchange=()=>{ paint(); };
    HT.setEditable(sheet,true);
  }else{
    HT.setEditable(sheet,false);
  }
  host.appendChild(sheet);
}

/* ======================= CONSULTAR (iguala view) ======================= */
function openConsulta(){ invOpenTab('INVCONS'+Date.now(), 'Consultar documentos', mountConsulta); }
function mountConsulta(host){
  host.innerHTML='';
  const card=document.createElement('div'); card.className='card';

  const bar=document.createElement('div'); bar.className='ht-toolbar';
  const selTipo=document.createElement('select');
  ['ENTRADAS','SALIDAS','TRASPASOS','CONCILIACIÓN'].forEach(t=>{const op=document.createElement('option');op.text=t; selTipo.appendChild(op);});
  const fIni=document.createElement('input'); fIni.type='date'; fIni.value=hoyStr();
  const fFin=document.createElement('input'); fFin.type='date'; fFin.value=hoyStr();
  const q=document.createElement('input'); q.type='text'; q.placeholder='Buscar... (folio, comentario)';
  const go=document.createElement('button'); go.type='button'; go.className='ht-btn ht-btn-blue'; go.textContent='➡ Buscar';
  bar.appendChild(selTipo); bar.appendChild(fIni); bar.appendChild(fFin); bar.appendChild(q); bar.appendChild(go);
  card.appendChild(bar);

  const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>Tipo</th><th>Folio</th><th>Fecha</th><th>Info</th><th>Total (g)</th></tr></thead><tbody></tbody>';
  const body=tb.querySelector('tbody'); card.appendChild(tb);
  host.appendChild(card);

  function between(d,a,b){ return d>=a && d<=b; }
  function addRow(tipo, folio, fecha, info, total, openFn){
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+tipo+'</td><td>'+folio+'</td><td>'+fecha+'</td><td>'+escapeHTML(info||'')+'</td><td style="text-align:right">'+f2(total||0)+'</td>';
    tr.ondblclick=openFn; body.appendChild(tr);
  }
  function run(){
    body.innerHTML='';
    const a=fIni.value, b=fFin.value,qq=(q.value||'').toLowerCase();
    if(selTipo.value==='ENTRADAS'){
      DB.movInv.entradas.filter(d=>between(d.fecha,a,b) && (d.folio.toLowerCase().includes(qq)|| (d.comentario||'').toLowerCase().includes(qq))).forEach(d=>{
        addRow('Entrada', d.folio, d.fecha, d.comentario, (d.total||0), ()=>viewEntrada(d));
      });
    }
    if(selTipo.value==='SALIDAS'){
      DB.movInv.salidas.filter(d=>between(d.fecha,a,b) && (d.folio.toLowerCase().includes(qq)|| (d.comentario||'').toLowerCase().includes(qq))).forEach(d=>{
        addRow('Salida', d.folio, d.fecha, d.comentario, (d.total||0), ()=>viewSalida(d));
      });
    }
    if(selTipo.value==='TRASPASOS'){
      DB.movInv.traspasos.filter(d=>between(d.fecha,a,b) && (d.folio.toLowerCase().includes(qq)|| (d.comentario||'').toLowerCase().includes(qq))).forEach(d=>{
        addRow('Traspaso', d.folio, d.fecha, invNameAlm(d.origen)+' → '+invNameAlm(d.destino), (d.total||0), ()=>openTraspasoDetalle(d.id));
      });
    }
    if(selTipo.value==='CONCILIACIÓN'){
      DB.movInv.conciliaciones.filter(d=>between(d.fecha,a,b) && (d.folio.toLowerCase().includes(qq))).forEach(d=>{
        addRow('Conciliación', d.folio, d.fecha, invNameAlm(d.almacen), (d.totalAjuste||0), ()=>viewConciliacion(d));
      });
    }
  }
  go.onclick=run; run();
}
function viewEntrada(d){
  invOpenTab('VIEWEN'+d.folio, 'Entrada '+d.folio, v=>{
    v.innerHTML='';
    const c=document.createElement('div'); c.className='card';
    c.innerHTML='<h2>Entrada '+d.folio+'</h2><p><b>Fecha:</b> '+d.fecha+' · <b>Destino:</b> '+invNameAlm('GEN')+' · <b>Motivo:</b> '+d.motivo+'</p>';
    const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody></tbody>'; const body=tb.querySelector('tbody');
    (d.lineas||[]).forEach((li,i)=>{ const tr=document.createElement('tr'); tr.innerHTML='<td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td>'; body.appendChild(tr); });
    c.appendChild(tb); v.appendChild(c);
  });
}
function viewSalida(d){
  invOpenTab('VIEWSA'+d.folio, 'Salida '+d.folio, v=>{
    v.innerHTML='';
    const c=document.createElement('div'); c.className='card';
    c.innerHTML='<h2>Salida '+d.folio+'</h2><p><b>Fecha:</b> '+d.fecha+' · <b>Origen:</b> '+invNameAlm('GEN')+'</p>';
    const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody></tbody>'; const body=tb.querySelector('tbody');
    (d.lineas||[]).forEach((li,i)=>{ const tr=document.createElement('tr'); tr.innerHTML='<td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td>'; body.appendChild(tr); });
    c.appendChild(tb); v.appendChild(c);
  });
}
function viewConciliacion(d){
  // Reutilizamos el mismo layout de la hoja de conciliación en modo lectura
  invOpenTab('VIEWCI'+d.folio, 'Conciliación '+d.folio, v=>{
    const loaded={ id:d.id, folio:d.folio, fecha:d.fecha, almacen:d.almacen, ajusteFinal:(d.ajusteFinal||0),
      filas:(d.filas||[]).map(r=>({mat:r.mat, conteo:r.conteo})) };
    mountConciliacion(v, loaded);
  });
}

/* ======================= EXISTENCIAS (nuevo) ======================= */
function openExistencias(){ invOpenTab('INVSTK'+Date.now(), 'Existencias', mountExistencias); }
function mountExistencias(host){
  host.innerHTML='';
  const card=document.createElement('div'); card.className='card'; card.innerHTML='<h2>Existencias por almacén</h2>';

  INV_ALM.forEach(a=>{
    // Total por almacén
    const total = INV_MAT.filter(m=>m.id!=='TERM')
      .reduce((acc,m)=>acc+invGet(a.id,m.id),0);
    const chip=document.createElement('div'); chip.className='chip-total'; chip.textContent=invNameAlm(a.id)+' · Total: '+f2(total)+' g';
    card.appendChild(chip);

    const tb=document.createElement('table'); tb.className='table'; tb.style.margin='10px 0 18px 0';
    tb.innerHTML='<thead><tr><th>Material</th><th>Gramos</th></tr></thead><tbody></tbody>';
    const body=tb.querySelector('tbody');
    INV_MAT.filter(m=>m.id!=='TERM').forEach(m=>{
      const tr=document.createElement('tr'); tr.innerHTML='<td>'+invNameMat(m.id)+'</td><td style="text-align:right">'+f2(invGet(a.id,m.id))+'</td>'; body.appendChild(tr);
    });
    card.appendChild(tb);
  });
  host.appendChild(card);
}

// =====================================================================
// ==============  FIN MÓDULO INVENTARIO · v1.6 (compact/UI)  ===========
// =====================================================================
