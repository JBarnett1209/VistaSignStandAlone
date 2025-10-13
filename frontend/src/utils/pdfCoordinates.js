/**
 * Centralized PDF coordinate system for VistaSign
 * Ensures consistent field positioning across all components
 */

// Standard PDF dimensions and scaling
export const PDF_CONFIG = {
  STANDARD_WIDTH: 800, // Standard PDF viewer width
  STANDARD_HEIGHT: 1056, // Standard PDF height (8.5" x 11" at 96 DPI)
  MIN_SCALE: 0.5,
  MAX_SCALE: 3.0,
  DEFAULT_SCALE: 1.0
};

/**
 * Calculate PDF offset for consistent positioning
 * @param {HTMLElement} container - PDF container element
 * @param {number} pdfWidth - Actual PDF width
 * @param {number} scale - Current scale factor
 * @returns {Object} - {x, y} offset coordinates
 */
export const calculatePdfOffset = (container, pdfWidth = PDF_CONFIG.STANDARD_WIDTH, scale = 1.0) => {
  if (!container) return { x: 0, y: 0 };
  
  const containerRect = container.getBoundingClientRect();
  const scaledPdfWidth = pdfWidth * scale;
  const offsetX = (containerRect.width - scaledPdfWidth) / 2;
  
  const result = { 
    x: Math.max(0, offsetX), 
    y: 0 
  };
  
  // Enhanced debug logging for coordinate system
  console.log('🔍 PDF Offset Calculation:', {
    containerWidth: containerRect.width,
    pdfWidth,
    scaledPdfWidth,
    offsetX,
    scale,
    finalOffset: result,
    timestamp: new Date().toISOString()
  });
  
  return result;
};

/**
 * Convert document coordinates to screen coordinates
 * @param {Object} field - Field with x, y coordinates
 * @param {Object} pdfOffset - PDF offset from calculatePdfOffset
 * @param {number} scale - Current scale factor
 * @returns {Object} - Screen coordinates {x, y}
 */
export const fieldToScreenCoords = (field, pdfOffset, scale = 1.0) => {
  const screenCoords = {
    x: (field.x * scale) + pdfOffset.x,
    y: (field.y * scale) + pdfOffset.y,
    width: field.width * scale,
    height: field.height * scale
  };
  
  // Enhanced debug logging for coordinate transformation
  console.log('📍 Field to Screen Coords:', {
    fieldId: field.id,
    fieldType: field.type,
    fieldCoords: { x: field.x, y: field.y, width: field.width, height: field.height },
    pdfOffset,
    scale,
    screenCoords,
    calculation: {
      x: `(${field.x} * ${scale}) + ${pdfOffset.x} = ${screenCoords.x}`,
      y: `(${field.y} * ${scale}) + ${pdfOffset.y} = ${screenCoords.y}`,
      width: `${field.width} * ${scale} = ${screenCoords.width}`,
      height: `${field.height} * ${scale} = ${screenCoords.height}`
    },
    timestamp: new Date().toISOString()
  });
  
  return screenCoords;
};

/**
 * Convert screen coordinates to document coordinates
 * @param {Object} screenCoords - Screen coordinates {x, y}
 * @param {Object} pdfOffset - PDF offset from calculatePdfOffset
 * @param {number} scale - Current scale factor
 * @returns {Object} - Document coordinates {x, y}
 */
export const screenToFieldCoords = (screenCoords, pdfOffset, scale = 1.0) => {
  return {
    x: (screenCoords.x - pdfOffset.x) / scale,
    y: (screenCoords.y - pdfOffset.y) / scale,
    width: screenCoords.width / scale,
    height: screenCoords.height / scale
  };
};

/**
 * Generate unique field ID
 * @returns {string} - Unique field ID
 */
