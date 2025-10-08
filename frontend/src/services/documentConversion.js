/**
 * Document conversion service for VistaSign
 * Converts various document types to PDF for viewing and editing
 */

import { documentsAPI } from './api';

class DocumentConversionService {
  constructor() {
    this.conversionCache = new Map();
  }

  /**
   * Check if a document needs conversion to PDF
   */
  needsConversion(mimeType, filename) {
    const type = mimeType?.toLowerCase() || '';
    const name = filename?.toLowerCase() || '';
    
    const conversionNeeded = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain',
      'text/csv'
    ];
    
    return conversionNeeded.some(neededType => 
      type.includes(neededType) || 
      this.getFileExtension(name) === neededType
    );
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Convert document to PDF for viewing
   */
  async convertToPDF(documentId, document) {
    try {
      // Check cache first
      const cacheKey = `${documentId}_${document.file_hash || document.updated_at}`;
      if (this.conversionCache.has(cacheKey)) {
        return this.conversionCache.get(cacheKey);
      }

      console.log(`Converting document ${documentId} to PDF for viewing...`);

      // For now, we'll create a placeholder PDF conversion
      // In a real implementation, this would call a backend service
      const convertedDocument = {
        ...document,
        id: documentId,
        mime_type: 'application/pdf',
        filename: document.filename.replace(/\.[^/.]+$/, '.pdf'),
        file_url: document.file_url, // In real implementation, this would be the converted PDF URL
        converted: true,
        original_type: document.mime_type
      };

      // Cache the result
      this.conversionCache.set(cacheKey, convertedDocument);

      return convertedDocument;
    } catch (error) {
      console.error('Document conversion failed:', error);
      throw new Error(`Failed to convert document: ${error.message}`);
    }
  }

  /**
   * Get document for viewing (converted to PDF if needed)
   */
  async getDocumentForViewing(document) {
    if (!document) {
      throw new Error('No document provided');
    }

    const needsConversion = this.needsConversion(document.mime_type, document.filename);
    
    if (needsConversion) {
      return await this.convertToPDF(document.id, document);
    }

    return document;
  }

  /**
   * Clear conversion cache
   */
  clearCache() {
    this.conversionCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.conversionCache.size;
  }
}

// Create singleton instance
const documentConversionService = new DocumentConversionService();

export default documentConversionService;