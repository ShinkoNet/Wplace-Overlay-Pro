/// <reference types="tampermonkey" />
import { WPLACE_FREE, WPLACE_PAID, WPLACE_NAMES, DEFAULT_FREE_KEYS } from '../core/palette';
import { config, saveConfig } from '../core/store';
import { MAX_OVERLAY_DIM } from '../core/constants';
import { ensureHook } from '../core/hook';
import { clearOverlayCache, paletteDetectionCache } from '../core/cache';
import { showToast } from '../core/toast';

// dispatch when an overlay image is updated
function emitOverlayChanged() {
  document.dispatchEvent(new CustomEvent('op-overlay-changed'));
}

type CCState = {
  backdrop: HTMLDivElement;
  modal: HTMLDivElement;
  previewCanvas: HTMLCanvasElement;
  previewCtx: CanvasRenderingContext2D;
  sourceCanvas: HTMLCanvasElement | null;
  sourceCtx: CanvasRenderingContext2D | null;
  sourceImageData: ImageData | null;
  processedCanvas: HTMLCanvasElement | null;
  processedCtx: CanvasRenderingContext2D | null;

  freeGrid: HTMLDivElement;
  paidGrid: HTMLDivElement;
  freeToggle: HTMLButtonElement;
  paidToggle: HTMLButtonElement;

  meta: HTMLElement;
  applyBtn: HTMLButtonElement;
  recalcBtn: HTMLButtonElement;
  realtimeBtn: HTMLButtonElement;

  zoom: number;
  selectedFree: Set<string>;
  selectedPaid: Set<string>;
  realtime: boolean;

  overlay: any | null;
  lastColorCounts: Record<string, number>;
  isStale: boolean;
};

let cc: CCState | null = null;

