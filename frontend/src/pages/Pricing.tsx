import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Check as CheckIcon,
  Star as StarIcon,
  Business as BusinessIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { billingAPI } from '../services/api';

interface PricingPlan {
  tier: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: {
    documents_per_month: number;
    signatures_per_month: number;
    storage_gb: number;
  };
}

const Pricing: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    fetchPricingPlans();
  }, []);

  const fetchPricingPlans = async () => {
    try {
      setLoading(true);
      const response = await billingAPI.getPricingPlans();
      setPlans(response.data.plans);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!isAuthenticated) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }

    try {
      await billingAPI.updateSubscription({ tier, billing_cycle: billingCycle });
      // Show success message or redirect
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upgrade subscription');
    }
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <PersonIcon />;
      case 'basic': return <PersonIcon />;
      case 'professional': return <BusinessIcon />;
      case 'enterprise': return <StarIcon />;
      default: return <PersonIcon />;
    }
  };

  const getPlanColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'default';
      case 'basic': return 'primary';
      case 'professional': return 'secondary';
      case 'enterprise': return 'warning';
      default: return 'default';
    }
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return 'Unlimited';
    return limit.toString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" gutterBottom>
          Choose Your Plan
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Start free, upgrade when you need more
        </Typography>
        
        <Box display="flex" alignItems="center" justifyContent="center" mt={2}>
          <FormControlLabel
            control={
              <Switch
                checked={billingCycle === 'yearly'}
                onChange={(e) => setBillingCycle(e.target.checked ? 'yearly' : 'monthly')}
              />
            }
            label="Save 20% with yearly billing"
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} justifyContent="center">
        {plans.map((plan) => (
          <Grid item xs={12} sm={6} md={3} key={plan.tier}>
            <Card 
              sx={{ 
                height: '100%',
                position: 'relative',
                ...(plan.tier === 'professional' && {
                  border: '2px solid',
                  borderColor: 'primary.main',
                  transform: 'scale(1.05)'
                })
              }}
            >
              {plan.tier === 'professional' && (
                <Chip
                  label="Most Popular"
                  color="primary"
                  sx={{ position: 'absolute', top: 16, right: 16 }}
                />
              )}
              
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box color={`${getPlanColor(plan.tier)}.main`} mb={2}>
                  {getPlanIcon(plan.tier)}
                </Box>
                
                <Typography variant="h5" gutterBottom>
                  {plan.name}
                </Typography>
                
                <Typography variant="h3" component="div" gutterBottom>
                  ${billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly}
                  <Typography component="span" variant="h6" color="text.secondary">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </Typography>
                </Typography>
                
                {billingCycle === 'yearly' && plan.price_yearly > 0 && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ${(plan.price_yearly / 12).toFixed(2)}/month
                  </Typography>
                )}
                
                <List dense sx={{ textAlign: 'left', mt: 2 }}>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${formatLimit(plan.limits.documents_per_month)} documents/month`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${formatLimit(plan.limits.signatures_per_month)} signatures/month`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${formatLimit(plan.limits.storage_gb)} GB storage`}
                    />
                  </ListItem>
                  {plan.features.map((feature, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
                
                <Button
                  variant={plan.tier === 'professional' ? 'contained' : 'outlined'}
                  fullWidth
                  size="large"
                  onClick={() => handleUpgrade(plan.tier)}
                  sx={{ mt: 2 }}
                >
                  {plan.tier === 'free' ? 'Get Started Free' : 
                   plan.tier === 'enterprise' ? 'Contact Sales' : 'Upgrade Now'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box textAlign="center" mt={4}>
        <Typography variant="body1" color="text.secondary">
          All plans include 14-day free trial • No credit card required for free plan
        </Typography>
      </Box>
    </Box>
  );
};

export default Pricing;
