import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, AppBar, Toolbar, Chip, Tabs, Tab,
} from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import api, { publicAPI } from '../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PAGE_WIDTH = 720; // rendered page width in px

// Cursive styles offered in the "Select style" tab (and used to render the
// stamped signature image so it matches the preview).
const SIG_STYLES = [
  { label: 'Style 1', font: `"Dancing Script", "Brush Script MT", cursive` },
  { label: 'Style 2', font: `"Segoe Script", "Brush Script MT", cursive` },
  { label: 'Style 3', font: `"Comic Sans MS", "Bradley Hand", cursive` },
];

const deriveInitials = (name) =>
  (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 4);

// Render typed text to a transparent PNG data URL so it stamps like an image.
function textToImage(text, font) {
  const width = 600, height = 160;
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#15173a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Shrink font until the text fits the canvas width.
  let size = 72;
  do {
    ctx.font = `italic ${size}px ${font}`;
    if (ctx.measureText(text).width <= width - 40 || size <= 24) break;
    size -= 4;
  } while (size > 24);
  ctx.fillText(text || '', width / 2, height / 2);
  return c.toDataURL('image/png');
}

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
  const [textField, setTextField] = useState(null); // field being typed
  const [textDraft, setTextDraft] = useState('');
  const [activeFieldId, setActiveFieldId] = useState(null);

  // Adopted signature (DocuSign-style: adopt once, stamp many).
  const [adoptedSig, setAdoptedSig] = useState(null);
  const [adoptedInitials, setAdoptedInitials] = useState(null);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [pendingField, setPendingField] = useState(null); // field to fill after adopting
  const [adoptName, setAdoptName] = useState('');
  const [adoptInitials, setAdoptInitials] = useState('');
  const [adoptTab, setAdoptTab] = useState(0); // 0 = style, 1 = draw
  const [styleIdx, setStyleIdx] = useState(0);
  const [drawnSig, setDrawnSig] = useState('');

  const fieldRefs = useRef({}); // fieldId -> DOM node (for jump-to-field)
  const drawCanvasRef = useRef(null);
  const drawing = useRef(false);

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
        const nm = data.recipient?.full_name || data.recipient?.name || '';
        setAdoptName(nm);
        setAdoptInitials(deriveInitials(nm));
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

  const stampSignature = useCallback((field, sigImg, initialsImg) => {
    const img = field.type === 'initials' ? initialsImg : sigImg;
    if (img) saveField(field.id, img);
  }, [saveField]);

  const onFieldClick = useCallback((field) => {
    const t = field.type;
    if (t === 'signature' || t === 'initials') {
      if (adoptedSig) {
        stampSignature(field, adoptedSig, adoptedInitials);
      } else {
        setPendingField(field);
        setDrawnSig('');
        setAdoptTab(0);
        setAdoptOpen(true);
      }
    } else if (t === 'checkbox') {
      saveField(field.id, fieldValues[field.id] ? '' : 'true');
    } else if (t === 'date_signed') {
      saveField(field.id, new Date().toISOString().slice(0, 10));
    } else {
      setTextDraft(fieldValues[field.id] || '');
      setTextField(field);
    }
  }, [fieldValues, saveField, adoptedSig, adoptedInitials, stampSignature]);

  // --- Adopt dialog: draw canvas handlers ---
  const drawStart = (e) => {
    drawing.current = true;
    const c = drawCanvasRef.current; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#15173a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const drawMove = (e) => {
    if (!drawing.current) return;
    const c = drawCanvasRef.current; const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  };
  const drawEnd = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setDrawnSig(drawCanvasRef.current.toDataURL('image/png'));
  };
  const clearDraw = () => {
    const c = drawCanvasRef.current; if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setDrawnSig('');
  };

  const adoptAndSign = useCallback(() => {
    const initialsImg = textToImage(adoptInitials || deriveInitials(adoptName), SIG_STYLES[styleIdx].font);
    const sigImg = adoptTab === 1 && drawnSig
      ? drawnSig
      : textToImage(adoptName, SIG_STYLES[styleIdx].font);
    setAdoptedSig(sigImg);
    setAdoptedInitials(initialsImg);
    if (pendingField) stampSignature(pendingField, sigImg, initialsImg);
    setAdoptOpen(false);
    setPendingField(null);
  }, [adoptName, adoptInitials, styleIdx, adoptTab, drawnSig, pendingField, stampSignature]);

  // Document-ordered fields, for jump-to-next.
  const orderedFields = useMemo(() => {
    return [...fields].sort((a, b) => {
      const pa = a.page_index ?? 0, pb = b.page_index ?? 0;
      if (pa !== pb) return pa - pb;
      return ((a.rect_pts?.y) || 0) - ((b.rect_pts?.y) || 0);
    });
  }, [fields]);

  const nextField = useMemo(() => {
    return orderedFields.find((f) => f.required && !fieldValues[f.id])
      || orderedFields.find((f) => !fieldValues[f.id])
      || null;
  }, [orderedFields, fieldValues]);

  const jumpToNext = useCallback(() => {
    if (!nextField) return;
    const el = fieldRefs.current[nextField.id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setActiveFieldId(nextField.id);
  }, [nextField]);

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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', width: '100%', pb: 12 }}>
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
                    const isActive = f.id === activeFieldId;
                    return (
                      <Box
                        key={f.id}
                        ref={(el) => { if (el) fieldRefs.current[f.id] = el; }}
                        onClick={() => { setActiveFieldId(f.id); onFieldClick(f); }}
                        sx={{
                          position: 'absolute',
                          left: (r.x || 0) * scale,
                          top: (r.y || 0) * scale,
                          width: (r.w || 144) * scale,
                          height: (r.h || 32) * scale,
                          border: '2px solid',
                          borderColor: filled ? 'success.main' : (f.required ? '#f59e0b' : '#7B5CFF'),
                          bgcolor: filled ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.18)',
                          borderRadius: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#7c4a03',
                          outline: isActive ? '3px solid #7B5CFF' : 'none',
                          outlineOffset: 2,
                          transition: 'outline 0.15s',
                          '&:hover': { bgcolor: 'rgba(245,158,11,0.3)' },
                        }}
                      >
                        {isSig && filled ? (
                          <img src={fieldValues[f.id]} alt="signature" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        ) : filled ? (
                          <span style={{ padding: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {f.type === 'checkbox' ? '✓' : String(fieldValues[f.id])}
                          </span>
                        ) : (
                          <span>{isSig ? (f.type === 'initials' ? 'Initial' : 'Sign') : (f.type || 'field').replace('_', ' ')}{f.required ? '' : ''}</span>
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

      {/* Floating jump-to-next-field control (DocuSign-style "Start"/"Next") */}
      <Box sx={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1200 }}>
        {nextField ? (
          <Button variant="contained" size="large" onClick={jumpToNext}
            sx={{ borderRadius: 999, px: 4, boxShadow: 4, bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}>
            {requiredRemaining === fields.filter((f) => f.required).length ? 'Start' : 'Next'} →
          </Button>
        ) : (
          <Button variant="contained" size="large" onClick={handleComplete} disabled={requiredRemaining > 0 || saving}
            sx={{ borderRadius: 999, px: 4, boxShadow: 4 }}>
            Finish
          </Button>
        )}
      </Box>

      {/* Adopt signature dialog */}
      <Dialog open={adoptOpen} onClose={() => setAdoptOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adopt your signature</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Full name" fullWidth value={adoptName}
              onChange={(e) => { setAdoptName(e.target.value); setAdoptInitials(deriveInitials(e.target.value)); }} />
            <TextField label="Initials" sx={{ width: 120 }} value={adoptInitials}
              onChange={(e) => setAdoptInitials(e.target.value.toUpperCase())} />
          </Box>

          <Tabs value={adoptTab} onChange={(_, v) => setAdoptTab(v)} sx={{ mb: 2 }} variant="fullWidth">
            <Tab label="Select style" />
            <Tab label="Draw" />
          </Tabs>

          {adoptTab === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {SIG_STYLES.map((s, idx) => (
                <Box key={s.label} onClick={() => setStyleIdx(idx)}
                  sx={{ border: '2px solid', borderColor: idx === styleIdx ? '#7B5CFF' : '#d1d5db',
                        borderRadius: 1, p: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        // White "paper" card so the dark signature ink is readable and matches the stamp.
                        bgcolor: '#ffffff',
                        boxShadow: idx === styleIdx ? '0 0 0 3px rgba(123,92,255,0.35)' : 'none' }}>
                  <Typography sx={{ fontFamily: s.font, fontStyle: 'italic', fontSize: 34, color: '#15173a', lineHeight: 1 }}>
                    {adoptName || 'Your Name'}
                  </Typography>
                  <Typography sx={{ fontFamily: s.font, fontStyle: 'italic', fontSize: 26, color: '#15173a', opacity: 0.8 }}>
                    {adoptInitials || 'YN'}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Draw your signature below:</Typography>
              <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', justifyContent: 'center', bgcolor: '#fff' }}>
                <canvas ref={drawCanvasRef} width={500} height={180}
                  onMouseDown={drawStart} onMouseMove={drawMove} onMouseUp={drawEnd} onMouseLeave={drawEnd}
                  style={{ cursor: 'crosshair', borderRadius: 4 }} />
              </Box>
              <Button size="small" onClick={clearDraw} sx={{ mt: 1 }}>Clear</Button>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            By clicking Adopt and Sign, I agree this is my legal signature and may be used on this document.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAdoptOpen(false); setPendingField(null); }}>Cancel</Button>
          <Button variant="contained" onClick={adoptAndSign}
            disabled={!adoptName.trim() || (adoptTab === 1 && !drawnSig)}>
            Adopt and Sign
          </Button>
        </DialogActions>
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
