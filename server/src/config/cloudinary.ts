import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

// Configure Cloudinary lazily to ensure env vars are loaded
const ensureConfigured = () => {
  if (isConfigured) return;
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  
  const config = cloudinary.config();
  if (!config.api_secret) {
    console.warn("WARNING: CLOUDINARY_API_SECRET is not set. Signed URLs will not work!");
  } else {
    console.log("Cloudinary configured with cloud:", config.cloud_name);
  }
  
  isConfigured = true;
};

// Create a proxy that ensures configuration before any method call
const cloudinaryProxy = new Proxy(cloudinary, {
  get(target, prop) {
    ensureConfigured();
    return target[prop as keyof typeof cloudinary];
  }
});

export default cloudinaryProxy;
