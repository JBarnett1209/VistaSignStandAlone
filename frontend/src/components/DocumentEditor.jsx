import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Tooltip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Grid
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
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
  Send as SendIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCreator from './SignatureCreator';
import { documentsAPI } from '../services/api';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FIELD_TYPES = {
  SIGNATURE: 'signature',
  DATE: 'date',
  INITIALS: 'initials',
  TEXT: 'text'
};

const SIGNING_ROLES = {
  SIGNER: 'signer',
  APPROVER: 'approver',
  RECIPIENT: 'recipient'
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
  }
};

export default function DocumentEditor({ document, onClose, onSave }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragField, setDragField] = useState(null);
  const [signatureCreatorOpen, setSignatureCreatorOpen] = useState(false);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signers, setSigners] = useState([]);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load document fields and signers on mount
  useEffect(() => {
    console.log('DocumentEditor - Document data:', document);
    if (document?.fields) {
      setFields(document.fields);
    }
    if (document?.signers) {
      setSigners(document.signers);
    }
  }, [document]);

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
    event.preventDefault();
    setIsDragging(true);
    setDragField(fieldType);
  };

  const handleCanvasClick = (event) => {
    if (!isDragging || !dragField) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newField = {
      id: Date.now().toString(),
      type: dragField,
      x: x / scale,
      y: y / scale,
      page: pageNumber,
      width: FIELD_TYPE_CONFIG[dragField].width,
      height: FIELD_TYPE_CONFIG[dragField].height,
      value: '',
      required: true,
      completed: false,
      assignedSigner: null,
      signingOrder: 1
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
      setFieldDialogOpen(true);
    }
  };

  const handleFieldDelete = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedField === fieldId) {
      setSelectedField(null);
    }
  };

  const handleSignatureSave = (signatureData) => {
    if (editingField) {
      setFields(prev => prev.map(f => 
        f.id === editingField.id 
          ? { ...f, value: signatureData, completed: true }
          : f
      ));
      setSignatureCreatorOpen(false);
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
        signers: signers,
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

  const addSigner = (signer) => {
    setSigners(prev => [...prev, { ...signer, id: Date.now().toString() }]);
  };

  const removeSigner = (signerId) => {
    setSigners(prev => prev.filter(s => s.id !== signerId));
    // Remove signer assignment from fields
    setFields(prev => prev.map(f => 
      f.assignedSigner === signerId 
        ? { ...f, assignedSigner: null }
        : f
    ));
  };

  const updateSignerOrder = (signerId, newOrder) => {
    setSigners(prev => prev.map(s => 
      s.id === signerId 
        ? { ...s, order: newOrder }
        : s
    ));
  };

  const renderField = (field) => {
    const config = FIELD_TYPE_CONFIG[field.type];
    const isSelected = selectedField === field.id;
    
    return (
      <Box
        key={field.id}
        onClick={() => handleFieldClick(field.id)}
        sx={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale,
          width: field.width * scale,
          height: field.height * scale,
          border: `2px solid ${isSelected ? '#1976d2' : config.color}`,
          borderRadius: 1,
          backgroundColor: field.completed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.1)'
          }
        }}
      >
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
              draggable
              onDragStart={(e) => handleFieldDragStart(type, e)}
              sx={{
                p: 2,
                mb: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
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
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            p: 2,
            display: 'flex',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5'
          }}>
            <Box sx={{ position: 'relative' }}>
              <Document
                file={document?.file_url || document?.file_path || document?.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setError('Failed to load PDF document');
                }}
                loading={<CircularProgress />}
                error={
                  <Box sx={{ textAlign: 'center', p: 4 }}>
                    <Typography color="error">
                      Failed to load PDF document
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Please check if the document file exists and is accessible.
                    </Typography>
                  </Box>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  canvasRef={canvasRef}
                  onClick={handleCanvasClick}
                />
              </Document>
              
              {/* Render fields for current page */}
              {fields
                .filter(field => field.page === pageNumber)
                .map(renderField)}
            </Box>
          </Box>
        </Box>
        </Box>
      </DialogContent>

      {/* Signature Creator */}
      <SignatureCreator
        open={signatureCreatorOpen}
        onClose={() => setSignatureCreatorOpen(false)}
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

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Assigned Signer</InputLabel>
                <Select
                  value={editingField?.assignedSigner || ''}
                  label="Assigned Signer"
                  onChange={(e) => setEditingField(prev => ({ ...prev, assignedSigner: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>No signer assigned</em>
                  </MenuItem>
                  {signers.map(signer => (
                    <MenuItem key={signer.id} value={signer.id}>
                      {signer.name} ({signer.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

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
          <WorkflowManager
            signers={signers}
            fields={fields}
            onAddSigner={addSigner}
            onRemoveSigner={removeSigner}
            onUpdateSignerOrder={updateSignerOrder}
          />
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

// Workflow Manager Component
function WorkflowManager({ signers, fields, onAddSigner, onRemoveSigner, onUpdateSignerOrder }) {
  const [newSigner, setNewSigner] = useState({ name: '', email: '', role: 'signer', order: 1 });
  const [addSignerOpen, setAddSignerOpen] = useState(false);

  const handleAddSigner = () => {
    if (newSigner.name && newSigner.email) {
      onAddSigner(newSigner);
      setNewSigner({ name: '', email: '', role: 'signer', order: signers.length + 1 });
      setAddSignerOpen(false);
    }
  };

  const getSignerFieldCount = (signerId) => {
    return fields.filter(f => f.assignedSigner === signerId).length;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Signers ({signers.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddSignerOpen(true)}
        >
          Add Signer
        </Button>
      </Box>

      {signers.length === 0 ? (
        <Alert severity="info">
          No signers added yet. Add signers to send the document for signing.
        </Alert>
      ) : (
        <List>
          {signers
            .sort((a, b) => (a.order || 1) - (b.order || 1))
            .map((signer, index) => (
            <ListItem key={signer.id} divider>
              <ListItemText
                primary={`${index + 1}. ${signer.name}`}
                secondary={`${signer.email} • ${getSignerFieldCount(signer.id)} fields assigned`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => onRemoveSigner(signer.id)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Add Signer Dialog */}
      <Dialog
        open={addSignerOpen}
        onClose={() => setAddSignerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Signer</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={newSigner.name}
            onChange={(e) => setNewSigner(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={newSigner.email}
            onChange={(e) => setNewSigner(prev => ({ ...prev, email: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={newSigner.role}
              label="Role"
              onChange={(e) => setNewSigner(prev => ({ ...prev, role: e.target.value }))}
            >
              <MenuItem value="signer">Signer</MenuItem>
              <MenuItem value="approver">Approver</MenuItem>
              <MenuItem value="recipient">Recipient</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Signing Order"
            type="number"
            value={newSigner.order}
            onChange={(e) => setNewSigner(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSignerOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddSigner}>
            Add Signer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
