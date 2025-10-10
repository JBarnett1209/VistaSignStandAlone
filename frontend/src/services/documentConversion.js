/**
 * Document conversion service for VistaSign
 * Converts various document types to PDF for viewing and editing
 */

import api from './api';

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

      // Check if document needs conversion
      if (!this.needsConversion(document.mime_type, document.filename)) {
        // Document is already a PDF or doesn't need conversion
        return document;
      }

      // Call backend conversion service
      const response = await api.post(`/api/v1/documents/${documentId}/convert`, {
        mime_type: document.mime_type,
        title: document.title || document.filename
      });

      if (response.data && response.data.success) {
        const convertedDocument = {
          ...document,
          id: documentId,
          mime_type: 'application/pdf',
          filename: document.filename.replace(/\.[^/.]+$/, '.pdf'),
          file_url: response.data.converted_url || response.data.file_url,
          converted: true,
          original_type: document.mime_type,
          conversion_status: 'success'
        };

        // Cache the result
        this.conversionCache.set(cacheKey, convertedDocument);
        return convertedDocument;
      } else {
        throw new Error(response.data?.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('Document conversion failed:', error);
      
      // Return original document with error status
      const errorDocument = {
        ...document,
        id: documentId,
        converted: false,
        conversion_status: 'error',
        conversion_error: error.message
      };
      
      return errorDocument;
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