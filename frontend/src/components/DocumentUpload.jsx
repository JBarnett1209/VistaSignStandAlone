import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  TableChart as ExcelIcon,
  Slideshow as PowerPointIcon,
  TextFields as TextIcon
} from '@mui/icons-material';
import { documentsAPI } from '../services/api';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation'
];

const getFileIcon = (type) => {
  if (type.startsWith('image/')) return <ImageIcon />;
  if (type.includes('excel') || type.includes('spreadsheet')) return <ExcelIcon />;
  if (type.includes('powerpoint') || type.includes('presentation')) return <PowerPointIcon />;
  if (type.includes('text') || type.includes('csv')) return <TextIcon />;
  return <DocumentIcon />;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DocumentUpload({ onUploadSuccess, onClose }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = [];
      const errors = [];
      
      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });
      
      if (errors.length > 0) {
        setError(errors.join('\n'));
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
        setError(null);
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      const validFiles = [];
      const errors = [];
      
      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });
      
      if (errors.length > 0) {
        setError(errors.join('\n'));
      }
      
      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
        setError(null);
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const uploadPromises = selectedFiles.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', documentTitle || file.name);
        formData.append('description', documentDescription);
        
        setUploadProgress(prev => ({ ...prev, [index]: 0 }));
        
        const response = await documentsAPI.upload(formData);
        setUploadProgress(prev => ({ ...prev, [index]: 100 }));
        
        return response.data;
      });
      
      const results = await Promise.all(uploadPromises);
      setSuccess(`Successfully uploaded ${results.length} document(s)`);
      setSelectedFiles([]);
      setDocumentTitle('');
      setDocumentDescription('');
      
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const openUploadDialog = () => {
    if (selectedFiles.length > 0) {
      setUploadDialogOpen(true);
    }
  };

  return (
    <Box>
      <Paper
        elevation={dragActive ? 8 : 2}
        sx={{
          p: 4,
          textAlign: 'center',
          border: dragActive ? '2px dashed #6B46C1' : '2px dashed #ccc',
          backgroundColor: dragActive ? '#f3f0ff' : '#fafafa',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: '#f3f0ff',
            borderColor: '#6B46C1'
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <UploadIcon sx={{ fontSize: 48, color: '#6B46C1', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {dragActive ? 'Drop files here' : 'Drag & drop files here or click to browse'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports PDF, Word, Excel, PowerPoint, Images, Text, CSV, RTF, and OpenDocument files
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
        </Typography>
      </Paper>

      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Selected Files ({selectedFiles.length})
          </Typography>
          {selectedFiles.map((file, index) => (
            <Paper
              key={index}
              sx={{
                p: 2,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                {getFileIcon(file.type)}
                <Box sx={{ ml: 2, flex: 1 }}>
                  <Typography variant="body1">{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)} • {file.type}
                  </Typography>
                </Box>
                {uploadProgress[index] !== undefined && (
                  <Box sx={{ width: 100, ml: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress[index]}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                )}
              </Box>
              <IconButton
                onClick={() => removeFile(index)}
                disabled={uploading}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Paper>
          ))}
          
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={openUploadDialog}
              disabled={uploading}
              startIcon={<UploadIcon />}
            >
              Upload Documents
            </Button>
            <Button
              variant="outlined"
              onClick={() => setSelectedFiles([])}
              disabled={uploading}
            >
              Clear All
            </Button>
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Documents</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Document Title"
            fullWidth
            variant="outlined"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder={selectedFiles.length === 1 ? selectedFiles[0].name : 'Enter title for all documents'}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={documentDescription}
            onChange={(e) => setDocumentDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            {selectedFiles.length} file(s) will be uploaded
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setUploadDialogOpen(false);
              handleUpload();
            }}
            variant="contained"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
