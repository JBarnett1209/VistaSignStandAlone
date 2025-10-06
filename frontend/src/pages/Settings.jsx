import React from 'react';
import { Typography, Box, Card, CardContent, Switch, FormControlLabel, Button, Grid } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {isAdmin && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Management
            </Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Button variant="contained" component={Link} to="/settings/users">
                  Manage Users
                </Button>
              </Grid>
              <Grid item>
                <Button variant="outlined" component={Link} to="/settings/invites">
                  Manage Invites
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

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