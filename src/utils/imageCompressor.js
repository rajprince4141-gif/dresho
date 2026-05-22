/**
 * Utility for client-side image compression.
 * Downscales images using HTML5 Canvas to prevent upload errors (e.g., Payload Too Large)
 * and optimize bandwidth usage.
 */

/**
 * Compresses an image file using Canvas scale-down and quality settings.
 * 
 * @param {File} file - The original file object.
 * @param {Object} [options] - Compression options.
 * @param {number} [options.maxWidth=1200] - Maximum width constraint.
 * @param {number} [options.maxHeight=1200] - Maximum height constraint.
 * @param {number} [options.quality=0.7] - JPEG quality compression ratio (0.0 to 1.0).
 * @param {string} [options.outputType="image/jpeg"] - The output MIME type.
 * @returns {Promise<File>} A promise resolving to the compressed File object.
 */
export function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.7,
    outputType = "image/jpeg"
  } = options;

  return new Promise((resolve, reject) => {
    // Only attempt compression for browser-supported images
    if (!file || !file.type.startsWith("image/")) {
      return resolve(file); // Return original if not an image
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Could not get 2D context from canvas"));
        }

        // Draw image onto canvas with new dimensions
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas back to a binary Blob / File
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const fileExtension = file.name.split(".").pop() || "jpg";
              const compressedFileName = file.name || `image.${fileExtension}`;
              
              const compressedFile = new File(
                [blob], 
                compressedFileName, 
                { 
                  type: outputType, 
                  lastModified: Date.now() 
                }
              );
              resolve(compressedFile);
            } else {
              reject(new Error("Canvas conversion to blob failed"));
            }
          }, 
          outputType, 
          quality
        );
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}
