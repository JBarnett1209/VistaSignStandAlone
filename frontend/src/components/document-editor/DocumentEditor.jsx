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

  // Set document URL when document changes
  useEffect(() => {
    if (document?.file_url) {
      setDocumentUrl(document.file_url);
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

  // Save document
  const handleSave = useCallback(() => {
    onSave?.(fields);
  }, [fields, onSave]);

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
            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
              <Button variant="contained" onClick={handleSave}>
                Save
              </Button>
              <Button variant="outlined" onClick={onClose}>
                Cancel
              </Button>
            </Box>
            
            {/* PDF Area */}
            <PdfDropZone onFieldDrop={() => {}}>
              {documentUrl ? (
                <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* Real PDF Viewer */}
                  <Document
                    file={documentUrl}
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
                        bgcolor: '#f5f5f5'
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
                  
                  {/* Fields */}
                  {fields.map(field => (
                    <Field 
                      key={field.id} 
                      field={field} 
                      onRemove={handleRemoveField}
                    />
                  ))}
                </Box>
              ) : (
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
              )}
            </PdfDropZone>
          </Box>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

export default DocumentEditor;