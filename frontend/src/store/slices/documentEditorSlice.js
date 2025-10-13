import { createSlice } from '@reduxjs/toolkit';

const initialState = {
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
};

const documentEditorSlice = createSlice({
  name: 'documentEditor',
  initialState,
  reducers: {
    setDocument(state, action) { state.document = action.payload; },
    setDocumentUrl(state, action) { state.documentUrl = action.payload; },
    setNumPages(state, action) { state.numPages = action.payload; },
    setPageNumber(state, action) { state.pageNumber = action.payload; },
    setScale(state, action) { state.scale = action.payload; },
    setPdfOffset(state, action) { state.pdfOffset = action.payload; },
    setLoading(state, action) { state.loading = action.payload; },
    setError(state, action) { state.error = action.payload; },
    setViewMode(state, action) { state.isViewMode = action.payload; },
    setWhiteoutMode(state, action) { state.isWhiteoutMode = action.payload; },
    setSelectedFieldType(state, action) { state.selectedFieldType = action.payload; },
    setSelectedField(state, action) { state.selectedField = action.payload; },
    setEditingField(state, action) { state.editingField = action.payload; },
    setFields(state, action) { state.fields = action.payload; },
    addField(state, action) { state.fields.push(action.payload); },
    updateField(state, action) {
      const { id, updates } = action.payload;
      state.fields = state.fields.map(f => f.id === id ? { ...f, ...updates } : f);
    },
    deleteField(state, action) { state.fields = state.fields.filter(f => f.id !== action.payload); },
    reset(state) { Object.assign(state, initialState); },
  }
});

export const {
  setDocument,
  setDocumentUrl,
  setNumPages,
  setPageNumber,
  setScale,
  setPdfOffset,
  setLoading,
  setError,
  setViewMode,
  setWhiteoutMode,
  setSelectedFieldType,
  setSelectedField,
  setEditingField,
  setFields,
  addField,
  updateField,
  deleteField,
  reset,
} = documentEditorSlice.actions;

export default documentEditorSlice.reducer;


