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
  Visibility as ViewIcon,
  Edit as EditIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { documentsAPI, signaturesAPI } from '../services/api';
import DocumentUpload from '../components/DocumentUpload';
import DocumentEditor from '../components/DocumentEditor';
import ConfirmationDialog from '../components/ConfirmationDialog';
import DocumentViewer from '../components/DocumentViewer';

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
  const [editingDocument, setEditingDocument] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [documentSignatures, setDocumentSignatures] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, documentId: null, documentTitle: '' });

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

  const handleDeleteDocument = (documentId, documentTitle) => {
    setDeleteDialog({
      open: true,
      documentId,
      documentTitle
    });
  };

  const confirmDeleteDocument = async () => {
    try {
      await documentsAPI.delete(deleteDialog.documentId);
      setDocuments(prev => prev.filter(doc => doc.id !== deleteDialog.documentId));
      setDeleteDialog({ open: false, documentId: null, documentTitle: '' });
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  const handleEditDocument = async (document) => {
    try {
      // Fetch the latest document data from the database to ensure we have the most recent fields
      const response = await documentsAPI.get(document.id);
      setEditingDocument(response.data);
    } catch (err) {
      console.error('Error fetching document for editing:', err);
      setError('Failed to load document for editing');
      // Fallback to the document from the list
      setEditingDocument(document);
    }
  };

  const handleDocumentSave = (updatedDocument) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDocument.id ? updatedDocument : doc
    ));
    // Don't close the editor - just update the document list
  };

  const handleViewDocument = async (document) => {
    try {
      // Fetch the latest document data to ensure we have current signatures
      const response = await documentsAPI.get(document.id);
      setViewingDocument(response.data);
      
      // Also fetch signatures for this document
      try {
        const signaturesResponse = await signaturesAPI.adminListAll({ 
          document_id: document.id,
          limit: 100 
        });
        setDocumentSignatures(signaturesResponse.data.signatures || []);
      } catch (sigErr) {
        setDocumentSignatures([]);
      }
    } catch (err) {
      console.error('Error fetching document for viewing:', err);
      setError('Failed to load document for viewing');
      // Fallback to the document from the list
      setViewingDocument(document);
      setDocumentSignatures([]);
    }
  };

  const handleDownloadDocument = async (document) => {
    try {
      // Download the original file
      const response = await documentsAPI.download(document.id);
      
      // Create blob URL for download
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = document.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error downloading document:', err);
      setError('Failed to download document');
    }
  };

  return (
    <Box className="content-section" sx={{ 
      width: '100%', 
      height: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3, 
        width: '100%',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" sx={{ minWidth: 0, flex: 1 }}>
          Documents
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Upload Document
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer 
        component={Paper} 
        elevation={0} 
        square 
        className="full-width-table" 
        sx={{ 
          width: '100%',
          maxWidth: 'none',
          flex: 1,
          overflowX: 'auto',
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#c1c1c1',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: '#a8a8a8',
            },
          },
        }}
      >
        <Table stickyHeader sx={{ 
          tableLayout: 'fixed', 
          width: '100%', 
          minWidth: 0
        }}>
          <TableHead>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
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
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 0.5,
                      flexWrap: 'nowrap'
                    }}>
                      <IconButton 
                        size="small" 
                        title="View" 
                        onClick={() => handleViewDocument(doc)}
                        sx={{ flexShrink: 0 }}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        title="Edit"
                        onClick={() => handleEditDocument(doc)}
                        sx={{ flexShrink: 0 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        title="Download" 
                        onClick={() => handleDownloadDocument(doc)}
                        sx={{ flexShrink: 0 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Delete"
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                        color="error"
                        sx={{ flexShrink: 0 }}
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

      {/* Document Editor */}
      <DocumentEditor
        document={editingDocument}
        onClose={() => setEditingDocument(null)}
        onSave={handleDocumentSave}
      />

      {/* Document Viewer Dialog */}
      <Dialog
        open={!!viewingDocument}
        onClose={() => {
          setViewingDocument(null);
          setDocumentSignatures([]);
        }}
        maxWidth="lg"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">
                {viewingDocument?.title || 'Document Viewer'}
              </Typography>
              {documentSignatures.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {documentSignatures.length} signature{documentSignatures.length !== 1 ? 's' : ''} on this document
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => viewingDocument && handleDownloadDocument(viewingDocument)}
                size="small"
              >
                Download
              </Button>
              <IconButton
                onClick={() => {
                  setViewingDocument(null);
                  setDocumentSignatures([]);
                }}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%' }}>
          {viewingDocument && (
            <Box sx={{ height: '100%', width: '100%' }}>
              <DocumentViewer
                document={viewingDocument}
                signatures={documentSignatures}
                onClose={() => setViewingDocument(null)}
                onFieldClick={(field, pageNum) => {
                  // You can add additional functionality here, like showing signature details
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, documentId: null, documentTitle: '' })}
        onConfirm={confirmDeleteDocument}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteDialog.documentTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </Box>
  );
}