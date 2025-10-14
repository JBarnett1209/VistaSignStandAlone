import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, TextField, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SignatureCapture from '../components/SignatureCapture';
import { documentsAPI, envelopesAPI } from '../services/api';

export default function PublicSigning() {
  const { workflowId, participantId } = useParams();
  const navigate = useNavigate();
  const [envelope, setEnvelope] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadEnvelope = async () => {
    try {
      setLoading(true);
        const response = await envelopesAPI.get(workflowId);
        setEnvelope(response.data);
        
        const recipientData = response.data.recipients.find(r => r.id === participantId);
        setRecipient(recipientData);
        
        if (recipientData) {
          setFields(response.data.fields.filter(f => f.recipient_id === participantId));
      }
    } catch (err) {
        console.error('Error loading envelope:', err);
        setError('Failed to load document. Please check your link.');
    } finally {
      setLoading(false);
    }
    };

    loadEnvelope();
  }, [workflowId, participantId]);

  const handleFieldValueChange = useCallback(async (fieldId, value) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    
    try {
      setSaving(true);
      await envelopesAPI.fields.upsert(workflowId, {
        fields: [{ id: fieldId, value }]
      });
    } catch (err) {
      console.error('Error saving field value:', err);
    } finally {
      setSaving(false);
    }
  }, [workflowId]);

  const handleSignatureFieldClick = useCallback((field) => {
    setCurrentField(field);
          setSignatureDialogOpen(true);
  }, []);

  const handleSignatureCapture = useCallback((signatureData) => {
    if (currentField) {
      handleFieldValueChange(currentField.id, signatureData);
      setSignatureDialogOpen(false);
      setCurrentField(null);
    }
  }, [currentField, handleFieldValueChange]);

  const handleComplete = useCallback(async () => {
    try {
      setSaving(true);
      await envelopesAPI.recipients.update(workflowId, participantId, {
        status: 'completed'
      });
      navigate('/signing-complete');
    } catch (err) {
      console.error('Error completing signing:', err);
      setError('Failed to complete signing. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [workflowId, participantId, navigate]);

  const handleDecline = useCallback(async () => {
    try {
      setSaving(true);
      await envelopesAPI.recipients.update(workflowId, participantId, {
        status: 'declined'
      });
      navigate('/signing-declined');
    } catch (err) {
      console.error('Error declining signing:', err);
      setError('Failed to decline signing. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [workflowId, participantId, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading document...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!envelope || !recipient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Document not found or access denied.</Alert>
      </Box>
    );
  }

  const requiredFields = fields.filter(f => f.required);
  const completedRequiredFields = requiredFields.filter(f => fieldValues[f.id]);
  const canComplete = requiredFields.length === completedRequiredFields.length;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {envelope.subject}
      </Typography>
      
      {envelope.message && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body1">{envelope.message}</Typography>
        </Paper>
      )}

      <Typography variant="h6" gutterBottom>
        Please complete the following fields:
      </Typography>

      {fields.map((field) => (
        <Paper key={field.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {field.type.replace('_', ' ').toUpperCase()}
            {field.required && <span style={{ color: 'red' }}> *</span>}
          </Typography>
          
          {field.type === 'signature' ? (
            <Box>
              {fieldValues[field.id] ? (
                <Box sx={{ p: 2, border: '1px solid #ddd', borderRadius: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="body2" color="text.secondary">
                    Signature captured
              </Typography>
                </Box>
              ) : (
                <Button 
                  variant="outlined" 
                  onClick={() => handleSignatureFieldClick(field)}
                  sx={{ minHeight: 100, width: '100%' }}
                >
                  Click to Sign
                </Button>
              )}
            </Box>
          ) : field.type === 'text' || field.type === 'email' ? (
            <TextField
              fullWidth
              variant="outlined"
              placeholder={`Enter ${field.type}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
              type={field.type === 'email' ? 'email' : 'text'}
            />
          ) : field.type === 'date_signed' ? (
            <TextField
              fullWidth
                variant="outlined"
              type="date"
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            />
          ) : field.type === 'checkbox' ? (
            <Button
              variant={fieldValues[field.id] ? 'contained' : 'outlined'}
              onClick={() => handleFieldValueChange(field.id, fieldValues[field.id] ? '' : 'true')}
            >
              {fieldValues[field.id] ? 'Checked' : 'Check'}
            </Button>
          ) : (
            <TextField
              fullWidth
              variant="outlined"
              placeholder={`Enter ${field.type}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
            />
          )}
        </Paper>
      ))}

      {saving && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} />
          <Typography sx={{ ml: 1 }}>Saving...</Typography>
                </Box>
              )}
              
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
        <Button 
          variant="outlined" 
          color="error"
          onClick={handleDecline}
          disabled={saving}
        >
          Decline to Sign
        </Button>
        <Button 
          variant="contained" 
          onClick={handleComplete}
          disabled={!canComplete || saving}
        >
          Complete Signing
        </Button>
      </Box>

      <Dialog open={signatureDialogOpen} onClose={() => setSignatureDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Capture Signature</DialogTitle>
        <DialogContent>
          <SignatureCapture onCapture={handleSignatureCapture} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignatureDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}