export function injectStyles() {
  if (document.getElementById('op-styles')) return;
  const style = document.createElement('style');
  style.id = 'op-styles';
  style.textContent = `
      body.op-theme-light {
        --op-bg: #ffffff;
        --op-border: #e6ebf2;
        --op-muted: #6b7280;
        --op-text: #111827;
        --op-subtle: #f4f6fb;
        --op-btn: #eef2f7;
        --op-btn-border: #d8dee8;
        --op-btn-hover: #e7ecf5;
        --op-accent: #1e88e5;
      }
      body.op-theme-dark {
        --op-bg: #1b1e24;
        --op-border: #2a2f3a;
        --op-muted: #a0a7b4;
        --op-text: #f5f6f9;
        --op-subtle: #151922;
        --op-btn: #262b36;
        --op-btn-border: #384050;
        --op-btn-hover: #2f3542;
        --op-accent: #64b5f6;
      }
      .op-scroll-lock { overflow: hidden !important; }

      #overlay-pro-panel {
        position: fixed; z-index: 9999; background: var(--op-bg); border: 1px solid var(--op-border);
        border-radius: 16px; color: var(--op-text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 14px; width: 340px; box-shadow: 0 10px 24px rgba(16,24,40,0.12), 0 2px 6px rgba(16,24,40,0.08); user-select: none;
      }
	  
	  #op-list-wrap { flex: 1; display: flex; height: 80%; }

      .op-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--op-border); border-radius: 16px 16px 0 0; cursor: grab; }
      .op-header:active { cursor: grabbing; }
      .op-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .op-header-actions { display: flex; gap: 6px; }
      .op-toggle-btn, .op-hdr-btn { background: transparent; border: 1px solid var(--op-border); color: var(--op-text); border-radius: 10px; padding: 4px 8px; cursor: pointer; }
      .op-toggle-btn:hover, .op-hdr-btn:hover { background: var(--op-btn); }

      .op-content { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .op-section { display: flex; flex-direction: column; gap: 8px; background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; padding: 5px; }
	  .op-section.resizable { display: flex; flex-direction: column; height: 300px; resize: vertical; overflow: hidden }

      .op-section-title { display: flex; align-items: center; justify-content: space-between; }
      .op-title-text { font-weight: 600; }
      .op-chevron { background: transparent; border: 1px solid var(--op-border); border-radius: 8px; padding: 2px 6px; cursor: pointer; }
      .op-chevron:hover { background: var(--op-btn); }

      .op-row { display: flex; align-items: center; gap: 8px; }
      .op-row.space { justify-content: space-between; }
      .op-row.center { justify-content: center; text-align: center; }
      .op-row-col { display: flex; flex-direction: column; gap: 4px; }
      .space-between { justify-content: space-between; }
      .op-small-text { font-size: 11px; color: var(--op-muted); }

      .op-button { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
      .op-button:hover { background: var(--op-btn-hover); }
      .op-button:disabled { opacity: 0.5; cursor: not-allowed; }
      .op-button.icon { width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }

      .op-input, .op-select { background: var(--op-bg); border: 1px solid var(--op-border); color: var(--op-text); border-radius: 10px; padding: 6px 8px; }
      .op-slider { width: 100%; }

      .op-list { display: flex; flex-direction: column; gap: 6px; height: 100%; overflow: auto; border: 1px solid var(--op-border); padding: 6px; border-radius: 10px; background: var(--op-bg); }

      .op-item { display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 8px; border: 1px solid var(--op-border); background: var(--op-subtle); }
      .op-item.active { outline: 2px solid color-mix(in oklab, var(--op-accent) 35%, transparent); background: var(--op-bg); }
      .op-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .op-muted { color: var(--op-muted); font-size: 12px; }

     .op-tabs { padding: 4px; border-bottom: 1px solid var(--op-border); }
     .op-tab-btn { flex: 1; padding: 6px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--op-text); cursor: pointer; }
     .op-tab-btn:hover { background: var(--op-btn-hover); }
     .op-tab-btn.active { background: var(--op-btn); border-color: var(--op-btn-border); font-weight: 600; }

     .op-mode-setting { display: none; padding: 6px; }
     .op-mode-setting.active { display: flex; flex-direction: column; gap: 8px; }

      .op-preview { width: 100%; height: 90px; background: var(--op-bg); display: flex; align-items: center; justify-content: center; border: 2px dashed color-mix(in oklab, var(--op-accent) 40%, var(--op-border)); border-radius: 10px; overflow: hidden; position: relative; cursor: pointer; }
      .op-preview img { max-width: 100%; max-height: 100%; display: block; pointer-events: none; }
      .op-preview.drop-highlight { background: color-mix(in oklab, var(--op-accent) 12%, transparent); }
      .op-preview .op-drop-hint { position: absolute; bottom: 6px; right: 8px; font-size: 11px; color: var(--op-muted); pointer-events: none; }

      .op-icon-btn { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
      .op-icon-btn:hover { background: var(--op-btn-hover); }

      .op-danger { background: #fee2e2; border-color: #fecaca; color: #7f1d1d; }
      .op-danger-text { color: #dc2626; font-weight: 600; }

      .op-toast-stack { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; z-index: 999999; width: min(92vw, 480px); }
      .op-toast { background: rgba(255,255,255,0.98); border: 1px solid #e6ebf2; color: #111827; padding: 8px 12px; border-radius: 10px; font-size: 12px; box-shadow: 0 6px 16px rgba(16,24,40,0.12); opacity: 0; transform: translateY(-6px); transition: opacity .18s ease, transform .18s ease; max-width: 100%; text-align: center; }
      .op-toast.show { opacity: 1; transform: translateY(0); }
      .op-toast-stack.op-dark .op-toast { background: rgba(27,30,36,0.98); border-color: #2a2f3a; color: #f5f6f9; }
      .op-toast.op-toast-error { background: #fee2e2; border-color: #fecaca; color: #7f1d1d; }
      .op-toast-stack.op-dark .op-toast.op-toast-error { background: #4a1f1f; border-color: #5b2d2d; color: #fecaca; }
      .op-toast.op-toast-success { background: #dcfce7; border-color: #bbf7d0; color: #14532d; }
      .op-toast-stack.op-dark .op-toast.op-toast-success { background: #163822; border-color: #225a35; color: #bbf7d0; }

      .op-cc-backdrop { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.45); display: none; }
      .op-cc-backdrop.show { display: block; }

      .op-cc-modal {
        position: fixed; z-index: 10001;
        width: min(1280px, 98vw);
        max-height: 92vh;
        left: 50%; top: 50%; transform: translate(-50%, -50%);
        background: var(--op-bg); color: var(--op-text);
        border: 1px solid var(--op-border);
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.28);
        display: none; flex-direction: column;
      }
      .op-cc-header { padding: 10px 12px; border-bottom: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; user-select: none; cursor: default; }
      .op-cc-title { font-weight: 600; }
      .op-cc-close { border: 1px solid var(--op-border); background: transparent; border-radius: 8px; padding: 4px 8px; cursor: pointer; }
      .op-cc-close:hover { background: var(--op-btn); }
      .op-cc-pill { border-radius: 999px; padding: 4px 10px; border: 1px solid var(--op-border); background: var(--op-bg); }

      .op-cc-body {
        display: grid;
        grid-template-columns: 2fr 420px;
        grid-template-areas: "preview controls";
        gap: 12px;
        padding: 12px;
        overflow: hidden;
      }
      @media (max-width: 860px) {
        .op-cc-body { grid-template-columns: 1fr; grid-template-areas: "preview" "controls"; max-height: calc(92vh - 100px); overflow: auto; }
      }

      .op-cc-preview-wrap { grid-area: preview; background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; position: relative; min-height: 320px; display: flex; align-items: center; justify-content: center; overflow: auto; }
      .op-cc-canvas { image-rendering: pixelated; }
      .op-cc-zoom { position: absolute; top: 8px; right: 8px; display: inline-flex; gap: 6px; }
      .op-cc-zoom .op-icon-btn { width: 34px; height: 34px; }

      .op-cc-controls { grid-area: controls; display: flex; flex-direction: column; gap: 12px; background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; padding: 10px; overflow: auto; max-height: calc(92vh - 160px); }
      .op-cc-block { display: flex; flex-direction: column; gap: 6px; }
      .op-cc-block label { color: var(--op-muted); font-weight: 600; }

      .op-cc-palette { display: flex; flex-direction: column; gap: 8px; background: var(--op-bg); border: 1px dashed var(--op-border); border-radius: 10px; padding: 8px; }
      .op-cc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(22px, 22px)); gap: 6px; }
      .op-cc-cell { width: 22px; height: 22px; border-radius: 4px; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.15) inset; cursor: pointer; }
      .op-cc-cell.active { outline: 2px solid var(--op-accent); }

      .op-cc-footer { padding: 10px 12px; border-top: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .op-cc-actions { display: inline-flex; gap: 8px; }
      .op-cc-ghost { color: var(--op-muted); font-size: 12px; }

      .op-rs-backdrop { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.45); display: none; }
      .op-rs-backdrop.show { display: block; }

      .op-rs-modal {
        position: fixed; z-index: 10001;
        width: min(1200px, 96vw);
        left: 50%; top: 50%; transform: translate(-50%, -50%);
        background: var(--op-bg); color: var(--op-text);
        border: 1px solid var(--op-border);
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.28);
        display: none; flex-direction: column;
        max-height: 92vh;
      }
      .op-rs-header { padding: 10px 12px; border-bottom: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; user-select: none; cursor: default; }
      .op-rs-title { font-weight: 600; }
      .op-rs-close { border: 1px solid var(--op-border); background: transparent; border-radius: 8px; padding: 4px 8px; cursor: pointer; }
      .op-rs-close:hover { background: var(--op-btn); }

      .op-rs-tabs { display: flex; gap: 6px; padding: 8px 12px 0 12px; }
      .op-rs-tab-btn { background: var(--op-btn); color: var(--op-text); border: 1px solid var(--op-btn-border); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
      .op-rs-tab-btn.active { outline: 2px solid color-mix(in oklab, var(--op-accent) 35%, transparent); background: var(--op-btn-hover); }

      .op-rs-body { padding: 12px; display: grid; grid-template-columns: 1fr; gap: 10px; overflow: auto; }
      .op-rs-row { display: flex; align-items: center; gap: 8px; }
      .op-rs-row .op-input { flex: 1; }

      .op-rs-pane { display: none; }
      .op-rs-pane.show { display: block; }

      .op-rs-preview-wrap { background: var(--op-subtle); border: 1px solid var(--op-border); border-radius: 12px; position: relative; height: clamp(260px, 36vh, 540px); display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .op-rs-canvas { image-rendering: pixelated; }

      .op-rs-zoom { position: absolute; top: 8px; right: 8px; display: inline-flex; gap: 6px; }

      .op-rs-grid-note { color: var(--op-muted); font-size: 12px; }
      .op-rs-mini { width: 96px; }

      .op-rs-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; }
      .op-rs-col { position: relative; background: var(--op-bg); border: 1px dashed var(--op-border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow: hidden; }
      .op-rs-col .label { position: absolute; top: 2px; left: 0; right: 0; text-align: center; font-size: 12px; color: var(--op-muted); pointer-events: none; }
      .op-rs-col .pad-top { height: 18px; width: 100%; flex: 0 0 auto; }
      .op-rs-thumb { width: 100%; height: calc(100% - 18px); display: block; }

      .op-pan-grab { cursor: grab; }
      .op-pan-grabbing { cursor: grabbing; }

      .op-rs-footer { padding: 10px 12px; border-top: 1px solid var(--op-border); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  `;
  document.head.appendChild(style);
}