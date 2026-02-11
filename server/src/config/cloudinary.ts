import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify configuration
const config = cloudinary.config();
if (!config.api_secret) {
  console.warn("WARNING: CLOUDINARY_API_SECRET is not set. Signed URLs will not work!");
} else {
  console.log("Cloudinary configured with cloud:", config.cloud_name);
}

export default cloudinary;
