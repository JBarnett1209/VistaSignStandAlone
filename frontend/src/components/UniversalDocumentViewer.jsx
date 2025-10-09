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

    console.log('UniversalDocumentViewer - Document data:', document);
    console.log('UniversalDocumentViewer - MIME type:', document?.mime_type);
    console.log('UniversalDocumentViewer - Filename:', document?.filename);
    console.log('UniversalDocumentViewer - File URL:', document?.file_url);

    setLoading(true);
    setError(null);
    setNumPages(null);
    setCurrentPage(1);
    
    // For non-PDF documents, we don't need to wait for loading
    const docType = getDocumentType(document?.mime_type, document?.filename);
    console.log('UniversalDocumentViewer - Detected document type:', docType);
    if (docType !== 'pdf') {
      setLoading(false);
    } else {
      // Test if the PDF file URL is accessible
      const fileUrl = document?.file_url || document?.file_path || document?.url;
      if (fileUrl) {
        console.log('UniversalDocumentViewer - Testing PDF file accessibility...');
        fetch(fileUrl, { method: 'GET' })
          .then(response => {
            console.log('UniversalDocumentViewer - PDF file accessibility test:', response.status, response.statusText);
            if (!response.ok) {
              console.error('UniversalDocumentViewer - PDF file not accessible:', response.status, response.statusText);
            }
          })
          .catch(error => {
            console.error('UniversalDocumentViewer - PDF file accessibility test failed:', error);
          });
      }
    }
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

  const renderPDFViewer = () => {
    console.log('UniversalDocumentViewer - renderPDFViewer called');
    return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 2,
      width: '100%',
      flex: 1
    }}>
      <Document
        file={(() => {
          const fileUrl = document?.file_url || document?.file_path || document?.url;
          console.log('UniversalDocumentViewer - PDF file URL being passed to react-pdf:', fileUrl);
          return fileUrl;
        })()}
        onLoadSuccess={(pdf) => {
          console.log('UniversalDocumentViewer - PDF loaded successfully:', pdf);
          console.log('UniversalDocumentViewer - Number of pages:', pdf.numPages);
          setNumPages(pdf.numPages);
          setLoading(false);
          onLoadSuccess?.(pdf);
        }}
        onLoadError={(error) => {
          console.error('UniversalDocumentViewer - PDF load error:', error);
          console.error('UniversalDocumentViewer - Error message:', error.message);
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
  };

  const renderImageViewer = () => (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 400,
      width: '100%',
      flex: 1
    }}>
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

  const renderWordViewer = () => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: 400,
      gap: 2,
      p: 4,
      width: '100%',
      flex: 1
    }}>
      <Box sx={{ fontSize: 64, color: 'primary.main' }}>
        {getDocumentIcon('word')}
      </Box>
      <Typography variant="h6" color="text.primary">
        {getDocumentTypeName('word')}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {document?.title || document?.filename || 'Document'}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        Word documents can be viewed and edited with signature fields.
        <br />
        The document will be converted to PDF for signing.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Original
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              console.log('Converting Word document to PDF for viewing...');
              // Call the conversion API
              const response = await fetch(`/api/v1/documents/${document.id}/convert`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.converted) {
                  // Reload the page with the converted PDF
                  window.location.reload();
                } else {
                  console.log('Document does not need conversion');
                }
              } else {
                console.error('Conversion failed:', response.statusText);
              }
            } catch (error) {
              console.error('Error converting document:', error);
            }
          }}
        >
          View as PDF
        </Button>
      </Box>
    </Box>
  );

  const renderExcelViewer = () => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: 400,
      gap: 2,
      p: 4,
      width: '100%',
      flex: 1
    }}>
      <Box sx={{ fontSize: 64, color: 'success.main' }}>
        {getDocumentIcon('excel')}
      </Box>
      <Typography variant="h6" color="text.primary">
        {getDocumentTypeName('excel')}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {document?.title || document?.filename || 'Spreadsheet'}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        Excel spreadsheets can be viewed and edited with signature fields.
        <br />
        The document will be converted to PDF for signing.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Original
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              console.log('Converting Excel document to PDF for viewing...');
              const response = await fetch(`/api/v1/documents/${document.id}/convert`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.converted) {
                  window.location.reload();
                }
              }
            } catch (error) {
              console.error('Error converting document:', error);
            }
          }}
        >
          View as PDF
        </Button>
      </Box>
    </Box>
  );

  const renderPowerPointViewer = () => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: 400,
      gap: 2,
      p: 4,
      width: '100%',
      flex: 1
    }}>
      <Box sx={{ fontSize: 64, color: 'warning.main' }}>
        {getDocumentIcon('powerpoint')}
      </Box>
      <Typography variant="h6" color="text.primary">
        {getDocumentTypeName('powerpoint')}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {document?.title || document?.filename || 'Presentation'}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        PowerPoint presentations can be viewed and edited with signature fields.
        <br />
        The document will be converted to PDF for signing.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Original
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              console.log('Converting PowerPoint document to PDF for viewing...');
              const response = await fetch(`/api/v1/documents/${document.id}/convert`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.converted) {
                  window.location.reload();
                }
              }
            } catch (error) {
              console.error('Error converting document:', error);
            }
          }}
        >
          View as PDF
        </Button>
      </Box>
    </Box>
  );

  const renderTextViewer = () => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: 400,
      gap: 2,
      p: 4,
      width: '100%',
      flex: 1
    }}>
      <Box sx={{ fontSize: 64, color: 'info.main' }}>
        {getDocumentIcon('text')}
      </Box>
      <Typography variant="h6" color="text.primary">
        {getDocumentTypeName('text')}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {document?.title || document?.filename || 'Text Document'}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        Text documents can be viewed and edited with signature fields.
        <br />
        The document will be converted to PDF for signing.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Original
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              console.log('Converting text document to PDF for viewing...');
              const response = await fetch(`/api/v1/documents/${document.id}/convert`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.converted) {
                  window.location.reload();
                }
              }
            } catch (error) {
              console.error('Error converting document:', error);
            }
          }}
        >
          View as PDF
        </Button>
      </Box>
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
      p: 4,
      width: '100%',
      flex: 1
    }}>
      <Box sx={{ fontSize: 64, color: 'text.secondary' }}>
        {getDocumentIcon(type)}
      </Box>
      <Typography variant="h6" color="text.secondary">
        {getDocumentTypeName(type)}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {document?.title || document?.filename || 'Document'}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
        This document type can be viewed and edited with signature fields.
        <br />
        The document will be converted to PDF for signing.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Original
        </Button>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              console.log('Converting document to PDF for viewing...');
              const response = await fetch(`/api/v1/documents/${document.id}/convert`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (response.ok) {
                const result = await response.json();
                if (result.converted) {
                  window.location.reload();
                }
              }
            } catch (error) {
              console.error('Error converting document:', error);
            }
          }}
        >
          View as PDF
        </Button>
      </Box>
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
    console.log('UniversalDocumentViewer - Switch statement - docType:', docType);

    switch (docType) {
      case 'pdf':
        console.log('UniversalDocumentViewer - Switch statement - calling renderPDFViewer');
        return renderPDFViewer();
      case 'image':
        console.log('UniversalDocumentViewer - Switch statement - calling renderImageViewer');
        return renderImageViewer();
      case 'word':
        console.log('UniversalDocumentViewer - Switch statement - calling renderWordViewer');
        return renderWordViewer();
      case 'excel':
        console.log('UniversalDocumentViewer - Switch statement - calling renderExcelViewer');
        return renderExcelViewer();
      case 'powerpoint':
        console.log('UniversalDocumentViewer - Switch statement - calling renderPowerPointViewer');
        return renderPowerPointViewer();
      case 'text':
        console.log('UniversalDocumentViewer - Switch statement - calling renderTextViewer');
        return renderTextViewer();
      case 'csv':
      default:
        console.log('UniversalDocumentViewer - Switch statement - calling renderUnsupportedViewer for type:', docType);
        return renderUnsupportedViewer(docType);
    }
  };

  return (
    <Paper sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'auto',
      flex: 1,
      minHeight: 0
    }}>
      {renderDocument()}
    </Paper>
  );
};

export default UniversalDocumentViewer;
