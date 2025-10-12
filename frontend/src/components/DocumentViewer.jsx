import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  calculatePdfOffset, 
  fieldToScreenCoords, 
  findSignatureForField,
  isFieldSigned,
  PDF_CONFIG
} from '../utils/pdfCoordinates';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FIELD_TYPE_CONFIG = {
  signature: {
    label: 'Signature',
    color: '#1976d2',
  },
  date: {
    label: 'Date',
    color: '#388e3c',
  },
  initials: {
    label: 'Initials',
    color: '#f57c00',
  },
  text: {
    label: 'Text',
    color: '#7b1fa2',
  },
  checkbox: {
    label: 'Checkbox',
    color: '#455a64',
  },
  radio: {
    label: 'Radio Group',
    color: '#5d4037',
  },
  dropdown: {
    label: 'Dropdown',
    color: '#00897b',
  },
  name: {
    label: 'Name',
    color: '#3949ab',
  },
  email: {
    label: 'Email',
    color: '#1e88e5',
  },
  attachment: {
    label: 'Attachment',
    color: '#6d4c41',
  },
};

export default function DocumentViewer({ document, onClose, signatures = [] }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // PDF position tracking
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  const pdfContainerRef = useRef(null);

  // Calculate PDF offset using centralized system
  const updatePdfOffset = () => {
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
    }
  };

  // Load document fields on mount
  useEffect(() => {
    // Reset page number to 1 when document changes
    setPageNumber(1);
  }, [document]);

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
  }, [scale, numPages]);

  // Recalculate offset when document changes
  useEffect(() => {
    if (document) {
      const timer = setTimeout(() => {
        updatePdfOffset();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [document]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleFitToScreen = () => {
    setScale(1.0);
  };

  const renderSignatureField = (field, pageNum) => {
    if (!field) return null;

    // Use centralized signature checking with improved field matching
    const isSigned = isFieldSigned(field, signatures, document?.id);
    const signature = findSignatureForField(field, signatures, document?.id);
    
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
                // Show signature image if available
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
                // Show digital signature text
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
              } else if (signature?.signature_data) {
                // Show signature data as text
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
                    {signature.signature_data}
                  </Typography>
                );
              } else {
                // Fallback to checkmark
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

            {/* Timestamp and Signer Info */}
            {(() => {
              return (
                <Box sx={{ mt: 0.5 }}>
                  {signature?.signed_at && (
                    <Typography variant="caption" sx={{ 
                      color: '#2E7D32', 
                      fontSize: '8px',
                      textAlign: 'center',
                      lineHeight: 1,
                      display: 'block'
                    }}>
                      {new Date(signature.signed_at).toLocaleDateString()}
                    </Typography>
                  )}
                  {signature?.participant_email && (
                    <Typography variant="caption" sx={{ 
                      color: '#2E7D32', 
                      fontSize: '8px',
                      textAlign: 'center',
                      lineHeight: 1,
                      display: 'block',
                      fontWeight: 'bold'
                    }}>
                      by {signature.participant_email}
                    </Typography>
                  )}
                </Box>
              );
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

            {/* Template Content */}
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

            {/* Template Info */}
            <Typography variant="caption" sx={{ 
              color: '#E65100', 
              fontSize: '8px',
              textAlign: 'center',
              lineHeight: 1,
              display: 'block',
              fontWeight: 'bold'
            }}>
              Ready to Sign
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
            {/* Field Type Icon */}
            <Box sx={{ 
              color: '#666',
              fontSize: field.height > 40 ? '16px' : '12px',
              mb: 0.5
            }}>
              ✏️
            </Box>

            {/* Field Label */}
            <Typography variant="caption" sx={{ 
              color: '#666', 
              fontSize: '8px',
              textAlign: 'center',
              lineHeight: 1,
              fontWeight: 'bold'
            }}>
              {field.label || field.name || 'Signature'}
            </Typography>

            {/* Required indicator */}
            {field.required && (
              <Typography variant="caption" sx={{ 
                color: '#f44336', 
                fontSize: '8px',
                fontWeight: 'bold',
                position: 'absolute',
                top: -6,
                right: -6
              }}>
                *
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  if (!document) {
    return null;
  }

  const allFields = document?.fields || [];
  const currentPageFields = allFields.filter(field => (field.page || 1) === pageNumber);

  return (
    <Dialog
      open={!!document}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { 
          height: '90vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6">
          View Document: {document?.title || 'Untitled Document'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
          {/* Document Viewer */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Box sx={{ 
              p: 1, 
              borderBottom: 1, 
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <Button
                size="small"
                startIcon={<ZoomOutIcon />}
                onClick={handleZoomOut}
              >
                Zoom Out
              </Button>
              <Typography variant="body2" sx={{ mx: 1 }}>
                {Math.round(scale * 100)}%
              </Typography>
              <Button
                size="small"
                startIcon={<ZoomInIcon />}
                onClick={handleZoomIn}
              >
                Zoom In
              </Button>
              <Button
                size="small"
                startIcon={<FitScreenIcon />}
                onClick={handleFitToScreen}
              >
                Fit
              </Button>
              
              {/* Page Navigation */}
              {numPages && numPages > 1 && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <Button
                    size="small"
                    onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                    disabled={pageNumber <= 1}
                  >
                    Previous
                  </Button>
                  <Typography variant="body2" sx={{ mx: 1 }}>
                    Page {pageNumber} of {numPages}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                    disabled={pageNumber >= numPages}
                  >
                    Next
                  </Button>
                </>
              )}

              {/* Signature Status Summary */}
              {allFields.length > 0 && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <Chip 
                    icon={<SignedIcon />}
                    label={`${signatures.length} Signed`}
                    color="success"
                    size="small"
                  />
                  <Chip 
                    icon={<UnsignedIcon />}
                    label={`${allFields.length - signatures.length} Unsigned`}
                    color="warning"
                    size="small"
                  />
                </>
              )}
              
              <Box sx={{ flex: 1 }} />
            </Box>

            {/* PDF Viewer */}
            <Box 
              ref={pdfContainerRef}
              sx={{ 
                flex: 1, 
                overflow: 'auto', 
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f5f5f5',
                minHeight: 0,
                position: 'relative'
              }}
            >
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <Document
                  file={document?.file_url || document?.file_path || document?.url}
                  onLoadSuccess={(payload) => {
                    // react-pdf v5 passes a PDFDocumentProxy (with numPages), v6 passes { numPages }
                    const pages = (payload && typeof payload === 'object' && 'numPages' in payload)
                      ? payload.numPages
                      : (payload?.numPages ?? null);
                    if (pages) {
                      setNumPages(pages);
                    }
                    setLoading(false);
                    // Recalculate PDF offset after document loads
                    setTimeout(() => {
                      updatePdfOffset();
                    }, 500);
                    onDocumentLoadSuccess(payload);
                  }}
                  onLoadError={(error) => {
                    console.error('PDF load error:', error);
                    setError(`Failed to load PDF: ${error.message}`);
                    setLoading(false);
                  }}
                  loading={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
                      <CircularProgress />
                      <Typography>Loading PDF document...</Typography>
                    </Box>
                  }
                >
                  {numPages && (
                    <Box sx={{ position: 'relative' }}>
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      
                      {/* Signature Fields Overlay */}
                      {currentPageFields.map(field => renderSignatureField(field, pageNumber))}
                    </Box>
                  )}
                </Document>
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
    </Dialog>
  );
}