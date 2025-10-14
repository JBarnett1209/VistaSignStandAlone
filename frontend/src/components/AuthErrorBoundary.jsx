import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export const AuthErrorBoundary = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // If we're loading, show loading state
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          gap: 2
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  // If not authenticated, show error
  if (!isAuthenticated || !user) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          gap: 2,
          p: 3
        }}
      >
        <Alert severity="error" sx={{ mb: 2 }}>
          Authentication required. Please log in to continue.
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => window.location.href = '/login'}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
};
