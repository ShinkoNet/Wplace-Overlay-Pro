/// <reference types="tampermonkey" />
import { createCanvas, createHTMLCanvas, canvasToDataURLSafe, loadImage } from '../core/canvas';
import { saveConfig } from '../core/store';
import { MAX_OVERLAY_DIM } from '../core/constants';
import { ensureHook } from '../core/hook';
import { clearOverlayCache } from '../core/cache';
import { showToast } from '../core/toast';

// dispatch when an overlay image is updated
function emitOverlayChanged() {
  document.dispatchEvent(new CustomEvent('op-overlay-changed'));
}

type RSRefs = {
  backdrop: HTMLDivElement;
  modal: HTMLDivElement;
  tabSimple: HTMLButtonElement;
  tabAdvanced: HTMLButtonElement;
  paneSimple: HTMLDivElement;
  paneAdvanced: HTMLDivElement;
  orig: HTMLInputElement;
  w: HTMLInputElement;
  h: HTMLInputElement;
  lock: HTMLInputElement;
  note?: HTMLElement | null;
  onex: HTMLButtonElement;
  half: HTMLButtonElement;
  third: HTMLButtonElement;
  quarter: HTMLButtonElement;
  double: HTMLButtonElement;
  scale: HTMLInputElement;
  applyScale: HTMLButtonElement;
  simWrap: HTMLDivElement;
  simOrig: HTMLCanvasElement;
  simNew: HTMLCanvasElement;
  colLeft: HTMLDivElement;
  colRight: HTMLDivElement;

  advWrap: HTMLDivElement;
  preview: HTMLCanvasElement;

  meta: HTMLElement;

  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;

  multRange: HTMLInputElement;
  multInput: HTMLInputElement;
  bind: HTMLInputElement;
  blockW: HTMLInputElement;
  blockH: HTMLInputElement;
  offX: HTMLInputElement;
  offY: HTMLInputElement;
  dotR: HTMLInputElement;
  dotRVal: HTMLElement;
  gridToggle: HTMLInputElement;
  advNote: HTMLElement;
  resWrap: HTMLDivElement;
  resCanvas: HTMLCanvasElement;
  resMeta: HTMLElement;

  calcBtn: HTMLButtonElement;
  applyBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
};

type RSState = RSRefs & {
  ov: any | null;
  img: HTMLImageElement | null;
  origW: number; origH: number;
  mode: 'simple'|'advanced';
  zoom: number;
  updating: boolean;

  mult: number;
  gapX: number; gapY: number;
  offx: number; offy: number;
  dotr: number;

  viewX: number; viewY: number;

  panning: boolean;
  panStart: { x: number; y: number; viewX: number; viewY: number } | null;

  calcCanvas: HTMLCanvasElement | null;
  calcCols: number;
  calcRows: number;
  calcReady: boolean;

  _drawSimplePreview?: () => void;
  _drawAdvancedPreview?: () => void;
  _drawAdvancedResultPreview?: () => void;
  _syncAdvancedMeta?: () => void;
  _syncSimpleNote?: () => void;
  _setMode?: (m: 'simple'|'advanced') => void;
  _resizeHandler?: () => void;
};

let rs: RSState | null = null;

