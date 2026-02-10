import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { uploadToCloudinary, deleteFromCloudinary, deleteMultipleFromCloudinary } from "./cloudinary.service.js";

interface ProcessedFile {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}

interface ConversionResult {
  message: string;
  file?: {
    publicId: string;
    originalName: string;
    url: string;
    size: number;
  };
  files?: Array<{
    publicId: string;
    originalName: string;
    url: string;
    size: number;
  }>;
}

/**
 * Handle file conversion with Cloudinary integration
 * - Uploads result to Cloudinary
 * - For guest users: deletes files after conversion
 * - For authenticated users: keeps files in Cloudinary
 */
export const handleConversion = async (
  req: AuthRequest,
  res: Response,
  processedFile: ProcessedFile | ProcessedFile[],
  inputPublicIds: string[] = []
): Promise<void> => {
  try {
    const isAuthenticated = !!req.user;
    let result: ConversionResult;

    // Handle single file
    if (!Array.isArray(processedFile)) {
      // Determine resource type based on mimetype
      const resourceType = processedFile.mimetype?.startsWith("image/") ? "image" : "raw";
      
      const uploadResult = await uploadToCloudinary(
        processedFile.buffer,
        isAuthenticated ? "allinone-pdf/outputs" : "allinone-pdf/temp",
        resourceType
      );

      result = {
        message: "Conversion successful",
        file: {
          publicId: uploadResult.publicId,
          originalName: processedFile.filename,
          url: uploadResult.downloadUrl,
          size: processedFile.buffer.length,
        },
      };

      // For guest users, delete files after a delay (client needs time to download)
      if (!isAuthenticated) {
        setTimeout(async () => {
          await deleteFromCloudinary(uploadResult.publicId, resourceType === "image" ? "image" : "raw");
          if (inputPublicIds.length > 0) {
            await deleteMultipleFromCloudinary(inputPublicIds);
          }
        }, 5 * 60 * 1000); // 5 minutes delay
      }
    }
    // Handle multiple files
    else {
      const uploadPromises = processedFile.map(file => {
        const resourceType = file.mimetype?.startsWith("image/") ? "image" : "raw";
        return uploadToCloudinary(
          file.buffer,
          isAuthenticated ? "allinone-pdf/outputs" : "allinone-pdf/temp",
          resourceType
        );
      });
      const uploadResults = await Promise.all(uploadPromises);

      const files = processedFile.map((file, index) => ({
        publicId: uploadResults[index].publicId,
        originalName: file.filename,
        url: uploadResults[index].downloadUrl,
        size: file.buffer.length,
      }));

      result = {
        message: "Conversion successful",
        files,
      };

      // For guest users, delete files after a delay
      if (!isAuthenticated) {
        setTimeout(async () => {
          const outputPublicIds = uploadResults.map(r => r.publicId);
          await deleteMultipleFromCloudinary([...outputPublicIds, ...inputPublicIds]);
        }, 5 * 60 * 1000); // 5 minutes delay
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Conversion handling error:", error);
    res.status(500).json({ message: "Conversion failed" });
  }
};

/**
 * Extract public IDs from uploaded files
 */
export const extractPublicIds = (files: Express.Multer.File[]): string[] => {
  // If files have a publicId property (from our upload), extract it
  // Otherwise, return empty array (files are from direct upload)
  return [];
};
