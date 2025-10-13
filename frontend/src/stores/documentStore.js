/**
 * Professional Document Store using Zustand
 * Centralized state management for document editing
 */

import { create } from 'zustand';
import { generateFieldId, normalizeField } from '../utils/pdfCoordinates';

// Document store state
const useDocumentStore = create((set, get) => ({
  // Document state
  document: null,
  documentUrl: null,
  numPages: null,
  pageNumber: 1,
  scale: 1.0,
  pdfOffset: { x: 0, y: 0 },
  
  // Fields state
  fields: [],
  selectedField: null,
  editingField: null,
  
  // UI state
  loading: false,
  error: null,
  isViewMode: false,
  isWhiteoutMode: false,
  selectedFieldType: 'signature',
  
  // History state
  history: [],
  historyIndex: -1,
  
  // Actions
  setDocument: (document) => set({ document }),
  
  setDocumentUrl: (url) => set({ documentUrl: url }),
  
  setNumPages: (numPages) => set({ numPages }),
  
  setPageNumber: (pageNumber) => set({ pageNumber }),
  
  setScale: (scale) => set({ scale }),
  
  setPdfOffset: (offset) => set({ pdfOffset: offset }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),
  
  setViewMode: (isViewMode) => set({ isViewMode }),
  
  setWhiteoutMode: (isWhiteoutMode) => set({ isWhiteoutMode }),
  
  setSelectedFieldType: (selectedFieldType) => set({ selectedFieldType }),
  
  // Field actions
  addField: (field) => {
    const normalizedField = normalizeField(field);
    const newFields = [...get().fields, normalizedField];
    
    set({ 
      fields: newFields,
      selectedField: normalizedField
    });
    
    // Add to history
    get().addToHistory();
  },
  
  updateField: (fieldId, updates) => {
    const fields = get().fields.map(field => 
      field.id === fieldId 
        ? { ...field, ...updates }
        : field
    );
    
    set({ fields });
    get().addToHistory();
  },
  
  deleteField: (fieldId) => {
    const fields = get().fields.filter(field => field.id !== fieldId);
    
    set({ 
      fields,
      selectedField: null,
      editingField: null
    });
    
    get().addToHistory();
  },
  
  setSelectedField: (field) => set({ selectedField: field }),
  
  setEditingField: (field) => set({ editingField: field }),
  
  clearSelection: () => set({ 
    selectedField: null, 
    editingField: null 
  }),
  
  // History actions
  addToHistory: () => {
    const { fields, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...fields]);
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        fields: [...history[newIndex]],
        historyIndex: newIndex
      });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        fields: [...history[newIndex]],
        historyIndex: newIndex
      });
    }
  },
  
  // Computed values
  canUndo: () => get().historyIndex > 0,
  
  canRedo: () => get().historyIndex < get().history.length - 1,
  
  // Reset document
  resetDocument: () => set({
    document: null,
    documentUrl: null,
    numPages: null,
    pageNumber: 1,
    scale: 1.0,
    pdfOffset: { x: 0, y: 0 },
    fields: [],
    selectedField: null,
    editingField: null,
    loading: false,
    error: null,
    isViewMode: false,
    isWhiteoutMode: false,
    selectedFieldType: 'signature',
    history: [],
    historyIndex: -1
  })
}));

export default useDocumentStore;