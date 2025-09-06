/* CONTROL-A — app.js v1.9.7
   Cambios: responsive sin scroll, fecha con calendario (type=date), 3 líneas por defecto,
   orden columnas (#, Foto, Material, Detalle, GR, Aleación, Subtotal), GR antes que Aleación,
   “Grs disponibles” por almacén, reglas de cierre PRODUCCIÓN (merma ≤ tolerancia),
   tolerancias por material (Limalla 20%, Limalla negra 50%, Tierras 70%),
   salida producción debe regresar a Caja Fuerte, producto terminado obligatorio (o explicación),
   inventarios por almacén (kardex simple), máximo 5 folios abiertos,
   botones grises tras cierre pero PDF/WhatsApp activos, PDF estética igual al sistema. */
(() => {
  /* ===== Helpers ===== */
  const $ = (s,r=document)=> r.querySelector(s);
  const $$ = (s,r=document)=> Array.from(r.querySelectorAll(s));
  const el=(t,a={})=>Object.assign(document.createElement(t),a);
  const fmt2=n=>(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
  const toYMD=(d=new Date())=>{
    const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const fromYMD=(v)=>{ // a dd/mm/aaaa
    if(!v) return '';
    const [y,m,d]=v.split('-'); return `${d}/${m}/${y}`;
  };
  const nowHM=()=>new Date().toLocaleTimeString('es-MX',{hour12:false,hour:'2-digit',minute:'2-digit'});
  const toast=msg=>{const t=$("#toast"); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',1600)};

  /* ===== Estado y persistencia ===== */
  const K_TRS='argoz.traspasos';
  const K_PED='argoz.pedidos';
  const K_INV='argoz.inventarios'; // kardex simple por almacén/material (solo CAJA FUERTE se “asienta” en cierre)
  const DB={ get(k,d){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d} },
             set(k,v){ localStorage.setItem(k,JSON.stringify(v)) } };

  const ALMACENES=["CAJA FUERTE","PRODUCCIÓN"];
  const MATS=["Plata .999","Plata .925 sólida","Limalla sólida","Limalla negra","Tierras .925","Otros .925","Mercancía terminada"];
  const ALLOY=0.07;

  // tolerancias (merma máxima) por material en la ENTRADA del folio
  const TOLERANCIAS = {
    "Limalla sólida": 20,
    "Limalla negra": 50,
    "Tierras .925" : 70
  };
  const TOL_DEF = 5; // por defecto

  const jsok=()=>{ try{$("#jsok").textContent='JS OK';}catch{} }
  document.addEventListener('DOMContentLoaded', jsok);

  /* ===== Layout: Tabs y Subpanel ===== */
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

  $("#btn-toggle-mid")?.addEventListener('click',()=>{ const m=$("#subpanel"); m.style.display=getComputedStyle(m).display==='none'?'block':'none' });

  function renderSubpanel(root='inventarios'){
    const s=$("#subpanel"); s.innerHTML='';
    const card=el('div',{className:'card'}); const h=el('h2'); h.textContent=({inicio:'Inicio',ventas:'Ventas',inventarios:'Inventarios',pedidos:'Pedidos',catalogo:'Catálogo'})[root]||root; card.appendChild(h);
    const add=(t,fn)=>{ const b=el('button',{className:'btn btn-outline',textContent:t}); b.addEventListener('click',fn); card.appendChild(b); };

    if(root==='inventarios'){
      const a=el('div',{className:'actions'});
      const b=el('button',{className:'btn btn-primary',innerHTML:'+ Nueva Entrada'});
      b.onclick=()=> openTab('trs-new','Nuevo traspaso',viewTrsNew);
      a.appendChild(b); card.appendChild(a);
      add('Folios pendientes',()=> openTab('trs-pend','Pendientes',viewTrsPend));
      add('Buscar folio…',()=> openTab('trs-find','Buscar folio',viewTrsFind));
    }
    if(root==='pedidos'){
      add('Lista de pedidos',()=> openTab('ped-list','Pedidos',viewPedList));
      add('+ Nuevo pedido',()=> openTab('ped-new','Nuevo pedido',viewPedNew));
    }
    s.appendChild(card);
  }
  document.addEventListener('DOMContentLoaded', ()=> renderSubpanel('inventarios'));
  $$(".tree-btn").forEach(b=> b.addEventListener('click',()=>{ $$(".tree-btn").forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderSubpanel(b.dataset.root); }));

  /* ===== Backup/Restore ===== */
  $("#btn-backup")?.addEventListener('click', ()=>{
    const blob=new Blob([JSON.stringify({traspasos:DB.get(K_TRS,[]),pedidos:DB.get(K_PED,[]),inventarios:DB.get(K_INV,{})},null,2)],{type:'application/json'});
    const a=el('a',{href:URL.createObjectURL(blob),download:`argoz_backup_${Date.now()}.json`}); document.body.appendChild(a); a.click(); a.remove();
  });
  $("#btn-restore")?.addEventListener('click', ()=>{
    const i=el('input',{type:'file',accept:'application/json'});
    i.onchange=()=>{const f=i.files[0]; if(!f) return; const fr=new FileReader();
      fr.onload=()=>{ try{const o=JSON.parse(fr.result);
        if(o.traspasos) DB.set(K_TRS,o.traspasos);
        if(o.pedidos) DB.set(K_PED,o.pedidos);
        if(o.inventarios) DB.set(K_INV,o.inventarios);
        toast('Datos restaurados'); renderSubpanel('inventarios');
      }catch{toast('Archivo inválido')} };
      fr.readAsText(f);
    };
    i.click();
  });

  /* ===== Inventarios / Kardex ===== */
  function invGet(){ return DB.get(K_INV,{}); }
  function invSet(x){ DB.set(K_INV,x); }
  function invGetAlm(alm){ const inv=invGet(); inv[alm]=inv[alm]||{}; return inv[alm]; }
  function invApply(alm,material,delta){
    const inv=invGet(); inv[alm]=inv[alm]||{}; inv[alm][material]=(inv[alm][material]||0)+delta; invSet(inv);
  }
  function invTotalAlmacen(alm){
    // Para PRODUCCIÓN: mostrar SOLO virtual (folios abiertos) según regla del negocio
    if(alm==='PRODUCCIÓN'){
      const ab=DB.get(K_TRS,[]).filter(t=> t.tipo==='PRODUCCION' && !t.cerrado);
      const sum=a=>a.reduce((x,y)=>x+(+y||0),0);
      let total=0;
      ab.forEach(t=>{
        const ent=sum(t.lineasEntrada.map(l=>l.subtotal));
        const sal=sum((t.lineasSalida||[]).map(l=>l.subtotal));
        total += (ent - sal);
      });
      return total;
    } else {
      // CAJA FUERTE: suma de inventario asentado
      const inv=invGetAlm(alm); return Object.values(inv).reduce((a,b)=>a+(+b||0),0);
    }
  }

  /* ===== Traspasos ===== */
  const nextFolio=()=> String((DB.get(K_TRS,[]).map(x=>+x.folio).reduce((a,b)=>Math.max(a,b),0))+1).padStart(3,'0');
  const calcSub=(gr,alea)=> (+gr||0) + (+alea||0);

  function lineRow(tipo){
    const ro = (tipo==='S') ? 'readonly' : '';  // salida: aleación bloqueada
    return `<tr>
      <td class="idx" data-label="#">#</td>
      <td data-label="Foto"><button type="button" class="btn btn-outline cam">📷</button></td>
      <td data-label="Material"><select class="mat">${MATS.map(m=>`<option>${m}</option>`).join('')}</select></td>
      <td data-label="Detalle"><input class="det" placeholder="(opcional)"></td>
      <td data-label="GR"><input type="number" step="0.01" class="gr"></td>
      <td data-label="Aleación"><input type="number" step="0.01" class="alea" ${ro}></td>
      <td data-label="SubTotal"><input type="number" step="0.01" class="sub" readonly></td>
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

  async function toDataURL(file,maxW=1200,quality=.8){
    const img=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src=URL.createObjectURL(file);});
    const sc=Math.min(1,maxW/img.width), w=Math.round(img.width*sc), h=Math.round(img.height*sc);
    const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
    return c.toDataURL('image/jpeg',quality);
  }

  function bindLine(tr,tipo,update,prevId){
    const mat=$('.mat',tr), gr=$('.gr',tr), ale=$('.alea',tr), sub=$('.sub',tr), cam=$('.cam',tr);
    const recalc=()=>{
      const is999=mat.value==='Plata .999';
      setAleaState(mat,ale,tipo);
      if(tipo==='E' && is999 && !ale.dataset.edited){ ale.value = gr.value ? (Number(gr.value)*ALLOY).toFixed(2) : ''; }
      sub.value = calcSub(gr.value,ale.value).toFixed(2);
      update();
    };
    ['input','change'].forEach(ev=>[mat,gr,ale].forEach(x=> x.addEventListener(ev,recalc)));
    ale.addEventListener('input',()=> ale.dataset.edited='1');
    cam.addEventListener('click', ()=>{
      const i=el('input',{type:'file',accept:'image/*',capture:'environment'});
      i.onchange=async ()=>{ const f=i.files[0]; if(!f) return; const u=await toDataURL(f); const p=document.getElementById(prevId); p && p.appendChild(el('img',{src:u})); tr.dataset.foto=u; };
      i.click();
    });
    recalc();
  }
  const sumSub = tb => Array.from(tb.querySelectorAll('.sub')).reduce((s,i)=>s+(+i.value||0),0);

  function hdr(v,data,locked){
    // indicador de “Grs disponibles” del almacén “Sale de”
    const disp = fmt2(invTotalAlmacen(data.saleDe));
    v.innerHTML = `
      <div class="actions" style="justify-content:space-between;align-items:center">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div><label>Fecha</label><input id="h-fecha" type="date" value="${toYMD()}" ${locked?'readonly':''}></div>
          <div><label>Sale de</label><select id="h-sale" ${locked?'disabled':''}>${ALMACENES.map(a=>`<option ${a===data.saleDe?'selected':''}>${a}</option>`).join('')}</select></div>
          <div><label>Entra a</label><select id="h-entra" ${locked?'disabled':''}>${ALMACENES.map(a=>`<option ${a===data.entraA?'selected':''}>${a}</option>`).join('')}</select></div>
          <div><label>Comentarios</label><textarea id="h-com" ${locked?'readonly class="ro"':''}>${data.comentarios||''}</textarea></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div><b>FOLIO</b> <span style="color:var(--rojo);font-weight:800">${data.folio}</span></div>
            <div class="pill">Grs disp. en <b>${data.saleDe}</b>: <span id="pill-disp" class="num">${disp}</span></div>
            <div class="pill">TOTAL GR. <span id="pill" class="num">0.00</span></div>
          </div>
        </div>
      </div>`;
  }
  function refreshDisp(v){
    const alm = $("#h-sale",v)?.value || "CAJA FUERTE";
    const disp = invTotalAlmacen(alm);
    $("#pill-disp",v).textContent = fmt2(disp);
  }

  /* ====== PDF helpers (estética similar) ====== */
  function openPrint(html, titulo='Documento'){
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>${titulo}</title>
      <style>
        @page{size:5.5in 8.5in;margin:10mm}
        body{font-family:system-ui,Arial;font-size:12px;color:#0f172a}
        .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .pill{background:#f1f5f9;border-radius:16px;padding:4px 8px;font-weight:700;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left}
        thead tr{background:#e7effa}
        .muted{color:#64748b}
        .caps{font-weight:700;color:#0a2c4c;margin:6px 0}
        .thumbs img{max-width:96px;border:1px solid #ddd;border-radius:8px;margin:2px}
      </style></head><body>${html}<script>setTimeout(()=>print(),200)</script></body></html>`);
  }

  function pdfEntrada(t){
    const rows=t.lineasEntrada.map(l=>`<tr>
      <td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td>
      <td style="text-align:right">${fmt2(l.gr)}</td>
      <td style="text-align:right">${fmt2(l.aleacion)}</td>
      <td style="text-align:right">${fmt2(l.subtotal)}</td>
    </tr>`).join('');
    const fotos=(t.fotosEntrada||[]).map(s=>`<img src="${s}">`).join('');
    const html=`<div class="hdr">
      <div>
        <div class="caps">TRASPASO (ENTRADA)</div>
        <div class="muted">Folio <b style="color:#b91c1c">${t.folio}</b> · ${t.fecha} ${t.hora}</div>
        <div>Sale de: <b>${t.saleDe}</b> · Entra a: <b>${t.entraA}</b></div>
      </div>
      <div class="pill">MERMA: —</div>
    </div>
    <table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>GR</th><th>Aleación</th><th>SubTotal</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:6px"><b>Total Gr:</b> ${fmt2(t.totalGr)}</div>
    <div class="muted" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>
    <div class="thumbs">${fotos}</div>`;
    openPrint(html, `Entrada ${t.folio}`);
  }

  function pdfCompleto(t, merma, mermaPct){
    const col=merma>=0?'green':'#b91c1c', sig=merma>=0?'+':'-';
    const rE=t.lineasEntrada.map(l=>`<tr><td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td>
      <td style="text-align:right">${fmt2(l.gr)}</td><td style="text-align:right">${fmt2(l.aleacion)}</td><td style="text-align:right">${fmt2(l.subtotal)}</td></tr>`).join('');
    const rS=(t.lineasSalida||[]).map(l=>`<tr><td>${l.idx}</td><td>${l.material}</td><td>${l.detalle||''}</td>
      <td style="text-align:right">${fmt2(l.gr)}</td><td style="text-align:right">0.00</td><td style="text-align:right">${fmt2(l.subtotal)}</td></tr>`).join('');
    const fE=(t.fotosEntrada||[]).map(s=>`<img src="${s}">`).join('');
    const fS=(t.fotosSalida||[]).map(s=>`<img src="${s}">`).join('');
    const html=`<div class="hdr">
      <div>
        <div class="caps">TRASPASO PARA PRODUCCIÓN</div>
        <div class="muted">Folio <b style="color:#b91c1c">${t.folio}</b> · ${t.fecha} ${t.hora}</div>
        <div>Sale de: <b>${t.saleDe}</b> · Entra a: <b>${t.entraA}</b></div>
      </div>
      <div class="pill" style="color:${col}">MERMA: ${sig}${fmt2(Math.abs(merma))} g (${sig}${Math.abs(mermaPct).toFixed(2)}%)</div>
    </div>
    <div class="caps">ENTRADA</div>
    <table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>GR</th><th>Aleación</th><th>SubTotal</th></tr></thead><tbody>${rE}</tbody></table>
    <div class="thumbs">${fE}</div>
    <div class="caps">SALIDA</div>
    <table><thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>GR</th><th>Aleación</th><th>SubTotal</th></tr></thead><tbody>${rS}</tbody></table>
    <div class="thumbs">${fS}</div>
    <div class="muted" style="margin:6px 0"><b>ENTREGÓ:</b> ____________________ &nbsp; <b>RECIBIÓ:</b> ____________________</div>`;
    openPrint(html, `Producción ${t.folio}`);
  }

  // compartir como PDF: abriremos la vista de impresión; para compartir, el usuario guarda como PDF y comparte (Web Share con archivos no siempre está disponible)
  function sharePDF(action){
    // action() abre la vista de impresión en nueva ventana
    action();
    // Sin texto adicional; la UI ya muestra solo el ícono de WhatsApp.
  }

  /* ====== NUEVO TRASPASO (ENTRADA) ====== */
  function viewTrsNew(v){
    // Máximo 5 folios de producción abiertos
    const abiertos = DB.get(K_TRS,[]).filter(t=>t.tipo==='PRODUCCION' && !t.cerrado).length;
    if(abiertos>=5){ v.innerHTML='<div class="card">Límite alcanzado: ya hay 5 folios de PRODUCCIÓN abiertos.</div>'; return; }

    const folio=nextFolio();
    const data={folio, fecha:toYMD(), hora:nowHM(), saleDe:'CAJA FUERTE', entraA:'PRODUCCIÓN', comentarios:''};

    v.innerHTML = `
      <div class="card">
        <div id="hdr"></div>
        <table class="nota-table">
          <thead><tr><th>#</th><th>Foto</th><th>Material</th><th>Detalle</th><th>GR</th><th>Aleación</th><th>SubTotal</th></tr></thead>
          <tbody id="tb-e"></tbody>
          <tfoot><tr><td colspan="7"><button class="btn btn-outline" id="add-e">+ Agregar línea</button></td></tr></tfoot>
        </table>
        <div class="grid"><div><label>Fotos del traspaso (máx 3)</label><input id="f-e" type="file" accept="image/*" multiple capture="environment"></div></div>
        <div id="prev-e" class="preview"></div>
        <div class="actions">
          <button class="btn btn-primary" id="save-e">Guardar</button>
          <button class="btn btn-outline" id="print-e" title="PDF">🖨️ PDF</button>
          <button class="btn btn-ghost" id="wa-e" title="Enviar por WhatsApp">🟢</button>
        </div>
      </div>
    `;

    const head=$("#hdr",v), tb=$("#tb-e",v), pill=()=>$("#pill",v);
    const pillDisp=()=>$("#pill-disp",v);

    function recalc(){ pill().textContent = fmt2(sumSub(tb)); }
    hdr(head,data,false);
    $("#h-sale",v).addEventListener('change', ()=> refreshDisp(v));
    refreshDisp(v);

    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('E'); tb.appendChild(tr); renum(tb); bindLine(tr,'E',recalc,'prev-e'); };
    $("#add-e",v).addEventListener('click',add);
    // 3 líneas por defecto
    add(); add(); add();

    $("#f-e",v).addEventListener('change', async e=>{
      const p=$("#prev-e",v); p.innerHTML=''; for(const f of Array.from(e.target.files||[]).slice(0,3)){ p.appendChild(el('img',{src:await toDataURL(f)})); }
    });

    const buildEntrada=()=>{
      const rows=Array.from(tb.querySelectorAll('tr')).map((tr,i)=>({
        idx:i+1, material:$('.mat',tr).value, detalle:$('.det',tr).value.trim(),
        gr:+($('.gr',tr).value||0), aleacion:+($('.alea',tr).value||0),
        subtotal:+($('.sub',tr).value||0), fotoLinea: tr.dataset.foto||null
      })).filter(r=> r.gr || r.aleacion || r.detalle);
      const fotos=Array.from($("#prev-e",v).querySelectorAll('img')).map(i=>i.src);
      const totalGr=rows.reduce((a,l)=>a+(+l.subtotal||0),0);
      return {
        folio:data.folio, fecha:fromYMD($("#h-fecha",v).value), hora:data.hora,
        saleDe:$("#h-sale",v).value, entraA:$("#h-entra",v).value, comentarios:$("#h-com",v).value,
        lineasEntrada:rows, fotosEntrada:fotos, lineasSalida:[], fotosSalida:[], totalGr
      };
    };

    $("#print-e",v).addEventListener('click', ()=> pdfEntrada(buildEntrada()));
    $("#wa-e",v).addEventListener('click', ()=> sharePDF(()=> pdfEntrada(buildEntrada())));

    $("#save-e",v).addEventListener('click', ()=>{
      if(!confirm('¿Seguro que quieres guardar el traspaso?')) return;
      const arr=DB.get(K_TRS,[]); const t=buildEntrada();
      const esProd=(t.saleDe==='CAJA FUERTE' && t.entraA==='PRODUCCIÓN');
      t.tipo = esProd ? 'PRODUCCION' : 'ALMACENES';
      t.cerrado = !esProd;

      // Ajuste inventario CAJA FUERTE al crear ENTRADA de producción (sale de caja)
      if(esProd){
        t.lineasEntrada.forEach(l=> invApply('CAJA FUERTE', l.material, -l.subtotal));
      } else {
        // Entre almacenes: asiento directo
        t.lineasEntrada.forEach(l=>{
          invApply(t.saleDe, l.material, -l.subtotal);
          invApply(t.entraA, l.material,  l.subtotal);
        });
      }

      arr.push(t); DB.set(K_TRS,arr);
      toast(`Traspaso guardado — folio ${t.folio}`);
      refreshDisp(v);
      if(esProd) openTab(`trs-proc-${t.folio}`,`Folio ${t.folio}`, vv=> viewTrsProc(vv,t.folio));
    });
  }

  /* ====== Pendientes ====== */
  function viewTrsPend(v){
    const arr=DB.get(K_TRS,[]).filter(t=> t.tipo==='PRODUCCION' && !t.cerrado);
    v.innerHTML=''; const c=el('div',{className:'card'});
    c.innerHTML=`<div class="actions" style="justify-content:space-between"><div><b>Folios pendientes</b> <span class="btn-warn" style="padding:2px 8px;border-radius:999px">${arr.length}</span></div></div>`;
    const wrap=el('div',{className:'actions',style:'flex-wrap:wrap;gap:6px'}); c.appendChild(wrap);
    arr.forEach(t=>{ const b=el('button',{className:'btn btn-warn',textContent:`Folio ${t.folio}`}); b.onclick=()=> openTab(`trs-proc-${t.folio}`,`Folio ${t.folio}`, vv=> viewTrsProc(vv,t.folio)); wrap.appendChild(b); });
    v.appendChild(c);
  }

  /* ====== Buscar ====== */
  function viewTrsFind(v){
    v.innerHTML=`<div class="card"><div class="grid"><div><label>Folio</label><input id="q" placeholder="001"></div></div>
    <div class="actions"><button class="btn btn-primary" id="go">Abrir</button></div></div>`;
    $("#go",v).onclick=()=>{ const f=$("#q",v).value.trim(); if(!f) return toast('Escribe folio'); openTab(`trs-open-${f}`,`Folio ${f}`, vv=> viewTrsProc(vv,f,true)); };
  }

  /* ====== Procesar (SALIDA / Cerrar) ====== */
  function viewTrsProc(v, folio, abrirSiCerrado=false){
    const arr=DB.get(K_TRS,[]); const t=arr.find(x=>x.folio==folio);
    if(!t){ v.innerHTML='<div class="card">Folio no encontrado</div>'; return; }

    v.innerHTML = `
      <div class="card">
        <div id="hdr"></div>

        <div class="hint" style="margin:8px 0">SALIDA (mismo folio) — Al cerrar, el material debe regresar a <b>CAJA FUERTE</b>.</div>
        <table class="nota-table">
          <thead><tr><th>#</th><th>Foto</th><th>Material</th><th>Detalle</th><th>GR</th><th>Aleación</th><th>SubTotal</th></tr></thead>
          <tbody id="tb-s"></tbody>
          <tfoot><tr><td colspan="7"><button class="btn btn-outline" id="add-s">+ Agregar línea</button></td></tr></tfoot>
        </table>

        <div class="grid">
          <div><label>Fotos de salida</label><input id="f-s" type="file" accept="image/*" multiple capture="environment"></div>
          <div><label>Motivo (si regresa MENOS gramos)</label><textarea id="motivo"></textarea></div>
        </div>
        <div id="prev-s" class="preview"></div>

        <div class="actions">
          <button class="btn btn-outline" id="save-parcial">Guardar SALIDA PARCIAL</button>
          <button class="btn btn-warn" id="save-final">Cerrar con SALIDA FINAL</button>
          <button class="btn btn-outline" id="pdf-final" title="PDF">🖨️ PDF</button>
          <button class="btn btn-ghost" id="wa-final" title="Enviar por WhatsApp">🟢</button>
        </div>
      </div>
    `;

    hdr($("#hdr",v),{...t, fecha:toYMD()},true); // bloqueado (gris) y con calendario fijo
    refreshDisp(v);

    const tb=$("#tb-s",v);
    const add=()=>{ const tr=el('tr'); tr.innerHTML=lineRow('S'); tb.appendChild(tr); renum(tb);
      // salida: aleación bloqueada y 0; subtotal = gr
      const ale=$('.alea',tr); ale.value='0'; ale.classList.add('ro');
      bindLine(tr,'S',()=>{},'prev-s');
    };
    $("#add-s",v).onclick=add;
    if(t.lineasSalida?.length){
      t.lineasSalida.forEach(l=>{ add(); const tr=$('#tb-s tr:last-child',v); $('.mat',tr).value=l.material; $('.det',tr).value=l.detalle||''; $('.gr',tr).value=l.gr; $('.sub',tr).value=l.subtotal.toFixed(2); });
      (t.fotosSalida||[]).forEach(s=> $("#prev-s",v).appendChild(el('img',{src:s})));
    } else { add(); }

    $("#f-s",v).addEventListener('change', async e=>{
      const p=$("#prev-s",v); p.innerHTML=''; for(const f of Array.from(e.target.files||[]).slice(0,3)){ p.appendChild(el('img',{src:await toDataURL(f)})); }
    });

    const grabSalida=()=>{
      const rows = Array.from(tb.querySelectorAll('tr')).map((tr,i)=>({
        idx:i+1, material:$('.mat',tr).value, detalle:$('.det',tr).value.trim(),
        gr:+($('.gr',tr).value||0), aleacion:0, subtotal:+($('.gr',tr).value||0), fotoLinea: tr.dataset.foto||null
      })).filter(r=> r.gr || r.detalle);
      const fotos=Array.from($("#prev-s",v).querySelectorAll('img')).map(i=>i.src);
      return {rows,fotos};
    };

    const sum = a => a.reduce((x,y)=>x+(+y||0),0);
    const tolFromEntrada = (t)=>{
      const mats = new Set(t.lineasEntrada.map(l=>l.material));
      let tol=TOL_DEF; mats.forEach(m=>{ if(TOLERANCIAS[m]) tol=Math.max(tol, TOLERANCIAS[m]); });
      return tol;
    };

    $("#save-parcial",v).onclick=()=>{
      const {rows,fotos}=grabSalida(); t.lineasSalida=rows; t.fotosSalida=fotos; DB.set(K_TRS,arr); toast('Salida PARCIAL guardada');
    };

    function validarCierreYAplicar(){
      // Reglas:
      // 1) Entra a debe ser CAJA FUERTE
      if(t.entraA !== 'CAJA FUERTE'){ alert('Para cerrar producción, la salida debe regresar a CAJA FUERTE.'); return false; }

      const {rows,fotos}=grabSalida(); if(!rows.length){ toast('Agrega líneas de salida'); return false; }

      // 2) Producto terminado obligatorio (o explicación requerida)
      const tienePT = rows.some(r=> r.material==='Mercancía terminada');
      if(!tienePT){
        const motivo = prompt('No hay “Mercancía terminada” en la salida. Explica el motivo (obligatorio):','');
        if(!motivo || !motivo.trim()){ alert('Debes explicar por qué no hay Mercancía terminada.'); return false; }
        t.motivoSinPT = motivo.trim();
      }

      const ent = sum(t.lineasEntrada.map(l=>l.subtotal));
      const sal = sum(rows.map(l=>l.subtotal));
      const mer = sal - ent;                    // merma (+ creció, - faltó)
      const mneg = ent>0 ? ((ent - sal)/ent*100) : 0; // % de merma si faltó
      const tol = tolFromEntrada(t);

      // 3) Límite de merma (si faltó) — bloquea si supera tolerancia
      if(mneg > tol){
        alert(`Según la información cargada, la merma es ${mneg.toFixed(2)}% (> ${tol}%). No es posible cerrar este folio. Comprueba línea de producción.`);
        return false;
      }

      // 4) Capturar motivo opcional si faltó
      if(mer<0){
        const mot = $("#motivo",v).value.trim();
        if(mot) t.motivoMerma = mot;
      }

      // 5) Aplicar inventarios en cierre:
      //   - PRODUCCIÓN (virtual) deja de contar al cerrarse (no asentamos nada en PRODUCCIÓN).
      //   - CAJA FUERTE suma la salida por material.
      rows.forEach(l=> invApply('CAJA FUERTE', l.material, l.subtotal));

      // Guardar cambios
      t.lineasSalida = rows; t.fotosSalida = fotos; t.cerrado=true;
      DB.set(K_TRS,arr);

      // PDF completo
      const merPct = ent? (mer/ent*100):0;
      pdfCompleto(t, mer, merPct);
      toast('Folio cerrado');
      return true;
    }

    $("#save-final",v).onclick=()=>{
      if(validarCierreYAplicar()){
        // deshabilitar edición, dejar PDF/WA activos
        $$('#add-s,#f-s,#save-parcial,#save-final',v).forEach(x=> x && (x.disabled=true, x.classList.add('ro')));
      }
    };
    $("#pdf-final",v).onclick=()=>{
      const {rows}=grabSalida();
      const ent = sum(t.lineasEntrada.map(l=>l.subtotal));
      const sal = sum(rows.map(l=>l.subtotal));
      const mer = sal - ent; const pct = ent?(mer/ent*100):0;
      pdfCompleto(Object.assign({},t,{lineasSalida:rows}), mer, pct);
    };
    $("#wa-final",v).onclick=()=> sharePDF(()=>{
      const {rows}=grabSalida();
      const ent = sum(t.lineasEntrada.map(l=>l.subtotal));
      const sal = sum(rows.map(l=>l.subtotal));
      const mer = sal - ent; const pct = ent?(mer/ent*100):0;
      pdfCompleto(Object.assign({},t,{lineasSalida:rows}), mer, pct);
    });

    // Solo lectura si se abrió un folio entre almacenes cerrado
    if(abrirSiCerrado && t.tipo==='ALMACENES' && t.cerrado){
      $$('#add-s,#f-s,#save-parcial,#save-final',v).forEach(x=> x && (x.style.display='none'));
    }
  }

  /* ====== Pedidos (simple; aviso en ventas si CF=0 lo manejaremos después) ====== */
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
        <div><label>Fecha</label><input id="pd" type="date" value="${toYMD()}"></div>
        <div><label>Cliente</label><input id="pc" placeholder="Nombre cliente"></div>
        <div><label>Promesa</label><input id="pp" type="date"></div>
      </div>
      <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Gr estimados</th><th></th></tr></thead><tbody id="pb"></tbody>
        <tfoot><tr><td colspan="4"><button class="btn btn-outline" id="add">+ Agregar partida</button></td></tr></tfoot></table>
      <div class="actions"><button class="btn btn-primary" id="save">Guardar pedido</button><button class="btn btn-outline" id="meta">Crear meta producción</button></div>
    </div>`;
    const add=()=>{ const tr=el('tr'); tr.innerHTML='<td><input class="prod" placeholder="Anillo X"></td><td><input type="number" step="1" class="cant"></td><td><input type="number" step="0.01" class="gram"></td><td><button class="btn btn-outline del">✕</button></td>'; $("#pb",v).appendChild(tr); $('.del',tr).onclick=()=>tr.remove(); };
    $("#add",v).onclick=add; add();
    $("#save",v).onclick=()=>{
      const ped={folio:$("#pf",v).value,fecha:$("#pd",v).value?fromYMD($("#pd",v).value):'',cliente:$("#pc",v).value,promesa:$("#pp",v).value?fromYMD($("#pp",v).value):'',
        partidas:Array.from($("#pb",v).querySelectorAll('tr')).map(tr=>({prod:$('.prod',tr).value,cant:+$('.cant',tr).value||0,gramos:+$('.gram',tr).value||0})).filter(p=>p.prod)};
      const arr=DB.get(K_PED,[]); arr.push(ped); DB.set(K_PED,arr); toast('Pedido guardado'); openTab('ped-list','Pedidos',viewPedList);
    };
    $("#meta",v).onclick=()=>{ const total=Array.from($("#pb",v).querySelectorAll('.gram')).reduce((s,i)=>s+(+i.value||0),0); toast('Meta de producción: '+fmt2(total)+' g'); };
  }

  // Nota: en Ventas, cuando intentes “seleccionar gramos” validaremos “Grs disponibles en CAJA FUERTE”.
  // Si es 0: mostrar error “no cuentas con gramos para esta venta”. (Se integrará en el módulo de remisión.)

})();
