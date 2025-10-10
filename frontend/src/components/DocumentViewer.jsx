import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Edit as SignatureIcon,
  CalendarToday as DateIcon,
  TextFields as TextIcon,
  CheckCircle as InitialIcon,
  CheckBox as CheckboxIcon,
  RadioButtonChecked as RadioIcon,
  ArrowDropDownCircle as DropdownIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Attachment as AttachmentIcon,
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FIELD_TYPES = {
  SIGNATURE: 'signature',
  DATE: 'date',
  INITIALS: 'initials',
  TEXT: 'text',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DROPDOWN: 'dropdown',
  NAME: 'name',
  EMAIL: 'email',
  ATTACHMENT: 'attachment',
  WHITEOUT: 'whiteout'
};

const DocumentViewer = ({ document, signatures = [], onClose, onFieldClick = null }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pdfContainerRef = useRef(null);

  const fields = document?.fields || [];
  const currentPageFields = fields.filter(field => (field.page || 1) === pageNumber);

  const calculatePdfOffset = () => {
    if (pdfContainerRef.current) {
      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      const pdfWidth = 800; // Fixed width we're using for the PDF viewer
      const containerWidth = containerRect.width;
      const offsetX = (containerWidth - pdfWidth) / 2 + 7; // Add 7px adjustment for better positioning
      setPdfOffset({ x: offsetX, y: 0 });
    }
  };

  useEffect(() => {
    calculatePdfOffset();
    window.addEventListener('resize', calculatePdfOffset);
    window.addEventListener('scroll', calculatePdfOffset);
    return () => {
      window.removeEventListener('resize', calculatePdfOffset);
      window.removeEventListener('scroll', calculatePdfOffset);
    };
  }, []);

  const onDocumentLoadSuccess = (payload) => {
    const pages = (payload && typeof payload === 'object' && 'numPages' in payload)
      ? payload.numPages
      : (payload?.numPages ?? null);
    if (pages) {
      setNumPages(pages);
    }
    setLoading(false);
    // Recalculate PDF offset after document loads
    setTimeout(() => {
      calculatePdfOffset();
    }, 100);
  };

  // Use the same renderSignatureField logic as PublicSigning but adapted for view-only
  const renderSignatureField = (field) => {
    // Check if this field is signed by looking at signatures
    const isSigned = signatures.some(sig => 
      sig.document_id === document?.id && 
      sig.signature_position && 
      JSON.stringify(sig.signature_position) === JSON.stringify(field)
    );

    const signature = signatures.find(sig => 
      sig.document_id === document?.id && 
      sig.signature_position && 
      JSON.stringify(sig.signature_position) === JSON.stringify(field)
    );

    return (
      <Box
        key={field.id}
        onClick={() => onFieldClick && onFieldClick(field, pageNumber)}
        sx={{
          position: 'absolute',
          // Use PDF offset calculation (same as PublicSigning)
          left: field.x + pdfOffset.x,
          top: field.y + pdfOffset.y,
          width: `${field.width}px`,
          height: `${field.height}px`,
          border: isSigned ? '2px solid #4CAF50' : '2px solid #ccc',
          backgroundColor: isSigned ? 'rgba(76, 175, 80, 0.1)' : 'rgba(204, 204, 204, 0.1)',
          borderRadius: '4px',
          cursor: onFieldClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '30px',
          transition: 'all 0.2s ease',
          '&:hover': onFieldClick ? {
            backgroundColor: isSigned ? 'rgba(76, 175, 80, 0.2)' : 'rgba(204, 204, 204, 0.2)',
          } : {},
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
            {signature?.digital_signature ? (
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
            ) : (
              <Typography variant="caption" sx={{ 
                color: '#1B5E20', 
                fontSize: '9px',
                fontWeight: 'bold'
              }}>
                ✓ Signed
              </Typography>
            )}

            {/* Timestamp and Type */}
            {signature?.signed_at && (
              <Typography variant="caption" sx={{ 
                color: '#2E7D32', 
                fontSize: '8px',
                textAlign: 'center',
                lineHeight: 1,
                mt: 0.5
              }}>
                {new Date(signature.signed_at).toLocaleDateString()}
              </Typography>
            )}
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
              {field.type === FIELD_TYPES.SIGNATURE && <SignatureIcon />}
              {field.type === FIELD_TYPES.DATE && <DateIcon />}
              {field.type === FIELD_TYPES.INITIALS && <InitialIcon />}
              {field.type === FIELD_TYPES.TEXT && <TextIcon />}
              {field.type === FIELD_TYPES.CHECKBOX && <CheckboxIcon />}
              {field.type === FIELD_TYPES.RADIO && <RadioIcon />}
              {field.type === FIELD_TYPES.DROPDOWN && <DropdownIcon />}
              {field.type === FIELD_TYPES.NAME && <PersonIcon />}
              {field.type === FIELD_TYPES.EMAIL && <EmailIcon />}
              {field.type === FIELD_TYPES.ATTACHMENT && <AttachmentIcon />}
            </Box>

            {/* Field Label */}
            <Typography variant="caption" sx={{ 
              color: '#666', 
              fontSize: '8px',
              textAlign: 'center',
              lineHeight: 1,
              fontWeight: 'bold'
            }}>
              {field.label || field.name || field.type}
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
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
        <Typography variant="h6" color="text.secondary">No document selected for viewing.</Typography>
      </Box>
    );
  }

  const fileUrl = document?.file_url || document?.file_path || document?.url;
  const docType = document?.mime_type?.includes('pdf') || document?.filename?.endsWith('.pdf') ? 'pdf' : 'other';

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      overflow: 'auto',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Top Controls */}
      <Paper elevation={1} sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 2, 
        p: 1, 
        mb: 2,
        width: 'fit-content',
        flexWrap: 'wrap'
      }}>
        {/* Zoom Controls */}
        <IconButton size="small" onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}>
          <ZoomOutIcon />
        </IconButton>
        <Typography variant="body2">{Math.round(scale * 100)}%</Typography>
        <IconButton size="small" onClick={() => setScale(prev => Math.min(3.0, prev + 0.1))}>
          <ZoomInIcon />
        </IconButton>
        <Button size="small" onClick={() => setScale(1.0)} startIcon={<FitScreenIcon />}>
          Fit
        </Button>

        {/* Page Navigation */}
        {docType === 'pdf' && numPages && numPages > 1 && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <IconButton 
              size="small"
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1}
            >
              <PrevIcon />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: '80px', textAlign: 'center' }}>
              Page {pageNumber} of {numPages}
            </Typography>
            <IconButton 
              size="small"
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              disabled={pageNumber >= numPages}
            >
              <NextIcon />
            </IconButton>
          </>
        )}

        {/* Signature Fields Summary */}
        {fields.length > 0 && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <Chip 
              icon={<SignedIcon />}
              label={`${signatures.length} Signed`}
              color="success"
              size="small"
            />
            <Chip 
              icon={<UnsignedIcon />}
              label={`${fields.length - signatures.length} Unsigned`}
              color="warning"
              size="small"
            />
          </>
        )}
      </Paper>

      {/* Document Content */}
      <Box 
        ref={pdfContainerRef}
        sx={{ 
          position: 'relative', 
          display: 'flex', 
          justifyContent: 'center', 
          width: '100%', 
          flex: 1, 
          minHeight: 0,
          p: 2
        }}
      >
        {loading && (
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
            <CircularProgress />
            <Typography>Loading document...</Typography>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            <Typography variant="h6">Failed to load document</Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {docType === 'pdf' && fileUrl && (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => {
              console.error('PDF load error:', err);
              setError(`Failed to load PDF: ${err.message || 'Unknown error'}`);
              setLoading(false);
            }}
            loading={null} // Handled by custom loading indicator
          >
            {numPages && (
              <Box sx={{ position: 'relative' }}>
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                {/* Render fields for current page - same approach as PublicSigning */}
                {currentPageFields.map(renderSignatureField)}
              </Box>
            )}
          </Document>
        )}

        {docType !== 'pdf' && fileUrl && !loading && !error && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
            <Typography variant="h6" color="text.secondary">
              Unsupported Document Type for Inline Viewer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please download the document to view it.
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = document.filename || 'document';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              Download Document
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DocumentViewer;