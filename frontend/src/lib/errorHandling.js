import { toast } from "sonner";

/**
 * Error Types and Status Codes
 */
const ERROR_TYPES = {
  VALIDATION_ERROR: "validation_error",
  AUTHENTICATION_ERROR: "authentication_error",
  AUTHORIZATION_ERROR: "authorization_error",
  NOT_FOUND_ERROR: "not_found_error",
  NETWORK_ERROR: "network_error",
  SERVER_ERROR: "server_error",
  UNKNOWN_ERROR: "unknown_error",
};

const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Error Messages
 */
const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error: Please check your connection and try again",
  SERVER_ERROR: "Server error: Please try again later",
  UNAUTHORIZED: "Unauthorized: Please log in again",
  FORBIDDEN: "Forbidden: You do not have permission to perform this action",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation error: Please check your input",
  UNKNOWN_ERROR: "An unexpected error occurred",
};

/**
 * Success Messages
 */
const SUCCESS_MESSAGES = {
  KYC_SUBMITTED: "KYC submitted successfully",
  FILE_UPLOADED: "File uploaded successfully",
  OPERATION_SUCCESS: "Operation completed successfully",
};

/**
 * Validation Messages
 */
const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: "This field is required",
  INVALID_FORMAT: "Invalid format",
  TOO_SHORT: "Input is too short",
  TOO_LONG: "Input is too long",
  INVALID_EMAIL: "Invalid email address",
  INVALID_PHONE: "Invalid phone number",
  INVALID_CNIC: "Invalid CNIC/National ID",
  FILE_REQUIRED: "File is required",
  FILE_TOO_LARGE: "File size exceeds the maximum limit",
  FILE_TYPE_NOT_ALLOWED: "File type is not allowed",
};

/**
 * File Validation Constants
 */
const FILE_VALIDATION = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/jpg", "image/png"],
  ALLOWED_DOCUMENT_TYPES: ["application/pdf"],
  ALLOWED_ALL_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
  ],
};

/**
 * KYC Validation Patterns
 */
const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(?:\+\d{1,3})?(?:[-.\s]?\d{1,4}){2}[-.\s]?\d{1,9}$/,
  CNIC: /^\d{10,20}$/,
};

/**
 * Classifies API error and returns structured error object
 *
 * Analyzes error response from API and determines error type,
 * status code, and user-friendly message.
 *
 * @param {Error|Object} error - Error object from API or fetch
 * @returns {Object} Structured error object with:
 *   - type: Error type (validation_error, auth_error, etc.)
 *   - status: HTTP status code (if available)
 *   - message: User-friendly error message
 *   - originalError: Original error object
 *   - details: Additional error details (if available)
 *
 * @example
 * try {
 *   await api.get('/endpoint');
 * } catch (error) {
 *   const classified = classifyError(error);
 *   console.log(classified.type); // 'authentication_error'
 *   console.log(classified.message); // 'Unauthorized: Please log in again'
 * }
 */
const classifyError = (error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;

  let type = ERROR_TYPES.UNKNOWN_ERROR;
  let message = ERROR_MESSAGES.UNKNOWN_ERROR;

  if (error?.message?.includes("fetch") || error?.name === "TypeError") {
    type = ERROR_TYPES.NETWORK_ERROR;
    message = ERROR_MESSAGES.NETWORK_ERROR;
  } else if (
    status === HTTP_STATUS_CODES.BAD_REQUEST ||
    status === HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY
  ) {
    type = ERROR_TYPES.VALIDATION_ERROR;
    message = data?.message || ERROR_MESSAGES.VALIDATION_ERROR;
  } else if (status === HTTP_STATUS_CODES.UNAUTHORIZED) {
    type = ERROR_TYPES.AUTHENTICATION_ERROR;
    message = ERROR_MESSAGES.UNAUTHORIZED;
  } else if (status === HTTP_STATUS_CODES.FORBIDDEN) {
    type = ERROR_TYPES.AUTHORIZATION_ERROR;
    message = ERROR_MESSAGES.FORBIDDEN;
  } else if (status === HTTP_STATUS_CODES.NOT_FOUND) {
    type = ERROR_TYPES.NOT_FOUND_ERROR;
    message = ERROR_MESSAGES.NOT_FOUND;
  } else if (status >= HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR) {
    type = ERROR_TYPES.SERVER_ERROR;
    message = ERROR_MESSAGES.SERVER_ERROR;
  } else if (data?.message) {
    message = data.message;
  } else if (error?.message) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  return {
    type,
    status,
    message,
    originalError: error,
    details: data?.errors || data?.details || null,
  };
};

