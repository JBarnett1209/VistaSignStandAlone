import React from 'react';
import { Link } from 'react-router-dom';
import { Typography, Box, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';

export default function Dashboard() {
  const CARD_HEIGHT = 220;
  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <DescriptionIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Documents
              </Typography>
              <Typography color="text.secondary">
                Manage your documents and files
              </Typography>
            </CardContent>
            <CardActions sx={{ mt: 'auto' }}>
              <Button size="small" component={Link} to="/documents">View Documents</Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <EditIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Signatures
              </Typography>
              <Typography color="text.secondary">
                Create and manage digital signatures
              </Typography>
            </CardContent>
            <CardActions sx={{ mt: 'auto' }}>
              <Button size="small" component={Link} to="/signatures">View Signatures</Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Workflows
              </Typography>
              <Typography color="text.secondary">
                Set up document signing workflows
              </Typography>
            </CardContent>
            <CardActions sx={{ mt: 'auto' }}>
              <Button size="small" component={Link} to="/workflows">View Workflows</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}