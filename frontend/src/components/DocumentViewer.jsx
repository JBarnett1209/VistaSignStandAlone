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
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
} from '@mui/icons-material';
import UnifiedDocumentViewer from './UnifiedDocumentViewer';

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

  // Load document fields on mount
  useEffect(() => {
    // Reset page number to 1 when document changes
    setPageNumber(1);
  }, [document]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleScaleChange = (newScale) => {
    setScale(newScale);
  };

  const handlePageChange = (newPageNumber) => {
    setPageNumber(newPageNumber);
  };


  if (!document) {
    return null;
  }

  const allFields = document?.fields || [];

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
            <Box sx={{ 
              flex: 1, 
              overflow: 'auto', 
              backgroundColor: '#f5f5f5',
              minHeight: 0,
              position: 'relative'
            }}>
              <UnifiedDocumentViewer
                documentUrl={document?.file_url || document?.file_path || document?.url}
                fields={allFields}
                signatures={signatures}
                documentId={document?.id}
                scale={scale}
                onScaleChange={handleScaleChange}
                onPdfLoad={onDocumentLoadSuccess}
                onPageChange={handlePageChange}
                pageNumber={pageNumber}
                numPages={numPages}
                showControls={false}
                showFields={true}
                sx={{ 
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0
                }}
              />
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