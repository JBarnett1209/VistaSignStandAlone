import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton
} from '@mui/material';
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // "warning", "danger", "info"
  icon,
  loading = false
}) => {
  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case "danger":
      case "delete":
        return <DeleteIcon color="error" />;
      case "warning":
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="info" />;
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case "danger":
      case "delete":
        return "error";
      case "warning":
        return "warning";
      default:
        return "primary";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: (theme) => theme.shadows[8]
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        pb: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getIcon()}
          <Typography variant="h6" component="span">
            {title}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: 'auto' }}
          disabled={loading}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <DialogContentText sx={{ 
          fontSize: '1rem',
          lineHeight: 1.6,
          color: 'text.primary'
        }}>
          {message}
        </DialogContentText>
      </DialogContent>
      
      <DialogActions sx={{ 
        px: 3, 
        pb: 3,
        gap: 1
      }}>
        <Button
          onClick={onClose}
          disabled={loading}
          variant="outlined"
          sx={{ minWidth: 100 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={getConfirmButtonColor()}
          sx={{ minWidth: 100 }}
        >
          {loading ? "Processing..." : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
