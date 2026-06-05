import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, TextField, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SignatureCapture from '../components/SignatureCapture';
import { publicAPI } from '../services/api';

export default function PublicSigning() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [envelope, setEnvelope] = useState(null);
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
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await publicAPI.getSigningPage(token);
        if (data.already_signed) {
          setAlreadySigned(true);
          return;
        }
        setEnvelope(data.envelope);
        setDocumentInfo(data.document);
        setFields(data.fields || []);
        // Seed any previously-saved values.
        const seeded = {};
        (data.fields || []).forEach((f) => { if (f.value != null) seeded[f.id] = f.value; });
        setFieldValues(seeded);
      } catch (err) {
        console.error('Error loading signing page:', err);
        setError('Failed to load document. Your signing link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const saveField = useCallback(async (fieldId, value) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    try {
      setSaving(true);
      await publicAPI.submitFieldValue(token, fieldId, { value });
    } catch (err) {
      console.error('Error saving field:', err);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const handleSignatureFieldClick = useCallback((field) => {
    setCurrentField(field);
    setSignatureDialogOpen(true);
  }, []);

  const handleSignatureCapture = useCallback((signatureData) => {
    if (currentField) {
      saveField(currentField.id, signatureData);
      setSignatureDialogOpen(false);
      setCurrentField(null);
    }
  }, [currentField, saveField]);

  const handleComplete = useCallback(async () => {
    try {
      setSaving(true);
      await publicAPI.completeSigning(token);
      navigate('/signing-complete');
    } catch (err) {
      console.error('Error completing signing:', err);
      setError(err?.response?.data?.detail || 'Failed to complete signing. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [token, navigate]);

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
    return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  }
  if (alreadySigned) {
    return <Box sx={{ p: 3 }}><Alert severity="success">This document has already been signed. Thank you.</Alert></Box>;
  }
  if (!envelope) {
    return <Box sx={{ p: 3 }}><Alert severity="warning">Document not found or access denied.</Alert></Box>;
  }

  const requiredFields = fields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => fieldValues[f.id]);
  const canComplete = requiredFields.length === completedRequired.length;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>{envelope.subject || documentInfo?.title}</Typography>

      {envelope.message && (
        <Paper sx={{ p: 2, mb: 3 }}><Typography variant="body1">{envelope.message}</Typography></Paper>
      )}

      {fields.length > 0 ? (
        <Typography variant="h6" gutterBottom>Please complete the following fields:</Typography>
      ) : (
        <Typography variant="body1" gutterBottom>Review the document and click "Complete Signing" to confirm.</Typography>
      )}

      {fields.map((field) => (
        <Paper key={field.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {(field.type || 'field').replace('_', ' ').toUpperCase()}
            {field.required && <span style={{ color: 'red' }}> *</span>}
          </Typography>

          {field.type === 'signature' || field.type === 'initials' ? (
            fieldValues[field.id] ? (
              <Box sx={{ p: 2, border: '1px solid #ddd', borderRadius: 1, bgcolor: '#f5f5f5' }}>
                <Typography variant="body2" color="text.secondary">Signature captured</Typography>
              </Box>
            ) : (
              <Button variant="outlined" onClick={() => handleSignatureFieldClick(field)} sx={{ minHeight: 100, width: '100%' }}>
                Click to Sign
              </Button>
            )
          ) : field.type === 'date_signed' ? (
            <TextField fullWidth variant="outlined" type="date"
              value={fieldValues[field.id] || ''} onChange={(e) => saveField(field.id, e.target.value)} />
          ) : field.type === 'checkbox' ? (
            <Button variant={fieldValues[field.id] ? 'contained' : 'outlined'}
              onClick={() => saveField(field.id, fieldValues[field.id] ? '' : 'true')}>
              {fieldValues[field.id] ? 'Checked' : 'Check'}
            </Button>
          ) : (
            <TextField fullWidth variant="outlined" placeholder={`Enter ${field.type || 'value'}`}
              value={fieldValues[field.id] || ''} onChange={(e) => saveField(field.id, e.target.value)}
              type={field.type === 'email' ? 'email' : 'text'} />
          )}
        </Paper>
      ))}

      {saving && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} /><Typography sx={{ ml: 1 }}>Saving...</Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
        <Button variant="outlined" color="error" onClick={handleDecline} disabled={saving}>Decline to Sign</Button>
        <Button variant="contained" onClick={handleComplete} disabled={!canComplete || saving}>Complete Signing</Button>
      </Box>

      <Dialog open={signatureDialogOpen} onClose={() => setSignatureDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Capture Signature</DialogTitle>
        <DialogContent><SignatureCapture onCapture={handleSignatureCapture} /></DialogContent>
        <DialogActions><Button onClick={() => setSignatureDialogOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
