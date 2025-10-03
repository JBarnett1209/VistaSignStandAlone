import React from 'react';
import { Typography, Box, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { Description, Edit, Workflow } from '@mui/icons-material';

export default function Dashboard() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Description color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Documents
              </Typography>
              <Typography color="text.secondary">
                Manage your documents and files
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">View Documents</Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Edit color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Signatures
              </Typography>
              <Typography color="text.secondary">
                Create and manage digital signatures
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">View Signatures</Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Workflow color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" component="div">
                Workflows
              </Typography>
              <Typography color="text.secondary">
                Set up document signing workflows
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">View Workflows</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}