/**
 * Handles API errors with toast notification
 *
 * Classifies error, displays user-friendly message via toast,
 * and logs error in development environment.
 *
 * @param {Error|Object} error - Error object from API or fetch
 * @param {string} fallbackMessage - Fallback message if error cannot be classified
 * @returns {Object} Classified error object
 *
 * @example
 * try {
 *   await api.post('/kyc/submit', data);
 * } catch (error) {
 *   const classified = handleApiError(error, 'Failed to submit KYC');
 *   // Toast will display: "Failed to submit KYC" or specific error message
 * }
 */
export const handleApiError = (
  error,
  fallbackMessage = ERROR_MESSAGES.UNKNOWN_ERROR,
) => {
  const classified = classifyError(error);
  const displayMessage = classified.message || fallbackMessage;

  // Show toast notification
  toast.error(displayMessage);

  // Log in development environment
  if (import.meta.env.DEV) {
    console.error("API Error:", {
      type: classified.type,
      status: classified.status,
      message: displayMessage,
      details: classified.details,
      originalError: classified.originalError,
    });
  }

  return classified;
};

/**
 * Handles successful API responses with toast notification
 *
 * Displays success message via toast and returns response data.
 *
 * @param {string} message - Success message to display
 * @param {*} data - Response data to return
 * @returns {Object} Success object with message and data
 *
 * @example
 * try {
 *   const response = await api.post('/kyc/submit', formData);
 *   const result = handleApiSuccess('KYC submitted successfully', response.data);
 *   // Toast will display: "KYC submitted successfully"
 * } catch (error) {
 *   handleApiError(error);
 * }
 */
export const handleApiSuccess = (message, data = null) => {
  toast.success(message);

  if (import.meta.env.DEV) {
    console.log("API Success:", { message, data });
  }

  return {
    success: true,
    message,
    data,
  };
};

/**
 * Creates initial loading state object
 *
 * Provides a standardized loading state structure for components
 * managing asynchronous operations.
 *
 * @param {Object} initialState - Additional initial state properties
 * @returns {Object} Loading state object with:
 *   - loading: Boolean indicating if operation is in progress
 *   - error: Error object or null
 *   - success: Success flag or null
 *   - ...initialState: Additional properties
 *
 * @example
 * const [state, setState] = useState(
 *   createLoadingState({ data: null, retries: 0 })
 * );
 * // Result:
 * // {
 * //   loading: false,
 * //   error: null,
 * //   success: null,
 * //   data: null,
 * //   retries: 0
 * // }
 */
export const createLoadingState = (initialState = {}) => {
  return {
    loading: false,
    error: null,
    success: null,
    ...initialState,
  };
};

/**
 * Validates basic KYC form data
 *
 * Validates user KYC information including:
 * - Full name (required, non-empty)
 * - CNIC/National ID (required, valid format)
 * - Selfie photo (required)
 * - ID card photo (required)
 *
 * @param {Object} data - Form data object containing:
 *   - fullName: User's full name
 *   - cnic: CNIC/National ID number
 *   - selfie: Selfie photo file
 *   - idCard: ID card photo file
 * @returns {Object} Validation result with:
 *   - isValid: Boolean indicating if all validations passed
 *   - errors: Object with field-specific error messages
 *
 * @example
 * const formData = {
 *   fullName: 'John Doe',
 *   cnic: '12345678901',
 *   selfie: selfieFile,
 *   idCard: idCardFile
 * };
 *
 * const { isValid, errors } = validateBasicKyc(formData);
 * if (!isValid) {
 *   console.log('Validation errors:', errors);
 * }
 */
