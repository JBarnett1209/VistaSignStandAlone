import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, IconButton, Button, CircularProgress,
  MenuItem, Select, FormControl, InputLabel, Chip, Divider, TextField,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { ArrowBack as BackIcon, Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import { documentsAPI } from '../services/api';
import WorkflowEditor from '../components/WorkflowEditor';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PAGE_WIDTH = 720;

// palette label -> { type, default size in PDF points }
const PALETTE = [
  { label: 'Signature', type: 'signature', w: 160, h: 44 },
  { label: 'Initials', type: 'initials', w: 70, h: 40 },
  { label: 'Full Name', type: 'full_name', w: 160, h: 28 },
  { label: 'Email', type: 'email', w: 170, h: 28 },
  { label: 'Date Signed', type: 'date_signed', w: 110, h: 28 },
  { label: 'Text', type: 'text', w: 150, h: 28 },
  { label: 'Checkbox', type: 'checkbox', w: 24, h: 24 },
];

// Per-recipient (signing order) colors so fields are visually grouped, DocuSign-style.
const RECIPIENT_COLORS = [
  { border: '#7B5CFF', bg: 'rgba(123, 92, 255, 0.16)' },
  { border: '#14B8A6', bg: 'rgba(20, 184, 166, 0.16)' },
  { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)' },
  { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.16)' },
  { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)' },
];
const colorFor = (order) => RECIPIENT_COLORS[((order || 1) - 1) % RECIPIENT_COLORS.length];
const typeLabel = (t) => (t || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

// Normalize a stored field to the editor's flat shape, accepting fields that
// were saved with rect/rect_pts or page_index (e.g. from other tools).
function normalizeField(f) {
  const rect = f.rect_pts || f.rect || {};
  return {
    id: f.id || `f_${Math.random().toString(36).slice(2)}`,
    page: f.page ?? ((f.page_index ?? 0) + 1),
    type: f.type || 'text',
    x: f.x ?? rect.x ?? 0,
    y: f.y ?? rect.y ?? 0,
    w: f.w ?? rect.w ?? rect.width ?? 144,
    h: f.h ?? rect.h ?? rect.height ?? 32,
    signingOrder: f.signingOrder ?? f.recipient_order ?? 1,
    required: f.required ?? false,
  };
}

export default function DocumentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [docMeta, setDocMeta] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageScales, setPageScales] = useState({});
  const [fields, setFields] = useState([]);
  const [tool, setTool] = useState('signature');
  const [signingOrder, setSigningOrder] = useState(1);
  const [recipientCount, setRecipientCount] = useState(3);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const fieldsRef = useRef([]);
  const dragRef = useRef(null);
  const pageScalesRef = useRef({});
  const pageRefs = useRef({}); // pageNumber -> DOM node, for cross-page hit-testing
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  // No fixed cap on recipients — grow the count to cover any already assigned.
  useEffect(() => {
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.signingOrder || 1), 1);
    setRecipientCount((c) => Math.max(c, maxOrder));
  }, [fields]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const meta = await documentsAPI.get(id);
        setDocMeta(meta.data);
        setFields((meta.data.fields || []).map(normalizeField));
        const resp = await documentsAPI.convertToPdf(id);
        setPdfUrl(URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' })));
      } catch (e) {
        console.error('Failed to load document', e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const persist = useCallback(async (next) => {
    setFields(next);
    try { await documentsAPI.update(id, { fields: next }); }
    catch (e) { console.error('Failed to save fields', e); }
  }, [id]);

  // Update a single field and persist.
  const updateField = useCallback((fieldId, patch) => {
    persist(fieldsRef.current.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  }, [persist]);

  const handlePageClick = useCallback((e, pageNumber) => {
    const def = PALETTE.find((p) => p.type === tool);
    if (!def) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = pageScales[pageNumber] || 1;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const field = {
      id: `f_${Date.now()}_${Math.round(x)}_${Math.round(y)}`,
      page: pageNumber,
      type: def.type,
      x: Math.max(0, x - def.w / 2),
      y: Math.max(0, y - def.h / 2),
      w: def.w,
      h: def.h,
      signingOrder,
      required: true,
    };
    persist([...fields, field]);
    setSelectedFieldId(field.id);
  }, [tool, pageScales, signingOrder, fields, persist]);

  const removeField = useCallback((fieldId, ev) => {
    if (ev) ev.stopPropagation();
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    persist(fields.filter((f) => f.id !== fieldId));
  }, [fields, persist, selectedFieldId]);

  useEffect(() => { pageScalesRef.current = pageScales; }, [pageScales]);

  // Begin a move or resize gesture on a placed field.
  const startGesture = useCallback((e, field, mode) => {
    if (e.target.closest('button')) return; // let the delete button work
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(field.id);
    const pageEl = pageRefs.current[field.page];
    const rect = pageEl ? pageEl.getBoundingClientRect() : null;
    const scale = pageScalesRef.current[field.page] || 1;
    // Offset (in PDF points) from the cursor to the field's top-left, so the
    // field tracks the cursor naturally even as it crosses page boundaries.
    const grabOffX = rect ? (e.clientX - rect.left) / scale - field.x : 0;
    const grabOffY = rect ? (e.clientY - rect.top) / scale - field.y : 0;
    dragRef.current = {
      id: field.id, page: field.page, mode,
      startX: e.clientX, startY: e.clientY,
      origW: field.w, origH: field.h, fieldW: field.w, fieldH: field.h,
      grabOffX, grabOffY, moved: false,
    };
  }, []);

  useEffect(() => {
    // Which rendered page is under this Y coordinate? (nearest one if in a gap)
    const pickPage = (clientY) => {
      let best = null; let bestDist = Infinity;
      for (const [num, el] of Object.entries(pageRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
        if (dist < bestDist) { bestDist = dist; best = { page: Number(num), rect: r }; }
      }
      return best;
    };
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      d.moved = true;
      if (d.mode === 'resize') {
        const scale = pageScalesRef.current[d.page] || 1;
        const nw = Math.max(16, d.origW + (e.clientX - d.startX) / scale);
        const nh = Math.max(12, d.origH + (e.clientY - d.startY) / scale);
        setFields((prev) => prev.map((f) => (f.id === d.id ? { ...f, w: nw, h: nh } : f)));
        return;
      }
      // Move: hit-test the page under the cursor so fields can cross pages, and
      // clamp within that page so a field can never be dragged off-canvas.
      const target = pickPage(e.clientY);
      if (!target) return;
      const scale = pageScalesRef.current[target.page] || 1;
      const pageW = target.rect.width / scale;
      const pageH = target.rect.height / scale;
      const rawX = (e.clientX - target.rect.left) / scale - d.grabOffX;
      const rawY = (e.clientY - target.rect.top) / scale - d.grabOffY;
      const nx = Math.min(Math.max(0, rawX), Math.max(0, pageW - d.fieldW));
      const ny = Math.min(Math.max(0, rawY), Math.max(0, pageH - d.fieldH));
      d.page = target.page;
      setFields((prev) => prev.map((f) => (f.id === d.id ? { ...f, page: target.page, x: nx, y: ny } : f)));
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.moved) {
        documentsAPI.update(id, { fields: fieldsRef.current }).catch((err) => console.error('Failed to save fields', err));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [id]);

  if (loading) {
    return <Box sx={{ p: 3, display: 'flex', gap: 2 }}><CircularProgress /><Typography>Loading...</Typography></Box>;
  }

  const orders = [...new Set(fields.map((f) => f.signingOrder || 1))].sort((a, b) => a - b);
  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  return (
    <Box sx={{ bgcolor: 'background.default', height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar (fixed; only the document column scrolls) */}
      <Paper square sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, zIndex: 10, flexShrink: 0 }}>
        <IconButton component={Link} to={`/documents/${id}/view`}><BackIcon /></IconButton>
        <Typography variant="h6" noWrap sx={{ flexShrink: 0, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {docMeta?.title || 'Prepare Document'}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">{fields.length} field(s)</Typography>
        <Button variant="contained" disabled={fields.length === 0} onClick={() => setRecipientsOpen(true)}>
          Continue to Recipients
        </Button>
      </Paper>

      {/* 3-column workspace: palette | canvas | properties */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left palette */}
        <Paper square elevation={0} sx={{ width: 220, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', p: 2, overflowY: 'auto' }}>
          <Typography variant="overline" color="text.secondary">Fields</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {PALETTE.map((p) => (
              <Button
                key={p.type}
                fullWidth
                variant={tool === p.type ? 'contained' : 'outlined'}
                onClick={() => setTool(p.type)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {p.label}
              </Button>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <FormControl size="small" fullWidth>
            <InputLabel>Assign new fields to</InputLabel>
            <Select label="Assign new fields to" value={signingOrder} onChange={(e) => setSigningOrder(e.target.value)}>
              {Array.from({ length: recipientCount }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n}>Recipient {n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button size="small" sx={{ mt: 1 }}
            onClick={() => { const n = recipientCount + 1; setRecipientCount(n); setSigningOrder(n); }}>
            + Add recipient
          </Button>

          {orders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">Recipients used</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {orders.map((o) => (
                  <Chip key={o} size="small" label={`Recipient ${o}`}
                    sx={{ borderColor: colorFor(o).border, color: colorFor(o).border, bgcolor: colorFor(o).bg }}
                    variant="outlined" />
                ))}
              </Box>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Pick a field type, then click on the page to place it. Drag to move; drag the corner to resize.
          </Typography>
        </Paper>

        {/* Center canvas (all pages) */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
          {pdfUrl && (
            <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<CircularProgress />}>
              {Array.from(new Array(numPages), (_, i) => {
                const pageNumber = i + 1;
                const scale = pageScales[pageNumber] || 1;
                return (
                  <Box key={pageNumber}
                    ref={(el) => { if (el) pageRefs.current[pageNumber] = el; }}
                    onClick={(e) => handlePageClick(e, pageNumber)}
                    sx={{ position: 'relative', boxShadow: 3, bgcolor: 'white', cursor: 'crosshair' }}>
                    <Page pageNumber={pageNumber} width={PAGE_WIDTH} renderAnnotationLayer={false} renderTextLayer={false}
                      onLoadSuccess={(page) => setPageScales((prev) => ({ ...prev, [pageNumber]: PAGE_WIDTH / page.originalWidth }))} />
                    {fields.filter((f) => (f.page || 1) === pageNumber).map((f) => {
                      const c = colorFor(f.signingOrder);
                      const isSel = f.id === selectedFieldId;
                      return (
                        <Box key={f.id}
                          onMouseDown={(e) => startGesture(e, f, 'move')}
                          onClick={(e) => { e.stopPropagation(); setSelectedFieldId(f.id); }}
                          sx={{
                            position: 'absolute', left: (f.x || 0) * scale, top: (f.y || 0) * scale,
                            width: (f.w || 144) * scale, height: (f.h || 32) * scale,
                            border: `2px solid ${c.border}`, bgcolor: c.bg, borderRadius: 1,
                            outline: isSel ? `2px solid ${c.border}` : 'none', outlineOffset: 2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, color: c.border, overflow: 'visible', cursor: 'move',
                            userSelect: 'none', boxShadow: isSel ? 3 : 0,
                          }}>
                          <span style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                            {typeLabel(f.type)} · R{f.signingOrder || 1}
                          </span>
                          {/* delete */}
                          <IconButton size="small" onClick={(ev) => removeField(f.id, ev)}
                            sx={{ position: 'absolute', top: -12, right: -12, bgcolor: 'white', boxShadow: 1,
                                  width: 20, height: 20, '&:hover': { bgcolor: '#fee2e2' } }}>
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          {/* resize handle (bottom-right) */}
                          <Box
                            onMouseDown={(e) => startGesture(e, f, 'resize')}
                            sx={{ position: 'absolute', right: -5, bottom: -5, width: 12, height: 12,
                                  bgcolor: c.border, borderRadius: '2px', cursor: 'nwse-resize',
                                  border: '1px solid white' }} />
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Document>
          )}
        </Box>

        {/* Right properties panel */}
        <Paper square elevation={0} sx={{ width: 280, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', p: 2, overflowY: 'auto' }}>
          <Typography variant="overline" color="text.secondary">Field properties</Typography>
          {selectedField ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={selectedField.type}
                  onChange={(e) => updateField(selectedField.id, { type: e.target.value })}>
                  {PALETTE.map((p) => <MenuItem key={p.type} value={p.type}>{p.label}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Recipient</InputLabel>
                <Select label="Recipient" value={selectedField.signingOrder || 1}
                  onChange={(e) => updateField(selectedField.id, { signingOrder: e.target.value })}>
                  {Array.from({ length: recipientCount }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>Recipient {n}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={<Checkbox checked={!!selectedField.required}
                  onChange={(e) => updateField(selectedField.id, { required: e.target.checked })} />}
                label="Required"
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" label="Page" type="number" value={selectedField.page || 1}
                  onChange={(e) => updateField(selectedField.id, { page: Math.max(1, Math.min(numPages || 1, Number(e.target.value) || 1)) })} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" label="X" type="number" value={Math.round(selectedField.x)}
                  onChange={(e) => updateField(selectedField.id, { x: Math.max(0, Number(e.target.value) || 0) })} />
                <TextField size="small" label="Y" type="number" value={Math.round(selectedField.y)}
                  onChange={(e) => updateField(selectedField.id, { y: Math.max(0, Number(e.target.value) || 0) })} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" label="Width" type="number" value={Math.round(selectedField.w)}
                  onChange={(e) => updateField(selectedField.id, { w: Math.max(16, Number(e.target.value) || 16) })} />
                <TextField size="small" label="Height" type="number" value={Math.round(selectedField.h)}
                  onChange={(e) => updateField(selectedField.id, { h: Math.max(12, Number(e.target.value) || 12) })} />
              </Box>

              <Button color="error" variant="outlined" startIcon={<DeleteIcon />}
                onClick={() => removeField(selectedField.id)}>
                Delete field
              </Button>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Select a placed field to edit its type, recipient, and exact position.
            </Typography>
          )}
        </Paper>
      </Box>

      <WorkflowEditor
        open={recipientsOpen}
        onClose={() => setRecipientsOpen(false)}
        initialDocument={docMeta}
        onSuccess={() => { setRecipientsOpen(false); navigate('/workflows'); }}
      />
    </Box>
  );
}
