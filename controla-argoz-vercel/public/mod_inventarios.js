/* =====================================================================
   INICIO MÓDULO INVENTARIO · v1.7 (drop-in para tu index actual)
   Compatible con: index.html que llama renderInventarios(host)
   – Usa utilidades ya definidas en index: saveDB, hoyStr, f2, escapeHTML
   – No requiere importar nada extra
   ===================================================================== */
(function (global) {
  "use strict";

  /* ---------- Validaciones de utilidades del index ---------- */
  if (typeof global.saveDB !== "function") {
    global.saveDB = function (db) {
      localStorage.setItem("erp_taller_db", JSON.stringify(db || {}));
    };
  }
  if (typeof global.hoyStr !== "function") {
    global.hoyStr = function () {
      return new Date().toISOString().slice(0, 10);
    };
  }
  if (typeof global.f2 !== "function") {
    global.f2 = function (x) {
      return (parseFloat(x || 0)).toFixed(2);
    };
  }
  if (typeof global.escapeHTML !== "function") {
    global.escapeHTML = function (s) {
      return (s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    };
  }

  /* ---------- DB Bootstrap mínimo ---------- */
  const DB = (global.DB = global.DB || {});
  DB.folios = DB.folios || { entrada: 0, salida: 0, traspaso: 0 };
  DB.movInv = DB.movInv || { entradas: [], salidas: [], traspasos: [], conciliaciones: [] };
  DB.stock = DB.stock || { GEN: {}, PROD: {}, ART: {}, COB: {} };

  /* ---------- Catálogos ---------- */
  const ALM = [
    { id: "GEN", nombre: "ALMACEN GENERAL PLATA" },
    { id: "PROD", nombre: "ALMACEN PRODUCCIÓN" },
    { id: "ART", nombre: "ALMACEN PLATA ARTURO" },
    { id: "COB", nombre: "ALMACEN PLATA POR COBRAR" },
  ];
  const MAT = [
    { id: "999", nombre: "Plata .999 (fina)" },
    { id: "925", nombre: "Plata .925 (General sólida)" }, // <- cambio solicitado
    { id: "LMD", nombre: "Plata .925 limalla dura" },
    { id: "LMN", nombre: "Plata .925 limalla negra" },
    { id: "OTRO", nombre: "Plata .925 de otro tipo" },
    { id: "TERM", nombre: "Plata .925 producto terminado" },
    { id: "ALC", nombre: "Plata por Aleación" },
  ];
  const nAlm = (id) => (ALM.find((a) => a.id === id) || { nombre: id }).nombre;
  const nMat = (id) => (MAT.find((m) => m.id === id) || { nombre: id }).nombre;

  /* ---------- Inventario helpers ---------- */
  function getInv(alm, mat) {
    return parseFloat((DB.stock[alm] || {})[mat] || 0);
  }
  function setInv(alm, mat, g) {
    DB.stock[alm] = DB.stock[alm] || {};
    DB.stock[alm][mat] = parseFloat(g) || 0;
  }
  function addInv(alm, mat, g) {
    setInv(alm, mat, getInv(alm, mat) + (parseFloat(g) || 0));
  }
  function subInv(alm, mat, g) {
    const cur = getInv(alm, mat);
    const q = parseFloat(g) || 0;
    if (cur < q) throw new Error("Inventario insuficiente de " + nMat(mat) + " en " + nAlm(alm));
    setInv(alm, mat, cur - q);
  }
  function nextFolio(tp) {
    if (tp === "EN") {
      DB.folios.entrada++;
      saveDB(DB);
      return "EN-" + String(DB.folios.entrada).padStart(3, "0");
    }
    if (tp === "SA") {
      DB.folios.salida++;
      saveDB(DB);
      return "SA-" + String(DB.folios.salida).padStart(3, "0");
    }
    if (tp === "TR") {
      DB.folios.traspaso++;
      saveDB(DB);
      return "TR-" + String(DB.folios.traspaso).padStart(3, "0");
    }
    if (tp === "CI") return "CI-" + String((DB.movInv.conciliaciones.length || 0) + 1).padStart(3, "0");
    return "XX-000";
  }

  /* ---------- CSS compacto del módulo (inocuo) ---------- */
  (function injectCSS() {
    const id = "inv-ui-compact";
    if (document.getElementById(id)) return;
    const css = `
    .module{font-size:13px}
    .module .subbtn{font-size:13px;padding:6px 8px}
    .module .tab{font-size:12px;padding:4px 8px}
    .status-pill{display:inline-flex;gap:6px;align-items:center;font-weight:700;padding:4px 10px;border-radius:999px}
    .status-ok{background:#e8f7ec;color:#166534}.status-warn{background:#fff7ed;color:#b45309}
    .dot{width:10px;height:10px;border-radius:999px}.dot.ok{background:#16a34a}.dot.warn{background:#f59e0b}
    .chip-total{display:inline-flex;gap:8px;background:#ecfdf5;color:#065f46;border-radius:999px;padding:6px 12px;font-weight:700}
    `;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ---------- Submenú + Workarea seguro ---------- */
  function hostParts() {
    // Estructura de tu index: #moduleHost ya existe
    // Creamos columnas solo si no existen
    const container = document.getElementById("moduleHost");
    let mod = container.querySelector(":scope>.module");
    if (!mod) {
      container.innerHTML = `
        <div class="module">
          <div class="subcol">
            <div class="card">
              <h2>Inventarios</h2>
              <div class="subbox" id="inv-subbox"></div>
            </div>
          </div>
          <div class="workcol card">
            <div class="tabs" id="inv-tabs"></div>
            <div id="inv-views"></div>
          </div>
        </div>`;
    }
    return {
      sub: container.querySelector("#inv-subbox"),
      tabs: container.querySelector("#inv-tabs"),
      views: container.querySelector("#inv-views"),
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

  /* ---------- Barra de hoja de trabajo (botones) ---------- */
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

  /* ---------- Tabla de líneas genérica ---------- */
  function linesTable(cfg) {
    const wrap = document.createElement("div");
    const tb = document.createElement("table");
    tb.className = "table";
    tb.innerHTML =
      '<thead><tr><th style="width:6%">#</th><th style="width:34%">Material</th><th style="width:40%">Descripción</th><th style="width:20%">Gramos</th></tr></thead><tbody></tbody>';
    const body = tb.querySelector("tbody");
    wrap.appendChild(tb);

    function paint() {
      body.innerHTML = "";
      cfg.lineas.forEach((li, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${idx + 1}</td>`;

        const tdM = document.createElement("td");
        const sel = document.createElement("select");
        MAT.forEach((m) => {
          const op = document.createElement("option");
          op.value = m.id;
          op.textContent = m.nombre + (m.id === "TERM" ? " (solo ventas)" : "");
          sel.appendChild(op);
        });
        sel.value = li.materialId;
        sel.disabled = !cfg.editable;
        sel.onchange = () => {
          li.materialId = sel.value;
          if (li.materialId === "TERM") {
            alert("Producto terminado solo se usa en Ventas.");
            li.materialId = "925";
            sel.value = "925";
          }
          cfg.onChange && cfg.onChange();
          saveDB(DB);
        };
        tdM.appendChild(sel);
        tr.appendChild(tdM);

        const tdD = document.createElement("td");
        const tx = document.createElement("input");
        tx.type = "text";
        tx.value = li.detalle || "";
        tx.style.width = "100%";
        if (cfg.editable) tx.setAttribute("data-edit", "");
        else {
          tx.classList.add("locked");
          tx.setAttribute("disabled", "disabled");
        }
        tx.oninput = () => {
          li.detalle = tx.value;
          saveDB(DB);
        };
        tdD.appendChild(tx);
        tr.appendChild(tdD);

        const tdG = document.createElement("td");
        const gr = document.createElement("input");
        gr.type = "number";
        gr.step = "0.01";
        gr.min = "0";
        gr.value = li.gramos || 0;
        gr.style.width = "100%";
        gr.style.textAlign = "right";
        if (cfg.editable) gr.setAttribute("data-edit", "");
        else {
          gr.classList.add("locked");
          gr.setAttribute("disabled", "disabled");
        }
        gr.oninput = () => {
          li.gramos = parseFloat(gr.value || 0);
          cfg.onChange && cfg.onChange();
          saveDB(DB);
        };
        tdG.appendChild(gr);
        tr.appendChild(tdG);

        body.appendChild(tr);
      });
    }
    paint();

    if (cfg.editable) {
      const act = document.createElement("div");
      act.className = "ht-toolbar";
      const add = document.createElement("button");
      add.className = "ht-btn";
      add.textContent = "+ Agregar línea";
      const del = document.createElement("button");
      del.className = "ht-btn";
      del.textContent = "– Eliminar última";
      add.onclick = () => {
        cfg.lineas.push({ materialId: "925", detalle: "", gramos: 0 });
        paint();
        cfg.onChange && cfg.onChange();
        saveDB(DB);
      };
      del.onclick = () => {
        if (cfg.lineas.length > 1) cfg.lineas.pop();
        paint();
        cfg.onChange && cfg.onChange();
        saveDB(DB);
      };
      act.appendChild(add);
      act.appendChild(del);
      wrap.appendChild(act);
    }
    return wrap;
  }

  /* =================== SUBMENÚ =================== */
  function drawSubmenu() {
    const { sub } = hostParts();
    sub.innerHTML = [
      `<button type="button" class="subbtn" data-act="consultar">🔎 Consultar</button>`,
      `<button type="button" class="subbtn" data-act="existencias">📦 Existencias</button>`,
      `<button type="button" class="subbtn" data-act="entrada">📥 Entrada</button>`,
      `<button type="button" class="subbtn" data-act="salida">📤 Salida</button>`,
      `<button type="button" class="subbtn" data-act="traspasos">🔁 Traspasos</button>`,
      `<button type="button" class="subbtn" data-act="conciliar">📋 Hacer inventario (conciliar)</button>`,
    ].join("");

    sub.onclick = (ev) => {
      const b = ev.target.closest(".subbtn");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "consultar") return openConsulta();
      if (act === "existencias") return openExistencias();
      if (act === "entrada") return openEntrada();
      if (act === "salida") return openSalida();
      if (act === "traspasos") return openTraspasosHome();
      if (act === "conciliar") return openConciliacion();
    };
  }

  /* =================== ENTRADA =================== */
  function openEntrada() {
    const doc = {
      id: "EN" + Date.now(),
      folio: nextFolio("EN"),
      fecha: hoyStr(),
      motivo: "COMPRA",
      destino: "GEN",
      comentario: "",
      lineas: [
        { materialId: "925", detalle: "", gramos: 0 },
        { materialId: "999", detalle: "", gramos: 0 },
        { materialId: "LMD", detalle: "", gramos: 0 },
        { materialId: "LMN", detalle: "", gramos: 0 },
        { materialId: "ALC", detalle: "", gramos: 0 },
      ],
      total: 0,
    };
    openTab(doc.id, "Entrada " + doc.folio, (v) => mountEntrada(v, doc));
  }
  function mountEntrada(host, doc) {
    host.innerHTML = "";
    const sheet = document.createElement("div");
    sheet.className = "ht-sheet";
    sheet.dataset.saved = "false";
    sheet.dataset.folio = doc.folio;

    const totalWrap = document.createElement("div");
    totalWrap.className = "right";
    const totalEl = document.createElement("div");
    totalEl.className = "money";
    totalEl.textContent = "0.00 g";
    totalWrap.appendChild(totalEl);
    const setTotal = (g) => (totalEl.textContent = f2(g) + " g");

    HT.mountToolbar(sheet, {
      docName: "entrada",
      onNew: openEntrada,
      onSave: () => {
        if (doc.destino !== "GEN") {
          alert("Por ahora las Entradas solo van a ALMACEN GENERAL PLATA.");
          return false;
        }
        let t = 0;
        doc.lineas.forEach((li) => {
          const g = parseFloat(li.gramos || 0);
          if (g <= 0) return;
          if (li.materialId === "TERM") {
            alert("Producto terminado solo se usa en Ventas.");
            return false;
          }
          if (li.materialId === "ALC") addInv("GEN", "925", g);
          else addInv("GEN", li.materialId, g);
          t += g;
        });
        doc.total = t;
        DB.movInv.entradas.push(JSON.parse(JSON.stringify(doc)));
        saveDB(DB);
        return { ok: true, folio: doc.folio };
      },
      onPrint: () => printEntrada(doc),
    });

    const enc = document.createElement("div");
    enc.className = "grid";
    enc.innerHTML =
      `<div><label>Folio</label><input value="${doc.folio}" disabled></div>` +
      `<div><label>Fecha</label><input data-edit type="date" value="${doc.fecha}"></div>` +
      `<div><label>Motivo</label><select data-edit><option>COMPRA</option><option>DONACION</option><option>PRESTAMO</option><option>REPOSICIÓN</option></select></div>` +
      `<div><label>Destino</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>` +
      `<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>`;
    sheet.appendChild(enc);

    enc.querySelector('input[type="date"]').onchange = (e) => {
      doc.fecha = e.target.value;
      saveDB(DB);
    };
    const selMot = enc.querySelector("select[data-edit]");
    selMot.value = doc.motivo;
    selMot.onchange = (e) => {
      doc.motivo = e.target.value;
      saveDB(DB);
    };
    const tx = enc.querySelector("textarea");
    tx.value = doc.comentario;
    tx.oninput = (e) => {
      doc.comentario = e.target.value;
      saveDB(DB);
    };

    sheet.appendChild(
      linesTable({
        lineas: doc.lineas,
        editable: true,
        onChange: () => {
          let s = 0;
          doc.lineas.forEach((li) => (s += parseFloat(li.gramos || 0)));
          setTotal(s);
        },
      })
    );

    sheet.appendChild(totalWrap);
    HT.setEditable(sheet, true);
    host.appendChild(sheet);
  }
  function printEntrada(doc) {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return alert("Permite pop-ups.");
    const css =
      "@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .folio{color:#b91c1c;font-weight:800}";
    const html = [];
    html.push(`<html><head><meta charset="utf-8"><style>${css}</style><title>${doc.folio}</title></head><body>`);
    html.push(`<h2>Entrada <span class="folio">${doc.folio}</span></h2>`);
    html.push(`<p><b>Fecha:</b> ${doc.fecha} · <b>Destino:</b> ${nAlm("GEN")} · <b>Motivo:</b> ${doc.motivo}</p>`);
    html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody>');
    (doc.lineas || []).forEach((li, i) => {
      if ((parseFloat(li.gramos) || 0) <= 0) return;
      html.push(`<tr><td>${i + 1}</td><td>${nMat(li.materialId)}</td><td>${escapeHTML(li.detalle || "")}</td><td>${f2(li.gramos)}</td></tr>`);
    });
    html.push("</tbody></table></body></html>");
    w.document.write(html.join(""));
    w.document.close();
    try {
      w.focus();
      w.print();
    } catch (e) {}
  }

  /* =================== SALIDA =================== */
  function openSalida() {
    const doc = {
      id: "SA" + Date.now(),
      folio: nextFolio("SA"),
      fecha: hoyStr(),
      origen: "GEN",
      comentario: "",
      lineas: [
        { materialId: "925", detalle: "", gramos: 0 },
        { materialId: "LMD", detalle: "", gramos: 0 },
        { materialId: "LMN", detalle: "", gramos: 0 },
        { materialId: "OTRO", detalle: "", gramos: 0 },
        { materialId: "999", detalle: "", gramos: 0 },
      ],
      total: 0,
    };
    openTab(doc.id, "Salida " + doc.folio, (v) => mountSalida(v, doc));
  }
  function mountSalida(host, doc) {
    host.innerHTML = "";
    const sheet = document.createElement("div");
    sheet.className = "ht-sheet";
    sheet.dataset.saved = "false";
    sheet.dataset.folio = doc.folio;

    const totalWrap = document.createElement("div");
    totalWrap.className = "right";
    const totalEl = document.createElement("div");
    totalEl.className = "money";
    totalEl.textContent = "0.00 g";
    totalWrap.appendChild(totalEl);
    const setTotal = (g) => (totalEl.textContent = f2(g) + " g");

    HT.mountToolbar(sheet, {
      docName: "salida",
      onNew: openSalida,
      onSave: () => {
        if (doc.origen !== "GEN") {
          alert("Por ahora las Salidas solo salen de ALMACEN GENERAL PLATA.");
          return false;
        }
        let t = 0;
        try {
          doc.lineas.forEach((li) => {
            const g = parseFloat(li.gramos || 0);
            if (g <= 0) return;
            if (li.materialId === "TERM") throw new Error("Producto terminado solo se usa en Ventas.");
            subInv("GEN", li.materialId, g);
            t += g;
          });
        } catch (err) {
          alert(err.message);
          return false;
        }
        doc.total = t;
        DB.movInv.salidas.push(JSON.parse(JSON.stringify(doc)));
        saveDB(DB);
        return { ok: true, folio: doc.folio };
      },
      onPrint: () => printSalida(doc),
    });

    const enc = document.createElement("div");
    enc.className = "grid";
    enc.innerHTML =
      `<div><label>Folio</label><input value="${doc.folio}" disabled></div>` +
      `<div><label>Fecha</label><input data-edit type="date" value="${doc.fecha}"></div>` +
      `<div><label>Origen</label><select disabled><option value="GEN" selected>ALMACEN GENERAL PLATA</option></select><div class="muted">Regla: solo GEN</div></div>` +
      `<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>`;
    sheet.appendChild(enc);

    enc.querySelector('input[type="date"]').onchange = (e) => {
      doc.fecha = e.target.value;
      saveDB(DB);
    };
    const tx = enc.querySelector("textarea");
    tx.value = doc.comentario;
    tx.oninput = (e) => {
      doc.comentario = e.target.value;
      saveDB(DB);
    };

    sheet.appendChild(
      linesTable({
        lineas: doc.lineas,
        editable: true,
        onChange: () => {
          let s = 0;
          doc.lineas.forEach((li) => (s += parseFloat(li.gramos || 0)));
          setTotal(s);
        },
      })
    );

    sheet.appendChild(totalWrap);
    HT.setEditable(sheet, true);
    host.appendChild(sheet);
  }
  function printSalida(doc) {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return alert("Permite pop-ups.");
    const css =
      "@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .folio{color:#b91c1c;font-weight:800}";
    const html = [];
    html.push(`<html><head><meta charset="utf-8"><style>${css}</style><title>${doc.folio}</title></head><body>`);
    html.push(`<h2>Salida <span class="folio">${doc.folio}</span></h2>`);
    html.push(`<p><b>Fecha:</b> ${doc.fecha} · <b>Origen:</b> ${nAlm("GEN")} · <b>Total:</b> ${f2(doc.total)} g</p>`);
    html.push('<table><thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody>');
    (doc.lineas || []).forEach((li, i) => {
      if ((parseFloat(li.gramos) || 0) <= 0) return;
      html.push(`<tr><td>${i + 1}</td><td>${nMat(li.materialId)}</td><td>${escapeHTML(li.detalle || "")}</td><td>${f2(li.gramos)}</td></tr>`);
    });
    html.push("</tbody></table></body></html>");
    w.document.write(html.join(""));
    w.document.close();
    try {
      w.focus();
      w.print();
    } catch (e) {}
  }

  /* =================== TRASPASOS (Home + nuevo) =================== */
  function openTraspasosHome() {
    openTab("TRHOME", "Traspasos", mountTRHome);
  }
  function mountTRHome(host) {
    host.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    const bar = document.createElement("div");
    bar.className = "ht-toolbar";
    const bN = document.createElement("button");
    bN.className = "ht-btn ht-btn-blue";
    bN.textContent = "+ Nuevo traspaso (salida)";
    bN.onclick = openNuevoTraspaso;
    bar.appendChild(bN);
    card.appendChild(bar);
    host.appendChild(card);

    const pend = DB.movInv.traspasos.filter((t) => !t.cerrado).sort((a, b) => b.num - a.num);
    const secP = document.createElement("div");
    secP.className = "card";
    secP.innerHTML = "<h2>Traspasos pendientes</h2>";
    if (pend.length === 0) secP.innerHTML += '<p class="muted">Sin pendientes.</p>';
    pend.forEach((t) => {
      const row = document.createElement("div");
      row.className = "ht-toolbar";
      row.innerHTML = `<span class="ht-btn">${t.folio}</span><span>${nAlm(t.origen)} → ${nAlm(t.destino)} · ${t.fecha}</span>`;
      const bA = document.createElement("button");
      bA.className = "ht-btn";
      bA.textContent = "Abrir";
      bA.onclick = () => openTraspasoDetalle(t.id);
      const bOk = document.createElement("button");
      bOk.className = "ht-btn ht-btn-blue";
      bOk.textContent = "Aceptar en destino";
      bOk.onclick = () => aceptarTraspaso(t.id);
      row.appendChild(bA);
      row.appendChild(bOk);
      secP.appendChild(row);
    });
    host.appendChild(secP);

    const cerr = DB.movInv.traspasos.filter((t) => !!t.cerrado).sort((a, b) => b.num - a.num);
    const secC = document.createElement("div");
    secC.className = "card";
    secC.innerHTML = "<h2>Traspasos cerrados</h2>";
    if (cerr.length === 0) secC.innerHTML += '<p class="muted">Aún no hay cerrados.</p>';
    host.appendChild(secC);
  }
  function openNuevoTraspaso() {
    const t = {
      id: "TR" + Date.now(),
      num: DB.folios.traspaso + 1,
      folio: nextFolio("TR"),
      fecha: hoyStr(),
      origen: "GEN",
      destino: "PROD",
      comentario: "",
      lineas: [
        { materialId: "925", detalle: "", gramos: 0 },
        { materialId: "LMD", detalle: "", gramos: 0 },
        { materialId: "LMN", detalle: "", gramos: 0 },
        { materialId: "OTRO", detalle: "", gramos: 0 },
      ],
      total: 0,
      cerrado: false,
    };
    openTab(t.id, "Traspaso " + t.folio, (v) => mountTraspaso(v, t));
  }
  function mountTraspaso(host, t) {
    host.innerHTML = "";
    const sheet = document.createElement("div");
    sheet.className = "ht-sheet";
    sheet.dataset.saved = "false";
    sheet.dataset.folio = t.folio;

    const totalWrap = document.createElement("div");
    totalWrap.className = "right";
    const totalEl = document.createElement("div");
    totalEl.className = "money";
    totalEl.textContent = "0.00 g";
    totalWrap.appendChild(totalEl);
    const setTotal = (g) => (totalEl.textContent = f2(g) + " g");

    HT.mountToolbar(sheet, {
      docName: "traspaso (salida)",
      onNew: openNuevoTraspaso,
      onSave: () => {
        let total = 0;
        try {
          t.lineas.forEach((li) => {
            const g = parseFloat(li.gramos || 0);
            if (g <= 0) return;
            subInv(t.origen, li.materialId, g);
            total += g;
          });
        } catch (e) {
          alert(e.message);
          return false;
        }
        t.total = total;
        DB.movInv.traspasos.push(JSON.parse(JSON.stringify(t)));
        saveDB(DB);
        return { ok: true, folio: t.folio };
      },
      onPrint: () => {},
    });

    const enc = document.createElement("div");
    enc.className = "grid";
    enc.innerHTML =
      `<div><label>Folio</label><input value="${t.folio}" disabled></div>` +
      `<div><label>Fecha</label><input data-edit type="date" value="${t.fecha}"></div>` +
      `<div><label>Sale de</label>${selAlm(t.origen, true)}</div>` +
      `<div><label>Entra a</label>${selAlm(t.destino, true)}</div>` +
      `<div style="grid-column:1/-1"><label>Comentario</label><textarea data-edit rows="2"></textarea></div>`;
    function selAlm(val, edit) {
      let s = `<select ${edit ? "data-edit" : "disabled"}>`;
      ALM.forEach((a) => (s += `<option value="${a.id}" ${a.id === val ? "selected" : ""}>${a.nombre}</option>`));
      return s + "</select>";
    }
    sheet.appendChild(enc);

    enc.querySelector('input[type="date"]').onchange = (e) => {
      t.fecha = e.target.value;
      saveDB(DB);
    };
    const [selO, selD] = enc.querySelectorAll("select");
    selO.onchange = (e) => {
      t.origen = e.target.value;
      saveDB(DB);
    };
    selD.onchange = (e) => {
      t.destino = e.target.value;
      saveDB(DB);
    };
    const tx = enc.querySelector("textarea");
    tx.value = t.comentario;
    tx.oninput = (e) => {
      t.comentario = e.target.value;
      saveDB(DB);
    };

    sheet.appendChild(
      linesTable({
        lineas: t.lineas,
        editable: true,
        onChange: () => {
          let s = 0;
          t.lineas.forEach((li) => (s += parseFloat(li.gramos || 0)));
          setTotal(s);
        },
      })
    );

    sheet.appendChild(totalWrap);
    HT.setEditable(sheet, true);
    host.appendChild(sheet);
  }
  function openTraspasoDetalle(id) {
    const t = DB.movInv.traspasos.find((x) => x.id === id);
    if (!t) return alert("No encontrado");
    openTab("TRDET" + id, "Traspaso " + t.folio, (v) => {
      v.innerHTML = "";
      const c = document.createElement("div");
      c.className = "card";
      c.innerHTML = `<h2>Detalle</h2><p>${nAlm(t.origen)} → ${nAlm(t.destino)} · ${t.fecha}</p>`;
      const tb = document.createElement("table");
      tb.className = "table";
      tb.innerHTML = '<thead><tr><th>#</th><th>Material</th><th>Detalle</th><th>Gr</th></tr></thead><tbody></tbody>';
      const body = tb.querySelector("tbody");
      t.lineas.forEach((li, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${i + 1}</td><td>${nMat(li.materialId)}</td><td>${escapeHTML(li.detalle || "")}</td><td>${f2(li.gramos)}</td>`;
        body.appendChild(tr);
      });
      c.appendChild(tb);
      const bar = document.createElement("div");
      bar.className = "ht-toolbar";
      if (!t.cerrado) {
        const bOk = document.createElement("button");
        bOk.className = "ht-btn ht-btn-blue";
        bOk.textContent = "Aceptar en destino";
        bOk.onclick = () => aceptarTraspaso(t.id);
        bar.appendChild(bOk);
      }
      c.appendChild(bar);
      v.appendChild(c);
    });
  }
  function aceptarTraspaso(id) {
    const t = DB.movInv.traspasos.find((x) => x.id === id);
    if (!t) return alert("No encontrado");
    if (t.cerrado) return alert("Ya cerrado.");
    t.lineas.forEach((li) => {
      const g = parseFloat(li.gramos || 0);
      if (g <= 0) return;
      addInv(t.destino, li.materialId, g);
    });
    t.cerrado = true;
    t.aceptado = hoyStr();
    saveDB(DB);
    alert("Traspaso aceptado en destino.");
    openTraspasosHome();
  }

  /* =================== CONCILIACIÓN (igual vista/hoja) =================== */
  function openConciliacion() {
    openTab("CI" + Date.now(), "Conciliación de Inventario", (v) => mountConciliacion(v, null));
  }
  function mountConciliacion(host, loaded) {
    host.innerHTML = "";
    const sheet = document.createElement("div");
    sheet.className = "ht-sheet";
    sheet.dataset.saved = loaded ? "true" : "false";

    const model =
      loaded ||
      (function () {
        return {
          id: "CI" + Date.now(),
          folio: nextFolio("CI"),
          fecha: hoyStr(),
          almacen: "GEN",
          ajusteFinal: 0,
          filas: MAT.filter((m) => m.id !== "TERM").map((m) => ({ mat: m.id, conteo: 0 })),
        };
      })();

    let totalDif = 0;
    let ajuste = model.ajusteFinal || 0;

    function okConc() {
      return Math.abs(totalDif + ajuste) < 0.000001;
    }

    HT.mountToolbar(sheet, {
      docName: "conciliación",
      onNew: openConciliacion,
      onSave: () => {
        const alm = sel.value;
        let totalAdj = 0;
        rows.forEach((r) => {
          const sis = getInv(alm, r.mat);
          const dif = (parseFloat(r.conteo || 0) - sis);
          if (Math.abs(dif) > 0) {
            if (dif > 0) addInv(alm, r.mat, dif);
            else try { subInv(alm, r.mat, -dif); } catch (e) { alert(e.message); }
            totalAdj += dif;
          }
        });
        if (Math.abs(ajuste) > 0) {
          if (ajuste > 0) addInv(alm, "925", ajuste);
          else try { subInv(alm, "925", -ajuste); } catch (e) { alert(e.message); }
          totalAdj += ajuste;
        }
        model.fecha = fecha.value;
        model.almacen = alm;
        model.ajusteFinal = ajuste;
        model.filas = JSON.parse(JSON.stringify(rows));
        DB.movInv.conciliaciones.push({
          id: model.id,
          folio: model.folio,
          fecha: model.fecha,
          almacen: model.almacen,
          filas: model.filas,
          totalAjuste: totalAdj,
          ajusteFinal: ajuste,
        });
        saveDB(DB);
        return { ok: true, folio: model.folio };
      },
      onPrint: () => {
        const alm = sel.value;
        const w = window.open("", "_blank", "width=820,height=900");
        if (!w) return alert("Permite pop-ups.");
        const css =
          "@page{size:5.5in 8.5in;margin:10mm;} body{font-family:system-ui,Segoe UI,Roboto,Arial;font-size:12px;} table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left} thead tr{background:#eef2ff} .status{display:inline-flex;gap:6px;align-items:center;font-weight:700} .dot{width:10px;height:10px;border-radius:999px}";
        const html = [];
        html.push(`<html><head><meta charset="utf-8"><style>${css}</style><title>Conciliación</title></head><body>`);
        html.push(
          `<h2>Conciliación de Inventario <span style="color:#b91c1c">(${model.folio})</span></h2>` +
            `<p><b>Fecha al:</b> ${fecha.value} · <b>Almacén:</b> ${nAlm(alm)} · ` +
            `<span class="status"><span class="dot" style="background:${okConc() ? "#16a34a" : "#f59e0b"}"></span> ${
              okConc() ? "Conciliado" : "Por conciliar"
            }</span></p>`
        );
        html.push('<table><thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia (g)</th></tr></thead><tbody>');
        rows.forEach((r) => {
          const sis = getInv(alm, r.mat);
          const dif = (parseFloat(r.conteo || 0) - sis);
          html.push(`<tr><td>${nMat(r.mat)}</td><td>${f2(sis)}</td><td>${f2(r.conteo || 0)}</td><td>${f2(dif)}</td></tr>`);
        });
        html.push("</tbody></table>");
        html.push(`<p><b>Ajuste final:</b> ${f2(ajuste)} g · <b>Diferencia total post-ajuste:</b> ${f2(totalDif + ajuste)} g</p>`);
        html.push("</body></html>");
        w.document.write(html.join(""));
        w.document.close();
        try {
          w.focus();
          w.print();
        } catch (e) {}
      },
    });

    const top = document.createElement("div");
    top.className = "grid";
    top.innerHTML =
      `<div><label>Almacén</label>${selAlm(model.almacen, !loaded)}</div>` +
      `<div><label>Fecha al</label><input ${loaded ? "disabled" : "data-edit"} type="date" value="${model.fecha || hoyStr()}"></div>` +
      `<div style="display:flex;align-items:end;justify-content:flex-end"><span class="status-pill ${
        okConc() ? "status-ok" : "status-warn"
      }"><span class="dot ${okConc() ? "ok" : "warn"}"></span> ${okConc() ? "Conciliado" : "Por conciliar"}</span></div>`;
    sheet.appendChild(top);
    function selAlm(val, edit) {
      let s = `<select ${edit ? "data-edit" : "disabled"}>`;
      ALM.forEach((a) => (s += `<option value="${a.id}" ${a.id === val ? "selected" : ""}>${a.nombre}</option>`));
      return s + "</select>";
    }
    const sel = top.querySelector("select");
    const fecha = top.querySelector('input[type="date"]');

    const box = document.createElement("div");
    box.className = "card";
    box.innerHTML = "<h2>Conteos por material</h2>";
    const tb = document.createElement("table");
    tb.className = "table";
    tb.innerHTML =
      '<thead><tr><th>Material</th><th>Sistema (g)</th><th>Conteo (g)</th><th>Diferencia</th></tr></thead><tbody></tbody>' +
      '<tfoot><tr><th colspan="3" style="text-align:right">Diferencia total:</th><th class="totaldif">0.00</th></tr>' +
      `<tr><th colspan="3" style="text-align:right">Ajuste final (± g):</th><th>${
        loaded ? `<span class="ajusteRO">${f2(ajuste)}</span>` : '<input data-edit type="number" step="0.01" class="ajuste" value="0" style="width:100%;text-align:right">'
      }</th></tr><tr><th colspan="3" style="text-align:right">Total posterior a ajuste:</th><th class="post">0.00</th></tr></tfoot>`;
    const body = tb.querySelector("tbody");
    const cellTotal = tb.querySelector(".totaldif");
    const cellPost = tb.querySelector(".post");
    const inAjuste = tb.querySelector(".ajuste");
    box.appendChild(tb);
    sheet.appendChild(box);

    const rows = MAT.filter((m) => m.id !== "TERM").map((m) => {
      const exist = (model.filas || []).find((x) => x.mat === m.id);
      return { mat: m.id, conteo: exist ? parseFloat(exist.conteo || 0) : 0, sis: 0, dif: 0 };
    });

    function recompute() {
      const alm = sel.value;
      totalDif = 0;
      rows.forEach((r) => {
        r.sis = getInv(alm, r.mat);
        r.dif = parseFloat(r.conteo || 0) - r.sis;
        totalDif += r.dif;
      });
      cellTotal.textContent = f2(totalDif);
      cellPost.textContent = f2(totalDif + ajuste);
      const pill = sheet.querySelector(".status-pill");
      if (okConc()) {
        pill.className = "status-pill status-ok";
        pill.innerHTML = '<span class="dot ok"></span> Conciliado';
      } else {
        pill.className = "status-pill status-warn";
        pill.innerHTML = '<span class="dot warn"></span> Por conciliar';
      }
    }
    function paint() {
      const alm = sel.value;
      body.innerHTML = "";
      rows.forEach((r) => {
        r.sis = getInv(alm, r.mat);
        const tr = document.createElement("tr");
        tr.innerHTML =
          `<td>${nMat(r.mat)}</td><td class="sis">${f2(r.sis)}</td>` +
          `<td>${loaded ? `<span>${f2(r.conteo || 0)}</span>` : `<input data-edit type="number" step="0.01" value="${r.conteo || 0}" style="width:100%;text-align:right">`}</td>` +
          `<td class="dif">0.00</td>`;
        const tdSis = tr.querySelector(".sis");
        const tdDif = tr.querySelector(".dif");
        const inC = tr.querySelector("input");
        function upd() {
          r.sis = getInv(alm, r.mat);
          tdSis.textContent = f2(r.sis);
          r.dif = (parseFloat(r.conteo || 0) - r.sis);
          tdDif.textContent = f2(r.dif);
          recompute();
        }
        if (inC) {
          inC.oninput = () => {
            r.conteo = parseFloat(inC.value || 0);
            upd();
          };
        }
        upd();
        body.appendChild(tr);
      });
    }
    paint();

    if (!loaded) {
      if (inAjuste) inAjuste.oninput = () => {
        ajuste = parseFloat(inAjuste.value || 0);
        recompute();
      };
      sel.onchange = () => paint();
      HT.setEditable(sheet, true);
    } else {
      HT.setEditable(sheet, false);
    }
    host.appendChild(sheet);
  }

  /* =================== CONSULTAR =================== */
  function openConsulta() {
    openTab("CONS" + Date.now(), "Consultar documentos", (v) => {
      v.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";

      const bar = document.createElement("div");
      bar.className = "ht-toolbar";
      const selT = document.createElement("select");
      ["ENTRADAS", "SALIDAS", "TRASPASOS", "CONCILIACIÓN"].forEach((t) => {
        const op = document.createElement("option");
        op.text = t;
        selT.appendChild(op);
      });
      const fA = document.createElement("input");
      fA.type = "date";
      fA.value = hoyStr();
      const fB = document.createElement("input");
      fB.type = "date";
      fB.value = hoyStr();
      const q = document.createElement("input");
      q.type = "text";
      q.placeholder = "Buscar... (folio, comentario)";
      const go = document.createElement("button");
      go.className = "ht-btn ht-btn-blue";
      go.textContent = "➡ Buscar";
      bar.appendChild(selT);
      bar.appendChild(fA);
      bar.appendChild(fB);
      bar.appendChild(q);
      bar.appendChild(go);
      card.appendChild(bar);

      const tb = document.createElement("table");
      tb.className = "table";
      tb.innerHTML = '<thead><tr><th>Tipo</th><th>Folio</th><th>Fecha</th><th>Info</th><th>Total (g)</th></tr></thead><tbody></tbody>';
      const body = tb.querySelector("tbody");
      card.appendChild(tb);
      v.appendChild(card);

      function bet(d, a, b) {
        return d >= a && d <= b;
      }
      function row(tipo, folio, fecha, info, total, openFn) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${tipo}</td><td>${folio}</td><td>${fecha}</td><td>${escapeHTML(info || "")}</td><td style="text-align:right">${f2(total || 0)}</td>`;
        tr.ondblclick = openFn;
        body.appendChild(tr);
      }
      function run() {
        body.innerHTML = "";
        const a = fA.value,
          b = fB.value,
          qq = (q.value || "").toLowerCase();
        if (selT.value === "ENTRADAS") {
          DB.movInv.entradas
            .filter((d) => bet(d.fecha, a, b) && (d.folio.toLowerCase().includes(qq) || (d.comentario || "").toLowerCase().includes(qq)))
            .forEach((d) => row("Entrada", d.folio, d.fecha, d.comentario, d.total || 0, () => viewEntrada(d)));
        } else if (selT.value === "SALIDAS") {
          DB.movInv.salidas
            .filter((d) => bet(d.fecha, a, b) && (d.folio.toLowerCase().includes(qq) || (d.comentario || "").toLowerCase().includes(qq)))
            .forEach((d) => row("Salida", d.folio, d.fecha, d.comentario, d.total || 0, () => viewSalida(d)));
        } else if (selT.value === "TRASPASOS") {
          DB.movInv.traspasos
            .filter((d) => bet(d.fecha, a, b) && (d.folio.toLowerCase().includes(qq) || (d.comentario || "").toLowerCase().includes(qq)))
            .forEach((d) => row("Traspaso", d.folio, d.fecha, nAlm(d.origen) + " → " + nAlm(d.destino), d.total || 0, () => openTraspasoDetalle(d.id)));
        } else {
          DB.movInv.conciliaciones
            .filter((d) => bet(d.fecha, a, b) && d.folio.toLowerCase().includes(qq))
            .forEach((d) =>
              row("Conciliación", d.folio, d.fecha, nAlm(d.almacen), d.totalAjuste || 0, () =>
                openTab("VIEWCI" + d.folio, "Conciliación " + d.folio, (vv) =>
                  mountConciliacion(vv, {
                    id: d.id,
                    folio: d.folio,
                    fecha: d.fecha,
                    almacen: d.almacen,
                    ajusteFinal: d.ajusteFinal || 0,
                    filas: (d.filas || []).map((r) => ({ mat: r.mat, conteo: r.conteo })),
                  })
                )
              )
            );
        }
      }
      go.onclick = run;
      run();

      function viewEntrada(d) {
        openTab("VIEWEN" + d.folio, "Entrada " + d.folio, (view) => {
          view.innerHTML = "";
          const c = document.createElement("div");
          c.className = "card";
          c.innerHTML = `<h2>Entrada ${d.folio}</h2><p><b>Fecha:</b> ${d.fecha} · <b>Destino:</b> ${nAlm("GEN")} · <b>Motivo:</b> ${d.motivo}</p>`;
          const tb = document.createElement("table");
          tb.className = "table";
          tb.innerHTML = '<thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody></tbody>';
          const body = tb.querySelector("tbody");
          (d.lineas || []).forEach((li, i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${i + 1}</td><td>${nMat(li.materialId)}</td><td>${escapeHTML(li.detalle || "")}</td><td>${f2(li.gramos)}</td>`;
            body.appendChild(tr);
          });
          c.appendChild(tb);
          view.appendChild(c);
        });
      }
      function viewSalida(d) {
        openTab("VIEWSA" + d.folio, "Salida " + d.folio, (view) => {
          view.innerHTML = "";
          const c = document.createElement("div");
          c.className = "card";
          c.innerHTML = `<h2>Salida ${d.folio}</h2><p><b>Fecha:</b> ${d.fecha} · <b>Origen:</b> ${nAlm("GEN")}</p>`;
          const tb = document.createElement("table");
          tb.className = "table";
          tb.innerHTML = '<thead><tr><th>#</th><th>Material</th><th>Descripción</th><th>Gr</th></tr></thead><tbody></tbody>';
          const body = tb.querySelector("tbody");
          (d.lineas || []).forEach((li, i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${i + 1}</td><td>${nMat(li.materialId)}</td><td>${escapeHTML(li.detalle || "")}</td><td>${f2(li.gramos)}</td>`;
            body.appendChild(tr);
          });
          c.appendChild(tb);
          view.appendChild(c);
        });
      }
    });
  }

  /* =================== EXISTENCIAS =================== */
  function openExistencias() {
    openTab("STK" + Date.now(), "Existencias", (v) => {
      v.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<h2>Existencias por almacén</h2>";

      ALM.forEach((a) => {
        const total = MAT.filter((m) => m.id !== "TERM").reduce((acc, m) => acc + getInv(a.id, m.id), 0);
        const chip = document.createElement("div");
        chip.className = "chip-total";
        chip.textContent = `${nAlm(a.id)} · Total: ${f2(total)} g`;
        card.appendChild(chip);

        const tb = document.createElement("table");
        tb.className = "table";
        tb.style.margin = "10px 0 18px";
        tb.innerHTML = "<thead><tr><th>Material</th><th>Gramos</th></tr></thead><tbody></tbody>";
        const body = tb.querySelector("tbody");
        MAT.filter((m) => m.id !== "TERM").forEach((m) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${nMat(m.id)}</td><td style="text-align:right">${f2(getInv(a.id, m.id))}</td>`;
          body.appendChild(tr);
        });
        card.appendChild(tb);
      });
      v.appendChild(card);
    });
  }

  /* =================== MÓDULO: render raíz =================== */
  function renderInventarios(host) {
    try {
      // Construye columnas y submenú dentro de #moduleHost
      hostParts();
      drawSubmenu();
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="card"><p class="muted">Error al montar Inventarios.</p></div>';
    }
  }

  /* ---------- Exporta para que index pueda llamarlo ---------- */
  global.renderInventarios = renderInventarios;

})(window);
/* =====================================================================
   FIN MÓDULO INVENTARIO · v1.7
   ===================================================================== */
