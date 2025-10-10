import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon } from '@mui/icons-material';
import UniversalDocumentViewer from './UniversalDocumentViewer';

const DocumentViewer = ({ document, signatures = [], onClose, onFieldClick = null }) => {
  if (!document) {
    return null;
  }

  return (
    <Dialog
      open={!!document}
      onClose={onClose}
      maxWidth="lg"
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
        <Box>
          <Typography variant="h6">
            {document.title || document.filename || 'Document Viewer'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Viewing document with signature field status
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={() => {
              const link = document.createElement('a');
              link.href = document.file_url || document.file_path || document.url;
              link.download = document.filename || 'document';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            size="small"
          >
            <DownloadIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <UniversalDocumentViewer
          document={document}
          signatures={signatures}
          showSignatureStatus={true}
          onFieldClick={onFieldClick}
          onLoadSuccess={() => {}}
          onLoadError={(error) => {
            console.error('Document load error:', error);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;