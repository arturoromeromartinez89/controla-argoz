// app.js — CONTROL-A v1.9.4
document.addEventListener('DOMContentLoaded', function init(){
  const jsok = document.getElementById('jsok'); if(jsok) jsok.textContent = 'JS OK';
  const diag = document.getElementById('diag');
  function showDiag(msg){ if(!diag) return; diag.textContent = msg; diag.style.display='block'; }
  window.onerror = (m,src,lin,col,err)=>{ showDiag('ERROR: '+(err?.message||m)); };
  window.addEventListener('unhandledrejection',e=> showDiag('PROMISE: '+(e.reason?.message||e.reason)));

  /* helpers */
  const $ = (s,r=document)=> r.querySelector(s);
  const $$ = (s,r=document)=> Array.from(r.querySelectorAll(s));
  const el=(t,a={})=>Object.assign(document.createElement(t),a);
  const toast=msg=>{const t=$("#toast"); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',1600);}
  const fmt2=n=>(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today=()=>new Date().toLocaleDateString('es-MX');
  const now=()=>new Date().toLocaleTimeString('es-MX',{hour12:false,hour:'2-digit',minute:'2-digit'});

  /* botones de header */
  const tgl=$("#btn-toggle-mid"); if(tgl) tgl.addEventListener('click', ()=>{
    const m=$("#subpanel"); if(!m) return;
    const will = getComputedStyle(m).display==='none'?'block':'none';
    m.style.display=will; toast('Submenú: '+(will==='block'?'mostrado':'oculto'));
  });

  /* “BD” local */
  const DB={ get(k,d){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d} },
             set(k,v){ localStorage.setItem(k,JSON.stringify(v)) } };
  const K_PED='argoz.pedidos', K_INV='argoz.inventarios';

  $("#btn-backup")?.addEventListener('click', ()=>{
    const data={pedidos:DB.get(K_PED,[]),inventarios:DB.get(K_INV,[])};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=el('a',{href:URL.createObjectURL(blob),download:`argoz_backup_${Date.now()}.json`});
    document.body.appendChild(a); a.click(); a.remove();
  });
  $("#btn-restore")?.addEventListener('click', ()=>{
    const inp=el('input',{type:'file',accept:'application/json'});
    inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
      const fr=new FileReader();
      fr.onload=()=>{ try{ const o=JSON.parse(fr.result);
        if(o.pedidos) DB.set(K_PED,o.pedidos);
        if(o.inventarios) DB.set(K_INV,o.inventarios);
        toast('Datos restaurados'); renderSubpanel();
      }catch(e){ toast('Archivo inválido'); } };
      fr.readAsText(f);
    };
    inp.click();
  });

  /* tabs */
  const tabs=$("#tabs"), views=$("#views"); let openTabs=[];
  function openTab(id,title,build){
    const ex=openTabs.find(t=>t.id===id); if(ex){activeTab(id); return;}
    const t=el('div',{className:'tab'}); t.innerHTML=`${title} <span class="x" title="Cerrar">×</span>`;
    const v=el('div',{className:'view'});
    tabs.appendChild(t); views.appendChild(v);
    openTabs.push({id,elTab:t,elView:v});
    t.addEventListener('click',e=>{ if(e.target.classList.contains('x')) closeTab(id); else activeTab(id); });
    try{ build(v); }catch(err){ showDiag('Vista: '+(err?.message||err)); v.innerHTML='<div class="card">Error al cargar vista</div>'; }
    activeTab(id);
  }
  function activeTab(id){ openTabs.forEach(o=>{o.elTab.classList.toggle('active',o.id===id); o.elView.classList.toggle('active',o.id===id);}); }
  function closeTab(id){ const i=openTabs.findIndex(o=>o.id===id); if(i<0) return; const was=openTabs[i].elTab.classList.contains('active'); openTabs[i].elTab.remove(); openTabs[i].elView.remove(); openTabs.splice(i,1); if(was && openTabs.length) activeTab(openTabs[openTabs.length-1].id); }

  /* submenú */
  const subpanel=$("#subpanel");
  function renderSubpanel(root='inicio'){
    if(!subpanel) return;
    subpanel.innerHTML='';
    const box=el('div',{className:'card'});
    const h=el('h2'); h.textContent=({inicio:'Inicio',ventas:'Ventas',inventarios:'Inventarios por producción',pedidos:'Pedidos',catalogo:'Catálogo'})[root]||root; box.appendChild(h);
    const add=(txt,fn)=>{ const b=el('button',{className:'subitem',textContent:txt,type:'button'}); b.addEventListener('click',fn); box.appendChild(b); };

    if(root==='inicio') box.appendChild(el('div',{className:'kpi',innerHTML:'<b>Bienvenido</b>. Abre módulos desde el submenú; se crearán pestañas a la derecha.'}));
    if(root==='inventarios'){
      add('Folios pendientes',()=> openTab('inv-pend','Pendientes',viewPendientes));
      add('+ Nuevo traspaso de ENTRADA',()=> openTab('inv-nuevo','Nuevo traspaso',viewInvNuevo));
      add('Buscar folio…',()=> openTab('inv-buscar','Buscar folio',viewInvBuscar));
    }
    if(root==='pedidos'){
      add('Lista de pedidos',()=> openTab('ped-lista','Pedidos',viewPedLista));
      add('+ Nuevo pedido',()=> openTab('ped-nuevo','Nuevo pedido',viewPedNuevo));
    }
    if(root==='ventas'){
      add('Remisiones (lista)',()=> openTab('ven-lista','Remisiones',v=>v.innerHTML='<div class="card">Próximamente…</div>'));
      add('+ Nueva remisión',()=> openTab('ven-nueva','Nueva remisión',v=>v.innerHTML='<div class="card">Próximamente…</div>'));
    }
    if(root==='catalogo'){
      add('Clientes',()=> openTab('cat-cli','Clientes',v=>v.innerHTML='<div class="card">Catálogo básico — pendiente.</div>'));
      add('Materiales',()=> openTab('cat-mat','Materiales',v=>v.innerHTML='<div class="card">Catálogo básico — pendiente.</div>'));
      add('Productos terminados',()=> openTab('cat-prod','Productos',v=>v.innerHTML='<div class="card">Catálogo básico — pendiente.</div>'));
    }
    subpanel.appendChild(box);
  }
  renderSubpanel('inicio');

  $("#rootMenu")?.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tree-btn'); if(!btn) return;
    $$('.tree-btn').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    renderSubpanel(btn.dataset.root);
  });

  /* ===== Inventarios por producción ===== */
  const MATS=["Plata .999","Plata .925 sólida","Limalla sólida","Limalla negra","Tierras .925","Otros .925","Mercancía terminada"];
  const ALLOY=0.07;
  const nextInvFolio=()=> String((DB.get(K_INV,[]).map(x=>+x.folio).reduce((a,b)=>Math.max(a,b),0))+1).padStart(3,'0');

  function lineRow(tipo){
    const roAle=(tipo==='E')?'':'readonly';
    return `<tr>
      <td><select class="mat">${MATS.map(m=>`<option>${m}</option>`).join('')}</select></td>
      <td><input type="number" step="0.01" class="bruto"></td>
      <td><input type="number" step="0.01" class="alea" ${roAle}></td>
      <td><input type="number" step="0.01" class="bote"></td>
      <td><input type="number" step="0.01" class="neto"><div class="hint warn" style="display:none;color:#b91c1c">Bruto - Bote ≠ Neto</div></td>
      <td><input type="file" class="foto" accept="image/*" capture="environment"></td>
      <td><button class="btn btn-outline del" type="button">✕</button></td>
    </tr>`;
  }

  function setAleacionState(matEl, aleaEl, tipo){
    const is999 = matEl.value==='Plata .999';
    const editable = (tipo==='E' && is999);
    aleaEl.readOnly = !editable;
    aleaEl.classList.toggle('is-readonly', !editable);
    if(!editable) aleaEl.value = (+aleaEl.value||0).toFixed(2); // se queda, pero no editable
  }

  function bindLine(tr,tipo,prevId){
    const mat=$('.mat',tr), bruto=$('.bruto',tr), alea=$('.alea',tr), bote=$('.bote',tr), neto=$('.neto',tr), warn=$('.warn',tr), foto=$('.foto',tr), del=$('.del',tr);

    const refresh=()=>{
      const is999=(mat.value==='Plata .999');
      if(tipo==='E' && is999 && !alea.dataset.edited){
        const v=(+bruto.value||0)*ALLOY; alea.value=v? v.toFixed(2):'';
      }
      setAleacionState(mat, alea, tipo);
      const calc=(+bruto.value||0)-(+bote.value||0);
      if(neto.value==='') neto.value=calc? calc.toFixed(2):'';
      warn.style.display=(Math.abs((+neto.value||0)-calc)>0.009)?'block':'none';
    };

    ['input','change'].forEach(ev=>[mat,bruto,bote,neto].forEach(el=> el.addEventListener(ev,refresh)));
    mat.addEventListener('change', refresh);
    alea.addEventListener('input',()=>alea.dataset.edited='1');
    del.addEventListener('click',()=>tr.remove());

    foto.addEventListener('change',async e=>{
      const f=e.target.files[0]; if(!f) return;
      const url=await fileToDataURLCompressed(f);
      document.getElementById(prevId)?.appendChild(el('img',{src:url}));
    });

    refresh();
  }

  async function fileToDataURLCompressed(file,maxW=1200,quality=.75){
    const img=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src=URL.createObjectURL(file);});
    const ratio=Math.min(1,maxW/img.width), w=Math.round(img.width*ratio), h=Math.round(img.height*ratio);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    return c.toDataURL('image/jpeg',quality);
  }

  function viewPendientes(v){
    const data=DB.get(K_INV,[]).filter(x=>!x.cerrado);
    v.innerHTML='';
    const card=el('div',{className:'card'});
    card.innerHTML=`<div class="actions"><b>Pendientes</b><span class="badge">${data.length}</span></div>`;
    const wrap=el('div',{className:'actions'}); card.appendChild(wrap);
    data.forEach(f=>{
      const btn=el('button',{className:'btn btn-warn',textContent:`Folio ${f.folio}`,type:'button'});
      btn.addEventListener('click',()=> openTab(`inv-folio-${f.folio}`,`Folio ${f.folio}`,vv=>viewInvFolio(vv,f.folio)));
      wrap.appendChild(btn);
    });
    v.appendChild(card);
  }

  function viewInvNuevo(v){
    v.innerHTML=`<div class="card">
      <div class="hint">ENTRADA a línea de producción</div>
      <div class="grid">
        <div><label>Tipo</label><input value="ENTRADA" readonly></div>
        <div><label>Folio</label><input id="inv-folio" value="${nextInvFolio()}" readonly></div>
        <div><label>Fecha</label><input id="inv-fecha" value="${today()}"></div>
        <div><label>Hora</label><input id="inv-hora" value="${now()}" readonly></div>
      </div>
      <table id="inv-tabla"><thead><tr><th>Material</th><th>Bruto</th><th>Aleación</th><th>Bote</th><th>Neto</th><th>Foto</th><th></th></tr></thead>
        <tbody id="inv-body"></tbody>
        <tfoot><tr><td colspan="7"><button class="btn btn-outline" id="inv-add" type="button">+ Agregar línea</button></td></tr></tfoot>
      </table>
      <div class="grid"><div><label>Fotos (mín 1)</label><input id="inv-fotos" type="file" accept="image/*" multiple capture="environment"></div><div><label>Observaciones</label><textarea id="inv-obs"></textarea></div></div>
      <div id="inv-prev" class="preview"></div>
      <div class="actions"><button class="btn btn-primary" id="inv-guardar" type="button">Guardar</button><button class="btn btn-outline" id="inv-print" type="button">Vista previa</button></div>
    </div>`;
    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('E'); $("#inv-body",v).appendChild(tr); bindLine(tr,'E','inv-prev'); };
    $("#inv-add",v).addEventListener('click',add); add();
    $("#inv-fotos",v).addEventListener('change', async e=>{
      const c=$("#inv-prev",v); if(!c) return; c.innerHTML='';
      const files=Array.from(e.target.files||[]).slice(0,3);
      for(const f of files){ const u=await fileToDataURLCompressed(f); c.appendChild(el('img',{src:u})); }
    });
    $("#inv-guardar",v).addEventListener('click', ()=>{
      const prev=$("#inv-prev",v);
      const fotos=prev? Array.from(prev.querySelectorAll('img')).map(i=>i.src):[];
      if(!fotos.length){toast('Adjunta al menos 1 foto');return;}
      const lines=Array.from($("#inv-body",v).querySelectorAll('tr')).map(tr=>({
        mat:$('.mat',tr).value, bruto:+$('.bruto',tr).value||0, alea:+$('.alea',tr).value||0, bote:+$('.bote',tr).value||0, neto:+$('.neto',tr).value||0
      })).filter(l=>l.bruto||l.neto||l.bote);
      if(!lines.length){toast('Agrega líneas');return;}
      const folio=$("#inv-folio",v).value;
      const arr=DB.get(K_INV,[]);
      if(arr.filter(x=>!x.cerrado).length>=3){toast('Máximo 3 folios abiertos');return;}
      arr.push({folio,fecha:$("#inv-fecha",v).value,hora:$("#inv-hora",v).value,entrada:{lineas:lines,fotos,obs:$("#inv-obs",v).value},salida:{lineas:[],fotos:[],parciales:[]},cerrado:false});
      DB.set(K_INV,arr);
      toast('Entrada guardada');
      openTab(`inv-folio-${folio}`,`Folio ${folio}`,vv=>viewInvFolio(vv,folio));
    });
    $("#inv-print",v).addEventListener('click', ()=> invImprimir($("#inv-folio",v).value));
  }

  function viewInvFolio(v,folio){
    const arr=DB.get(K_INV,[]), it=arr.find(x=>x.folio==folio); if(!it){v.innerHTML='<div class="card">No encontrado</div>';return;}
    v.innerHTML='';
    const c=el('div',{className:'card'});
    c.innerHTML=`<div class="actions" style="justify-content:space-between">
      <div class="hint">Folio <b style="color:#b91c1c">${it.folio}</b> — ${it.fecha} ${it.hora}</div>
      <div class="actions">
        <button class="btn btn-warn" id="btn-proc" type="button">Procesar</button>
        <button class="btn btn-outline" id="btn-share" type="button">📲 WhatsApp</button>
      </div>
    </div>`;
    const tb=el('table');
    tb.innerHTML=`<thead><tr><th>Material</th><th>Bruto</th><th>Aleación</th><th>Bote</th><th>Neto</th></tr></thead>
    <tbody>${it.entrada.lineas.map(l=>`<tr><td>${l.mat}</td><td>${fmt2(l.bruto)}</td><td>${fmt2(l.alea)}</td><td>${fmt2(l.bote)}</td><td>${fmt2(l.neto)}</td></tr>`).join('')}</tbody>`;
    c.appendChild(tb);
    const prev=el('div',{className:'preview'}); (it.entrada.fotos||[]).forEach(s=>prev.appendChild(el('img',{src:s}))); c.appendChild(prev);

    const sWrap=el('div',{style:'margin-top:10px'});
    sWrap.innerHTML=`<div style="padding:8px;background:#e5e7eb;border-radius:8px"><b>SALIDA DE LÍNEA DE PRODUCCIÓN</b></div>
    <table id="s-tab"><thead><tr><th>Material</th><th>Bruto</th><th>Aleación</th><th>Bote</th><th>Neto</th><th>Foto</th><th></th></tr></thead>
    <tbody id="s-body"></tbody><tfoot><tr><td colspan="7"><button class="btn btn-outline" id="s-add" type="button">+ Agregar línea</button></td></tr></tfoot></table>
    <div class="grid"><div><label>Fotos salida</label><input id="s-fotos" type="file" accept="image/*" multiple capture="environment"></div></div>
    <div id="s-prev" class="preview"></div>
    <div class="actions"><button class="btn btn-outline" id="s-parcial" type="button">Guardar SALIDA PARCIAL</button><button class="btn btn-warn" id="s-final" type="button">Cerrar con SALIDA FINAL</button></div>`;
    c.appendChild(sWrap); v.appendChild(c);

    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('S'); $("#s-body",v).appendChild(tr); bindLine(tr,'S','s-prev'); };
    $("#s-add",v).addEventListener('click',add);
    if(!it.salida.lineas.length) add(); else {
      it.salida.lineas.forEach(l=>{ add(); const tr=$("#s-body tr:last-child",v); $('.mat',tr).value=l.mat; $('.bruto',tr).value=l.bruto; $('.alea',tr).value=l.alea; $('.bote',tr).value=l.bote; $('.neto',tr).value=l.neto; bindLine(tr,'S','s-prev'); });
      (it.salida.fotos||[]).forEach(s=>$("#s-prev",v).appendChild(el('img',{src:s})));
    }
    $("#s-fotos",v).addEventListener('change', async e=>{
      const c2=$("#s-prev",v); c2.innerHTML='';
      const files=Array.from(e.target.files||[]).slice(0,3);
      for(const f of files){ const u=await fileToDataURLCompressed(f); c2.appendChild(el('img',{src:u})); }
    });
    $("#s-parcial",v).addEventListener('click', ()=>{
      it.salida.parciales.push({fecha:today(),hora:now(),lineas:grabS(v),fotos:Array.from($("#s-prev",v).querySelectorAll('img')).map(i=>i.src)});
      DB.set(K_INV,arr); toast('Salida PARCIAL guardada');
    });
    $("#s-final",v).addEventListener('click', ()=>{
      it.salida.lineas=grabS(v);
      it.salida.fotos=Array.from($("#s-prev",v).querySelectorAll('img')).map(i=>i.src);
      it.cerrado=true;
      it.resumen=calcMerma(it);
      DB.set(K_INV,arr);
      toast('Salida FINAL guardada'); invImprimir(it.folio);
    });
    $("#btn-proc",v).addEventListener('click', ()=> toast('Edita SALIDA y guarda parcial/final'));
    $("#btn-share",v).addEventListener('click', ()=>{
      const r=it.resumen||calcMerma(it);
      const txt=encodeURIComponent(`ARGOZ · Folio ${it.folio}\nEntrada: ${fmt2(r.entTotal)} g\nSalida: ${fmt2(r.salTotal)} g\nMerma: ${fmt2(r.merma)} g (${r.mermaPct.toFixed(2)}%)`);
      window.open(`https://wa.me/?text=${txt}`,'_blank');
    });

    function grabS(vv){ return Array.from($("#s-body",vv).querySelectorAll('tr')).map(tr=>({mat:$('.mat',tr).value,bruto:+$('.bruto',tr).value||0,alea:0,bote:+$('.bote',tr).value||0,neto:+$('.neto',tr).value||0})).filter(l=>l.bruto||l.neto||l.bote); }
    function calcMerma(it){ const sum=a=>a.reduce((x,y)=>x+Number(y||0),0); const ent=sum(it.entrada.lineas.map(l=>l.neto))+sum(it.entrada.lineas.map(l=>l.alea)); const sal=sum((it.salida.lineas||[]).map(l=>l.neto)); const mer=sal-ent, pct=ent? (mer/ent*100):0; return {entTotal:ent,salTotal:sal,merma:mer,mermaPct:pct}; }
  }

  function viewInvBuscar(v){
    v.innerHTML=`<div class="card">
      <div class="grid"><div><label>Folio</label><input id="q-folio" placeholder="001"></div></div>
      <div class="actions"><button class="btn btn-primary" id="q-ver" type="button">Abrir</button></div>
    </div>`;
    $("#q-ver",v).addEventListener('click', ()=>{
      const f=$("#q-folio",v).value.trim(); if(!f) return toast('Escribe folio');
      openTab(`inv-folio-${f}`,`Folio ${f}`,vv=>viewInvFolio(vv,f));
    });
  }

  function invImprimir(folio){
    const arr=DB.get(K_INV,[]), it=arr.find(x=>x.folio==folio); if(!it) return toast('Folio no encontrado');
    const sum=a=>a.reduce((x,y)=>x+Number(y||0),0);
    const ent=sum(it.entrada.lineas.map(l=>l.neto))+sum(it.entrada.lineas.map(l=>l.alea));
    const sal=sum((it.salida.lineas||[]).map(l=>l.neto));
    const mer=sal-ent, pct=ent? (mer/ent*100):0;
    const col=mer>=0?'green':'#b91c1c', sig=mer>=0?'+':'-';
    const rrow=l=>`<tr><td>${l.mat}</td><td>${fmt2(l.bruto)}</td><td>${fmt2(l.alea)}</td><td>${fmt2(l.bote)}</td><td>${fmt2(l.neto)}</td></tr>`;
    const fotosE=(it.entrada.fotos||[]).map(s=>`<img src="${s}" style="max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px">`).join('');
    const fotosS=(it.salida.fotos||[]).map(s=>`<img src="${s}" style="max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px">`).join('');
    const html=`<div style="font-family:system-ui;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><div style="font-weight:700;color:#0a2c4c">TRASPASO DE ENTRADA A: LÍNEA DE PRODUCCIÓN</div>
        <div class="hint">Folio <b style="color:#b91c1c">${it.folio}</b> · Fecha ${it.fecha} · Hora ${it.hora}</div></div>
        <div style="font-weight:800;color:${col};font-size:16px">MERMA: ${sig}${fmt2(Math.abs(mer))} g (${sig}${Math.abs(pct).toFixed(2)}%)</div>
      </div>
      <table style="width:100%;border-collapse:collapse" border="1" cellspacing="0" cellpadding="4">
        <thead style="background:#e2e8f0"><tr><th>Material</th><th>Gramos bruto</th><th>Aleación</th><th>Peso bote</th><th>Peso neto</th></tr></thead>
        <tbody>${it.entrada.lineas.map(rrow).join('')}</tbody>
      </table>
      <div class="hint" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>
      <div style="margin:4px 0">${fotosE}</div>
      <div style="font-weight:700;color:#0a2c4c;margin-top:8px">SALIDA DE LÍNEA DE PRODUCCIÓN</div>
      <table style="width:100%;border-collapse:collapse" border="1" cellspacing="0" cellpadding="4">
        <thead style="background:#e2e8f0"><tr><th>Material</th><th>Gramos bruto</th><th>Aleación</th><th>Peso bote</th><th>Peso neto</th></tr></thead>
        <tbody>${(it.salida.lineas||[]).map(rrow).join('')}</tbody>
      </table>
      <div class="hint" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>
      <div style="margin:4px 0">${fotosS}</div>
    </div>`;
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>Folio ${it.folio}</title><style>@page{size:5.5in 8.5in;margin:10mm}</style></head><body>${html}<script>setTimeout(()=>window.print(),200)</script></body></html>`);
  }

  /* ===== Pedidos (provisional, FIX plantillas) ===== */
  function viewPedLista(v){
    const lst=DB.get(K_PED,[]);
    const card=el('div',{className:'card'});
    card.innerHTML =
      '<div class="actions" style="justify-content:space-between">' +
      '<b>Pedidos</b><button class="btn btn-primary" id="p-new" type="button">+ Nuevo</button>' +
      '</div>';
    const tbl=el('table');
    const rows = lst.map(p =>
      '<tr><td>'+p.folio+'</td><td>'+p.fecha+'</td><td>'+(p.cliente||'-')+'</td>' +
      '<td>'+p.partidas.length+'</td><td>'+fmt2(p.partidas.reduce((a,b)=>a+Number(b.gramos||0),0))+'</td></tr>'
    ).join('');
    tbl.innerHTML = '<thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Partidas</th><th>Gramos plan</th></tr></thead>' +
                    '<tbody>'+rows+'</tbody>';
    card.appendChild(tbl);
    v.innerHTML=''; v.appendChild(card);
    $("#p-new",card).addEventListener('click',()=> openTab('ped-nuevo','Nuevo pedido',viewPedNuevo));
  }

  function viewPedNuevo(v){
    const fol=String(DB.get(K_PED,[]).length+1).padStart(4,'0');
    v.innerHTML=`<div class="card">
      <div class="grid">
        <div><label>Folio</label><input id="pd-folio" value="${fol}" readonly></div>
        <div><label>Fecha</label><input id="pd-fecha" value="${today()}"></div>
        <div><label>Cliente</label><input id="pd-cliente" placeholder="Nombre cliente"></div>
        <div><label>Promesa</label><input id="pd-prom" placeholder="dd/mm/aaaa"></div>
      </div>
      <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Gramos estimados</th><th></th></tr></thead>
        <tbody id="pd-body"></tbody>
        <tfoot><tr><td colspan="4"><button class="btn btn-outline" id="pd-add" type="button">+ Agregar partida</button></td></tr></tfoot>
      </table>
      <div class="actions">
        <button class="btn btn-primary" id="pd-save" type="button">Guardar pedido</button>
        <button class="btn btn-outline" id="pd-to-prod" type="button">Crear meta producción</button>
      </div>
    </div>`;
    const add=()=>{ const tr=el('tr'); tr.innerHTML=
      '<td><input class="prod" placeholder="Anillo X"></td>'+
      '<td><input type="number" step="1" class="cant"></td>'+
      '<td><input type="number" step="0.01" class="gram"></td>'+
      '<td><button class="btn btn-outline del" type="button">✕</button></td>';
      $("#pd-body",v).appendChild(tr); $('.del',tr).addEventListener('click',()=>tr.remove()); };
    $("#pd-add",v).addEventListener('click',add); add();
    $("#pd-save",v).addEventListener('click',()=>{
      const ped={folio:$("#pd-folio",v).value,fecha:$("#pd-fecha",v).value,cliente:$("#pd-cliente",v).value,promesa:$("#pd-prom",v).value,
        partidas:Array.from($("#pd-body",v).querySelectorAll('tr')).map(tr=>({prod:$('.prod',tr).value,cant:+$('.cant',tr).value||0,gramos:+$('.gram',tr).value||0})).filter(p=>p.prod)};
      const arr=DB.get(K_PED,[]); arr.push(ped); DB.set(K_PED,arr);
      toast('Pedido guardado'); openTab('ped-lista','Pedidos',viewPedLista);
    });
    $("#pd-to-prod",v).addEventListener('click',()=>{
      const total=Array.from($("#pd-body",v).querySelectorAll('tr')).reduce((s,tr)=>s+(+$('.gram',tr).value||0),0);
      toast(`Meta de producción creada: ${fmt2(total)} g (informativa)`);
    });
  }

}); // DOM ready
