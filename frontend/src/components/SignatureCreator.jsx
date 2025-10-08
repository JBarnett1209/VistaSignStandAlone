import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Alert,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as DrawIcon,
  TextFields as TypeIcon,
  CloudUpload as UploadIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';

const SIGNATURE_METHODS = {
  DRAW: 'draw',
  TYPE: 'type',
  UPLOAD: 'upload'
};

const FONT_FAMILIES = [
  'Allura',
  'Great Vibes',
  'Dancing Script',
  'Pacifico',
  'Satisfy',
  'Kalam',
  'Caveat',
  'Amatic SC',
  'Indie Flower',
  'Shadows Into Light'
];

export default function SignatureCreator({ open, onClose, onSave, existingSignature = null }) {
  const [activeTab, setActiveTab] = useState(0);
  const [signatureMethod, setSignatureMethod] = useState(SIGNATURE_METHODS.DRAW);
  const [typedSignature, setTypedSignature] = useState('');
  const [selectedFont, setSelectedFont] = useState('Dancing Script');
  const [fontSize, setFontSize] = useState(40);
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const signatureCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize with existing signature if provided
  React.useEffect(() => {
    if (existingSignature && open) {
      if (existingSignature.startsWith('data:image')) {
        // It's a drawn signature
        setSignatureMethod(SIGNATURE_METHODS.DRAW);
        setActiveTab(0);
        // Load the signature into canvas
        setTimeout(() => {
          if (signatureCanvasRef.current) {
            signatureCanvasRef.current.fromDataURL(existingSignature);
          }
        }, 100);
      } else {
        // It's a typed signature
        setSignatureMethod(SIGNATURE_METHODS.TYPE);
        setActiveTab(1);
        setTypedSignature(existingSignature);
      }
    }
  }, [existingSignature, open]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSignatureMethod(Object.values(SIGNATURE_METHODS)[newValue]);
    setError(null);
  };

  const handleDrawSignature = () => {
    setSignatureMethod(SIGNATURE_METHODS.DRAW);
    setActiveTab(0);
  };

  const handleTypeSignature = () => {
    setSignatureMethod(SIGNATURE_METHODS.TYPE);
    setActiveTab(1);
  };

  const handleUploadSignature = () => {
    setSignatureMethod(SIGNATURE_METHODS.UPLOAD);
    setActiveTab(2);
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('File size must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearSignature = () => {
    if (signatureMethod === SIGNATURE_METHODS.DRAW) {
      signatureCanvasRef.current?.clear();
    } else if (signatureMethod === SIGNATURE_METHODS.TYPE) {
      setTypedSignature('');
    } else if (signatureMethod === SIGNATURE_METHODS.UPLOAD) {
      setUploadedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    setError(null);
  };

  const getSignatureData = () => {
    switch (signatureMethod) {
      case SIGNATURE_METHODS.DRAW:
        if (signatureCanvasRef.current?.isEmpty()) {
          setError('Please draw your signature');
          return null;
        }
        return signatureCanvasRef.current.toDataURL();
      
      case SIGNATURE_METHODS.TYPE:
        if (!typedSignature.trim()) {
          setError('Please type your signature');
          return null;
        }
        return {
          type: 'typed',
          text: typedSignature,
          font: selectedFont,
          size: fontSize,
          color: signatureColor
        };
      
      case SIGNATURE_METHODS.UPLOAD:
        if (!uploadedImage) {
          setError('Please upload a signature image');
          return null;
        }
        return uploadedImage;
      
      default:
        return null;
    }
  };

  const handleSave = async () => {
    setError(null);
    const signatureData = getSignatureData();
    
    if (!signatureData) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(signatureData);
      onClose();
    } catch (err) {
      setError('Failed to save signature');
      console.error('Error saving signature:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderDrawSignature = () => (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Draw your signature in the box below
      </Typography>
      <Paper 
        sx={{ 
          border: 2, 
          borderColor: 'divider', 
          borderRadius: 1, 
          p: 1,
          display: 'inline-block'
        }}
      >
        <SignatureCanvas
          ref={signatureCanvasRef}
          canvasProps={{
            width: 500,
            height: 200,
            className: 'signature-canvas',
            style: { 
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff'
            }
          }}
          backgroundColor="white"
          penColor="#000000"
        />
      </Paper>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
        <Button
          size="small"
          startIcon={<ClearIcon />}
          onClick={clearSignature}
        >
          Clear
        </Button>
        <Button
          size="small"
          startIcon={<UndoIcon />}
          onClick={() => signatureCanvasRef.current?.undo()}
        >
          Undo
        </Button>
      </Box>
    </Box>
  );

  const renderTypeSignature = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Type your signature and customize its appearance
      </Typography>
      
      <TextField
        fullWidth
        label="Your Signature"
        value={typedSignature}
        onChange={(e) => setTypedSignature(e.target.value)}
        placeholder="Enter your full name"
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Font Family</InputLabel>
          <Select
            value={selectedFont}
            label="Font Family"
            onChange={(e) => setSelectedFont(e.target.value)}
          >
            {FONT_FAMILIES.map(font => (
              <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
                {font}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Font Size"
          type="number"
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value) || 40)}
          inputProps={{ min: 20, max: 80 }}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography gutterBottom>Color</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['#000000', '#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2'].map(color => (
            <Box
              key={color}
              onClick={() => setSignatureColor(color)}
              sx={{
                width: 40,
                height: 40,
                backgroundColor: color,
                border: signatureColor === color ? '3px solid #1976d2' : '1px solid #ccc',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 }
              }}
            />
          ))}
        </Box>
      </Box>

      {typedSignature && (
        <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: selectedFont,
              fontSize: fontSize,
              color: signatureColor,
              fontStyle: 'italic'
            }}
          >
            {typedSignature}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Preview
          </Typography>
        </Paper>
      )}
    </Box>
  );

  const renderUploadSignature = () => (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload an image of your signature
      </Typography>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {!uploadedImage ? (
        <Paper
          sx={{
            border: 2,
            borderColor: 'divider',
            borderStyle: 'dashed',
            borderRadius: 1,
            p: 4,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'action.hover' }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Click to upload signature
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PNG, JPG, or GIF up to 2MB
          </Typography>
        </Paper>
      ) : (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <img
              src={uploadedImage}
              alt="Uploaded signature"
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                objectFit: 'contain'
              }}
            />
          </Paper>
          <Button
            startIcon={<ClearIcon />}
            onClick={clearSignature}
          >
            Remove Image
          </Button>
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 600 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {existingSignature ? 'Edit Signature' : 'Create Signature'}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            centered
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<DrawIcon />}
              label="Draw"
              iconPosition="start"
            />
            <Tab
              icon={<TypeIcon />}
              label="Type"
              iconPosition="start"
            />
            <Tab
              icon={<UploadIcon />}
              label="Upload"
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {activeTab === 0 && renderDrawSignature()}
        {activeTab === 1 && renderTypeSignature()}
        {activeTab === 2 && renderUploadSignature()}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Signature'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
