import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, AppBar, Toolbar, Chip,
} from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCapture from '../components/SignatureCapture';
import api, { publicAPI } from '../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PAGE_WIDTH = 720; // rendered page width in px

export default function PublicSigning() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [envelope, setEnvelope] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageScales, setPageScales] = useState({}); // pageNumber -> scale
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sigField, setSigField] = useState(null); // field being signed
  const [textField, setTextField] = useState(null); // field being typed
  const [textDraft, setTextDraft] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await publicAPI.getSigningPage(token);
        if (data.already_signed) { setAlreadySigned(true); return; }
        setEnvelope(data.envelope);
        setRecipient(data.recipient);
        setFields(data.fields || []);
        const seeded = {};
        (data.fields || []).forEach((f) => { if (f.value != null) seeded[f.id] = f.value; });
        setFieldValues(seeded);
        if (data.document?.file_url) {
          const resp = await api.get(data.document.file_url, { responseType: 'arraybuffer' });
          const blob = new Blob([resp.data], { type: 'application/pdf' });
          setPdfUrl(URL.createObjectURL(blob));
        }
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

  const onFieldClick = useCallback((field) => {
    const t = field.type;
    if (t === 'signature' || t === 'initials') {
      setSigField(field);
    } else if (t === 'checkbox') {
      saveField(field.id, fieldValues[field.id] ? '' : 'true');
    } else if (t === 'date_signed') {
      saveField(field.id, new Date().toISOString().slice(0, 10));
    } else {
      setTextDraft(fieldValues[field.id] || '');
      setTextField(field);
    }
  }, [fieldValues, saveField]);

  const requiredRemaining = useMemo(
    () => fields.filter((f) => f.required && !fieldValues[f.id]).length,
    [fields, fieldValues]
  );

  const handleComplete = useCallback(async () => {
    try {
      setSaving(true);
      await publicAPI.completeSigning(token);
      navigate('/signing-complete');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to complete signing.');
    } finally { setSaving(false); }
  }, [token, navigate]);

  const handleDecline = useCallback(async () => {
    try {
      setSaving(true);
      await publicAPI.declineSigning(token);
      navigate('/signing-declined');
    } catch (err) {
      setError('Failed to decline signing.');
    } finally { setSaving(false); }
  }, [token, navigate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress /><Typography sx={{ ml: 2 }}>Loading document...</Typography>
      </Box>
    );
  }
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (alreadySigned) return <Box sx={{ p: 3 }}><Alert severity="success">This document has already been signed. Thank you.</Alert></Box>;
  if (!envelope) return <Box sx={{ p: 3 }}><Alert severity="warning">Document not found or access denied.</Alert></Box>;

  const fieldsByPage = (pageNumber) => fields.filter((f) => (f.page_index ?? 0) + 1 === pageNumber);

  return (
    <Box sx={{ bgcolor: '#f3f4f6', minHeight: '100vh', pb: 10 }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{envelope.subject}</Typography>
          {requiredRemaining > 0
            ? <Chip color="warning" label={`${requiredRemaining} required field${requiredRemaining > 1 ? 's' : ''} left`} />
            : <Chip color="success" label="All required fields complete" />}
          <Button color="inherit" onClick={handleDecline} disabled={saving}>Decline</Button>
          <Button variant="contained" onClick={handleComplete} disabled={requiredRemaining > 0 || saving}>
            Finish
          </Button>
        </Toolbar>
      </AppBar>

      {envelope.message && (
        <Box sx={{ maxWidth: PAGE_WIDTH, mx: 'auto', mt: 2 }}>
          <Alert severity="info">{envelope.message}</Alert>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
        {pdfUrl ? (
          <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<CircularProgress />}>
            {Array.from(new Array(numPages), (_, i) => {
              const pageNumber = i + 1;
              const scale = pageScales[pageNumber] || 1;
              return (
                <Box key={pageNumber} sx={{ position: 'relative', boxShadow: 3, mb: 2, bgcolor: 'white' }}>
                  <Page
                    pageNumber={pageNumber}
                    width={PAGE_WIDTH}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onLoadSuccess={(page) =>
                      setPageScales((prev) => ({ ...prev, [pageNumber]: PAGE_WIDTH / page.originalWidth }))}
                  />
                  {fieldsByPage(pageNumber).map((f) => {
                    const r = f.rect_pts || {};
                    const filled = !!fieldValues[f.id];
                    const isSig = f.type === 'signature' || f.type === 'initials';
                    return (
                      <Box
                        key={f.id}
                        onClick={() => onFieldClick(f)}
                        sx={{
                          position: 'absolute',
                          left: (r.x || 0) * scale,
                          top: (r.y || 0) * scale,
                          width: (r.w || 144) * scale,
                          height: (r.h || 32) * scale,
                          border: '2px solid',
                          borderColor: filled ? 'success.main' : (f.required ? '#f59e0b' : '#7B5CFF'),
                          bgcolor: filled ? 'rgba(16,185,129,0.08)' : 'rgba(123,92,255,0.12)',
                          borderRadius: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          fontSize: 12,
                          color: '#374151',
                          '&:hover': { bgcolor: 'rgba(123,92,255,0.22)' },
                        }}
                      >
                        {isSig && filled ? (
                          <img src={fieldValues[f.id]} alt="signature" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        ) : filled ? (
                          <span style={{ padding: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {f.type === 'checkbox' ? '✓' : String(fieldValues[f.id])}
                          </span>
                        ) : (
                          <span>{(f.type || 'field').replace('_', ' ')}{f.required ? ' *' : ''}</span>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Document>
        ) : (
          <Alert severity="warning" sx={{ mt: 4 }}>Document preview unavailable.</Alert>
        )}
      </Box>

      {/* Signature capture */}
      <Dialog open={!!sigField} onClose={() => setSigField(null)} maxWidth="md" fullWidth>
        <DialogTitle>{sigField?.type === 'initials' ? 'Add Initials' : 'Add Your Signature'}</DialogTitle>
        <DialogContent>
          <SignatureCapture onCapture={(dataUrl) => { if (sigField) saveField(sigField.id, dataUrl); setSigField(null); }} />
        </DialogContent>
        <DialogActions><Button onClick={() => setSigField(null)}>Cancel</Button></DialogActions>
      </Dialog>

      {/* Text entry */}
      <Dialog open={!!textField} onClose={() => setTextField(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Enter {(textField?.type || 'value').replace('_', ' ')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth sx={{ mt: 1 }} value={textDraft}
            type={textField?.type === 'email' ? 'email' : 'text'}
            onChange={(e) => setTextDraft(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTextField(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { if (textField) saveField(textField.id, textDraft); setTextField(null); }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
