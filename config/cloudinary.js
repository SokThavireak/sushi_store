import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Local cache directory for fast local serving & fallback backup
// Safely try creating local cache directory if writable (serverless lambdas like Vercel have a read-only filesystem)
try {
  const CACHE_DIR = path.resolve('public', 'uploads', 'cache');
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  // Ignored in read-only serverless environments like Vercel (/var/task)
}

// In-memory quick lookup cache (original url / key -> compressed url)
const imageCache = new Map();

/**
 * Helper function to compress and optimize Cloudinary image URLs
 * @param {string} url - Original Cloudinary image URL
 * @param {object} options - Compression options
 * @returns {string} - Optimized URL with auto-compression & WebP format
 */
export function getCompressedImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;

  // Check in-memory cache first
  const cacheKey = `${url}_${options.width || 600}_${options.quality || 'auto'}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  // If it's a Cloudinary URL, inject on-the-fly transformation for small file size
  if (url.includes('res.cloudinary.com')) {
    const width = options.width || 600;
    const quality = options.quality || 'auto'; // automatically compress quality
    const format = options.format || 'auto';   // auto WebP/AVIF depending on browser

    const transform = `c_limit,w_${width},q_${quality},f_${format}`;
    const compressedUrl = url.replace('/upload/', `/upload/${transform}/`);
    
    imageCache.set(cacheKey, compressedUrl);
    return compressedUrl;
  }

  return url;
}

/**
 * Configure Cloudinary Multer Storage with built-in compression transformations
 * - Automatically resizes large uploads down to max 800px width/height
 * - Auto-compresses quality (q_auto) to produce tiny file size (~50KB-100KB)
 * - Converts to WebP/auto optimal modern format (f_auto)
 */
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sushi_store_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [
      {
        width: 800,
        height: 800,
        crop: 'limit',
        quality: 'auto:good', // Compresses to significantly smaller size without visual degradation
        fetch_format: 'auto'  // Serves modern webp/avif format
      }
    ]
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max upload limit
  }
});

export { cloudinary, imageCache };
export default upload;
