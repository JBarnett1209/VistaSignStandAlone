import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, TextField, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SignatureCapture from '../components/SignatureCapture';
import { publicAPI } from '../services/api';

export default function PublicSigning() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSigningPage = async () => {
      try {
        setLoading(true);
        const response = await publicAPI.getSigningPage(token);
        const data = response.data;

        // Backend returns a short payload when the document is already signed.
        if (data.message === 'Document already signed' || data.participant?.status === 'completed') {
          setAlreadySigned(true);
          return;
        }

        setWorkflow(data.workflow);
        setDocumentInfo(data.document);
        setFields(data.document?.fields || []);
      } catch (err) {
        console.error('Error loading signing page:', err);
        setError('Failed to load document. Your signing link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    loadSigningPage();
  }, [token]);

  const handleFieldValueChange = useCallback((fieldId, value) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

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
      const fieldPayload = fields.map(f => ({
        fieldId: f.id,
        signature: fieldValues[f.id] || '',
        position: f.position || f.rect || {},
      }));
      await publicAPI.submitSignature(token, {
        type: 'field_signatures',
        fields: fieldPayload,
        consent_given: true,
        privacy_accepted: true,
        legal_binding_accepted: true,
        consent_timestamp: new Date().toISOString(),
      });
      navigate('/signing-complete');
    } catch (err) {
      console.error('Error completing signing:', err);
      setError('Failed to complete signing. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [token, fields, fieldValues, navigate]);

  const handleDecline = useCallback(async () => {
    try {
      setSaving(true);
      await publicAPI.declineSigning(token);
      navigate('/signing-declined');
    } catch (err) {
      console.error('Error declining signing:', err);
      setError('Failed to decline signing. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [token, navigate]);

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

  if (alreadySigned) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success">This document has already been signed. Thank you.</Alert>
      </Box>
    );
  }

  if (!documentInfo) {
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
        {documentInfo.title}
      </Typography>

      {workflow?.description && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body1">{workflow.description}</Typography>
        </Paper>
      )}

      {fields.length > 0 ? (
        <Typography variant="h6" gutterBottom>
          Please complete the following fields:
        </Typography>
      ) : (
        <Typography variant="body1" gutterBottom>
          Review the document and click "Complete Signing" to confirm.
        </Typography>
      )}

      {fields.map((field) => (
        <Paper key={field.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {(field.type || 'field').replace('_', ' ').toUpperCase()}
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
              placeholder={`Enter ${field.type || 'value'}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
              type={field.type === 'email' ? 'email' : 'text'}
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
