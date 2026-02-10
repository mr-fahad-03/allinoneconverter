import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import { renderPdfToImages } from "./pdf-renderer.service.js";

interface ImageManipulationOptions {
  resize?: { width?: number; height?: number };
  crop?: { x: number; y: number; width: number; height: number };
  grayscale?: boolean;
  invertColors?: boolean;
  enhance?: boolean;
  margin?: { top: number; right: number; bottom: number; left: number };
  compress?: boolean;
}

/**
 * Apply image manipulations to PDF by converting to images and back
 */
export async function manipulatePdfAsImages(
  pdfBuffer: Buffer,
  options: ImageManipulationOptions
): Promise<Buffer> {
  try {
    // Render PDF to images
    const images = await renderPdfToImages(pdfBuffer, { format: "png", scale: 2.0 });

    // Apply manipulations to each image
    const manipulatedImages: Buffer[] = [];

    for (const imageBuffer of images) {
      let sharpInstance = sharp(imageBuffer);

      // Resize
      if (options.resize) {
        sharpInstance = sharpInstance.resize(
          options.resize.width,
          options.resize.height,
          { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }
        );
      }

      // Crop
      if (options.crop) {
        sharpInstance = sharpInstance.extract({
          left: options.crop.x,
          top: options.crop.y,
          width: options.crop.width,
          height: options.crop.height
        });
      }

      // Grayscale
      if (options.grayscale) {
        sharpInstance = sharpInstance.grayscale();
      }

      // Invert colors
      if (options.invertColors) {
        sharpInstance = sharpInstance.negate();
      }

      // Enhance (increase sharpness and contrast)
      if (options.enhance) {
        sharpInstance = sharpInstance
          .sharpen()
          .normalize()
          .modulate({ brightness: 1.1, saturation: 1.1 });
      }

      // Add margin (extend canvas)
      if (options.margin) {
        const { top, right, bottom, left } = options.margin;
        sharpInstance = sharpInstance.extend({
          top,
          right,
          bottom,
          left,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        });
      }

      // Compress
      if (options.compress) {
        sharpInstance = sharpInstance.png({ compressionLevel: 9, quality: 80 });
      }

      const processedImage = await sharpInstance.toBuffer();
      manipulatedImages.push(processedImage);
    }

    // Convert images back to PDF
    const pdfDoc = await PDFDocument.create();

    for (const imageBuffer of manipulatedImages) {
      const pngImage = await pdfDoc.embedPng(imageBuffer);
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("PDF manipulation error:", error);
    throw new Error("Failed to manipulate PDF");
  }
}

/**
 * Resize PDF pages
 */
export async function resizePdf(
  pdfBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    resize: { width, height },
  });
}

/**
 * Crop PDF pages
 */
export async function cropPdf(
  pdfBuffer: Buffer,
  cropArea: { x: number; y: number; width: number; height: number }
): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    crop: cropArea,
  });
}

/**
 * Convert PDF to grayscale
 */
export async function grayscalePdf(pdfBuffer: Buffer): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    grayscale: true,
  });
}

/**
 * Invert PDF colors
 */
export async function invertPdfColors(pdfBuffer: Buffer): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    invertColors: true,
  });
}

/**
 * Enhance PDF quality
 */
export async function enhancePdf(pdfBuffer: Buffer): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    enhance: true,
  });
}

/**
 * Add margins to PDF
 */
export async function addPdfMargin(
  pdfBuffer: Buffer,
  margin: number | { top: number; right: number; bottom: number; left: number }
): Promise<Buffer> {
  const marginObj =
    typeof margin === "number"
      ? { top: margin, right: margin, bottom: margin, left: margin }
      : margin;

  return manipulatePdfAsImages(pdfBuffer, {
    margin: marginObj,
  });
}

/**
 * Clean PDF (remove artifacts, normalize)
 */
export async function cleanPdf(pdfBuffer: Buffer): Promise<Buffer> {
  return manipulatePdfAsImages(pdfBuffer, {
    enhance: true,
    compress: true,
  });
}

/**
 * Compress PDF with quality settings
 */
export async function compressPdf(
  pdfBuffer: Buffer,
  quality: number = 80
): Promise<Buffer> {
  try {
    // First try standard PDF compression
    const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const compressedBytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBuffer = Buffer.from(compressedBytes);

    // If size reduction is not significant, try image-based compression
    if (compressedBuffer.length > pdfBuffer.length * 0.8) {
      return manipulatePdfAsImages(pdfBuffer, { compress: true });
    }

    return compressedBuffer;
  } catch (error) {
    console.error("PDF compression error:", error);
    throw new Error("Failed to compress PDF");
  }
}
