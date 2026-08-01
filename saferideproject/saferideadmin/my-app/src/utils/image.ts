// Downscale + re-encode an image in the browser before upload, so large photos
// don't exceed the server/nginx body-size limit (avoids HTTP 413).
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
  maxBytes = 900_000,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  // Already small enough — leave it untouched.
  const probe = await loadImage(file).catch(() => null);
  if (!probe) return file;
  if (file.size <= maxBytes && probe.width <= maxDim && probe.height <= maxDim) return file;

  const scale = Math.min(1, maxDim / Math.max(probe.width, probe.height));
  const width = Math.round(probe.width * scale);
  const height = Math.round(probe.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(probe, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
