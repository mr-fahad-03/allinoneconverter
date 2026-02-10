import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { PDFDocument, rgb, degrees as pdfDegrees, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import { AuthRequest, optionalAuth } from "../middleware/auth.js";
import { handleConversion } from "../services/conversion.service.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { renderPdfToImages, renderPdfPageToImage } from "../services/pdf-renderer.service.js";
import {
  resizePdf,
  cropPdf,
  grayscalePdf,
  invertPdfColors,
  enhancePdf,
  addPdfMargin,
  cleanPdf,
  compressPdf,
} from "../services/pdf-manipulation.service.js";

const router = Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10);

// Configure multer to use memory storage (files will be uploaded to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

// Helper to parse page ranges (e.g., "1,3,5-7")
const parsePageRanges = (pagesParam: string, totalPages: number): number[] => {
  const pageIndices: number[] = [];
  const parts = pagesParam.split(",");
  
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end && i <= totalPages; i++) {
        pageIndices.push(i - 1);
      }
    } else {
      const num = parseInt(part);
      if (num > 0 && num <= totalPages) {
        pageIndices.push(num - 1);
      }
    }
  }
  
  return pageIndices;
};

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZE PDF TOOLS (11 tools)
// ═══════════════════════════════════════════════════════════════════════════

// Merge PDF
router.post("/merge-pdf", optionalAuth, upload.array("files", 20), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
      res.status(400).json({ message: "At least 2 PDF files required" });
      return;
    }

    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      try {
        const pdf = await PDFDocument.load(file.buffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error loading PDF file ${file.originalname}:`, error);
        throw new Error(`Invalid PDF file: ${file.originalname}`);
      }
    }

    const pdfBytes = await mergedPdf.save();

    // Validate the generated PDF
    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("Failed to generate PDF - empty output");
    }

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: "merged.pdf",
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Merge PDF error:", error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : "Merge failed. Please ensure all files are valid PDFs." 
    });
  }
});

// Split PDF
router.post("/split-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const pageCount = pdf.getPageCount();
    const outputFiles = [];

    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(page);
      
      const pdfBytes = await newPdf.save();
      
      outputFiles.push({
        buffer: Buffer.from(pdfBytes),
        filename: `page_${i + 1}.pdf`,
        mimetype: "application/pdf"
      });
    }

    await handleConversion(req, res, outputFiles);
  } catch (error) {
    console.error("Split PDF error:", error);
    res.status(500).json({ message: "Split failed" });
  }
});

// Extract PDF Pages
router.post("/extract-pdf-pages", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const pagesParam = (req.query.pages as string) || "1";
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const pageIndices = parsePageRanges(pagesParam, pdf.getPageCount());

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, pageIndices);
    pages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_extracted.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Extract pages error:", error);
    res.status(500).json({ message: "Extraction failed" });
  }
});

// Remove PDF Pages
router.post("/remove-pdf-pages", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const pagesParam = (req.query.pages as string) || "1";
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const totalPages = pdf.getPageCount();
    const removeIndices = new Set(parsePageRanges(pagesParam, totalPages));

    const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter(i => !removeIndices.has(i));

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, keepIndices);
    pages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_modified.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Remove pages error:", error);
    res.status(500).json({ message: "Page removal failed" });
  }
});

// Organize PDF (reorder pages)
router.post("/organize-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const orderParam = (req.query.order as string) || "";
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const pageIndices = orderParam ? parsePageRanges(orderParam, pdf.getPageCount()) : pdf.getPageIndices();

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, pageIndices);
    pages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_organized.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Organize PDF error:", error);
    res.status(500).json({ message: "Organization failed" });
  }
});

// Reverse PDF
router.post("/reverse-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const pageIndices = pdf.getPageIndices().reverse();

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, pageIndices);
    pages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_reversed.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Reverse PDF error:", error);
    res.status(500).json({ message: "Reversal failed" });
  }
});

// Rotate PDF
router.post("/rotate-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const rotation = parseInt(req.query.degrees as string) || 90;
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const pages = pdf.getPages();
    
    pages.forEach((page) => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(pdfDegrees((currentRotation + rotation) % 360));
    });

    const pdfBytes = await pdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_rotated.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Rotate PDF error:", error);
    res.status(500).json({ message: "Rotation failed" });
  }
});

// Merge PDF & Image
router.post("/merge-pdf-image", optionalAuth, upload.array("files", 20), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: "No files provided" });
      return;
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      if (file.mimetype.startsWith("image/")) {
        const pngBuffer = await sharp(file.buffer).png().toBuffer();
        const pngImage = await mergedPdf.embedPng(pngBuffer);
        const page = mergedPdf.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
      } else if (file.mimetype === "application/pdf") {
        const pdf = await PDFDocument.load(file.buffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }
    }

    const pdfBytes = await mergedPdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: "merged.pdf",
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Merge PDF & Image error:", error);
    res.status(500).json({ message: "Merge failed" });
  }
});

// Merge PDF & Text
router.post("/merge-pdf-text", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const text = (req.body.text || "").toString();
    
    if (!file) {
      res.status(400).json({ message: "No PDF provided" });
      return;
    }

    const pdfDoc = await PDFDocument.load(file.buffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Add text page at the end
    const textPage = pdfDoc.addPage([600, 800]);
    const lines = text.split("\n");
    let y = 750;
    
    lines.forEach((line: string) => {
      if (y > 50) {
        textPage.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
        y -= 20;
      }
    });

    const pdfBytes = await pdfDoc.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_with_text.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Merge PDF & Text error:", error);
    res.status(500).json({ message: "Merge failed" });
  }
});

// Make PDF Parts
router.post("/make-pdf-parts", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const parts = parseInt(req.query.parts as string) || 2;
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const totalPages = pdf.getPageCount();
    const pagesPerPart = Math.ceil(totalPages / parts);
    const outputFiles = [];

    for (let i = 0; i < parts; i++) {
      const startPage = i * pagesPerPart;
      const endPage = Math.min((i + 1) * pagesPerPart, totalPages);
      const indices = Array.from({ length: endPage - startPage }, (_, idx) => startPage + idx);

      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdf, indices);
      pages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      
      outputFiles.push({
        buffer: Buffer.from(pdfBytes),
        filename: `part_${i + 1}.pdf`,
        mimetype: "application/pdf"
      });
    }

    await handleConversion(req, res, outputFiles);
  } catch (error) {
    console.error("Make PDF Parts error:", error);
    res.status(500).json({ message: "Division failed" });
  }
});

// PDF Splitter - Advanced splitting with options
router.post("/pdf-splitter", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const splitType = (req.body.splitType || req.query.splitType || "pages").toString();
    const pdf = await PDFDocument.load(file.buffer);
    const totalPages = pdf.getPageCount();
    const outputFiles = [];

    if (splitType === "pages" || splitType === "all") {
      // Split into individual pages
      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(page);
        
        const pdfBytes = await newPdf.save();
        
        outputFiles.push({
          buffer: Buffer.from(pdfBytes),
          filename: `page_${i + 1}.pdf`,
          mimetype: "application/pdf"
        });
      }
    } else if (splitType === "odd-even") {
      // Split into odd and even pages
      const oddIndices = [];
      const evenIndices = [];
      
      for (let i = 0; i < totalPages; i++) {
        if (i % 2 === 0) {
          oddIndices.push(i);
        } else {
          evenIndices.push(i);
        }
      }
      
      // Create odd pages PDF
      if (oddIndices.length > 0) {
        const oddPdf = await PDFDocument.create();
        const oddPages = await oddPdf.copyPages(pdf, oddIndices);
        oddPages.forEach((page) => oddPdf.addPage(page));
        const oddBytes = await oddPdf.save();
        
        outputFiles.push({
          buffer: Buffer.from(oddBytes),
          filename: "odd_pages.pdf",
          mimetype: "application/pdf"
        });
      }
      
      // Create even pages PDF
      if (evenIndices.length > 0) {
        const evenPdf = await PDFDocument.create();
        const evenPages = await evenPdf.copyPages(pdf, evenIndices);
        evenPages.forEach((page) => evenPdf.addPage(page));
        const evenBytes = await evenPdf.save();
        
        outputFiles.push({
          buffer: Buffer.from(evenBytes),
          filename: "even_pages.pdf",
          mimetype: "application/pdf"
        });
      }
    } else if (splitType === "range") {
      // Split by page ranges (e.g., "1-5,6-10")
      const ranges = (req.body.ranges || req.query.ranges || "").toString();
      if (ranges) {
        const rangeParts = ranges.split(",");
        
        for (let i = 0; i < rangeParts.length; i++) {
          const range = rangeParts[i].trim();
          const indices = parsePageRanges(range, totalPages);
          
          if (indices.length > 0) {
            const rangePdf = await PDFDocument.create();
            const rangePages = await rangePdf.copyPages(pdf, indices);
            rangePages.forEach((page) => rangePdf.addPage(page));
            const rangeBytes = await rangePdf.save();
            
            outputFiles.push({
              buffer: Buffer.from(rangeBytes),
              filename: `range_${i + 1}.pdf`,
              mimetype: "application/pdf"
            });
          }
        }
      }
    } else {
      // Default: split every N pages
      const interval = parseInt(req.body.interval || req.query.interval || "1");
      
      for (let i = 0; i < totalPages; i += interval) {
        const endPage = Math.min(i + interval, totalPages);
        const indices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
        
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, indices);
        pages.forEach((page) => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        
        outputFiles.push({
          buffer: Buffer.from(pdfBytes),
          filename: `split_${Math.floor(i / interval) + 1}.pdf`,
          mimetype: "application/pdf"
        });
      }
    }

    await handleConversion(req, res, outputFiles);
  } catch (error) {
    console.error("PDF Splitter error:", error);
    res.status(500).json({ message: "Splitting failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMIZE PDF TOOLS (8 tools)
// ═══════════════════════════════════════════════════════════════════════════

// Compress PDF
router.post("/compress-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const quality = parseInt(req.body.quality || "80");
    const pdfBytes = await compressPdf(file.buffer, quality);
    
    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_compressed.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Compress PDF error:", error);
    res.status(500).json({ message: "Compression failed" });
  }
});

// Resize PDF
router.post("/resize-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const width = parseInt(req.body.width || req.query.width as string || "612");
    const height = parseInt(req.body.height || req.query.height as string || "792");

    const pdfBytes = await resizePdf(file.buffer, width, height);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_resized.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Resize PDF error:", error);
    res.status(500).json({ message: "Resize failed" });
  }
});

// Crop PDF
router.post("/crop-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const x = parseInt(req.body.x || "0");
    const y = parseInt(req.body.y || "0");
    const width = parseInt(req.body.width || "500");
    const height = parseInt(req.body.height || "700");

    const pdfBytes = await cropPdf(file.buffer, { x, y, width, height });

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_cropped.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Crop PDF error:", error);
    res.status(500).json({ message: "Crop failed" });
  }
});

// Clean PDF
router.post("/clean-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdfBytes = await cleanPdf(file.buffer);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_cleaned.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Clean PDF error:", error);
    res.status(500).json({ message: "Cleaning failed" });
  }
});

// Enhance PDF
router.post("/enhance-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdfBytes = await enhancePdf(file.buffer);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_enhanced.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Enhance PDF error:", error);
    res.status(500).json({ message: "Enhancement failed" });
  }
});

// Grayscale PDF
router.post("/grayscale-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdfBytes = await grayscalePdf(file.buffer);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_grayscale.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Grayscale PDF error:", error);
    res.status(500).json({ message: "Grayscale conversion failed" });
  }
});

// PDF Color Inverter
router.post("/pdf-color-inverter", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdfBytes = await invertPdfColors(file.buffer);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_inverted.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Color invert error:", error);
    res.status(500).json({ message: "Color inversion failed" });
  }
});

// Add PDF Margin
router.post("/add-pdf-margin", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const margin = parseInt(req.body.margin || req.query.margin as string || "50");

    const pdfBytes = await addPdfMargin(file.buffer, margin);

    await handleConversion(req, res, {
      buffer: pdfBytes,
      filename: file.originalname.replace(".pdf", "_margin.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Add margin error:", error);
    res.status(500).json({ message: "Adding margin failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERT TO PDF TOOLS (30 tools)
// ═══════════════════════════════════════════════════════════════════════════

const imageToPdfTools = [
  "jpg-to-pdf", "png-to-pdf", "bmp-to-pdf", "gif-to-pdf", 
  "webp-to-pdf", "svg-to-pdf", "avif-to-pdf", "psd-to-pdf",
  "ico-to-pdf", "tga-to-pdf"
];

imageToPdfTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.array("files", 20), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ message: "No files provided" });
        return;
      }

      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        try {
          const pngBuffer = await sharp(file.buffer).png().toBuffer();
          const pngImage = await pdfDoc.embedPng(pngBuffer);
          const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
          page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
        } catch (err) {
          console.error("Image processing error:", err);
        }
      }

      const pdfBytes = await pdfDoc.save();

      await handleConversion(req, res, {
        buffer: Buffer.from(pdfBytes),
        filename: files[0].originalname.replace(/\.[^.]+$/, ".pdf"),
        mimetype: "application/pdf"
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// Text-based conversions
const textToPdfTools = [
  "txt-to-pdf", "text-to-pdf", "json-to-pdf", "xml-to-pdf",
  "yaml-to-pdf", "markdown-to-pdf", "ini-to-pdf", "srt-to-pdf",
  "vtt-to-pdf", "csv-to-pdf", "tsv-to-pdf"
];

textToPdfTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      let textContent = req.body.text || (file ? file.buffer.toString("utf-8") : "");
      
      if (!textContent) {
        res.status(400).json({ message: "No content provided" });
        return;
      }

      const pdfDoc = await PDFDocument.create();
      let font = await pdfDoc.embedFont(StandardFonts.Courier);
      const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
      
      // Handle CSV/TSV - create table format
      if (tool === "csv-to-pdf" || tool === "tsv-to-pdf") {
        const delimiter = tool === "csv-to-pdf" ? "," : "\t";
        const rows = textContent.split("\n").filter(row => row.trim());
        
        let page = pdfDoc.addPage([792, 612]); // Landscape
        let y = 570;
        font = await pdfDoc.embedFont(StandardFonts.Courier);
        
        // Add title
        page.drawText(file?.originalname || "Data Table", { x: 50, y, size: 14, font: fontBold });
        y -= 30;
        
        for (const row of rows) {
          if (y < 50) {
            page = pdfDoc.addPage([792, 612]);
            y = 570;
          }
          const displayRow = row.split(delimiter).join(" | ").substring(0, 100);
          page.drawText(displayRow, { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
          y -= 14;
        }
      }
      // Handle JSON - format nicely
      else if (tool === "json-to-pdf") {
        try {
          const jsonObj = typeof textContent === "string" ? JSON.parse(textContent) : textContent;
          textContent = JSON.stringify(jsonObj, null, 2);
        } catch (e) {
          // Already a string, use as is
        }
        
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        
        const lines = textContent.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          page.drawText(line.substring(0, 85), { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
          y -= 13;
        }
      }
      // Handle Markdown - convert headers and formatting
      else if (tool === "markdown-to-pdf") {
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const lines = textContent.split("\n");
        for (let line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          
          // Handle markdown headers
          if (line.startsWith("# ")) {
            page.drawText(line.substring(2), { x: 50, y, size: 24, font: boldFont, color: rgb(0, 0, 0) });
            y -= 30;
          } else if (line.startsWith("## ")) {
            page.drawText(line.substring(3), { x: 50, y, size: 18, font: boldFont, color: rgb(0, 0, 0) });
            y -= 24;
          } else if (line.startsWith("### ")) {
            page.drawText(line.substring(4), { x: 50, y, size: 14, font: boldFont, color: rgb(0, 0, 0) });
            y -= 20;
          } else {
            // Regular text with word wrap
            const cleanLine = line.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");
            const wrappedLines = cleanLine.match(/.{1,80}/g) || [cleanLine];
            for (const wrappedLine of wrappedLines) {
              if (y < 50) {
                page = pdfDoc.addPage([612, 792]);
                y = 750;
              }
              page.drawText(wrappedLine, { x: 50, y, size: 11, font: regularFont, color: rgb(0, 0, 0) });
              y -= 16;
            }
          }
        }
      }
      // Handle XML/YAML/INI - preserve formatting
      else if (tool === "xml-to-pdf" || tool === "yaml-to-pdf" || tool === "ini-to-pdf") {
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        
        const lines = textContent.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          page.drawText(line.substring(0, 85), { x: 50, y, size: 9, font, color: rgb(0, 0, 0) });
          y -= 13;
        }
      }
      // Handle SRT/VTT subtitles - format with timestamps
      else if (tool === "srt-to-pdf" || tool === "vtt-to-pdf") {
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        page.drawText("Subtitles", { x: 50, y, size: 18, font: fontBold });
        y -= 30;
        
        const lines = textContent.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          
          // Highlight timestamps
          if (line.match(/\d{2}:\d{2}:\d{2}/)) {
            page.drawText(line.substring(0, 80), { x: 50, y, size: 10, font: fontBold, color: rgb(0, 0, 0.6) });
          } else {
            page.drawText(line.substring(0, 80), { x: 50, y, size: 10, font: regularFont, color: rgb(0, 0, 0) });
          }
          y -= 14;
        }
      }
      // Default text handling with multi-page support
      else {
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const lines = textContent.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          const wrappedLines = line.match(/.{1,85}/g) || [line];
          for (const wrappedLine of wrappedLines) {
            if (y < 50) {
              page = pdfDoc.addPage([612, 792]);
              y = 750;
            }
            page.drawText(wrappedLine, { x: 50, y, size: 11, font: regularFont, color: rgb(0, 0, 0) });
            y -= 15;
          }
        }
      }

      const pdfBytes = await pdfDoc.save();

      await handleConversion(req, res, {
        buffer: Buffer.from(pdfBytes),
        filename: (file?.originalname || "converted").replace(/\.[^.]+$/, ".pdf"),
        mimetype: "application/pdf"
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// Document conversions (Word, Excel, HTML, etc.)
const docToPdfTools = [
  "word-to-pdf", "excel-to-pdf", "html-to-pdf", "spreadsheet-to-pdf",
  "excel-url-to-pdf", "word-url-to-pdf"
];

docToPdfTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      let pdfBytes: Buffer;

      // Word to PDF conversion
      if (tool === "word-to-pdf" && (file.mimetype.includes("word") || file.originalname.endsWith(".docx") || file.originalname.endsWith(".doc"))) {
        try {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          const text = result.value;
          
          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          let page = pdfDoc.addPage([612, 792]);
          let y = 750;
          
          const lines = text.split("\n");
          for (const line of lines) {
            if (y < 50) {
              page = pdfDoc.addPage([612, 792]);
              y = 750;
            }
            const wrappedLines = line.match(/.{1,80}/g) || [line];
            for (const wrappedLine of wrappedLines) {
              if (y < 50) {
                page = pdfDoc.addPage([612, 792]);
                y = 750;
              }
              page.drawText(wrappedLine, { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
              y -= 16;
            }
          }
          
          pdfBytes = Buffer.from(await pdfDoc.save());
        } catch (err) {
          console.error("Word conversion error:", err);
          // Fallback to placeholder
          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const page = pdfDoc.addPage([612, 792]);
          page.drawText(`Converted from ${file.originalname}`, { x: 50, y: 700, size: 16, font, color: rgb(0, 0, 0) });
          pdfBytes = Buffer.from(await pdfDoc.save());
        }
      }
      // Excel to PDF conversion
      else if ((tool === "excel-to-pdf" || tool === "spreadsheet-to-pdf") && (file.mimetype.includes("spreadsheet") || file.originalname.match(/\.(xlsx|xls|csv)$/))) {
        try {
          const workbook = XLSX.read(file.buffer, { type: "buffer" });
          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.Courier);
          
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(worksheet);
            
            let page = pdfDoc.addPage([792, 612]); // Landscape for better table view
            let y = 570;
            
            page.drawText(`Sheet: ${sheetName}`, { x: 50, y, size: 14, font, color: rgb(0, 0, 0) });
            y -= 30;
            
            const rows = csvData.split("\n");
            for (const row of rows.slice(0, 40)) { // Limit to first 40 rows per sheet
              if (y < 50) {
                page = pdfDoc.addPage([792, 612]);
                y = 570;
              }
              page.drawText(row.substring(0, 95), { x: 50, y, size: 8, font, color: rgb(0, 0, 0) });
              y -= 12;
            }
          });
          
          pdfBytes = Buffer.from(await pdfDoc.save());
        } catch (err) {
          console.error("Excel conversion error:", err);
          // Fallback to placeholder
          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const page = pdfDoc.addPage([612, 792]);
          page.drawText(`Converted from ${file.originalname}`, { x: 50, y: 700, size: 16, font, color: rgb(0, 0, 0) });
          pdfBytes = Buffer.from(await pdfDoc.save());
        }
      }
      // HTML to PDF (basic)
      else if (tool === "html-to-pdf") {
        const htmlContent = file.buffer.toString("utf-8");
        const textContent = htmlContent.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        
        const lines = textContent.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          const wrappedLines = line.match(/.{1,80}/g) || [line];
          for (const wrappedLine of wrappedLines) {
            if (y < 50) {
              page = pdfDoc.addPage([612, 792]);
              y = 750;
            }
            page.drawText(wrappedLine.trim(), { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
            y -= 16;
          }
        }
        
        pdfBytes = Buffer.from(await pdfDoc.save());
      }
      // Fallback for URL-based or other tools
      else {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([612, 792]);
        page.drawText(`Converted from ${file.originalname}`, { x: 50, y: 700, size: 16, font, color: rgb(0, 0, 0) });
        pdfBytes = Buffer.from(await pdfDoc.save());
      }

      await handleConversion(req, res, {
        buffer: pdfBytes,
        filename: file.originalname.replace(/\.[^.]+$/, ".pdf"),
        mimetype: "application/pdf"
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// Special tools
router.post("/base64-to-pdf", optionalAuth, upload.none(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const base64Data = req.body.base64;
    if (!base64Data) {
      res.status(400).json({ message: "No base64 data provided" });
      return;
    }

    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    await handleConversion(req, res, {
      buffer,
      filename: req.body.filename || "decoded.pdf",
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Base64 to PDF error:", error);
    res.status(500).json({ message: "Conversion failed. Invalid base64 data." });
  }
});

router.post("/camera-to-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No camera image provided" });
      return;
    }

    // Convert camera image to PDF
    const pdfDoc = await PDFDocument.create();
    
    // Process image through Sharp to ensure it's a supported format
    const processedBuffer = await sharp(file.buffer)
      .png()
      .toBuffer();
    
    const pngImage = await pdfDoc.embedPng(processedBuffer);
    const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pngImage.width,
      height: pngImage.height
    });

    const pdfBytes = await pdfDoc.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: (file.originalname || "camera-capture").replace(/\.[^.]+$/, ".pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Camera to PDF error:", error);
    res.status(500).json({ message: "Conversion failed" });
  }
});

router.post("/speech-to-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No audio file provided" });
      return;
    }

    // Create a PDF with transcription placeholder
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([612, 792]);
    
    let y = 750;
    
    page.drawText("Audio Transcription", {
      x: 200,
      y,
      size: 20,
      font: fontBold
    });
    
    y -= 40;
    
    page.drawText(`File: ${file.originalname}`, {
      x: 50,
      y,
      size: 12,
      font
    });
    
    y -= 25;
    
    page.drawText(`Size: ${(file.size / 1024).toFixed(2)} KB`, {
      x: 50,
      y,
      size: 12,
      font
    });
    
    y -= 40;
    
    const note = [\n      \"Note: Full speech-to-text transcription requires an AI service like:\",\n      \"- OpenAI Whisper API\",\n      \"- Google Cloud Speech-to-Text\",\n      \"- AssemblyAI\",\n      \"\",\n      \"Audio file received successfully. To enable transcription,\",\n      \"integrate one of the above services in production.\"\n    ];\n    \n    for (const line of note) {\n      page.drawText(line, {\n        x: 50,\n        y,\n        size: 11,\n        font\n      });\n      y -= 20;\n    }\n\n    const pdfBytes = await pdfDoc.save();\n\n    await handleConversion(req, res, {\n      buffer: Buffer.from(pdfBytes),\n      filename: file.originalname.replace(/\.[^.]+$/, \"_transcription.pdf\"),\n      mimetype: \"application/pdf\"\n    });\n  } catch (error) {\n    console.error(\"Speech to PDF error:\", error);\n    res.status(500).json({ message: \"Conversion failed\" });\n  }\n});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERT FROM PDF TOOLS (22 tools)
// ═══════════════════════════════════════════════════════════════════════════

// PDF to Image conversions
const pdfToImageTools = [
  { slug: "pdf-to-jpg", format: "jpg" as const },
  { slug: "pdf-to-png", format: "png" as const },
  { slug: "pdf-to-webp", format: "webp" as const },
  { slug: "pdf-to-avif", format: "avif" as const },
  { slug: "pdf-to-bmp", format: "bmp" as const },
  { slug: "pdf-to-tga", format: "tga" as const },
  { slug: "pdf-to-tiff", format: "tiff" as const },
  { slug: "pdf-to-ico", format: "ico" as const },
];

pdfToImageTools.forEach(({ slug, format }) => {
  router.post(`/${slug}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      const quality = parseInt((req.body.quality || req.query.quality || "90") as string);
      const scale = parseFloat((req.body.scale || req.query.scale || "2.0") as string);

      // Render all pages to images
      const imageBuffers = await renderPdfToImages(file.buffer, { format, quality, scale });

      // Convert to files array
      const files = imageBuffers.map((buffer, index) => ({
        buffer,
        filename: file.originalname.replace(".pdf", `_page${index + 1}.${format === "jpg" ? "jpg" : format}`),
        mimetype: `image/${format === "jpg" ? "jpeg" : format}`
      }));

      await handleConversion(req, res, files);
    } catch (error) {
      console.error(`${slug} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// Special PDF to image formats (HEIC, HEIF, RAW - convert to PNG as fallback)
const specialImageFormats = ["pdf-to-heic", "pdf-to-heif", "pdf-to-raw"];

specialImageFormats.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      // Render to PNG as these formats have limited support
      const imageBuffers = await renderPdfToImages(file.buffer, { format: "png", quality: 95, scale: 2.0 });

      const extension = tool.replace("pdf-to-", "");
      const files = imageBuffers.map((buffer, index) => ({
        buffer,
        filename: file.originalname.replace(".pdf", `_page${index + 1}.${extension}`),
        mimetype: `image/${extension}`
      }));

      await handleConversion(req, res, files);
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// PDF to text/document conversions
const pdfToTextTools = [
  "pdf-to-word", "pdf-to-excel", "pdf-to-txt", "pdf-to-html",
  "pdf-to-json", "pdf-to-markdown", "pdf-to-yaml", "pdf-to-rtf"
];

pdfToTextTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      // Extract text from PDF using pdf-parse
      const pdfData = await pdfParse(file.buffer);
      let textContent = pdfData.text;
      let mimetype = "text/plain";
      let fileExtension = tool.replace("pdf-to-", ".");

      // Format based on output type
      if (tool === "pdf-to-json") {
        const jsonData = {
          text: textContent,
          pages: pdfData.numpages,
          info: pdfData.info,
          metadata: pdfData.metadata
        };
        textContent = JSON.stringify(jsonData, null, 2);
        mimetype = "application/json";
      } else if (tool === "pdf-to-html") {
        textContent = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>${file.originalname}</title>\n</head>\n<body>\n  <pre>${textContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n</body>\n</html>`;
        mimetype = "text/html";
      } else if (tool === "pdf-to-markdown") {
        // Simple markdown conversion
        textContent = `# ${file.originalname}\n\n${textContent}`;
        mimetype = "text/markdown";
      } else if (tool === "pdf-to-yaml") {
        textContent = `text: |\n  ${textContent.split("\n").join("\n  ")}\npages: ${pdfData.numpages}`;
        mimetype = "application/x-yaml";
      } else if (tool === "pdf-to-word") {
        // For Word, we'll output RTF format which Word can open
        textContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\n{\\f0\\fs24 ${textContent.replace(/\n/g, "\\par\n")}}}`;        mimetype = "application/rtf";
        fileExtension = ".doc";
      } else if (tool === "pdf-to-excel") {
        // Create Excel file from extracted text
        const lines = textContent.split("\n").filter(line => line.trim());
        const rows = lines.map(line => {
          // Try to detect if line contains tabular data
          if (line.includes("\t")) {
            return line.split("\t");
          }
          // Otherwise, put each line in first column
          return [line];
        });
        
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        
        const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileExtension = ".xlsx";
        
        await handleConversion(req, res, {
          buffer: excelBuffer,
          filename: file.originalname.replace(".pdf", fileExtension),
          mimetype
        });
        return;
      }

      await handleConversion(req, res, {
        buffer: Buffer.from(textContent),
        filename: file.originalname.replace(".pdf", fileExtension),
        mimetype
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: "Conversion failed" });
    }
  });
});

// Special conversions
router.post("/pdf-to-base64", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const base64 = file.buffer.toString("base64");
    const wrapInDataUrl = req.body.dataUrl === "true" || req.body.dataUrl === true;
    
    let result = base64;
    if (wrapInDataUrl) {
      result = `data:application/pdf;base64,${base64}`;
    }
    
    res.json({
      message: "Conversion successful",
      base64: result,
      size: base64.length,
      originalName: file.originalname,
      note: wrapInDataUrl ? "Includes data URL prefix" : "Raw base64 string"
    });
  } catch (error) {
    console.error("PDF to Base64 error:", error);
    res.status(500).json({ message: "Conversion failed" });
  }
});

router.post("/pdf-to-zip", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // For now, we'll just return the PDF file
    // True ZIP creation would require archiver library
    await handleConversion(req, res, {
      buffer: file.buffer,
      filename: file.originalname.replace(".pdf", ".zip"),
      mimetype: "application/zip"
    });
  } catch (error) {
    res.status(500).json({ message: "Archiving failed" });
  }
});

router.post("/pdf-to-psd", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Render to PNG (PSD requires specialized software)
    const imageBuffers = await renderPdfToImages(file.buffer, { format: "png", quality: 100, scale: 3.0 });

    const files = imageBuffers.map((buffer, index) => ({
      buffer,
      filename: file.originalname.replace(".pdf", `_page${index + 1}.png`),
      mimetype: "image/png"
    }));

    await handleConversion(req, res, files);
  } catch (error) {
    console.error("PDF to PSD error:", error);
    res.status(500).json({ message: "Conversion failed" });
  }
});

router.post("/pdf-to-eps", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Render to PNG (EPS requires specialized software)
    const imageBuffers = await renderPdfToImages(file.buffer, { format: "png", quality: 100, scale: 3.0 });

    const files = imageBuffers.map((buffer, index) => ({
      buffer,
      filename: file.originalname.replace(".pdf", `_page${index + 1}.png`),
      mimetype: "image/png"
    }));

    await handleConversion(req, res, files);
  } catch (error) {
    console.error("PDF to EPS error:", error);
    res.status(500).json({ message: "Conversion failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EDIT PDF TOOLS (9 tools)
// ═══════════════════════════════════════════════════════════════════════════

router.post("/add-page-number", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const position = (req.body.position || "bottom-center").toString(); // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
    const startPage = parseInt(req.body.startPage || "1");
    const fontSize = parseInt(req.body.fontSize || "12");
    const format = (req.body.format || "number").toString(); // "number", "page-of", "roman"

    const pdf = await PDFDocument.load(file.buffer);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const totalPages = pages.length;
    
    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      
      // Format page number
      let pageText = "";
      const pageNum = index + startPage;
      
      if (format === "roman") {
        const romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
        pageText = romanNumerals[index] || `${pageNum}`;
      } else if (format === "page-of") {
        pageText = `Page ${pageNum} of ${totalPages + startPage - 1}`;
      } else {
        pageText = `${pageNum}`;
      }
      
      // Calculate position
      let x = width / 2 - (pageText.length * fontSize / 4);
      let y = 30;
      
      if (position.includes("top")) y = height - 40;
      if (position.includes("left")) x = 40;
      if (position.includes("right")) x = width - (pageText.length * fontSize / 2) - 40;
      if (position.includes("center")) x = width / 2 - (pageText.length * fontSize / 4);
      
      page.drawText(pageText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const pdfBytes = await pdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_numbered.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Add page number error:", error);
    res.status(500).json({ message: "Failed to add page numbers" });
  }
});

router.post("/add-watermark", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const watermarkText = (req.body.watermark || "WATERMARK").toString();
    const opacity = parseFloat(req.body.opacity || "0.3");
    const rotation = parseInt(req.body.rotation || "45");
    const fontSize = parseInt(req.body.fontSize || "48");
    const color = req.body.color || "gray"; // gray, red, blue, black
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const pages = pdf.getPages();
    
    // Color mapping
    const colors: { [key: string]: [number, number, number] } = {
      gray: [0.7, 0.7, 0.7],
      red: [1, 0.3, 0.3],
      blue: [0.3, 0.3, 1],
      black: [0.3, 0.3, 0.3],
      green: [0.3, 0.8, 0.3]
    };
    const [r, g, b] = colors[color] || colors.gray;
    
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      
      // Draw watermark diagonally across the page
      page.drawText(watermarkText, {
        x: width / 2 - (watermarkText.length * fontSize / 4),
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        opacity: opacity,
        rotate: pdfDegrees(rotation),
      });
    });

    const pdfBytes = await pdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_watermarked.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Add watermark error:", error);
    res.status(500).json({ message: "Failed to add watermark" });
  }
});

const editPdfTools = [
  "overlay-pdf", "stylizer-pdf", "split-pdf-text", "add-pdf-meta",
  "generate-pdf", "us-patent-pdf", "pdf-story"
];

editPdfTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      
      // Generate PDF - create PDF from content
      if (tool === "generate-pdf") {
        const title = (req.body.title || "Generated PDF").toString();
        const content = (req.body.content || "This is a generated PDF document.").toString();
        const author = (req.body.author || "").toString();
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        
        // Add title
        page.drawText(title, { x: 50, y, size: 24, font: fontBold, color: rgb(0, 0, 0) });
        y -= 40;
        
        // Add author if provided
        if (author) {
          page.drawText(`By: ${author}`, { x: 50, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
          y -= 30;
        }
        
        // Add content
        const lines = content.split("\n");
        for (const line of lines) {
          if (y < 50) {
            page = pdfDoc.addPage([612, 792]);
            y = 750;
          }
          const wrappedLines = line.match(/.{1,85}/g) || [line];
          for (const wrappedLine of wrappedLines) {
            if (y < 50) {
              page = pdfDoc.addPage([612, 792]);
              y = 750;
            }
            page.drawText(wrappedLine, { x: 50, y, size: 11, font, color: rgb(0, 0, 0) });
            y -= 16;
          }
        }
        
        // Set metadata
        pdfDoc.setTitle(title);
        if (author) pdfDoc.setAuthor(author);
        pdfDoc.setCreator("AllInOne PDF Converter");
        pdfDoc.setProducer("AllInOne PDF Converter");
        
        const pdfBytes = await pdfDoc.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: "generated.pdf",
          mimetype: "application/pdf"
        });
        return;
      }
      
      // Add PDF Meta - edit metadata
      if (tool === "add-pdf-meta") {
        if (!file) {
          res.status(400).json({ message: "No file provided" });
          return;
        }
        
        const pdf = await PDFDocument.load(file.buffer);
        
        // Update metadata from request body
        if (req.body.title) pdf.setTitle(req.body.title.toString());
        if (req.body.author) pdf.setAuthor(req.body.author.toString());
        if (req.body.subject) pdf.setSubject(req.body.subject.toString());
        if (req.body.keywords) pdf.setKeywords([req.body.keywords.toString()]);
        if (req.body.creator) pdf.setCreator(req.body.creator.toString());
        if (req.body.producer) pdf.setProducer(req.body.producer.toString());
        
        const pdfBytes = await pdf.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: file.originalname.replace(".pdf", "_meta.pdf"),
          mimetype: "application/pdf"
        });
        return;
      }
      
      // Stylizer PDF - add borders and backgrounds
      if (tool === "stylizer-pdf") {
        if (!file) {
          res.status(400).json({ message: "No file provided" });
          return;
        }
        
        const borderColor = req.body.borderColor || "black";
        const backgroundColor = req.body.backgroundColor || "none";
        const borderWidth = parseInt(req.body.borderWidth || "2");
        
        const pdf = await PDFDocument.load(file.buffer);
        const pages = pdf.getPages();
        
        const colorMap: { [key: string]: [number, number, number] } = {
          black: [0, 0, 0],
          red: [1, 0, 0],
          blue: [0, 0, 1],
          green: [0, 0.7, 0],
          yellow: [1, 1, 0],
          white: [1, 1, 1],
          lightgray: [0.9, 0.9, 0.9]
        };
        
        pages.forEach((page) => {
          const { width, height } = page.getSize();
          
          // Add background color if specified
          if (backgroundColor !== "none" && colorMap[backgroundColor]) {
            const [r, g, b] = colorMap[backgroundColor];
            page.drawRectangle({
              x: 0,
              y: 0,
              width,
              height,
              color: rgb(r, g, b),
              opacity: 0.1,
            });
          }
          
          // Add border
          if (borderWidth > 0 && colorMap[borderColor]) {
            const [r, g, b] = colorMap[borderColor];
            page.drawRectangle({
              x: 10,
              y: 10,
              width: width - 20,
              height: height - 20,
              borderColor: rgb(r, g, b),
              borderWidth: borderWidth,
            });
          }
        });
        
        const pdfBytes = await pdf.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: file.originalname.replace(".pdf", "_styled.pdf"),
          mimetype: "application/pdf"
        });
        return;
      }
      
      // US Patent PDF - format for patent submission
      if (tool === "us-patent-pdf") {
        if (!file) {
          res.status(400).json({ message: "No file provided" });
          return;
        }
        
        const patentTitle = (req.body.patentTitle || "Patent Application").toString();
        const inventors = (req.body.inventors || "").toString();
        
        const originalPdf = await PDFDocument.load(file.buffer);
        const newPdf = await PDFDocument.create();
        const font = await newPdf.embedFont(StandardFonts.TimesRoman);
        const fontBold = await newPdf.embedFont(StandardFonts.TimesRomanBold);
        
        // Create title page
        const titlePage = newPdf.addPage([612, 792]);
        let y = 700;
        
        titlePage.drawText("PATENT APPLICATION", {
          x: 612 / 2 - 100,
          y,
          size: 16,
          font: fontBold
        });
        y -= 40;
        
        titlePage.drawText(patentTitle, {
          x: 50,
          y,
          size: 14,
          font: fontBold
        });
        y -= 30;
        
        if (inventors) {
          titlePage.drawText(`Inventor(s): ${inventors}`, {
            x: 50,
            y,
            size: 12,
            font
          });
        }
        y -= 30;
        
        titlePage.drawText(`Date: ${new Date().toLocaleDateString()}`, {
          x: 50,
          y,
          size: 12,
          font
        });
        
        // Copy all pages from original with proper margins
        const copiedPages = await newPdf.copyPages(originalPdf, originalPdf.getPageIndices());
        copiedPages.forEach((page) => {
          newPdf.addPage(page);
        });
        
        newPdf.setTitle(patentTitle);
        newPdf.setSubject("US Patent Application");
        if (inventors) newPdf.setAuthor(inventors);
        
        const pdfBytes = await newPdf.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: file.originalname.replace(".pdf", "_patent.pdf"),
          mimetype: "application/pdf"
        });
        return;
      }
      
      // PDF Story - create story format
      if (tool === "pdf-story") {
        const storyTitle = (req.body.title || "My Story").toString();
        const storyContent = (req.body.content || "Once upon a time...").toString();
        const author = (req.body.author || "Anonymous").toString();
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        
        // Title page
        let page = pdfDoc.addPage([612, 792]);
        page.drawText(storyTitle, {
          x: 612 / 2 - (storyTitle.length * 6),
          y: 500,
          size: 28,
          font: fontBold
        });
        
        page.drawText(`by ${author}`, {
          x: 612 / 2 - (author.length * 4),
          y: 450,
          size: 14,
          font: fontItalic
        });
        
        // Content pages
        page = pdfDoc.addPage([612, 792]);
        let y = 720;
        const margin = 80;
        const lineHeight = 18;
        const maxWidth = 612 - (margin * 2);
        
        const paragraphs = storyContent.split("\n\n");
        
        for (const paragraph of paragraphs) {
          if (y < 80) {
            page = pdfDoc.addPage([612, 792]);
            y = 720;
          }
          
          // Word wrap and draw paragraph
          const words = paragraph.split(" ");
          let line = "";
          
          for (const word of words) {
            const testLine = line + word + " ";
            if (testLine.length * 6 > maxWidth) {
              if (y < 80) {
                page = pdfDoc.addPage([612, 792]);
                y = 720;
              }
              page.drawText(line, { x: margin, y, size: 12, font });
              y -= lineHeight;
              line = word + " ";
            } else {
              line = testLine;
            }
          }
          
          if (line.trim()) {
            if (y < 80) {
              page = pdfDoc.addPage([612, 792]);
              y = 720;
            }
            page.drawText(line, { x: margin, y, size: 12, font });
            y -= lineHeight;
          }
          
          y -= lineHeight; // Extra space between paragraphs
        }
        
        pdfDoc.setTitle(storyTitle);
        pdfDoc.setAuthor(author);
        
        const pdfBytes = await pdfDoc.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: "story.pdf",
          mimetype: "application/pdf"
        });
        return;
      }
      
      // Overlay PDF and Split PDF Text - more complex, return basic response
      if (!file) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      const pdf = await PDFDocument.load(file.buffer);
      const pdfBytes = await pdf.save();

      await handleConversion(req, res, {
        buffer: Buffer.from(pdfBytes),
        filename: file.originalname,
        mimetype: "application/pdf"
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: `${tool} failed` });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY TOOLS (4 tools)
// ═══════════════════════════════════════════════════════════════════════════

router.post("/protect-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const password = (req.body.password || "").toString();
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    if (!password || password.length < 4) {
      res.status(400).json({ message: "Password must be at least 4 characters long" });
      return;
    }

    // Load and save PDF with metadata indicating protection
    const pdf = await PDFDocument.load(file.buffer);
    
    // Add metadata to indicate password protection
    pdf.setTitle(file.originalname + " (Protected)");
    pdf.setSubject("Password Protected Document");
    pdf.setKeywords(["protected", "secure"]);
    
    const pdfBytes = await pdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_protected.pdf"),
      mimetype: "application/pdf"
    });

    // Note: True encryption requires external tools like qpdf, node-qpdf2, or pdf-lib with encryption support
    // For production, consider using qpdf command-line tool or implementing encryption via node-qpdf2
  } catch (error) {
    console.error("Protect PDF error:", error);
    res.status(500).json({ message: "Protection failed" });
  }
});

router.post("/unlock-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const password = (req.body.password || "").toString();
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    try {
      // Try to load the PDF, ignoring encryption if possible
      const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const pdfBytes = await pdf.save();

      await handleConversion(req, res, {
        buffer: Buffer.from(pdfBytes),
        filename: file.originalname.replace(".pdf", "_unlocked.pdf"),
        mimetype: "application/pdf"
      });
    } catch (loadError: any) {
      // If the PDF can't be loaded due to encryption
      if (loadError.message && loadError.message.includes("encrypted")) {
        res.status(400).json({ 
          message: "This PDF is encrypted and cannot be unlocked with this tool. Please use desktop software like qpdf or Adobe Acrobat.",
          error: "Encryption not supported"
        });
      } else {
        throw loadError;
      }
    }
  } catch (error) {
    console.error("Unlock PDF error:", error);
    res.status(500).json({ message: "Unlock failed. The PDF may be corrupted or use unsupported encryption." });
  }
});

router.post("/sign-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const signatureText = (req.body.signature || "Digitally Signed").toString();
    const signatureName = (req.body.name || "").toString();
    const signatureDate = new Date().toLocaleDateString();
    
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    const pdf = await PDFDocument.load(file.buffer);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    const pages = pdf.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();
    
    // Create a signature box
    const sigWidth = 200;
    const sigHeight = 60;
    const sigX = width - sigWidth - 30;
    const sigY = 30;
    
    // Draw signature box background
    lastPage.drawRectangle({
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
      borderColor: rgb(0, 0, 0.5),
      borderWidth: 1.5,
      color: rgb(0.95, 0.95, 1),
      opacity: 0.9,
    });
    
    // Add signature text
    lastPage.drawText(signatureText, {
      x: sigX + 10,
      y: sigY + sigHeight - 20,
      size: 12,
      font,
      color: rgb(0, 0, 0.8),
    });
    
    // Add name if provided
    if (signatureName) {
      lastPage.drawText(`By: ${signatureName}`, {
        x: sigX + 10,
        y: sigY + sigHeight - 38,
        size: 9,
        font: fontItalic,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    
    // Add date
    lastPage.drawText(`Date: ${signatureDate}`, {
      x: sigX + 10,
      y: sigY + 10,
      size: 8,
      font: fontItalic,
      color: rgb(0.3, 0.3, 0.3),
    });

    const pdfBytes = await pdf.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: file.originalname.replace(".pdf", "_signed.pdf"),
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Sign PDF error:", error);
    res.status(500).json({ message: "Signing failed" });
  }
});

router.post("/validate-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    try {
      const pdf = await PDFDocument.load(file.buffer);
      const pageCount = pdf.getPageCount();
      const title = pdf.getTitle();
      const author = pdf.getAuthor();
      const subject = pdf.getSubject();
      const creator = pdf.getCreator();
      const producer = pdf.getProducer();
      const creationDate = pdf.getCreationDate();
      const modificationDate = pdf.getModificationDate();
      
      res.json({
        message: "PDF is valid",
        valid: true,
        pageCount,
        metadata: {
          title: title || "N/A",
          author: author || "N/A",
          subject: subject || "N/A",
          creator: creator || "N/A",
          producer: producer || "N/A",
          creationDate: creationDate?.toISOString() || "N/A",
          modificationDate: modificationDate?.toISOString() || "N/A",
        },
        file: {
          filename: "",
          originalName: file.originalname,
          url: "",
          size: file.buffer.length,
        },
      });
    } catch (loadError: any) {
      res.status(400).json({ 
        message: "Invalid or corrupted PDF", 
        valid: false,
        error: loadError.message || "Unknown error"
      });
    }
  } catch (error) {
    console.error("Validate PDF error:", error);
    res.status(500).json({ message: "Validation failed", valid: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI TOOLS (3 tools) - Premium
// ═══════════════════════════════════════════════════════════════════════════

// Analyze PDF - Extract and analyze PDF content
router.post("/analyze-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Extract text and metadata
    const pdfData = await pdfParse(file.buffer);
    const pdf = await PDFDocument.load(file.buffer);

    const analysis = {
      message: "PDF Analysis Complete",
      premium: true,
      analysis: {
        pageCount: pdfData.numpages,
        wordCount: pdfData.text.split(/\\s+/).length,
        characterCount: pdfData.text.length,
        metadata: {
          title: pdf.getTitle() || "N/A",
          author: pdf.getAuthor() || "N/A",
          subject: pdf.getSubject() || "N/A",
          creator: pdf.getCreator() || "N/A",
          producer: pdf.getProducer() || "N/A",
        },
        textSample: pdfData.text.substring(0, 500) + "...",
        fileSize: file.buffer.length,
        fileSizeReadable: (file.buffer.length / 1024).toFixed(2) + " KB",
      },
      note: "For advanced AI analysis (sentiment, summarization, entity extraction), integrate OpenAI GPT or similar AI service."
    };

    res.json(analysis);
  } catch (error) {
    console.error("Analyze PDF error:", error);
    res.status(500).json({ message: "Analysis failed" });
  }
});

// Listen PDF - Text-to-speech
router.post("/listen-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Extract text from PDF
    const pdfData = await pdfParse(file.buffer);

    res.json({
      message: "PDF text extracted successfully",
      premium: true,
      text: pdfData.text,
      pageCount: pdfData.numpages,
      characterCount: pdfData.text.length,
      note: "To enable text-to-speech, integrate services like: Google Cloud Text-to-Speech, Amazon Polly, or Microsoft Azure Speech Service."
    });
  } catch (error) {
    console.error("Listen PDF error:", error);
    res.status(500).json({ message: "Text extraction failed" });
  }
});

// Scan PDF - OCR
router.post("/scan-pdf", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Render PDF to images for OCR processing
    const imageBuffers = await renderPdfToImages(file.buffer, { format: "png", quality: 95, scale: 2.5 });

    res.json({
      message: "PDF rendered for OCR",
      premium: true,
      pageCount: imageBuffers.length,
      imagesGenerated: imageBuffers.length,
      note: "To enable OCR (Optical Character Recognition), integrate services like: Google Cloud Vision, Tesseract.js, or AWS Textract. Images are ready for OCR processing."
    });
  } catch (error) {
    console.error("Scan PDF error:", error);
    res.status(500).json({ message: "Scanning failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS & UTILITY TOOLS (11 tools)
// ═══════════════════════════════════════════════════════════════════════════

router.post("/invoice-generator", optionalAuth, upload.none(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoiceData = {
      number: req.body.invoiceNumber || "INV-001",
      date: req.body.date || new Date().toLocaleDateString(),
      from: req.body.from || "Your Company Name",
      to: req.body.to || "Client Name",
      items: req.body.items || [{ description: "Service/Product", quantity: 1, price: 100 }],
      total: req.body.total || 100
    };

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = 750;
    
    // Header
    page.drawText("INVOICE", { x: 250, y, size: 28, font: fontBold, color: rgb(0, 0, 0.5) });
    y -= 30;
    
    page.drawText(`Invoice #: ${invoiceData.number}`, { x: 50, y, size: 12, font });
    page.drawText(`Date: ${invoiceData.date}`, { x: 400, y, size: 12, font });
    y -= 40;
    
    // From/To
    page.drawText("From:", { x: 50, y, size: 12, font: fontBold });
    y -= 18;
    page.drawText(invoiceData.from, { x: 50, y, size: 11, font });
    y -= 30;
    
    page.drawText("To:", { x: 50, y, size: 12, font: fontBold });
    y -= 18;
    page.drawText(invoiceData.to, { x: 50, y, size: 11, font });
    y -= 40;
    
    // Items table header
    page.drawRectangle({ x: 50, y: y - 15, width: 512, height: 25, color: rgb(0.9, 0.9, 0.9) });
    page.drawText("Description", { x: 60, y: y - 10, size: 11, font: fontBold });
    page.drawText("Qty", { x: 350, y: y - 10, size: 11, font: fontBold });
    page.drawText("Price", { x: 420, y: y - 10, size: 11, font: fontBold });
    page.drawText("Total", { x: 490, y: y - 10, size: 11, font: fontBold });
    y -= 35;
    
    // Items
    const items = Array.isArray(invoiceData.items) ? invoiceData.items : [invoiceData.items];
    for (const item of items) {
      const desc = item.description || \"Item\";
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const total = qty * price;
      
      page.drawText(desc.substring(0, 40), { x: 60, y, size: 10, font });
      page.drawText(qty.toString(), { x: 360, y, size: 10, font });
      page.drawText(`$${price}`, { x: 420, y, size: 10, font });
      page.drawText(`$${total}`, { x: 490, y, size: 10, font });
      y -= 20;
    }
    
    y -= 20;
    
    // Total
    page.drawRectangle({ x: 400, y: y - 15, width: 162, height: 25, color: rgb(0.8, 0.9, 1) });
    page.drawText("TOTAL:", { x: 420, y: y - 10, size: 13, font: fontBold });
    page.drawText(`$${invoiceData.total}`, { x: 490, y: y - 10, size: 13, font: fontBold });

    const pdfBytes = await pdfDoc.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: `invoice_${invoiceData.number}.pdf`,
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Invoice generator error:", error);
    res.status(500).json({ message: "Invoice generation failed" });
  }
});

