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
  Snackbar,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

// Professional components
import PdfViewer from './PdfViewer';
import FieldRenderer from './FieldRenderer';
import FieldManager from './FieldManager';
import FieldList, { FIELD_TYPE_CONFIG } from './FieldList';
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
  const [showFieldList, setShowFieldList] = useState(true);

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      
      // Load fields directly without separate function to avoid infinite loop
      const fields = document.fields || [];
      setFields(fields);
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
  }, [setPdfOffset]);

  // Handle field type selection
  const handleFieldTypeSelect = useCallback((fieldType) => {
    setSelectedFieldType(fieldType);
    setFieldManagerOpen(true);
  }, [setSelectedFieldType]);

  // Handle field reorder
  const handleFieldReorder = useCallback((sourceIndex, destinationIndex) => {
    setFields(prev => {
      const newFields = [...prev];
      const [removed] = newFields.splice(sourceIndex, 1);
      newFields.splice(destinationIndex, 0, removed);
      return newFields;
    });
  }, []);

  // Handle field visibility toggle
  const handleFieldVisibilityToggle = useCallback((field) => {
    updateField(field.id, { visible: field.visible === false ? true : false });
  }, [updateField]);

  // Handle add field button
  const handleAddField = useCallback(() => {
    setSelectedFieldType('signature');
    setFieldManagerOpen(true);
  }, []);

  // Handle field type drop from palette
  const handleFieldTypeDrop = useCallback((fieldData) => {
    // Create a new field with the drop position
    const config = FIELD_TYPE_CONFIG[fieldData.type] || { 
      label: fieldData.type, 
      defaultWidth: 200, 
      defaultHeight: 50 
    };
    
    const newField = {
      id: Date.now(),
      type: fieldData.type,
      label: config.label,
      x: fieldData.x,
      y: fieldData.y,
      width: config.defaultWidth,
      height: config.defaultHeight,
      page: fieldData.page,
      required: false,
      visible: true
    };
    
    addField(newField);
  }, [addField]);

  // Main drag and drop handler
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    console.log('🎯 Drag End Event:', {
      activeId: active.id,
      activeType: active.data.current?.type,
      overId: over?.id,
      overType: over?.data.current?.type,
      overData: over?.data.current
    });
    
    // Handle field type drops (from palette to document)
    if (active.data.current?.type === 'field-type' && over?.data.current?.type === 'pdf-page') {
      const fieldType = active.data.current.fieldType;
      const dropPage = over.data.current.pageNumber;
      
      // Calculate drop position relative to the PDF page
      // Use a more robust approach to find the PDF page element
      let pdfPage = null;
      try {
        pdfPage = document.querySelector('.react-pdf__Page') || 
                 document.querySelector('[data-page-number]') ||
                 document.querySelector('.pdf-page');
      } catch (error) {
        console.warn('Error finding PDF page element:', error);
      }
      
      if (pdfPage && typeof pdfPage.getBoundingClientRect === 'function') {
        const pageRect = pdfPage.getBoundingClientRect();
        
        // Try to get drop coordinates from different sources
        let dropX, dropY;
        
        if (event.activatorEvent) {
          // Use activator event coordinates
          dropX = event.activatorEvent.clientX - pageRect.left;
          dropY = event.activatorEvent.clientY - pageRect.top;
        } else if (event.delta) {
          // Use delta coordinates as fallback
          dropX = pageRect.width / 2; // Center of page
          dropY = pageRect.height / 2;
        } else {
          // Default to center of page
          dropX = pageRect.width / 2;
          dropY = pageRect.height / 2;
        }
        
        // Convert screen coordinates to PDF coordinates
        const pdfX = Math.max(0, (dropX - pdfOffset.x) / scale);
        const pdfY = Math.max(0, (dropY - pdfOffset.y) / scale);
        
        handleFieldTypeDrop({
          type: fieldType,
          x: pdfX,
          y: pdfY,
          page: dropPage
        });
      } else {
        // Fallback: use center of the page if we can't find the PDF element
        console.warn('Could not find PDF page element, using fallback coordinates');
        handleFieldTypeDrop({
          type: fieldType,
          x: 200, // Default center position
          y: 200,
          page: dropPage
        });
      }
      return;
    }
    
    // Handle field reordering in the sidebar
    if (active.id !== over?.id && active.data.current?.type !== 'field-type') {
      const oldIndex = fields.findIndex(field => field.id === active.id);
      const newIndex = fields.findIndex(field => field.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        handleFieldReorder(oldIndex, newIndex);
      }
    }
  }, [handleFieldTypeDrop, handleFieldReorder, fields, pdfOffset, scale]);

  // Handle drag start
  const handleDragStart = useCallback((event) => {
    // Drag started - no action needed here
  }, []);

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Global CSS fix for drag overlay */}
      <style>
        {`
          .MuiDialog-root {
            overflow: visible !important;
          }
          .MuiDialog-paper {
            overflow: visible !important;
          }
          .MuiDialogContent-root {
            overflow: visible !important;
          }
          [data-rbd-drag-handle-dragging-id] {
            z-index: 9999 !important;
          }
        `}
      </style>
      <Dialog
        open={!!document}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            height: '90vh',
            maxHeight: '90vh',
            overflow: 'visible' // Allow drag to extend beyond dialog bounds
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
        <Box>
          <Typography variant="h6">
            Document Editor - {document?.title || 'Untitled'}
          </Typography>
        </Box>
        <Button
          onClick={handleClose}
          startIcon={<CloseIcon />}
          size="small"
          variant="outlined"
        >
          Close
        </Button>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'row', 
        height: '100%',
        overflow: 'visible' // Allow drag to extend beyond dialog bounds
      }}>
        {/* Field List Sidebar */}
        {showFieldList && (
          <FieldList
            fields={fields}
            selectedField={selectedField}
            onFieldSelect={handleFieldClick}
            onFieldEdit={handleFieldEdit}
            onFieldDelete={handleFieldDelete}
            onFieldReorder={handleFieldReorder}
            onFieldVisibilityToggle={handleFieldVisibilityToggle}
            onAddField={handleAddField}
            onFieldTypeDrop={handleFieldTypeDrop}
            currentPage={pageNumber}
          />
        )}

        {/* Main Content Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
          overflow: 'visible' // Allow drag to extend beyond content bounds
        }}>
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
            showFieldList={showFieldList}
            onToggleFieldList={() => setShowFieldList(!showFieldList)}
          />

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {/* PDF Viewer */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'visible', // Allow drag to extend beyond container bounds
            p: 1 
          }}>
            {documentUrl && (
              <PdfViewer
                documentUrl={documentUrl}
                scale={scale}
                onScaleChange={handleScaleChange}
                onPdfLoad={handlePdfLoad}
                onPageChange={handlePageChange}
                onPdfOffsetChange={handlePdfOffsetChange}
                onFieldDrop={handleFieldTypeDrop}
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
    </DndContext>
  );
};

export default DocumentEditor;
