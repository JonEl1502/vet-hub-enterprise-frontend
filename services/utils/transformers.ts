/**
 * Data Transformers for API Responses
 */

/**
 * Recursively convert BigInt values to strings
 * This is needed because JSON.stringify cannot serialize BigInt
 */
export const convertBigIntToString = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToString(obj[key]);
      }
    }
    return converted;
  }

  return obj;
};

/**
 * Convert date strings to Date objects
 * Handles common date formats from API
 */
export const transformDates = (obj: any, dateFields: string[] = []): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformDates(item, dateFields));
  }

  const transformed: any = { ...obj };

  // Common date field names
  const commonDateFields = [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'joinedAt',
    'lastVisitAt',
    'dob',
    'date',
    'visitDate',
    'expiryDate',
    'settledAt',
    ...dateFields,
  ];

  for (const key in transformed) {
    if (transformed.hasOwnProperty(key)) {
      const value = transformed[key];

      // Check if this is a date field
      if (commonDateFields.includes(key) && typeof value === 'string') {
        try {
          transformed[key] = new Date(value);
        } catch (error) {
          // If parsing fails, keep the original value
          console.warn(`Failed to parse date field "${key}":`, value);
        }
      }
      // Recursively transform nested objects
      else if (typeof value === 'object' && value !== null) {
        transformed[key] = transformDates(value, dateFields);
      }
    }
  }

  return transformed;
};

/**
 * Transform API response to frontend format
 * Handles BigInt conversion and date parsing
 */
export const transformApiResponse = <T = any>(data: any, options?: { 
  convertBigInt?: boolean;
  parseDates?: boolean;
  dateFields?: string[];
}): T => {
  const {
    convertBigInt = true,
    parseDates = false,
    dateFields = [],
  } = options || {};

  let transformed = data;

  // Convert BigInt to string
  if (convertBigInt) {
    transformed = convertBigIntToString(transformed);
  }

  // Parse date strings to Date objects
  if (parseDates) {
    transformed = transformDates(transformed, dateFields);
  }

  return transformed as T;
};

/**
 * Sanitize request data before sending to API
 * Removes undefined values, empty strings (optional), etc.
 */
export const sanitizeRequestData = (data: any, options?: {
  removeUndefined?: boolean;
  removeNull?: boolean;
  removeEmptyStrings?: boolean;
}): any => {
  const {
    removeUndefined = true,
    removeNull = false,
    removeEmptyStrings = false,
  } = options || {};

  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item, options));
  }

  const sanitized: any = {};

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];

      // Skip undefined values
      if (removeUndefined && value === undefined) {
        continue;
      }

      // Skip null values
      if (removeNull && value === null) {
        continue;
      }

      // Skip empty strings
      if (removeEmptyStrings && value === '') {
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeRequestData(value, options);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
};

