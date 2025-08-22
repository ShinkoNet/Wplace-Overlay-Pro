import { WPLACE_FREE, WPLACE_PAID, SYMBOL_TILES, SYMBOL_W, SYMBOL_H } from './palette';
import { config } from './store';

const ALL_COLORS = [...WPLACE_FREE, ...WPLACE_PAID];
let paletteObserver: MutationObserver | null = null;
let isInjected = false;

function createSymbolCanvas(colorIndex: number, _bgColor: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 20;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  // Clear with transparency
  ctx.clearRect(0, 0, 20, 20);

  if (colorIndex < SYMBOL_TILES.length) {
    const symbol = SYMBOL_TILES[colorIndex];
    const scale = 3;
    const offsetX = Math.floor((20 - SYMBOL_W * scale) / 2);
    const offsetY = Math.floor((20 - SYMBOL_H * scale) / 2);

    // Draw white outline first (slightly larger)
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < SYMBOL_H; y++) {
      for (let x = 0; x < SYMBOL_W; x++) {
        const bitIndex = y * SYMBOL_W + x;
        const bit = (symbol >>> bitIndex) & 1;
        
        if (bit) {
          ctx.fillRect(
            offsetX + x * scale - 1, 
            offsetY + y * scale - 1, 
            scale + 2, 
            scale + 2
          );
        }
      }
    }

    // Draw black symbol on top
    ctx.fillStyle = '#000000';
    for (let y = 0; y < SYMBOL_H; y++) {
      for (let x = 0; x < SYMBOL_W; x++) {
        const bitIndex = y * SYMBOL_W + x;
        const bit = (symbol >>> bitIndex) & 1;
        
        if (bit) {
          ctx.fillRect(
            offsetX + x * scale, 
            offsetY + y * scale, 
            scale, 
            scale
          );
        }
      }
    }
  }

  return canvas;
}

function getColorFromButton(button: HTMLElement): string | null {
  const style = button.getAttribute('style');
  if (!style) return null;
  
  const match = style.match(/background:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;
  
  return `${match[1]},${match[2]},${match[3]}`;
}

function findColorIndex(colorKey: string): number {
  return ALL_COLORS.findIndex(([r, g, b]) => `${r},${g},${b}` === colorKey);
}

function injectSymbolsIntoPalette() {
  if (isInjected) return;
  
  // Find all color buttons in the palette
  const colorButtons = document.querySelectorAll('button[id^="color-"]');
  
  if (colorButtons.length === 0) return;

  colorButtons.forEach((button) => {
    const htmlButton = button as HTMLElement;
    const colorKey = getColorFromButton(htmlButton);
    
    if (!colorKey) return;
    
    const colorIndex = findColorIndex(colorKey);
    if (colorIndex === -1) return;

    // Check if symbol already exists
    if (htmlButton.querySelector('.symbol-overlay')) return;

    // Create symbol overlay
    const symbolCanvas = createSymbolCanvas(colorIndex, colorKey);
    symbolCanvas.className = 'symbol-overlay';
    symbolCanvas.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 10;
      opacity: 0.9;
    `;

    // Make button position relative if it isn't already
    const computedStyle = window.getComputedStyle(htmlButton);
    if (computedStyle.position === 'static') {
      htmlButton.style.position = 'relative';
    }

    htmlButton.appendChild(symbolCanvas);
  });

  isInjected = true;
}

function cleanupSymbols() {
  const symbols = document.querySelectorAll('.symbol-overlay');
  symbols.forEach(symbol => symbol.remove());
  isInjected = false;
}

function startPaletteWatcher() {
  if (paletteObserver) return;

  paletteObserver = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if palette was added or removed
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.querySelector('button[id^="color-"]') || 
                element.matches('button[id^="color-"]')) {
              shouldCheck = true;
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.querySelector('.symbol-overlay') || 
                element.matches('.symbol-overlay')) {
              isInjected = false;
            }
          }
        });
      }
    });

    if (shouldCheck && config.overlayMode === 'minify' && config.minifyStyle === 'symbols') {
      // Small delay to ensure DOM is fully updated
      setTimeout(injectSymbolsIntoPalette, 100);
    }
  });

  paletteObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

export function enablePaletteSymbols() {
  startPaletteWatcher();
  
  // Try to inject immediately if palette is already open
  if (config.overlayMode === 'minify' && config.minifyStyle === 'symbols') {
    setTimeout(injectSymbolsIntoPalette, 500);
  }
}

export function disablePaletteSymbols() {
  if (paletteObserver) {
    paletteObserver.disconnect();
    paletteObserver = null;
  }
  cleanupSymbols();
}

export function updatePaletteSymbols() {
  cleanupSymbols();
  
  if (config.overlayMode === 'minify' && config.minifyStyle === 'symbols') {
    setTimeout(injectSymbolsIntoPalette, 100);
  }
}