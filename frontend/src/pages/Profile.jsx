import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Avatar,
  Divider,
  Tabs,
  Tab,
  Paper,
  Chip,
  Button,
  Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import ApiTokenManager from '../components/ApiTokenManager';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Please log in to view your profile.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Summary Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', pt: 3 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '2rem'
                }}
              >
                {user.first_name?.[0]}{user.last_name?.[0]}
              </Avatar>
              
              <Typography variant="h5" gutterBottom>
                {user.first_name} {user.last_name}
              </Typography>
              
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {user.email}
              </Typography>
              
              <Chip
                label={user.role}
                color={user.role === 'admin' ? 'error' : 'primary'}
                variant="outlined"
                sx={{ mt: 1 }}
              />
              
              <Divider sx={{ my: 2 }} />
              
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
                
                {user.company && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {user.company}
                    </Typography>
                  </Box>
                )}
                
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Member since {new Date(user.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="profile tabs">
                <Tab
                  icon={<PersonIcon />}
                  label="Profile"
                  id="profile-tab-0"
                  aria-controls="profile-tabpanel-0"
                />
                <Tab
                  icon={<SecurityIcon />}
                  label="API Tokens"
                  id="profile-tab-1"
                  aria-controls="profile-tabpanel-1"
                />
                <Tab
                  icon={<SettingsIcon />}
                  label="Settings"
                  id="profile-tab-2"
                  aria-controls="profile-tabpanel-2"
                />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Typography variant="h6" gutterBottom>
                Profile Information
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    First Name
                  </Typography>
                  <Typography variant="body1">
                    {user.first_name}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Last Name
                  </Typography>
                  <Typography variant="body1">
                    {user.last_name}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1">
                    {user.email}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Role
                  </Typography>
                  <Chip
                    label={user.role}
                    color={user.role === 'admin' ? 'error' : 'primary'}
                    size="small"
                  />
                </Grid>
                
                {user.company && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Company
                    </Typography>
                    <Typography variant="body1">
                      {user.company}
                    </Typography>
                  </Grid>
                )}
                
                {user.job_title && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Job Title
                    </Typography>
                    <Typography variant="body1">
                      {user.job_title}
                    </Typography>
                  </Grid>
                )}
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Account Status
                  </Typography>
                  <Chip
                    label={user.is_active ? 'Active' : 'Inactive'}
                    color={user.is_active ? 'success' : 'error'}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email Verified
                  </Typography>
                  <Chip
                    label={user.is_verified ? 'Verified' : 'Unverified'}
                    color={user.is_verified ? 'success' : 'warning'}
                    size="small"
                  />
                </Grid>
              </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <ApiTokenManager />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" gutterBottom>
                Account Settings
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                Account settings and preferences will be available in a future update.
              </Alert>
              
              <Typography variant="body2" color="text.secondary">
                Here you'll be able to manage your account preferences, notification settings, 
                and other personalization options.
              </Typography>
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}