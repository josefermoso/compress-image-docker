/**
 * Image Compression API Server
 * Uses Sharp for real image processing with optimal configurations
 * Designed for fly.io deployment
 */

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const PORT = process.env.PORT || 8080;
const MAX_FILE_SIZE = '10mb'; // Max file size for uploads
const TARGET_SIZE = 100 * 1024; // 300KB target for compressed images

// Create Express app
const app = express();

// Middleware
app.use(morgan('dev')); // Logging
app.use(cors()); // Enable CORS for all routes
app.use(compression()); // Compress all responses
app.use(express.raw({ type: ['image/*'], limit: MAX_FILE_SIZE })); // Handle raw image uploads
app.use(express.json({ limit: MAX_FILE_SIZE }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'compress-image-api',
    version: '1.0.0',
    endpoints: [
      { method: 'GET', path: '/', description: 'Health check' },
      { method: 'POST', path: '/', description: 'Compress image (send raw binary)' },
      { method: 'POST', path: '/upload', description: 'Compress image (multipart form)' },
      { method: 'POST', path: '/upload-enhance', description: 'Enhance image for OCR/text recognition' },
      { method: 'GET', path: '/stats', description: 'Service statistics' }
    ],
    tech: {
      engine: `Node.js ${process.version}`,
      imageProcessor: `Sharp ${sharp.versions.sharp}`,
      libvips: sharp.versions.vips
    }
  });
});

// Service statistics
const stats = {
  requestsProcessed: 0,
  imagesCompressed: 0,
  bytesSaved: 0,
  averageCompressionRatio: 0,
  processingErrors: 0,
  startTime: new Date()
};

