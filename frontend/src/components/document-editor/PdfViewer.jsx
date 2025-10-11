/**
 * Professional PDF Viewer Component
 * Handles PDF rendering and basic interactions
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon
} from '@mui/icons-material';
import { PDF_CONFIG } from '../../utils/pdfCoordinates';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfViewer = ({ 
  documentUrl, 
  scale, 
  onScaleChange, 
  onPdfLoad, 
  onPageChange,
  children 
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  const handleDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    onPdfLoad?.({ numPages });
  }, [onPdfLoad]);

  const handleDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    onScaleChange?.(Math.min(scale + 0.25, 3.0));
  }, [scale, onScaleChange]);

  const handleZoomOut = useCallback(() => {
    onScaleChange?.(Math.max(scale - 0.25, 0.5));
  }, [scale, onScaleChange]);

  const handleFitToScreen = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const targetWidth = containerWidth - 100; // Account for padding
      const newScale = targetWidth / PDF_CONFIG.STANDARD_WIDTH;
      onScaleChange?.(Math.max(0.5, Math.min(3.0, newScale)));
    }
  }, [onScaleChange]);

  const handlePageChange = useCallback((newPageNumber) => {
    setPageNumber(newPageNumber);
    onPageChange?.(newPageNumber);
  }, [onPageChange]);

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
      ref={containerRef}
      sx={{ 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        p: 2
      }}
    >
      {/* PDF Controls */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
      </Box>

      {/* PDF Document */}
      <Box sx={{ position: 'relative' }}>
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
              Loading PDF...
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

        {/* Overlay for fields and interactions */}
        {children}
      </Box>

      {/* Page Navigation */}
      {numPages > 1 && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton 
            onClick={() => handlePageChange(pageNumber - 1)}
            disabled={pageNumber <= 1}
            size="small"
          >
            ←
          </IconButton>
          
          <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            Page {pageNumber} of {numPages}
          </Box>
          
          <IconButton 
            onClick={() => handlePageChange(pageNumber + 1)}
            disabled={pageNumber >= numPages}
            size="small"
          >
            →
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default PdfViewer;
