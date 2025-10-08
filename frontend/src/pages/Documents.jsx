import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  TableChart as ExcelIcon,
  Slideshow as PowerPointIcon,
  TextFields as TextIcon,
  GetApp as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { documentsAPI } from '../services/api';
import DocumentUpload from '../components/DocumentUpload';

const getDocumentIcon = (type) => {
  switch (type) {
    case 'image':
      return <ImageIcon />;
    case 'excel':
      return <ExcelIcon />;
    case 'powerpoint':
      return <PowerPointIcon />;
    case 'text':
    case 'csv':
      return <TextIcon />;
    default:
      return <DocumentIcon />;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'draft':
      return 'default';
    case 'pending':
      return 'warning';
    case 'signed':
      return 'success';
    case 'completed':
      return 'success';
    case 'rejected':
      return 'error';
    case 'expired':
      return 'error';
    default:
      return 'default';
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentsAPI.list();
      setDocuments(response.data.documents || []);
      setError(null);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadSuccess = (uploadedDocuments) => {
    setDocuments(prev => [...uploadedDocuments, ...prev]);
    setUploadDialogOpen(false);
  };

  const handleDeleteDocument = async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentsAPI.delete(documentId);
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      } catch (err) {
        setError('Failed to delete document');
        console.error('Error deleting document:', err);
      }
    }
  };

  return (
    <Box className="content-section">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, width: '100%', maxWidth: 'none' }}>
        <Typography variant="h4">
          Documents
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Document
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={0} square className="full-width-table" sx={{ maxWidth: 'none' }}>
        <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%', minWidth: 0 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '40%' }}>Document</TableCell>
              <TableCell sx={{ width: '12%' }}>Type</TableCell>
              <TableCell sx={{ width: '10%' }}>Size</TableCell>
              <TableCell sx={{ width: '12%' }}>Status</TableCell>
              <TableCell sx={{ width: '16%' }}>Created</TableCell>
              <TableCell sx={{ width: '10%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No documents yet. Upload your first document to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      {getDocumentIcon(doc.document_type)}
                      <Box sx={{ ml: 2, minWidth: 0, flex: 1 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%'
                          }}
                        >
                          {doc.title}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            display: 'block'
                          }}
                        >
                          {doc.filename}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.document_type.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatFileSize(doc.file_size)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(doc.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(doc.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small" title="View">
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small" title="Download">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Delete"
                        onClick={() => handleDeleteDocument(doc.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Upload Documents</DialogTitle>
        <DialogContent>
          <DocumentUpload
            onUploadSuccess={handleUploadSuccess}
            onClose={() => setUploadDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}