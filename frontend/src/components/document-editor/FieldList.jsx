/**
 * Field Palette Sidebar Component
 * Shows draggable field types and existing fields in a drag-and-drop list
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Add as AddIcon
} from '@mui/icons-material';
import {
  useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FIELD_TYPE_CONFIG = {
  signature: { 
    label: 'Signature', 
    icon: '✍️', 
    color: 'primary',
    description: 'Digital signature field',
    defaultWidth: 200,
    defaultHeight: 50
  },
  date: { 
    label: 'Date', 
    icon: '📅', 
    color: 'secondary',
    description: 'Date picker field',
    defaultWidth: 120,
    defaultHeight: 30
  },
  initials: { 
    label: 'Initials', 
    icon: '🖊️', 
    color: 'info',
    description: 'Initials signature field',
    defaultWidth: 80,
    defaultHeight: 30
  },
  text: { 
    label: 'Text', 
    icon: '📝', 
    color: 'default',
    description: 'Text input field',
    defaultWidth: 150,
    defaultHeight: 30
  },
  checkbox: { 
    label: 'Checkbox', 
    icon: '☑️', 
    color: 'success',
    description: 'Checkbox field',
    defaultWidth: 20,
    defaultHeight: 20
  },
  radio: { 
    label: 'Radio', 
    icon: '🔘', 
    color: 'warning',
    description: 'Radio button field',
    defaultWidth: 20,
    defaultHeight: 20
  },
  dropdown: { 
    label: 'Dropdown', 
    icon: '📋', 
    color: 'error',
    description: 'Dropdown selection field',
    defaultWidth: 150,
    defaultHeight: 30
  },
  name: { 
    label: 'Name', 
    icon: '👤', 
    color: 'primary',
    description: 'Name input field',
    defaultWidth: 150,
    defaultHeight: 30
  },
  email: { 
    label: 'Email', 
    icon: '📧', 
    color: 'secondary',
    description: 'Email input field',
    defaultWidth: 200,
    defaultHeight: 30
  },
  phone: {
    label: 'Phone',
    icon: '📞',
    color: 'info',
    description: 'Phone number field',
    defaultWidth: 150,
    defaultHeight: 30
  },
  company: {
    label: 'Company',
    icon: '🏢',
    color: 'default',
    description: 'Company name field',
    defaultWidth: 200,
    defaultHeight: 30
  },
  title: {
    label: 'Title',
    icon: '💼',
    color: 'primary',
    description: 'Job title field',
    defaultWidth: 150,
    defaultHeight: 30
  },
  attachment: { 
    label: 'Attachment', 
    icon: '📎', 
    color: 'info',
    description: 'File attachment field',
    defaultWidth: 200,
    defaultHeight: 50
  },
  whiteout: { 
    label: 'Whiteout', 
    icon: '⬜', 
    color: 'default',
    description: 'Whiteout/hide content',
    defaultWidth: 100,
    defaultHeight: 30
  }
};

// Draggable Field Type Component
const DraggableFieldType = ({ fieldType, onDragStart }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `field-type-${fieldType}`,
    data: {
      type: 'field-type',
      fieldType: fieldType,
    },
  });

  // Debug logging
  React.useEffect(() => {
    if (isDragging) {
      console.log(`🎯 Dragging field type: ${fieldType}`);
    }
  }, [isDragging, fieldType]);


  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const config = FIELD_TYPE_CONFIG[fieldType];

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        mb: 1,
        border: '2px solid',
        borderColor: '#e0e0e0',
        borderRadius: 2,
        cursor: 'grab',
        bgcolor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: '#f5f5f5',
          borderColor: '#1976d2',
          boxShadow: '0 4px 8px rgba(25,118,210,0.2)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          cursor: 'grabbing',
          transform: 'translateY(0)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        },
      }}
    >
      <Box sx={{ fontSize: '1.2rem' }}>{config.icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight="medium" noWrap>
          {config.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {config.description}
        </Typography>
      </Box>
    </Box>
  );
};

// Sortable Field Item Component
const SortableFieldItem = ({ field, isSelected, onFieldClick, onFieldEdit, onFieldDelete, onFieldVisibilityToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const config = FIELD_TYPE_CONFIG[field.type] || { 
    label: field.type, 
    icon: '❓', 
    color: 'default' 
  };

  const handleEditClick = useCallback((e) => {
    e.stopPropagation();
    onFieldEdit?.(field);
  }, [field, onFieldEdit]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    onFieldDelete?.(field);
  }, [field, onFieldDelete]);

  const handleVisibilityToggle = useCallback((e) => {
    e.stopPropagation();
    onFieldVisibilityToggle?.(field);
  }, [field, onFieldVisibilityToggle]);

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      button
      selected={isSelected}
      onClick={() => onFieldClick?.(field)}
      sx={{
        border: '2px solid',
        borderColor: isSelected ? '#1976d2' : '#e0e0e0',
        borderRadius: 2,
        mb: 1,
        mx: 1,
        bgcolor: isSelected ? '#e3f2fd' : '#ffffff',
        boxShadow: isSelected ? '0 2px 8px rgba(25,118,210,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: isSelected ? '#bbdefb' : '#f5f5f5',
          borderColor: '#1976d2',
          boxShadow: '0 2px 8px rgba(25,118,210,0.2)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          cursor: 'grabbing',
          transform: 'translateY(0)',
        },
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mr: 1,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' }
        }}
      >
        <DragIcon fontSize="small" color="action" />
      </Box>
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{config.icon}</span>
              <Typography variant="body2" noWrap>
                {field.label || 'Unnamed Field'}
              </Typography>
              {field.required && (
                <Chip 
                  label="Required" 
                  size="small" 
                  color="error" 
                  sx={{ height: 16, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                label={config.label}
                size="small"
                color={config.color}
                variant="outlined"
                sx={{ height: 16, fontSize: '0.7rem' }}
              />
              {field.page && (
                <Typography variant="caption" color="text.secondary">
                  Page {field.page}
                </Typography>
              )}
            </Box>
          }
        />
      </Box>
      
      <ListItemSecondaryAction>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={handleVisibilityToggle}
            title={field.visible !== false ? 'Hide field' : 'Show field'}
          >
            {field.visible !== false ? <ViewIcon fontSize="small" /> : <HideIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleEditClick}
            title="Edit field"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleDeleteClick}
            title="Delete field"
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

const FieldList = ({
  fields = [],
  selectedField,
  onFieldSelect,
  onFieldEdit,
  onFieldDelete,
  onFieldReorder,
  onFieldVisibilityToggle,
  onAddField,
  onFieldTypeDrop,
  currentPage = 1
}) => {
  const [filter, setFilter] = useState('');
  const [showAllPages, setShowAllPages] = useState(false);


  // Filter fields by search term and page
  const filteredFields = fields.filter(field => {
    const matchesSearch = !filter || 
      field.label?.toLowerCase().includes(filter.toLowerCase()) ||
      field.type?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesPage = showAllPages || field.page === currentPage;
    
    return matchesSearch && matchesPage;
  });

  // Group fields by page
  const fieldsByPage = filteredFields.reduce((acc, field) => {
    const page = field.page || 1;
    if (!acc[page]) acc[page] = [];
    acc[page].push(field);
    return acc;
  }, {});



  return (
    <Paper 
      elevation={3}
      sx={{ 
        width: 320, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRight: '2px solid',
        borderColor: '#e0e0e0',
        borderRadius: 0,
        bgcolor: '#fafafa'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2.5, 
        borderBottom: '2px solid', 
        borderColor: '#e0e0e0',
        bgcolor: '#ffffff'
      }}>
        <Typography variant="h6" sx={{ 
          mb: 2, 
          fontWeight: 600,
          color: '#1976d2',
          fontSize: '1.1rem'
        }}>
          Field Palette
        </Typography>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search fields..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          sx={{ mb: 1 }}
        />
        
        {/* Page Filter */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant={showAllPages ? 'outlined' : 'contained'}
            onClick={() => setShowAllPages(false)}
          >
            Page {currentPage}
          </Button>
          <Button
            size="small"
            variant={showAllPages ? 'contained' : 'outlined'}
            onClick={() => setShowAllPages(true)}
          >
            All Pages
          </Button>
        </Box>
      </Box>

      {/* Field Type Palette */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Drag to add fields:
        </Typography>
        <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
          {Object.entries(FIELD_TYPE_CONFIG).map(([fieldType, config]) => (
            <DraggableFieldType
              key={fieldType}
              fieldType={fieldType}
            />
          ))}
        </Box>
      </Box>

      {/* Field List */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        bgcolor: '#ffffff',
        m: 1,
        borderRadius: 1,
        border: '1px solid #e0e0e0'
      }}>
        {Object.keys(fieldsByPage).length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {filter ? 'No fields match your search' : 'No fields added yet'}
            </Typography>
            {!filter && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={onAddField}
                sx={{ mt: 1 }}
              >
                Add your first field
              </Button>
            )}
          </Box>
        ) : (
          <>
            {Object.entries(fieldsByPage).map(([page, pageFields]) => (
              <Box key={page}>
                {showAllPages && (
                  <>
                    <Box sx={{ px: 2, py: 1, bgcolor: 'grey.100' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Page {page} ({pageFields.length} fields)
                      </Typography>
                    </Box>
                    <Divider />
                  </>
                )}
                
                <SortableContext
                  items={pageFields.map(field => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <List dense>
                    {pageFields.map((field) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        isSelected={selectedField?.id === field.id}
                        onFieldClick={onFieldSelect}
                        onFieldEdit={onFieldEdit}
                        onFieldDelete={onFieldDelete}
                        onFieldVisibilityToggle={onFieldVisibilityToggle}
                      />
                    ))}
                  </List>
                </SortableContext>
              </Box>
            ))}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default FieldList;
export { FIELD_TYPE_CONFIG };