export function buildRSModal() {
  if (document.getElementById('op-rs-modal')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'op-rs-backdrop';
  backdrop.id = 'op-rs-backdrop';
  document.body.appendChild(backdrop);

  const modal = document.createElement('div');
  modal.className = 'op-rs-modal';
  modal.id = 'op-rs-modal';
  modal.style.display = 'none';

  modal.innerHTML = `
      <div class="op-rs-header" id="op-rs-header">
        <div class="op-rs-title">Resize Overlay</div>
        <button class="op-rs-close" id="op-rs-close" title="Close">✕</button>
      </div>

      <div class="op-rs-tabs">
        <button class="op-rs-tab-btn active" id="op-rs-tab-simple">Simple</button>
        <button class="op-rs-tab-btn" id="op-rs-tab-advanced">Advanced (grid)</button>
      </div>

      <div class="op-rs-body">
        <div class="op-rs-pane show" id="op-rs-pane-simple">
          <div class="op-rs-row">
            <label style="width:110px;">Original</label>
            <input type="text" class="op-input" id="op-rs-orig" disabled>
          </div>
          <div class="op-rs-row">
            <label style="width:110px;">Width</label>
            <input type="number" min="1" step="1" class="op-input" id="op-rs-w">
          </div>
          <div class="op-rs-row">
            <label style="width:110px;">Height</label>
            <input type="number" min="1" step="1" class="op-input" id="op-rs-h">
          </div>
          <div class="op-rs-row">
            <input type="checkbox" id="op-rs-lock" checked>
            <label for="op-rs-lock">Lock aspect ratio</label>
          </div>
          <div class="op-rs-row" style="gap:6px; flex-wrap:wrap;">
            <label style="width:110px;">Quick</label>
            <button class="op-button" id="op-rs-double">2x</button>
            <button class="op-button" id="op-rs-onex">1x</button>
            <button class="op-button" id="op-rs-half">0.5x</button>
            <button class="op-button" id="op-rs-third">0.33x</button>
            <button class="op-button" id="op-rs-quarter">0.25x</button>
          </div>
          <div class="op-rs-row">
            <label style="width:110px;">Scale factor</label>
            <input type="number" step="0.01" min="0.01" class="op-input" id="op-rs-scale" placeholder="e.g. 0.5">
            <button class="op-button" id="op-rs-apply-scale">Apply</button>
          </div>

          <div class="op-rs-preview-wrap" id="op-rs-sim-wrap">
            <div class="op-rs-dual">
              <div class="op-rs-col" id="op-rs-col-left">
                <div class="label">Original</div>
                <div class="pad-top"></div>
                <canvas id="op-rs-sim-orig" class="op-rs-canvas op-rs-thumb"></canvas>
              </div>
              <div class="op-rs-col" id="op-rs-col-right">
                <div class="label">Result (downscale → upscale preview)</div>
                <div class="pad-top"></div>
                <canvas id="op-rs-sim-new" class="op-rs-canvas op-rs-thumb"></canvas>
              </div>
            </div>
          </div>
        </div>

        <div class="op-rs-pane" id="op-rs-pane-advanced">
          <div class="op-rs-preview-wrap op-pan-grab" id="op-rs-adv-wrap">
            <canvas id="op-rs-preview" class="op-rs-canvas"></canvas>
            <div class="op-rs-zoom">
              <button class="op-icon-btn" id="op-rs-zoom-out" title="Zoom out">−</button>
              <button class="op-icon-btn" id="op-rs-zoom-in" title="Zoom in">+</button>
            </div>
          </div>

          <div class="op-rs-row" style="margin-top:8px;">
            <label style="width:160px;">Multiplier</label>
            <input type="range" id="op-rs-mult-range" min="1" max="64" step="0.1" style="flex:1;">
            <input type="number" id="op-rs-mult-input" class="op-input op-rs-mini" min="1" step="0.05">
          </div>

          <div class="op-rs-row">
            <input type="checkbox" id="op-rs-bind" checked>
            <label for="op-rs-bind">Bind X/Y block sizes</label>
          </div>

          <div class="op-rs-row">
            <label style="width:160px;">Block W / H</label>
            <input type="number" id="op-rs-blockw" class="op-input op-rs-mini" min="1" step="0.1">
            <input type="number" id="op-rs-blockh" class="op-input op-rs-mini" min="1" step="0.1">
          </div>

          <div class="op-rs-row">
            <label style="width:160px;">Offset X / Y</label>
            <input type="number" id="op-rs-offx" class="op-input op-rs-mini" min="0" step="0.1">
            <input type="number" id="op-rs-offy" class="op-input op-rs-mini" min="0" step="0.1">
          </div>

          <div class="op-rs-row">
            <label style="width:160px;">Dot radius</label>
            <input type="range" id="op-rs-dotr" min="1" max="8" step="1" style="flex:1;">
            <span id="op-rs-dotr-val" class="op-muted" style="width:36px; text-align:right;"></span>
          </div>

          <div class="op-rs-row">
            <input type="checkbox" id="op-rs-grid" checked>
            <label for="op-rs-grid">Show grid wireframe</label>
          </div>

          <div class="op-rs-grid-note" id="op-rs-adv-note">Align red dots to block centers. Drag to pan; use buttons or Ctrl+wheel to zoom.</div>

          <div class="op-rs-row" style="margin-top:8px;">
            <label style="width:160px;">Calculated preview</label>
            <span class="op-muted" id="op-rs-adv-resmeta"></span>
          </div>
          <div class="op-rs-preview-wrap" id="op-rs-adv-result-wrap" style="height: clamp(200px, 26vh, 420px);">
            <canvas id="op-rs-adv-result" class="op-rs-canvas"></canvas>
          </div>
        </div>
      </div>

      <div class="op-rs-footer">
        <div class="op-cc-ghost" id="op-rs-meta">Nearest-neighbor OR grid center sampling; alpha hardened (no semi-transparent pixels).</div>
        <div class="op-cc-actions">
          <button class="op-button" id="op-rs-calc">Calculate</button>
          <button class="op-button" id="op-rs-apply">Apply</button>
          <button class="op-button" id="op-rs-cancel">Cancel</button>
        </div>
      </div>
  `;
  document.body.appendChild(modal);

  const refs: RSRefs = {
    backdrop,
    modal,
    tabSimple: modal.querySelector('#op-rs-tab-simple') as HTMLButtonElement,
    tabAdvanced: modal.querySelector('#op-rs-tab-advanced') as HTMLButtonElement,
    paneSimple: modal.querySelector('#op-rs-pane-simple') as HTMLDivElement,
    paneAdvanced: modal.querySelector('#op-rs-pane-advanced') as HTMLDivElement,
    orig: modal.querySelector('#op-rs-orig') as HTMLInputElement,
    w: modal.querySelector('#op-rs-w') as HTMLInputElement,
    h: modal.querySelector('#op-rs-h') as HTMLInputElement,
    lock: modal.querySelector('#op-rs-lock') as HTMLInputElement,
    note: modal.querySelector('#op-rs-note') as any,
    onex: modal.querySelector('#op-rs-onex') as HTMLButtonElement,
    half: modal.querySelector('#op-rs-half') as HTMLButtonElement,
    third: modal.querySelector('#op-rs-third') as HTMLButtonElement,
    quarter: modal.querySelector('#op-rs-quarter') as HTMLButtonElement,
    double: modal.querySelector('#op-rs-double') as HTMLButtonElement,
    scale: modal.querySelector('#op-rs-scale') as HTMLInputElement,
    applyScale: modal.querySelector('#op-rs-apply-scale') as HTMLButtonElement,
    simWrap: modal.querySelector('#op-rs-sim-wrap') as HTMLDivElement,
    simOrig: modal.querySelector('#op-rs-sim-orig') as HTMLCanvasElement,
    simNew: modal.querySelector('#op-rs-sim-new') as HTMLCanvasElement,
    colLeft: modal.querySelector('#op-rs-col-left') as HTMLDivElement,
    colRight: modal.querySelector('#op-rs-col-right') as HTMLDivElement,

    advWrap: modal.querySelector('#op-rs-adv-wrap') as HTMLDivElement,
    preview: modal.querySelector('#op-rs-preview') as HTMLCanvasElement,

    meta: modal.querySelector('#op-rs-meta') as HTMLElement,

    zoomIn: modal.querySelector('#op-rs-zoom-in') as HTMLButtonElement,
    zoomOut: modal.querySelector('#op-rs-zoom-out') as HTMLButtonElement,

    multRange: modal.querySelector('#op-rs-mult-range') as HTMLInputElement,
    multInput: modal.querySelector('#op-rs-mult-input') as HTMLInputElement,
    bind: modal.querySelector('#op-rs-bind') as HTMLInputElement,
    blockW: modal.querySelector('#op-rs-blockw') as HTMLInputElement,
    blockH: modal.querySelector('#op-rs-blockh') as HTMLInputElement,
    offX: modal.querySelector('#op-rs-offx') as HTMLInputElement,
    offY: modal.querySelector('#op-rs-offy') as HTMLInputElement,
    dotR: modal.querySelector('#op-rs-dotr') as HTMLInputElement,
    dotRVal: modal.querySelector('#op-rs-dotr-val') as HTMLElement,
    gridToggle: modal.querySelector('#op-rs-grid') as HTMLInputElement,
    advNote: modal.querySelector('#op-rs-adv-note') as HTMLElement,
    resWrap: modal.querySelector('#op-rs-adv-result-wrap') as HTMLDivElement,
    resCanvas: modal.querySelector('#op-rs-adv-result') as HTMLCanvasElement,
    resMeta: modal.querySelector('#op-rs-adv-resmeta') as HTMLElement,

    calcBtn: modal.querySelector('#op-rs-calc') as HTMLButtonElement,
    applyBtn: modal.querySelector('#op-rs-apply') as HTMLButtonElement,
    cancelBtn: modal.querySelector('#op-rs-cancel') as HTMLButtonElement,
    closeBtn: modal.querySelector('#op-rs-close') as HTMLButtonElement,
  };

  const ctxPrev: CanvasRenderingContext2D = (() => {
    const ctx = refs.preview.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2d context for preview canvas.');
    return ctx;
  })();
  const ctxSimOrig: CanvasRenderingContext2D = (() => {
    const ctx = refs.simOrig.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2d context for simOrig canvas.');
    return ctx;
  })();
  const ctxSimNew: CanvasRenderingContext2D = (() => {
    const ctx = refs.simNew.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2d context for simNew canvas.');
    return ctx;
  })();
  const ctxRes: CanvasRenderingContext2D = (() => {
    const ctx = refs.resCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2d context for resCanvas.');
    return ctx;
  })();

  rs = {
    ...refs,
    ov: null,
    img: null,
    origW: 0, origH: 0,
    mode: 'simple',
    zoom: 1.0,
    updating: false,

    mult: 4,
    gapX: 4, gapY: 4,
    offx: 0, offy: 0,
    dotr: 1,

    viewX: 0, viewY: 0,

    panning: false,
    panStart: null,

    calcCanvas: null,
    calcCols: 0,
    calcRows: 0,
    calcReady: false,
  };

  const s = rs; // local non-null alias within this scope

  function computeSimpleFooterText() {
    const W = parseInt(s.w.value || '0', 10);
    const H = parseInt(s.h.value || '0', 10);
    const ok = Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0;
    const limit = (W >= MAX_OVERLAY_DIM || H >= MAX_OVERLAY_DIM);
    return ok ? (limit ? `Target: ${W}×${H} (exceeds limit: must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})`
                       : `Target: ${W}×${H} (OK)`)
              : 'Enter positive width and height.';
  }
  function sampleDims() {
    const cols = Math.floor((s.origW - s.offx) / s.gapX);
    const rows = Math.floor((s.origH - s.offy) / s.gapY);
    return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
  }
  function computeAdvancedFooterText() {
    const { cols, rows } = sampleDims();
    const limit = (cols >= MAX_OVERLAY_DIM || rows >= MAX_OVERLAY_DIM);
    return (cols > 0 && rows > 0)
      ? `Samples: ${cols} × ${rows} | Output: ${cols}×${rows}${limit ? ` (exceeds limit: < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})` : ''}`
      : 'Adjust multiplier/offset until dots sit at centers.';
  }
  const updateFooterMeta = () => {
    s.meta.textContent = (s.mode === 'advanced') ? computeAdvancedFooterText() : computeSimpleFooterText();
  };

  function drawSimplePreview() {
    if (!s.img) return;
    const padTopL = s.colLeft.querySelector('.pad-top') as HTMLElement | null;
    const padTopR = s.colRight.querySelector('.pad-top') as HTMLElement | null;
    const leftLabelH = padTopL ? padTopL.clientHeight : 0;
    const rightLabelH = padTopR ? padTopR.clientHeight : 0;
    const leftW = s.colLeft.clientWidth;
    const rightW = s.colRight.clientWidth;
    const leftH = s.colLeft.clientHeight - leftLabelH;
    const rightH = s.colRight.clientHeight - rightLabelH;

    s.simOrig.width = leftW; s.simOrig.height = leftH;
    s.simNew.width  = rightW; s.simNew.height = rightH;

    ctxSimOrig.save();
    ctxSimOrig.imageSmoothingEnabled = false;
    ctxSimOrig.clearRect(0,0,leftW,leftH);
    const sFit = Math.min(leftW / s.origW, leftH / s.origH);
    const dW = Math.max(1, Math.floor(s.origW * sFit));
    const dH = Math.max(1, Math.floor(s.origH * sFit));
    const dx0 = Math.floor((leftW - dW) / 2);
    const dy0 = Math.floor((leftH - dH) / 2);
    ctxSimOrig.drawImage(s.img, 0,0, s.origW,s.origH, dx0,dy0, dW,dH);
    ctxSimOrig.restore();

    const W = parseInt(s.w.value || '0', 10);
    const H = parseInt(s.h.value || '0', 10);
    ctxSimNew.save();
    ctxSimNew.imageSmoothingEnabled = false;
    ctxSimNew.clearRect(0,0,rightW,rightH);
    if (Number.isFinite(W) && Number.isFinite(H) && W>0 && H>0) {
      const tiny = createCanvas(W, H) as HTMLCanvasElement;
      const tctx = tiny.getContext('2d', { willReadFrequently: true });
      if (!tctx) throw new Error('Failed to get 2d context for tiny canvas.');
      tctx.imageSmoothingEnabled = false;
      tctx.clearRect(0,0,W,H);
      tctx.drawImage(s.img, 0,0, s.origW,s.origH, 0,0, W,H);
      const id = tctx.getImageData(0,0,W,H);
      const data = id.data;
      for (let i=0;i<data.length;i+=4) { if (data[i+3] !== 0) data[i+3]=255; }
      tctx.putImageData(id, 0, 0);

      const s2 = Math.min(rightW / W, rightH / H);
      const dW2 = Math.max(1, Math.floor(W * s2));
      const dH2 = Math.max(1, Math.floor(H * s2));
      const dx2 = Math.floor((rightW - dW2)/2);
      const dy2 = Math.floor((rightH - dH2)/2);
      ctxSimNew.drawImage(tiny, 0,0, W,H, dx2,dy2, dW2,dH2);
    } else {
      ctxSimNew.drawImage(s.img, 0,0, s.origW,s.origH, dx0,dy0, dW,dH);
    }
    ctxSimNew.restore();
  }

  function syncAdvancedMeta() {
    sampleDims();
    if (s.mode === 'advanced') {
      s.applyBtn.disabled = !s.calcReady;
    } else {
      const W = parseInt(s.w.value||'0',10), H = parseInt(s.h.value||'0',10);
      const ok = Number.isFinite(W)&&Number.isFinite(H)&&W>0&&H>0&&W<MAX_OVERLAY_DIM&&H<MAX_OVERLAY_DIM;
      s.applyBtn.disabled = !ok;
    }
    updateFooterMeta();
  }
  function drawAdvancedPreview() {
    if (s.mode !== 'advanced' || !s.img) return;
    const w = s.origW, h = s.origH;

    const destW = Math.max(50, Math.floor(s.advWrap.clientWidth));
    const destH = Math.max(50, Math.floor(s.advWrap.clientHeight));
    s.preview.width = destW;
    s.preview.height = destH;

    const sw = Math.max(1, Math.floor(destW / s.zoom));
    const sh = Math.max(1, Math.floor(destH / s.zoom));
    const maxX = Math.max(0, w - sw);
    const maxY = Math.max(0, h - sh);
    s.viewX = Math.min(Math.max(0, s.viewX), maxX);
    s.viewY = Math.min(Math.max(0, s.viewY), maxY);

    ctxPrev.save();
    ctxPrev.imageSmoothingEnabled = false;
    ctxPrev.clearRect(0,0,destW,destH);
    ctxPrev.drawImage(s.img, s.viewX, s.viewY, sw, sh, 0, 0, destW, destH);

    if (s.gridToggle.checked && s.gapX >= 1 && s.gapY >= 1) {
      ctxPrev.strokeStyle = 'rgba(255,59,48,0.45)';
      ctxPrev.lineWidth = 1;
      const startGX = Math.ceil((s.viewX - s.offx) / s.gapX);
      const endGX   = Math.floor((s.viewX + sw - s.offx) / s.gapX);
      const startGY = Math.ceil((s.viewY - s.offy) / s.gapY);
      const endGY   = Math.floor((s.viewY + sh - s.offy) / s.gapY);
      const linesX = Math.max(0, endGX - startGX + 1);
      const linesY = Math.max(0, endGY - startGY + 1);
      if (linesX <= 4000 && linesY <= 4000) {
        ctxPrev.beginPath();
        for (let gx = startGX; gx <= endGX; gx++) {
          const x = s.offx + gx * s.gapX;
          const px = Math.round((x - s.viewX) * s.zoom);
          ctxPrev.moveTo(px + 0.5, 0);
          ctxPrev.lineTo(px + 0.5, destH);
        }
        for (let gy = startGY; gy <= endGY; gy++) {
          const y = s.offy + gy * s.gapY;
          const py = Math.round((y - s.viewY) * s.zoom);
          ctxPrev.moveTo(0, py + 0.5);
          ctxPrev.lineTo(destW, py + 0.5);
        }
        ctxPrev.stroke();
      }
    }

    if (s.gapX >= 1 && s.gapY >= 1) {
      ctxPrev.fillStyle = '#ff3b30';
      const cx0 = s.offx + Math.floor(s.gapX/2);
      const cy0 = s.offy + Math.floor(s.gapY/2);
      if (cx0 >= 0 && cy0 >= 0) {
        const startX = Math.ceil((s.viewX - cx0) / s.gapX);
        const startY = Math.ceil((s.viewY - cy0) / s.gapY);
        const endY = Math.floor((s.viewY + sh - 1 - cy0) / s.gapY);
        const endX2 = Math.floor((s.viewX + sw - 1 - cx0) / s.gapX);
        const r = s.dotr;
        const dotsX = Math.max(0, endX2 - startX + 1);
        const dotsY = Math.max(0, endY - startY + 1);
        const maxDots = 300000;
        if (dotsX * dotsY <= maxDots) {
          for (let gy = startY; gy <= endY; gy++) {
            const y = cy0 + gy * s.gapY;
            for (let gx = startX; gx <= endX2; gx++) {
              const x = cx0 + gx * s.gapX;
              const px = Math.round((x - s.viewX) * s.zoom);
              const py = Math.round((y - s.viewY) * s.zoom);
              ctxPrev.beginPath();
              ctxPrev.arc(px, py, r, 0, Math.PI*2);
              ctxPrev.fill();
            }
          }
        }
      }
    }
    ctxPrev.restore();
  }

  function drawAdvancedResultPreview() {
    const canvas = s.calcCanvas;
    const wrap = s.resWrap;
    if (!wrap || !canvas) {
      ctxRes.clearRect(0,0, s.resCanvas.width, s.resCanvas.height);
      s.resMeta.textContent = 'No result. Click Calculate.';
      return;
    }
    const W = canvas.width, H = canvas.height;
    const availW = Math.max(50, Math.floor(wrap.clientWidth - 16));
    const availH = Math.max(50, Math.floor(wrap.clientHeight - 16));
    const scale = Math.min(availW / W, availH / H);
    const dW = Math.max(1, Math.floor(W * scale));
    const dH = Math.max(1, Math.floor(H * scale));
    s.resCanvas.width = dW;
    s.resCanvas.height = dH;
    ctxRes.save();
    ctxRes.imageSmoothingEnabled = false;
    ctxRes.clearRect(0,0,dW,dH);
    ctxRes.drawImage(canvas, 0,0, W,H, 0,0, dW,dH);
    ctxRes.restore();
    s.resMeta.textContent = `Output: ${W}×${H}${(W>=MAX_OVERLAY_DIM||H>=MAX_OVERLAY_DIM) ? ` (exceeds limit: < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})` : ''}`;
  }

  s._drawSimplePreview = drawSimplePreview;
  s._drawAdvancedPreview = drawAdvancedPreview;
  s._drawAdvancedResultPreview = drawAdvancedResultPreview;

  const setMode = (m: 'simple'|'advanced') => {
    s.mode = m;
    s.tabSimple.classList.toggle('active', m === 'simple');
    s.tabAdvanced.classList.toggle('active', m === 'advanced');
    s.paneSimple.classList.toggle('show', m === 'simple');
    s.paneAdvanced.classList.toggle('show', m === 'advanced');
    updateFooterMeta();

    s.calcBtn.style.display = (m === 'advanced') ? 'inline-block' : 'none';
    if (m === 'advanced') {
      s.applyBtn.disabled = !s.calcReady;
    } else {
      syncSimpleNote();
    }

    syncAdvancedMeta();
    if (m === 'advanced') {
      drawAdvancedPreview();
      drawAdvancedResultPreview();
    } else {
      drawSimplePreview();
    }
  };
  s._setMode = (m) => {
    const evt = new Event('click');
    (m === 'simple' ? s.tabSimple : s.tabAdvanced).dispatchEvent(evt);
  };
  s.tabSimple.addEventListener('click', () => setMode('simple'));
  s.tabAdvanced.addEventListener('click', () => setMode('advanced'));

  function onWidthInput() {
    if (s.updating) return;
    s.updating = true;
    const W = parseInt(s.w.value||'0',10);
    if (s.lock.checked && s.origW>0 && s.origH>0 && W>0) {
      s.h.value = String(Math.max(1, Math.round(W * s.origH / s.origW)));
    }
    s.updating = false;
    syncSimpleNote();
    if (s.mode === 'simple') drawSimplePreview();
  }
  function onHeightInput() {
    if (s.updating) return;
    s.updating = true;
    const H = parseInt(s.h.value||'0',10);
    if (s.lock.checked && s.origW>0 && s.origH>0 && H>0) {
      s.w.value = String(Math.max(1, Math.round(H * s.origW / s.origH)));
    }
    s.updating = false;
    syncSimpleNote();
    if (s.mode === 'simple') drawSimplePreview();
  }
  s.w.addEventListener('input', onWidthInput);
  s.h.addEventListener('input', onHeightInput);
  s.onex.addEventListener('click', () => { applyScaleToFields(1); drawSimplePreview(); });
  s.half.addEventListener('click', () => { applyScaleToFields(0.5); drawSimplePreview(); });
  s.third.addEventListener('click', () => { applyScaleToFields(1/3); drawSimplePreview(); });
  s.quarter.addEventListener('click', () => { applyScaleToFields(1/4); drawSimplePreview(); });
  s.double.addEventListener('click', () => { applyScaleToFields(2); drawSimplePreview(); });
  s.applyScale.addEventListener('click', () => {
    const scaleVal = parseFloat(s.scale.value||'');
    if (!Number.isFinite(scaleVal) || scaleVal<=0) { showToast('Enter a valid scale factor > 0'); return; }
    applyScaleToFields(scaleVal);
    drawSimplePreview();
  });

  const markCalcStale = () => {
    if (s.mode === 'advanced') {
      s.calcReady = false;
      s.applyBtn.disabled = true;
      drawAdvancedResultPreview();
      updateFooterMeta();
    }
  };

  const onMultChange = (v: string) => {
    if (s.updating) return;
    const parsed = parseFloat(v);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 1), 128);
    s.mult = clamped;
    if (s.bind.checked) { s.gapX = clamped; s.gapY = clamped; }
    syncAdvFieldsToState();
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  };
  s.multRange.addEventListener('input', (e) => onMultChange((e.target as HTMLInputElement).value));
  s.multInput.addEventListener('input', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (!Number.isFinite(parseFloat(v))) return;
    onMultChange(v);
  });
  s.bind.addEventListener('change', () => {
    if (s.bind.checked) { s.gapX = s.mult; s.gapY = s.mult; syncAdvFieldsToState(); }
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  });
  s.blockW.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(val)) return;
    s.gapX = Math.min(Math.max(val, 1), 4096);
    if (s.bind.checked) { s.mult = s.gapX; s.gapY = s.gapX; }
    syncAdvFieldsToState();
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  });
  s.blockH.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(val)) return;
    s.gapY = Math.min(Math.max(val, 1), 4096);
    if (s.bind.checked) { s.mult = s.gapY; s.gapX = s.gapY; }
    syncAdvFieldsToState();
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  });
  s.offX.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(val)) return;
    s.offx = Math.min(Math.max(val, 0), Math.max(0, s.origH-0.0001));
    s.viewX = Math.min(s.viewX, Math.max(0, s.origW - 1));
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  });
  s.offY.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(val)) return;
    s.offy = Math.min(Math.max(val, 0), Math.max(0, s.origH-0.0001));
    s.viewY = Math.min(s.viewY, Math.max(0, s.origH - 1));
    syncAdvancedMeta();
    drawAdvancedPreview();
    markCalcStale();
  });
  s.dotR.addEventListener('input', (e) => {
    s.dotr = Math.max(1, Math.round(Number((e.target as HTMLInputElement).value)||1));
    s.dotRVal.textContent = String(s.dotr);
    drawAdvancedPreview();
  });
  s.gridToggle.addEventListener('change', drawAdvancedPreview);

  function applyZoom(factor: number) {
    const destW = Math.max(50, Math.floor(s.advWrap.clientWidth));
    const destH = Math.max(50, Math.floor(s.advWrap.clientHeight));
    const sw = Math.max(1, Math.floor(destW / s.zoom));
    const sh = Math.max(1, Math.floor(destH / s.zoom));
    const cx = s.viewX + sw / 2;
    const cy = s.viewY + sh / 2;
    s.zoom = Math.min(32, Math.max(0.1, s.zoom * factor));
    const sw2 = Math.max(1, Math.floor(destW / s.zoom));
    const sh2 = Math.max(1, Math.floor(destH / s.zoom));
    s.viewX = Math.min(Math.max(0, Math.round(cx - sw2 / 2)), Math.max(0, s.origW - sw2));
    s.viewY = Math.min(Math.max(0, Math.round(cy - sh2 / 2)), Math.max(0, s.origH - sh2));
    drawAdvancedPreview();
  }
  s.zoomIn.addEventListener('click', () => applyZoom(1.25));
  s.zoomOut.addEventListener('click', () => applyZoom(1/1.25));
  s.advWrap.addEventListener('wheel', (e) => {
    if (!(e as WheelEvent).ctrlKey) return;
    e.preventDefault();
    const delta = (e as WheelEvent).deltaY || 0;
    applyZoom(delta > 0 ? 1/1.15 : 1.15);
  }, { passive: false });

  const onPanDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.op-rs-zoom')) return;
    s.panning = true;
    s.panStart = { x: e.clientX, y: e.clientY, viewX: s.viewX, viewY: s.viewY };
    s.advWrap.classList.remove('op-pan-grab');
    s.advWrap.classList.add('op-pan-grabbing');
    (s.advWrap as any).setPointerCapture?.(e.pointerId);
  };
  const onPanMove = (e: PointerEvent) => {
    if (!s.panning || !s.panStart) return;
    const dx = e.clientX - s.panStart.x;
    const dy = e.clientY - s.panStart.y;
    const wrapW = s.advWrap.clientWidth;
    const wrapH = s.advWrap.clientHeight;
    const sw = Math.max(1, Math.floor(wrapW / s.zoom));
    const sh = Math.max(1, Math.floor(wrapH / s.zoom));
    let nx = s.panStart.viewX - Math.round(dx / s.zoom);
    let ny = s.panStart.viewY - Math.round(dy / s.zoom);
    nx = Math.min(Math.max(0, nx), Math.max(0, s.origW - sw));
    ny = Math.min(Math.max(0, ny), Math.max(0, s.origH - sh));
    s.viewX = nx;
    s.viewY = ny;
    drawAdvancedPreview();
  };
  const onPanUp = (e: PointerEvent) => {
    if (!s.panning) return;
    s.panning = false;
    s.panStart = null;
    s.advWrap.classList.remove('op-pan-grabbing');
    s.advWrap.classList.add('op-pan-grab');
    (s.advWrap as any).releasePointerCapture?.(e.pointerId);
  };
  s.advWrap.addEventListener('pointerdown', onPanDown);
  s.advWrap.addEventListener('pointermove', onPanMove);
  s.advWrap.addEventListener('pointerup', onPanUp);
  s.advWrap.addEventListener('pointercancel', onPanUp);
  s.advWrap.addEventListener('pointerleave', onPanUp);

  const close = () => closeRSModal();
  s.cancelBtn.addEventListener('click', close);
  s.closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  s.calcBtn.addEventListener('click', async () => {
    if (s.mode !== 'advanced' || !s.img) return;
    try {
      const { cols, rows } = sampleDims();
      if (cols<=0 || rows<=0) { showToast('No samples. Adjust multiplier/offset.'); return; }
      if (cols >= MAX_OVERLAY_DIM || rows >= MAX_OVERLAY_DIM) { showToast(`Output too large. Must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM}.`); return; }
      const canvas = await reconstructViaGrid(s.img, s.origW, s.origH, s.offx, s.offy, s.gapX, s.gapY);
      s.calcCanvas = canvas;
      s.calcCols = cols;
      s.calcRows = rows;
      s.calcReady = true;
      s.applyBtn.disabled = false;
      drawAdvancedResultPreview();
      updateFooterMeta();
      showToast(`Calculated ${cols}×${rows}. Review preview, then Apply.`);
    } catch (e) {
      console.error(e);
      showToast('Calculation failed.');
    }
  });

  s.applyBtn.addEventListener('click', async () => {
    if (!s.ov) return;
    try {
      if (s.mode === 'simple') {
        const W = parseInt(s.w.value||'0',10);
        const H = parseInt(s.h.value||'0',10);
        if (!Number.isFinite(W) || !Number.isFinite(H) || W<=0 || H<=0) { showToast('Invalid dimensions'); return; }
        if (W >= MAX_OVERLAY_DIM || H >= MAX_OVERLAY_DIM) { showToast(`Too large. Must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM}.`); return; }
        await resizeOverlayImage(s.ov, W, H);
        closeRSModal();
        showToast(`Resized to ${W}×${H}.`);
      } else {
        if (!s.calcReady || !s.calcCanvas) { showToast('Calculate first.'); return; }
        const dataUrl = await canvasToDataURLSafe(s.calcCanvas);
        s.ov.imageBase64 = dataUrl;
        s.ov.imageUrl = null;
        s.ov.isLocal = true;
        await saveConfig(['overlays']);
        clearOverlayCache();
        ensureHook();
        emitOverlayChanged();
        closeRSModal();
        showToast(`Applied ${s.calcCols}×${s.calcRows}.`);
      }
    } catch (e) {
      console.error(e);
      showToast('Apply failed.');
    }
  });

  function syncSimpleNote() {
    const W = parseInt(s.w.value||'0',10);
    const H = parseInt(s.h.value||'0',10);
    const ok = Number.isFinite(W) && Number.isFinite(H) && W>0 && H>0;
    const limit = (W >= MAX_OVERLAY_DIM || H >= MAX_OVERLAY_DIM);
    const simpleText = ok
      ? (limit ? `Target: ${W}×${H} (exceeds limit: must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})`
               : `Target: ${W}×${H} (OK)`)
      : 'Enter positive width and height.';
    if (s.note) s.note.textContent = simpleText;
    if (s.mode === 'simple') s.applyBtn.disabled = (!ok || limit);
    if (s.mode === 'simple') s.meta.textContent = simpleText;
  }
  function applyScaleToFields(scale: number) {
    const W = Math.max(1, Math.round(s.origW * scale));
    const H = Math.max(1, Math.round(s.origH * scale));
    s.updating = true;
    s.w.value = String(W);
    s.h.value = s.lock.checked ? String(Math.max(1, Math.round(W * s.origH / s.origW))) : String(H);
    s.updating = false;
    syncSimpleNote();
  }
  function syncAdvFieldsToState() {
    s.updating = true;
    s.multRange.value = String(s.mult);
    s.multInput.value = String(s.mult);
    s.blockW.value = String(s.gapX);
    s.blockH.value = String(s.gapY);
    s.offX.value = String(s.offx);
    s.offY.value = String(s.offy);
    s.dotR.value = String(s.dotr);
    s.dotRVal.textContent = String(s.dotr);
    s.updating = false;
  }

  s._syncAdvancedMeta = syncAdvancedMeta;
  s._syncSimpleNote = syncSimpleNote;

  s._resizeHandler = () => {
    if (!rs) return;
    if (rs.mode === 'simple') rs._drawSimplePreview?.();
    else {
      rs._drawAdvancedPreview?.();
      rs._drawAdvancedResultPreview?.();
    }
  };
  window.addEventListener('resize', s._resizeHandler);
}

