/** Longest side of a rendered page: legible print for a vision model, well under the upload limit. */
const PAGE_EDGE_PX = 2000;

/**
 * A PDF's first pages as JPEGs, for the image import (#637). Every vision model
 * reads pictures, few read PDFs, so the pages are drawn here in the browser.
 */
export async function pdfPagesAsImages(file: File, maxPages: number): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const baseName = file.name.replace(/\.pdf$/i, "");
  const pages: File[] = [];

  try {
    const pdf = await task.promise;

    for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number++) {
      const page = await pdf.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PAGE_EDGE_PX / Math.max(width, height) });
      const canvas = document.createElement("canvas");

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85)
      );

      if (blob) {
        pages.push(new File([blob], `${baseName}-${number}.jpg`, { type: "image/jpeg" }));
      }
    }
  } finally {
    await task.destroy();
  }

  return pages;
}
