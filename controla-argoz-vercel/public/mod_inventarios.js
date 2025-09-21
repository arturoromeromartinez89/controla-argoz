// =====================================================================
// =====================  INICIO MÓDULO INVENTARIO  =====================
// = versión 1.0.1 · interfaz unificada · 21/09/2025 ===================
// =====================================================================

(function bootstrapInv(){
  DB.folios = DB.folios || {};
  DB.folios.entrada  = DB.folios.entrada  || 0;
  DB.folios.salida   = DB.folios.salida   || 0;
  DB.folios.traspaso = DB.folios.traspaso || 0;

  DB.stock = DB.stock || {};
  ['GEN','PROD','ART','COB'].forEach(a=>{ DB.stock[a]=DB.stock[a]||{}; });

  DB.movInv = DB.movInv || { entradas:[], salidas:[], traspasos:[], conciliaciones:[] };

  window.INV_ALM = [
    {id:'GEN', nombre:'ALMACEN GENERAL PLATA'},
    {id:'PROD',nombre:'ALMACEN PRODUCCIÓN'},
    {id:'ART', nombre:'ALMACEN PLATA ARTURO'},
    {id:'COB', nombre:'ALMACEN PLATA POR COBRAR'}
  ];
  window.INV_MAT = [
    {id:'999',  nombre:'Plata .999 (fina)'},
    {id:'925',  nombre:'Plata .925 (única)'},
    {id:'LMD',  nombre:'Plata .925 limalla dura'},
    {id:'LMN',  nombre:'Plata .925 limalla negra'},
    {id:'OTRO', nombre:'Plata .925 de otro tipo'},
    {id:'TERM', nombre:'Plata .925 producto terminado'},
    {id:'ALC',  nombre:'Plata por Aleación'}
  ];
})();

// helpers
function inv_nameMat(id){ const x=INV_MAT.find(m=>m.id===id); return x?x.nombre:id; }
function inv_nameAlm(id){ const x=INV_ALM.find(a=>a.id===id); return x?x.nombre:id; }
function inv_nextFolio(pref){
  if(pref==='EN'){ DB.folios.entrada +=1; saveDB(DB); return 'EN-'+String(DB.folios.entrada).padStart(3,'0'); }
  if(pref==='SA'){ DB.folios.salida  +=1; saveDB(DB); return 'SA-'+String(DB.folios.salida ).padStart(3,'0'); }
  if(pref==='TR'){ DB.folios.traspaso+=1; saveDB(DB); return 'TR-'+String(DB.folios.traspaso).padStart(3,'0'); }
  if(pref==='CI'){ return 'CI-'+String((DB.movInv.conciliaciones.length+1)).padStart(3,'0'); }
  return 'XX-000';
}
function inv_get(alm,mat){ DB.stock[alm]=DB.stock[alm]||{}; const v=parseFloat(DB.stock[alm][mat]||0); return isFinite(v)?v:0; }
function inv_set(alm,mat,grams){ DB.stock[alm]=DB.stock[alm]||{}; DB.stock[alm][mat]=parseFloat(grams)||0; }
function inv_add(alm,mat,grams){ inv_set(alm,mat, inv_get(alm,mat) + (parseFloat(grams)||0) ); }
function inv_sub(alm,mat,grams){
  const cur=inv_get(alm,mat), g=parseFloat(grams)||0;
  if(cur<g) throw new Error('Inventario insuficiente de '+inv_nameMat(mat)+' en '+inv_nameAlm(alm));
  inv_set(alm,mat, cur-g);
}

