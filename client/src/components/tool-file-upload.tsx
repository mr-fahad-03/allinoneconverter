"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Download, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Button, Progress } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ConvertedFile {
  filename: string;
  originalName: string;
  url: string;
  size: number;
  publicId?: string;
}

interface ToolFileUploadProps {
  toolSlug: string;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  label?: string;
  description?: string;
}

export function ToolFileUpload({
  toolSlug,
  accept = { "application/pdf": [".pdf"] },
  maxFiles = 20,
  maxSize = 100 * 1024 * 1024,
  label = "Drop your files here",
  description = "or click to browse your device",
}: ToolFileUploadProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [convertedFile, setConvertedFile] = useState<ConvertedFile | null>(null);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("");

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setStatus("processing");
    setProgress(10);
    setError(null);
    setOriginalFileName(files[0].name);

    try {
      const formData = new FormData();
      
      // For merge, we need multiple files
      if (toolSlug === "merge-pdf") {
        files.forEach((file) => formData.append("files", file));
      } else if (files.length === 1) {
        formData.append("file", files[0]);
      } else {
        files.forEach((file) => formData.append("files", file));
      }

      setProgress(30);

      const response = await fetch(`${API_URL}/api/convert/${toolSlug}`, {
        method: "POST",
        body: formData,
      });

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Conversion failed");
      }

      const data = await response.json();
      setProgress(100);

      // Handle both single file and multiple files response
      if (data.file) {
        setConvertedFile(data.file);
        setConvertedFiles([data.file]);
      } else if (data.files) {
        setConvertedFiles(data.files);
        setConvertedFile(data.files[0]);
      }

      setStatus("success");
    } catch (err) {
      console.error("Conversion error:", err);
      setError(err instanceof Error ? err.message : "Conversion failed");
      setStatus("error");
      setProgress(0);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processFiles(acceptedFiles);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolSlug]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled: status === "processing",
  });

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (convertedFiles.length === 0) return;
    setDownloadError(null);

    for (const file of convertedFiles) {
      try {
        // Use server proxy with publicId for server-side authenticated URL generation
        const params = new URLSearchParams();
        if (file.publicId) {
          params.set('publicId', file.publicId);
        } else {
          params.set('url', file.url);
        }
        params.set('filename', file.originalName);
        const proxyUrl = `${API_URL}/api/convert/download?${params.toString()}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Download failed');
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Download error:', err);
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
      }
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setProgress(0);
    setConvertedFile(null);
    setConvertedFiles([]);
    setError(null);
    setOriginalFileName("");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Processing state
  if (status === "processing") {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Converting your file...</h3>
          <p className="text-sm text-muted-foreground mb-4">{originalFileName}</p>
          <Progress value={progress} className="max-w-xs mx-auto" />
        </div>
      </div>
    );
  }

  // Success state - show download button
  if (status === "success" && convertedFile) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-card border border-green-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Conversion Complete!</h3>
          <p className="text-sm text-muted-foreground mb-1">
            {convertedFile.originalName}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            {formatSize(convertedFile.size)}
            {convertedFiles.length > 1 && ` · ${convertedFiles.length} files`}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleDownload} size="lg" className="min-w-[200px]">
              <Download className="w-5 h-5 mr-2" />
              Download {convertedFiles.length > 1 ? `All (${convertedFiles.length})` : "File"}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              <RefreshCw className="w-4 h-4 mr-2" />
              Convert Another
            </Button>
          </div>
          {downloadError && (
            <p className="text-sm text-red-500 mt-4">{downloadError}</p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-card border border-red-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Conversion Failed</h3>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <Button onClick={handleReset} variant="outline" size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Idle state - show upload zone
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={clsx(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer",
          isDragActive
            ? "border-blue-500 bg-blue-500/5 scale-[1.02]"
            : "border-border hover:border-blue-500/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div
            className={clsx(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-blue-500/10" : "bg-muted"
            )}
          >
            <Upload
              className={clsx(
                "w-8 h-8",
                isDragActive ? "text-blue-500" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="text-lg font-semibold">{label}</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} file{maxFiles > 1 ? "s" : ""} · Up to {formatSize(maxSize)} each
          </p>
        </div>
      </div>
    </div>
  );
}
