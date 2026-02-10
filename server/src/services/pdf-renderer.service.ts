import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import sharp from "sharp";

// Initialize PDF.js worker
const PDFJS_WORKER_PATH = "pdfjs-dist/legacy/build/pdf.worker.mjs";

interface RenderOptions {
  format?: "png" | "jpg" | "webp" | "avif" | "bmp" | "tiff" | "tga" | "ico";
  quality?: number;
  scale?: number;
  background?: string;
}

/**
 * Render PDF pages to images
 */
export async function renderPdfToImages(
  pdfBuffer: Buffer,
  options: RenderOptions = {}
): Promise<Buffer[]> {
  const {
    format = "png",
    quality = 90,
    scale = 2.0, // Higher scale = better quality
  } = options;

  try {
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const images: Buffer[] = [];

    // Render each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      // Render page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      }).promise;

      // Convert canvas to image buffer
      let imageBuffer: Buffer;

      if (format === "png") {
        imageBuffer = canvas.toBuffer("image/png");
      } else if (format === "jpg") {
        imageBuffer = canvas.toBuffer("image/jpeg", { quality: quality / 100 });
      } else {
        // For other formats, convert PNG to target format using Sharp
        const pngBuffer = canvas.toBuffer("image/png");
        imageBuffer = await convertImageFormat(pngBuffer, format, quality);
      }

      images.push(imageBuffer);
    }

    return images;
  } catch (error) {
    console.error("PDF rendering error:", error);
    throw new Error("Failed to render PDF");
  }
}

/**
 * Render single PDF page to image
 */
export async function renderPdfPageToImage(
  pdfBuffer: Buffer,
  pageNumber: number = 1,
  options: RenderOptions = {}
): Promise<Buffer> {
  const {
    format = "png",
    quality = 90,
    scale = 2.0,
  } = options;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as any,
      viewport: viewport,
      canvas: canvas as any,
    }).promise;

    let imageBuffer: Buffer;

    if (format === "png") {
      imageBuffer = canvas.toBuffer("image/png");
    } else if (format === "jpg") {
      imageBuffer = canvas.toBuffer("image/jpeg", { quality: quality / 100 });
    } else {
      const pngBuffer = canvas.toBuffer("image/png");
      imageBuffer = await convertImageFormat(pngBuffer, format, quality);
    }

    return imageBuffer;
  } catch (error) {
    console.error("PDF page rendering error:", error);
    throw new Error("Failed to render PDF page");
  }
}

/**
 * Convert image to different formats using Sharp
 */
async function convertImageFormat(
  buffer: Buffer,
  format: string,
  quality: number = 90
): Promise<Buffer> {
  let sharpInstance = sharp(buffer);

  switch (format) {
    case "webp":
      return sharpInstance.webp({ quality }).toBuffer();
    case "avif":
      return sharpInstance.avif({ quality }).toBuffer();
    case "bmp":
      return sharpInstance.toFormat("png").toBuffer(); // BMP via PNG
    case "tiff":
      return sharpInstance.tiff({ quality }).toBuffer();
    case "tga":
      // TGA not directly supported, use PNG
      return sharpInstance.png().toBuffer();
    case "ico":
      // Resize to icon size and convert to PNG (browsers support PNG as ICO)
      return sharpInstance.resize(256, 256).png().toBuffer();
    default:
      return sharpInstance.png().toBuffer();
  }
}

/**
 * Get PDF metadata and info
 */
export async function getPdfInfo(pdfBuffer: Buffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
    });

    const pdfDoc = await loadingTask.promise;
    const metadata = await pdfDoc.getMetadata();

    return {
      numPages: pdfDoc.numPages,
      metadata: metadata.info,
      fingerprints: pdfDoc.fingerprints,
    };
  } catch (error) {
    console.error("PDF info error:", error);
    throw new Error("Failed to get PDF info");
  }
}
