import { api } from "@/services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer } from "react";
import { toast } from "sonner";

/**
 * API Endpoint Constants
 */
const API_ENDPOINTS = {
  KYC_SUBMIT: "/kyc/submit-kyc",
};

/**
 * Query Key Constants
 */
const QUERY_KEYS = {
  KYC_STATUS: ["kycStatus"],
};

/**
 * Form Status Constants
 */
const FORM_STATUS = {
  IDLE: "idle",
  EDITING: "editing",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  ERROR: "error",
};

/**
 * Document Type Constants
 */
const DOCUMENT_TYPES = {
  PASSPORT: "passport",
  NATIONAL_ID: "nationalId",
  DRIVERS_LICENSE: "driversLicense",
  VISA: "visa",
};

/**
 * Form Field Constants
 */
const FORM_FIELDS = {
  FULL_NAME: "fullName",
  DOB: "dob",
  ADDRESS: "address",
  DOCUMENT_TYPE: "documentType",
  DOCUMENT_ID: "documentId",
  DOCUMENT_FILE: "documentFile",
};

/**
 * Toast Messages
 */
const TOAST_MESSAGES = {
  SUBMIT_SUCCESS: "KYC submission successful! Awaiting review.",
  SUBMIT_FAILED: "Submission failed. Please check your inputs.",
  INVALID_FILE: "Invalid file. Please upload a valid document.",
  FILE_TOO_LARGE: "File size exceeds 10MB limit.",
  SUBMISSION_ERROR: "An error occurred during submission.",
};

/**
 * Validation error messages
 */
const VALIDATION_ERRORS = {
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Please enter a valid email",
  INVALID_PHONE: "Please enter a valid phone number",
  INVALID_DATE: "Please enter a valid date",
  FILE_REQUIRED: "Please upload a document file",
  FILE_SIZE: "File must be less than 10MB",
  FILE_TYPE: "Only PDF, JPG, and PNG files are allowed",
};

/**
 * Initial form state
 */
const initialState = {
  status: FORM_STATUS.IDLE,
  formData: {
    [FORM_FIELDS.FULL_NAME]: "",
    [FORM_FIELDS.DOB]: "",
    [FORM_FIELDS.ADDRESS]: "",
    [FORM_FIELDS.DOCUMENT_TYPE]: DOCUMENT_TYPES.PASSPORT,
    [FORM_FIELDS.DOCUMENT_ID]: "",
    [FORM_FIELDS.DOCUMENT_FILE]: null,
  },
  errors: {},
  touched: {},
};

/**
 * KYC Form Reducer
 *
 * Manages form state including:
 * - Form data updates
 * - Form status (idle, editing, submitting, success, error)
 * - Field-level errors
 * - Touched field tracking
 * - Form reset
 *
 * @param {Object} state - Current state
 * @param {Object} action - Action object with type and payload
 * @returns {Object} Updated state
 */
function kycFormReducer(state, action) {
  switch (action.type) {
    case "UPDATE_FIELD":
      return {
        ...state,
        status: FORM_STATUS.EDITING,
        formData: {
          ...state.formData,
          ...action.payload,
        },
        errors: {
          ...state.errors,
          // Clear errors for updated fields
          ...Object.fromEntries(
            Object.keys(action.payload).map((key) => [key, null]),
          ),
        },
      };

    case "MARK_TOUCHED":
      return {
        ...state,
        touched: {
          ...state.touched,
          ...action.payload,
        },
      };

    case "SET_STATUS":
      return {
        ...state,
        status: action.payload,
      };

    case "SET_ERRORS":
      return {
        ...state,
        status: FORM_STATUS.ERROR,
        errors: action.payload,
      };

    case "RESET":
      return initialState;

    case "RESET_ERRORS":
      return {
        ...state,
        errors: {},
        status: FORM_STATUS.IDLE,
      };

    default:
      return state;
  }
}

/**
 * Validates file size
 *
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum file size in MB (default: 10)
 * @returns {boolean} True if file is within size limit
 */
const validateFileSize = (file, maxSizeMB = 10) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validates file type
 *
 * @param {File} file - File to validate
 * @returns {boolean} True if file type is allowed
 */
const validateFileType = (file) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  return allowedTypes.includes(file.type);
};

/**
 * Submits KYC form data to backend
 *
 * Creates FormData object with all form fields and uploads as multipart/form-data.
 * Handles file validation before submission.
 *
 * @param {Object} formData - Form data object
 * @returns {Promise} API response promise
 * @throws {Error} If file validation fails or API request fails
 */
const submitKycForm = async (formData) => {
  // Validate file if present
  if (formData[FORM_FIELDS.DOCUMENT_FILE]) {
    const file = formData[FORM_FIELDS.DOCUMENT_FILE];

    if (!validateFileType(file)) {
      throw new Error(VALIDATION_ERRORS.FILE_TYPE);
    }

    if (!validateFileSize(file)) {
      throw new Error(VALIDATION_ERRORS.FILE_SIZE);
    }
  }

  // Create FormData for multipart upload
  const data = new FormData();
  Object.entries(formData).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      data.append(key, value);
    }
  });

  try {
    const response = await api.post(API_ENDPOINTS.KYC_SUBMIT, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("KYC submission error:", error);
    }
    throw error;
  }
};