// ===== UI comunes =====
function inv_linesTable(opts){
  const wrap=document.createElement('div');
  const table=document.createElement('table'); table.className='table'; table.style.tableLayout='fixed';
  table.innerHTML='<thead><tr>'
   +'<th style="width:6%">#</th><th style="width:32%">Material</th><th style="width:42%">Descripción</th><th style="width:20%">Gramos</th>'
   +'</tr></thead><tbody></tbody>';
  const tb=table.querySelector('tbody');

  function row(li,idx){
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+(idx+1)+'</td>';
    // material
    const td1=document.createElement('td');
    const sel=document.createElement('select'); sel.style.width='100%';
    INV_MAT.forEach(m=>{ const op=document.createElement('option'); op.value=m.id; op.textContent=m.nombre+(m.id==='TERM'?' (solo ventas)':''); sel.appendChild(op); });
    sel.value=li.materialId; sel.disabled=!opts.editable;
    sel.onchange=()=>{ li.materialId=sel.value; if(li.materialId==='TERM'){ alert('Producto terminado solo se usa en Ventas.'); li.materialId='925'; sel.value='925'; } saveDB(DB); opts.onChange&&opts.onChange(); };
    td1.appendChild(sel); tr.appendChild(td1);

    // detalle
    const td2=document.createElement('td');
    const tx=document.createElement('input'); tx.type='text'; tx.value=li.detalle||''; tx.style.width='100%';
    if(opts.editable){ tx.setAttribute('data-edit',''); } else { tx.classList.add('locked'); tx.setAttribute('disabled','disabled'); }
    tx.oninput=()=>{ li.detalle=tx.value; saveDB(DB); };
    td2.appendChild(tx); tr.appendChild(td2);

    // gramos
    const td3=document.createElement('td');
    const gr=document.createElement('input'); gr.type='number'; gr.step='0.01'; gr.min='0'; gr.value=li.gramos||0; gr.style.width='100%'; gr.style.textAlign='right';
    if(opts.editable){ gr.setAttribute('data-edit',''); } else { gr.classList.add('locked'); gr.setAttribute('disabled','disabled'); }
    gr.oninput=()=>{ li.gramos=parseFloat(gr.value||'0'); saveDB(DB); opts.onChange&&opts.onChange(); };
    td3.appendChild(gr); tr.appendChild(td3);

    return tr;
  }
  function rebuild(){ tb.innerHTML=''; for(let i=0;i<opts.lineas.length;i++){ tb.appendChild(row(opts.lineas[i],i)); } }
  rebuild(); wrap.appendChild(table);

  if(opts.editable){
    const acts=document.createElement('div'); acts.className='actions';
    const add=document.createElement('button'); add.type='button'; add.className='btn'; add.textContent='+ Agregar línea';
    const del=document.createElement('button'); del.type='button'; del.className='btn'; del.textContent='– Eliminar última';
    add.onclick=()=>{ opts.lineas.push({materialId:'925',detalle:'',gramos:0}); rebuild(); opts.onChange&&opts.onChange(); saveDB(DB); };
    del.onclick=()=>{ if(opts.lineas.length>1){ opts.lineas.pop(); rebuild(); opts.onChange&&opts.onChange(); saveDB(DB);} };
    acts.append(add,del); wrap.appendChild(acts);
  }
  return wrap;
}

// ===== Submenú =====
function renderInventarios(){
  const host=document.getElementById('subpanel'); // limpia pestañas ya puestas por index
  const card=document.createElement('div'); card.className='card inv-submenu';
  const h=document.createElement('h2'); h.textContent='Inventarios'; card.appendChild(h);

  const list=document.createElement('div'); list.className='inv-list';
  function btn(t,icon,fn){ const b=document.createElement('button'); b.type='button'; b.className='subbtn'; b.innerHTML=icon+' '+t; b.onclick=fn; list.appendChild(b); }
  btn('Entrada','📥', inv_abrirEntrada);
  btn('Salida','📤', inv_abrirSalida);
  btn('Traspasos','🔁', inv_abrirTraspasosHome);
  btn('Hacer inventario (conciliar)','📋', inv_abrirConciliacion);
  card.appendChild(list);

  // Render
  host.appendChild(card);
}

