/**
 * Professional PDF Viewer Component
 * Now uses UnifiedDocumentViewer for consistent rendering
 */

import React, { useState, useCallback } from 'react';
import UnifiedDocumentViewer from '../UnifiedDocumentViewer';

const PdfViewer = ({ 
  documentUrl, 
  scale, 
  onScaleChange, 
  onPdfLoad, 
  onPageChange,
  onPdfOffsetChange,
  children 
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const handlePdfLoad = useCallback((payload) => {
    const pages = (payload && typeof payload === 'object' && 'numPages' in payload)
      ? payload.numPages
      : (payload?.numPages ?? null);
    
    setNumPages(pages);
    onPdfLoad?.({ numPages: pages });
  }, [onPdfLoad]);

  const handlePageChange = useCallback((newPageNumber) => {
    setPageNumber(newPageNumber);
    onPageChange?.(newPageNumber);
  }, [onPageChange]);

  return (
    <UnifiedDocumentViewer
      documentUrl={documentUrl}
      scale={scale}
      onScaleChange={onScaleChange}
      onPdfLoad={handlePdfLoad}
      onPageChange={handlePageChange}
      onPdfOffsetChange={onPdfOffsetChange}
      pageNumber={pageNumber}
      numPages={numPages}
      showControls={true}
      showFields={false}
    >
      {/* Overlay for fields and interactions */}
      {children}
    </UnifiedDocumentViewer>
  );
};

export default PdfViewer;
