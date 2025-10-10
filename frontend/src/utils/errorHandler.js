/**
 * Centralized error handling utilities for VistaSign
 */

/**
 * Error types for consistent error handling
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  SERVER: 'SERVER_ERROR',
  CONVERSION: 'CONVERSION_ERROR',
  SIGNATURE: 'SIGNATURE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Parse error response to extract meaningful error information
 * @param {Error} error - The error object
 * @returns {Object} - Parsed error information
 */
export const parseError = (error) => {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN,
      message: 'An unknown error occurred',
      details: null,
      retryable: false
    };
  }

  // Network errors
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return {
      type: ERROR_TYPES.NETWORK,
      message: 'Network connection failed. Please check your internet connection and try again.',
      details: error.message,
      retryable: true
    };
  }

  // HTTP status code errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return {
          type: ERROR_TYPES.AUTHENTICATION,
          message: 'Your session has expired. Please log in again.',
          details: data?.detail || 'Unauthorized',
          retryable: false
        };
      
      case 403:
        return {
          type: ERROR_TYPES.PERMISSION,
          message: 'You do not have permission to perform this action.',
          details: data?.detail || 'Forbidden',
          retryable: false
        };
      
      case 404:
        return {
          type: ERROR_TYPES.NOT_FOUND,
          message: 'The requested resource was not found.',
          details: data?.detail || 'Not found',
          retryable: false
        };
      
      case 422:
        return {
          type: ERROR_TYPES.VALIDATION,
          message: 'Please check your input and try again.',
          details: data?.detail || data?.message || 'Validation error',
          retryable: false
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ERROR_TYPES.SERVER,
          message: 'Server error occurred. Please try again later.',
          details: data?.detail || 'Server error',
          retryable: true
        };
      
      default:
        return {
          type: ERROR_TYPES.SERVER,
          message: data?.detail || data?.message || 'An error occurred',
          details: `HTTP ${status}`,
          retryable: status >= 500
        };
    }
  }

  // Signature-specific errors
  if (error.message?.includes('signature') || error.message?.includes('signing')) {
    return {
      type: ERROR_TYPES.SIGNATURE,
      message: 'Signature processing failed. Please try again.',
      details: error.message,
      retryable: true
    };
  }

  // Document conversion errors
  if (error.message?.includes('conversion') || error.message?.includes('convert')) {
    return {
      type: ERROR_TYPES.CONVERSION,
      message: 'Document conversion failed. Please try a different file format.',
      details: error.message,
      retryable: false
    };
  }

  // Generic error
  return {
    type: ERROR_TYPES.UNKNOWN,
    message: error.message || 'An unexpected error occurred',
    details: error.stack,
    retryable: false
  };
};

/**
 * Get user-friendly error message based on error type
 * @param {Object} parsedError - Parsed error object
 * @returns {string} - User-friendly error message
 */
export const getUserFriendlyMessage = (parsedError) => {
  if (!parsedError) return 'An error occurred';

  const { type, message, details } = parsedError;

  // Add specific guidance based on error type
  switch (type) {
    case ERROR_TYPES.NETWORK:
      return `${message} If the problem persists, please contact support.`;
    
    case ERROR_TYPES.AUTHENTICATION:
      return `${message} You will be redirected to the login page.`;
    
    case ERROR_TYPES.PERMISSION:
      return `${message} Please contact your administrator if you believe this is an error.`;
    
    case ERROR_TYPES.VALIDATION:
      return `${message} Please review the highlighted fields and correct any errors.`;
    
    case ERROR_TYPES.CONVERSION:
      return `${message} Supported formats include PDF, Word, Excel, and image files.`;
    
    case ERROR_TYPES.SIGNATURE:
      return `${message} Make sure all required fields are completed.`;
    
    case ERROR_TYPES.SERVER:
      return `${message} If the problem continues, please contact support.`;
    
    default:
      return message;
  }
};

/**
 * Check if an error is retryable
 * @param {Object} parsedError - Parsed error object
 * @returns {boolean} - Whether the error is retryable
 */
export const isRetryable = (parsedError) => {
  return parsedError?.retryable || false;
};

/**
 * Get retry delay based on error type
 * @param {Object} parsedError - Parsed error object
 * @param {number} attemptCount - Number of retry attempts
 * @returns {number} - Delay in milliseconds
 */
export const getRetryDelay = (parsedError, attemptCount = 1) => {
  if (!isRetryable(parsedError)) return 0;

  // Exponential backoff with jitter
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), maxDelay);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter
  
  return delay + jitter;
};

/**
 * Log error for debugging and monitoring
 * @param {Error} error - Original error
 * @param {Object} parsedError - Parsed error
 * @param {Object} context - Additional context information
 */
export const logError = (error, parsedError, context = {}) => {
  const logData = {
    timestamp: new Date().toISOString(),
    errorType: parsedError.type,
    message: parsedError.message,
    details: parsedError.details,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', logData);
    console.error('Original error:', error);
  }

  // In production, you might want to send this to a logging service
  // Example: sendToLoggingService(logData);
};

/**
 * Handle error with full context
 * @param {Error} error - The error to handle
 * @param {Object} context - Additional context
 * @returns {Object} - Handled error information
 */
export const handleError = (error, context = {}) => {
  const parsedError = parseError(error);
  const userMessage = getUserFriendlyMessage(parsedError);
  
  // Log the error
  logError(error, parsedError, context);
  
  return {
    ...parsedError,
    userMessage,
    timestamp: new Date().toISOString()
  };
};
