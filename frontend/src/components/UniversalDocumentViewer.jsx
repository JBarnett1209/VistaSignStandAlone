import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as ExcelIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
  Edit as EditIcon
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

const UniversalDocumentViewer = ({ 
  document, 
  onLoadError, 
  onLoadSuccess,
  zoom = 1.0,
  onZoomChange,
  pageNumber = 1,
  fixedWidth = null,
  signatures = [],
  showSignatureStatus = true,
  showPageNavigation = true,
  onFieldClick = null
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  
  // Ref for PDF container to calculate proper offset
  const pdfContainerRef = useRef(null);

  // Calculate PDF offset using centralized system
  const updatePdfOffset = () => {
    if (pdfContainerRef.current) {
      // Try to get the actual PDF width from the rendered page
      const pdfPage = pdfContainerRef.current.querySelector('.react-pdf__Page');
      let actualPdfWidth = PDF_CONFIG.STANDARD_WIDTH;
      
      if (pdfPage) {
        const pageRect = pdfPage.getBoundingClientRect();
        actualPdfWidth = pageRect.width;
      } else if (fixedWidth) {
        actualPdfWidth = fixedWidth;
      }
      
      const offset = calculatePdfOffset(pdfContainerRef.current, actualPdfWidth, zoom);
      setPdfOffset(offset);
    }
  };

  useEffect(() => {
    setCurrentPage(pageNumber);
  }, [pageNumber]);

  // Calculate PDF offset when component mounts, window resizes, or zoom changes
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
  }, [zoom]);

  // Recalculate offset when document changes
  useEffect(() => {
    if (document) {
      const timer = setTimeout(() => {
        updatePdfOffset();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [document]);

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
    
    // For non-PDF documents, we don't need to wait for loading
    const docType = getDocumentType(document?.mime_type, document?.filename);
    if (docType !== 'pdf') {
      setLoading(false);
    } else {
      // Test if the PDF file URL is accessible
      const fileUrl = document?.file_url || document?.file_path || document?.url;
      if (fileUrl) {
        fetch(fileUrl, { method: 'GET' })
          .then(response => {
            if (!response.ok) {
              console.error('PDF file not accessible:', response.status, response.statusText);
            }
          })
          .catch(error => {
            console.error('PDF file accessibility test failed:', error);
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

  const renderSignatureField = (field, pageNum) => {
    if (!showSignatureStatus || !field) return null;

    // Use centralized signature checking with improved field matching
    const isSigned = isFieldSigned(field, signatures, document?.id);
    const signature = findSignatureForField(field, signatures, document?.id);
    
    // Check if this field has a signature template (from document editing)
    const hasTemplate = field.type === 'signature' && field.value && field.value !== '';

    // Convert field coordinates to screen coordinates using proper PDF offset
    const screenCoords = fieldToScreenCoords(field, pdfOffset, zoom);

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
      cursor: onFieldClick ? 'pointer' : 'default',
      zIndex: 10,
      transition: 'all 0.2s ease-in-out'
    };

    return (
      <Tooltip 
        key={`${field.id || field.x}-${field.y}`}
        title={
          <Box>
            <Typography variant="body2">
              {field.label || field.name || 'Signature Field'}
            </Typography>
            <Typography variant="caption" color={
              isSigned ? 'success.main' : 
              hasTemplate ? 'warning.main' : 
              'warning.main'
            }>
              {isSigned ? 'Signed' : hasTemplate ? 'Template Set' : 'Unsigned'}
            </Typography>
            {isSigned && (() => {
              const signature = signatures.find(sig => 
                sig.document_id === document?.id && 
                sig.signature_position && 
                JSON.stringify(sig.signature_position) === JSON.stringify(field)
              );
              
              return (
                <Box>
                  {(() => {
                    // Show the actual signature content as the "signature"
                    let signatureContent = '';
                    if (signature?.signature_image) {
                      signatureContent = '[Handwritten Signature]';
                    } else if (signature?.digital_signature) {
                      signatureContent = signature.digital_signature;
                    } else if (signature?.signature_data) {
                      signatureContent = signature.signature_data;
                    } else if (signature?.participant_email) {
                      signatureContent = signature.participant_email;
                    } else {
                      signatureContent = '[Signature]';
                    }
                    
                    return (
                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                        Digitally signed by: {signatureContent}
                      </Typography>
                    );
                  })()}
                  {signature?.signed_at && (
                    <Typography variant="caption" display="block">
                      Signed: {new Date(signature.signed_at).toLocaleString()}
                    </Typography>
                  )}
                  {signature?.signature_type && (
                    <Typography variant="caption" display="block">
                      Type: {signature.signature_type}
                    </Typography>
                  )}
                  {signature?.verification_status && (
                    <Typography variant="caption" display="block" color={
                      signature.verification_status === 'verified' ? 'success.main' : 
                      signature.verification_status === 'failed' ? 'error.main' : 'warning.main'
                    }>
                      Status: {signature.verification_status}
                    </Typography>
                  )}
                </Box>
              );
            })()}
          </Box>
        }
        arrow
      >
        <Box
          style={fieldStyle}
          onClick={() => onFieldClick && onFieldClick(field, pageNum)}
          onMouseEnter={(e) => {
            if (isSigned) {
              e.target.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
            } else if (hasTemplate) {
              e.target.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
            } else {
              e.target.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = backgroundColor;
          }}
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
                const signature = signatures.find(sig => 
                  sig.document_id === document?.id && 
                  sig.signature_position && 
                  JSON.stringify(sig.signature_position) === JSON.stringify(field)
                );
                
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
                const signature = signatures.find(sig => 
                  sig.document_id === document?.id && 
                  sig.signature_position && 
                  JSON.stringify(sig.signature_position) === JSON.stringify(field)
                );
                
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
                <EditIcon />
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
      </Tooltip>
    );
  };

  const renderPDFViewer = () => {
    const allFields = document?.fields || [];
    const currentPageFields = allFields.filter(field => (field.page || 1) === currentPage);
    
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 2,
        width: '100%',
        flex: 1
      }}>
        {/* Page Navigation */}
        {showPageNavigation && numPages && numPages > 1 && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            p: 1,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1
          }}>
            <IconButton 
              size="small"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <PrevIcon />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: '80px', textAlign: 'center' }}>
              Page {currentPage} of {numPages}
            </Typography>
            <IconButton 
              size="small"
              onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
            >
              <NextIcon />
            </IconButton>
          </Box>
        )}

        {/* Signature Fields Summary */}
        {showSignatureStatus && allFields.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            flexWrap: 'wrap', 
            justifyContent: 'center',
            p: 1,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1
          }}>
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
          </Box>
        )}

        {/* PDF Document Container */}
        <Box ref={pdfContainerRef} sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
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
              }, 300);
              onLoadSuccess?.(payload);
            }}
            onLoadError={(error) => {
              console.error('PDF load error:', error);
              setError(`Failed to load PDF: ${error.message}`);
              setLoading(false);
              onLoadError?.(error);
            }}
            onSourceError={(error) => {
              console.error('PDF source error:', error);
            }}
            onLoadProgress={({ loaded, total }) => {
              // Progress tracking can be added here if needed
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
                  pageNumber={currentPage}
                  {...(fixedWidth ? { width: fixedWidth } : { scale: zoom })}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                
                {/* Signature Fields Overlay */}
                {currentPageFields.map(field => renderSignatureField(field, currentPage))}
              </Box>
            )}
          </Document>
        </Box>
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
    
    // For PDFs we allow the viewer to render while loading so it can report success/error
    if (loading && getDocumentType(document?.mime_type, document?.filename) !== 'pdf') {
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
        return renderWordViewer();
      case 'excel':
        return renderExcelViewer();
      case 'powerpoint':
        return renderPowerPointViewer();
      case 'text':
        return renderTextViewer();
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
      overflow: 'auto',
      flex: 1,
      minHeight: 0
    }}>
      {renderDocument()}
    </Paper>
  );
};

export default UniversalDocumentViewer;
