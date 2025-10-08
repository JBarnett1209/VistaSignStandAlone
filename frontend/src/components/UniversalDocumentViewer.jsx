import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as ExcelIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const UniversalDocumentViewer = ({ 
  document, 
  onLoadError, 
  onLoadSuccess,
  zoom = 1.0,
  onZoomChange 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!document) {
      setLoading(false);
      setError('No document provided');
      return;
    }

    setLoading(true);
    setError(null);
    setNumPages(null);
    setCurrentPage(1);
  }, [document]);

  const getDocumentType = (mimeType, filename) => {
    if (!mimeType && !filename) return 'unknown';
    
    const type = mimeType?.toLowerCase() || '';
    const name = filename?.toLowerCase() || '';
    
    if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (type.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) return 'word';
    if (type.includes('excel') || type.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
    if (type.includes('image') || /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(name)) return 'image';
    if (type.includes('powerpoint') || name.endsWith('.pptx') || name.endsWith('.ppt')) return 'powerpoint';
    if (type.includes('text') || name.endsWith('.txt')) return 'text';
    if (type.includes('csv') || name.endsWith('.csv')) return 'csv';
    
    return 'unknown';
  };

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'pdf': return <PdfIcon />;
      case 'word': return <DocIcon />;
      case 'excel': return <ExcelIcon />;
      case 'image': return <ImageIcon />;
      default: return <DocIcon />;
    }
  };

  const getDocumentTypeName = (type) => {
    switch (type) {
      case 'pdf': return 'PDF Document';
      case 'word': return 'Word Document';
      case 'excel': return 'Excel Spreadsheet';
      case 'image': return 'Image';
      case 'powerpoint': return 'PowerPoint Presentation';
      case 'text': return 'Text Document';
      case 'csv': return 'CSV File';
      default: return 'Document';
    }
  };

  const handleDownload = () => {
    if (document?.file_url) {
      const link = document.createElement('a');
      link.href = document.file_url;
      link.download = document.filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderPDFViewer = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Document
        file={document?.file_url || document?.file_path || document?.url}
        onLoadSuccess={(pdf) => {
          setNumPages(pdf.numPages);
          setLoading(false);
          onLoadSuccess?.(pdf);
        }}
        onLoadError={(error) => {
          setError(`Failed to load PDF: ${error.message}`);
          setLoading(false);
          onLoadError?.(error);
        }}
        loading={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
            <CircularProgress />
            <Typography>Loading PDF document...</Typography>
          </Box>
        }
      >
        {numPages && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Typography variant="body2">
                Page {currentPage} of {numPages}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage >= numPages}
              >
                Next
              </Button>
            </Box>
            <Page
              pageNumber={currentPage}
              scale={zoom}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </>
        )}
      </Document>
    </Box>
  );

  const renderImageViewer = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <img
        src={document?.file_url || document?.file_path || document?.url}
        alt={document?.title || 'Document'}
        style={{
          maxWidth: '100%',
          maxHeight: '80vh',
          objectFit: 'contain',
          transform: `scale(${zoom})`,
          transition: 'transform 0.2s ease-in-out'
        }}
        onLoad={() => {
          setLoading(false);
          onLoadSuccess?.();
        }}
        onError={(e) => {
          setError('Failed to load image');
          setLoading(false);
          onLoadError?.(e);
        }}
      />
    </Box>
  );

  const renderUnsupportedViewer = (type) => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: 400,
      gap: 2,
      p: 4
    }}>
      <Box sx={{ fontSize: 64, color: 'text.secondary' }}>
        {getDocumentIcon(type)}
      </Box>
      <Typography variant="h6" color="text.secondary">
        {getDocumentTypeName(type)}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        This document type is not directly viewable in the editor.
        <br />
        You can still add signature fields and send it for signing.
      </Typography>
      <Button
        variant="contained"
        startIcon={<DownloadIcon />}
        onClick={handleDownload}
        sx={{ mt: 2 }}
      >
        Download Document
      </Button>
    </Box>
  );

  const renderDocument = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
          <CircularProgress />
          <Typography>Loading document...</Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          <Typography variant="h6">Failed to load document</Typography>
          <Typography variant="body2">{error}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            File URL: {document?.file_url || document?.file_path || document?.url || 'No URL found'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            sx={{ mt: 2 }}
          >
            Download Document
          </Button>
        </Alert>
      );
    }

    const docType = getDocumentType(document?.mime_type, document?.filename);

    switch (docType) {
      case 'pdf':
        return renderPDFViewer();
      case 'image':
        return renderImageViewer();
      case 'word':
      case 'excel':
      case 'powerpoint':
      case 'text':
      case 'csv':
      default:
        return renderUnsupportedViewer(docType);
    }
  };

  return (
    <Paper sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      {renderDocument()}
    </Paper>
  );
};

export default UniversalDocumentViewer;
