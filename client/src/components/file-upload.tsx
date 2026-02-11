"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Check, Download } from "lucide-react";
import { clsx } from "clsx";
import { Button, Progress } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UploadedFile {
  filename: string;
  originalName: string;
  url: string;
  publicId?: string;
}

interface FileUploadProps {
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number; // bytes
  onFilesSelected: (files: File[]) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function FileUpload({
  accept = { "application/pdf": [".pdf"] },
  maxFiles = 20,
  maxSize = 100 * 1024 * 1024, // 100MB
  onFilesSelected,
  label = "Drop your files here",
  description = "or click to browse your device",
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
      setFiles(newFiles);
      onFilesSelected(newFiles);
    },
    [files, maxFiles, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
  });

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      
      if (files.length === 1) {
        formData.append("file", files[0]);
        
        const response = await fetch(`${API_URL}/api/upload/single`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        setUploadedFiles([data.file]);
        setProgress(100);
      } else {
        files.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(`${API_URL}/api/upload/multiple`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        setUploadedFiles(data.files);
        setProgress(100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (uploadedFiles.length === 0) return;

    for (const file of uploadedFiles) {
      try {
        // Use server proxy with the signed URL for reliable downloads
        const params = new URLSearchParams();
        params.set('url', file.url);
        params.set('filename', file.originalName);
        const proxyUrl = `${API_URL}/api/convert/download?${params.toString()}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Download failed');
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
        // Fallback: open in new tab
        window.open(file.url, '_blank');
      }
    }
  };

  const handleReset = () => {
    setFiles([]);
    setUploadedFiles([]);
    setProgress(0);
    setError(null);
    onFilesSelected([]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200",
          disabled
            ? "border-border bg-muted/50 cursor-not-allowed opacity-60"
            : isDragActive
              ? "border-blue-500 bg-blue-500/5 scale-[1.02] cursor-pointer"
              : "border-border hover:border-blue-500/50 hover:bg-muted/50 cursor-pointer"
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
            Max {maxFiles} files · Up to {formatSize(maxSize)} each
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
            >
              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(file.size)}
                </p>
              </div>
              {progress === 100 ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-center text-muted-foreground">
            Processing... {progress}%
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-sm text-red-500 text-center">{error}</p>
        </div>
      )}

      {/* Action */}
      {files.length > 0 && !uploading && progress < 100 && (
        <Button onClick={handleProcess} size="lg" className="w-full">
          Process {files.length} file{files.length > 1 ? "s" : ""}
        </Button>
      )}

      {progress === 100 && (
        <div className="flex gap-3">
          <Button onClick={handleDownload} size="lg" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Download Result
          </Button>
          <Button onClick={handleReset} variant="outline" size="lg">
            Process More
          </Button>
        </div>
      )}
    </div>
  );
}
