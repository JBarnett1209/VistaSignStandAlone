/**
 * Professional Document Editor
 * Refactored into focused, maintainable components
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

// Professional components
import PdfViewer from './PdfViewer';
import FieldRenderer from './FieldRenderer';
import FieldManager from './FieldManager';
import Toolbar from './Toolbar';

// State management
import useDocumentStore from '../../stores/documentStore';

// Services
import { documentsAPI } from '../../services/api';

const DocumentEditor = ({ 
  document, 
  onClose, 
  onSave 
}) => {
  // Local state (simplified to avoid Zustand issues)
  const [documentUrl, setDocumentUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isWhiteoutMode, setIsWhiteoutMode] = useState(false);
  const [selectedFieldType, setSelectedFieldType] = useState('signature');

  // Local state
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Simple function implementations
  const setDocument = (doc) => {
    setDocumentUrl(doc?.file_url || doc?.url);
  };
  
  const addField = (field) => {
    setFields(prev => [...prev, field]);
  };
  
  const updateField = (fieldId, updates) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };
  
  const deleteField = (fieldId) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
    setSelectedField(null);
    setEditingField(null);
  };
  
  const clearSelection = () => {
    setSelectedField(null);
    setEditingField(null);
  };
  
  const undo = () => {
    // Simple undo implementation
  };
  
  const redo = () => {
    // Simple redo implementation
  };
  
  const canUndo = false;
  const canRedo = false;

  // Initialize document
  useEffect(() => {
    if (document) {
      setDocument(document);
      setDocumentUrl(document.file_url || document.url);
      loadDocumentFields();
    }
    
    return () => {
      // Reset local state
      setDocumentUrl(null);
      setNumPages(null);
      setPageNumber(1);
      setScale(1.0);
      setPdfOffset({ x: 0, y: 0 });
      setFields([]);
      setSelectedField(null);
      setEditingField(null);
      setLoading(false);
      setError(null);
      setIsViewMode(false);
      setIsWhiteoutMode(false);
      setSelectedFieldType('signature');
    };
  }, [document, setDocument, setDocumentUrl]);

  // Load document fields
  const loadDocumentFields = useCallback(async () => {
    if (!document?.id) return;
    
    try {
      setLoading(true);
      const fields = document.fields || [];
      
      // Enhanced logging for field loading
      console.log('📝 DocumentEditor: Loading fields:', {
        documentId: document.id,
        documentTitle: document.title,
        totalFields: fields.length,
        fields: fields.map(field => ({
          id: field.id,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          label: field.label,
          value: field.value
        })),
        timestamp: new Date().toISOString()
      });
      
      // Fields are loaded as part of the document data
      setFields(fields);
    } catch (err) {
      setError('Failed to load document fields');
      console.error('Error loading fields:', err);
    } finally {
      setLoading(false);
    }
  }, [document, setLoading, setError]);

  // Save document fields
  const handleSave = useCallback(async () => {
    if (!document?.id) return;
    
    try {
      setLoading(true);
      
      // Enhanced logging for field coordinates being saved
      console.log('💾 DocumentEditor: Saving fields to database:', {
        documentId: document.id,
        documentTitle: document.title,
        totalFields: fields.length,
        fields: fields.map(field => ({
          id: field.id,
          type: field.type,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          page: field.page,
          label: field.label,
          value: field.value
        })),
        pdfOffset,
        scale,
        timestamp: new Date().toISOString()
      });
      
      // Save fields to backend using document update endpoint
      await documentsAPI.update(document.id, {
        fields: fields
      });
      
      setSnackbar({
        open: true,
        message: 'Document saved successfully',
        severity: 'success'
      });
      
      onSave?.(document);
    } catch (err) {
      setError('Failed to save document');
      setSnackbar({
        open: true,
        message: 'Failed to save document',
        severity: 'error'
      });
      console.error('Error saving document:', err);
    } finally {
      setLoading(false);
    }
  }, [document, fields, pdfOffset, scale, setLoading, setError, onSave]);

  // Handle PDF load
  const handlePdfLoad = useCallback(({ numPages }) => {
    setNumPages(numPages);
  }, [setNumPages]);

  // Handle page change
  const handlePageChange = useCallback((newPageNumber) => {
    setPageNumber(newPageNumber);
  }, []);

  // Handle scale change
  const handleScaleChange = useCallback((newScale) => {
    setScale(newScale);
  }, [setScale]);

  // Handle PDF offset change - this ensures DocumentEditor uses the same offset as UnifiedDocumentViewer
  const handlePdfOffsetChange = useCallback((offset) => {
    setPdfOffset(offset);
    // console.log('DocumentEditor: PDF offset updated from UnifiedDocumentViewer:', offset);
  }, [setPdfOffset]);

  // Handle field type selection
  const handleFieldTypeSelect = useCallback((fieldType) => {
    setSelectedFieldType(fieldType);
    setFieldManagerOpen(true);
  }, [setSelectedFieldType]);

  // Handle field click
  const handleFieldClick = useCallback((field) => {
    setSelectedField(field);
  }, [setSelectedField]);

  // Handle field edit
  const handleFieldEdit = useCallback((field) => {
    setEditingField(field);
    setFieldManagerOpen(true);
  }, [setEditingField]);

  // Handle field delete
  const handleFieldDelete = useCallback((field) => {
    deleteField(field.id);
    clearSelection();
  }, [deleteField, clearSelection]);

  // Handle field save
  const handleFieldSave = useCallback((fieldData) => {
    if (editingField) {
      updateField(editingField.id, fieldData);
    } else {
      addField({
        ...fieldData,
        page: pageNumber,
        x: 100, // Default position
        y: 100,
        width: fieldData.width || 200,
        height: fieldData.height || 50
      });
    }
    setEditingField(null);
  }, [editingField, updateField, addField, pageNumber, setEditingField]);

  // Handle field manager close
  const handleFieldManagerClose = useCallback(() => {
    setFieldManagerOpen(false);
    setEditingField(null);
  }, [setEditingField]);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  // Handle view mode toggle
  const handleViewModeToggle = useCallback(() => {
    setIsViewMode(!isViewMode);
    if (!isViewMode) {
      clearSelection?.();
    }
  }, [isViewMode, setIsViewMode, clearSelection]);

  // Handle whiteout mode toggle
  const handleWhiteoutModeToggle = useCallback(() => {
    setIsWhiteoutMode(!isWhiteoutMode);
    if (!isWhiteoutMode) {
      clearSelection?.();
    }
  }, [isWhiteoutMode, setIsWhiteoutMode, clearSelection]);

  // Handle send document
  const handleSend = useCallback(() => {
    // TODO: Implement send workflow
    setSnackbar({
      open: true,
      message: 'Send functionality coming soon',
      severity: 'info'
    });
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Get fields for current page
  const currentPageFields = fields.filter(field => field.page === pageNumber);

  return (
    <Dialog
      open={true}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      fullScreen
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 1
      }}>
        <Box>
          Document Editor - {document?.title || 'Untitled'}
        </Box>
        <Button
          onClick={handleClose}
          startIcon={<CloseIcon />}
          size="small"
        >
          Close
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar */}
        <Toolbar
          selectedFieldType={selectedFieldType}
          onFieldTypeSelect={handleFieldTypeSelect}
          onSave={handleSave}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSend={handleSend}
          onViewMode={handleViewModeToggle}
          onWhiteoutMode={handleWhiteoutModeToggle}
          canUndo={canUndo}
          canRedo={canRedo}
          isViewMode={isViewMode}
          isWhiteoutMode={isWhiteoutMode}
          isSaving={loading}
        />

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* PDF Viewer */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {documentUrl && (
            <PdfViewer
              documentUrl={documentUrl}
              scale={scale}
              onScaleChange={handleScaleChange}
              onPdfLoad={handlePdfLoad}
              onPageChange={handlePageChange}
              onPdfOffsetChange={handlePdfOffsetChange}
            >
              {/* Field Overlays */}
              {currentPageFields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  scale={scale}
                  pdfOffset={pdfOffset}
                  isSelected={selectedField?.id === field.id}
                  onFieldClick={handleFieldClick}
                  onFieldEdit={handleFieldEdit}
                  onFieldDelete={handleFieldDelete}
                  showControls={!isViewMode}
                />
              ))}
            </PdfViewer>
          )}
        </Box>
      </DialogContent>

      {/* Field Manager Dialog */}
      <FieldManager
        open={fieldManagerOpen}
        onClose={handleFieldManagerClose}
        onSave={handleFieldSave}
        field={editingField}
        fieldType={selectedFieldType}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Dialog>
  );
};

export default DocumentEditor;
