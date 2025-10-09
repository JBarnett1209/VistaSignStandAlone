import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  Grid,
  Chip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Edit as SignatureIcon
} from '@mui/icons-material';
import SignatureCreator from './SignatureCreator';
import { authAPI } from '../services/api';
import ConfirmationDialog from './ConfirmationDialog';

export default function SignatureManager() {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signatureCreatorOpen, setSignatureCreatorOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [signatureToDelete, setSignatureToDelete] = useState(null);

  // Load user signatures
  useEffect(() => {
    loadSignatures();
    // Allow external pages to open the creator
    const open = () => setSignatureCreatorOpen(true);
    window.addEventListener('open-signature-creator', open);
    return () => window.removeEventListener('open-signature-creator', open);
  }, []);

  const loadSignatures = async () => {
    try {
      setLoading(true);
      // This would be an API call to get user's saved signatures
      // For now, we'll use localStorage as a placeholder
      const savedSignatures = JSON.parse(localStorage.getItem('userSignatures') || '[]');
      setSignatures(savedSignatures);
    } catch (err) {
      setError('Failed to load signatures');
      console.error('Error loading signatures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureData) => {
    try {
      const newSignature = {
        id: Date.now().toString(),
        data: signatureData,
        createdAt: new Date().toISOString(),
        name: `Signature ${signatures.length + 1}`
      };

      const updatedSignatures = editingSignature
        ? signatures.map(sig => sig.id === editingSignature.id ? { ...sig, data: signatureData } : sig)
        : [...signatures, newSignature];

      setSignatures(updatedSignatures);
      localStorage.setItem('userSignatures', JSON.stringify(updatedSignatures));
      
      setSignatureCreatorOpen(false);
      setEditingSignature(null);
    } catch (err) {
      setError('Failed to save signature');
      console.error('Error saving signature:', err);
    }
  };

  const handleDeleteSignature = async () => {
    try {
      const updatedSignatures = signatures.filter(sig => sig.id !== signatureToDelete.id);
      setSignatures(updatedSignatures);
      localStorage.setItem('userSignatures', JSON.stringify(updatedSignatures));
      setDeleteDialogOpen(false);
      setSignatureToDelete(null);
    } catch (err) {
      setError('Failed to delete signature');
      console.error('Error deleting signature:', err);
    }
  };

  const openDeleteDialog = (signature) => {
    setSignatureToDelete(signature);
    setDeleteDialogOpen(true);
  };

  const renderSignaturePreview = (signature) => {
    if (typeof signature.data === 'string' && signature.data.startsWith('data:image')) {
      // Drawn or uploaded signature
      return (
        <img
          src={signature.data}
          alt="Signature preview"
          style={{
            maxWidth: '100%',
            maxHeight: 60,
            objectFit: 'contain',
            border: '1px solid #ddd',
            borderRadius: 4
          }}
        />
      );
    } else if (signature.data && signature.data.type === 'typed') {
      // Typed signature
      return (
        <Box
          sx={{
            fontFamily: `'${signature.data.font}', cursive`,
            fontSize: Math.min(24, signature.data.size || 20),
            color: signature.data.color,
            fontStyle: 'italic',
            textAlign: 'center',
            py: 1,
            border: '1px solid #ddd',
            borderRadius: 1,
            backgroundColor: '#f9f9f9',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {signature.data.text}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, width: '100%' }}>
        <Typography variant="h5">
          My Signatures
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setSignatureCreatorOpen(true)}
        >
          Add Signature
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {signatures.length === 0 ? (
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <SignatureIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No signatures yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first signature to get started with document signing
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setSignatureCreatorOpen(true)}
            >
              Add Signature
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start" sx={{ width: '100%' }}>
          {signatures.map((signature) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={3} key={signature.id}>
              <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      {signature.name}
                    </Typography>
                    <Chip
                      label={typeof signature.data === 'string' ? 'Drawn' : 'Typed'}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden' }}>
                    {renderSignaturePreview(signature)}
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                    Created: {new Date(signature.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                
                <Divider sx={{ mt: 'auto' }} />
                
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setEditingSignature(signature);
                      setSignatureCreatorOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => openDeleteDialog(signature)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Signature Creator */}
      <SignatureCreator
        open={signatureCreatorOpen}
        onClose={() => {
          setSignatureCreatorOpen(false);
          setEditingSignature(null);
        }}
        onSave={handleSaveSignature}
        existingSignature={editingSignature?.data}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteSignature}
        title="Delete Signature"
        message={`Are you sure you want to delete "${signatureToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </Box>
  );
}