export function openRSModal(overlay: any) {
  if (!rs) return;
  rs.ov = overlay;

  const img = new Image();
  img.onload = () => {
    const s = rs;
    if (!s) return;

    s.img = img;
    s.origW = img.width; s.origH = img.height;

    s.orig.value = `${s.origW}×${s.origH}`;
    s.w.value = String(s.origW);
    s.h.value = String(s.origH);
    s.lock.checked = true;

    s.zoom = 1.0;
    s.mult = 4;
    s.gapX = 4; s.gapY = 4;
    s.offx = 0; s.offy = 0;
    s.dotr = 1;
    s.viewX = 0; s.viewY = 0;

    s.bind.checked = true;
    s.multRange.value = '4';
    s.multInput.value = '4';
    s.blockW.value = '4';
    s.blockH.value = '4';
    s.offX.value = '0';
    s.offY.value = '0';
    s.dotR.value = '1';
    s.dotRVal.textContent = '1';
    s.gridToggle.checked = true;

    s.calcCanvas = null;
    s.calcCols = 0;
    s.calcRows = 0;
    s.calcReady = false;
    s.applyBtn.disabled = (s.mode === 'advanced');

    if (s._setMode) s._setMode('simple');

    document.body.classList.add('op-scroll-lock');
    s.backdrop.classList.add('show');
    s.modal.style.display = 'flex';

    s._drawSimplePreview?.();
    s._drawAdvancedPreview?.();
    s._drawAdvancedResultPreview?.();
    s._syncAdvancedMeta?.();
    s._syncSimpleNote?.();

    const setFooterNow = () => {
      if (!rs) return;
      if (rs.mode === 'advanced') {
        const cols = Math.floor((rs.origW - rs.offx) / rs.gapX);
        const rows = Math.floor((rs.origH - rs.offy) / rs.gapY);
        rs.meta.textContent = (cols>0&&rows>0) ? `Samples: ${cols} × ${rows} | Output: ${cols}×${rows}${(cols>=MAX_OVERLAY_DIM||rows>=MAX_OVERLAY_DIM)?` (exceeds limit: < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})`:''}` : 'Adjust multiplier/offset until dots sit at centers.';
      } else {
        const W = parseInt(rs.w.value||'0',10); const H = parseInt(rs.h.value||'0',10);
        const ok = Number.isFinite(W)&&Number.isFinite(H)&&W>0&&H>0;
        const limit = (W>=MAX_OVERLAY_DIM||H>=MAX_OVERLAY_DIM);
        rs.meta.textContent = ok ? (limit ? `Target: ${W}×${H} (exceeds limit: must be < ${MAX_OVERLAY_DIM}×${MAX_OVERLAY_DIM})` : `Target: ${W}×${H} (OK)`) : 'Enter positive width and height.';
      }
    };
    setFooterNow();
  };
  img.src = overlay.imageBase64;
}

