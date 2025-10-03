import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  Description as DocumentIcon,
  Edit as SignatureIcon,
  Workflow as WorkflowIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, signaturesAPI, workflowsAPI } from '../services/api';

interface DashboardStats {
  totalDocuments: number;
  pendingSignatures: number;
  completedWorkflows: number;
  recentActivity: any[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    pendingSignatures: 0,
    completedWorkflows: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [documentsRes, signaturesRes, workflowsRes] = await Promise.all([
          documentsAPI.list({ limit: 1 }),
          signaturesAPI.list({ status: 'pending', limit: 1 }),
          workflowsAPI.list({ status: 'completed', limit: 1 })
        ]);

        setStats({
          totalDocuments: documentsRes.data.total,
          pendingSignatures: signaturesRes.data.total,
          completedWorkflows: workflowsRes.data.total,
          recentActivity: []
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: 'Total Documents',
      value: stats.totalDocuments,
      icon: <DocumentIcon />,
      color: 'primary'
    },
    {
      title: 'Pending Signatures',
      value: stats.pendingSignatures,
      icon: <SignatureIcon />,
      color: 'warning'
    },
    {
      title: 'Completed Workflows',
      value: stats.completedWorkflows,
      icon: <CheckCircleIcon />,
      color: 'success'
    }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.first_name}!
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Here's what's happening with your digital signatures today.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4">
                      {card.value}
                    </Typography>
                  </Box>
                  <Box color={`${card.color}.main`}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<DocumentIcon />}
                    href="/documents"
                  >
                    Upload Document
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<SignatureIcon />}
                    href="/signatures"
                  >
                    Create Signature
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<WorkflowIcon />}
                    href="/workflows"
                  >
                    Start Workflow
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<TrendingUpIcon />}
                    href="/reports"
                  >
                    View Reports
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="No recent activity"
                    secondary="Your recent document activities will appear here"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
