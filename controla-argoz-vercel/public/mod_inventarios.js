// =====================================================================
// ============  INICIO MÓDULO INVENTARIO · v1.3 (robusto)  ============
// =====================================================================

/* ===== Bootstrap de DB ===== */
(function initDB(){
  window.DB = window.DB || {};
  DB.folios = DB.folios || {entrada:0,salida:0,traspaso:0};
  DB.movInv = DB.movInv || { entradas:[], salidas:[], traspasos:[], conciliaciones:[] };
  DB.stock  = DB.stock  || { GEN:{}, PROD:{}, ART:{}, COB:{} };
  // utilidades base si no existen (por si el index no las expuso aún)
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
  {id:'925',  nombre:'Plata .925 (única)'},
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

/* ===== Overrides visuales (submenú más chico) ===== */
(function injectInvCSS(){
  const id='inv-compact-css';
  if(document.getElementById(id)) return;
  const css = `
  .module .subbtn{ font-size:13px !important; padding:6px 8px !important; }
  .module .tab{ font-size:12px !important; padding:4px 8px !important; }
  .module .card h2{ font-size:18px !important; }
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

/* ===== Render del módulo ===== */
function ensureWorkArea(){
  // se asegura que existan las zonas de tabs y views
  const moduleHost=document.getElementById('moduleHost');
  const cont = moduleHost && moduleHost.querySelector('.module .workcol');
  if(!cont){
    // recrear layout mínimo del módulo
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

  // Submenú por delegación (un solo listener y data-act)
  const list = box.querySelector('#inv-subbox');
  list.innerHTML = [
    `<button type="button" class="subbtn" data-act="entrada">📥 Entrada</button>`,
    `<button type="button" class="subbtn" data-act="salida">📤 Salida</button>`,
    `<button type="button" class="subbtn" data-act="traspasos">🔁 Traspasos</button>`,
    `<button type="button" class="subbtn" data-act="conciliar">📋 Hacer inventario (conciliar)</button>`
  ].join('');

  list.addEventListener('click', (ev)=>{
    const b = ev.target.closest('.subbtn'); if(!b) return;
    const act=b.dataset.act;
    try{
      if(act==='entrada') return openEntrada();
      if(act==='salida')  return openSalida();
      if(act==='traspasos') return openTraspasosHome();
      if(act==='conciliar') return openConciliacion();
    }catch(e){
      console.error('Error al abrir hoja', e);
      alert('Ocurrió un error al abrir la hoja. Ya lo reforcé, intenta de nuevo.');
    }
  });
}

/* helpers de tabs */
function invHost(){
  let tabs=document.getElementById('inv-tabs');
  let views=document.getElementById('inv-views');
  if(!tabs || !views){
    // reconstruir si faltan
    const fixed=ensureWorkArea();
    tabs=fixed.tabs; views=fixed.views;
  }
  return {tabs,views};
}
function invOpenTab(id,title,mount){
  const {tabs,views}=invHost();
  // desactivar actuales
  tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  views.querySelectorAll('.view').forEach(v=>v.style.display='none');

  let tab=tabs.querySelector('.tab[data-id="'+id+'"]');
  let view=views.querySelector('#view-'+id);

  if(!tab){
    tab=document.createElement('button'); tab.type='button'; tab.className='tab active'; tab.dataset.id=id; tab.textContent=title; tabs.appendChild(tab);
    view=document.createElement('div'); view.className='view'; view.id='view-'+id; views.appendChild(view);
    tab.onclick=()=>{ tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); views.querySelectorAll('.view').forEach(v=>v.style.display='none'); tab.classList.add('active'); view.style.display='block'; };
    // montar con try/catch para no romper el tab si hay un error en el montaje
    try{ if(typeof mount==='function') mount(view); }catch(e){ console.error(e); view.innerHTML='<div class="card"><p class="muted">Error al montar la hoja.</p></div>'; }
  }
  tab.classList.add('active'); view.style.display='block';
}

/* ====== ENTRADA ====== */
function openEntrada(){
  const doc = { id:'EN'+Date.now(), folio:nextFolio('EN'), fecha:hoyStr(), motivo:'COMPRA', destino:'GEN', comentario:'', lineas:[
    {materialId:'925',detalle:'',gramos:0},{materialId:'999',detalle:'',gramos:0},{materialId:'LMD',detalle:'',gramos:0},{materialId:'LMN',detalle:'',gramos:0},{materialId:'ALC',detalle:'',gramos:0}
  ], total:0 };
  invOpenTab(doc.id, 'Entrada '+doc.folio, (v)=>mountEntrada(v,doc));
}
function mountEntrada(host,doc){
  host.innerHTML=''; const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=doc.folio;

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
    '<div><label>Fecha</label><input data-edit type="date" value="'+doc.fecha+'"></div>'+
    '<div><label>Motivo</label><select data-edit><option>COMPRA</option><option>DONACION</option><option>PRESTAMO</option><option>REPOSICIÓN</option></select></div>'+
    '<div><label>Destino</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);
  const ins=enc.querySelectorAll('input,select,textarea');
  ins[1].onchange=()=>{doc.fecha=ins[1].value; saveDB(DB)}; ins[2].onchange=()=>{doc.motivo=ins[2].value; saveDB(DB)}; ins[5].oninput=()=>{doc.comentario=ins[5].value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({lineas:doc.lineas, editable:true, onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); total.textContent=f2(s)+' g'; }}));
  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const total=document.createElement('div'); total.className='money'; total.textContent='0.00 g'; totalWrap.appendChild(total); sheet.appendChild(totalWrap);

  HT.setEditable(sheet,true); host.appendChild(sheet);
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

/* ====== SALIDA ====== */
function openSalida(){
  const doc = { id:'SA'+Date.now(), folio:nextFolio('SA'), fecha:hoyStr(), origen:'GEN', comentario:'', lineas:[
    {materialId:'925',detalle:'',gramos:0},{materialId:'LMD',detalle:'',gramos:0},{materialId:'LMN',detalle:'',gramos:0},{materialId:'OTRO',detalle:'',gramos:0},{materialId:'999',detalle:'',gramos:0}
  ], total:0 };
  invOpenTab(doc.id, 'Salida '+doc.folio, (v)=>mountSalida(v,doc));
}
function mountSalida(host,doc){
  host.innerHTML=''; const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=doc.folio;

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
    '<div><label>Fecha</label><input data-edit type="date" value="'+doc.fecha+'"></div>'+
    '<div><label>Origen</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);
  const ins=enc.querySelectorAll('input,select,textarea'); ins[1].onchange=()=>{doc.fecha=ins[1].value; saveDB(DB)}; ins[4].oninput=()=>{doc.comentario=ins[4].value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({lineas:doc.lineas, editable:true, onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); total.textContent=f2(s)+' g'; }}));
  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const total=document.createElement('div'); total.className='money'; total.textContent='0.00 g'; totalWrap.appendChild(total); sheet.appendChild(totalWrap);

  HT.setEditable(sheet,true); host.appendChild(sheet);
}
function printSalida(doc){
  const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800}';
  const html=['<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+doc.folio+'</title></head><body>'];
  html.push('<h2>Salida <span class="folio">'+doc.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+doc.fecha+'</div><div class="col"><b>Origen:</b> '+invNameAlm('GEN')+'</div><div class="col"><b>Total:</b> '+f2(doc.total)+' g</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gramos</th></tr></thead><tbody>');
  doc.lineas.forEach((li,i)=>{ if(parseFloat(li.gramos||0)<=0) return; html.push('<tr><td>'+(i+1)+'</td><td>'+invNameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>'); });
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
}

/* ====== TRASPASOS ====== */
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
  host.innerHTML=''; const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=t.folio;

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
    '<div><label>Fecha</label><input data-edit type="date" value="'+t.fecha+'"></div>'+
    '<div><label>Sale de</label>'+selAlm(t.origen,true)+'</div>'+
    '<div><label>Entra a</label>'+selAlm(t.destino,true)+'</div>'+
    '<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
  sheet.appendChild(enc);

  function selAlm(val,edit){ let s='<select '+(edit?'data-edit':'disabled')+'>'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`}); return s+'</select>' }
  const ins=enc.querySelectorAll('input,select,textarea'); ins[1].onchange=()=>{t.fecha=ins[1].value; saveDB(DB)}; ins[2].onchange=()=>{t.origen=ins[2].value; saveDB(DB)}; ins[3].onchange=()=>{t.destino=ins[3].value; saveDB(DB)}; ins[4].oninput=()=>{t.comentario=ins[4].value; saveDB(DB)};

  sheet.appendChild(makeLinesTable({lineas:t.lineas, editable:true, onChange:()=>{ let s=0; t.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); total.textContent=f2(s)+' g'; }}));
  const totalWrap=document.createElement('div'); totalWrap.className='right';
  const total=document.createElement('div'); total.className='money'; total.textContent='0.00 g'; totalWrap.appendChild(total); sheet.appendChild(totalWrap);

  HT.setEditable(sheet,true); host.appendChild(sheet);
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

