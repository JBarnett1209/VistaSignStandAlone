import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  // Card,
  // CardContent,
  // CardActions,
  // IconButton,
  Alert,
  // Grid,
  Chip,
  // Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Edit as SignatureIcon
} from '@mui/icons-material';
import SignatureCreator from './SignatureCreator';
import { signaturesAPI } from '../services/api';
import ConfirmationDialog from './ConfirmationDialog';

export default function SignatureManager() {
  const [signatures, setSignatures] = useState([]);
  const [, setLoading] = useState(false);
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
      const response = await signaturesAPI.templates.list();
      setSignatures(response.data || []);
    } catch (err) {
      setError('Failed to load signatures');
      console.error('Error loading signatures:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureData) => {
    try {
      // Create signature template data for the API
      const templateData = {
        name: `Signature ${signatures.length + 1}`,
        template_data: signatureData,
        signature_style: typeof signatureData === 'string' ? 'drawn' : 'typed'
      };

      if (editingSignature) {
        // Update existing signature template - need to add this endpoint
        await signaturesAPI.templates.update(editingSignature.id, templateData);
      } else {
        // Create new signature template
        await signaturesAPI.templates.create(templateData);
      }

      // Reload signatures from API
      await loadSignatures();
      
      setSignatureCreatorOpen(false);
      setEditingSignature(null);
    } catch (err) {
      setError('Failed to save signature');
      console.error('Error saving signature:', err);
    }
  };

  const handleDeleteSignature = async () => {
    try {
      await signaturesAPI.templates.delete(signatureToDelete.id);
      await loadSignatures(); // Reload from API
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
    const signatureData = signature.template_data || signature.signature_data || signature.data;
    
    if (!signatureData) {
      return null;
    }
    
    if (typeof signatureData === 'string' && signatureData.startsWith('data:image')) {
      // Drawn or uploaded signature
      return (
        <img
          src={signatureData}
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
    } else if (signatureData && signatureData.type === 'typed') {
      // Typed signature
      return (
        <Box
          sx={{
            fontFamily: `'${signatureData.font}', cursive`,
            fontSize: Math.min(24, signatureData.size || 20),
            color: signatureData.color,
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
          {signatureData.text}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, width: '100%' }}>
        <Typography variant="h5">
          My Signature Templates
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

      <TableContainer component={Paper} elevation={0} square className="full-width-table" sx={{ maxWidth: 'none' }}>
        <Table stickyHeader sx={{ width: '100%', tableLayout: 'fixed', minWidth: 0 }}>
          <TableHead>
            <TableRow>
              <TableCell>Signature</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {signatures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <SignatureIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    No signature templates yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Create your first signature template to get started with document signing
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setSignatureCreatorOpen(true)}
                  >
                    Add Signature
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              signatures.map((signature) => (
                <TableRow key={signature.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <Box sx={{ 
                        width: 60, 
                        height: 40, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        mr: 2,
                        border: '1px solid #ddd',
                        borderRadius: 1,
                        backgroundColor: '#f9f9f9',
                        overflow: 'hidden'
                      }}>
                        {renderSignaturePreview(signature)}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body1" sx={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}>
                          {signature.name || `Signature ${signature.id}`}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={signature.signature_style || (typeof (signature.template_data || signature.signature_data || signature.data) === 'string' ? 'Drawn' : 'Typed')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(signature.created_at || signature.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 0.5,
                      flexWrap: 'nowrap',
                      minWidth: 120
                    }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => {
                          setEditingSignature(signature);
                          setSignatureCreatorOpen(true);
                        }}
                        sx={{ flexShrink: 0 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => openDeleteDialog(signature)}
                        sx={{ flexShrink: 0 }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Signature Creator */}
      <SignatureCreator
        open={signatureCreatorOpen}
        onClose={() => {
          setSignatureCreatorOpen(false);
          setEditingSignature(null);
        }}
        onSave={handleSaveSignature}
        existingSignature={editingSignature?.template_data || editingSignature?.signature_data || editingSignature?.data}
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
