import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, IconButton, Button, CircularProgress,
  ToggleButton, ToggleButtonGroup, MenuItem, Select, FormControl, InputLabel, Chip,
} from '@mui/material';
import { ArrowBack as BackIcon, Close as CloseIcon } from '@mui/icons-material';
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
  const [loading, setLoading] = useState(true);
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const meta = await documentsAPI.get(id);
        setDocMeta(meta.data);
        setFields(meta.data.fields || []);
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
  }, [tool, pageScales, signingOrder, fields, persist]);

  const removeField = useCallback((fieldId, ev) => {
    ev.stopPropagation();
    persist(fields.filter((f) => f.id !== fieldId));
  }, [fields, persist]);

  if (loading) {
    return <Box sx={{ p: 3, display: 'flex', gap: 2 }}><CircularProgress /><Typography>Loading...</Typography></Box>;
  }

  const orders = [...new Set(fields.map((f) => f.signingOrder || 1))].sort((a, b) => a - b);

  return (
    <Box sx={{ bgcolor: '#f3f4f6', minHeight: '100vh' }}>
      <Paper square sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, position: 'sticky', top: 0, zIndex: 10 }}>
        <IconButton component={Link} to={`/documents/${id}/view`}><BackIcon /></IconButton>
        <Typography variant="h6" sx={{ flexShrink: 0 }}>{docMeta?.title || 'Prepare Document'}</Typography>

        <ToggleButtonGroup size="small" exclusive value={tool} onChange={(_, v) => v && setTool(v)} sx={{ flexWrap: 'wrap' }}>
          {PALETTE.map((p) => (
            <ToggleButton key={p.type} value={p.type}>{p.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Assign to</InputLabel>
          <Select label="Assign to" value={signingOrder} onChange={(e) => setSigningOrder(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>Recipient {n}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">{fields.length} field(s)</Typography>
        <Button variant="contained" disabled={fields.length === 0}
          onClick={() => setRecipientsOpen(true)}>Continue to Recipients</Button>
      </Paper>

      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Click a field type, then click on the document to place it. Signing orders used:
        </Typography>
        {orders.map((o) => <Chip key={o} size="small" label={`Recipient ${o}`} color="primary" variant="outlined" />)}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
        {pdfUrl && (
          <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<CircularProgress />}>
            {Array.from(new Array(numPages), (_, i) => {
              const pageNumber = i + 1;
              const scale = pageScales[pageNumber] || 1;
              return (
                <Box key={pageNumber}
                  onClick={(e) => handlePageClick(e, pageNumber)}
                  sx={{ position: 'relative', boxShadow: 3, bgcolor: 'white', cursor: 'crosshair' }}>
                  <Page pageNumber={pageNumber} width={PAGE_WIDTH} renderAnnotationLayer={false} renderTextLayer={false}
                    onLoadSuccess={(page) => setPageScales((prev) => ({ ...prev, [pageNumber]: PAGE_WIDTH / page.originalWidth }))} />
                  {fields.filter((f) => (f.page || 1) === pageNumber).map((f) => (
                    <Box key={f.id}
                      sx={{
                        position: 'absolute', left: (f.x || 0) * scale, top: (f.y || 0) * scale,
                        width: (f.w || 144) * scale, height: (f.h || 32) * scale,
                        border: '2px solid #7B5CFF', bgcolor: 'rgba(123,92,255,0.15)', borderRadius: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: '#4c1d95', overflow: 'visible',
                      }}>
                      <span style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                        {(f.type || '').replace('_', ' ')} · R{f.signingOrder || 1}
                      </span>
                      <IconButton size="small" onClick={(ev) => removeField(f.id, ev)}
                        sx={{ position: 'absolute', top: -12, right: -12, bgcolor: 'white', boxShadow: 1,
                              width: 20, height: 20, '&:hover': { bgcolor: '#fee2e2' } }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Document>
        )}
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
