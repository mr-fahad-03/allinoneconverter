import { Router, Request, Response } from "express";
import multer from "multer";
import { uploadToCloudinary, deleteFromCloudinary } from "../services/cloudinary.service";
import { AuthRequest, optionalAuth } from "../middleware/auth";

const router = Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10); // 100MB

// Configure multer to use memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// Upload single file
router.post("/single", optionalAuth, upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file provided" });
      return;
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, "allinone-pdf/uploads");

    res.status(201).json({
      message: "File uploaded successfully",
      file: {
        publicId: result.publicId,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: result.secureUrl,
        isAuthenticated: !!req.user,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Upload multiple files
router.post("/multiple", optionalAuth, upload.array("files", 10), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ message: "No files provided" });
      return;
    }

    // Upload all files to Cloudinary
    const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, "allinone-pdf/uploads"));
    const results = await Promise.all(uploadPromises);

    const uploadedFiles = files.map((file, index) => ({
      publicId: results[index].publicId,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: results[index].secureUrl,
    }));

    res.status(201).json({
      message: "Files uploaded successfully",
      files: uploadedFiles,
      isAuthenticated: !!req.user,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Upload failed" });
  }
});

// Delete file from Cloudinary
router.delete("/:publicId", optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    
    // Delete from Cloudinary
    await deleteFromCloudinary(publicId);
    
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "File deletion failed" });
  }
});

export default router;
