/**
 * Reusable loading and error state component
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Typography,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { handleError, ERROR_TYPES } from '../utils/errorHandler';

const LoadingErrorState = ({
  loading = false,
  error = null,
  onRetry = null,
  loadingMessage = 'Loading...',
  showRetryButton = true,
  size = 'medium',
  fullHeight = false
}) => {
  // Handle error if provided
  const handledError = error ? handleError(error) : null;

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          ...(fullHeight && { height: '100%', minHeight: '200px' })
        }}
      >
        <CircularProgress 
          size={size === 'large' ? 60 : size === 'small' ? 24 : 40}
          thickness={4}
        />
        <Typography variant="body2" color="text.secondary">
          {loadingMessage}
        </Typography>
      </Box>
    );
  }

  // Error state
  if (handledError) {
    const getSeverity = () => {
      switch (handledError.type) {
        case ERROR_TYPES.AUTHENTICATION:
        case ERROR_TYPES.PERMISSION:
          return 'error';
        case ERROR_TYPES.VALIDATION:
        case ERROR_TYPES.CONVERSION:
          return 'warning';
        case ERROR_TYPES.NETWORK:
        case ERROR_TYPES.SERVER:
          return 'error';
        default:
          return 'error';
      }
    };

    const getIcon = () => {
      switch (handledError.type) {
        case ERROR_TYPES.AUTHENTICATION:
        case ERROR_TYPES.PERMISSION:
          return <ErrorIcon />;
        case ERROR_TYPES.VALIDATION:
        case ERROR_TYPES.CONVERSION:
          return <WarningIcon />;
        case ERROR_TYPES.NETWORK:
        case ERROR_TYPES.SERVER:
          return <ErrorIcon />;
        default:
          return <InfoIcon />;
      }
    };

    const getTitle = () => {
      switch (handledError.type) {
        case ERROR_TYPES.AUTHENTICATION:
          return 'Authentication Required';
        case ERROR_TYPES.PERMISSION:
          return 'Access Denied';
        case ERROR_TYPES.VALIDATION:
          return 'Validation Error';
        case ERROR_TYPES.CONVERSION:
          return 'Conversion Failed';
        case ERROR_TYPES.NETWORK:
          return 'Connection Error';
        case ERROR_TYPES.SERVER:
          return 'Server Error';
        case ERROR_TYPES.NOT_FOUND:
          return 'Not Found';
        default:
          return 'Error';
      }
    };

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          ...(fullHeight && { height: '100%', minHeight: '200px' })
        }}
      >
        <Alert
          severity={getSeverity()}
          icon={getIcon()}
          sx={{
            width: '100%',
            maxWidth: 600,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
          action={
            showRetryButton && onRetry && handledError.retryable ? (
              <Button
                color="inherit"
                size="small"
                onClick={onRetry}
                startIcon={<RefreshIcon />}
                sx={{ ml: 1 }}
              >
                Retry
              </Button>
            ) : null
          }
        >
          <AlertTitle>{getTitle()}</AlertTitle>
          <Typography variant="body2">
            {handledError.userMessage}
          </Typography>
          
          {/* Show technical details in development */}
          {process.env.NODE_ENV === 'development' && handledError.details && (
            <Box sx={{ mt: 2, p: 1, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
              <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem' }}>
                {handledError.details}
              </Typography>
            </Box>
          )}
        </Alert>

        {/* Additional retry button if not in alert action */}
        {showRetryButton && onRetry && handledError.retryable && (
          <Button
            variant="outlined"
            onClick={onRetry}
            startIcon={<RefreshIcon />}
            sx={{ mt: 1 }}
          >
            Try Again
          </Button>
        )}
      </Box>
    );
  }

  // No error, no loading - return null
  return null;
};

export default LoadingErrorState;
