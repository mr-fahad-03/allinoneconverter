import cloudinary from "../config/cloudinary.js";
import { v4 as uuidv4 } from "uuid";
import streamifier from "streamifier";

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  downloadUrl: string;
  format: string;
  resourceType: string;
}

/**
 * Upload a file buffer to Cloudinary
 * @param buffer - File buffer to upload
 * @param folder - Cloudinary folder (default: 'allinone-pdf')
 * @param resourceType - Type of resource ('auto', 'image', 'raw')
 * @returns Upload result with publicId and URLs
 */
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string = "allinone-pdf",
  resourceType: "auto" | "image" | "raw" = "raw"
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: uuidv4(),
        format: resourceType === "raw" ? "pdf" : undefined,
        type: "upload",
        access_mode: "public",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else if (result) {
          console.log("Upload result:", {
            public_id: result.public_id,
            secure_url: result.secure_url,
            version: result.version,
            format: result.format
          });
          
          // Use private_download_url for raw files - this generates a proper authenticated URL
          const downloadUrl = cloudinary.utils.private_download_url(
            result.public_id,
            "", // No format extension needed - already in public_id
            {
              resource_type: "raw",
              type: "upload",
              expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
            }
          );
          
          console.log("Generated download URL:", downloadUrl);
          
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            downloadUrl: downloadUrl,
            format: result.format,
            resourceType: result.resource_type,
          });
        } else {
          reject(new Error("Upload failed"));
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Download a file from Cloudinary by public ID
 * @param publicId - Cloudinary public ID
 * @param resourceType - Type of resource ('auto', 'image', 'raw')
 * @returns File buffer
 */
export const downloadFromCloudinary = async (
  publicId: string, 
  resourceType: "auto" | "image" | "raw" = "raw"
): Promise<Buffer> => {
  const url = cloudinary.url(publicId, { 
    resource_type: resourceType,
    secure: true,
    sign_url: true,
  });
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download file from Cloudinary: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Delete a file from Cloudinary
 * @param publicId - Cloudinary public ID
 * @param resourceType - Type of resource ('image', 'raw', 'video')
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "raw" | "video" = "raw"
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error(`Failed to delete file from Cloudinary: ${publicId}`, error);
    // Don't throw error, just log it - cleanup failures shouldn't break the flow
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param publicIds - Array of Cloudinary public IDs
 * @param resourceType - Type of resource
 */
export const deleteMultipleFromCloudinary = async (
  publicIds: string[],
  resourceType: "image" | "raw" | "video" = "raw"
): Promise<void> => {
  try {
    await Promise.all(publicIds.map(id => deleteFromCloudinary(id, resourceType)));
  } catch (error) {
    console.error("Failed to delete multiple files from Cloudinary", error);
  }
};
