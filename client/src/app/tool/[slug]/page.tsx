"use client";

import { notFound } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import { Shield, Clock, Sparkles, Crown, Lock } from "lucide-react";
import { getToolBySlug, getCategoryBySlug } from "@/lib/tools-data";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { ToolFileUpload } from "@/components/tool-file-upload";
import { Badge, Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { AdBanner } from "@/components/AdBanner";

interface Props {
  params: Promise<{ slug: string }>;
}

export default function ToolPage({ params }: Props) {
  const { slug } = use(params);
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const { isPremium, isLoggedIn } = useAuth();
  const category = getCategoryBySlug(tool.category);
  
  // Check if user can access this tool (only premium tools are restricted)
  const isPremiumTool = tool.premium === true;
  const canAccessTool = !isPremiumTool || isPremium;

  // Determine accepted file types based on tool
  const getAcceptedTypes = () => {
    const pdfInputTools = new Set([
      "delete-pages",
      "reorder-pages",
      "extract-images",
      "extract-text",
      "convert-pdf-a",
      "pdf-to-html",
    ]);
    if (pdfInputTools.has(tool.slug)) {
      return { "application/pdf": [".pdf"] };
    }

    const htmlInputTools = new Set(["html-to-word"]);
    if (htmlInputTools.has(tool.slug)) {
      return { "text/html": [".html", ".htm"] };
    }

    const csvInputTools = new Set(["csv-to-excel"]);
    if (csvInputTools.has(tool.slug)) {
      return { "text/csv": [".csv"] };
    }

    const jsonInputTools = new Set(["json-formatter"]);
    if (jsonInputTools.has(tool.slug)) {
      return { "application/json": [".json"] };
    }

    const xmlInputTools = new Set(["xml-formatter"]);
    if (xmlInputTools.has(tool.slug)) {
      return { "application/xml": [".xml"], "text/xml": [".xml"] };
    }

    const audioInputTools = new Set(["speech-to-text"]);
    if (audioInputTools.has(tool.slug)) {
      return {
        "audio/mpeg": [".mp3"],
        "audio/wav": [".wav"],
        "audio/x-wav": [".wav"],
        "audio/ogg": [".ogg"],
        "audio/webm": [".webm"],
        "audio/mp4": [".m4a"],
      };
    }

    const imageInputTools = new Set([
      "image-compressor",
      "image-resizer",
      "image-cropper",
      "image-rotate",
      "image-to-text",
      "jpg-to-word",
      "png-to-word",
      "jpg-to-excel",
      "png-to-excel",
      "qr-code-scanner",
    ]);
    if (imageInputTools.has(tool.slug)) {
      return {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "image/bmp": [".bmp"],
        "image/gif": [".gif"],
      };
    }

    const textInputTools = new Set([
      "barcode-generator",
      "qr-code-generator",
      "unit-converter",
      "currency-converter",
      "text-to-speech",
      "password-generator",
      "password-strength-checker",
      "lorem-ipsum-generator",
      "random-number-generator",
      "case-converter",
      "number-to-words",
      "age-calculator",
      "bmi-calculator",
      "gst-calculator",
    ]);
    if (textInputTools.has(tool.slug)) {
      return { "text/plain": [".txt"] };
    }

    if (tool.slug === "merge-pdf-image") {
      return {
        "application/pdf": [".pdf"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "image/bmp": [".bmp"],
        "image/gif": [".gif"],
      };
    }

    if (tool.slug === "compare-pdf") {
      return { "application/pdf": [".pdf"] };
    }

    if (tool.slug === "word-to-jpg" || tool.slug === "word-to-png" || tool.slug === "split-word" || tool.slug === "merge-word" || tool.slug === "word-converter") {
      return {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/msword": [".doc"],
      };
    }

    if (tool.slug === "excel-converter") {
      return {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "application/vnd.ms-excel": [".xls"],
        "text/csv": [".csv"],
      };
    }

    if (tool.slug === "powerpoint-to-pdf") {
      return {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
        "application/vnd.ms-powerpoint": [".ppt"],
      };
    }

    if (tool.slug === "convert-to-pdf") {
      return {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
        "application/vnd.ms-powerpoint": [".ppt"],
        "text/html": [".html", ".htm"],
        "text/plain": [".txt"],
        "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"],
      };
    }

    // Image to PDF conversions
    if (tool.category === "convert-to-pdf") {
      const ext = tool.slug.split("-to-pdf")[0];
      const mimeMap: Record<string, Record<string, string[]>> = {
        jpg: { "image/jpeg": [".jpg", ".jpeg"] },
        png: { "image/png": [".png"] },
        bmp: { "image/bmp": [".bmp"] },
        gif: { "image/gif": [".gif"] },
        webp: { "image/webp": [".webp"] },
        svg: { "image/svg+xml": [".svg"] },
        txt: { "text/plain": [".txt"] },
        csv: { "text/csv": [".csv"] },
        html: { "text/html": [".html", ".htm"] },
        json: { "application/json": [".json"] },
        xml: { "application/xml": [".xml"] },
        yaml: { "application/x-yaml": [".yaml", ".yml"] },
        markdown: { "text/markdown": [".md", ".markdown"] },
        word: {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            [".docx", ".doc"],
        },
        excel: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            [".xlsx", ".xls"],
        },
        powerpoint: {
          "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            [".pptx", ".ppt"],
        },
      };
      return mimeMap[ext] || { "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"] };
    }
    
    // PDF to other format conversions
    if (tool.category === "convert-from-pdf") {
      return { "application/pdf": [".pdf"] };
    }
    
    // All PDF tools (merge, split, compress, etc.)
    return { "application/pdf": [".pdf"] };
  };

  // Determine max files based on tool
  const getMaxFiles = () => {
    if (tool.slug === "merge-pdf" || tool.slug === "merge-pdf-image" || tool.slug === "merge-word") {
      return 20;
    }

    if (tool.slug === "compare-pdf") {
      return 2;
    }

    const multiImageToPdfTools = new Set([
      "jpg-to-pdf",
      "png-to-pdf",
      "bmp-to-pdf",
      "gif-to-pdf",
      "webp-to-pdf",
      "svg-to-pdf",
      "avif-to-pdf",
      "psd-to-pdf",
      "ico-to-pdf",
      "tga-to-pdf",
    ]);
    if (multiImageToPdfTools.has(tool.slug)) {
      return 20;
    }

    return 1;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/" className="hover:text-blue-500 transition-colors">
          Home
        </Link>
        <span>/</span>
        {category && (
          <>
            <Link
              href={`/tools/${category.slug}`}
              className="hover:text-blue-500 transition-colors"
            >
              {category.label}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">{tool.name}</span>
      </div>

      {/* Tool Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <DynamicIcon name={tool.icon} className="w-8 h-8 text-blue-500" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">{tool.name}</h1>
          {isPremiumTool && <Badge variant="premium">PRO</Badge>}
        </div>
        <p className="text-muted-foreground text-lg">{tool.description}</p>
      </div>

      {/* Premium Tool Paywall */}
      {isPremiumTool && !canAccessTool && (
        <div className="bg-linear-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-8 text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Premium Tool</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            This AI-powered tool is exclusive to Premium members. Upgrade to access all premium features and enjoy an ad-free experience.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing">
              <Button size="lg">
                <Crown className="w-4 h-4" />
                Upgrade to Premium
              </Button>
            </Link>
            {!isLoggedIn && (
              <Link href="/auth/signin">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Upload Area - only show if tool is accessible */}
      {canAccessTool && (
        <ToolFileUpload
          toolSlug={tool.slug}
          accept={getAcceptedTypes()}
          maxFiles={getMaxFiles()}
          label={`Drop your file${getMaxFiles() > 1 ? "s" : ""} here`}
          description={`Upload ${getMaxFiles() > 1 ? "files" : "a file"} to ${tool.name.toLowerCase()}`}
        />
      )}

      {/* Ad Banner for free users */}
      {!isPremium && <AdBanner variant="horizontal" className="mt-8" />}

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
        <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
          <Shield className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Secure Processing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Files auto-delete after processing
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
          <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Fast Results</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Process in seconds, not minutes
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
          <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">High Quality</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No loss in file quality
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Upload File",
              desc: "Drag & drop or click to select your files",
            },
            {
              step: "2",
              title: "Auto Convert",
              desc: "Your file is converted automatically",
            },
            {
              step: "3",
              title: "Download",
              desc: "Download your converted file instantly",
            },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full gradient-bg text-white font-bold flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
