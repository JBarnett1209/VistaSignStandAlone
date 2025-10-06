import React from 'react';
import { Typography, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function Documents() {
  return (
    <Box sx={{ width: '100%', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, px: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Documents
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Upload Document
        </Button>
      </Box>
      
      <TableContainer component={Paper} elevation={0} square sx={{ width: '100%', flex: '1 1 auto' }}>
        <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography color="text.secondary">
                  No documents yet. Upload your first document to get started.
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}