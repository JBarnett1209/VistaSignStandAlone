import React from 'react';
import { Typography, Box, Card, CardContent, Button } from '@mui/material';

export default function PublicSigning() {
  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>
        Public Document Signing
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sign Document
          </Typography>
          <Typography color="text.secondary" paragraph>
            Enter your access token to sign the document.
          </Typography>
          
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" size="large">
              Start Signing Process
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}