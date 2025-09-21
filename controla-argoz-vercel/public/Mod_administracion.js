/* =====================================================================
   INICIO MÓDULO ADMINISTRACIÓN · v1.0 (drop-in para /public/mod_administracion.js)
   Requiere utilidades globales definidas en index.html:
   - saveDB, hoyStr, f2, escapeHTML  (ya vienen en tu index)
   Render raíz: renderAdministracion(host)
   ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- Estado/Persistencia aislado para Administración ---------- */
  const DB = (global.DB = global.DB || {});
  DB.admin = DB.admin || {
    gastos: [],              // {id, folio, fecha, tipo, cuentaId, cuentaContableId, monto, obs, bloqueado, evidencia, ...}
    ingresos: [],            // opcional si quieres conciliarlos
    conciliaciones: [],      // {id, folio, cuentaId, desde, hasta, ...}
    cuentas: [
      { id: "BAN", nombre: "Banco MXN" },
      { id: "CAJ", nombre: "Caja chica" },
    ],
    cuentasContables: [
      { id: "renta", nombre: "Renta" },
      { id: "servicios", nombre: "Servicios (luz/agua/internet)" },
      { id: "transporte", nombre: "Transporte / Envíos" },
      { id: "comida", nombre: "Comida" },
      { id: "materiales", nombre: "Materiales" },
      { id: "otros", nombre: "Otros gastos" },
    ],
    folios: { gasto: 0, conc: 0 },
  };

  /* -------------------- Helpers (misma UI que Inventarios) -------------------- */
  function hostParts() {
    const container = document.getElementById("moduleHost");
    let mod = container.querySelector(":scope>.module");
    if (!mod) {
      container.innerHTML = `
        <div class="module">
          <div class="subcol">
            <div class="card">
              <h2>Administración</h2>
              <div class="subbox" id="adm-subbox"></div>
            </div>
          </div>
          <div class="workcol card">
            <div class="tabs" id="adm-tabs"></div>
            <div id="adm-views"></div>
          </div>
        </div>`;
    }
    return {
      sub: container.querySelector("#adm-subbox"),
      tabs: container.querySelector("#adm-tabs"),
      views: container.querySelector("#adm-views"),
    };
  }
  function openTab(id, title, mountFn) {
    const { tabs, views } = hostParts();
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    views.querySelectorAll(".view").forEach((v) => (v.style.display = "none"));

    let tab = tabs.querySelector(`.tab[data-id="${id}"]`);
    let view = views.querySelector(`#view-${id}`);

    if (!tab) {
      tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab active";
      tab.dataset.id = id;
      tab.textContent = title;
      tabs.appendChild(tab);

      view = document.createElement("div");
      view.className = "view";
      view.id = `view-${id}`;
      views.appendChild(view);

      tab.onclick = () => {
        tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        views.querySelectorAll(".view").forEach((v) => (v.style.display = "none"));
        tab.classList.add("active");
        view.style.display = "block";
      };

      try {
        mountFn && mountFn(view);
      } catch (e) {
        console.error(e);
        view.innerHTML = `<div class="card"><p class="muted">Error al montar la hoja.</p></div>`;
      }
    }
    tab.classList.add("active");
    view.style.display = "block";
  }

  // Botonera de hoja (respeta reglas: Nuevo, Imprimir, Guardar/Editar)
  const HT = {
    mountToolbar(root, opts) {
      const bar = document.createElement("div");
      bar.className = "ht-toolbar";
      const left = document.createElement("div");
      left.className = "ht-left";

      const bNew = document.createElement("button");
      bNew.className = "ht-btn ht-btn-blue";
      bNew.textContent = "+ Nuevo " + (opts.docName || "documento");
      bNew.onclick = opts.onNew;
      left.appendChild(bNew);

      const bPrint = document.createElement("button");
      bPrint.className = "ht-btn";
      bPrint.textContent = "🖨️ Imprimir";
      bPrint.onclick = () => {
        if (root.dataset.saved !== "true") {
          alert("Debes guardar primero el documento para poder generar el PDF");
          return;
        }
        opts.onPrint && opts.onPrint();
      };

      const bSave = document.createElement("button");
      bSave.className = "ht-btn ht-btn-blue";
      bSave.textContent = "💾 Guardar";
      bSave.dataset.mode = "save";
      bSave.onclick = async () => {
        if (bSave.dataset.mode === "edit") {
          HT.setEditable(root, true);
          HT._toggle(bSave, true);
          root.dataset.saved = "false";
          return;
        }
        if (!confirm("¿Guardar este documento?")) return;
        const r = (await (opts.onSave ? opts.onSave() : true)) || {};
        if (r.ok) {
          HT.markSaved(root, r.folio || "");
          HT.setEditable(root, false);
          HT._toggle(bSave, false);
        }
      };

      bar.appendChild(left);
      bar.appendChild(bPrint);
      bar.appendChild(bSave);
      const old = root.querySelector(":scope>.ht-toolbar");
      if (old) old.remove();
      root.prepend(bar);
    },
    setEditable(root, on) {
      root.querySelectorAll("[data-edit]").forEach((el) => {
        if (on) {
          el.classList.remove("locked");
          el.removeAttribute("disabled");
        } else {
          el.classList.add("locked");
          el.setAttribute("disabled", "disabled");
        }
      });
    },
    markSaved(root, folio) {
      root.dataset.saved = "true";
      if (folio) root.dataset.folio = folio;
      alert(folio ? "Documento guardado · Folio " + folio : "Documento guardado");
    },
    _toggle(btn, isSave) {
      if (isSave) {
        btn.textContent = "💾 Guardar";
        btn.dataset.mode = "save";
      } else {
        btn.textContent = "✏️ Editar";
        btn.dataset.mode = "edit";
      }
    },
  };

  // Formato de dinero (acepta negativos; muestra $ en blur)
  function moneyFmt(n) {
    return "$ " + (Number(n || 0)).toFixed(2);
  }
  function moneyParse(s) {
    if (typeof s === "number") return s;
    let raw = String(s || "").replace(/\s/g, "");
    raw = raw.replace(/^\$/, "").replace(/,/g, "");
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  function ctaNombre(id) {
    const c = DB.admin.cuentas.find((x) => x.id === id);
    return c ? c.nombre : "—";
  }
  function ctaContNombre(id) {
    const c = DB.admin.cuentasContables.find((x) => x.id === id);
    return c ? c.nombre : "—";
  }

  /* ========================= SUBMENÚ IZQUIERDO ========================= */
  function drawSubmenu() {
    const { sub } = hostParts();
    sub.innerHTML = [
      `<button type="button" class="subbtn" data-act="gastos">💳 Gastos</button>`,
      `<button type="button" class="subbtn" data-act="conciliacion">🧾 Conciliación de Cajas</button>`,
      `<button type="button" class="subbtn" data-act="er">📈 Estado de Resultados</button>`,
      `<button type="button" class="subbtn" data-act="dash">📊 Dashboard</button>`,
    ].join("");

    sub.onclick = (ev) => {
      const b = ev.target.closest(".subbtn");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "gastos") return openGastos();
      if (act === "conciliacion") return openConciliacion();
      if (act === "er") return openER();
      if (act === "dash") return openDash();
    };

    // Abre por defecto
    openGastos();
  }

  /* ============================== GASTOS ============================== */
  function openGastos() {
    openTab("adm-gastos", "Gastos", (v) => {
      v.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";

      // Top: botón “+ Registrar gasto”
      const topbar = document.createElement("div");
      topbar.className = "ht-toolbar";
      const left = document.createElement("div");
      left.className = "ht-left";
      const bNew = document.createElement("button");
      bNew.className = "ht-btn ht-btn-blue";
      bNew.textContent = "+ Registrar gasto";
      bNew.onclick = () => newGasto();
      topbar.appendChild(left);
      topbar.appendChild(bNew);
      card.appendChild(topbar);

      // Filtros
      const g = document.createElement("div");
      g.className = "grid";
      g.innerHTML =
        `<div><label>Fecha inicio</label><input type="date"></div>` +
        `<div><label>Fecha fin</label><input type="date"></div>` +
        `<div><label>Tipo</label>
           <select>
             <option value="">TODOS</option>
             <option value="pagado">Pagado</option>
             <option value="por_pagar">Por pagar</option>
             <option value="recurrente">Recurrente</option>
           </select>
         </div>` +
        `<div>
           <label>Cuenta</label>
           <div style="display:flex;align-items:end;gap:8px">
             <select data-cta></select>
             <button class="ht-btn" data-buscar style="background:#0a3a74;color:#fff;border:1px solid #0a3a74">Buscar</button>
           </div>
         </div>`;
      card.appendChild(g);

      // llena cuentas
      const selCta = g.querySelector("select[data-cta]");
      selCta.innerHTML = `<option value="">Todas las cuentas</option>` + DB.admin.cuentas.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");

      // Tabla
      const tbl = document.createElement("table");
      tbl.className = "table";
      tbl.innerHTML =
        "<thead><tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>Cuenta pago</th><th>Cuenta contable</th><th>Monto</th><th>Estatus</th><th></th></tr></thead><tbody></tbody>";
      const tbody = tbl.querySelector("tbody");
      card.appendChild(tbl);

      function semaforo(g) {
        const okMonto = Number(g.monto || 0) !== 0;
        const okCC = !!g.cuentaContableId;
        return okMonto && okCC ? { icon: "🟢", label: "Completo" } : { icon: "🔴", label: "Incompleto" };
      }

      function pintar() {
        const [fi, ff, tipo] = g.querySelectorAll("input,select");
        tbody.innerHTML = "";

        DB.admin.gastos
          .slice()
          .sort((a, b) => (b.ts || 0) - (a.ts || 0))
          .forEach((x) => {
            let ok = true;
            if (fi.value) ok = ok && x.fecha >= fi.value;
            if (ff.value) ok = ok && x.fecha <= ff.value;
            if (tipo.value) ok = ok && x.tipo === tipo.value;
            if (selCta.value) ok = ok && x.cuentaId === selCta.value;
            if (!ok) return;

            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.onclick = () => openGastoForm(x.id);

            const s = semaforo(x);
            tr.innerHTML =
              `<td>${String(x.folio || 0).padStart(3, "0")}</td>` +
              `<td>${x.fecha || "—"}</td>` +
              `<td>${x.tipo || "—"}</td>` +
              `<td>${ctaNombre(x.cuentaId)}</td>` +
              `<td>${ctaContNombre(x.cuentaContableId)}</td>` +
              `<td><b style="color:#b45309">${moneyFmt(x.monto || 0)}</b></td>` +
              `<td>${s.label}</td>` +
              `<td style="text-align:right;font-size:18px">${s.icon}</td>`;
            tbody.appendChild(tr);
          });
      }

      g.querySelector("[data-buscar]").onclick = pintar;
      pintar();
      v.appendChild(card);
    });
  }

  function newGasto() {
    const g = {
      id: "GA" + Date.now(),
      folio: ++DB.admin.folios.gasto,
      ts: Date.now(),
      tipo: "pagado",
      fecha: hoyStr(),
      cuentaId: "",
      cuentaContableId: "",
      monto: 0,
      obs: "",
      bloqueado: false,
      evidencia: "",
      // por_pagar
      fechaDevengo: "",
      pagado: false,
      // recurrente
      periodicidad: "mensual",
      diaMes: 1,
      diaSemana: "viernes",
      cadaDias: 30,
    };
    DB.admin.gastos.push(g);
    saveDB(DB);
    openGastoForm(g.id);
  }

  function openGastoForm(id) {
    const g = DB.admin.gastos.find((x) => x.id === id);
    if (!g) return;

    openTab("adm-gasto-" + id, "Gasto " + String(g.folio).padStart(3, "0"), (v) => {
      v.innerHTML = "";
      const sheet = document.createElement("div");
      sheet.className = "ht-sheet";
      sheet.dataset.saved = g.bloqueado ? "true" : "false";
      sheet.dataset.folio = g.folio;

      HT.mountToolbar(sheet, {
        docName: "gasto",
        onNew: newGasto,
        onSave: () => {
          // validaciones
          if (!g.cuentaContableId) return alert("Selecciona la cuenta contable."), { ok: false };
          if (Number(g.monto || 0) === 0) return alert("Captura un monto distinto de cero (se permiten negativos)."), { ok: false };
          if (g.tipo === "pagado" && !g.cuentaId) return alert("En “Pagado”, la cuenta de pago es obligatoria."), { ok: false };
          g.bloqueado = true;
          saveDB(DB);
          return { ok: true, folio: "GA-" + String(g.folio).padStart(3, "0") };
        },
        onPrint: () => printGasto(g),
      });

      // Encabezado
      const headRow = document.createElement("div");
      headRow.style.display = "flex";
      headRow.style.gap = "12px";
      headRow.style.alignItems = "flex-start";

      const head = document.createElement("div");
      head.className = "grid";
      head.style.flex = "1";

      head.innerHTML =
        `<div><label>Tipo de gasto</label>
           <select data-edit data-tipo>
             <option value="pagado">Pagado</option>
             <option value="por_pagar">Por pagar</option>
             <option value="recurrente">Recurrente</option>
           </select>
         </div>` +
        `<div><label>Fecha</label><input data-edit type="date" value="${g.fecha || hoyStr()}"></div>` +
        `<div><label>Cuenta de pago</label>
           <select data-edit data-cta>
             <option value="">(Selecciona)</option>
             ${DB.admin.cuentas.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
           </select>
         </div>` +
        `<div><label>Cuenta contable</label>
           <select data-edit data-cc>
             <option value="">(Selecciona)</option>
             ${DB.admin.cuentasContables.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
           </select>
         </div>` +
        `<div style="grid-column:1/-1"><label>Observaciones</label><textarea data-edit rows="2"></textarea></div>` +
        `<div style="grid-column:1/-1"><label>Monto ($MXN)</label><input data-edit type="text" value="${moneyFmt(g.monto || 0)}" style="text-align:right;font-weight:800;color:#059669"></div>`;

      headRow.appendChild(head);

      // Semáforo
      const sem = document.createElement("div");
      sem.style.marginLeft = "auto";
      sem.style.display = "flex";
      sem.style.alignItems = "center";
      sem.style.gap = "8px";
      headRow.appendChild(sem);

      sheet.appendChild(headRow);

      // Variables por tipo
      const varsCard = document.createElement("div");
      varsCard.className = "card";
      const varsGrid = document.createElement("div");
      varsGrid.className = "grid";
      varsCard.appendChild(varsGrid);
      sheet.appendChild(varsCard);

      // Evidencia
      const ev = document.createElement("div");
      ev.className = "ht-toolbar";
      const evLbl = document.createElement("span");
      evLbl.textContent = "📷 Evidencia (ticket/factura)";
      const evIn = document.createElement("input");
      evIn.type = "file";
      evIn.accept = "image/*";
      const prev = document.createElement("div");
      ev.appendChild(evLbl);
      ev.appendChild(evIn);
      ev.appendChild(prev);
      sheet.appendChild(ev);

      v.appendChild(sheet);

      // binds
      const selTipo = head.querySelector("[data-tipo]");
      const inFecha = head.querySelector('input[type="date"]');
      const selCta = head.querySelector("[data-cta]");
      const selCC = head.querySelector("[data-cc]");
      const taObs = head.querySelector("textarea");
      const inMonto = head.querySelector('input[type="text"]');

      selTipo.value = g.tipo;
      selCta.value = g.cuentaId || "";
      selCC.value = g.cuentaContableId || "";
      taObs.value = g.obs || "";

      selTipo.onchange = () => {
        g.tipo = selTipo.value;
        saveDB(DB);
        renderVars();
        paintSem();
      };
      inFecha.onchange = () => (g.fecha = inFecha.value, saveDB(DB));
      selCta.onchange = () => (g.cuentaId = selCta.value, saveDB(DB), paintSem());
      selCC.onchange = () => (g.cuentaContableId = selCC.value, saveDB(DB), paintSem());
      taObs.oninput = () => (g.obs = taObs.value, saveDB(DB));
      inMonto.oninput = () => (g.monto = moneyParse(inMonto.value), saveDB(DB), paintSem());
      inMonto.onblur = () => (inMonto.value = moneyFmt(moneyParse(inMonto.value)));

      evIn.onchange = () => {
        if (evIn.files && evIn.files[0]) {
          const r = new FileReader();
          r.onload = (e) => {
            g.evidencia = e.target.result;
            saveDB(DB);
            paintPrev();
          };
          r.readAsDataURL(evIn.files[0]);
        }
      };

      function paintPrev() {
        prev.innerHTML = "";
        if (g.evidencia) {
          const im = document.createElement("img");
          im.src = g.evidencia;
          im.style.maxWidth = "220px";
          im.style.border = "1px solid #cbd5e1";
          prev.appendChild(im);
        }
      }
      paintPrev();

      function renderVars() {
        varsGrid.innerHTML = "";
        if (g.tipo === "pagado") {
          const note = document.createElement("div");
          note.innerHTML = "<b>Pagado:</b> La <u>cuenta de pago</u> es obligatoria. Se concilia en la hoja de <b>Conciliación</b>.";
          varsGrid.appendChild(note);
        }
        if (g.tipo === "por_pagar") {
          varsGrid.innerHTML +=
            `<div><label>Fecha compromiso / devengo</label><input data-edit type="date" value="${g.fechaDevengo || ""}"></div>` +
            `<div><label>Marcar como pagado</label><input data-edit type="checkbox" ${g.pagado ? "checked" : ""}></div>`;
          const [inDev, chPag] = varsGrid.querySelectorAll("input");
          inDev.onchange = () => (g.fechaDevengo = inDev.value, saveDB(DB));
          chPag.onchange = () => (g.pagado = chPag.checked, saveDB(DB));
        }
        if (g.tipo === "recurrente") {
          varsGrid.innerHTML +=
            `<div><label>Periodicidad</label>
               <select data-edit data-per>
                 <option value="mensual">Mensual (día del mes)</option>
                 <option value="quincenal">Quincenal (1/16)</option>
                 <option value="semanal">Semanal (día de la semana)</option>
                 <option value="cada_x_dias">Cada X días</option>
               </select>
             </div>`;
          const selPer = varsGrid.querySelector("[data-per]");
          selPer.value = g.periodicidad;
          selPer.onchange = () => (g.periodicidad = selPer.value, saveDB(DB), renderVars());

          if (g.periodicidad === "mensual") {
            varsGrid.innerHTML +=
              `<div><label>Día del mes (1–31)</label><input data-edit type="number" min="1" max="31" value="${g.diaMes || 1}"></div>`;
            const inDia = varsGrid.querySelector('input[type="number"]');
            inDia.oninput = () => (g.diaMes = parseInt(inDia.value || "1", 10), saveDB(DB));
          } else if (g.periodicidad === "quincenal") {
            const dQ = document.createElement("div");
            dQ.innerHTML = "Se generará el cargo los días <b>1</b> y <b>16</b> de cada mes.";
            varsGrid.appendChild(dQ);
          } else if (g.periodicidad === "semanal") {
            varsGrid.innerHTML +=
              `<div><label>Día de la semana</label>
                 <select data-edit data-dia>
                   ${["lunes","martes","miércoles","jueves","viernes","sábado","domingo"].map(d=>`<option>${d}</option>`).join("")}
                 </select>
               </div>`;
            const selDia = varsGrid.querySelector("[data-dia]");
            selDia.value = g.diaSemana || "viernes";
            selDia.onchange = () => (g.diaSemana = selDia.value, saveDB(DB));
          } else if (g.periodicidad === "cada_x_dias") {
            varsGrid.innerHTML +=
              `<div><label>Cada cuántos días</label><input data-edit type="number" min="1" value="${g.cadaDias || 30}"></div>`;
            const inX = varsGrid.querySelector('input[type="number"]');
            inX.oninput = () => (g.cadaDias = parseInt(inX.value || "1", 10), saveDB(DB));
          }

          const note = document.createElement("div");
          note.innerHTML = "Cada ocurrencia deberá <b>conciliarse</b> en la hoja de Conciliación cuando se pague.";
          varsGrid.appendChild(note);
        }
        lockUI(g.bloqueado);
      }

      function paintSem() {
        const okMonto = Number(g.monto || 0) !== 0;
        const okCC = !!g.cuentaContableId;
        const status = okMonto && okCC ? { emoji: "🟢", label: "Completo", color: "#16a34a" } : { emoji: "🔴", label: "Incompleto", color: "#ef4444" };
        sem.innerHTML = `<span style="font-size:20px">${status.emoji}</span><b style="color:${status.color}">${status.label}</b>`;
      }

      function lockUI(ro) {
        sheet.querySelectorAll("[data-edit]").forEach((el) => {
          if (ro) {
            el.setAttribute("disabled", "disabled");
            el.classList.add("locked");
          } else {
            el.removeAttribute("disabled");
            el.classList.remove("locked");
          }
        });
        sheet.dataset.saved = ro ? "true" : "false";
      }

      renderVars();
      paintSem();
      lockUI(g.bloqueado);

      function printGasto(g) {
        const w = window.open("", "_blank", "width=840,height=900");
        if (!w) return alert("Permite pop-ups.");
        const css =
          "@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} h1{color:#0a2c4c} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:4px 6px} thead tr{background:#eef2ff}";
        const H = [];
        H.push(`<html><head><meta charset="utf-8"><style>${css}</style><title>GA-${String(g.folio).padStart(3, "0")}</title></head><body>`);
        H.push(`<h1>Gasto <span style="color:#b91c1c">GA-${String(g.folio).padStart(3, "0")}</span></h1>`);
        H.push(`<p><b>Fecha:</b> ${g.fecha} · <b>Tipo:</b> ${g.tipo}</p>`);
        H.push(`<p><b>Cuenta pago:</b> ${ctaNombre(g.cuentaId)} · <b>Cuenta contable:</b> ${ctaContNombre(g.cuentaContableId)}</p>`);
        H.push(`<p><b>Monto:</b> ${moneyFmt(g.monto || 0)} · <b>Estatus:</b> ${(Number(g.monto || 0) !== 0 && g.cuentaContableId) ? "Completo" : "Incompleto"}</p>`);
        if (g.evidencia) H.push(`<h3>Evidencia</h3><img src="${g.evidencia}" style="max-width:100%;max-height:320px;border:1px solid #ccc">`);
        H.push("</body></html>");
        w.document.write(H.join(""));
        w.document.close();
        try { w.focus(); w.print(); } catch (e) {}
      }
    });
  }

  /* ======================= CONCILIACIÓN DE CAJAS ======================= */
  function openConciliacion() {
    openTab("adm-conc", "Conciliación de Cajas", (v) => {
      v.innerHTML = "";
      const sheet = document.createElement("div");
      sheet.className = "ht-sheet";
      sheet.dataset.saved = "false";

      HT.mountToolbar(sheet, {
        docName: "conciliación",
        onNew: openConciliacion,
        onSave: () => ({ ok: true }), // solo bloquea edición (hoja de trabajo)
        onPrint: () => window.print(),
      });

      const top = document.createElement("div");
      top.className = "grid";
      top.innerHTML =
        `<div><label>Cuenta</label>
           <select data-edit data-cta>
             ${DB.admin.cuentas.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
           </select>
         </div>` +
        `<div><label>Desde</label><input data-edit type="date" ></div>` +
        `<div><label>Hasta</label><input data-edit type="date" ></div>` +
        `<div style="display:flex;align-items:end;justify-content:flex-end">
            <span class="pill" data-est>🟡 Por conciliar</span>
         </div>`;
      const selCta = top.querySelector("[data-cta]");
      const inA = top.querySelectorAll('input[type="date"]')[0];
      const inB = top.querySelectorAll('input[type="date"]')[1];
      const est = top.querySelector("[data-est]");
      sheet.appendChild(top);

      const chips = document.createElement("div");
      chips.className = "ht-toolbar";
      sheet.appendChild(chips);

      // tablas
      const dIn = document.createElement("div");
      dIn.className = "card";
      dIn.innerHTML = "<h2>Ingresos del periodo</h2>";
      const tIn = document.createElement("table");
      tIn.className = "table";
      tIn.innerHTML = "<thead><tr><th>Fecha</th><th>Concepto</th><th>Monto ($)</th></tr></thead><tbody></tbody>";
      const tbIn = tIn.querySelector("tbody");
      dIn.appendChild(tIn);

      const dEg = document.createElement("div");
      dEg.className = "card";
      dEg.innerHTML = "<h2>Egresos (gastos pagados) del periodo</h2>";
      const tEg = document.createElement("table");
      tEg.className = "table";
      tEg.innerHTML = "<thead><tr><th>Fecha</th><th>Cuenta contable</th><th>Monto ($)</th></tr></thead><tbody></tbody>";
      const tbEg = tEg.querySelector("tbody");
      dEg.appendChild(tEg);

      const barra = document.createElement("div");
      barra.className = "ht-toolbar";
      const l = document.createElement("div");
      l.className = "ht-left";
      const wrap = document.createElement("div");
      wrap.innerHTML = `<label>Saldo real contado/estado bancario</label><input data-edit type="text" placeholder="$ 0.00" style="margin-left:8px">`;
      l.appendChild(wrap);
      barra.appendChild(l);
      sheet.appendChild(dIn);
      sheet.appendChild(dEg);
      sheet.appendChild(barra);

      v.appendChild(sheet);

      const inReal = wrap.querySelector('input[type="text"]');

      function run() {
        const cta = selCta.value;
        const a = inA.value || "0000-01-01";
        const b = inB.value || "9999-12-31";

        tbIn.innerHTML = "";
        tbEg.innerHTML = "";
        chips.innerHTML = "";

        // saldo inicial (última conciliación anterior)
        const prev = DB.admin.conciliaciones
          .filter((c) => c.cuentaId === cta && c.hasta && c.hasta < a)
          .sort((x, y) => (y.hasta || "").localeCompare(x.hasta || ""))[0];
        const saldoInicial = prev ? Number(prev.saldoReal || 0) : 0;

        // ingresos
        let sumIn = 0;
        (DB.admin.ingresos || [])
          .filter((m) => m.cuentaId === cta && m.fecha >= a && m.fecha <= b)
          .forEach((m) => {
            sumIn += Number(m.monto || 0);
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${m.fecha || ""}</td><td>${escapeHTML(m.concepto || "Ingreso")}</td><td style="text-align:right">${f2(m.monto || 0)}</td>`;
            tbIn.appendChild(tr);
          });

        // egresos (gastos pagados)
        let sumEg = 0;
        DB.admin.gastos
          .filter((g) => g.tipo === "pagado" && g.cuentaId === cta && g.fecha >= a && g.fecha <= b)
          .forEach((g) => {
            sumEg += Number(g.monto || 0);
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${g.fecha || ""}</td><td>${escapeHTML(ctaContNombre(g.cuentaContableId))}</td><td style="text-align:right">${f2(g.monto || 0)}</td>`;
            tbEg.appendChild(tr);
          });

        const esperado = saldoInicial + sumIn - sumEg;

        function chip(txt) {
          const s = document.createElement("span");
          s.className = "pill";
          s.textContent = txt;
          return s;
        }
        chips.appendChild(chip("Saldo inicial: $ " + f2(saldoInicial)));
        chips.appendChild(chip("Ingresos: $ " + f2(sumIn)));
        chips.appendChild(chip("Egresos: $ " + f2(sumEg)));
        chips.appendChild(chip("Saldo esperado: $ " + f2(esperado)));

        function updateSem() {
          const real = moneyParse(inReal.value || "0");
          const dif = real - esperado;
          if (Math.abs(dif) < 0.000001) {
            est.textContent = "🟢 Conciliado";
          } else {
            est.textContent = "🟡 Por conciliar";
          }
        }
        inReal.oninput = updateSem;
        inReal.onblur = () => (inReal.value = moneyFmt(moneyParse(inReal.value)), updateSem());
        updateSem();

        // Guardado (bloquea edición y crea folio)
        sheet.querySelector(".ht-btn.ht-btn-blue").onclick = () => {
          const real = moneyParse(inReal.value || "0");
          const dif = real - esperado;
          const folio = ++DB.admin.folios.conc;

          const conc = {
            id: "CI" + Date.now(),
            folio,
            cuentaId: cta,
            desde: a,
            hasta: b,
            saldoInicial,
            ingresos: sumIn,
            egresos: sumEg,
            saldoEsperado: esperado,
            saldoReal: real,
            diferencia: dif,
            bloqueado: true,
          };
          DB.admin.conciliaciones.push(conc);
          saveDB(DB);

          sheet.dataset.saved = "true";
          HT.setEditable(sheet, false);
          alert("Conciliación guardada. Folio " + String(folio).padStart(3, "0"));
        };
      }

      selCta.onchange = run;
      inA.onchange = run;
      inB.onchange = run;
      run();

      HT.setEditable(sheet, true);
    });
  }

  /* =================== ESTADO DE RESULTADOS (semanal) =================== */
  function openER() {
    openTab("adm-er", "Estado de Resultados", (v) => {
      v.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<h2>Estado de Resultados (semana)</h2>";

      const hoy = new Date();
      const d = (hoy.getDay() + 6) % 7;
      const lun = new Date(hoy);
      lun.setDate(hoy.getDate() - d);
      const dom = new Date(lun);
      dom.setDate(lun.getDate() + 6);
      const fISO = (dt) => dt.toISOString().slice(0, 10);

      let ventas = 0;
      if (DB.ventas && Array.isArray(DB.ventas)) {
        DB.ventas
          .filter((n) => n.fecha >= fISO(lun) && n.fecha <= fISO(dom))
          .forEach((n) => (ventas += parseFloat(n.total || 0)));
      }

      let gastos = 0;
      DB.admin.gastos
        .filter((g) => g.fecha >= fISO(lun) && g.fecha <= fISO(dom))
        .forEach((g) => (gastos += parseFloat(g.monto || 0)));

      const util = ventas - gastos;

      const tb = document.createElement("table");
      tb.className = "table";
      tb.innerHTML =
        "<thead><tr><th>Concepto</th><th>Monto ($MXN)</th></tr></thead>" +
        `<tbody>
           <tr><td>Ventas (semana)</td><td style="text-align:right">$ ${f2(ventas)}</td></tr>
           <tr><td>Gastos (semana)</td><td style="text-align:right">$ ${f2(gastos)}</td></tr>
         </tbody>
         <tfoot>
           <tr><th style="text-align:right">Utilidad</th><th style="text-align:right">$ ${f2(util)}</th></tr>
         </tfoot>`;
      card.appendChild(tb);
      v.appendChild(card);
    });
  }

  /* ========================= DASHBOARD ADMIN ========================= */
  function openDash() {
    openTab("adm-dash", "Dashboard", (v) => {
      v.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<h2>Dashboard administrativo</h2>";

      const hoy = new Date();
      const d = (hoy.getDay() + 6) % 7;
      const lun = new Date(hoy);
      lun.setDate(hoy.getDate() - d);
      const dom = new Date(lun);
      dom.setDate(lun.getDate() + 6);
      const fISO = (dt) => dt.toISOString().slice(0, 10);

      let ventas = 0;
      if (DB.ventas && Array.isArray(DB.ventas)) {
        DB.ventas
          .filter((n) => n.fecha >= fISO(lun) && n.fecha <= fISO(dom))
          .forEach((n) => (ventas += parseFloat(n.total || 0)));
      }
      let gastos = 0;
      DB.admin.gastos
        .filter((g) => g.fecha >= fISO(lun) && g.fecha <= fISO(dom))
        .forEach((g) => (gastos += parseFloat(g.monto || 0)));
      const util = ventas - gastos;

      const kpis = document.createElement("div");
      kpis.className = "ht-toolbar";
      kpis.innerHTML =
        `<div class="kpi">Ventas: $ ${f2(ventas)}</div>` +
        `<div class="kpi">Gastos: $ ${f2(gastos)}</div>` +
        `<div class="kpi">Utilidad: $ ${f2(util)}</div>`;
      card.appendChild(kpis);
      v.appendChild(card);
    });
  }

  /* ======================= Render raíz del módulo ======================= */
  function renderAdministracion(host) {
    hostParts();
    drawSubmenu();
  }

  // Export
  global.renderAdministracion = renderAdministracion;
})(window);
/* =====================================================================
   FIN MÓDULO ADMINISTRACIÓN · v1.0
   ===================================================================== */
