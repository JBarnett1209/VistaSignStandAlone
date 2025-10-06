import React from 'react';
import { Typography, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function Workflows() {
  return (
    <Box sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, px: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Workflows
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Create Workflow
        </Button>
      </Box>
      
      <TableContainer component={Paper} elevation={0} square sx={{ width: '100%', flex: 1 }}>
        <Table stickyHeader sx={{ width: '100%', tableLayout: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} align="center">
                <Typography color="text.secondary">
                  No workflows yet. Create your first workflow to get started.
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}