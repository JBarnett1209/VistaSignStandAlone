import React from 'react';
import { Typography, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SignatureManager from '../components/SignatureManager';

export default function Signatures() {
  return (
    <Box className="content-section">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Signatures
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
          const event = new CustomEvent('open-signature-creator');
          window.dispatchEvent(event);
        }}>
          Create Signature
        </Button>
      </Box>
      <SignatureManager />
    </Box>
  );
}