/**
 * Hook: useKycForm
 *
 * Manages KYC form state and submission logic.
 *
 * Features:
 * - Form data management with reducer pattern
 * - Field-level error tracking
 * - Touched field tracking for validation display
 * - File validation (type and size)
 * - API submission with retry logic
 * - Query invalidation on success
 * - User feedback with toast notifications
 * - Form reset capability
 *
 * Returns:
 * @returns {Object} Hook return object containing:
 *   - state: Current form state (formData, status, errors, touched)
 *   - dispatch: Reducer dispatch function
 *   - mutation: TanStack Query mutation object (isPending, isError, etc.)
 *   - updateField: Callback to update form field
 *   - markTouched: Callback to mark field as touched
 *   - setErrors: Callback to set field errors
 *   - setStatus: Callback to set form status
 *   - resetErrors: Callback to clear errors
 *   - submitForm: Callback to submit form
 *   - reset: Callback to reset entire form
 *
 * Usage:
 * ```jsx
 * const {
 *   state,
 *   updateField,
 *   markTouched,
 *   submitForm,
 *   mutation,
 *   reset,
 * } = useKycForm();
 *
 * const handleNameChange = (e) => {
 *   updateField({ [FORM_FIELDS.FULL_NAME]: e.target.value });
 * };
 *
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   await submitForm();
 * };
 *
 * return (
 *   <form onSubmit={handleSubmit}>
 *     <input
 *       value={state.formData.fullName}
 *       onChange={handleNameChange}
 *       onBlur={() => markTouched({ fullName: true })}
 *     />
 *     {state.touched.fullName && state.errors.fullName && (
 *       <span className="text-destructive">{state.errors.fullName}</span>
 *     )}
 *     <button disabled={mutation.isPending}>
 *       {mutation.isPending ? "Submitting..." : "Submit KYC"}
 *     </button>
 *   </form>
 * );
 * ```
 *
 * State Shape:
 * ```javascript
 * {
 *   status: 'idle' | 'editing' | 'submitting' | 'success' | 'error',
 *   formData: {
 *     fullName: string,
 *     dob: string (YYYY-MM-DD),
 *     address: string,
 *     documentType: 'passport' | 'nationalId' | 'driversLicense' | 'visa',
 *     documentId: string,
 *     documentFile: File | null,
 *   },
 *   errors: { [fieldName]: errorMessage },
 *   touched: { [fieldName]: boolean },
 * }
 * ```
 *
 * Mutation States:
 * - isPending: Form is being submitted
 * - isError: Submission failed
 * - isSuccess: Submission succeeded
 * - data: API response data
 * - error: Error object if submission failed
 *
 * Performance Notes:
 * - Uses reducer for efficient state updates
 * - Memoized callbacks prevent unnecessary re-renders
 * - File validation before submission
 * - Proper error handling and user feedback
 * - Query invalidation for cache updates
 */
export const useKycForm = () => {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(kycFormReducer, initialState);

  // Memoized callback to update form field
  const updateField = useCallback((fieldUpdates) => {
    dispatch({
      type: "UPDATE_FIELD",
      payload: fieldUpdates,
    });
  }, []);

  // Memoized callback to mark field as touched
  const markTouched = useCallback((touchedFields) => {
    dispatch({
      type: "MARK_TOUCHED",
      payload: touchedFields,
    });
  }, []);

  // Memoized callback to set errors
  const setErrors = useCallback((errors) => {
    dispatch({
      type: "SET_ERRORS",
      payload: errors,
    });
  }, []);

  // Memoized callback to set status
  const setStatus = useCallback((status) => {
    dispatch({
      type: "SET_STATUS",
      payload: status,
    });
  }, []);

  // Memoized callback to reset errors
  const resetErrors = useCallback(() => {
    dispatch({ type: "RESET_ERRORS" });
  }, []);

  // Memoized callback to reset form
  const resetForm = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Mutation for KYC submission
  const mutation = useMutation({
    mutationFn: () => submitKycForm(state.formData),
    onMutate: () => {
      dispatch({ type: "SET_STATUS", payload: FORM_STATUS.SUBMITTING });
    },
    onSuccess: (response) => {
      toast.success(TOAST_MESSAGES.SUBMIT_SUCCESS);
      dispatch({ type: "SET_STATUS", payload: FORM_STATUS.SUCCESS });

      // Invalidate KYC status query to trigger refetch
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.KYC_STATUS,
      });

      // Reset form after successful submission
      setTimeout(() => {
        resetForm();
      }, 1500);

      return response;
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        TOAST_MESSAGES.SUBMIT_FAILED;
      const fieldErrors = error.response?.data?.errors || {};

      toast.error(errorMessage);
      dispatch({
        type: "SET_ERRORS",
        payload: fieldErrors,
      });
    },
    retry: 1,
    retryDelay: 1000,
  });

  // Memoized callback to submit form
  const submitForm = useCallback(async () => {
    try {
      await mutation.mutateAsync();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Form submission error:", error);
      }
    }
  }, [mutation]);

  return {
    state,
    dispatch,
    mutation,
    updateField,
    markTouched,
    setErrors,
    setStatus,
    resetErrors,
    submitForm,
    reset: resetForm,
  };
};
