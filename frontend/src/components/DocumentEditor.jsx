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
  TextField,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox as MUICheckbox,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
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
  Send as SendIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { pdfjs } from 'react-pdf';
import SignatureCreator from './SignatureCreator';
import UniversalDocumentViewer from './UniversalDocumentViewer';
import { documentsAPI, signaturesAPI } from '../services/api';

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

// const SIGNING_ROLES = {
//   SIGNER: 'signer',
//   APPROVER: 'approver',
//   RECIPIENT: 'recipient'
// };

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

export default function DocumentEditor({ document, onClose, onSave }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragField, setDragField] = useState(null);
  const [signatureCreatorOpen, setSignatureCreatorOpen] = useState(false);
  const [adoptDialogOpen, setAdoptDialogOpen] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [signatureTemplates, setSignatureTemplates] = useState([]);
  
  // Drag and drop state
  const [isDraggingField, setIsDraggingField] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [fieldStartPos, setFieldStartPos] = useState({ x: 0, y: 0 });
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [fieldStartSize, setFieldStartSize] = useState({ width: 0, height: 0 });
  
  // Whiteout tool state
  const [isWhiteoutMode, setIsWhiteoutMode] = useState(false);
  const [isDrawingWhiteout, setIsDrawingWhiteout] = useState(false);
  const [whiteoutStartPos, setWhiteoutStartPos] = useState({ x: 0, y: 0 });
  const [whiteoutBoxes, setWhiteoutBoxes] = useState([]);
  const [currentWhiteoutBox, setCurrentWhiteoutBox] = useState(null);
  
  // Drag over state
  const [isDragOver, setIsDragOver] = useState(false);

  const canvasRef = useRef(null);

  // Load document fields and signers on mount
  useEffect(() => {
    if (document?.fields) {
      setFields(document.fields);
    }
    
    // Load signature templates
    loadSignatureTemplates();
  }, [document]);

  const loadSignatureTemplates = async () => {
    try {
      const response = await signaturesAPI.templates.list();
      setSignatureTemplates(response.data || []);
    } catch (err) {
      console.error('Error loading signature templates:', err);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleFitToScreen = () => {
    setScale(1.0);
  };

  const handleFieldDragStart = (fieldType, event) => {
    event.dataTransfer.setData('text/plain', fieldType);
    event.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
    setDragField(fieldType);
  };

  const handleFieldDragEnd = () => {
    setIsDragging(false);
    setDragField(null);
  };

  const addFieldAtPosition = (event, containerRef) => {
    if (!dragField) return;

    const rect = containerRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const defaultValueByType = (type) => {
      switch (type) {
        case FIELD_TYPES.CHECKBOX:
          return false;
        case FIELD_TYPES.RADIO:
        case FIELD_TYPES.DROPDOWN:
          return '';
        case FIELD_TYPES.DATE:
          return new Date().toISOString().split('T')[0];
        default:
          return '';
      }
    };

    // Get the next signing order number
    const maxSigningOrder = Math.max(0, ...fields.map(f => f.signingOrder || 0));
    const nextSigningOrder = maxSigningOrder + 1;

    const newField = {
      id: Date.now().toString(),
      type: dragField,
      x: x / scale,
      y: y / scale,
      page: pageNumber,
      width: FIELD_TYPE_CONFIG[dragField].width,
      height: FIELD_TYPE_CONFIG[dragField].height,
      value: defaultValueByType(dragField),
      required: true,
      completed: false,
      signingOrder: nextSigningOrder,
      // type-specific metadata
      options: dragField === FIELD_TYPES.RADIO || dragField === FIELD_TYPES.DROPDOWN ? ['Option 1', 'Option 2'] : undefined,
      groupName: dragField === FIELD_TYPES.RADIO ? 'Group 1' : undefined,
      allowedFileTypes: dragField === FIELD_TYPES.ATTACHMENT ? '' : undefined,
      maxFileSizeMb: dragField === FIELD_TYPES.ATTACHMENT ? 10 : undefined
    };

    setFields(prev => [...prev, newField]);
    setIsDragging(false);
    setDragField(null);
    setSelectedField(newField.id);
  };

  const handleFieldClick = (fieldId) => {
    setSelectedField(fieldId);
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setEditingField(field);
      if (field.type === FIELD_TYPES.SIGNATURE && !field.completed) {
        // Check if user has signature templates
        if (signatureTemplates.length > 0) {
          // Use the first available signature template
          const template = signatureTemplates[0];
          const sig = template.template_data || template.signature_data;
          setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: sig, completed: true } : f));
          return;
        } else {
          setAdoptDialogOpen(true);
          return;
        }
      }
      setFieldDialogOpen(true);
    }
  };

  const handleFieldDelete = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
  };

  // Drag and drop handlers for fields
  const handleFieldMouseDown = (e, fieldId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    setSelectedField(fieldId);
    setIsDraggingField(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setFieldStartPos({ x: field.x, y: field.y });
  };

  const handleFieldMouseMove = (e) => {
    if (!isDraggingField || !selectedField) return;
    
    const deltaX = (e.clientX - dragStartPos.x) / scale;
    const deltaY = (e.clientY - dragStartPos.y) / scale;
    
    setFields(prev => prev.map(field => 
      field.id === selectedField 
        ? { ...field, x: Math.max(0, fieldStartPos.x + deltaX), y: Math.max(0, fieldStartPos.y + deltaY) }
        : field
    ));
  };

  const handleFieldMouseUp = () => {
    setIsDraggingField(false);
  };

  // Resize handlers for fields
  const handleResizeMouseDown = (e, fieldId, handle) => {
    e.preventDefault();
    e.stopPropagation();
    
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setFieldStartSize({ width: field.width, height: field.height });
    setFieldStartPos({ x: field.x, y: field.y });
  };

  const handleResizeMouseMove = (e) => {
    if (!isResizing || !selectedField) return;
    
    const deltaX = (e.clientX - resizeStartPos.x) / scale;
    const deltaY = (e.clientY - resizeStartPos.y) / scale;
    
    setFields(prev => prev.map(field => {
      if (field.id !== selectedField) return field;
      
      let newWidth = fieldStartSize.width;
      let newHeight = fieldStartSize.height;
      let newX = fieldStartPos.x;
      let newY = fieldStartPos.y;
      
      switch (resizeHandle) {
        case 'se': // Southeast
          newWidth = Math.max(50, fieldStartSize.width + deltaX);
          newHeight = Math.max(20, fieldStartSize.height + deltaY);
          break;
        case 'sw': // Southwest
          newWidth = Math.max(50, fieldStartSize.width - deltaX);
          newHeight = Math.max(20, fieldStartSize.height + deltaY);
          newX = fieldStartPos.x + (fieldStartSize.width - newWidth);
          break;
        case 'ne': // Northeast
          newWidth = Math.max(50, fieldStartSize.width + deltaX);
          newHeight = Math.max(20, fieldStartSize.height - deltaY);
          newY = fieldStartPos.y + (fieldStartSize.height - newHeight);
          break;
        case 'nw': // Northwest
          newWidth = Math.max(50, fieldStartSize.width - deltaX);
          newHeight = Math.max(20, fieldStartSize.height - deltaY);
          newX = fieldStartPos.x + (fieldStartSize.width - newWidth);
          newY = fieldStartPos.y + (fieldStartSize.height - newHeight);
          break;
      }
      
      return { ...field, width: newWidth, height: newHeight, x: newX, y: newY };
    }));
  };

  const handleResizeMouseUp = () => {
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Whiteout tool handlers
  const handleWhiteoutMouseDown = (e) => {
    if (!isWhiteoutMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    setIsDrawingWhiteout(true);
    setWhiteoutStartPos({ x, y });
    setCurrentWhiteoutBox({ x, y, width: 0, height: 0 });
  };

  const handleWhiteoutMouseMove = (e) => {
    if (!isDrawingWhiteout || !isWhiteoutMode) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    const width = Math.abs(x - whiteoutStartPos.x);
    const height = Math.abs(y - whiteoutStartPos.y);
    const left = Math.min(x, whiteoutStartPos.x);
    const top = Math.min(y, whiteoutStartPos.y);
    
    setCurrentWhiteoutBox({ x: left, y: top, width, height });
  };

  const handleWhiteoutMouseUp = () => {
    if (!isDrawingWhiteout || !currentWhiteoutBox) return;
    
    // Only add whiteout box if it has meaningful size
    if (currentWhiteoutBox.width > 5 && currentWhiteoutBox.height > 5) {
      const newWhiteoutBox = {
        id: Date.now().toString(),
        ...currentWhiteoutBox,
        page: pageNumber
      };
      setWhiteoutBoxes(prev => [...prev, newWhiteoutBox]);
    }
    
    setIsDrawingWhiteout(false);
    setCurrentWhiteoutBox(null);
  };

  const handleDeleteWhiteoutBox = (whiteoutId) => {
    setWhiteoutBoxes(prev => prev.filter(box => box.id !== whiteoutId));
  };

  // Add event listeners for mouse events
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingField) {
        handleFieldMouseMove(e);
      } else if (isResizing) {
        handleResizeMouseMove(e);
      } else if (isDrawingWhiteout) {
        handleWhiteoutMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingField) {
        handleFieldMouseUp();
      } else if (isResizing) {
        handleResizeMouseUp();
      } else if (isDrawingWhiteout) {
        handleWhiteoutMouseUp();
      }
    };

    if (isDraggingField || isResizing || isDrawingWhiteout) {
      window.document.addEventListener('mousemove', handleGlobalMouseMove);
      window.document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        window.document.removeEventListener('mousemove', handleGlobalMouseMove);
        window.document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingField, isResizing, isDrawingWhiteout, dragStartPos, fieldStartPos, resizeStartPos, fieldStartSize, resizeHandle, selectedField, scale, whiteoutStartPos]);

  const handleSignatureSave = async (signatureData) => {
    try {
      // Save as signature template for future use
      const templateData = {
        name: `Adopted Signature ${new Date().toLocaleDateString()}`,
        template_data: signatureData,
        signature_style: typeof signatureData === 'string' ? 'drawn' : 'typed'
      };
      
      await signaturesAPI.templates.create(templateData);
      
      // Reload signature templates
      await loadSignatureTemplates();
    } catch (err) {
      console.error('Error saving signature template:', err);
    }
    
    if (editingField) {
      setFields(prev => prev.map(f => 
        f.id === editingField.id 
          ? { ...f, value: signatureData, completed: true }
          : f
      ));
      setSignatureCreatorOpen(false);
      setAdoptDialogOpen(false);
      setFieldDialogOpen(false);
      setEditingField(null);
    }
  };

  const handleFieldValueChange = (fieldId, value) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId 
        ? { ...f, value, completed: !!value }
        : f
    ));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedDocument = {
        ...document,
        fields: fields,
        status: 'pending'
      };

      await documentsAPI.update(document.id, updatedDocument);
      onSave(updatedDocument);
      onClose();
    } catch (err) {
      setError('Failed to save document');
      console.error('Error saving document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendForSigning = () => {
    setWorkflowDialogOpen(true);
  };


  const renderWhiteoutBox = (whiteoutBox) => {
    return (
      <Box
        key={whiteoutBox.id}
        sx={{
          position: 'absolute',
          left: whiteoutBox.x * scale,
          top: whiteoutBox.y * scale,
          width: whiteoutBox.width * scale,
          height: whiteoutBox.height * scale,
          backgroundColor: 'white',
          border: '1px dashed #FF5722',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(255, 87, 34, 0.1)'
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Delete this whiteout box?')) {
            handleDeleteWhiteoutBox(whiteoutBox.id);
          }
        }}
        title="Click to delete whiteout box"
      />
    );
  };

  const renderField = (field) => {
    const config = FIELD_TYPE_CONFIG[field.type];
    const isSelected = selectedField === field.id;
    
    return (
      <Box
        key={field.id}
        onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
        onClick={(e) => {
          e.stopPropagation();
          handleFieldClick(field.id);
        }}
        sx={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale,
          width: field.width * scale,
          height: field.height * scale,
          border: `2px solid ${isSelected ? '#1976d2' : config.color}`,
          borderRadius: 1,
          backgroundColor: field.completed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          cursor: isDraggingField ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.1)'
          }
        }}
      >
        {/* Signing order indicator */}
        <Chip
          label={`#${field.signingOrder || 1}`}
          size="small"
          color="primary"
          variant="filled"
          sx={{
            position: 'absolute',
            top: -8,
            left: -8,
            fontSize: '0.7rem',
            height: 16,
            minWidth: 20
          }}
        />
        
        {field.completed ? (
          <Chip
            label={field.type === FIELD_TYPES.SIGNATURE ? 'Signed' : field.value}
            size="small"
            color="success"
            variant="outlined"
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            {config.label}
          </Typography>
        )}
        
        {/* Resize handles - only show when selected */}
        {isSelected && (
          <>
            {/* Southeast handle */}
            <Box
              onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')}
              sx={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 8,
                height: 8,
                backgroundColor: '#1976d2',
                border: '1px solid white',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 10
              }}
            />
            
            {/* Southwest handle */}
            <Box
              onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')}
              sx={{
                position: 'absolute',
                bottom: -4,
                left: -4,
                width: 8,
                height: 8,
                backgroundColor: '#1976d2',
                border: '1px solid white',
                borderRadius: '50%',
                cursor: 'sw-resize',
                zIndex: 10
              }}
            />
            
            {/* Northeast handle */}
            <Box
              onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')}
              sx={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                backgroundColor: '#1976d2',
                border: '1px solid white',
                borderRadius: '50%',
                cursor: 'ne-resize',
                zIndex: 10
              }}
            />
            
            {/* Northwest handle */}
            <Box
              onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')}
              sx={{
                position: 'absolute',
                top: -4,
                left: -4,
                width: 8,
                height: 8,
                backgroundColor: '#1976d2',
                border: '1px solid white',
                borderRadius: '50%',
                cursor: 'nw-resize',
                zIndex: 10
              }}
            />
          </>
        )}
      </Box>
    );
  };

  if (!document) {
  return null;
  }


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
          Edit Document: {document?.title || 'Untitled Document'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<UndoIcon />}
            disabled
            size="small"
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            startIcon={<RedoIcon />}
            disabled
            size="small"
          >
            Redo
          </Button>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={loading}
            size="small"
          >
            {loading ? <CircularProgress size={16} /> : 'Save'}
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSendForSigning}
            disabled={loading || fields.length === 0}
            size="small"
          >
            Send for Signing
          </Button>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
        {/* Field Palette */}
        <Paper sx={{ 
          width: 250, 
          p: 2, 
          borderRight: 1, 
          borderColor: 'divider',
          overflow: 'auto'
        }}>
          <Typography variant="h6" gutterBottom>
            Add Fields
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag fields to the document
          </Typography>
          
          {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => (
            <Box
              key={type}
              draggable={type !== FIELD_TYPES.WHITEOUT}
              onDragStart={type !== FIELD_TYPES.WHITEOUT ? (e) => handleFieldDragStart(type, e) : undefined}
              onDragEnd={type !== FIELD_TYPES.WHITEOUT ? handleFieldDragEnd : undefined}
              onClick={type === FIELD_TYPES.WHITEOUT ? () => {
                setIsWhiteoutMode(!isWhiteoutMode);
                setDragField(null); // Clear any selected field type
              } : undefined}
              sx={{
                p: 2,
                mb: 1,
                border: 1,
                borderColor: type === FIELD_TYPES.WHITEOUT && isWhiteoutMode ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: type === FIELD_TYPES.WHITEOUT ? 'pointer' : 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                backgroundColor: type === FIELD_TYPES.WHITEOUT && isWhiteoutMode ? 'primary.light' : 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <Box sx={{ color: config.color }}>
                {config.icon}
              </Box>
              <Typography variant="body2">
                {config.label}
                {type === FIELD_TYPES.WHITEOUT && isWhiteoutMode && ' (Active)'}
              </Typography>
            </Box>
          ))}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Whiteout Boxes ({whiteoutBoxes.filter(box => box.page === pageNumber).length})
          </Typography>
          {whiteoutBoxes
            .filter(box => box.page === pageNumber)
            .map(whiteoutBox => (
              <Box
                key={whiteoutBox.id}
                sx={{
                  p: 1,
                  mb: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
                onClick={() => {
                  if (window.confirm('Delete this whiteout box?')) {
                    handleDeleteWhiteoutBox(whiteoutBox.id);
                  }
                }}
              >
                <Typography variant="caption" display="block">
                  Whiteout Box
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(whiteoutBox.width)} × {Math.round(whiteoutBox.height)}px
                </Typography>
              </Box>
            ))}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Fields ({fields.length})
          </Typography>
          {fields.map(field => (
            <Box
              key={field.id}
              sx={{
                p: 1,
                mb: 1,
                border: 1,
                borderColor: selectedField === field.id ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                backgroundColor: selectedField === field.id ? 'primary.light' : 'transparent'
              }}
              onClick={() => setSelectedField(field.id)}
            >
              <Typography variant="caption" display="block">
                {FIELD_TYPE_CONFIG[field.type].label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Page {field.page}
              </Typography>
            </Box>
          ))}
        </Paper>

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
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2">
              Page {pageNumber} of {numPages}
            </Typography>
          </Box>

          {/* PDF Viewer */}
          <Box           sx={{ 
            flex: 1, 
            overflow: 'auto', 
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDragOver ? 'rgba(25, 118, 210, 0.1)' : '#f5f5f5',
            minHeight: 0, // Allow flex shrinking
            position: 'relative',
            border: isDragOver ? '2px dashed #1976d2' : 'none',
            transition: 'all 0.2s ease'
          }}
          onClick={(e) => {
            // Only add field if we're not dragging/resizing, not in whiteout mode, and have a field type selected
            if (!isDraggingField && !isResizing && !isWhiteoutMode && dragField && e.target === e.currentTarget) {
              addFieldAtPosition(e, e.currentTarget);
            }
          }}
          onMouseDown={(e) => {
            if (isWhiteoutMode && e.target === e.currentTarget) {
              handleWhiteoutMouseDown(e);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (e.target === e.currentTarget) {
              setIsDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const fieldType = e.dataTransfer.getData('text/plain');
            if (fieldType) {
              setDragField(fieldType);
              addFieldAtPosition(e, e.currentTarget);
            }
          }}
          >
            <UniversalDocumentViewer
              document={document}
              zoom={scale}
              onZoomChange={setScale}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error('Document load error:', error);
                console.error('Attempted to load file:', document?.file_url || document?.file_path || document?.url);
                setError(`Failed to load document: ${error.message || 'Unknown error'}`);
              }}
            />
              
              {/* Render whiteout boxes for current page */}
              {whiteoutBoxes
                .filter(box => box.page === pageNumber)
                .map(renderWhiteoutBox)}
              
              {/* Render current whiteout box being drawn */}
              {currentWhiteoutBox && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: currentWhiteoutBox.x * scale,
                    top: currentWhiteoutBox.y * scale,
                    width: currentWhiteoutBox.width * scale,
                    height: currentWhiteoutBox.height * scale,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    border: '2px dashed #FF5722',
                    pointerEvents: 'none'
                  }}
                />
              )}
              
              {/* Render fields for current page */}
              {fields
                .filter(field => field.page === pageNumber)
                .map(renderField)}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      {/* Signature Creator */}
      <SignatureCreator
        open={signatureCreatorOpen || adoptDialogOpen}
        onClose={() => { setSignatureCreatorOpen(false); setAdoptDialogOpen(false); }}
        onSave={handleSignatureSave}
        existingSignature={editingField?.value}
      />

      {/* Field Properties Dialog */}
      <Dialog
        open={fieldDialogOpen}
        onClose={() => setFieldDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Field Properties</DialogTitle>
        <DialogContent>
          {editingField && (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Field Label"
                value={editingField.label || ''}
                onChange={(e) => setEditingField(prev => ({ ...prev, label: e.target.value }))}
                sx={{ mb: 2 }}
              />
              
              {editingField.type === FIELD_TYPES.TEXT && (
                <TextField
                  fullWidth
                  label="Default Value"
                  value={editingField.value || ''}
                  onChange={(e) => handleFieldValueChange(editingField.id, e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
              
              {editingField.type === FIELD_TYPES.DATE && (
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={editingField.value || new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleFieldValueChange(editingField.id, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                />
              )}

              {editingField.type === FIELD_TYPES.CHECKBOX && (
                <FormControlLabel
                  control={
                    <MUICheckbox
                      checked={!!editingField.value}
                      onChange={(e) => handleFieldValueChange(editingField.id, e.target.checked)}
                    />
                  }
                  label="Default Checked"
                  sx={{ mb: 2 }}
                />
              )}

              {(editingField.type === FIELD_TYPES.RADIO || editingField.type === FIELD_TYPES.DROPDOWN) && (
                <Box>
                  {editingField.type === FIELD_TYPES.RADIO && (
                    <TextField
                      fullWidth
                      label="Group Name"
                      value={editingField.groupName || ''}
                      onChange={(e) => setEditingField(prev => ({ ...prev, groupName: e.target.value }))}
                      sx={{ mb: 2 }}
                    />
                  )}
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Options (one per line)"
                    value={(editingField.options || []).join('\n')}
                    onChange={(e) => setEditingField(prev => ({ ...prev, options: e.target.value.split('\n').filter(Boolean) }))}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Default Value"
                    value={editingField.value || ''}
                    onChange={(e) => handleFieldValueChange(editingField.id, e.target.value)}
                    helperText="Must match one of the options"
                    sx={{ mb: 2 }}
                  />
                </Box>
              )}

              {editingField.type === FIELD_TYPES.NAME && (
                <TextField
                  fullWidth
                  label="Prefilled Name"
                  value={editingField.value || ''}
                  onChange={(e) => handleFieldValueChange(editingField.id, e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}

              {editingField.type === FIELD_TYPES.EMAIL && (
                <TextField
                  fullWidth
                  type="email"
                  label="Prefilled Email"
                  value={editingField.value || ''}
                  onChange={(e) => handleFieldValueChange(editingField.id, e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}

              {editingField.type === FIELD_TYPES.ATTACHMENT && (
                <Box>
                  <TextField
                    fullWidth
                    label="Allowed File Types (comma-separated, e.g. pdf,jpg,docx)"
                    value={editingField.allowedFileTypes || ''}
                    onChange={(e) => setEditingField(prev => ({ ...prev, allowedFileTypes: e.target.value }))}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Max File Size (MB)"
                    value={editingField.maxFileSizeMb || 10}
                    onChange={(e) => setEditingField(prev => ({ ...prev, maxFileSizeMb: parseInt(e.target.value) || 1 }))}
                    inputProps={{ min: 1 }}
                    sx={{ mb: 2 }}
                  />
                </Box>
              )}
              
              {editingField.type === FIELD_TYPES.SIGNATURE && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<SignatureIcon />}
                  onClick={() => setSignatureCreatorOpen(true)}
                  sx={{ mb: 2 }}
                >
                  {editingField.completed ? 'Update Signature' : 'Add Signature'}
                </Button>
              )}

              <TextField
                fullWidth
                label="Signing Order"
                type="number"
                value={editingField?.signingOrder || 1}
                onChange={(e) => setEditingField(prev => ({ ...prev, signingOrder: parseInt(e.target.value) || 1 }))}
                inputProps={{ min: 1, max: 99 }}
                helperText="Order in which this field should be signed (1 = first, 2 = second, etc.)"
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <MUICheckbox
                    checked={!!editingField.required}
                    onChange={(e) => setEditingField(prev => ({ ...prev, required: e.target.checked }))}
                  />
                }
                label="Required"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Signing Order"
                type="number"
                value={editingField?.signingOrder || 1}
                onChange={(e) => setEditingField(prev => ({ ...prev, signingOrder: parseInt(e.target.value) || 1 }))}
                inputProps={{ min: 1 }}
                sx={{ mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            color="error"
            onClick={() => {
              handleFieldDelete(editingField?.id);
              setFieldDialogOpen(false);
              setEditingField(null);
            }}
          >
            Delete
          </Button>
          <Button onClick={() => setFieldDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workflow Dialog */}
      <Dialog
        open={workflowDialogOpen}
        onClose={() => setWorkflowDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Send Document for Signing</DialogTitle>
        <DialogContent>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Signing Order Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Fields are assigned signing order numbers. In the workflow, you'll map email addresses to these signing order numbers.
              </Typography>
              {fields.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No fields added yet. Drag and drop fields onto the document to create signing order.
                </Typography>
              ) : (
                <Box>
                  {fields
                    .sort((a, b) => (a.signingOrder || 0) - (b.signingOrder || 0))
                    .map((field, index) => (
                    <Box key={field.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip 
                        label={`Order ${field.signingOrder || 1}`} 
                        size="small" 
                        color="primary" 
                        sx={{ mr: 1, minWidth: 60 }}
                      />
                      <Typography variant="body2">
                        {FIELD_TYPE_CONFIG[field.type]?.label || field.type} field
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              // TODO: Implement sending workflow
              setWorkflowDialogOpen(false);
            }}
            disabled={signers.length === 0}
          >
            Send Document
          </Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
    </Dialog>
  );
}

