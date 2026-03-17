// ─── Tool Data Configuration ───
// Every PDF tool in the platform is defined here.

export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string; // lucide icon name
  premium?: boolean;
}

export type ToolCategory =
  | "organize"
  | "optimize"
  | "convert-to-pdf"
  | "convert-from-pdf"
  | "edit"
  | "security"
  | "ai"
  | "business";

export interface CategoryMeta {
  slug: ToolCategory;
  label: string;
  description: string;
  color: string; // tailwind color token
  icon: string;
}

export const categories: CategoryMeta[] = [
  {
    slug: "organize",
    label: "Organize PDF",
    description: "Merge, split, reorder, and manage PDF pages",
    color: "blue",
    icon: "LayoutList",
  },
  {
    slug: "optimize",
    label: "Optimize PDF",
    description: "Compress, resize, enhance, and clean PDFs",
    color: "green",
    icon: "Zap",
  },
  {
    slug: "convert-to-pdf",
    label: "Convert To PDF",
    description: "Convert images, documents, and data to PDF",
    color: "purple",
    icon: "FileInput",
  },
  {
    slug: "convert-from-pdf",
    label: "Convert From PDF",
    description: "Export PDFs to images, docs, and other formats",
    color: "orange",
    icon: "FileOutput",
  },
  {
    slug: "edit",
    label: "Edit PDF",
    description: "Add watermarks, page numbers, margins, and more",
    color: "rose",
    icon: "PenTool",
  },
  {
    slug: "security",
    label: "PDF Security",
    description: "Protect, unlock, sign, and validate PDFs",
    color: "amber",
    icon: "ShieldCheck",
  },
  {
    slug: "ai",
    label: "AI PDF Tools",
    description: "Advanced AI-powered PDF processing",
    color: "cyan",
    icon: "Sparkles",
  },
  {
    slug: "business",
    label: "Business & Utility",
    description: "Invoices, charts, converters, and marketplace tools",
    color: "indigo",
    icon: "Briefcase",
  },
];

