/**
 * Client-side image downscaling, no dependency.
 *
 * A crop library (react-easy-crop et al) exists to provide an interactive
 * crop UI, which isn't needed here: a circular avatar and a 3:1 cover both
 * render with `object-cover`, so a centre crop already produces the right
 * result. This is that centre crop plus a re-encode.
 *
 * Re-encoding also strips EXIF — including GPS coordinates — which is a
 * free privacy win when someone uploads a photo straight off their phone.
 */

export type ResizeMode = 'avatar' | 'cover' | 'post';

interface Preset {
  /** Target aspect ratio for centre-cropped modes; null means fit-inside. */
  aspect: number | null;
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

const PRESETS: Record<ResizeMode, Preset> = {
  avatar: { aspect: 1, maxWidth: 512, maxHeight: 512, quality: 0.85 },
  cover: { aspect: 3, maxWidth: 1600, maxHeight: 533, quality: 0.82 },
  post: { aspect: null, maxWidth: 1600, maxHeight: 1600, quality: 0.82 },
};

/** Matches the buckets' allowed_mime_types. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Rejected before decoding, so a huge file errors instantly instead of OOMing. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'That file is not an image.';
  if (!ACCEPTED.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > MAX_INPUT_BYTES) return 'That image is larger than 10MB.';
  return null;
}

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation: 'from-image' applies the EXIF rotation. Without it,
    // photos taken in portrait on a phone come out sideways.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

function sourceSize(src: Source): { width: number; height: number } {
  return src instanceof HTMLImageElement
    ? { width: src.naturalWidth, height: src.naturalHeight }
    : { width: src.width, height: src.height };
}

/**
 * Encodes to WebP, falling back to JPEG when the browser doesn't support
 * it (older Safari silently hands back a PNG instead). Both are in the
 * buckets' MIME allowlist.
 */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === 'image/webp') return resolve(blob);
        canvas.toBlob(
          (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('Could not process that image.'))),
          'image/jpeg',
          quality
        );
      },
      'image/webp',
      quality
    );
  });
}

export interface ResizedImage {
  blob: Blob;
  /** 'webp' | 'jpeg' — the caller uses this for the object's extension. */
  extension: string;
}

export async function resizeImage(file: File, mode: ResizeMode): Promise<ResizedImage> {
  const preset = PRESETS[mode];
  const source = await decode(file);
  const { width: sw, height: sh } = sourceSize(source);

  if (!sw || !sh) throw new Error('Could not read that image.');

  // Source rectangle to sample from, and the output size to draw into.
  let sx = 0;
  let sy = 0;
  let sCropW = sw;
  let sCropH = sh;
  let outW: number;
  let outH: number;

  if (preset.aspect === null) {
    // Fit inside the box, preserving aspect. Never upscale.
    const scale = Math.min(preset.maxWidth / sw, preset.maxHeight / sh, 1);
    outW = Math.round(sw * scale);
    outH = Math.round(sh * scale);
  } else {
    // Centre-crop to the target aspect, then scale down to fit.
    const srcAspect = sw / sh;
    if (srcAspect > preset.aspect) {
      sCropH = sh;
      sCropW = sh * preset.aspect;
      sx = (sw - sCropW) / 2;
    } else {
      sCropW = sw;
      sCropH = sw / preset.aspect;
      sy = (sh - sCropH) / 2;
    }
    const scale = Math.min(preset.maxWidth / sCropW, 1);
    outW = Math.round(sCropW * scale);
    outH = Math.round(sCropH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');

  // WebP and JPEG have no alpha in this path, so a transparent PNG would
  // composite onto black. Fill with the --card token instead so it lands
  // on the app's own surface colour.
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sCropW, sCropH, 0, 0, outW, outH);

  if (source instanceof ImageBitmap) source.close();

  const blob = await encode(canvas, preset.quality);
  return { blob, extension: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}
