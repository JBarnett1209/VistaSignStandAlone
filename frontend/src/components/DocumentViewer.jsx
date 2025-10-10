import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
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
  Delete as DeleteIcon
} from '@mui/icons-material';
import { pdfjs } from 'react-pdf';
import UniversalDocumentViewer from './UniversalDocumentViewer';

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

const FIELD_TYPE_CONFIG = {
  [FIELD_TYPES.SIGNATURE]: {
    label: 'Signature',
    icon: <SignatureIcon />,
    color: '#1976d2',
    width: 200,
    height: 80
  },
  [FIELD_TYPES.DATE]: {
    label: 'Date',
    icon: <DateIcon />,
    color: '#388e3c',
    width: 120,
    height: 40
  },
  [FIELD_TYPES.INITIALS]: {
    label: 'Initials',
    icon: <InitialIcon />,
    color: '#f57c00',
    width: 80,
    height: 40
  },
  [FIELD_TYPES.TEXT]: {
    label: 'Text',
    icon: <TextIcon />,
    color: '#7b1fa2',
    width: 150,
    height: 40
  },
  [FIELD_TYPES.CHECKBOX]: {
    label: 'Checkbox',
    icon: <CheckboxIcon />,
    color: '#455a64',
    width: 24,
    height: 24
  },
  [FIELD_TYPES.RADIO]: {
    label: 'Radio Group',
    icon: <RadioIcon />,
    color: '#5d4037',
    width: 24,
    height: 24
  },
  [FIELD_TYPES.DROPDOWN]: {
    label: 'Dropdown',
    icon: <DropdownIcon />,
    color: '#00897b',
    width: 160,
    height: 40
  },
  [FIELD_TYPES.NAME]: {
    label: 'Name',
    icon: <PersonIcon />,
    color: '#3949ab',
    width: 180,
    height: 40
  },
  [FIELD_TYPES.EMAIL]: {
    label: 'Email',
    icon: <EmailIcon />,
    color: '#1e88e5',
    width: 220,
    height: 40
  },
  [FIELD_TYPES.ATTACHMENT]: {
    label: 'Attachment',
    icon: <AttachmentIcon />,
    color: '#6d4c41',
    width: 220,
    height: 40
  },
  [FIELD_TYPES.WHITEOUT]: {
    label: 'Whiteout Tool',
    icon: <DeleteIcon />,
    color: '#FF5722',
    width: 100,
    height: 20
  }
};

export default function DocumentViewer({ document, signatures = [], onClose, onFieldClick }) {
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0);
  const pdfContainerRef = useRef(null);

  const fields = document?.fields || [];
  const currentPageFields = fields.filter(field => (field.page || 1) === pageNumber);

  const calculatePdfOffset = () => {
    if (pdfContainerRef.current) {
      const rect = pdfContainerRef.current.getBoundingClientRect();
      setPdfOffset({ x: rect.left, y: rect.top });
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
    // Recalculate PDF offset after document loads
    setTimeout(() => {
      calculatePdfOffset();
    }, 100);
  };

  const renderField = (field) => {
    const config = FIELD_TYPE_CONFIG[field.type];
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
      <Tooltip
        key={field.id}
        title={
          <Box>
            <Typography variant="body2">
              {field.label || field.name || config.label}
            </Typography>
            <Typography variant="caption" color={isSigned ? 'success.main' : 'warning.main'}>
              {isSigned ? 'Signed' : 'Unsigned'}
            </Typography>
            {isSigned && signature && (
              <Typography variant="caption" display="block">
                Signed: {signature.signed_at ? new Date(signature.signed_at).toLocaleString() : 'Unknown date'}
              </Typography>
            )}
            {field.required && (
              <Typography variant="caption" display="block" color="error.main">
                Required
              </Typography>
            )}
          </Box>
        }
        arrow
      >
        <Box
          onClick={() => onFieldClick && onFieldClick(field, pageNumber)}
          sx={{
            position: 'absolute',
            left: field.x + pdfOffset.x,
            top: field.y + pdfOffset.y,
            width: field.width,
            height: field.height,
            border: `2px solid ${isSigned ? '#4caf50' : config.color}`,
            borderRadius: 1,
            backgroundColor: isSigned ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.9)',
            cursor: onFieldClick ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            '&:hover': {
              backgroundColor: isSigned ? 'rgba(76, 175, 80, 0.2)' : 'rgba(25, 118, 210, 0.1)'
            }
          }}
        >
          {/* Page number indicator */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              left: -8,
              backgroundColor: 'primary.main',
              color: 'white',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
          >
            {field.page || 1}
          </Box>

          {/* Field content */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isSigned ? (
              <SignedIcon sx={{ color: '#4caf50', fontSize: 20 }} />
            ) : (
              config.icon
            )}
            <Typography
              variant="caption"
              sx={{
                fontSize: '10px',
                fontWeight: 'bold',
                color: isSigned ? '#4caf50' : config.color,
                textAlign: 'center',
                lineHeight: 1
              }}
            >
              {isSigned ? 'SIGNED' : config.label.toUpperCase()}
            </Typography>
          </Box>

          {/* Required indicator */}
          {field.required && (
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                backgroundColor: 'error.main',
                color: 'white',
                borderRadius: '50%',
                width: 12,
                height: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
                fontWeight: 'bold'
              }}
            >
              *
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Page Navigation and Summary */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 2,
        backgroundColor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Page Navigation */}
          {numPages && numPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            </Box>
          )}
        </Box>

        {/* Signature Summary */}
        {fields.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
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
          </Box>
        )}
      </Box>

      {/* Document Viewer */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <Box
          ref={pdfContainerRef}
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minHeight: '100%',
            p: 2
          }}
        >
          <UniversalDocumentViewer
            document={document}
            zoom={scale}
            onZoomChange={setScale}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.error('Document load error:', error);
            }}
            pageNumber={pageNumber}
            fixedWidth={800}
          />
          
          {/* Render fields for current page */}
          {currentPageFields.map(renderField)}
        </Box>
      </Box>
    </Box>
  );
}
