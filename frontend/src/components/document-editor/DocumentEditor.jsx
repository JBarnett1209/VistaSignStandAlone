import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Paper,
  IconButton,
  Divider
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Simple field palette component
const FieldPalette = () => {
  const fieldTypes = [
    { id: 'signature', label: 'Signature', icon: '✍️' },
    { id: 'date', label: 'Date', icon: '📅' },
    { id: 'text', label: 'Text', icon: '📝' },
    { id: 'checkbox', label: 'Checkbox', icon: '☑️' }
  ];

  return (
    <Paper sx={{ p: 2, width: 250, height: '100%', bgcolor: '#f5f5f5' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Add Fields</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag fields to the document
      </Typography>
      
      {fieldTypes.map((field) => (
        <DraggableField key={field.id} field={field} />
      ))}
    </Paper>
  );
};

// Simple draggable field component
const DraggableField = ({ field }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    data: { type: 'field', fieldType: field.id }
  });

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        p: 2,
        mb: 1,
        bgcolor: 'white',
        border: '1px solid #ddd',
        borderRadius: 1,
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        '&:hover': { bgcolor: '#f0f0f0' }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <span>{field.icon}</span>
        <Typography variant="body2">{field.label}</Typography>
      </Box>
    </Box>
  );
};

// Simple PDF drop zone
const PdfDropZone = ({ onFieldDrop, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'pdf-drop-zone',
    data: { type: 'pdf' }
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        border: isOver ? '2px dashed #1976d2' : '2px dashed transparent',
        borderRadius: 1,
        transition: 'border-color 0.2s ease',
        minHeight: 600,
        bgcolor: '#fafafa'
      }}
    >
      {children}
    </Box>
  );
};

// Simple field component
const Field = ({ field, onRemove }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: field.x,
        top: field.y,
        width: field.width || 150,
        height: field.height || 40,
        border: '2px solid #1976d2',
        borderRadius: 1,
        bgcolor: 'rgba(25, 118, 210, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.2)' }
      }}
      onClick={() => onRemove(field.id)}
    >
      <Typography variant="caption" sx={{ textAlign: 'center' }}>
        {field.type}
      </Typography>
    </Box>
  );
};

