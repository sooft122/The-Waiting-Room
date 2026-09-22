// Room/avatar images are stored as base64 data URLs (see .env.example — there's
// no blob storage in this app), and POSTed as JSON. Vercel's serverless
// functions cap request bodies at ~4.5MB, and base64 inflates size by ~33% —
// so an original file anywhere near that limit (routine for an unedited
// mobile camera photo) fails silently in production even though it passes
// client-side size validation locally. Downscaling + re-encoding to JPEG
// before it ever becomes a data URL keeps every upload well under that cap
// regardless of the source file's size.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function canvasToJpegDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images (no 2D canvas context).");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

// Decoding a full-resolution photo (modern phone cameras routinely shoot
// 12-48MP) into memory before scaling it down — the old approach — can fail
// on a memory-constrained mobile tab. createImageBitmap's resize option lets
// the browser decode directly at a reduced size instead, which is both
// cheaper and avoids ever holding the full-resolution bitmap in memory.
async function compressViaImageBitmap(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    resizeWidth: MAX_DIMENSION,
    resizeQuality: "medium",
  });
  try {
    return canvasToJpegDataUrl(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

// Last resort — some formats a phone gallery hands out (HEIC/HEIF chief
// among them) simply aren't decodable via <img>/canvas in most mobile
// browsers, even though the file itself is perfectly valid. Reading it as
// raw bytes never needs to decode pixels at all, so it always works; it
// just skips the size reduction, matching how this app read every upload
// before compression was added.
function readRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

// Fallback for browsers without createImageBitmap's resize option — decodes
// at full resolution via a plain <img>, then draws scaled onto the canvas.
function compressViaImageElement(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      try {
        resolve(canvasToJpegDataUrl(img, width, height));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The browser could not decode this image file."));
    };

    img.src = objectUrl;
  });
}

export async function compressImageToDataUrl(
  file: File,
  // The caller's server-side data-URL length cap (avatars and room images
  // enforce different limits) — only checked against the raw fallback below,
  // since the canvas-encoded paths always downscale well under either cap.
  maxDataUrlLength = Infinity,
): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      return await compressViaImageBitmap(file);
    } catch (err) {
      console.error("compressImageToDataUrl: createImageBitmap path failed, falling back", {
        fileType: file.type,
        fileSize: file.size,
        err,
      });
      // Fall through to the <img>-based path below.
    }
  }

  try {
    return await compressViaImageElement(file);
  } catch (err) {
    console.error("compressImageToDataUrl: <img> fallback path also failed, reading raw bytes instead", {
      fileType: file.type,
      fileSize: file.size,
      err,
    });
  }

  // Neither decode path could handle this file's format (most often
  // HEIC/HEIF straight off a phone camera roll, which canvas can't touch in
  // most mobile browsers) — fall back to storing it uncompressed rather than
  // blocking the upload outright. That skips downscaling entirely though, so
  // an ordinary multi-MB phone photo will usually blow the server's size cap
  // — surface that clearly now instead of letting it fail later as a vague
  // "too large" error after a wasted round trip.
  const raw = await readRawDataUrl(file);
  if (raw.length > maxDataUrlLength) {
    throw new Error(
      "This photo's format can't be compressed on this device, and the original file is too large to upload as-is. Try a different photo, or convert it to JPG first.",
    );
  }
  return raw;
}
