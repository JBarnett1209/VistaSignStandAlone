import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Typography, CircularProgress, IconButton, Paper, Button } from '@mui/material';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { documentsAPI } from '../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function DocumentView() {
  const { id } = useParams();
  const [docMeta, setDocMeta] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const meta = await documentsAPI.get(id);
        setDocMeta(meta.data);
        
        // Get the PDF through our authenticated API client
        const pdfResponse = await documentsAPI.convertToPdf(id);
        // Create a blob URL from the PDF response
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setFileUrl(blobUrl);
      } catch (e) {
        console.error('Failed to load document:', e);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    run();
    
    // Cleanup blob URL on unmount
    return () => {
      if (fileUrl && fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [id]);

  if (loading) return (
    <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
      <CircularProgress />
      <Typography>Loading document...</Typography>
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 3 }}>
      <Typography color="error">{error}</Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={Link} to="/documents">
            <BackIcon />
          </IconButton>
          <Typography variant="h6">{docMeta?.title || 'Document'}</Typography>
        </Box>
        <Button variant="outlined" component={Link} to={`/documents`}>Back to list</Button>
      </Box>
      <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        {fileUrl ? (
          <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
            {Array.from(new Array(numPages), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} renderAnnotationLayer={false} renderTextLayer={false} />
            ))}
          </Document>
        ) : (
          <Typography>No PDF URL</Typography>
        )}
      </Paper>
    </Box>
  );
}