// Main DocumentEditor component
const DocumentEditor = ({ document, onClose, onSave }) => {
  const [fields, setFields] = useState([]);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [documentType, setDocumentType] = useState(null);
  const [loadingError, setLoadingError] = useState(null);

  // Set document URL when document changes
  useEffect(() => {
    console.log('📄 Document object:', document);
    
    // Try different possible URL properties
    const possibleUrls = [
      document?.file_url,
      document?.url,
      document?.download_url,
      document?.public_url,
      document?.file_path
    ];
    
    const documentUrl = possibleUrls.find(url => url && typeof url === 'string');
    
    if (documentUrl) {
      console.log('📄 Found document URL:', documentUrl);
      
      // Determine document type from filename or URL
      let extension = 'pdf'; // Default to PDF
      
      if (document?.filename) {
        extension = document.filename.split('.').pop()?.toLowerCase() || 'pdf';
        console.log('📄 Using filename for type detection:', document.filename, '->', extension);
      } else if (documentUrl.includes('.')) {
        // Remove query parameters before extracting extension
        const urlWithoutParams = documentUrl.split('?')[0];
        extension = urlWithoutParams.split('.').pop()?.toLowerCase() || 'pdf';
        console.log('📄 Using URL for type detection:', urlWithoutParams, '->', extension);
      }
      
      // Force PDF if filename contains 'pdf' (case insensitive)
      if (document?.filename && document.filename.toLowerCase().includes('pdf')) {
        extension = 'pdf';
        console.log('📄 Forcing PDF type based on filename containing "pdf"');
      }
      
      console.log('📄 Detected document type:', extension);
      
      setDocumentType(extension);
      setDocumentUrl(documentUrl);
      setLoadingError(null);
    } else {
      console.log('❌ No document URL found. Available properties:', Object.keys(document || {}));
      
      // Try to construct URL from document ID if available
      if (document?.id) {
        const constructedUrl = `/api/v1/documents/${document.id}/file`;
        console.log('🔧 Constructing URL from ID:', constructedUrl);
        setDocumentType('pdf'); // Assume PDF for constructed URLs
        setDocumentUrl(constructedUrl);
        setLoadingError(null);
      } else {
        setLoadingError('No document URL found');
      }
    }
  }, [document]);

  // Handle drag end
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    if (active.data.current?.type === 'field' && over?.data.current?.type === 'pdf') {
      const fieldType = active.data.current.fieldType;
      
      // Get drop position from the drag event
      const dropX = event.over?.rect?.left || 100;
      const dropY = event.over?.rect?.top || 100;
      
      const newField = {
        id: Date.now(),
        type: fieldType,
        x: Math.max(0, dropX - 200), // Adjust for dialog position
        y: Math.max(0, dropY - 200), // Adjust for dialog position
        width: 150,
        height: 40
      };
      
      setFields(prev => [...prev, newField]);
    }
  }, []);

  // Remove field
  const handleRemoveField = useCallback((fieldId) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
  }, []);

  // Handle PDF load success
  const handlePdfLoadSuccess = useCallback(({ numPages }) => {
    console.log('✅ PDF loaded successfully:', numPages, 'pages');
    setLoadingError(null);
  }, []);

  // Handle PDF load error
  const handlePdfLoadError = useCallback((error) => {
    console.error('❌ PDF load error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    setLoadingError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
  }, []);

  // Save document
  const handleSave = useCallback(() => {
    onSave?.(fields);
  }, [fields, onSave]);

  // Render different document types
  const renderDocument = () => {
    if (!documentUrl) {
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 600,
          bgcolor: '#f5f5f5'
        }}>
          <Typography variant="body1" color="text.secondary">
            No document loaded
          </Typography>
        </Box>
      );
    }

    if (loadingError) {
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: 600,
          bgcolor: '#ffebee'
        }}>
          <Typography variant="body1" color="error">
            {loadingError}
          </Typography>
        </Box>
      );
    }

    // Render based on document type
    switch (documentType) {
      case 'pdf':
        console.log('📄 Rendering PDF with URL:', documentUrl);
        return (
          <Document
            file={documentUrl}
            onLoadSuccess={handlePdfLoadSuccess}
            onLoadError={handlePdfLoadError}
            loading={
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: 600,
                bgcolor: '#f5f5f5'
              }}>
                <Typography variant="body1" color="text.secondary">
                  Loading PDF...
                </Typography>
              </Box>
            }
            error={
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: 600,
                bgcolor: '#ffebee'
              }}>
                <Typography variant="body1" color="error">
                  Error loading PDF
                </Typography>
              </Box>
            }
          >
            <Page
              pageNumber={1}
              scale={1.0}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        );
      
      case 'doc':
      case 'docx':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 600,
            bgcolor: '#e3f2fd'
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                Word Document
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {document?.title || 'Document'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Word documents will be converted to PDF for editing
              </Typography>
            </Box>
          </Box>
        );
      
      case 'txt':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 600,
            bgcolor: '#f3e5f5'
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                Text Document
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {document?.title || 'Document'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Text documents will be converted to PDF for editing
              </Typography>
            </Box>
          </Box>
        );
      
      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: 600,
            bgcolor: '#fff3e0'
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
                Document Type: {documentType?.toUpperCase() || 'Unknown'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {document?.title || 'Document'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This document type will be converted to PDF for editing
              </Typography>
            </Box>
          </Box>
        );
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
    <Dialog
        open={!!document}
        onClose={onClose}
        maxWidth="lg"
      fullWidth
        sx={{
          '& .MuiDialog-paper': {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
      }}>
          <Typography variant="h6">
          Document Editor - {document?.title || 'Untitled'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
      </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'flex', height: '100%' }}>
          {/* Field Palette */}
          <FieldPalette />
          
          <Divider orientation="vertical" flexItem />
          
          {/* Main Content */}
          <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button variant="contained" onClick={handleSave}>
                Save
              </Button>
              <Button variant="outlined" onClick={onClose}>
                Cancel
              </Button>
              
              {/* Debug Info */}
              {documentUrl && (
                <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Type: {documentType?.toUpperCase() || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    URL: {documentUrl.length > 50 ? documentUrl.substring(0, 50) + '...' : documentUrl}
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Document Area */}
            <PdfDropZone onFieldDrop={() => {}}>
              <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* Document Renderer */}
                {renderDocument()}
                
                {/* Fields Overlay */}
                {fields.map(field => (
                  <Field 
                  key={field.id}
                  field={field}
                    onRemove={handleRemoveField}
                />
              ))}
              </Box>
            </PdfDropZone>
        </Box>
      </DialogContent>
    </Dialog>
    </DndContext>
  );
};

export default DocumentEditor;