export function createCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function createHTMLCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ((canvas as any).convertToBlob) return (canvas as any).convertToBlob();
  return new Promise((resolve, reject) => (canvas as HTMLCanvasElement).toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png"));
}

export async function canvasToDataURLSafe(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string> {
  const anyCanvas = canvas as any;
  if (canvas && typeof (canvas as HTMLCanvasElement).toDataURL === 'function') {
    return (canvas as HTMLCanvasElement).toDataURL('image/png');
  }
  if (canvas && typeof anyCanvas.convertToBlob === 'function') {
    const blob = await anyCanvas.convertToBlob();
    return await blobToDataURL(blob);
  }
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    const bmp = (canvas as any).transferToImageBitmap?.();
    if (bmp) {
      const html = createHTMLCanvas(canvas.width, canvas.height);
      const ctx = html.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');
      ctx.drawImage(bmp, 0, 0);
      return html.toDataURL('image/png');
    }
  }
  throw new Error('Cannot export canvas to data URL');
}

export async function blobToImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function blobToDataURL(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}