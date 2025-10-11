/**
 * Professional Document Store using Zustand
 * Centralized state management for document editing
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { generateFieldId, normalizeField } from '../utils/pdfCoordinates';

// Document store state
const useDocumentStore = create(
  devtools(
    subscribeWithSelector((set, get) => ({
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
      
      setSelectedFieldType: (type) => set({ selectedFieldType: type }),
      
      // Field actions
      addField: (fieldData) => {
        const newField = {
          id: generateFieldId(),
          ...normalizeField(fieldData),
          created_at: new Date().toISOString()
        };
        
        set((state) => ({
          fields: [...state.fields, newField],
          selectedField: newField
        }));
        
        get().saveToHistory();
      },
      
      updateField: (fieldId, updates) => {
        set((state) => ({
          fields: state.fields.map(field =>
            field.id === fieldId ? { ...field, ...updates } : field
          ),
          selectedField: state.selectedField?.id === fieldId 
            ? { ...state.selectedField, ...updates }
            : state.selectedField
        }));
        
        get().saveToHistory();
      },
      
      deleteField: (fieldId) => {
        set((state) => ({
          fields: state.fields.filter(field => field.id !== fieldId),
          selectedField: state.selectedField?.id === fieldId ? null : state.selectedField,
          editingField: state.editingField?.id === fieldId ? null : state.editingField
        }));
        
        get().saveToHistory();
      },
      
      setSelectedField: (field) => set({ selectedField: field }),
      
      setEditingField: (field) => set({ editingField: field }),
      
      clearSelection: () => set({ 
        selectedField: null, 
        editingField: null 
      }),
      
      // History actions
      saveToHistory: () => {
        const state = get();
        const historyEntry = {
          fields: [...state.fields],
          timestamp: Date.now()
        };
        
        set((state) => ({
          history: [
            ...state.history.slice(0, state.historyIndex + 1),
            historyEntry
          ].slice(-50), // Keep only last 50 entries
          historyIndex: Math.min(state.historyIndex + 1, 49)
        }));
      },
      
      undo: () => {
        const state = get();
        if (state.historyIndex > 0) {
          const previousState = state.history[state.historyIndex - 1];
          set({
            fields: [...previousState.fields],
            historyIndex: state.historyIndex - 1,
            selectedField: null,
            editingField: null
          });
        }
      },
      
      redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
          const nextState = state.history[state.historyIndex + 1];
          set({
            fields: [...nextState.fields],
            historyIndex: state.historyIndex + 1,
            selectedField: null,
            editingField: null
          });
        }
      },
      
      canUndo: () => get().historyIndex > 0,
      
      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },
      
      // Reset actions
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
      }),
      
      // Computed selectors
      getFieldsForPage: (pageNumber) => {
        const state = get();
        return state.fields.filter(field => field.page === pageNumber);
      },
      
      getSelectedFieldData: () => {
        const state = get();
        return state.selectedField;
      },
      
      getFieldById: (fieldId) => {
        const state = get();
        return state.fields.find(field => field.id === fieldId);
      }
    })),
    {
      name: 'document-store',
      partialize: (state) => ({
        // Only persist essential data
        document: state.document,
        fields: state.fields,
        scale: state.scale
      })
    }
  )
);

export default useDocumentStore;