export const generateFieldId = () => {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate field coordinates
 * @param {Object} field - Field to validate
 * @returns {boolean} - Whether field coordinates are valid
 */
export const validateFieldCoords = (field) => {
  return (
    field &&
    typeof field.x === 'number' &&
    typeof field.y === 'number' &&
    typeof field.width === 'number' &&
    typeof field.height === 'number' &&
    field.x >= 0 &&
    field.y >= 0 &&
    field.width > 0 &&
    field.height > 0
  );
};

/**
 * Normalize field data for consistent storage
 * @param {Object} field - Field to normalize
 * @returns {Object} - Normalized field
 */
export const normalizeField = (field) => {
  return {
    id: field.id || generateFieldId(),
    type: field.type,
    x: Math.round(field.x * 100) / 100, // Round to 2 decimal places
    y: Math.round(field.y * 100) / 100,
    width: Math.round(field.width * 100) / 100,
    height: Math.round(field.height * 100) / 100,
    page: field.page || 1,
    label: field.label || '',
    required: field.required || false,
    signingOrder: field.signingOrder || 1,
    value: field.value || '',
    completed: field.completed || false,
    ...field // Include any additional properties
  };
};

/**
 * Compare fields for equality (for signature matching)
 * @param {Object} field1 - First field
 * @param {Object} field2 - Second field
 * @returns {boolean} - Whether fields are equivalent
 */
export const fieldsEqual = (field1, field2) => {
  if (!field1 || !field2) return false;
  
  // Compare essential properties
  const props1 = {
    type: field1.type,
    x: Math.round(field1.x * 100) / 100,
    y: Math.round(field1.y * 100) / 100,
    width: Math.round(field1.width * 100) / 100,
    height: Math.round(field1.height * 100) / 100,
    page: field1.page || 1
  };
  
  const props2 = {
    type: field2.type,
    x: Math.round(field2.x * 100) / 100,
    y: Math.round(field2.y * 100) / 100,
    width: Math.round(field2.width * 100) / 100,
    height: Math.round(field2.height * 100) / 100,
    page: field2.page || 1
  };
  
  return JSON.stringify(props1) === JSON.stringify(props2);
};

/**
 * Find signature for a field
 * @param {Object} field - Field to find signature for
 * @param {Array} signatures - Array of signatures
 * @param {string} documentId - Document ID
 * @returns {Object|null} - Matching signature or null
 */
export const findSignatureForField = (field, signatures, documentId) => {
  if (!field || !signatures || !documentId) return null;
  
  // First try to match by field ID (most reliable)
  if (field.id) {
    const signatureById = signatures.find(sig => 
      sig.document_id === documentId && 
      sig.field_id === field.id
    );
    if (signatureById) return signatureById;
  }
  
  // Fallback to position matching
  return signatures.find(sig => 
    sig.document_id === documentId && 
    sig.signature_position && 
    fieldsEqual(sig.signature_position, field)
  );
};

/**
 * Check if field is signed
 * @param {Object} field - Field to check
 * @param {Array} signatures - Array of signatures
 * @param {string} documentId - Document ID
 * @returns {boolean} - Whether field is signed
 */
export const isFieldSigned = (field, signatures, documentId) => {
  const signature = findSignatureForField(field, signatures, documentId);
  
  // Only consider a field signed if:
  // 1. A signature exists for this field
  // 2. The signature has been completed (has signed_at timestamp)
  // 3. The signature is not just a template (has actual signature data)
  return signature && 
         signature.signed_at && 
         (signature.signature_image || signature.digital_signature || signature.signature_data);
};

/**
 * Comprehensive logging function for debugging coordinate issues
 * @param {Object} context - Context object with all relevant data
 */
export const logCoordinateDebugInfo = (context) => {
  const {
    documentId,
    documentTitle,
    fields = [],
    signatures = [],
    pdfOffset = { x: 0, y: 0 },
    scale = 1.0,
    containerInfo = {},
    currentPage = 1
  } = context;

  console.group('🔍 COORDINATE DEBUG INFO');
  console.log('📄 Document Info:', {
    documentId,
    documentTitle,
    currentPage,
    timestamp: new Date().toISOString()
  });

  console.log('📐 PDF Configuration:', {
    pdfOffset,
    scale,
    containerInfo,
    PDF_CONFIG
  });

  console.log('📋 Fields Summary:', {
    totalFields: fields.length,
    fieldsOnCurrentPage: fields.filter(f => f.page === currentPage).length,
    signatureFields: fields.filter(f => f.type === 'signature').length
  });

  console.log('📝 All Fields Details:');
  fields.forEach((field, index) => {
    const screenCoords = fieldToScreenCoords(field, pdfOffset, scale);
    const isSigned = isFieldSigned(field, signatures, documentId);
    const signature = findSignatureForField(field, signatures, documentId);
    
    console.log(`  Field ${index + 1}:`, {
      id: field.id,
      type: field.type,
      page: field.page,
      label: field.label,
      originalCoords: { x: field.x, y: field.y, width: field.width, height: field.height },
      screenCoords,
      isSigned,
      hasSignature: !!signature,
      signatureId: signature?.id
    });
  });

  console.log('✍️ Signatures Summary:', {
    totalSignatures: signatures.length,
    signaturesForDocument: signatures.filter(s => s.document_id === documentId).length,
    completedSignatures: signatures.filter(s => s.signed_at).length
  });

  console.log('🔍 Signature Details:');
  signatures.filter(s => s.document_id === documentId).forEach((signature, index) => {
    console.log(`  Signature ${index + 1}:`, {
      id: signature.id,
      fieldId: signature.field_id,
      signedAt: signature.signed_at,
      hasImage: !!signature.signature_image,
      hasDigital: !!signature.digital_signature,
      hasData: !!signature.signature_data,
      position: signature.signature_position
    });
  });

  console.groupEnd();
};
