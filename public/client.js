"use strict";

const els = {
  panel: document.getElementById("panel"),
  brand: document.getElementById("brand-mark"),
  toggle: document.getElementById("btn-toggle"),
  min: document.getElementById("btn-min"),
  close: document.getElementById("btn-close"),
  statusLabel: document.getElementById("status-label"),
};

const STATUS_TEXT = {
  idle: "// выключено",
  watching: "// ищу ready-check",
  accepting: "// принимаю…",
  accepted: "// матч принят",
  "no-dota": "// dota не запущена",
  minimized: "// dota свёрнута",
};

let running = false;

function setUi(state) {
  running = Boolean(state.running);
  const status = running ? state.status || "watching" : "idle";
  els.panel.dataset.on = running ? "1" : "0";
  els.panel.dataset.status = status;
  els.statusLabel.textContent = STATUS_TEXT[status] || STATUS_TEXT.idle;

  els.brand?.classList.toggle("is-offline", !running);
  els.brand?.classList.toggle("is-online", running);

  els.toggle.className = running ? "btn btn-outline" : "btn btn-solid";
}

async function refresh() {
  if (!window.largoDesktop) return;
  try {
    setUi(await window.largoDesktop.getStatus());
  } catch (_) {
    /* ignore */
  }
}

els.toggle.addEventListener("click", async () => {
  if (!window.largoDesktop) return;
  els.toggle.disabled = true;
  try {
    if (running) {
      await window.largoDesktop.stopAccept();
    } else {
      await window.largoDesktop.startAccept();
    }
    await refresh();
  } finally {
    els.toggle.disabled = false;
  }
});

els.min.addEventListener("click", () => window.largoDesktop?.minimize());
els.close.addEventListener("click", () => window.largoDesktop?.close());

if (window.largoDesktop?.onAcceptChanged) {
  window.largoDesktop.onAcceptChanged((state) => setUi(state));
}

refresh();
setInterval(refresh, 1000);
