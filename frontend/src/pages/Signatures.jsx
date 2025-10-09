import React from 'react';
import { Typography, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
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
          Signatures
        </Typography>
      </Box>
      <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <SignatureManager />
      </Box>
    </Box>
  );
}