// ===== ENTRADA =====
function inv_abrirEntrada(){
  const folio = inv_nextFolio('EN');
  const doc = {
    id:'EN'+Date.now(), folio, fecha:hoyStr(),
    motivo:'COMPRA', destino:'GEN', comentario:'',
    lineas:[
      {materialId:'925',detalle:'',gramos:0},
      {materialId:'999',detalle:'',gramos:0},
      {materialId:'LMD',detalle:'',gramos:0},
      {materialId:'LMN',detalle:'',gramos:0},
      {materialId:'ALC',detalle:'',gramos:0}
    ],
    total:0
  };

  openTab(doc.id, 'Entrada '+folio, (host)=>{
    host.innerHTML='';
    const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=folio;

    HT.mountToolbar(sheet,{docName:'entrada',
      onNew: inv_abrirEntrada,
      onSave: ()=>{
        if(doc.destino!=='GEN'){ alert('Por ahora las Entradas solo pueden ir a ALMACEN GENERAL PLATA.'); return false; }
        let t=0;
        doc.lineas.forEach(li=>{
          const g=parseFloat(li.gramos||0); if(g<=0) return;
          if(li.materialId==='TERM'){ alert('Producto terminado solo se usa en Ventas.'); return false; }
          if(li.materialId==='ALC'){ inv_add('GEN','925', g); } else { inv_add('GEN', li.materialId, g); }
          t+=g;
        });
        doc.total=t;
        DB.movInv.entradas.push(JSON.parse(JSON.stringify({ ...doc })));
        saveDB(DB);
        return {ok:true, folio};
      },
      onPrint: ()=>inv_pdfEntrada(doc)
    });

    const enc=document.createElement('div'); enc.className='grid';
    enc.innerHTML =
      '<div><label>Folio</label><input value="'+folio+'" disabled></div>'
     +'<div><label>Fecha</label><input data-edit type="date" value="'+doc.fecha+'"></div>'
     +'<div><label>Motivo</label><select data-edit>'
        +'<option>COMPRA</option><option>DONACION</option><option>PRESTAMO</option><option>REPOSICIÓN</option>'
      +'</select></div>'
     +'<div><label>Almacén destino</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: por ahora solo GEN</div></div>'
     +'<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
    sheet.appendChild(enc);
    const ins=enc.querySelectorAll('input,select,textarea');
    ins[1].onchange=()=>{ doc.fecha=ins[1].value; saveDB(DB); };
    ins[2].onchange=()=>{ doc.motivo=ins[2].value; saveDB(DB); };
    ins[5].oninput =()=>{ doc.comentario=ins[5].value; saveDB(DB); };

    const lines=inv_linesTable({ lineas:doc.lineas, editable:true, onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); tot.textContent=f2(s)+' g'; } });
    sheet.appendChild(lines);

    const totWrap=document.createElement('div'); totWrap.className='right';
    const tot=document.createElement('div'); tot.className='money'; tot.textContent='0.00 g';
    totWrap.appendChild(tot); sheet.appendChild(totWrap);

    HT.setEditable(sheet,true);
    host.appendChild(sheet);
  });
}
function inv_pdfEntrada(doc){
  const w=window.open('','_blank','width=820,height=900'); if(!w){ alert('Permite pop-ups.'); return; }
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800}';
  const html=[];
  html.push('<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+doc.folio+'</title></head><body>');
  html.push('<h2>Entrada <span class="folio">'+doc.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+doc.fecha+'</div><div class="col"><b>Motivo:</b> '+doc.motivo+'</div><div class="col"><b>Destino:</b> '+inv_nameAlm('GEN')+'</div></div>');
  html.push('<div class="row"><div class="col"><b>Comentario:</b> '+escapeHTML(doc.comentario||'')+'</div><div class="col"><b>Total:</b> '+f2(doc.total)+' g</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gramos</th></tr></thead><tbody>');
  for(let i=0;i<doc.lineas.length;i++){ const li=doc.lineas[i]; if(parseFloat(li.gramos||0)<=0) continue;
    html.push('<tr><td>'+(i+1)+'</td><td>'+inv_nameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>');
  }
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
}

// ===== SALIDA =====
function inv_abrirSalida(){
  const folio = inv_nextFolio('SA');
  const doc = {
    id:'SA'+Date.now(), folio, fecha:hoyStr(),
    origen:'GEN', comentario:'',
    lineas:[
      {materialId:'925',detalle:'',gramos:0},
      {materialId:'LMD',detalle:'',gramos:0},
      {materialId:'LMN',detalle:'',gramos:0},
      {materialId:'OTRO',detalle:'',gramos:0},
      {materialId:'999',detalle:'',gramos:0}
    ],
    total:0
  };

  openTab(doc.id, 'Salida '+folio, (host)=>{
    host.innerHTML='';
    const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=folio;

    HT.mountToolbar(sheet,{docName:'salida',
      onNew: inv_abrirSalida,
      onSave: ()=>{
        if(doc.origen!=='GEN'){ alert('Por ahora las Salidas solo pueden salir de ALMACEN GENERAL PLATA.'); return false; }
        let t=0;
        try{
          doc.lineas.forEach(li=>{
            const g=parseFloat(li.gramos||0); if(g<=0) return;
            if(li.materialId==='TERM'){ alert('Producto terminado solo se usa en Ventas.'); throw new Error('TERM'); }
            inv_sub('GEN', li.materialId, g); t+=g;
          });
        }catch(err){ alert(err.message); return false; }
        doc.total=t;
        DB.movInv.salidas.push(JSON.parse(JSON.stringify({ ...doc })));
        saveDB(DB);
        return {ok:true, folio};
      },
      onPrint: ()=>inv_pdfSalida(doc)
    });

    const enc=document.createElement('div'); enc.className='grid';
    enc.innerHTML =
      '<div><label>Folio</label><input value="'+folio+'" disabled></div>'
     +'<div><label>Fecha</label><input data-edit type="date" value="'+doc.fecha+'"></div>'
     +'<div><label>Almacén origen</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: por ahora solo GEN</div></div>'
     +'<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
    sheet.appendChild(enc);
    const ins=enc.querySelectorAll('input,select,textarea');
    ins[1].onchange=()=>{ doc.fecha=ins[1].value; saveDB(DB); };
    ins[4].oninput =()=>{ doc.comentario=ins[4].value; saveDB(DB); };

    const lines=inv_linesTable({ lineas:doc.lineas, editable:true, onChange:()=>{ let s=0; doc.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); tot.textContent=f2(s)+' g'; } });
    sheet.appendChild(lines);

    const totWrap=document.createElement('div'); totWrap.className='right';
    const tot=document.createElement('div'); tot.className='money'; tot.textContent='0.00 g';
    totWrap.appendChild(tot); sheet.appendChild(totWrap);

    HT.setEditable(sheet,true);
    host.appendChild(sheet);
  });
}
function inv_pdfSalida(doc){
  const w=window.open('','_blank','width=820,height=900'); if(!w){ alert('Permite pop-ups.'); return; }
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800}';
  const html=[];
  html.push('<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+doc.folio+'</title></head><body>');
  html.push('<h2>Salida <span class="folio">'+doc.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+doc.fecha+'</div><div class="col"><b>Origen:</b> '+inv_nameAlm('GEN')+'</div><div class="col"><b>Total:</b> '+f2(doc.total)+' g</div></div>');
  html.push('<div class="row"><div class="col"><b>Comentario:</b> '+escapeHTML(doc.comentario||'')+'</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gramos</th></tr></thead><tbody>');
  for(let i=0;i<doc.lineas.length;i++){ const li=doc.lineas[i]; if(parseFloat(li.gramos||0)<=0) continue;
    html.push('<tr><td>'+(i+1)+'</td><td>'+inv_nameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>');
  }
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
}

// ===== TRASPASOS =====
function inv_abrirTraspasosHome(){
  const id='TRHOME';
  openTab(id, 'Traspasos', (host)=>{
    host.innerHTML='';
    const card=document.createElement('div'); card.className='card';

    const bar=document.createElement('div'); bar.className='actions';
    const bNew=document.createElement('button'); bNew.type='button'; bNew.className='btn-primary'; bNew.textContent='+ Nuevo traspaso (salida)';
    bNew.onclick=inv_nuevoTraspasoSalida; bar.appendChild(bNew); card.appendChild(bar);

    const pend=DB.movInv.traspasos.filter(t=>!t.cerrado).sort((a,b)=>b.num-a.num);
    const secP=document.createElement('div'); secP.className='card';
    secP.innerHTML='<h2>Traspasos pendientes</h2>';
    if(pend.length===0){ secP.innerHTML+='<p class="muted">Sin pendientes.</p>'; }
    else{
      pend.forEach(t=>{
        const row=document.createElement('div'); row.className='actions';
        const pill=document.createElement('span'); pill.className='pill orange'; pill.textContent=t.folio; row.appendChild(pill);
        const txt=document.createElement('span'); txt.textContent='  '+inv_nameAlm(t.origen)+' → '+inv_nameAlm(t.destino)+'  · '+t.fecha; row.appendChild(txt);
        const bV=document.createElement('button'); bV.type='button'; bV.className='btn'; bV.textContent='Abrir'; bV.onclick=()=>inv_abrirTraspasoDetalle(t.id);
        const bA=document.createElement('button'); bA.type='button'; bA.className='btn'; bA.textContent='Aceptar en destino'; bA.onclick=()=>inv_aceptarTraspaso(t.id);
        row.append(bV,bA); secP.appendChild(row);
      });
    }
    card.appendChild(secP);

    const cer=DB.movInv.traspasos.filter(t=>!!t.cerrado).sort((a,b)=>b.num-a.num);
    const secC=document.createElement('div'); secC.className='card';
    secC.innerHTML='<h2>Traspasos cerrados</h2>';
    if(cer.length===0){ secC.innerHTML+='<p class="muted">Aún no hay cerrados.</p>'; }
    else{
      cer.forEach(t=>{
        const row=document.createElement('div'); row.className='actions';
        const pill=document.createElement('span'); pill.className='pill'; pill.textContent=t.folio; row.appendChild(pill);
        const txt=document.createElement('span'); txt.textContent='  '+inv_nameAlm(t.origen)+' → '+inv_nameAlm(t.destino)+'  · '+t.fecha; row.appendChild(txt);
        const bP=document.createElement('button'); bP.type='button'; bP.className='btn'; bP.textContent='PDF'; bP.onclick=()=>inv_pdfTraspaso(t,false);
        row.appendChild(bP); secC.appendChild(row);
      });
    }
    card.appendChild(secC);
    host.appendChild(card);
  });
}

function inv_nuevoTraspasoSalida(){
  const folio = inv_nextFolio('TR');
  const obj = {
    id:'TR'+Date.now(), num:DB.folios.traspaso, folio, fecha:hoyStr(),
    origen:'GEN', destino:'PROD', comentario:'',
    lineas:[
      {materialId:'925',detalle:'',gramos:0},
      {materialId:'LMD',detalle:'',gramos:0},
      {materialId:'LMN',detalle:'',gramos:0},
      {materialId:'OTRO',detalle:'',gramos:0}
    ],
    total:0, cerrado:false
  };

  openTab(obj.id, 'Traspaso '+folio, (host)=>{
    host.innerHTML='';
    const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false'; sheet.dataset.folio=folio;

    HT.mountToolbar(sheet,{docName:'traspaso (salida)',
      onNew: inv_nuevoTraspasoSalida,
      onSave: ()=>{
        let t=0;
        try{
          obj.lineas.forEach(li=>{ const g=parseFloat(li.gramos||0); if(g<=0) return; inv_sub(obj.origen, li.materialId, g); t+=g; });
        }catch(e){ alert(e.message); return false; }
        obj.total=t; DB.movInv.traspasos.push(JSON.parse(JSON.stringify(obj))); saveDB(DB);
        return {ok:true, folio};
      },
      onPrint: ()=>inv_pdfTraspaso(obj,true)
    });

    const enc=document.createElement('div'); enc.className='grid';
    enc.innerHTML =
      '<div><label>Folio</label><input value="'+folio+'" disabled></div>'
     +'<div><label>Fecha</label><input data-edit type="date" value="'+obj.fecha+'"></div>'
     +'<div><label>Sale de</label>'+selAlm(obj.origen,true)+'</div>'
     +'<div><label>Entra a</label>'+selAlm(obj.destino,true)+'</div>'
     +'<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>';
    sheet.appendChild(enc);

    function selAlm(val,edit){
      let s='<select '+(edit?'data-edit':'disabled')+'>'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`; }); return s+'</select>';
    }

    const ins=enc.querySelectorAll('input,select,textarea');
    ins[1].onchange=()=>{ obj.fecha=ins[1].value; saveDB(DB); };
    ins[2].onchange=()=>{ obj.origen=ins[2].value; saveDB(DB); };
    ins[3].onchange=()=>{ obj.destino=ins[3].value; saveDB(DB); };
    ins[4].oninput =()=>{ obj.comentario=ins[4].value; saveDB(DB); };

    const lines=inv_linesTable({ lineas:obj.lineas, editable:true, onChange:()=>{ let s=0; obj.lineas.forEach(li=>s+=parseFloat(li.gramos||0)); tot.textContent=f2(s)+' g'; } });
    sheet.appendChild(lines);

    const totWrap=document.createElement('div'); totWrap.className='right';
    const tot=document.createElement('div'); tot.className='money'; tot.textContent='0.00 g';
    totWrap.appendChild(tot); sheet.appendChild(totWrap);

    HT.setEditable(sheet,true);
    host.appendChild(sheet);
  });
}

function inv_aceptarTraspaso(id){
  const t=DB.movInv.traspasos.find(x=>x.id===id); if(!t){ alert('No encontrado'); return; }
  if(t.cerrado){ alert('Ya está cerrado.'); return; }
  t.lineas.forEach(li=>{ const g=parseFloat(li.gramos||0); if(g<=0) return; inv_add(t.destino, li.materialId, g); });
  t.cerrado=true; t.aceptadoFecha=hoyStr(); saveDB(DB);
  alert('Traspaso aceptado en destino y cerrado.');
  inv_abrirTraspasosHome();
}

function inv_abrirTraspasoDetalle(id){
  const t=DB.movInv.traspasos.find(x=>x.id===id); if(!t){ alert('No encontrado'); return; }
  openTab('TRDET'+id, 'Traspaso '+t.folio, (host)=>{
    host.innerHTML='';
    const card=document.createElement('div'); card.className='card';
    const h=document.createElement('h2'); h.textContent='Detalle'; card.appendChild(h);
    const p=document.createElement('p'); p.textContent=inv_nameAlm(t.origen)+' → '+inv_nameAlm(t.destino)+' · '+t.fecha; card.appendChild(p);

    const tb=document.createElement('table'); tb.className='table'; tb.innerHTML='<thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th></tr></thead><tbody></tbody>';
    const body=tb.querySelector('tbody');
    for(let i=0;i<t.lineas.length;i++){
      const li=t.lineas[i]; const tr=document.createElement('tr');
      tr.innerHTML='<td>'+(i+1)+'</td><td>'+inv_nameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td>';
      body.appendChild(tr);
    }
    card.appendChild(tb);

    const bar=document.createElement('div'); bar.className='actions';
    const bP=document.createElement('button'); bP.type='button'; bP.className='btn'; bP.textContent='PDF'; bP.onclick=()=>inv_pdfTraspaso(t,false);
    bar.appendChild(bP);
    if(!t.cerrado){
      const bA=document.createElement('button'); bA.type='button'; bA.className='btn-primary'; bA.textContent='Aceptar en destino'; bA.onclick=()=>inv_aceptarTraspaso(t.id);
      bar.appendChild(bA);
    }
    card.appendChild(bar);

    host.appendChild(card);
  });
}

function inv_pdfTraspaso(t, borrador){
  const w=window.open('','_blank','width=820,height=900'); if(!w){ alert('Permite pop-ups.'); return; }
  const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1} .folio{color:#b91c1c;font-weight:800} .water{position:fixed;top:40%;left:18%;font-size:46px;color:#9ca3af80;transform:rotate(-18deg);}';
  const html=[];
  html.push('<html><head><meta charset="utf-8"><style>'+css+'</style><title>'+t.folio+'</title></head><body>');
  if(borrador){ html.push('<div class="water">BORRADOR</div>'); }
  html.push('<h2>Traspaso <span class="folio">'+t.folio+'</span></h2>');
  html.push('<div class="row"><div class="col"><b>Fecha:</b> '+t.fecha+'</div><div class="col"><b>Sale de:</b> '+inv_nameAlm(t.origen)+'</div><div class="col"><b>Entra a:</b> '+inv_nameAlm(t.destino)+'</div></div>');
  html.push('<div class="row"><div class="col"><b>Total:</b> '+f2(t.total||0)+' g</div><div class="col"><b>Estado:</b> '+(t.cerrado?'CERRADO':'PENDIENTE')+'</div></div>');
  html.push('<table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th></tr></thead><tbody>');
  for(let i=0;i<t.lineas.length;i++){
    const li=t.lineas[i];
    html.push('<tr><td>'+(i+1)+'</td><td>'+inv_nameMat(li.materialId)+'</td><td>'+escapeHTML(li.detalle||'')+'</td><td>'+f2(li.gramos)+'</td></tr>');
  }
  html.push('</tbody></table></body></html>');
  w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
}

// ===== CONCILIACIÓN =====
function inv_abrirConciliacion(){
  const id='CONCINV';
  openTab(id, 'Conciliación de Inventario', (host)=>{
    host.innerHTML='';
    const sheet=document.createElement('div'); sheet.className='ht-sheet'; sheet.dataset.saved='false';

    HT.mountToolbar(sheet,{docName:'conciliación',
      onNew: inv_abrirConciliacion,
      onSave: ()=>{
        const alm = sel.value;
        let totalAdj=0;
        rows.forEach(r=>{
          const sis=inv_get(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis);
          if(Math.abs(dif)>0){
            if(dif>0){ inv_add(alm,r.mat,dif); } else { try{ inv_sub(alm,r.mat,-dif);}catch(e){ alert(e.message); } }
            totalAdj += dif;
          }
        });
        const folio=inv_nextFolio('CI');
        DB.movInv.conciliaciones.push({ id:'CI'+Date.now(), folio, fecha:fecha.value, almacen:alm, filas:JSON.parse(JSON.stringify(rows)), totalAjuste:totalAdj });
        saveDB(DB);
        return {ok:true, folio};
      },
      onPrint: ()=>{
        const alm=sel.value;
        const w=window.open('','_blank','width=820,height=900'); if(!w){ alert('Permite pop-ups.'); return; }
        const css='@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse;table-layout:fixed} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .row{display:flex;gap:8px;margin:6px 0}.col{flex:1}';
        const html=[];
        html.push('<html><head><meta charset="utf-8"><style>'+css+'</style><title>Conciliación</title></head><body>');
        html.push('<h2>Conciliación de Inventario</h2>');
        html.push('<div class="row"><div class="col"><b>Fecha al:</b> '+fecha.value+'</div><div class="col"><b>Almacén:</b> '+inv_nameAlm(alm)+'</div></div>');
        html.push('<table><thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia (g)</th></tr></thead><tbody>');
        rows.forEach(r=>{ const sis=inv_get(alm,r.mat); const dif=(parseFloat(r.conteo||0)-sis);
          html.push('<tr><td>'+inv_nameMat(r.mat)+'</td><td>'+f2(sis)+'</td><td>'+f2(r.conteo||0)+'</td><td>'+f2(dif)+'</td></tr>');
        });
        html.push('</tbody></table></body></html>');
        w.document.write(html.join('')); w.document.close(); try{ w.focus(); w.print(); }catch(e){}
      }
    });

    const top=document.createElement('div'); top.className='grid';
    top.innerHTML =
      '<div><label>Almacén</label>'+selAlm('GEN',true)+'</div>'
     +'<div><label>Fecha al</label><input data-edit type="date" value="'+hoyStr()+'"></div>'
     +'<div style="display:flex;align-items:flex-end"><span class="pill orange" id="concStatus">Por conciliar</span></div>';
    sheet.appendChild(top);

    function selAlm(val,edit){
      let s='<select '+(edit?'data-edit':'disabled')+'>'; INV_ALM.forEach(a=>{ s+=`<option value="${a.id}" ${a.id===val?'selected':''}>${a.nombre}</option>`; }); return s+'</select>';
    }
    const sel=top.querySelector('select'); const fecha=top.querySelector('input[type="date"]'); const status=top.querySelector('#concStatus');

    const box=document.createElement('div'); box.className='card';
    box.innerHTML='<h2>Conteos por material</h2>';
    const tb=document.createElement('table'); tb.className='table'; tb.style.tableLayout='fixed';
    tb.innerHTML='<thead><tr><th style="width:42%">Material</th><th style="width:19%">Sistema (g)</th><th style="width:19%">Conteo (g)</th><th style="width:20%">Diferencia</th></tr></thead><tbody></tbody>';
    const body=tb.querySelector('tbody'); box.appendChild(tb); sheet.appendChild(box);

    const rows = INV_MAT.filter(m=>m.id!=='TERM').map(m=>({mat:m.id, conteo:0}));

    function paint(){
      body.innerHTML='';
      rows.forEach(r=>{
        const tr=document.createElement('tr');
        const sis=inv_get(sel.value,r.mat); const dif=(parseFloat(r.conteo||0)-sis);
        tr.innerHTML='<td>'+inv_nameMat(r.mat)+'</td>'
          +'<td>'+f2(sis)+'</td>'
          +'<td><input data-edit type="number" step="0.01" value="'+(r.conteo||0)+'" style="width:100%;text-align:right"></td>'
          +'<td><b style="color:'+(dif<0?'#b45309':'#1a7f37')+'">'+f2(dif)+'</b></td>';
        const inC=tr.querySelector('input'); inC.oninput=()=>{ r.conteo=parseFloat(inC.value||0); };
        body.appendChild(tr);
      });
      const allZero = rows.every(r=> Math.abs((parseFloat(r.conteo||0)-inv_get(sel.value,r.mat)))<0.0001 );
      status.textContent = allZero ? 'Conciliado' : 'Por conciliar';
      status.className = 'pill ' + (allZero? '' : 'orange');
    }
    paint();

    HT.setEditable(sheet,true);
    host.appendChild(sheet);
  });
}

// =====================================================================
// =======================  FIN MÓDULO INVENTARIO  ======================
// = versión 1.0.1 · interfaz unificada · 21/09/2025 ===================
// =====================================================================