export function buildCCModal() {
  if (document.getElementById('op-cc-modal')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'op-cc-backdrop';
  backdrop.id = 'op-cc-backdrop';
  document.body.appendChild(backdrop);

  const modal = document.createElement('div');
  modal.className = 'op-cc-modal';
  modal.id = 'op-cc-modal';
  modal.style.display = 'none';

  modal.innerHTML = `
      <div class="op-cc-header" id="op-cc-header">
        <div class="op-cc-title">Color Match</div>
        <div class="op-row" style="gap:6px;">
          <button class="op-button op-cc-pill" id="op-cc-realtime">Realtime: OFF</button>
          <button class="op-cc-close" id="op-cc-close" title="Close">✕</button>
        </div>
      </div>

      <div class="op-cc-body">
        <div class="op-cc-preview-wrap" style="grid-area: preview;">
          <canvas id="op-cc-preview" class="op-cc-canvas"></canvas>
          <div class="op-cc-zoom">
            <button class="op-icon-btn" id="op-cc-zoom-out" title="Zoom out">−</button>
            <button class="op-icon-btn" id="op-cc-zoom-in" title="Zoom in">+</button>
          </div>
        </div>

        <div class="op-cc-controls" style="grid-area: controls;">
          <div class="op-cc-palette" id="op-cc-free">
            <div class="op-row space">
              <label>Free Colors</label>
              <button class="op-button" id="op-cc-free-toggle">Unselect All</button>
            </div>
            <div id="op-cc-free-grid" class="op-cc-grid"></div>
          </div>

          <div class="op-cc-palette" id="op-cc-paid">
            <div class="op-row space">
              <label>Paid Colors (2000💧each)</label>
              <button class="op-button" id="op-cc-paid-toggle">Select All</button>
            </div>
            <div id="op-cc-paid-grid" class="op-cc-grid"></div>
          </div>
        </div>
      </div>

      <div class="op-cc-footer">
        <div class="op-cc-ghost" id="op-cc-meta"></div>
        <div class="op-cc-actions">
          <button class="op-button" id="op-cc-recalc" title="Recalculate color mapping">Calculate</button>
          <button class="op-button" id="op-cc-apply" title="Apply changes to overlay">Apply</button>
          <button class="op-button" id="op-cc-cancel" title="Close without saving">Cancel</button>
        </div>
      </div>
  `;
  document.body.appendChild(modal);

  const previewCanvas = modal.querySelector('#op-cc-preview') as HTMLCanvasElement;
  const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
  if (!previewCtx) return;

  cc = {
    backdrop,
    modal,
    previewCanvas,
    previewCtx,

    sourceCanvas: null,
    sourceCtx: null,
    sourceImageData: null,

    processedCanvas: null,
    processedCtx: null,

    freeGrid: modal.querySelector('#op-cc-free-grid') as HTMLDivElement,
    paidGrid: modal.querySelector('#op-cc-paid-grid') as HTMLDivElement,
    freeToggle: modal.querySelector('#op-cc-free-toggle') as HTMLButtonElement,
    paidToggle: modal.querySelector('#op-cc-paid-toggle') as HTMLButtonElement,

    meta: modal.querySelector('#op-cc-meta') as HTMLElement,
    applyBtn: modal.querySelector('#op-cc-apply') as HTMLButtonElement,
    recalcBtn: modal.querySelector('#op-cc-recalc') as HTMLButtonElement,
    realtimeBtn: modal.querySelector('#op-cc-realtime') as HTMLButtonElement,

    zoom: 1.0,
    selectedFree: new Set(config.ccFreeKeys),
    selectedPaid: new Set(config.ccPaidKeys),
    realtime: !!config.ccRealtime,

    overlay: null,
    lastColorCounts: {},
    isStale: false
  };

  const closeBtn = modal.querySelector('#op-cc-close') as HTMLButtonElement | null;
  closeBtn?.addEventListener('click', closeCCModal);
  backdrop.addEventListener('click', closeCCModal);
  const cancelBtn = modal.querySelector('#op-cc-cancel') as HTMLButtonElement | null;
  cancelBtn?.addEventListener('click', closeCCModal);

  const zoomIn = async () => {
    if (!cc) return;
    cc.zoom = Math.min(8, (cc.zoom || 1) * 1.25);
    config.ccZoom = cc.zoom; await saveConfig(['ccZoom']);
    applyPreview(); updateMeta();
  };
  const zoomOut = async () => {
    if (!cc) return;
    cc.zoom = Math.max(0.1, (cc.zoom || 1) / 1.25);
    config.ccZoom = cc.zoom; await saveConfig(['ccZoom']);
    applyPreview(); updateMeta();
  };
  (modal.querySelector('#op-cc-zoom-in') as HTMLButtonElement | null)?.addEventListener('click', zoomIn);
  (modal.querySelector('#op-cc-zoom-out') as HTMLButtonElement | null)?.addEventListener('click', zoomOut);

  cc.realtimeBtn?.addEventListener('click', async () => {
    if (!cc) return;
    cc.realtime = !cc.realtime;
    cc.realtimeBtn.textContent = `Realtime: ${cc.realtime ? 'ON' : 'OFF'}`;
    cc.realtimeBtn.classList.toggle('op-danger', cc.realtime);
    config.ccRealtime = cc.realtime; await saveConfig(['ccRealtime']);
    if (cc.realtime && cc.isStale) recalcNow();
  });

  cc.recalcBtn?.addEventListener('click', () => { recalcNow(); });

  cc.applyBtn?.addEventListener('click', async () => {
    if (!cc) return;
    const ov = cc.overlay; if (!ov || !cc.processedCanvas) return;
    if (cc.processedCanvas.width >= MAX_OVERLAY_DIM || cc.processedCanvas.height >= MAX_OVERLAY_DIM) {
      showToast(`Image too large to apply (must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM}).`);
      return;
    }
    const dataUrl = cc.processedCanvas.toDataURL('image/png');
    ov.imageBase64 = dataUrl; ov.imageUrl = null; ov.isLocal = true;

    // Mark the processed image as palette-perfect for optimization
    paletteDetectionCache.set(dataUrl, true);

    await saveConfig(['overlays']); clearOverlayCache(); ensureHook();
    emitOverlayChanged();
    const uniqueColors = Object.keys(cc.lastColorCounts).length;
    showToast(`Overlay updated (${cc.processedCanvas.width}×${cc.processedCanvas.height}, ${uniqueColors} colors).`);
    closeCCModal();
  });

  renderPaletteGrid();
}

export function openCCModal(overlay: any) {
  if (!cc) return;
  cc.overlay = overlay;

  document.body.classList.add('op-scroll-lock');

  cc.zoom = Number(config.ccZoom) || 1.0;
  cc.realtime = !!config.ccRealtime;
  cc.realtimeBtn.textContent = `Realtime: ${cc.realtime ? 'ON' : 'OFF'}`;
  cc.realtimeBtn.classList.toggle('op-danger', cc.realtime);

  const img = new Image();
  img.onload = () => {
    if (!cc) return;

    if (!cc.sourceCanvas) {
      cc.sourceCanvas = document.createElement('canvas');
      cc.sourceCtx = cc.sourceCanvas.getContext('2d', { willReadFrequently: true }) || null;
    }
    if (!cc.sourceCanvas) return;

    cc.sourceCanvas.width = img.width; cc.sourceCanvas.height = img.height;
    cc.sourceCtx?.clearRect(0, 0, img.width, img.height);
    cc.sourceCtx?.drawImage(img, 0, 0);
    cc.sourceImageData = cc.sourceCtx ? cc.sourceCtx.getImageData(0, 0, img.width, img.height) : null;

    if (!cc.processedCanvas) {
      cc.processedCanvas = document.createElement('canvas');
      cc.processedCtx = cc.processedCanvas.getContext('2d') || null;
    }

    processImage();
    cc.isStale = false;
    applyPreview();
    updateMeta();

    cc.backdrop.classList.add('show');
    cc.modal.style.display = 'flex';
  };
  img.src = overlay.imageBase64;
}

function closeCCModal() {
  if (!cc) return;
  cc.backdrop.classList.remove('show');
  cc.modal.style.display = 'none';
  cc.overlay = null;
  document.body.classList.remove('op-scroll-lock');
}

function weightedNearest(r: number, g: number, b: number, palette: number[][]) {
  let best: number[] | null = null, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const rmean = (pr + r) / 2;
    const rdiff = pr - r;
    const gdiff = pg - g;
    const bdiff = pb - b;
    const x = ((512 + rmean) * rdiff * rdiff) >> 8;
    const y = 4 * gdiff * gdiff;
    const z = ((767 - rmean) * bdiff * bdiff) >> 8;
    const dist = Math.sqrt(x + y + z);
    if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
  }
  return best || [0, 0, 0];
}

