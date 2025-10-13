/**
 * Unified Document Viewer Component
 * Used across Editor, Viewer, and Public Signing for consistent rendering
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, IconButton, Tooltip, Typography, CircularProgress, Divider } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  NavigateBefore as PreviousIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import {
  useDroppable,
} from '@dnd-kit/core';
import { 
  calculatePdfOffset, 
  fieldToScreenCoords, 
  findSignatureForField,
  isFieldSigned,
  logCoordinateDebugInfo,
  PDF_CONFIG
} from '../utils/pdfCoordinates';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Drop Zone Component for PDF pages
const PdfDropZone = ({ pageNumber, onFieldDrop, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `pdf-page-${pageNumber}`,
    data: {
      type: 'pdf-page',
      pageNumber: pageNumber,
    },
  });

  // Debug drop zone state
  React.useEffect(() => {
    if (isOver) {
      console.log('🎯 PDF Drop Zone is over:', { pageNumber, isOver });
    }
  }, [isOver, pageNumber]);

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        border: isOver ? '2px dashed #1976d2' : '2px dashed transparent',
        borderRadius: 1,
        transition: 'border-color 0.2s ease',
        minHeight: '100%',
      }}
    >
      {children}
    </Box>
  );
};

const UnifiedDocumentViewer = ({ 
  documentUrl,
  fields = [],
  signatures = [],
  documentId,
  scale = 1.0,
  onScaleChange,
  onPdfLoad,
  onPageChange,
  onPdfOffsetChange,
  pageNumber = 1,
  numPages = null,
  showControls = true,
  showFields = true,
  fieldRenderer,
  children,
  containerRef,
  className = '',
  sx = {},
  onFieldDrop,
  isDragActive = false
}) => {
  const [, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  const internalContainerRef = useRef(null);
  const pdfContainerRef = containerRef || internalContainerRef;

  // Calculate PDF offset using centralized system
  const updatePdfOffset = useCallback(() => {
    if (pdfContainerRef.current) {
      // Use the same approach as DocumentEditor - get actual PDF width from rendered page
      const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
      let actualPdfWidth = PDF_CONFIG.STANDARD_WIDTH;
      
      if (pdfPage) {
        const pageRect = pdfPage.getBoundingClientRect();
        actualPdfWidth = pageRect.width;
      } else {
        // Use standard width scaled by current scale
        actualPdfWidth = PDF_CONFIG.STANDARD_WIDTH * scale;
      }
      
      const offset = calculatePdfOffset(pdfContainerRef.current, actualPdfWidth, scale);
      setPdfOffset(offset);
      
      // Notify parent component of offset change
      onPdfOffsetChange?.(offset);
    }
  }, [pdfContainerRef, scale, onPdfOffsetChange]);

  // Handle document load success
  const handleDocumentLoadSuccess = useCallback((payload) => {
    // react-pdf v5 passes a PDFDocumentProxy (with numPages), v6 passes { numPages }
    // const pages = (payload && typeof payload === 'object' && 'numPages' in payload)
    //   ? payload.numPages
    //   : (payload?.numPages ?? null);
    
    setLoading(false);
    setError(null);
    
    // Recalculate PDF offset after document loads
    setTimeout(() => {
      updatePdfOffset();
    }, 500);
    
    onPdfLoad?.(payload);
  }, [onPdfLoad, updatePdfOffset]);

  // Handle document load error
  const handleDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  }, []);

  // Handle zoom in
  const handleZoomIn = useCallback(() => {
    onScaleChange?.(Math.min(scale + 0.25, 3.0));
  }, [scale, onScaleChange]);

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    onScaleChange?.(Math.max(scale - 0.25, 0.5));
  }, [scale, onScaleChange]);

  // Handle fit to screen
  const handleFitToScreen = useCallback(() => {
    if (pdfContainerRef.current) {
      const containerWidth = pdfContainerRef.current.offsetWidth;
      const targetWidth = containerWidth - 100; // Account for padding
      const newScale = targetWidth / PDF_CONFIG.STANDARD_WIDTH;
      onScaleChange?.(Math.max(0.5, Math.min(3.0, newScale)));
    }
  }, [onScaleChange, pdfContainerRef]);

  // Calculate PDF offset when component mounts, window resizes, or scale changes
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePdfOffset();
    }, 100);
    
    const handleResize = () => {
      updatePdfOffset();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [scale, numPages, updatePdfOffset]);

  // Comprehensive debug logging when fields or PDF offset changes
  useEffect(() => {
    if (fields.length > 0 && pdfOffset.x !== undefined) {
      const containerInfo = pdfContainerRef.current ? {
        width: pdfContainerRef.current.offsetWidth,
        height: pdfContainerRef.current.offsetHeight,
        rect: pdfContainerRef.current.getBoundingClientRect()
      } : {};
      
      logCoordinateDebugInfo({
        documentId,
        documentTitle: 'Current Document',
        fields,
        signatures,
        pdfOffset,
        scale,
        containerInfo,
        currentPage: pageNumber
      });
    }
  }, [fields, pdfOffset, scale, pageNumber, documentId, signatures, pdfContainerRef]);

  // Default field renderer
  const defaultFieldRenderer = useCallback((field) => {
    if (!field) return null;

    // Enhanced logging for field rendering
    console.log('🎯 Rendering Field:', {
      fieldId: field.id,
      fieldType: field.type,
      fieldData: {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page,
        label: field.label,
        value: field.value
      },
      timestamp: new Date().toISOString()
    });

    // Use centralized signature checking
    const isSigned = isFieldSigned(field, signatures, documentId);
    const signature = findSignatureForField(field, signatures, documentId);
    
    // Check if this field has a signature template (from document editing)
    const hasTemplate = field.type === 'signature' && field.value && field.value !== '';

    // Convert field coordinates to screen coordinates using proper PDF offset
    const screenCoords = fieldToScreenCoords(field, pdfOffset, scale);

    // Determine field styling based on status
    let borderColor, backgroundColor;
    if (isSigned) {
      borderColor = '#4caf50';
      backgroundColor = 'rgba(76, 175, 80, 0.1)';
    } else if (hasTemplate) {
      borderColor = '#ff9800';
      backgroundColor = 'rgba(255, 152, 0, 0.1)';
    } else {
      borderColor = '#ff9800';
      backgroundColor = 'rgba(255, 152, 0, 0.1)';
    }

    const fieldStyle = {
      position: 'absolute',
      left: `${screenCoords.x}px`,
      top: `${screenCoords.y}px`,
      width: `${screenCoords.width}px`,
      height: `${screenCoords.height}px`,
      border: isSigned ? `2px solid ${borderColor}` : `2px dashed ${borderColor}`,
      backgroundColor: backgroundColor,
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'default',
      zIndex: 10,
      transition: 'all 0.2s ease-in-out'
    };

    // Log final field positioning
    console.log('🎨 Final Field Style:', {
      fieldId: field.id,
      fieldType: field.type,
      screenCoords,
      fieldStyle: {
        left: fieldStyle.left,
        top: fieldStyle.top,
        width: fieldStyle.width,
        height: fieldStyle.height
      },
      isSigned,
      hasTemplate,
      timestamp: new Date().toISOString()
    });

    return (
      <Box
        key={`${field.id || field.x}-${field.y}`}
        style={fieldStyle}
      >
        {isSigned ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            p: 0.5
          }}>
            {/* Signed Status Badge */}
            <Box sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: '#4CAF50',
              color: 'white',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              ✓
            </Box>

            {/* Signature Content */}
            {(() => {
              if (signature?.signature_image) {
                return (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    maxWidth: '100%',
                    maxHeight: field.height > 40 ? '30px' : '20px'
                  }}>
                    <img 
                      src={`data:image/png;base64,${signature.signature_image}`}
                      alt="Signature" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                      }}
                    />
                  </Box>
                );
              } else if (signature?.digital_signature) {
                return (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#1B5E20', 
                      fontSize: field.height > 40 ? '11px' : '9px',
                      fontFamily: "'Dancing Script', cursive",
                      display: 'block',
                      fontWeight: 'bold',
                      lineHeight: 1.2,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {signature.digital_signature}
                  </Typography>
                );
              } else {
                return (
                  <Typography variant="caption" sx={{ 
                    color: '#1B5E20', 
                    fontSize: '9px',
                    fontWeight: 'bold'
                  }}>
                    ✓ Signed
                  </Typography>
                );
              }
            })()}
          </Box>
        ) : hasTemplate ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            p: 0.5
          }}>
            {/* Template Status Badge */}
            <Box sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              backgroundColor: '#ff9800',
              color: 'white',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              T
            </Box>

            <Typography variant="caption" sx={{ 
              color: '#E65100', 
              fontSize: field.height > 40 ? '11px' : '9px',
              fontFamily: "'Dancing Script', cursive",
              display: 'block',
              fontWeight: 'bold',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Template Set
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            p: 0.5
          }}>
            <Box sx={{ 
              color: '#666',
              fontSize: field.height > 40 ? '16px' : '12px',
              mb: 0.5
            }}>
              ✏️
            </Box>

            <Typography variant="caption" sx={{ 
              color: '#666', 
              fontSize: '8px',
              textAlign: 'center',
              lineHeight: 1,
              fontWeight: 'bold'
            }}>
              {field.label || field.name || 'Signature'}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }, [signatures, documentId, pdfOffset, scale]);

  // Get fields for current page
  const currentPageFields = fields.filter(field => (field.page || 1) === pageNumber);

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: 400,
          color: 'error.main'
        }}
      >
        {error}
      </Box>
    );
  }


  return (
    <Box 
        ref={pdfContainerRef}
        className={className}
        sx={{ 
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 2,
          ...sx
        }}
      >
      {/* PDF Controls */}
      {showControls && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Zoom Controls */}
          <Tooltip title="Zoom In">
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Zoom Out">
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Fit to Screen">
            <IconButton onClick={handleFitToScreen} size="small">
              <FitScreenIcon />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ ml: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
            {Math.round(scale * 100)}%
          </Box>

          {/* Page Navigation Controls */}
          {numPages && numPages > 1 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Tooltip title="Previous Page">
                <IconButton 
                  onClick={() => onPageChange?.(Math.max(1, pageNumber - 1))} 
                  disabled={pageNumber <= 1}
                  size="small"
                >
                  <PreviousIcon />
                </IconButton>
              </Tooltip>
              
              <Typography variant="body2" sx={{ mx: 1, minWidth: '80px', textAlign: 'center' }}>
                Page {pageNumber} of {numPages}
              </Typography>
              
              <Tooltip title="Next Page">
                <IconButton 
                  onClick={() => onPageChange?.(Math.min(numPages, pageNumber + 1))} 
                  disabled={pageNumber >= numPages}
                  size="small"
                >
                  <NextIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      )}

      {/* PDF Document */}
      <Box sx={{ position: 'relative' }}>
        <PdfDropZone pageNumber={pageNumber} onFieldDrop={onFieldDrop}>
          <Document
            file={documentUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: 400 
              }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading PDF...</Typography>
              </Box>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </PdfDropZone>

        {/* Field Overlays */}
        {showFields && currentPageFields.map(field => {
          if (fieldRenderer) {
            // For custom field renderers, we need to apply coordinate transformation
            const screenCoords = fieldToScreenCoords(field, pdfOffset, scale);
            return (
              <Box
                key={field.id}
                sx={{
                  position: 'absolute',
                  left: screenCoords.x,
                  top: screenCoords.y,
                  width: screenCoords.width,
                  height: screenCoords.height,
                  zIndex: 10
                }}
              >
                {fieldRenderer(field)}
              </Box>
            );
          } else {
            return defaultFieldRenderer(field);
          }
        })}

        {/* Custom Overlay Content */}
        {children}
      </Box>
    </Box>
  );
};

export default UnifiedDocumentViewer;
