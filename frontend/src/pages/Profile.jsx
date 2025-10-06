import React from 'react';
import { Typography, Box, Card, CardContent, TextField, Button, Grid } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>
      
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={user?.first_name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={user?.last_name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                value={user?.email || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Role"
                value={user?.role || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" color="primary">
                Update Profile
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}