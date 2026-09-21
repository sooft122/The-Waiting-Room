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

export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Your browser can't process images."));
        return;
      }

      try {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        console.error("compressImageToDataUrl: canvas draw/export failed", {
          fileType: file.type,
          fileSize: file.size,
          width,
          height,
          err,
        });
        reject(err instanceof Error ? err : new Error("Could not process that image."));
      }
    };

    img.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      console.error("compressImageToDataUrl: image failed to decode", { fileType: file.type, fileSize: file.size, event });
      reject(new Error("Could not read that image."));
    };

    img.src = objectUrl;
  });
}
