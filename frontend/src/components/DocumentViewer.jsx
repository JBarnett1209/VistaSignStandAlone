import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SignedIcon,
  RadioButtonUnchecked as UnsignedIcon,
} from '@mui/icons-material';
import UnifiedDocumentViewer from './UnifiedDocumentViewer';


export default function DocumentViewer({ document, onClose, signatures = [] }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
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

  // Enhanced logging for field loading
  console.log('📄 DocumentViewer: Loading fields:', {
    documentId: document?.id,
    documentTitle: document?.title,
    totalFields: allFields.length,
    fields: allFields.map(field => ({
      id: field.id,
      type: field.type,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      page: field.page,
      label: field.label
    })),
    timestamp: new Date().toISOString()
  });

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
            {/* Signature Status Summary */}
            {allFields.length > 0 && (
              <Box sx={{ 
                p: 1, 
                borderBottom: 1, 
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1
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
                showControls={true}
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