function closeRSModal() {
  if (!rs) return;
  window.removeEventListener('resize', rs._resizeHandler || (()=>{}));
  rs.backdrop.classList.remove('show');
  rs.modal.style.display = 'none';
  rs.ov = null;
  rs.img = null;
  document.body.classList.remove('op-scroll-lock');
}

async function reconstructViaGrid(img: HTMLImageElement, origW: number, origH: number, offx: number, offy: number, gapX: number, gapY: number) {
  const srcCanvas = createCanvas(origW, origH) as HTMLCanvasElement;
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('Failed to get 2d context for srcCanvas.');
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0,0,origW,origH).data;

  const cols = Math.floor((origW - offx) / gapX);
  const rows = Math.floor((origH - offy) / gapY);
  if (cols <= 0 || rows <= 0) throw new Error('No samples available with current offset/gap');

  const outCanvas = createHTMLCanvas(cols, rows);
  const octx = outCanvas.getContext('2d');
  if (!octx) throw new Error('Failed to get 2d context for outCanvas.');
  const out = octx.createImageData(cols, rows);
  const odata = out.data;

  const cx0 = offx + gapX / 2;
  const cy0 = offy + gapY / 2;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  for (let ry=0; ry<rows; ry++) {
    for (let rx=0; rx<cols; rx++) {
      const sx = Math.round(clamp(cx0 + rx*gapX, 0, origW-1));
      const sy = Math.round(clamp(cy0 + ry*gapY, 0, origH-1));
      const si = (sy*origW + sx) * 4;

      const r = srcData[si];
      const g = srcData[si+1];
      const b = srcData[si+2];
      const a = srcData[si+3];

      const oi = (ry*cols + rx) * 4;
      if (a === 0) {
        odata[oi] = 0; odata[oi+1] = 0; odata[oi+2] = 0; odata[oi+3] = 0;
      } else {
        odata[oi] = r; odata[oi+1] = g; odata[oi+2] = b; odata[oi+3] = 255;
      }
    }
  }
  octx.putImageData(out, 0, 0);
  return outCanvas;
}

async function resizeOverlayImage(ov: any, targetW: number, targetH: number) {
  const img = await loadImage(ov.imageBase64);
  const canvas = createHTMLCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to get 2d context for resize canvas.');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,targetW,targetH);
  ctx.drawImage(img, 0,0, img.width,img.height, 0,0, targetW,targetH);
  const id = ctx.getImageData(0,0,targetW,targetH);
  const data = id.data;
  for (let i=0;i<data.length;i+=4) {
    if (data[i+3] === 0) { data[i]=0; data[i+1]=0; data[i+2]=0; data[i+3]=0; }
    else { data[i+3] = 255; }
  }
  ctx.putImageData(id, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  ov.imageBase64 = dataUrl;
  ov.imageUrl = null;
  ov.isLocal = true;
  await saveConfig(['overlays']);
  clearOverlayCache();
  ensureHook();
  emitOverlayChanged();
}