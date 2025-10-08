// Document conversion utilities
// This would typically be handled by the backend, but we'll create the frontend interface

export const SUPPORTED_FORMATS = {
  // Images
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg', 
  PNG: 'image/png',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  TIFF: 'image/tiff',
  
  // Documents
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  TXT: 'text/plain',
  RTF: 'application/rtf'
};

export const getFileType = (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  const mimeType = file.type;
  
  // Map extensions to types
  const extensionMap = {
    'jpg': 'image',
    'jpeg': 'image', 
    'png': 'image',
    'gif': 'image',
    'bmp': 'image',
    'tiff': 'image',
    'pdf': 'pdf',
    'doc': 'word',
    'docx': 'word',
    'xls': 'excel',
    'xlsx': 'excel',
    'ppt': 'powerpoint',
    'pptx': 'powerpoint',
    'txt': 'text',
    'rtf': 'text'
  };
  
  return extensionMap[extension] || 'unknown';
};

export const isSupportedFormat = (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  return Object.keys(SUPPORTED_FORMATS).some(format => 
    format.toLowerCase() === extension
  );
};

export const needsConversion = (file) => {
  const fileType = getFileType(file);
  return fileType !== 'pdf';
};

export const convertToPDF = async (file) => {
  // This would typically call a backend service
  // For now, we'll simulate the conversion process
  
  return new Promise((resolve, reject) => {
    const fileType = getFileType(file);
    
    if (fileType === 'pdf') {
      // Already a PDF, no conversion needed
      resolve(file);
      return;
    }
    
    if (fileType === 'image') {
      // Convert image to PDF using canvas
      convertImageToPDF(file)
        .then(resolve)
        .catch(reject);
    } else {
      // For other document types, we'd need a backend service
      // This is a placeholder for the actual conversion
      reject(new Error(`Conversion from ${fileType} to PDF not yet implemented`));
    }
  });
};

const convertImageToPDF = (imageFile) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image on canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Create a new file with PDF extension
          const pdfFile = new File([blob], 
            imageFile.name.replace(/\.[^/.]+$/, '.pdf'), 
            { type: 'application/pdf' }
          );
          resolve(pdfFile);
        } else {
          reject(new Error('Failed to convert image to PDF'));
        }
      }, 'application/pdf');
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageFile);
  });
};

export const validateFile = (file) => {
  const errors = [];
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push('File size must be less than 10MB');
  }
  
  // Check file format
  if (!isSupportedFormat(file)) {
    errors.push('Unsupported file format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
