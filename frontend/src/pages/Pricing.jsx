import React from 'react';
import { Typography, Box, Card, CardContent, Button, Grid, List, ListItem, ListItemText } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

export default function Pricing() {
  const plans = [
    {
      name: 'Basic',
      price: '$0',
      features: ['5 documents per month', 'Basic signatures', 'Email support']
    },
    {
      name: 'Pro',
      price: '$29',
      features: ['Unlimited documents', 'Advanced signatures', 'Priority support', 'API access']
    },
    {
      name: 'Enterprise',
      price: '$99',
      features: ['Everything in Pro', 'Custom branding', 'Dedicated support', 'SLA guarantee']
    }
  ];

  return (
    <Box className="content-section">
      <Typography variant="h4" align="center" gutterBottom>
        Pricing Plans
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" gutterBottom>
        Choose the plan that's right for you
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 4 }}>
        {plans.map((plan) => (
          <Grid item xs={12} md={4} key={plan.name}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {plan.name}
                </Typography>
                <Typography variant="h3" color="primary" gutterBottom>
                  {plan.price}
                  {plan.price !== '$0' && <Typography component="span" variant="h6">/month</Typography>}
                </Typography>
                <List>
                  {plan.features.map((feature, index) => (
                    <ListItem key={index}>
                      <CheckIcon color="primary" sx={{ mr: 1 }} />
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
              <Box sx={{ p: 2 }}>
                <Button variant="contained" fullWidth>
                  Get Started
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}