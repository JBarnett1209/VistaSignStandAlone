import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Box, Typography, Paper, IconButton, Button } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { documentsAPI, envelopesAPI } from '../services/api';

function DraggablePaletteItem({ id, label }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <Box ref={setNodeRef} {...attributes} {...listeners} sx={{ p: 1, mb: 1, border: '1px solid #ddd', borderRadius: 1, cursor: 'grab', opacity: isDragging ? 0.6 : 1 }}>{label}</Box>
  );
}

function DropCanvas({ onDrop }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return <Box ref={setNodeRef} sx={{ flex: 1, border: isOver ? '2px dashed #7B5CFF' : '2px dashed transparent', minHeight: 600 }} />;
}

export default function DocumentEdit() {
  const { id } = useParams();
  const [envId, setEnvId] = useState(null);
  const [fields, setFields] = useState([]);

  useEffect(() => {
    const run = async () => {
      const env = await envelopesAPI.create({ document_id: id, recipients: [] });
      setEnvId(env.data.id);
    };
    run();
  }, [id]);

  const handleDragEnd = useCallback(async (event) => {
    if (event.over?.id !== 'canvas') return;
    const type = event.active?.id;
    const newField = { page: 1, type, rect: { x: 72, y: 72, w: 144, h: 32 }, required: false };
    const next = [...fields, newField];
    setFields(next);
    if (envId) await envelopesAPI.upsertFields(envId, { fields: next });
  }, [fields, envId]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={Link} to={`/documents/${id}/view`}><BackIcon /></IconButton>
          <Typography variant="h6">Edit Document</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
        <Paper sx={{ width: 260, p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Field Palette</Typography>
          {['Signature', 'Full Name', 'Email', 'Date Signed', 'Text', 'Checkbox'].map(ft => (
            <DraggablePaletteItem key={ft} id={ft} label={ft} />
          ))}
        </Paper>
        <Paper sx={{ flex: 1, p: 2, display: 'flex' }}>
          <DropCanvas />
        </Paper>
      </Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" disabled={!envId} onClick={() => envelopesAPI.send(envId)}>Send for Signature</Button>
      </Box>
    </DndContext>
  );
}


