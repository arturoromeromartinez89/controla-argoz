/* CONTROL-A — app.js v1.9.6 (Inventarios → Traspasos + Pedidos) */
(() => {
  /* ===== helpers ===== */
  const $ = (s,r=document)=> r.querySelector(s);
  const $$ = (s,r=document)=> Array.from(r.querySelectorAll(s));
  const el=(t,a={})=>Object.assign(document.createElement(t),a);
  const fmt2=n=>(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today=()=>new Date().toLocaleDateString('es-MX');
  const now=()=>new Date().toLocaleTimeString('es-MX',{hour12:false,hour:'2-digit',minute:'2-digit'});
  const toast=msg=>{const t=$("#toast"); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',1600)};

  /* ===== estado básico ===== */
  const K_TRS='argoz.traspasos';
  const K_PED='argoz.pedidos';
  const DB={ get(k,d){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d} },
             set(k,v){ localStorage.setItem(k,JSON.stringify(v)) } };
  const ALMACENES=["CAJA FUERTE","PRODUCCIÓN"];
  const MATS=["Plata .999","Plata .925 sólida","Limalla sólida","Limalla negra","Tierras .925","Otros .925","Mercancía terminada"];
  const ALLOY=0.07;

  /* ===== init de interfaz ===== */
  document.addEventListener('DOMContentLoaded', () => {
    try { $("#jsok").textContent='JS OK'; } catch {}
    $("#btn-toggle-mid")?.addEventListener('click',()=>{ const m=$("#subpanel"); m.style.display=getComputedStyle(m).display==='none'?'block':'none' });

    // backup/restore
    $("#btn-backup")?.addEventListener('click', ()=>{
      const blob=new Blob([JSON.stringify({traspasos:DB.get(K_TRS,[]),pedidos:DB.get(K_PED,[])},null,2)],{type:'application/json'});
      const a=el('a',{href:URL.createObjectURL(blob),download:`argoz_backup_${Date.now()}.json`}); document.body.appendChild(a); a.click(); a.remove();
    });
    $("#btn-restore")?.addEventListener('click', ()=>{
      const i=el('input',{type:'file',accept:'application/json'});
      i.onchange=()=>{const f=i.files[0]; if(!f) return; const fr=new FileReader();
        fr.onload=()=>{ try{const o=JSON.parse(fr.result); if(o.traspasos) DB.set(K_TRS,o.traspasos); if(o.pedidos) DB.set(K_PED,o.pedidos); toast('Datos restaurados'); renderSubpanel('inventarios'); }catch{toast('Archivo inválido')} };
        fr.readAsText(f);
      };
      i.click();
    });

    // menú lateral
    $$(".tree-btn").forEach(b=> b.addEventListener('click',()=>{ $$(".tree-btn").forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderSubpanel(b.dataset.root); }));
    renderSubpanel('inventarios');
  });

  /* ===== Tabs ===== */
  const tabs=$("#tabs"), views=$("#views"); let OPEN=[];
  function openTab(id,title,build){
    const ex=OPEN.find(t=>t.id===id); if(ex){activeTab(id); return;}
    const t=el('div',{className:'tab'}); t.innerHTML=`${title} <span class="x" title="Cerrar">×</span>`;
    const v=el('div',{className:'view'});
    tabs.appendChild(t); views.appendChild(v);
    OPEN.push({id,tab:t,view:v});
    t.addEventListener('click',e=>{ if(e.target.classList.contains('x')) closeTab(id); else activeTab(id); });
    try{ build(v); }catch(e){ v.innerHTML='<div class="card">Error al cargar vista</div>'; console.error(e); }
    activeTab(id);
  }
  function activeTab(id){ OPEN.forEach(o=>{o.tab.classList.toggle('active',o.id===id); o.view.classList.toggle('active',o.id===id)}); }
  function closeTab(id){ const i=OPEN.findIndex(o=>o.id===id); if(i<0) return; const act=OPEN[i].tab.classList.contains('active'); OPEN[i].tab.remove(); OPEN[i].view.remove(); OPEN.splice(i,1); if(act&&OPEN.length) activeTab(OPEN[OPEN.length-1].id); }

  /* ===== Subpanel por sección ===== */
  function renderSubpanel(root){
    const s=$("#subpanel"); s.innerHTML='';
    const card=el('div',{className:'card'}); const h=el('h2'); h.textContent=({inicio:'Inicio',ventas:'Ventas',inventarios:'Inventarios',pedidos:'Pedidos',catalogo:'Catálogo'})[root]||root; card.appendChild(h);
    const add=(t,fn)=>{ const b=el('button',{className:'btn btn-outline',textContent:t}); b.addEventListener('click',fn); card.appendChild(b); };

    if(root==='inventarios'){
      const a=el('div',{className:'actions'}); const b=el('button',{className:'btn btn-primary',innerHTML:'+ Nueva Entrada'}); b.onclick=()=> openTab('trs-new','Nuevo traspaso',viewTrsNew); a.appendChild(b); card.appendChild(a);
      add('Folios pendientes',()=> openTab('trs-pend','Pendientes',viewTrsPend));
      add('Buscar folio…',()=> openTab('trs-find','Buscar folio',viewTrsFind));
    }
    if(root==='pedidos'){
      add('Lista de pedidos',()=> openTab('ped-list','Pedidos',viewPedList));
      add('+ Nuevo pedido',()=> openTab('ped-new','Nuevo pedido',viewPedNew));
    }
    s.appendChild(card);
  }

  /* ===== Inventarios / Traspasos ===== */
  const nextFolio=()=> String((DB.get(K_TRS,[]).map(x=>+x.folio).reduce((a,b)=>Math.max(a,b),0))+1).padStart(3,'0');
  const calcSub=(gr,alea)=> (+gr||0) + (+alea||0);

  function lineRow(tipo){
    const ro = (tipo==='S') ? 'readonly' : '';
    return `<tr>
      <td class="idx">#</td>
      <td><button type="button" class="btn btn-outline cam">📷</button></td>
      <td><select class="mat">${MATS.map(m=>`<option>${m}</option>`).join('')}</select></td>
      <td><input class="det" placeholder="(opcional)"></td>
      <td><input type="number" step="0.01" class="alea" ${ro}></td>
      <td><input type="number" step="0.01" class="gr"></td>
      <td><input type="number" step="0.01" class="sub" readonly></td>
    </tr>`;
  }
  function renum(tb){ Array.from(tb.querySelectorAll('tr')).forEach((tr,i)=> tr.querySelector('.idx').textContent=i+1); }
  function setAleaState(matEl, aleaEl, tipo){
    const is999 = matEl.value==='Plata .999';
    const editable = (tipo==='E' && is999);
    aleaEl.readOnly = !editable;
    aleaEl.classList.toggle('ro', !editable);
    if(!editable && !is999){ aleaEl.value='0'; }
  }
  async function toDataURL(file,maxW=1200,quality=.75){
    const img=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src=URL.createObjectURL(file);});
    const sc=Math.min(1,maxW/img.width), w=Math.round(img.width*sc), h=Math.round(img.height*sc);
    const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    return c.toDataURL('image/jpeg',quality);
  }
  function bindLine(tr,tipo,update,prevId){
    const mat=$('.mat',tr), ale=$('.alea',tr), gr=$('.gr',tr), sub=$('.sub',tr), cam=$('.cam',tr);
    const recalc=()=>{
      const is999=mat.value==='Plata .999';
      setAleaState(mat,ale,tipo);
      if(tipo==='E' && is999 && !ale.dataset.edited){ ale.value = gr.value ? (Number(gr.value)*ALLOY).toFixed(2) : ''; }
      sub.value = calcSub(gr.value,ale.value).toFixed(2);
      update();
    };
    ['change','input'].forEach(ev=>[mat,ale,gr].forEach(x=> x.addEventListener(ev,recalc)));
    ale.addEventListener('input',()=> ale.dataset.edited='1');
    cam.addEventListener('click', ()=>{
      const i=el('input',{type:'file',accept:'image/*',capture:'environment'});
      i.onchange=async ()=>{ const f=i.files[0]; if(!f) return; const u=await toDataURL(f); const p=document.getElementById(prevId); p && p.appendChild(el('img',{src:u})); tr.dataset.foto=u; };
      i.click();
    });
    recalc();
  }
  const sumSub = tb => Array.from(tb.querySelectorAll('.sub')).reduce((s,i)=>s+(+i.value||0),0);

  function header(container,data,locked){
    container.innerHTML = `
      <div class="actions" style="justify-content:space-between;align-items:center">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div><label>Fecha</label><input id="h-fecha" value="${data.fecha}" ${locked?'readonly':''}></div>
          <div><label>Sale de</label><select id="h-sale" ${locked?'disabled':''}>${ALMACENES.map(a=>`<option ${a===data.saleDe?'selected':''}>${a}</option>`).join('')}</select></div>
          <div><label>Entra a</label><select id="h-entra" ${locked?'disabled':''}>${ALMACENES.map(a=>`<option ${a===data.entraA?'selected':''}>${a}</option>`).join('')}</select></div>
          <div><label>Comentarios</label><textarea id="h-com" ${locked?'readonly class="ro"':''}>${data.comentarios||''}</textarea></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div><b>FOLIO</b> <span style="color:var(--rojo);font-weight:800">${data.folio}</span></div>
          <div class="pill">TOTAL GR. <span class="num" id="pill">${fmt2(0)}</span></div>
        </div>
      </div>`;
  }

  /* ========= VISTAS ========= */

  // NUEVO TRASPASO (ENTRADA)
  function viewTrsNew(v){
    const fol=nextFolio();
    const data={folio:fol, fecha:today(), hora:now(), saleDe:'CAJA FUERTE', entraA:'PRODUCCIÓN', comentarios:''};

    v.innerHTML = `
      <div class="card">
        <div id="hdr"></div>
        <table class="nota-table">
          <thead><tr><th>#</th><th>Foto</th><th>Material</th><th>Detalle</th><th>Aleación</th><th>Gr</th><th>SubTotal</th></tr></thead>
          <tbody id="tb-e"></tbody>
          <tfoot><tr><td colspan="7"><button class="btn btn-outline" id="add-e">+ Agregar línea</button></td></tr></tfoot>
        </table>
        <div class="grid"><div><label>Fotos del traspaso (máx 3)</label><input id="f-e" type="file" accept="image/*" multiple capture="environment"></div></div>
        <div id="prev-e" class="preview"></div>
        <div class="actions">
          <button class="btn btn-primary" id="save-e">Guardar</button>
          <button class="btn btn-outline" id="print-e">Vista previa</button>
        </div>
      </div>
    `;

    header($("#hdr",v),data,false);
    const tb=$("#tb-e",v); const pill=()=>$("#pill",v);

    const recalc=()=> pill().textContent = fmt2(sumSub(tb));
    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('E'); tb.appendChild(tr); renum(tb); bindLine(tr,'E',recalc,'prev-e'); };
    $("#add-e",v).addEventListener('click',add); add();

    $("#f-e",v).addEventListener('change', async e=>{
      const p=$("#prev-e",v); p.innerHTML=''; for(const f of Array.from(e.target.files||[]).slice(0,3)){ p.appendChild(el('img',{src:await toDataURL(f)})); }
    });

    $("#print-e",v).addEventListener('click', ()=> pdfEntrada(buildEntrada()));
    $("#save-e",v).addEventListener('click', ()=>{
      if(!confirm('¿Seguro que quieres guardar el traspaso?')) return;
      const arr=DB.get(K_TRS,[]); const t=buildEntrada();
      const esProd = (t.saleDe==='CAJA FUERTE' && t.entraA==='PRODUCCIÓN');
      t.tipo = esProd ? 'PRODUCCION' : 'ALMACENES';
      t.cerrado = !esProd;
      arr.push(t); DB.set(K_TRS,arr);
      toast(`Traspaso guardado — folio ${t.folio}`);
      if(esProd) openTab(`trs-proc-${t.folio}`,`Folio ${t.folio}`, vv=> viewTrsProc(vv,t.folio));
    });

    function buildEntrada(){
      const rows = Array.from(tb.querySelectorAll('tr')).map((tr,i)=>({
        idx:i+1, material:$('.mat',tr).value, detalle:$('.det',tr).value.trim(),
        aleacion:+($('.alea',tr).value||0), gr:+($('.gr',tr).value||0),
        subtotal:+($('.sub',tr).value||0), fotoLinea: tr.dataset.foto||null
      })).filter(r=> r.gr || r.aleacion || r.detalle);

      const fotos = Array.from($("#prev-e",v).querySelectorAll('img')).map(i=>i.src);
      const totalGr = rows.reduce((a,l)=>a+(+l.subtotal||0),0);

      return {
        folio:data.folio, fecha:$("#h-fecha",v).value, hora:data.hora,
        saleDe:$("#h-sale",v).value, entraA:$("#h-entra",v).value, comentarios:$("#h-com",v).value,
        lineasEntrada:rows, fotosEntrada:fotos, lineasSalida:[], fotosSalida:[], totalGr
      };
    }
  }

  // PENDIENTES
  function viewTrsPend(v){
    const arr=DB.get(K_TRS,[]).filter(t=> t.tipo==='PRODUCCION' && !t.cerrado);
    v.innerHTML=''; const c=el('div',{className:'card'});
    c.innerHTML=`<div class="actions" style="justify-content:space-between"><div><b>Folios pendientes</b> <span class="btn-warn" style="padding:2px 8px;border-radius:999px">${arr.length}</span></div></div>`;
    const wrap=el('div',{className:'actions',style:'flex-wrap:wrap;gap:6px'}); c.appendChild(wrap);
    arr.forEach(t=>{ const b=el('button',{className:'btn btn-warn',textContent:`Folio ${t.folio}`}); b.onclick=()=> openTab(`trs-proc-${t.folio}`,`Folio ${t.folio}`, vv=> viewTrsProc(vv,t.folio)); wrap.appendChild(b); });
    v.appendChild(c);
  }

  // BUSCAR
  function viewTrsFind(v){
    v.innerHTML=`<div class="card"><div class="grid"><div><label>Folio</label><input id="q" placeholder="001"></div></div><div class="actions"><button class="btn btn-primary" id="go">Abrir</button></div></div>`;
    $("#go",v).onclick=()=>{ const f=$("#q",v).value.trim(); if(!f) return toast('Escribe folio'); openTab(`trs-open-${f}`,`Folio ${f}`, vv=> viewTrsProc(vv,f,true)); };
  }

  // PROCESAR SALIDA
  function viewTrsProc(v, folio, abrirSiCerrado=false){
    const arr=DB.get(K_TRS,[]); const t=arr.find(x=>x.folio==folio);
    if(!t){ v.innerHTML='<div class="card">Folio no encontrado</div>'; return; }

    v.innerHTML = `
      <div class="card">
        <div id="hdr"></div>
        <div class="hint" style="margin:8px 0">SALIDA (mismo folio)</div>
        <table class="nota-table">
          <thead><tr><th>#</th><th>Foto</th><th>Material</th><th>Detalle</th><th>Aleación</th><th>Gr</th><th>SubTotal</th></tr></thead>
          <tbody id="tb-s"></tbody>
          <tfoot><tr><td colspan="7"><button class="btn btn-outline" id="add-s">+ Agregar línea</button></td></tr></tfoot>
        </table>
        <div class="grid"><div><label>Fotos de salida</label><input id="f-s" type="file" accept="image/*" multiple capture="environment"></div></div>
        <div id="prev-s" class="preview"></div>

        <div class="actions">
          <button class="btn btn-outline" id="save-parcial">Guardar SALIDA PARCIAL</button>
          <button class="btn btn-warn" id="save-final">Cerrar con SALIDA FINAL</button>
        </div>
      </div>
    `;

    // encabezado en gris (bloqueado)
    header($("#hdr",v),t,true);

    const tb=$("#tb-s",v);
    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('S'); tb.appendChild(tr); renum(tb);
      $('.alea',tr).value='0'; $('.alea',tr).classList.add('ro');
      bindLine(tr,'S',()=>{},'prev-s'); };
    $("#add-s",v).onclick=add;
    if(t.lineasSalida?.length){
      t.lineasSalida.forEach(l=>{ add(); const tr=$('#tb-s tr:last-child',v); $('.mat',tr).value=l.material; $('.det',tr).value=l.detalle||''; $('.gr',tr).value=l.gr; $('.sub',tr).value=l.subtotal.toFixed(2); });
      (t.fotosSalida||[]).forEach(s=> $("#prev-s",v).appendChild(el('img',{src:s})));
    } else add();

    $("#f-s",v).addEventListener('change', async e=>{
      const p=$("#prev-s",v); p.innerHTML=''; for(const f of Array.from(e.target.files||[]).slice(0,3)){ p.appendChild(el('img',{src:await toDataURL(f)})); }
    });

    const grab = ()=>{
      const rows = Array.from(tb.querySelectorAll('tr')).map((tr,i)=>({
        idx:i+1, material:$('.mat',tr).value, detalle:$('.det',tr).value.trim(),
        aleacion:0, gr:+($('.gr',tr).value||0), subtotal:+($('.gr',tr).value||0), fotoLinea: tr.dataset.foto||null
      })).filter(r=> r.gr || r.detalle);
      const fotos=Array.from($("#prev-s",v).querySelectorAll('img')).map(i=>i.src);
      return {rows,fotos};
    };

    $("#save-parcial",v).onclick=()=>{
      const {rows,fotos}=grab(); t.lineasSalida=rows; t.fotosSalida=fotos; DB.set(K_TRS,arr); toast('Salida PARCIAL guardada');
    };
    $("#save-final",v).onclick=()=>{
      const {rows,fotos}=grab(); if(!rows.length) return toast('Agrega líneas de salida');
      const ent=t.lineasEntrada.reduce((a,l)=>a+l.subtotal,0), sal=rows.reduce((a,l)=>a+l.subtotal,0), mer=sal-ent;
      if(mer<0) alert('Atención: MENOS gramos que la entrada. Revisa.');
      if(mer>0) alert('Estás registrando MÁS gramos que la entrada.');
      if(!confirm('¿Cerrar folio con SALIDA FINAL?')) return;
      t.lineasSalida=rows; t.fotosSalida=fotos; t.cerrado=true; DB.set(K_TRS,arr); toast('Folio cerrado'); pdfCompleto(t);
    };

    // si fue un traspaso entre almacenes (no producción) y está cerrado: sólo lectura
    if(abrirSiCerrado && t.tipo==='ALMACENES' && t.cerrado){ $$('#add-s,#f-s,#save-parcial,#save-final',v).forEach(x=> x && (x.style.display='none')); }
  }

  /* ===== PDFs ===== */
  function pdfEntrada(t){
    const rows=t.lineasEntrada.map(l=>`<tr><td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td><td style="text-align:right">${fmt2(l.aleacion)}</td><td style="text-align:right">${fmt2(l.gr)}</td><td style="text-align:right">${fmt2(l.subtotal)}</td></tr>`).join('');
    const fotos=(t.fotosEntrada||[]).map(s=>`<img src="${s}" style="max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px">`).join('');
    const html=`<div style="font-family:system-ui;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><div style="font-weight:700;color:#0a2c4c">TRASPASO (ENTRADA)</div><div>Folio <b style="color:#b91c1c">${t.folio}</b> · ${t.fecha} ${t.hora}</div><div>Sale de: <b>${t.saleDe}</b> · Entra a: <b>${t.entraA}</b></div></div>
        <div style="font-weight:800">MERMA: —</div>
      </div>
      <table style="width:100%;border-collapse:collapse" border="1" cellspacing="0" cellpadding="4">
        <thead style="background:#e2e8f0"><tr><th>#</th><th>Material</th><th>Detalle</th><th>Aleación</th><th>Gr</th><th>SubTotal</th></tr></thead><tbody>${rows}</tbody>
      </table>
      <div style="margin-top:6px"><b>Total Gr:</b> ${fmt2(t.totalGr)}</div>
      <div class="hint" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>
      <div>${fotos}</div>
    </div>`;
    const w=window.open('','_blank'); w.document.write(`<html><head><title>Folio ${t.folio}</title><style>@page{size:5.5in 8.5in;margin:10mm}</style></head><body>${html}<script>setTimeout(()=>print(),200)</script></body></html>`);
  }
  function pdfCompleto(t){
    const sum=a=>a.reduce((x,y)=>x+(+y||0),0);
    const ent=sum(t.lineasEntrada.map(l=>l.subtotal)); const sal=sum((t.lineasSalida||[]).map(l=>l.subtotal));
    const mer=sal-ent, pct=ent?(mer/ent*100):0, col=mer>=0?'green':'#b91c1c', sig=mer>=0?'+':'-';
    const rE=t.lineasEntrada.map(l=>`<tr><td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td><td style="text-align:right">${fmt2(l.aleacion)}</td><td style="text-align:right">${fmt2(l.gr)}</td><td style="text-align:right">${fmt2(l.subtotal)}</td></tr>`).join('');
    const rS=(t.lineasSalida||[]).map(l=>`<tr><td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td><td style="text-align:right">0.00</td><td style="text-align:right">${fmt2(l.gr)}</td><td style="text-align:right">${fmt2(l.subtotal)}</td></tr>`).join('');
    const fE=(t.fotosEntrada||[]).map(s=>`<img src="${s}" style="max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px">`).join('');
    const fS=(t.fotosSalida||[]).map(s=>`<img src="${s}" style="max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px">`).join('');
    const html=`<div style="font-family:system-ui;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><div style="font-weight:700;color:#0a2c4c">TRASPASO PARA PRODUCCIÓN</div><div>Folio <b style="color:#b91c1c">${t.folio}</b> · ${t.fecha} ${t.hora}</div><div>Sale de: <b>${t.saleDe}</b> · Entra a: <b>${t.entraA}</b></div></div>
        <div style="font-weight:800;color:${col}">MERMA: ${sig}${fmt2(Math.abs(mer))} g (${sig}${Math.abs(pct).toFixed(2)}%)</div>
      </div>
      <div style="font-weight:700;color:#0a2c4c;margin:6px 0">ENTRADA</div>
      <table style="width:100%;border-collapse:collapse" border="1" cellspacing="0" cellpadding="4"><thead style="background:#e2e8f0"><tr><th>#</th><th>Material</th><th>Detalle</th><th>Aleación</th><th>Gr</th><th>SubTotal</th></tr></thead><tbody>${rE}</tbody></table>
      <div style="margin:4px 0">${fE}</div>
      <div style="font-weight:700;color:#0a2c4c;margin:6px 0">SALIDA</div>
      <table style="width:100%;border-collapse:collapse" border="1" cellspacing="0" cellpadding="4"><thead style="background:#e2e8f0"><tr><th>#</th><th>Material</th><th>Detalle</th><th>Aleación</th><th>Gr</th><th>SubTotal</th></tr></thead><tbody>${rS}</tbody></table>
      <div style="margin:4px 0">${fS}</div>
      <div class="hint" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>
    </div>`;
    const w=window.open('','_blank'); w.document.write(`<html><head><title>Folio ${t.folio}</title><style>@page{size:5.5in 8.5in;margin:10mm}</style></head><body>${html}<script>setTimeout(()=>print(),200)</script></body></html>`);
  }

  /* ===== Pedidos (simple) ===== */
  function viewPedList(v){
    const lst=DB.get(K_PED,[]); v.innerHTML='';
    const c=el('div',{className:'card'});
    c.innerHTML='<div class="actions" style="justify-content:space-between"><b>Pedidos</b><button class="btn btn-primary" id="new">+ Nuevo</button></div>';
    const t=el('table'); t.innerHTML='<thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Partidas</th><th>Gr plan</th></tr></thead>' +
      '<tbody>'+lst.map(p=>`<tr><td>${p.folio}</td><td>${p.fecha}</td><td>${p.cliente||'-'}</td><td>${p.partidas.length}</td><td>${fmt2(p.partidas.reduce((a,b)=>a+Number(b.gramos||0),0))}</td></tr>`).join('')+'</tbody>';
    c.appendChild(t); v.appendChild(c);
    $("#new",c).onclick=()=> openTab('ped-new','Nuevo pedido',viewPedNew);
  }
  function viewPedNew(v){
    const fol=String(DB.get(K_PED,[]).length+1).padStart(4,'0');
    v.innerHTML=`<div class="card">
      <div class="grid">
        <div><label>Folio</label><input id="pf" value="${fol}" readonly></div>
        <div><label>Fecha</label><input id="pd" value="${today()}"></div>
        <div><label>Cliente</label><input id="pc" placeholder="Nombre cliente"></div>
        <div><label>Promesa</label><input id="pp" placeholder="dd/mm/aaaa"></div>
      </div>
      <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Gr estimados</th><th></th></tr></thead><tbody id="pb"></tbody>
        <tfoot><tr><td colspan="4"><button class="btn btn-outline" id="add">+ Agregar partida</button></td></tr></tfoot></table>
      <div class="actions"><button class="btn btn-primary" id="save">Guardar pedido</button><button class="btn btn-outline" id="meta">Crear meta producción</button></div>
    </div>`;
    const add=()=>{ const tr=el('tr'); tr.innerHTML='<td><input class="prod" placeholder="Anillo X"></td><td><input type="number" step="1" class="cant"></td><td><input type="number" step="0.01" class="gram"></td><td><button class="btn btn-outline del">✕</button></td>'; $("#pb",v).appendChild(tr); $('.del',tr).onclick=()=>tr.remove(); };
    $("#add",v).onclick=add; add();
    $("#save",v).onclick=()=>{
      const ped={folio:$("#pf",v).value,fecha:$("#pd",v).value,cliente:$("#pc",v).value,promesa:$("#pp",v).value,
        partidas:Array.from($("#pb",v).querySelectorAll('tr')).map(tr=>({prod:$('.prod',tr).value,cant:+$('.cant',tr).value||0,gramos:+$('.gram',tr).value||0})).filter(p=>p.prod)};
      const arr=DB.get(K_PED,[]); arr.push(ped); DB.set(K_PED,arr); toast('Pedido guardado'); openTab('ped-list','Pedidos',viewPedList);
    };
    $("#meta",v).onclick=()=>{ const total=Array.from($("#pb",v).querySelectorAll('.gram')).reduce((s,i)=>s+(+i.value||0),0); toast('Meta de producción: '+fmt2(total)+' g'); };
  }

})();