export const tools: Tool[] = [
  // ── Organize ──
  { slug: "merge-pdf", name: "Merge PDF", description: "Combine multiple PDFs into one document", category: "organize", icon: "Merge" },
  { slug: "split-pdf", name: "Split PDF", description: "Split a PDF into separate files", category: "organize", icon: "Scissors" },
  { slug: "extract-pdf-pages", name: "Extract PDF Pages", description: "Extract specific pages from a PDF", category: "organize", icon: "FileSymlink" },
  { slug: "remove-pdf-pages", name: "Remove PDF Pages", description: "Delete unwanted pages from a PDF", category: "organize", icon: "FileX" },
  { slug: "delete-pages", name: "Delete Pages", description: "Delete selected pages from a PDF", category: "organize", icon: "Trash2" },
  { slug: "organize-pdf", name: "Organize PDF", description: "Reorder and rearrange PDF pages", category: "organize", icon: "ArrowUpDown" },
  { slug: "reorder-pages", name: "Reorder Pages", description: "Reorder pages in a PDF document", category: "organize", icon: "ArrowUpDown" },
  { slug: "reverse-pdf", name: "Reverse PDF", description: "Reverse the page order of a PDF", category: "organize", icon: "ArrowDownUp" },
  { slug: "rotate-pdf", name: "Rotate PDF", description: "Rotate PDF pages to any angle", category: "organize", icon: "RotateCw" },
  { slug: "merge-pdf-image", name: "Merge PDF & Image", description: "Combine PDFs and images into one file", category: "organize", icon: "ImagePlus" },
  { slug: "merge-pdf-text", name: "Merge PDF & Text", description: "Merge PDFs with text content", category: "organize", icon: "FileText" },
  { slug: "make-pdf-parts", name: "Make PDF Parts", description: "Divide PDF into equal parts", category: "organize", icon: "LayoutGrid" },
  { slug: "pdf-splitter", name: "PDF Splitter", description: "Advanced PDF splitting options", category: "organize", icon: "SplitSquareHorizontal" },

  // ── Optimize ──
  { slug: "compress-pdf", name: "Compress PDF", description: "Reduce PDF file size without losing quality", category: "optimize", icon: "Minimize2" },
  { slug: "resize-pdf", name: "Resize PDF", description: "Change PDF page dimensions", category: "optimize", icon: "Maximize2" },
  { slug: "crop-pdf", name: "Crop PDF", description: "Crop PDF pages to specific dimensions", category: "optimize", icon: "Crop" },
  { slug: "convert-pdf-a", name: "Convert PDF/A", description: "Convert PDF to archival PDF/A-like format", category: "optimize", icon: "FileArchive" },
  { slug: "clean-pdf", name: "Clean PDF", description: "Remove unwanted elements from PDF", category: "optimize", icon: "Eraser" },
  { slug: "enhance-pdf", name: "Enhance PDF", description: "Improve PDF quality and readability", category: "optimize", icon: "Wand2" },
  { slug: "grayscale-pdf", name: "Grayscale PDF", description: "Convert PDF to grayscale", category: "optimize", icon: "Palette" },
  { slug: "pdf-color-inverter", name: "PDF Color Inverter", description: "Invert colors in a PDF document", category: "optimize", icon: "SunMoon" },
  { slug: "add-pdf-margin", name: "Add PDF Margin", description: "Add margins to PDF pages", category: "optimize", icon: "Square" },

  // ── Convert To PDF ──
  { slug: "jpg-to-pdf", name: "JPG to PDF", description: "Convert JPG images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "png-to-pdf", name: "PNG to PDF", description: "Convert PNG images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "word-to-pdf", name: "Word to PDF", description: "Convert Word documents to PDF", category: "convert-to-pdf", icon: "FileText" },
  { slug: "powerpoint-to-pdf", name: "PowerPoint to PDF", description: "Convert PowerPoint presentations to PDF", category: "convert-to-pdf", icon: "Presentation" },
  { slug: "excel-to-pdf", name: "Excel to PDF", description: "Convert Excel spreadsheets to PDF", category: "convert-to-pdf", icon: "Table" },
  { slug: "html-to-pdf", name: "HTML to PDF", description: "Convert HTML pages to PDF", category: "convert-to-pdf", icon: "Globe" },
  { slug: "convert-to-pdf", name: "Convert to PDF", description: "Convert common file types into PDF", category: "convert-to-pdf", icon: "FileInput" },
  { slug: "csv-to-pdf", name: "CSV to PDF", description: "Convert CSV data to PDF tables", category: "convert-to-pdf", icon: "Table2" },
  { slug: "svg-to-pdf", name: "SVG to PDF", description: "Convert SVG graphics to PDF", category: "convert-to-pdf", icon: "Shapes" },
  { slug: "bmp-to-pdf", name: "BMP to PDF", description: "Convert BMP images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "gif-to-pdf", name: "GIF to PDF", description: "Convert GIF images to PDF", category: "convert-to-pdf", icon: "Film" },
  { slug: "webp-to-pdf", name: "WEBP to PDF", description: "Convert WebP images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "avif-to-pdf", name: "AVIF to PDF", description: "Convert AVIF images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "psd-to-pdf", name: "PSD to PDF", description: "Convert Photoshop files to PDF", category: "convert-to-pdf", icon: "Layers" },
  { slug: "ico-to-pdf", name: "ICO to PDF", description: "Convert ICO icons to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "tga-to-pdf", name: "TGA to PDF", description: "Convert TGA images to PDF", category: "convert-to-pdf", icon: "Image" },
  { slug: "txt-to-pdf", name: "TXT to PDF", description: "Convert plain text files to PDF", category: "convert-to-pdf", icon: "FileText" },
  { slug: "text-to-pdf", name: "Text to PDF", description: "Type or paste text and generate a PDF", category: "convert-to-pdf", icon: "Type" },
  { slug: "json-to-pdf", name: "JSON to PDF", description: "Convert JSON data to PDF", category: "convert-to-pdf", icon: "Braces" },
  { slug: "xml-to-pdf", name: "XML to PDF", description: "Convert XML data to PDF", category: "convert-to-pdf", icon: "Code" },
  { slug: "yaml-to-pdf", name: "YAML to PDF", description: "Convert YAML files to PDF", category: "convert-to-pdf", icon: "FileCode" },
  { slug: "markdown-to-pdf", name: "Markdown to PDF", description: "Convert Markdown to PDF", category: "convert-to-pdf", icon: "Hash" },
  { slug: "ini-to-pdf", name: "INI to PDF", description: "Convert INI config files to PDF", category: "convert-to-pdf", icon: "Settings" },
  { slug: "srt-to-pdf", name: "SRT to PDF", description: "Convert SRT subtitles to PDF", category: "convert-to-pdf", icon: "Subtitles" },
  { slug: "vtt-to-pdf", name: "VTT to PDF", description: "Convert VTT captions to PDF", category: "convert-to-pdf", icon: "Subtitles" },
  { slug: "tsv-to-pdf", name: "TSV to PDF", description: "Convert TSV data to PDF", category: "convert-to-pdf", icon: "Table" },
  { slug: "base64-to-pdf", name: "Base-64 to PDF", description: "Decode Base64 string to PDF", category: "convert-to-pdf", icon: "Binary" },
  { slug: "camera-to-pdf", name: "Camera to PDF", description: "Capture photos and save as PDF", category: "convert-to-pdf", icon: "Camera" },
  { slug: "speech-to-pdf", name: "Speech to PDF", description: "Convert speech audio to PDF text", category: "convert-to-pdf", icon: "Mic" },
  { slug: "spreadsheet-to-pdf", name: "Spreadsheet to PDF", description: "Convert spreadsheet files to PDF", category: "convert-to-pdf", icon: "Sheet" },
  { slug: "excel-url-to-pdf", name: "Excel URL to PDF", description: "Convert online Excel file to PDF", category: "convert-to-pdf", icon: "Link" },
  { slug: "word-url-to-pdf", name: "Word URL to PDF", description: "Convert online Word doc to PDF", category: "convert-to-pdf", icon: "Link" },

  // ── Convert From PDF ──
  { slug: "pdf-to-jpg", name: "PDF to JPG", description: "Convert PDF pages to JPG images", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-png", name: "PDF to PNG", description: "Convert PDF pages to PNG images", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-word", name: "PDF to Word", description: "Convert PDF to Word document", category: "convert-from-pdf", icon: "FileText" },
  { slug: "pdf-to-powerpoint", name: "PDF to PowerPoint", description: "Convert PDF to PowerPoint slides", category: "convert-from-pdf", icon: "Presentation" },
  { slug: "pdf-to-excel", name: "PDF to Excel", description: "Convert PDF tables to Excel", category: "convert-from-pdf", icon: "Table" },
  { slug: "pdf-to-txt", name: "PDF to TXT", description: "Extract text from PDF", category: "convert-from-pdf", icon: "FileText" },
  { slug: "extract-images", name: "Extract Images", description: "Extract all images/pages from a PDF", category: "convert-from-pdf", icon: "Images" },
  { slug: "extract-text", name: "Extract Text", description: "Extract plain text from a PDF", category: "convert-from-pdf", icon: "FileText" },
  { slug: "pdf-to-html", name: "PDF to HTML", description: "Convert PDF to HTML page", category: "convert-from-pdf", icon: "Globe" },
  { slug: "pdf-to-json", name: "PDF to JSON", description: "Extract PDF data as JSON", category: "convert-from-pdf", icon: "Braces" },
  { slug: "pdf-to-markdown", name: "PDF to Markdown", description: "Convert PDF to Markdown", category: "convert-from-pdf", icon: "Hash" },
  { slug: "pdf-to-yaml", name: "PDF to YAML", description: "Convert PDF data to YAML", category: "convert-from-pdf", icon: "FileCode" },
  { slug: "pdf-to-webp", name: "PDF to WEBP", description: "Convert PDF pages to WebP", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-avif", name: "PDF to AVIF", description: "Convert PDF pages to AVIF", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-bmp", name: "PDF to BMP", description: "Convert PDF pages to BMP", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-tga", name: "PDF to TGA", description: "Convert PDF pages to TGA", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-tiff", name: "PDF to TIFF", description: "Convert PDF pages to TIFF", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-ico", name: "PDF to ICO", description: "Convert PDF to ICO icon", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-psd", name: "PDF to PSD", description: "Convert PDF to Photoshop", category: "convert-from-pdf", icon: "Layers" },
  { slug: "pdf-to-eps", name: "PDF to EPS", description: "Convert PDF to EPS format", category: "convert-from-pdf", icon: "FileImage" },
  { slug: "pdf-to-heic", name: "PDF to HEIC", description: "Convert PDF to HEIC format", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-heif", name: "PDF to HEIF", description: "Convert PDF to HEIF format", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-raw", name: "PDF to RAW", description: "Convert PDF to RAW image", category: "convert-from-pdf", icon: "Image" },
  { slug: "pdf-to-rtf", name: "PDF to RTF", description: "Convert PDF to Rich Text Format", category: "convert-from-pdf", icon: "FileText" },
  { slug: "pdf-to-base64", name: "PDF to Base-64", description: "Encode PDF as Base64 string", category: "convert-from-pdf", icon: "Binary" },
  { slug: "pdf-to-zip", name: "PDF to ZIP", description: "Archive PDF pages as ZIP", category: "convert-from-pdf", icon: "Archive" },

  // ── Edit PDF ──
  { slug: "add-page-number", name: "Add Page Number", description: "Add page numbers to PDF", category: "edit", icon: "ListOrdered" },
  { slug: "add-watermark", name: "Add Watermark", description: "Add text or image watermark to PDF", category: "edit", icon: "Droplets" },
  { slug: "compare-pdf", name: "Compare PDF", description: "Compare two PDFs and generate a differences report", category: "edit", icon: "GitCompareArrows" },
  { slug: "ocr-pdf", name: "OCR PDF", description: "Extract text from scanned PDFs", category: "edit", icon: "ScanLine" },
  { slug: "overlay-pdf", name: "Overlay PDF", description: "Overlay content onto PDF pages", category: "edit", icon: "Layers" },
  { slug: "stylizer-pdf", name: "Stylizer PDF", description: "Apply custom styles to PDF", category: "edit", icon: "Paintbrush" },
  { slug: "split-pdf-text", name: "Split PDF Text", description: "Split PDF by text content", category: "edit", icon: "SplitSquareVertical" },
  { slug: "add-pdf-meta", name: "Add PDF Meta", description: "Edit PDF metadata and properties", category: "edit", icon: "Tag" },
  { slug: "generate-pdf", name: "Generate PDF", description: "Generate PDF from scratch", category: "edit", icon: "FilePlus" },
  { slug: "us-patent-pdf", name: "US Patent PDF", description: "Format PDFs for US patent submission", category: "edit", icon: "Award" },
  { slug: "pdf-story", name: "PDF Story", description: "Create story-format PDF", category: "edit", icon: "BookOpen" },

  // ── Security ──
  { slug: "protect-pdf", name: "Protect PDF", description: "Add password protection to PDF", category: "security", icon: "Lock" },
  { slug: "unlock-pdf", name: "Unlock PDF", description: "Remove password from PDF", category: "security", icon: "Unlock" },
  { slug: "sign-pdf", name: "Sign PDF", description: "Add digital or handwritten signature", category: "security", icon: "PenLine" },
  { slug: "redact-pdf", name: "Redact PDF", description: "Redact sensitive text from PDF content", category: "security", icon: "Eraser" },
  { slug: "repair-pdf", name: "Repair PDF", description: "Repair and rewrite damaged PDF structure", category: "security", icon: "Wrench" },
  { slug: "validate-pdf", name: "Validate PDF", description: "Check PDF for errors and compliance", category: "security", icon: "CheckCircle" },

  // ── AI / Advanced ──
  { slug: "analyze-pdf", name: "Analyze PDF", description: "AI-powered PDF analysis and insights", category: "ai", icon: "BarChart3", premium: true },
  { slug: "listen-pdf", name: "Listen PDF", description: "Text-to-speech for PDF content", category: "ai", icon: "Volume2", premium: true },
  { slug: "scan-pdf", name: "Scan PDF", description: "OCR scan and digitize documents", category: "ai", icon: "ScanLine", premium: true },

  // ── Business & Utility ──
  { slug: "invoice-generator", name: "Invoice Generator", description: "Create professional invoices as PDF", category: "business", icon: "Receipt" },
  { slug: "pdf-chart-generator", name: "PDF Chart Generator", description: "Generate charts and export as PDF", category: "business", icon: "PieChart" },
  { slug: "handwritten-sign", name: "Handwritten Sign", description: "Create handwritten signature images", category: "business", icon: "Signature" },
  { slug: "excel-converter", name: "Excel Converter", description: "All-in-one Excel conversion tool", category: "business", icon: "Table" },
  { slug: "word-converter", name: "Word Converter", description: "All-in-one Word conversion tool", category: "business", icon: "FileText" },
  { slug: "split-word", name: "Split Word", description: "Split a Word document into separate parts", category: "business", icon: "SplitSquareHorizontal" },
  { slug: "merge-word", name: "Merge Word", description: "Merge multiple Word documents into one", category: "business", icon: "Combine" },
  { slug: "html-to-word", name: "HTML to Word", description: "Convert HTML content to a Word document", category: "business", icon: "FileCode2" },
  { slug: "image-compressor", name: "Image Compressor", description: "Compress image file size", category: "business", icon: "Minimize2" },
  { slug: "image-resizer", name: "Image Resizer", description: "Resize images to desired dimensions", category: "business", icon: "Maximize2" },
  { slug: "image-cropper", name: "Image Cropper", description: "Crop images to selected area", category: "business", icon: "Crop" },
  { slug: "image-rotate", name: "Image Rotate", description: "Rotate images by custom angles", category: "business", icon: "RotateCw" },
  { slug: "image-to-text", name: "Image to Text", description: "Extract text from images (OCR)", category: "business", icon: "ScanText" },
  { slug: "jpg-to-word", name: "JPG to Word", description: "Extract JPG text into a Word document", category: "business", icon: "FileText" },
  { slug: "png-to-word", name: "PNG to Word", description: "Extract PNG text into a Word document", category: "business", icon: "FileText" },
  { slug: "jpg-to-excel", name: "JPG to Excel", description: "Extract JPG text into an Excel sheet", category: "business", icon: "Table" },
  { slug: "png-to-excel", name: "PNG to Excel", description: "Extract PNG text into an Excel sheet", category: "business", icon: "Table" },
  { slug: "barcode-generator", name: "Barcode Generator", description: "Generate barcodes from text", category: "business", icon: "Barcode" },
  { slug: "qr-code-generator", name: "QR Code Generator", description: "Generate QR code images", category: "business", icon: "QrCode" },
  { slug: "qr-code-scanner", name: "QR Code Scanner", description: "Scan QR code from uploaded image", category: "business", icon: "ScanQrCode" },
  { slug: "unit-converter", name: "Unit Converter", description: "Convert between common measurement units", category: "business", icon: "Ruler" },
  { slug: "currency-converter", name: "Currency Converter", description: "Convert between major world currencies", category: "business", icon: "Coins" },
  { slug: "text-to-speech", name: "Text to Speech", description: "Generate SSML/text output for speech engines", category: "business", icon: "Volume2" },
  { slug: "speech-to-text", name: "Speech to Text", description: "Process audio upload into text output", category: "business", icon: "Mic" },
  { slug: "password-generator", name: "Password Generator", description: "Generate secure random passwords", category: "business", icon: "KeyRound" },
  { slug: "password-strength-checker", name: "Password Strength Checker", description: "Check password strength score", category: "business", icon: "ShieldCheck" },
  { slug: "lorem-ipsum-generator", name: "Lorem Ipsum Generator", description: "Generate placeholder paragraph text", category: "business", icon: "FileText" },
  { slug: "random-number-generator", name: "Random Number Generator", description: "Generate random numbers in a range", category: "business", icon: "Dices" },
  { slug: "case-converter", name: "Case Converter", description: "Convert text case styles", category: "business", icon: "Type" },
  { slug: "json-formatter", name: "JSON Formatter", description: "Format and prettify JSON text", category: "business", icon: "Braces" },
  { slug: "xml-formatter", name: "XML Formatter", description: "Format and prettify XML content", category: "business", icon: "CodeXml" },
  { slug: "csv-to-excel", name: "CSV to Excel", description: "Convert CSV data into XLSX format", category: "business", icon: "Table2" },
  { slug: "number-to-words", name: "Number to Words", description: "Convert numbers into written words", category: "business", icon: "SpellCheck" },
  { slug: "age-calculator", name: "Age Calculator", description: "Calculate age from date of birth", category: "business", icon: "CalendarClock" },
  { slug: "bmi-calculator", name: "BMI Calculator", description: "Calculate body mass index", category: "business", icon: "HeartPulse" },
  { slug: "gst-calculator", name: "GST Calculator", description: "Calculate GST tax and totals", category: "business", icon: "Receipt" },
  { slug: "word-to-jpg", name: "Word to JPG", description: "Convert Word document pages to JPG", category: "business", icon: "Image" },
  { slug: "word-to-png", name: "Word to PNG", description: "Convert Word document pages to PNG", category: "business", icon: "Image" },
  { slug: "flipkart-pdf-tool", name: "Flipkart PDF Tool", description: "Generate Flipkart-compatible PDFs", category: "business", icon: "ShoppingBag" },
  { slug: "meesho-pdf-tool", name: "Meesho PDF Tool", description: "Generate Meesho-compatible PDFs", category: "business", icon: "ShoppingBag" },
  { slug: "manual-crop", name: "Manual Crop", description: "Manually crop PDF regions", category: "business", icon: "Crop" },
  { slug: "margin-crop", name: "Margin Crop", description: "Crop PDF margins precisely", category: "business", icon: "Crop" },
];

// Helpers
export function getToolsByCategory(cat: ToolCategory): Tool[] {
  return tools.filter((t) => t.category === cat);
}

export function getToolBySlug(slug: string): Tool | undefined {
  const direct = tools.find((t) => t.slug === slug);
  if (direct) return direct;

  const canonicalSlug = toolSlugAliases[slug];
  if (!canonicalSlug) return undefined;
  return tools.find((t) => t.slug === canonicalSlug);
}

export const toolSlugAliases: Record<string, string> = {
  "watermark-pdf": "add-watermark",
  "page-numbers": "add-page-number",
  "pdf-editor": "stylizer-pdf",
  "add-text-to-pdf": "merge-pdf-text",
  "add-image-to-pdf": "merge-pdf-image",
  "gst-calculat": "gst-calculator",
};

export function getCategoryBySlug(slug: ToolCategory): CategoryMeta | undefined {
  return categories.find((c) => c.slug === slug);
}

export function searchTools(query: string): Tool[] {
  const q = query.toLowerCase();
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.slug.includes(q)
  );
}

// Featured tools - AI and premium tools
export function getFeaturedTools(): Tool[] {
  return [
    ...tools.filter((t) => t.premium),
    tools.find((t) => t.slug === "sign-pdf")!,
    tools.find((t) => t.slug === "protect-pdf")!,
    tools.find((t) => t.slug === "invoice-generator")!,
  ].filter(Boolean);
}

// Popular tools - most commonly used
export function getPopularTools(): Tool[] {
  const popularSlugs = [
    "merge-pdf",
    "split-pdf",
    "compress-pdf",
    "pdf-to-jpg",
    "jpg-to-pdf",
    "pdf-to-word",
    "word-to-pdf",
    "add-watermark",
    "rotate-pdf",
    "unlock-pdf",
  ];
  return popularSlugs.map((slug) => tools.find((t) => t.slug === slug)!).filter(Boolean);
}