export const validateBasicKyc = (data) => {
  const errors = {};

  // Validate full name
  if (!data?.fullName?.trim()) {
    errors.fullName = VALIDATION_MESSAGES.REQUIRED_FIELD;
  } else if (data.fullName.trim().length < 3) {
    errors.fullName = VALIDATION_MESSAGES.TOO_SHORT;
  } else if (data.fullName.trim().length > 100) {
    errors.fullName = VALIDATION_MESSAGES.TOO_LONG;
  }

  // Validate CNIC
  if (!data?.cnic?.trim()) {
    errors.cnic = VALIDATION_MESSAGES.REQUIRED_FIELD;
  } else if (!VALIDATION_PATTERNS.CNIC.test(data.cnic.trim())) {
    errors.cnic = VALIDATION_MESSAGES.INVALID_CNIC;
  }

  // Validate selfie
  if (!data?.selfie) {
    errors.selfie = VALIDATION_MESSAGES.FILE_REQUIRED;
  } else {
    const selfieValidation = validateFile(data.selfie, {
      maxSize: FILE_VALIDATION.MAX_SIZE_BYTES,
      allowedTypes: FILE_VALIDATION.ALLOWED_IMAGE_TYPES,
      required: true,
    });
    if (!selfieValidation.isValid) {
      errors.selfie = selfieValidation.error;
    }
  }

  // Validate ID card
  if (!data?.idCard) {
    errors.idCard = VALIDATION_MESSAGES.FILE_REQUIRED;
  } else {
    const idCardValidation = validateFile(data.idCard, {
      maxSize: FILE_VALIDATION.MAX_SIZE_BYTES,
      allowedTypes: FILE_VALIDATION.ALLOWED_IMAGE_TYPES,
      required: true,
    });
    if (!idCardValidation.isValid) {
      errors.idCard = idCardValidation.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validates lister/business KYC form data
 *
 * Validates business KYC information including:
 * - Company name (required, non-empty)
 * - Registration ID (required, non-empty)
 * - Business license (required, file)
 * - Property proof (required, file)
 *
 * @param {Object} data - Form data object containing:
 *   - companyName: Company's legal name
 *   - registrationId: Business registration ID
 *   - businessLicense: Business license file
 *   - propertyProof: Property proof document file
 * @returns {Object} Validation result with:
 *   - isValid: Boolean indicating if all validations passed
 *   - errors: Object with field-specific error messages
 *
 * @example
 * const businessData = {
 *   companyName: 'ABC Properties Ltd',
 *   registrationId: 'REG-12345',
 *   businessLicense: licenseFile,
 *   propertyProof: proofFile
 * };
 *
 * const { isValid, errors } = validateListerKyc(businessData);
 * if (!isValid) {
 *   Object.entries(errors).forEach(([field, error]) => {
 *     console.log(`${field}: ${error}`);
 *   });
 * }
 */
export const validateListerKyc = (data) => {
  const errors = {};

  // Validate company name
  if (!data?.companyName?.trim()) {
    errors.companyName = VALIDATION_MESSAGES.REQUIRED_FIELD;
  } else if (data.companyName.trim().length < 3) {
    errors.companyName = VALIDATION_MESSAGES.TOO_SHORT;
  } else if (data.companyName.trim().length > 200) {
    errors.companyName = VALIDATION_MESSAGES.TOO_LONG;
  }

  // Validate registration ID
  if (!data?.registrationId?.trim()) {
    errors.registrationId = VALIDATION_MESSAGES.REQUIRED_FIELD;
  } else if (data.registrationId.trim().length < 3) {
    errors.registrationId = VALIDATION_MESSAGES.TOO_SHORT;
  }

  // Validate business license
  if (!data?.businessLicense) {
    errors.businessLicense = VALIDATION_MESSAGES.FILE_REQUIRED;
  } else {
    const licenseValidation = validateFile(data.businessLicense, {
      maxSize: FILE_VALIDATION.MAX_SIZE_BYTES,
      allowedTypes: FILE_VALIDATION.ALLOWED_ALL_TYPES,
      required: true,
    });
    if (!licenseValidation.isValid) {
      errors.businessLicense = licenseValidation.error;
    }
  }

  // Validate property proof
  if (!data?.propertyProof) {
    errors.propertyProof = VALIDATION_MESSAGES.FILE_REQUIRED;
  } else {
    const propertyValidation = validateFile(data.propertyProof, {
      maxSize: FILE_VALIDATION.MAX_SIZE_BYTES,
      allowedTypes: FILE_VALIDATION.ALLOWED_ALL_TYPES,
      required: true,
    });
    if (!propertyValidation.isValid) {
      errors.propertyProof = propertyValidation.error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validates file against size and type constraints
 *
 * Checks file size and MIME type against specified limits.
 * Supports custom validation options for flexible usage.
 *
 * @param {File} file - File object to validate
 * @param {Object} options - Validation options:
 *   - maxSize: Maximum file size in bytes (default: 10MB)
 *   - allowedTypes: Array of allowed MIME types
 *   - required: Whether file is required (default: true)
 * @returns {Object} Validation result with:
 *   - isValid: Boolean indicating if file passed validation
 *   - error: Error message (null if valid)
 *
 * @example
 * const file = event.target.files[0];
 * const validation = validateFile(file, {
 *   maxSize: 5 * 1024 * 1024, // 5MB
 *   allowedTypes: ['image/jpeg', 'image/png'],
 *   required: true
 * });
 *
 * if (!validation.isValid) {
 *   console.error(validation.error);
 * }
 */
export const validateFile = (file, options = {}) => {
  const {
    maxSize = FILE_VALIDATION.MAX_SIZE_BYTES,
    allowedTypes = FILE_VALIDATION.ALLOWED_ALL_TYPES,
    required = true,
  } = options;

  // Check if file is required
  if (!file && required) {
    return {
      isValid: false,
      error: VALIDATION_MESSAGES.FILE_REQUIRED,
    };
  }

  // File not provided and not required
  if (!file) {
    return {
      isValid: true,
      error: null,
    };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024);
    return {
      isValid: false,
      error: `${VALIDATION_MESSAGES.FILE_TOO_LARGE} (${maxSizeMB}MB max)`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    const typeList = allowedTypes.join(", ");
    return {
      isValid: false,
      error: `${VALIDATION_MESSAGES.FILE_TYPE_NOT_ALLOWED} (${typeList})`,
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

/**
 * Makes API request with proper headers and error handling
 *
 * Wraps fetch API with:
 * - Automatic Authorization header
 * - Content-Type header management
 * - FormData support (no Content-Type for multipart)
 * - Response parsing (JSON/text)
 * - Error handling and transformation
 * - Network error detection
 *
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options:
 *   - method: HTTP method (GET, POST, etc.)
 *   - body: Request body (object, FormData, or string)
 *   - headers: Custom headers to merge
 *   - ... any other fetch options
 * @returns {Promise<Object>} Response object with:
 *   - data: Parsed response data
 *   - response: Fetch Response object
 * @throws {Error} If request fails or response is not ok
 *
 * @example
 * // GET request
 * const { data } = await apiRequest('/api/portfolio');
 *
 * // POST with JSON
 * const { data } = await apiRequest('/api/kyc/submit', {
 *   method: 'POST',
 *   body: JSON.stringify(kycData)
 * });
 *
 * // POST with FormData
 * const formData = new FormData();
 * formData.append('file', file);
 * formData.append('name', 'John Doe');
 * const { data } = await apiRequest('/api/upload', {
 *   method: 'POST',
 *   body: formData
 * });
 */
export const apiRequest = async (url, options = {}) => {
  try {
    // Get authorization token
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("authToken") || localStorage.getItem("token")
        : null;

    // Build headers
    const defaultHeaders = {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(!options.body && { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    };

    // Don't set Content-Type for FormData (browser will set it with boundary)
    if (options.body instanceof FormData) {
      delete defaultHeaders["Content-Type"];
    }

    // Make request
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
    });

    // Parse response
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle non-ok responses
    if (!response.ok) {
      const error = new Error(
        data?.message ||
          data ||
          `HTTP ${response.status}: ${response.statusText}`,
      );
      error.response = { status: response.status, data };
      throw error;
    }

    return { data, response };
  } catch (error) {
    // Detect network errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      const networkError = new Error(ERROR_MESSAGES.NETWORK_ERROR);
      networkError.type = ERROR_TYPES.NETWORK_ERROR;
      throw networkError;
    }

    throw error;
  }
};

/**
 * Retries failed requests with exponential backoff
 *
 * Automatically retries failed requests with exponential backoff delay:
 * - 1st retry: delay milliseconds
 * - 2nd retry: delay * 2 milliseconds
 * - 3rd retry: delay * 4 milliseconds
 * - etc.
 *
 * @param {Function} requestFn - Async function that makes the request
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} delay - Initial delay in milliseconds (default: 1000)
 * @returns {Promise} Result from successful request
 * @throws {Error} Last error if all retries fail
 *
 * @example
 * // Basic retry
 * const result = await retryApiRequest(
 *   () => apiRequest('/api/data'),
 *   3,  // max 3 retries
 *   1000 // 1 second initial delay
 * );
 *
 * // With custom logic
 * const data = await retryApiRequest(async () => {
 *   const { data } = await apiRequest('/api/kyc/submit', {
 *     method: 'POST',
 *     body: JSON.stringify(formData)
 *   });
 *   return data;
 * });
 */
export const retryApiRequest = async (
  requestFn,
  maxRetries = 3,
  delay = 1000,
) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a network error
      const isNetworkError =
        error?.type === ERROR_TYPES.NETWORK_ERROR ||
        error?.message?.includes("Network error");
      const isServerError = error?.response?.status >= 500;

      if (!isNetworkError && !isServerError) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        const backoffDelay = delay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }

      if (import.meta.env.DEV) {
        console.log(
          `Retry attempt ${i + 1}/${maxRetries} after ${
            delay * Math.pow(2, i)
          }ms`,
        );
      }
    }
  }

  throw lastError;
};

/**
 * Batch validates multiple form fields
 *
 * Validates multiple fields against custom validators in parallel.
 *
 * @param {Object} data - Form data object
 * @param {Object} validators - Object with field names as keys and validator functions as values
 * @returns {Object} Validation result with:
 *   - isValid: Boolean indicating if all validations passed
 *   - errors: Object with field-specific error messages
 *
 * @example
 * const { isValid, errors } = batchValidateFields(
 *   { email: 'test@example.com', password: 'pass123' },
 *   {
 *     email: (value) => {
 *       if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
 *         return VALIDATION_MESSAGES.INVALID_EMAIL;
 *       }
 *       return null;
 *     },
 *     password: (value) => {
 *       if (value.length < 8) return 'Password must be at least 8 characters';
 *       return null;
 *     }
 *   }
 * );
 */
export const batchValidateFields = (data, validators) => {
  const errors = {};

  Object.entries(validators).forEach(([field, validator]) => {
    const error = validator(data?.[field]);
    if (error) {
      errors[field] = error;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validates email address format
 *
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 *
 * @example
 * if (validateEmail('test@example.com')) {
 *   // Valid email
 * }
 */
export const validateEmail = (email) => {
  return VALIDATION_PATTERNS.EMAIL.test(email?.trim() || "");
};

/**
 * Validates phone number format
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone format is valid
 *
 * @example
 * if (validatePhone('+1-234-567-8900')) {
 *   // Valid phone
 * }
 */
export const validatePhone = (phone) => {
  return VALIDATION_PATTERNS.PHONE.test(phone?.trim() || "");
};

/**
 * Validates CNIC/National ID format
 *
 * @param {string} cnic - CNIC/National ID to validate
 * @returns {boolean} True if CNIC format is valid
 *
 * @example
 * if (validateCnic('12345678901')) {
 *   // Valid CNIC
 * }
 */
export const validateCnic = (cnic) => {
  return VALIDATION_PATTERNS.CNIC.test(cnic?.trim() || "");
};