function getActivePalette(): number[][] {
  if (!cc) return [];
  const arr: number[][] = [];
  cc.selectedFree.forEach(k => { const [r, g, b] = k.split(',').map(n => parseInt(n, 10)); if (Number.isFinite(r)) arr.push([r, g, b]); });
  cc.selectedPaid.forEach(k => { const [r, g, b] = k.split(',').map(n => parseInt(n, 10)); if (Number.isFinite(r)) arr.push([r, g, b]); });
  return arr;
}

function processImage() {
  if (!cc || !cc.sourceImageData) return;
  const w = cc.sourceImageData.width, h = cc.sourceImageData.height;

  const src = cc.sourceImageData.data;
  const out = new Uint8ClampedArray(src.length);

  const palette = getActivePalette();
  const counts: Record<string, number> = {};

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
    if (a === 0) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0; continue; }
    const [nr, ng, nb] = palette.length ? weightedNearest(r, g, b, palette) : [r, g, b];
    out[i] = nr; out[i + 1] = ng; out[i + 2] = nb; out[i + 3] = 255;
    const key = `${nr},${ng},${nb}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  if (!cc.processedCanvas) {
    cc.processedCanvas = document.createElement('canvas');
    cc.processedCtx = cc.processedCanvas.getContext('2d') || null;
  }
  if (!cc.processedCanvas) return;

  cc.processedCanvas.width = w; cc.processedCanvas.height = h;

  const outImg = new ImageData(out, w, h);
  cc.processedCtx?.putImageData(outImg, 0, 0);
  cc.lastColorCounts = counts;
}

function applyPreview() {
  if (!cc || !cc.processedCanvas) return;
  const zoom = Number(cc.zoom) || 1.0;
  const srcCanvas = cc.processedCanvas;

  const pw = Math.max(1, Math.round(srcCanvas.width * zoom));
  const ph = Math.max(1, Math.round(srcCanvas.height * zoom));

  cc.previewCanvas.width = pw;
  cc.previewCanvas.height = ph;

  const ctx = cc.previewCtx;
  ctx.clearRect(0, 0, pw, ph);
  (ctx as any).imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, pw, ph);
  (ctx as any).imageSmoothingEnabled = true;
}

function updateMeta() {
  if (!cc || !cc.sourceImageData) { if (cc) cc.meta.textContent = ''; return; }
  const w = cc.sourceImageData.width, h = cc.sourceImageData.height;
  const colorsUsed = Object.keys(cc.lastColorCounts || {}).length;
  const status = cc.isStale ? 'pending recalculation' : 'up to date';
  cc.meta.textContent = `Size: ${w}×${h} | Zoom: ${cc.zoom.toFixed(2)}× | Colors: ${colorsUsed} | Status: ${status}`;
}

function renderPaletteGrid() {
  if (!cc) return;
  cc.freeGrid.innerHTML = '';
  cc.paidGrid.innerHTML = '';

  for (const [r, g, b] of WPLACE_FREE) {
    const key = `${r},${g},${b}`;
    const cell = document.createElement('div');
    cell.className = 'op-cc-cell';
    cell.style.background = `rgb(${r},${g},${b})`;
    cell.title = WPLACE_NAMES[key] || key;
    (cell as any).dataset.key = key;
    (cell as any).dataset.type = 'free';
    if (cc.selectedFree.has(key)) cell.classList.add('active');
    cell.addEventListener('click', async () => {
      if (!cc) return;
      if (cc.selectedFree.has(key)) cc.selectedFree.delete(key); else cc.selectedFree.add(key);
      cell.classList.toggle('active', cc.selectedFree.has(key));
      config.ccFreeKeys = Array.from(cc.selectedFree); await saveConfig(['ccFreeKeys']);
      if (cc.realtime) processImage(); else { cc.isStale = true; }
      applyPreview(); updateMeta(); updateMasterButtons();
    });
    cc.freeGrid.appendChild(cell);
  }

  for (const [r, g, b] of WPLACE_PAID) {
    const key = `${r},${g},${b}`;
    const cell = document.createElement('div');
    cell.className = 'op-cc-cell';
    cell.style.background = `rgb(${r},${g},${b})`;
    cell.title = WPLACE_NAMES[key] || key;
    (cell as any).dataset.key = key;
    (cell as any).dataset.type = 'paid';
    if (cc.selectedPaid.has(key)) cell.classList.add('active');
    cell.addEventListener('click', async () => {
      if (!cc) return;
      if (cc.selectedPaid.has(key)) cc.selectedPaid.delete(key); else cc.selectedPaid.add(key);
      cell.classList.toggle('active', cc.selectedPaid.has(key));
      config.ccPaidKeys = Array.from(cc.selectedPaid); await saveConfig(['ccPaidKeys']);
      if (cc.realtime) processImage(); else { cc.isStale = true; }
      applyPreview(); updateMeta(); updateMasterButtons();
    });
    cc.paidGrid.appendChild(cell);
  }

  cc.freeToggle.addEventListener('click', async () => {
    if (!cc) return;
    const allActive = isAllFreeActive();
    setAllActive('free', !allActive);
    config.ccFreeKeys = Array.from(cc.selectedFree);
    await saveConfig(['ccFreeKeys']);
    if (cc.realtime) recalcNow(); else markStale();
    applyPreview(); updateMeta(); updateMasterButtons();
  });
  cc.paidToggle.addEventListener('click', async () => {
    if (!cc) return;
    const allActive = isAllPaidActive();
    setAllActive('paid', !allActive);
    config.ccPaidKeys = Array.from(cc.selectedPaid);
    await saveConfig(['ccPaidKeys']);
    if (cc.realtime) recalcNow(); else markStale();
    applyPreview(); updateMeta(); updateMasterButtons();
  });

  updateMasterButtons();
}

function isAllFreeActive(): boolean {
  if (!cc) return false;
  return DEFAULT_FREE_KEYS.every(k => cc.selectedFree.has(k));
}
function isAllPaidActive(): boolean {
  if (!cc) return false;
  const allPaidKeys = WPLACE_PAID.map(([r, g, b]) => `${r},${g},${b}`);
  return allPaidKeys.every(k => cc.selectedPaid.has(k)) && allPaidKeys.length > 0;
}
function setAllActive(type: 'free' | 'paid', active: boolean) {
  if (!cc) return;
  if (type === 'free') {
    const keys = DEFAULT_FREE_KEYS;
    if (active) keys.forEach(k => cc.selectedFree.add(k)); else cc.selectedFree.clear();
    cc.freeGrid.querySelectorAll('.op-cc-cell').forEach(cell => cell.classList.toggle('active', active));
  } else {
    const keys = WPLACE_PAID.map(([r, g, b]) => `${r},${g},${b}`);
    if (active) keys.forEach(k => cc.selectedPaid.add(k)); else cc.selectedPaid.clear();
    cc.paidGrid.querySelectorAll('.op-cc-cell').forEach(cell => cell.classList.toggle('active', active));
  }
}
function updateMasterButtons() {
  if (!cc) return;
  cc.freeToggle.textContent = isAllFreeActive() ? 'Unselect All' : 'Select All';
  cc.paidToggle.textContent = isAllPaidActive() ? 'Unselect All' : 'Select All';
}

function recalcNow() {
  if (!cc) return;
  processImage();
  cc.isStale = false;
  applyPreview();
  updateMeta();
}
function markStale() {
  if (!cc) return;
  cc.isStale = true;
  const base = (cc.meta.textContent || '').replace(/ \| Status: .+$/, '');
  cc.meta.textContent = `${base} | Status: pending recalculation`;
}