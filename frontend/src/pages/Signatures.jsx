import React from 'react';
import { Typography, Box } from '@mui/material';
import SignatureManager from '../components/SignatureManager';

export default function Signatures() {
  return (
    <Box className="content-section" sx={{ 
      width: '100%', 
      height: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Signature Templates
        </Typography>
      </Box>
      <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <SignatureManager />
      </Box>
    </Box>
  );
}