// Stats endpoint
app.get('/stats', (req, res) => {
  const uptime = Math.floor((new Date() - stats.startTime) / 1000);
  res.json({
    ...stats,
    uptime: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`
  });
});

/**
 * Main image compression endpoint - accepts raw binary image data
 */
app.post('/', async (req, res) => {
  stats.requestsProcessed++;
  
  try {
    // Check if we received image data
    if (!req.body || req.body.length === 0) {
      throw new Error('No image data received');
    }

    // Get input format from content-type or assume png
    let inputFormat = 'png';
    const contentType = req.get('content-type');
    if (contentType) {
      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        inputFormat = 'jpeg';
      } else if (contentType.includes('webp')) {
        inputFormat = 'webp';
      } else if (contentType.includes('gif')) {
        inputFormat = 'gif';
      } else if (contentType.includes('avif')) {
        inputFormat = 'avif';
      }
    }

    // Process the image and get compression result
    const inputBuffer = req.body;
    const result = await compressImage(inputBuffer, inputFormat);
    
    // Update stats
    stats.imagesCompressed++;
    stats.bytesSaved += (inputBuffer.length - result.compressedSize);
    stats.averageCompressionRatio = (stats.bytesSaved / stats.requestsProcessed) * 100 / stats.requestsProcessed;

    // Return compressed WebP image
    res.set({
      'Content-Type': 'image/webp',
      'Content-Length': result.webpBuffer.length,
      'X-Original-Size': result.originalSize,
      'X-Compressed-Size': result.compressedSize,
      'X-Compression-Ratio': result.compressionRatio.toFixed(3),
      'X-Processing-Time': `${result.processingTime}ms`,
      'X-Final-Quality': result.finalQuality,
      'X-Original-Format': inputFormat,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    
    return res.send(result.webpBuffer);

  } catch (error) {
    console.error('💥 Compression failed:', error);
    stats.processingErrors++;
    
    res.status(500).json({
      success: false,
      error: `Compression failed: ${error.message}`
    });
  }
});

/**
 * OCR Enhancement endpoint - optimizes images for text recognition
 * Applies grayscale, contrast enhancement, sharpening, and noise reduction
 */
app.post('/upload-enhance', async (req, res) => {
  stats.requestsProcessed++;
  
  try {
    // Check if we received image data
    if (!req.body || req.body.length === 0) {
      throw new Error('No image data received');
    }

    // Get input format from content-type or assume png
    let inputFormat = 'png';
    const contentType = req.get('content-type');
    if (contentType) {
      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        inputFormat = 'jpeg';
      } else if (contentType.includes('webp')) {
        inputFormat = 'webp';
      } else if (contentType.includes('gif')) {
        inputFormat = 'gif';
      } else if (contentType.includes('avif')) {
        inputFormat = 'avif';
      }
    }

    // Process the image for OCR enhancement
    const inputBuffer = req.body;
    const result = await enhanceImageForOCR(inputBuffer, inputFormat);
    
    // Update stats
    stats.imagesCompressed++;
    stats.bytesSaved += (inputBuffer.length - result.enhancedSize);
    stats.averageCompressionRatio = (stats.bytesSaved / stats.requestsProcessed) * 100 / stats.requestsProcessed;

    // Return enhanced image
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.enhancedBuffer.length,
      'X-Original-Size': result.originalSize,
      'X-Enhanced-Size': result.enhancedSize,
      'X-Processing-Time': `${result.processingTime}ms`,
      'X-Enhancement-Applied': result.enhancementsApplied.join(', '),
      'X-Original-Format': inputFormat,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    
    return res.send(result.enhancedBuffer);

  } catch (error) {
    console.error('💥 OCR Enhancement failed:', error);
    stats.processingErrors++;
    
    res.status(500).json({
      success: false,
      error: `OCR Enhancement failed: ${error.message}`
    });
  }
});

/**
 * Compress image using Sharp with iterative quality adjustment
 * Target: ≤300KB WebP grayscale output
 */
async function compressImage(inputBuffer, inputFormat = 'png') {
  const startTime = Date.now();
  const qualities = [80, 60, 40, 20, 10]; // Quality levels to try
  
  let result;
  let finalQuality = 80;
  let metadata;

  try {
    // Get image metadata
    metadata = await sharp(inputBuffer).metadata();
    console.log(`📊 Image info: ${metadata.width}x${metadata.height}, format: ${metadata.format || inputFormat}`);

    // Try different quality levels until we reach target size
    for (const quality of qualities) {
      console.log(`🔄 Trying quality: ${quality}%`);
      
      const output = await sharp(inputBuffer)
        .grayscale()                    // Convert to grayscale
        .webp({ 
          quality: quality,             // Set quality
          effort: 6,                    // Maximum compression effort
          lossless: false,              // Use lossy compression for smaller files
          nearLossless: false,          // Disable near-lossless
          smartSubsample: true,         // Enable smart subsampling
          reductionEffort: 6            // Maximum reduction effort
        })
        .toBuffer();

      result = output;
      finalQuality = quality;
      
      console.log(`📦 Quality ${quality}%: ${output.length} bytes`);
      
      // If we reached target size, stop here
      if (output.length <= TARGET_SIZE) {
        console.log(`✅ Target size achieved at quality ${quality}%`);
        break;
      }
    }

    // If still too large, try additional compression with resize
    if (result.length > TARGET_SIZE) {
      console.log('🔄 Still too large, trying with resize...');
      
      const resizeFactors = [0.9, 0.8, 0.7, 0.6, 0.5];
      
      for (const factor of resizeFactors) {
        const newWidth = Math.floor(metadata.width * factor);
        const newHeight = Math.floor(metadata.height * factor);
        
        const output = await sharp(inputBuffer)
          .resize(newWidth, newHeight, {
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: true
          })
          .grayscale()
          .webp({ 
            quality: 20,
            effort: 6,
            lossless: false,
            smartSubsample: true,
            reductionEffort: 6
          })
          .toBuffer();

        result = output;
        finalQuality = `20% + resize ${Math.floor(factor * 100)}%`;
        
        console.log(`📦 Resize ${Math.floor(factor * 100)}%: ${output.length} bytes`);
        
        if (output.length <= TARGET_SIZE) {
          console.log(`✅ Target size achieved with resize ${Math.floor(factor * 100)}%`);
          break;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    const compressionRatio = ((inputBuffer.length - result.length) / inputBuffer.length) * 100;

    return {
      webpBuffer: result,
      originalSize: inputBuffer.length,
      compressedSize: result.length,
      compressionRatio,
      processingTime,
      finalQuality
    };

  } catch (error) {
    console.error('🚨 Sharp processing error:', error);
    throw new Error(`Sharp processing failed: ${error.message}`);
  }
}

/**
 * Enhance image for OCR/text recognition
 * Applies multiple enhancement techniques optimized for text readability
 * Now respects TARGET_SIZE limit while maintaining OCR quality
 */
async function enhanceImageForOCR(inputBuffer, inputFormat = 'png') {
  const startTime = Date.now();
  const enhancementsApplied = [];

  try {
    // Get image metadata
    const metadata = await sharp(inputBuffer).metadata();
    console.log(`📊 OCR Enhancement - Image info: ${metadata.width}x${metadata.height}, format: ${metadata.format || inputFormat}`);

    let pipeline = sharp(inputBuffer);
    
    // Step 1: Convert to grayscale for better text contrast
    pipeline = pipeline.grayscale();
    enhancementsApplied.push('grayscale');
    
    // Step 2: Normalize and enhance contrast using histogram equalization
    pipeline = pipeline.normalize({
      lower: 1,  // Lower percentile for normalization
      upper: 99  // Upper percentile for normalization
    });
    enhancementsApplied.push('contrast-normalization');
    
    // Step 3: Apply gamma correction to improve mid-tone contrast
    pipeline = pipeline.gamma(1.2); // Slightly brighten mid-tones
    enhancementsApplied.push('gamma-correction');
    
    // Step 4: Sharpen the image to enhance text edges
    pipeline = pipeline.sharpen({
      sigma: 1.0,      // Sharpening strength
      flat: 1.0,       // Flat area threshold
      jagged: 2.0      // Jagged area threshold
    });
    enhancementsApplied.push('sharpening');
    
    // Step 5: Apply slight blur to reduce noise while preserving text
    pipeline = pipeline.blur(0.3); // Very light blur to reduce noise
    enhancementsApplied.push('noise-reduction');
    
    // Step 6: Apply adaptive threshold for better text separation (optional)
    // This creates a high-contrast black and white image ideal for OCR
    pipeline = pipeline.threshold(128, {
      greyscale: false,
      grayscale: false
    });
    enhancementsApplied.push('adaptive-threshold');
    
    // Step 7: Try different compression levels to reach TARGET_SIZE
    const compressionLevels = [9, 6, 3, 1, 0]; // PNG compression levels
    let result;
    let finalCompressionLevel = 6;
    
    for (const level of compressionLevels) {
      console.log(`🔄 Trying PNG compression level: ${level}`);
      
      const output = await pipeline
        .png({
          compressionLevel: level,
          adaptiveFiltering: true,
          palette: false        // Keep as grayscale, not palette
        })
        .toBuffer();
      
      result = output;
      finalCompressionLevel = level;
      
      console.log(`📦 Compression level ${level}: ${output.length} bytes`);
      
      if (output.length <= TARGET_SIZE) {
        console.log(`✅ Target size achieved with compression level ${level}`);
        break;
      }
    }
    
    // Step 8: If still too large, try resizing while maintaining OCR quality
    if (result.length > TARGET_SIZE) {
      console.log('🔄 Still too large, trying with resize for OCR...');
      
      const resizeFactors = [0.9, 0.8, 0.7, 0.6, 0.5];
      
      for (const factor of resizeFactors) {
        const newWidth = Math.floor(metadata.width * factor);
        const newHeight = Math.floor(metadata.height * factor);
        
        const output = await sharp(inputBuffer)
          .resize(newWidth, newHeight, {
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: true
          })
          .grayscale()
          .normalize({ lower: 1, upper: 99 })
          .gamma(1.2)
          .sharpen({ sigma: 1.0, flat: 1.0, jagged: 2.0 })
          .blur(0.3)
          .threshold(128, { greyscale: false, grayscale: false })
          .png({
            compressionLevel: 9,
            adaptiveFiltering: true,
            palette: false
          })
          .toBuffer();
        
        result = output;
        finalCompressionLevel = `9 + resize ${Math.floor(factor * 100)}%`;
        
        console.log(`📦 OCR Resize ${Math.floor(factor * 100)}%: ${output.length} bytes`);
        
        if (output.length <= TARGET_SIZE) {
          console.log(`✅ Target size achieved with OCR resize ${Math.floor(factor * 100)}%`);
          enhancementsApplied.push(`resize-${Math.floor(factor * 100)}%`);
          break;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ OCR Enhancement completed in ${processingTime}ms`);
    console.log(`📈 Enhancements applied: ${enhancementsApplied.join(', ')}`);
    console.log(`📦 Original: ${inputBuffer.length} bytes → Enhanced: ${result.length} bytes`);

    return {
      enhancedBuffer: result,
      originalSize: inputBuffer.length,
      enhancedSize: result.length,
      processingTime,
      enhancementsApplied: [...enhancementsApplied, `compression-${finalCompressionLevel}`]
    };

  } catch (error) {
    console.error('🚨 OCR Enhancement error:', error);
    throw new Error(`OCR Enhancement failed: ${error.message}`);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Image compression server running on http://localhost:${PORT}`);
  console.log(`📦 Using Sharp ${sharp.versions.sharp} with libvips ${sharp.versions.vips}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