/* ====== CONCILIACIÓN ====== */
function openConciliacion(){ invOpenTab('CONCINV', 'Conciliación de Inventario', mountConciliacion); }
function mountConciliacion(host){
  host.innerHTML=''; const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false';

  HT.mountToolbar(sheet,{docName:'conciliación',
    onNew: openConciliacion,
    onSave: ()=>{
      const alm=sel.value; let totalAdj=0;
      rows.forEach(r=>{ const sis=invGet(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis);
        if(Math.abs(dif)>0){ if(dif>0){ invAdd(alm,r.mat,dif) } else { try{ invSub(alm,r.mat,-dif) }catch(e){ alert(e.message) } } totalAdj+=dif; }
      });
      const folio=nextFolio('CI'); DB.movInv.conciliaciones.push({ id:'CI'+Date.now(), folio, fecha:fecha.value, almacen:alm, filas:JSON.parse(JSON.stringify(rows)), totalAjuste:totalAdj }); saveDB(DB);
      return {ok:true, folio};
    },
    onPrint: ()=>{
      const alm=sel.value; const w=window.open('','_blank','width=820,height=900'); if(!w){alert('Permite pop-ups.');return}
      const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1}';
      const html=['<html><head><meta charset="utf-8"><style>'+css+'</style><title>Conciliación</title></head><body>'];
      html.push('<h2>Conciliación de Inventario</h2>');
      html.push('<div class="row"><div class="col"><b>Fecha al:</b> '+fecha.value+'</div><div class="col"><b>Almacén:</b> '+invNameAlm(alm)+'</div></div>');
      html.push('<table><thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia (g)</th></tr></thead><tbody>');
      rows.forEach(r=>{ const sis=invGet(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis); html.push('<tr><td>'+invNameMat(r.mat)+'</td><td>'+f2(sis)+'</td><td>'+f2(r.conteo||0)+'</td><td>'+f2(dif)+'</td></tr>'); });
      html.push('</tbody></table></body></html>');
      w.document.write(html.join('')); w.document.close(); try{w.focus(); w.print();}catch(e){}
    }
  });

  const top=document.createElement('div'); top.className='grid';
  top.innerHTML='<div><label>Almacén</label>'+selAlm('GEN',true)+'</div><div><label>Fecha al</label><input data-edit type="date" value="'+hoyStr()+'"></div><div style="display:flex;align-items:flex-end"><span class="ht-btn">Estatus</span></div>';
  sheet.appendChild(top);
  function selAlm(val,edit){ let s='<select '+(edit?'data-edit':'disabled')+'>'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`}); return s+'</select>' }
  const sel=top.querySelector('select'); const fecha=top.querySelector('input[type="date"]');

  const box=document.createElement('div'); box.className='card'; box.innerHTML='<h2>Conteos por material</h2>';
  const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia</th></tr></thead><tbody></tbody>'; const body=tb.querySelector('tbody');
  box.appendChild(tb); sheet.appendChild(box);

  const rows = INV_MAT.filter(m=>m.id!=='TERM').map(m=>({mat:m.id, conteo:0}));
  function paint(){ body.innerHTML=''; rows.forEach(r=>{ const sis=invGet(sel.value,r.mat); const tr=document.createElement('tr'); tr.innerHTML='<td>'+invNameMat(r.mat)+'</td><td>'+f2(sis)+'</td><td><input data-edit type="number" step="0.01" value="'+(r.conteo||0)+'" style="width:100%;text-align:right"></td><td>—</td>'; const inC=tr.querySelector('input'); inC.oninput=()=>{ r.conteo=parseFloat(inC.value||0); }; body.appendChild(tr); }); }
  paint();

  HT.setEditable(sheet,true); host.appendChild(sheet);
}

// =====================================================================
// ==============  FIN MÓDULO INVENTARIO · v1.3 (robusto)  =============
// =====================================================================
