/**
 * Field List Sidebar Component
 * Shows all document fields in a drag-and-drop list
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  signature: { label: 'Signature', icon: '✍️', color: 'primary' },
  date: { label: 'Date', icon: '📅', color: 'secondary' },
  initials: { label: 'Initials', icon: '🖊️', color: 'info' },
  text: { label: 'Text', icon: '📝', color: 'default' },
  checkbox: { label: 'Checkbox', icon: '☑️', color: 'success' },
  radio: { label: 'Radio', icon: '🔘', color: 'warning' },
  dropdown: { label: 'Dropdown', icon: '📋', color: 'error' },
  name: { label: 'Name', icon: '👤', color: 'primary' },
  email: { label: 'Email', icon: '📧', color: 'secondary' },
  attachment: { label: 'Attachment', icon: '📎', color: 'info' },
  whiteout: { label: 'Whiteout', icon: '⬜', color: 'default' }
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
        border: 1,
        borderColor: isSelected ? 'primary.main' : 'transparent',
        borderRadius: 1,
        mb: 0.5,
        mx: 1,
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
        '&:hover': {
          bgcolor: 'action.hover'
        }
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
  currentPage = 1
}) => {
  const [filter, setFilter] = useState('');
  const [showAllPages, setShowAllPages] = useState(false);

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = filteredFields.findIndex(field => field.id === active.id);
      const newIndex = filteredFields.findIndex(field => field.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onFieldReorder?.(oldIndex, newIndex);
      }
    }
  }, [filteredFields, onFieldReorder]);


  return (
    <Paper 
      sx={{ 
        width: 300, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">Fields</Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddField}
            variant="outlined"
          >
            Add
          </Button>
        </Box>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search fields..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
        />
        
        {/* Page Filter */}
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
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

      {/* Field List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
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
          </DndContext>
        )}
      </Box>
    </Paper>
  );
};

export default FieldList;
