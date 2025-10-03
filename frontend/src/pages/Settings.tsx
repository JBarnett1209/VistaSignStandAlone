import React from 'react';
import { Typography, Box, Card, CardContent, Switch, FormControlLabel, Button } from '@mui/material';

export default function Settings() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Email notifications"
          />
          <br />
          <FormControlLabel
            control={<Switch />}
            label="SMS notifications"
          />
        </CardContent>
      </Card>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Security
          </Typography>
          <Button variant="outlined" sx={{ mr: 2 }}>
            Change Password
          </Button>
          <Button variant="outlined">
            Enable 2FA
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Account
          </Typography>
          <Button variant="outlined" color="error">
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}