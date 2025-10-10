import React, { useState, useRef, useEffect } from 'react';
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
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Type as TypeIcon,
  Gesture as DrawIcon,
  CheckCircle as AdoptIcon
} from '@mui/icons-material';

const SignatureCapture = ({ 
  open, 
  onClose, 
  onSubmit, 
  loading = false,
  fieldInfo = null 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [typedSignature, setTypedSignature] = useState('');
  const [drawnSignature, setDrawnSignature] = useState('');
  const [adoptedSignature, setAdoptedSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');
  
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 200 });

  useEffect(() => {
    if (open && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      
      // Set drawing styles
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [open, canvasSize]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
  };

  const startDrawing = (event) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
  };

  const draw = (event) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Convert canvas to data URL
      const canvas = canvasRef.current;
      setDrawnSignature(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnSignature('');
  };

  const handleSubmit = () => {
    let signatureData = null;
    let signatureType = '';

    switch (activeTab) {
      case 0: // Type
        if (!typedSignature.trim()) {
          setError('Please enter your signature');
          return;
        }
        signatureData = {
          type: 'typed',
          text: typedSignature.trim(),
          font: 'cursive',
          size: 18
        };
        signatureType = 'Typed Signature';
        break;
        
      case 1: // Draw
        if (!drawnSignature) {
          setError('Please draw your signature');
          return;
        }
        signatureData = {
          type: 'drawn',
          image: drawnSignature,
          width: canvasSize.width,
          height: canvasSize.height
        };
        signatureType = 'Drawn Signature';
        break;
        
      case 2: // Adopt
        if (!adoptedSignature.trim()) {
          setError('Please enter your name to adopt');
          return;
        }
        signatureData = {
          type: 'adopted',
          text: adoptedSignature.trim(),
          font: 'cursive',
          size: 18,
          adopted: true
        };
        signatureType = 'Adopted Signature';
        break;
        
      default:
        setError('Please select a signature method');
        return;
    }

    setError('');
    onSubmit({
      ...signatureData,
      signatureType,
      timestamp: new Date().toISOString(),
      fieldId: fieldInfo?.id
    });
  };

  const getCurrentSignature = () => {
    switch (activeTab) {
      case 0: return typedSignature;
      case 1: return drawnSignature;
      case 2: return adoptedSignature;
      default: return '';
    }
  };

  const hasSignature = () => {
    const current = getCurrentSignature();
    return current && current.trim() !== '';
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {fieldInfo ? `Sign Field: ${fieldInfo.type || 'Signature'}` : 'Sign Document'}
          </Typography>
          <IconButton onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{ mb: 3 }}
          variant="fullWidth"
        >
          <Tab 
            icon={<TypeIcon />} 
            label="Type" 
            iconPosition="start"
          />
          <Tab 
            icon={<DrawIcon />} 
            label="Draw" 
            iconPosition="start"
          />
          <Tab 
            icon={<AdoptIcon />} 
            label="Adopt" 
            iconPosition="start"
          />
        </Tabs>

        {/* Type Signature */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Type your full name to create a typed signature:
            </Typography>
            <TextField
              fullWidth
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder="Enter your full name"
              variant="outlined"
              sx={{ 
                '& .MuiInputBase-input': { 
                  fontFamily: 'cursive',
                  fontSize: '20px',
                  textAlign: 'center'
                }
              }}
            />
            {typedSignature && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                border: '1px solid #ddd', 
                borderRadius: 1,
                backgroundColor: '#f9f9f9',
                textAlign: 'center'
              }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontFamily: 'cursive',
                    color: '#7B5CFF'
                  }}
                >
                  {typedSignature}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Signature Preview
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Draw Signature */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Draw your signature using your mouse or touch:
            </Typography>
            <Box sx={{ 
              border: '2px dashed #ddd', 
              borderRadius: 1,
              p: 1,
              backgroundColor: '#fff',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'crosshair',
                  backgroundColor: '#fff'
                }}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={clearCanvas}
                disabled={loading}
              >
                Clear
              </Button>
            </Box>
            {drawnSignature && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                border: '1px solid #ddd', 
                borderRadius: 1,
                backgroundColor: '#f9f9f9',
                textAlign: 'center'
              }}>
                <img 
                  src={drawnSignature} 
                  alt="Signature Preview" 
                  style={{ maxWidth: '200px', maxHeight: '100px' }}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Signature Preview
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Adopt Signature */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your name to adopt this signature (legally binding):
            </Typography>
            <TextField
              fullWidth
              value={adoptedSignature}
              onChange={(e) => setAdoptedSignature(e.target.value)}
              placeholder="Enter your full name"
              variant="outlined"
              sx={{ 
                '& .MuiInputBase-input': { 
                  fontFamily: 'cursive',
                  fontSize: '20px',
                  textAlign: 'center'
                }
              }}
            />
            {adoptedSignature && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                border: '2px solid #4CAF50', 
                borderRadius: 1,
                backgroundColor: '#e8f5e8',
                textAlign: 'center'
              }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontFamily: 'cursive',
                    color: '#2E7D32'
                  }}
                >
                  {adoptedSignature}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Adopted Signature (Legally Binding)
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !hasSignature()}
          startIcon={loading ? <CircularProgress size={20} /> : <EditIcon />}
        >
          {loading ? 'Signing...' : 'Sign Field'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SignatureCapture;