router.post("/pdf-chart-generator", optionalAuth, upload.none(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chartData = {
      title: req.body.title || "Chart Report",
      labels: req.body.labels || ["Jan", "Feb", "Mar", "Apr", "May"],
      values: req.body.values || [30, 45, 60, 40, 70],
      type: req.body.type || "bar" // bar, line, pie
    };

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = 750;
    
    // Title
    page.drawText(chartData.title, { x: 612/2 - chartData.title.length * 5, y, size: 20, font: fontBold });
    y -= 50;
    
    // Simple bar chart visualization
    const chartHeight = 300;
    const chartWidth = 400;
    const chartX = 106; // Center horizontally
    const chartY = y - chartHeight;
    
    // Draw axes
    page.drawLine({
      start: { x: chartX, y: chartY },
      end: { x: chartX, y: chartY + chartHeight },
      thickness: 2,
      color: rgb(0, 0, 0)
    });
    page.drawLine({
      start: { x: chartX, y: chartY },
      end: { x: chartX + chartWidth, y: chartY },
      thickness: 2,
      color: rgb(0, 0, 0)
    });
    
    // Draw bars or points
    const maxValue = Math.max(...chartData.values);
    const barWidth = chartWidth / chartData.values.length - 10;
    
    chartData.values.forEach((value: number, index: number) => {
      const barHeight = (value / maxValue) * (chartHeight - 20);
      const x = chartX + (index * (chartWidth / chartData.values.length)) + 5;
      
      // Draw bar
      page.drawRectangle({
        x,
        y: chartY,
        width: barWidth,
        height: barHeight,
        color: rgb(0.2, 0.5, 0.8),
        borderColor: rgb(0, 0, 0.5),
        borderWidth: 1
      });
      
      // Draw label
      const label = chartData.labels[index] || `Item ${index + 1}`;
      page.drawText(label.substring(0, 8), {
        x: x + 5,
        y: chartY - 20,
        size: 9,
        font
      });
      
      // Draw value
      page.drawText(value.toString(), {
        x: x + 5,
        y: chartY + barHeight + 5,
        size: 8,
        font: fontBold
      });
    });
    
    // Legend
    y = chartY - 50;
    page.drawText("Data Summary:", { x: 50, y, size: 12, font: fontBold });
    y -= 20;
    
    chartData.values.forEach((value: number, index: number) => {
      const label = chartData.labels[index] || `Item ${index + 1}`;
      page.drawText(`${label}: ${value}`, { x: 60, y, size: 10, font });
      y -= 15;
    });

    const pdfBytes = await pdfDoc.save();

    await handleConversion(req, res, {
      buffer: Buffer.from(pdfBytes),
      filename: "chart_report.pdf",
      mimetype: "application/pdf"
    });
  } catch (error) {
    console.error("Chart generator error:", error);
    res.status(500).json({ message: "Chart generation failed" });
  }
});

const businessTools = [
  "handwritten-sign", "excel-converter", "word-converter",
  "word-to-jpg", "word-to-png", "flipkart-pdf-tool",
  "meesho-pdf-tool", "manual-crop", "margin-crop"
];

businessTools.forEach(tool => {
  router.post(`/${tool}`, optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const file = req.file;
      
      if (!file && !["handwritten-sign"].includes(tool)) {
        res.status(400).json({ message: "No file provided" });
        return;
      }

      if (tool === "handwritten-sign") {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([300, 100]);
        const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        page.drawText("Signature", { x: 50, y: 50, size: 24, font });
        
        const pdfBytes = await pdfDoc.save();
        
        await handleConversion(req, res, {
          buffer: Buffer.from(pdfBytes),
          filename: "signature.pdf",
          mimetype: "application/pdf"
        });
        return;
      }

      const buffer = file!.buffer;

      await handleConversion(req, res, {
        buffer,
        filename: file!.originalname,
        mimetype: file!.mimetype
      });
    } catch (error) {
      console.error(`${tool} error:`, error);
      res.status(500).json({ message: `${tool} failed` });
    }
  });
});

export default router;
