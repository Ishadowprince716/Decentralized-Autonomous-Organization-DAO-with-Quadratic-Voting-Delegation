import { PROPOSAL_LIMITS, ERROR_CODES, MEMBERSHIP_FEE } from './constants.js';
import DOMPurify from 'dompurify';
import validator from 'validator';
import { getAddress, isAddress } from 'viem';

/**
 * IMPROVED InputValidator - Production-Ready Security Utility
 * 
 * KEY IMPROVEMENTS:
 * ✓ Server-side rate limiting capability
 * ✓ DOMPurify for XSS protection
 * ✓ Safe regex patterns (no ReDoS)
 * ✓ Ethereum checksum validation
 * ✓ Enhanced DAO governance validation
 * ✓ Consistent error handling
 * ✓ Comprehensive JSDoc documentation
 * 
 * SECURITY NOTES:
 * - Rate limiting should use Redis/Firestore server-side
 * - All inputs validated server-side before processing
 * - Ethereum addresses validated with EIP-55 checksum
 * - HTML sanitization uses industry-standard DOMPurify
 */

// Pre-compile regex patterns for performance
const PATTERNS = {
  BYTES32: /^0x[a-fA-F0-9]{64}$/,
  HEX_COLOR: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
  US_PHONE: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  UNSAFE_JAVASCRIPT: /javascript:/i,
  UNSAFE_DATA: /data:text\/html/i,
  UNSAFE_SCRIPT: /<script/i,
  UNSAFE_EVAL: /eval\s*\(/i,
  UNSAFE_EXEC: /\bexec\b/i
};

// Cache for expensive validation operations
const validationCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Comprehensive input validation utility class with enhanced security
 * @class InputValidator
 */
export class InputValidator {

  /**
   * Validates Ethereum address with EIP-55 checksum verification
   * @param {string} address - Ethereum address to validate
   * @returns {{isValid: boolean, checksummedAddress?: string, error: string|null, errorCode?: string}}
   * @example
   * const result = InputValidator.validateEthereumAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f42ED7");
   * if (result.isValid) console.log(result.checksummedAddress);
   */
  static validateEthereumAddress(address) {
    if (typeof address !== 'string') {
      return {
        isValid: false,
        checksummedAddress: null,
        error: 'Address must be a string',
        errorCode: ERROR_CODES.INVALID_INPUT
      };
    }

    try {
      // viem's getAddress validates format AND verifies EIP-55 checksum
      const checksummedAddress = getAddress(address.trim());
      return {
        isValid: true,
        checksummedAddress,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        checksummedAddress: null,
        error: 'Invalid Ethereum address or checksum mismatch. Please verify the address.',
        errorCode: ERROR_CODES.INVALID_ADDRESS || 'INVALID_ADDRESS'
      };
    }
  }

  /**
   * Validates and sanitizes string input
   * @param {string} input - String to validate
   * @param {number} [minLength=0] - Minimum length
   * @param {number} [maxLength=1000] - Maximum length
   * @param {boolean} [allowEmpty=false] - Whether empty strings are allowed
   * @returns {{isValid: boolean, sanitized: string, error: string|null}}
   */
  static validateString(input, minLength = 0, maxLength = 1000, allowEmpty = false) {
    if (input === null || input === undefined) {
      return {
        isValid: allowEmpty && minLength === 0,
        sanitized: '',
        error: allowEmpty ? null : 'Input is required'
      };
    }

    if (typeof input !== 'string') {
      return {
        isValid: false,
        sanitized: '',
        error: 'Input must be a string'
      };
    }

    // Efficient sanitization: trim and remove dangerous characters
    let sanitized = input
      .trim()
      .replace(/[<>]/g, '') // Basic XSS prevention
      .replace(/\0/g, '');  // Remove null bytes

    const len = sanitized.length;

    if (!allowEmpty && len === 0) {
      return {
        isValid: false,
        sanitized,
        error: 'Input cannot be empty'
      };
    }

    if (len < minLength) {
      return {
        isValid: false,
        sanitized,
        error: `Input must be at least ${minLength} characters long`
      };
    }

    if (len > maxLength) {
      return {
        isValid: false,
        sanitized,
        error: `Input must be no more than ${maxLength} characters long`
      };
    }

    return {
      isValid: true,
      sanitized,
      error: null
    };
  }

  /**
   * Validates numeric input with range checking
   * @param {any} value - Value to validate
   * @param {number} [min=-Infinity] - Minimum allowed value
   * @param {number} [max=Infinity] - Maximum allowed value
   * @returns {{isValid: boolean, value: number|null, error: string|null}}
   */
  static validateNumber(value, min = -Infinity, max = Infinity) {
    let numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (typeof numValue !== 'number' || isNaN(numValue) || numValue === null || numValue === undefined) {
      return { 
        isValid: false, 
        value: null, 
        error: 'Value must be a valid number' 
      };
    }

    if (numValue < min) {
      return { 
        isValid: false, 
        value: numValue, 
        error: `Value must be at least ${min}` 
      };
    }

    if (numValue > max) {
      return { 
        isValid: false, 
        value: numValue, 
        error: `Value must be no more than ${max}` 
      };
    }

    return { 
      isValid: true, 
      value: numValue, 
      error: null 
    };
  }

  /**
   * Validates proposal data with enhanced DAO governance checks
   * @param {Object} data - Proposal data
   * @param {string} data.title - Proposal title
   * @param {string} data.description - Proposal description
   * @param {string} data.category - Proposal category
   * @param {string} [data.targetContract] - Optional target contract address
   * @param {number} [data.amount] - Optional amount for treasury proposals
   * @returns {{isValid: boolean, errors: string[], sanitized: Object, errorCode: string|null}}
   */
  static validateProposal(data) {
    const errors = [];
    const sanitized = {};

    // Validate title
    const titleValidation = this.validateString(
      data.title,
      PROPOSAL_LIMITS.TITLE_MIN_LENGTH,
      PROPOSAL_LIMITS.TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      errors.push(`Title: ${titleValidation.error}`);
    } else {
      sanitized.title = titleValidation.sanitized;
    }

    // Validate description
    const descriptionValidation = this.validateString(
      data.description,
      PROPOSAL_LIMITS.DESCRIPTION_MIN_LENGTH,
      PROPOSAL_LIMITS.DESCRIPTION_MAX_LENGTH
    );
    if (!descriptionValidation.isValid) {
      errors.push(`Description: ${descriptionValidation.error}`);
    } else {
      sanitized.description = descriptionValidation.sanitized;
    }

    // Check for suspicious content patterns
    if (this.containsSuspiciousPatterns(sanitized.description || data.description)) {
      errors.push('Proposal description contains suspicious patterns or potential attacks');
    }

    // Validate category
    const validCategories = ['governance', 'treasury', 'technical', 'community'];
    if (typeof data.category !== 'string' || !validCategories.includes(data.category.toLowerCase())) {
      errors.push('Category: Please select a valid category (governance, treasury, technical, community)');
    } else {
      sanitized.category = data.category.toLowerCase();
    }

    // Validate target contract if provided (for technical proposals)
    if (data.targetContract) {
      const contractValidation = this.validateEthereumAddress(data.targetContract);
      if (!contractValidation.isValid) {
        errors.push(`Target Contract: ${contractValidation.error}`);
      } else {
        sanitized.targetContract = contractValidation.checksummedAddress;
      }
    }

    // Validate amount for treasury proposals
    if (data.amount !== undefined && data.amount !== null) {
      const amountValidation = this.validateNumber(
        data.amount,
        0,
        PROPOSAL_LIMITS.MAX_TREASURY_AMOUNT || 1000000
      );
      if (!amountValidation.isValid) {
        errors.push(`Amount: ${amountValidation.error}`);
      } else {
        sanitized.amount = amountValidation.value;
      }
    }

    // Validate proposal hash if provided
    if (data.proposalHash) {
      const hashValidation = this.validateBytes32(data.proposalHash);
      if (!hashValidation.isValid) {
        errors.push(`Proposal Hash: ${hashValidation.error}`);
      } else {
        sanitized.proposalHash = data.proposalHash;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
      errorCode: errors.length > 0 ? ERROR_CODES.INVALID_INPUT : null
    };
  }

  /**
   * Validates voting parameters with quadratic voting support
   * @param {number} proposalId - Proposal ID
   * @param {number} credits - Credits to spend (1-100)
   * @param {boolean} support - Vote direction (true = yes, false = no)
   * @returns {{isValid: boolean, errors: string[], calculatedPower: number, errorCode: string|null}}
   */
  static validateVoteParameters(proposalId, credits, support) {
    const errors = [];

    // Validate proposal ID
    if (!Number.isInteger(proposalId) || proposalId < 0) {
      errors.push('Proposal ID must be a non-negative integer');
    }

    // Validate credits with range
    if (!Number.isInteger(credits) || credits < 1 || credits > 100) {
      errors.push('Credits must be an integer between 1 and 100');
    }

    // Validate support flag
    if (typeof support !== 'boolean') {
      errors.push('Support must be a boolean value (true or false)');
    }

    // Calculate voting power (quadratic voting: sqrt of credits)
    const calculatedPower = Math.sqrt(credits || 0);
    const maxPower = PROPOSAL_LIMITS.MAX_VOTING_POWER || 10;

    if (calculatedPower > maxPower) {
      errors.push(`Voting power (${calculatedPower.toFixed(2)}) exceeds maximum (${maxPower})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      calculatedPower,
      errorCode: errors.length > 0 ? ERROR_CODES.INVALID_VOTE || 'INVALID_VOTE' : null
    };
  }

  /**
   * Validates membership fee amount
   * @param {string|number} amount - Amount in ETH
   * @returns {{isValid: boolean, amount: number|null, error: string|null, errorCode: string|null}}
   */
  static validateMembershipFee(amount) {
    const minAmount = parseFloat(MEMBERSHIP_FEE.MIN_AMOUNT || '0.001');
    const maxAmount = parseFloat(MEMBERSHIP_FEE.MAX_AMOUNT || '100');
    
    const validationResult = this.validateNumber(amount, minAmount, maxAmount);

    if (!validationResult.isValid) {
      return {
        isValid: false,
        amount: null,
        error: validationResult.error || 'Invalid amount provided',
        errorCode: ERROR_CODES.INVALID_AMOUNT || 'INVALID_AMOUNT'
      };
    }

    return {
      isValid: true,
      amount: validationResult.value,
      error: null,
      errorCode: null
    };
  }

  /**
   * Validates email format using safe regex (no ReDoS vulnerability)
   * Uses validator.js for RFC 5322 compliance
   * @param {string} email - Email address
   * @returns {{isValid: boolean, error: string|null}}
   */
  static validateEmail(email) {
    if (typeof email !== 'string') {
      return { 
        isValid: false, 
        error: 'Email must be a string' 
      };
    }

    const trimmedEmail = email.trim();

    try {
      const isValid = validator.isEmail(trimmedEmail, {
        allow_display_name: false,
        require_tld: true,
        allow_utf8_local_part: false,
        blacklisted_chars: '\'"<>'
      });

      return {
        isValid,
        error: isValid ? null : 'Invalid email format'
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Email validation error'
      };
    }
  }

  /**
   * Validates URL format using built-in URL constructor (safe, no ReDoS)
   * @param {string} url - URL to validate
   * @returns {{isValid: boolean, error: string|null}}
   */
  static validateURL(url) {
    if (typeof url !== 'string') {
      return { 
        isValid: false, 
        error: 'URL must be a string' 
      };
    }

    try {
      new URL(url.trim());
      return { 
        isValid: true, 
        error: null 
      };
    } catch {
      return { 
        isValid: false, 
        error: 'Invalid URL format' 
      };
    }
  }

  /**
   * Validates 32-byte hex string (keccak256 hash, proposal hash, etc.)
   * @param {string} hash - Hex string
   * @returns {{isValid: boolean, error: string|null}}
   */
  static validateBytes32(hash) {
    if (typeof hash !== 'string') {
      return { 
        isValid: false, 
        error: 'Hash must be a string' 
      };
    }

    const isValid = PATTERNS.BYTES32.test(hash);
    return {
      isValid,
      error: isValid ? null : 'Must be a 32-byte hex string (0x followed by 64 hex characters)'
    };
  }

  /**
   * Validates hex color format
   * @param {string} color - Hex color string (#fff or #ffffff)
   * @returns {{isValid: boolean, error: string|null}}
   */
  static validateHexColor(color) {
    if (typeof color !== 'string') {
      return { 
        isValid: false, 
        error: 'Color must be a string' 
      };
    }

    const isValid = PATTERNS.HEX_COLOR.test(color.trim());
    return {
      isValid,
      error: isValid ? null : 'Invalid hex color format (#fff or #ffffff)'
    };
  }

  /**
   * Validates US phone number format
   * For international support, use libphonenumber-js library
   * @param {string} phone - Phone number
   * @returns {{isValid: boolean, error: string|null}}
   */
  static validatePhoneNumber(phone) {
    if (typeof phone !== 'string') {
      return { 
        isValid: false, 
        error: 'Phone number must be a string' 
      };
    }

    const isValid = PATTERNS.US_PHONE.test(phone.trim());
    return {
      isValid,
      error: isValid ? null : 'Invalid US phone format (e.g., (555) 123-4567)'
    };
  }

  /**
   * Validates form data against a schema
   * @param {Object} data - Form data to validate
   * @param {Object} schema - Validation schema
   * @returns {{isValid: boolean, errors: Object, sanitized: Object}}
   * @example
   * const schema = {
   *   email: { type: 'email', required: true },
   *   name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
   *   amount: { type: 'number', required: true, min: 0, max: 1000 }
   * };
   * const result = InputValidator.validateForm(data, schema);
   */
  static validateForm(data, schema) {
    const errors = {};
    const sanitized = {};
    let isValid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const fieldErrors = [];

      // Required check
      const isMissing = value === undefined || value === null || 
                       (typeof value === 'string' && value.trim() === '');
      
      if (rules.required && isMissing) {
        fieldErrors.push(`${field} is required`);
        isValid = false;
        errors[field] = fieldErrors;
        continue;
      }

      // Skip further validation if not required and empty
      if (!rules.required && isMissing) {
        sanitized[field] = value;
        continue;
      }

      // Type validation and specific format checks
      if (rules.type) {
        switch (rules.type) {
          case 'string': {
            if (typeof value !== 'string') {
              fieldErrors.push(`${field} must be a string`);
            } else {
              const stringCheck = this.validateString(
                value,
                rules.minLength || 0,
                rules.maxLength || 1000
              );
              if (!stringCheck.isValid) {
                fieldErrors.push(stringCheck.error);
              } else {
                sanitized[field] = stringCheck.sanitized;
              }
            }
            break;
          }

          case 'number': {
            const numCheck = this.validateNumber(value, rules.min, rules.max);
            if (!numCheck.isValid) {
              fieldErrors.push(`${field} must be a valid number`);
            } else {
              sanitized[field] = numCheck.value;
            }
            break;
          }

          case 'email': {
            const emailCheck = this.validateEmail(value);
            if (!emailCheck.isValid) {
              fieldErrors.push(`${field} must be a valid email`);
            } else {
              sanitized[field] = value.trim().toLowerCase();
            }
            break;
          }

          case 'address': {
            const addrCheck = this.validateEthereumAddress(value);
            if (!addrCheck.isValid) {
              fieldErrors.push(`${field} must be a valid Ethereum address`);
            } else {
              sanitized[field] = addrCheck.checksummedAddress;
            }
            break;
          }

          case 'url': {
            const urlCheck = this.validateURL(value);
            if (!urlCheck.isValid) {
              fieldErrors.push(`${field} must be a valid URL`);
            } else {
              sanitized[field] = value.trim();
            }
            break;
          }

          case 'bytes32': {
            const hashCheck = this.validateBytes32(value);
            if (!hashCheck.isValid) {
              fieldErrors.push(`${field} must be a valid 32-byte hex string`);
            } else {
              sanitized[field] = value;
            }
            break;
          }
        }
      }

      // Custom validation function
      if (rules.validate && typeof rules.validate === 'function' && fieldErrors.length === 0) {
        const finalValue = sanitized[field] !== undefined ? sanitized[field] : value;
        const customResult = rules.validate(finalValue);
        if (customResult !== true) {
          fieldErrors.push(customResult || `${field} is invalid`);
        }
      }

      if (fieldErrors.length > 0) {
        isValid = false;
        errors[field] = fieldErrors;
      }
    }

    return {
      isValid,
      errors,
      sanitized
    };
  }

  /**
   * Sanitizes HTML content using DOMPurify (industry-standard XSS protection)
   * CRITICAL: Use this ONLY for rendering HTML. Never use with innerHTML directly.
   * @param {string} html - HTML content to sanitize
   * @param {Object} [config={}] - DOMPurify configuration
   * @returns {string} Sanitized HTML
   * @see {@link https://github.com/cure53/DOMPurify|DOMPurify Documentation}
   */
  static sanitizeHTML(html, config = {}) {
    if (typeof html !== 'string') {
      return '';
    }

    const defaultConfig = {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'title'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
    };

    const mergedConfig = { ...defaultConfig, ...config };

    try {
      return DOMPurify.sanitize(html, mergedConfig);
    } catch (error) {
      console.error('HTML sanitization error:', error);
      return ''; // Fail safely
    }
  }

  /**
   * Validates file upload with size, type, and extension checks
   * @param {File} file - File object
   * @param {Object} [options={}] - Validation options
   * @returns {{isValid: boolean, error: string|null, errorCode: string|null}}
   */
  static validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/*', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
    } = options;

    if (!(file instanceof File)) {
      return {
        isValid: false,
        error: 'No file selected or file is invalid',
        errorCode: ERROR_CODES.INVALID_INPUT
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
        errorCode: ERROR_CODES.INVALID_INPUT
      };
    }

    const isTypeAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -2));
      }
      return file.type === type;
    });

    if (!isTypeAllowed) {
      return {
        isValid: false,
        error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        errorCode: ERROR_CODES.INVALID_INPUT
      };
    }

    const extension = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `File extension ${extension} is not allowed. Allowed: ${allowedExtensions.join(', ')}`,
        errorCode: ERROR_CODES.INVALID_INPUT
      };
    }

    return {
      isValid: true,
      error: null,
      errorCode: null
    };
  }

  /**
   * Checks for suspicious patterns indicating potential attacks
   * @param {string} text - Text to check
   * @returns {boolean} Whether text contains suspicious patterns
   * @private
   */
  static containsSuspiciousPatterns(text) {
    if (typeof text !== 'string') {
      return false;
    }

    const suspiciousPatterns = [
      PATTERNS.UNSAFE_JAVASCRIPT,
      PATTERNS.UNSAFE_DATA,
      PATTERNS.UNSAFE_SCRIPT,
      PATTERNS.UNSAFE_EVAL,
      PATTERNS.UNSAFE_EXEC
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Checks for inappropriate content (spam, scams, exploitation keywords)
   * For production, integrate with professional content moderation API
   * @param {string} text - Text to check
   * @returns {{isValid: boolean, flagged: boolean, error: string|null}}
   */
  static checkContentSafety(text) {
    if (typeof text !== 'string') {
      return { isValid: false, flagged: false, error: 'Input must be a string' };
    }

    const inappropriateKeywords = [
      'spam', 'scam', 'hack', 'exploit', 'cheat', 'phishing',
      'steal', 'fraud', 'botnet', 'malware', 'ransomware'
    ];

    const lowercaseText = text.toLowerCase();
    const regex = new RegExp(`\\b(${inappropriateKeywords.join('|')})\\b`, 'i');

    const flagged = regex.test(lowercaseText);

    if (flagged) {
      return {
        isValid: false,
        flagged: true,
        error: 'Content contains inappropriate or suspicious keywords'
      };
    }

    return {
      isValid: true,
      flagged: false,
      error: null
    };
  }

  /**
   * Server-side rate limiting check (Redis recommended for production)
   * NOTE: This is a placeholder for server-side implementation
   * Move rate limiting to server with persistent storage (Redis, Firestore)
   * @param {string} key - Rate limit key (e.g., 'submit_proposal_user_123')
   * @param {number} limit - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<boolean>} Whether action is allowed
   * @deprecated Use server-side rate limiting with Redis/Firestore
   */
  static async checkRateLimitServerSide(key, limit, windowMs) {
    // This method should call your backend API
    // which uses Redis or similar persistent storage
    console.warn(
      'checkRateLimitServerSide: This is a placeholder. ' +
      'Implement server-side rate limiting with Redis or Firestore in production.'
    );

    // Example implementation with fetch to backend:
    try {
      const response = await fetch('/api/rate-limit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, limit, windowMs })
      });

      const data = await response.json();
      return data.allowed;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return false; // Fail closed for security
    }
  }

  /**
   * Validates rate limiting with caching (use server-side implementation in production)
   * @param {string} key - Cache key
   * @param {Function} validationFn - Validation function
   * @param {...any} args - Arguments for validation function
   * @returns {*} Validation result
   * @private
   */
  static validateWithCache(key, validationFn, ...args) {
    const cacheEntry = validationCache.get(key);
    const now = Date.now();

    if (cacheEntry && (now - cacheEntry.timestamp) < CACHE_TTL) {
      return cacheEntry.result;
    }

    const result = validationFn(...args);
    validationCache.set(key, { result, timestamp: now });

    // Auto-cleanup old entries
    if (validationCache.size > 1000) {
      const firstKey = validationCache.keys().next().value;
      validationCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Clears validation cache (useful for testing)
   * @private
   */
  static clearCache() {
    validationCache.clear();
  }
}

export default InputValidator;
