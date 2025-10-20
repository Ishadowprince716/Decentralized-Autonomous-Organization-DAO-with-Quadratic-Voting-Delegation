import { PROPOSAL_LIMITS, ERROR_CODES, MEMBERSHIP_FEE } from './constants.js';

/**
 * In-memory store for client-side rate limiting.
 * NOTE: This is non-persistent and only lasts for the current browser session.
 * Real-world production rate limiting MUST be handled server-side or using a
 * persistent, shared database (like Firestore/Redis) for security and reliability.
 * This implementation is for immediate, non-security critical UX rate limiting only.
 */
const rateLimitStore = new Map();

/**
 * Comprehensive input validation utility class
 */
export class InputValidator {

    /**
     * Validate Ethereum address format
     * @param {string} address - Ethereum address to validate
     * @returns {boolean} - Whether address is valid
     */
    static validateEthereumAddress(address) {
        if (typeof address !== 'string') {
            return false;
        }

        // Check basic format (0x followed by 40 hex characters)
        const pattern = /^0x[a-fA-F0-9]{40}$/;
        return pattern.test(address);
    }

    /**
     * Validate and sanitize string input
     * @param {string} input - String to validate
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @param {boolean} allowEmpty - Whether empty strings are allowed
     * @returns {Object} - Validation result with sanitized string
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

        // Sanitize: trim whitespace and remove dangerous characters
        // NOTE: We do not truncate here, as validation should fail if the string is too long.
        let sanitized = input
            .trim()
            .replace(/[<>]/g, '') // Basic XSS prevention: remove angle brackets
            .replace(/\0/g, ''); // Remove null bytes

        // Check length requirements
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

        // CORRECTED: Check for maximum length against the sanitized string.
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
     * Validate numeric input.
     * @param {any} value - Value to validate.
     * @param {number} min - Minimum allowed value.
     * @param {number} max - Maximum allowed value.
     * @returns {Object} - Validation result.
     */
    static validateNumber(value, min = -Infinity, max = Infinity) {
        // Attempt to convert string to number
        let numValue = typeof value === 'string' ? parseFloat(value) : value;

        if (typeof numValue !== 'number' || isNaN(numValue) || numValue === null || numValue === undefined) {
            return { isValid: false, value: null, error: 'Value must be a valid number' };
        }

        if (numValue < min) {
            return { isValid: false, value: numValue, error: `Value must be at least ${min}` };
        }

        if (numValue > max) {
            return { isValid: false, value: numValue, error: `Value must be no more than ${max}` };
        }

        return { isValid: true, value: numValue, error: null };
    }

    /**
     * Validate proposal data
     * @param {Object} data - Proposal data
     * @param {string} data.title - Proposal title
     * @param {string} data.description - Proposal description
     * @param {string} data.category - Proposal category
     * @returns {Object} - Validation result
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

        // Validate category
        const validCategories = ['governance', 'treasury', 'technical', 'community'];
        if (typeof data.category !== 'string' || !validCategories.includes(data.category.toLowerCase())) {
            errors.push('Category: Please select a valid category');
        } else {
            sanitized.category = data.category.toLowerCase();
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized,
            errorCode: errors.length > 0 ? ERROR_CODES.INVALID_INPUT : null
        };
    }

    /**
     * Validate voting parameters
     * @param {number} proposalId - Proposal ID
     * @param {number} credits - Credits to spend
     * @param {boolean} support - Vote support
     * @returns {boolean} - Whether parameters are valid
     */
    static validateVoteParameters(proposalId, credits, support) {
        // Validate proposal ID (must be a non-negative integer)
        if (!Number.isInteger(proposalId) || proposalId < 0) {
            return false;
        }

        // Validate credits (must be an integer between 1 and 100)
        if (!Number.isInteger(credits) || credits < 1 || credits > 100) {
            return false;
        }

        // Validate support
        if (typeof support !== 'boolean') {
            return false;
        }

        return true;
    }

    /**
     * Validate membership fee amount
     * @param {string} amount - Amount in ETH
     * @returns {Object} - Validation result
     */
    static validateMembershipFee(amount) {
        // Use the new validateNumber helper
        const minAmount = parseFloat(MEMBERSHIP_FEE.MIN_AMOUNT);
        const maxAmount = parseFloat(MEMBERSHIP_FEE.MAX_AMOUNT);

        const validationResult = this.validateNumber(amount, minAmount, maxAmount);

        if (!validationResult.isValid) {
            return {
                isValid: false,
                error: validationResult.error || 'Invalid amount provided',
                errorCode: ERROR_CODES.INVALID_AMOUNT
            };
        }

        return {
            isValid: true,
            amount: validationResult.value,
            error: null
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email address
     * @returns {boolean} - Whether email is valid
     */
    static validateEmail(email) {
        if (typeof email !== 'string') {
            return false;
        }

        // Simple but robust email regex
        const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return pattern.test(email.trim());
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - Whether URL is valid
     */
    static validateURL(url) {
        if (typeof url !== 'string') {
            return false;
        }

        try {
            // Using the built-in URL constructor is the most reliable way to validate structure
            new URL(url.trim());
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate numeric range
     * @deprecated Use validateNumber instead.
     * @param {number} value - Number to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} - Whether number is in range
     */
    static validateRange(value, min, max) {
        const result = this.validateNumber(value, min, max);
        return result.isValid;
    }

    /**
     * Validate hex color
     * @param {string} color - Hex color string
     * @returns {boolean} - Whether color is valid
     */
    static validateHexColor(color) {
        if (typeof color !== 'string') {
            return false;
        }

        // Accepts 3-digit or 6-digit hex colors with a leading hash
        const pattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
        return pattern.test(color.trim());
    }

    /**
     * Validate phone number (US format)
     * @param {string} phone - Phone number
     * @returns {boolean} - Whether phone is valid
     */
    static validatePhoneNumber(phone) {
        if (typeof phone !== 'string') {
            return false;
        }

        // Matches formats like (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
        const pattern = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        return pattern.test(phone.trim());
    }

    /**
     * Validate form data against schema
     * @param {Object} data - Form data
     * @param {Object} schema - Validation schema
     * @returns {Object} - Validation result
     */
    static validateForm(data, schema) {
        const errors = {};
        const sanitized = {};
        let isValid = true;

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const fieldErrors = [];

            // Required check
            const isMissing = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
            if (rules.required && isMissing) {
                errors[field] = [`${field} is required`];
                isValid = false;
                continue;
            }

            // Skip further validation if field is not required and empty
            if (!rules.required && isMissing) {
                sanitized[field] = value;
                continue;
            }

            // Type validation and specific format checks
            if (rules.type) {
                switch (rules.type) {
                    case 'string':
                        if (typeof value !== 'string') fieldErrors.push(`${field} must be a string`);
                        break;
                    case 'number':
                        const numCheck = this.validateNumber(value);
                        if (!numCheck.isValid) {
                            fieldErrors.push(`${field} must be a number`);
                        } else {
                            // Use validated number for range check below
                            sanitized[field] = numCheck.value;
                        }
                        break;
                    case 'email':
                        if (!this.validateEmail(value)) fieldErrors.push(`${field} must be a valid email`);
                        break;
                    case 'address':
                        if (!this.validateEthereumAddress(value)) fieldErrors.push(`${field} must be a valid Ethereum address`);
                        break;
                    case 'url':
                        if (!this.validateURL(value)) fieldErrors.push(`${field} must be a valid URL`);
                        break;
                }
            }

            // Length validation for strings (only if it's a string and hasn't failed type check)
            if (typeof value === 'string' && fieldErrors.length === 0) {
                const trimmedValue = value.trim();
                if (rules.minLength !== undefined && trimmedValue.length < rules.minLength) {
                    fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                if (rules.maxLength !== undefined && trimmedValue.length > rules.maxLength) {
                    fieldErrors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }
            }

            // Range validation for numbers
            if (rules.type === 'number' && fieldErrors.length === 0) {
                const numValue = sanitized[field] !== undefined ? sanitized[field] : parseFloat(value);
                const rangeResult = this.validateNumber(numValue, rules.min, rules.max);
                if (!rangeResult.isValid) {
                    fieldErrors.push(rangeResult.error);
                }
            }

            // Custom validation
            if (rules.validate && typeof rules.validate === 'function') {
                const finalValue = sanitized[field] !== undefined ? sanitized[field] : value;
                const customResult = rules.validate(finalValue);
                if (customResult !== true) {
                    fieldErrors.push(customResult || `${field} is invalid`);
                }
            }

            // Final sanitization/assignment
            if (fieldErrors.length === 0) {
                if (typeof value === 'string') {
                    sanitized[field] = value.trim();
                } else if (sanitized[field] === undefined) {
                    sanitized[field] = value;
                }
            } else {
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
     * Sanitize HTML content to prevent XSS
     * @param {string} html - HTML content
     * @returns {string} - Sanitized HTML
     * NOTE: For production-grade security, consider using a dedicated library like DOMPurify.
     */
    static sanitizeHTML(html) {
        if (typeof html !== 'string') {
            return '';
        }

        // Basic HTML sanitization - remove script tags and dangerous attributes
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '') // Remove simple event handlers
            .replace(/on\w+='[^']*'/gi, '') // Remove simple event handlers
            .replace(/(<[^>]+)\s+(href|src|style)\s*=\s*("|')\s*(javascript|vbscript|data):/gi, '$1 $2=$3unsafe:') // Prevent dangerous protocols
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:/gi, '');
    }

    /**
     * Validate file upload
     * @param {File} file - File object
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result
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

        // Check file size
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
                errorCode: ERROR_CODES.INVALID_INPUT
            };
        }

        // Check file type
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

        // Check file extension
        const extensionMatch = file.name.split('.').pop();
        const extension = extensionMatch ? ('.' + extensionMatch.toLowerCase()) : '';

        if (!allowedExtensions.includes(extension)) {
            return {
                isValid: false,
                error: `File extension ${extension} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
                errorCode: ERROR_CODES.INVALID_INPUT
            };
        }

        return {
            isValid: true,
            error: null
        };
    }

    /**
     * Check if a string contains profanity or inappropriate content
     * @param {string} text - Text to check
     * @returns {boolean} - Whether text contains inappropriate content
     */
    static containsInappropriateContent(text) {
        if (typeof text !== 'string') {
            return false;
        }

        // Basic profanity filter - in production, use a more comprehensive solution
        const inappropriateWords = [
            'spam', 'scam', 'hack', 'exploit', 'cheat', 'phishing',
            // Add more words as needed
        ];

        const lowercaseText = text.toLowerCase();
        // Use regex with word boundaries to avoid false positives (e.g., "cheese" containing "cheat")
        const regex = new RegExp(`\\b(${inappropriateWords.join('|')})\\b`, 'i');
        return regex.test(lowercaseText);
    }

    /**
     * Validate rate limiting (client-side, non-persistent)
     * NOTE: Uses in-memory Map instead of forbidden localStorage.
     * For production, this should be server-side or use Firestore/Redis.
     *
     * @param {string} key - Rate limit key (e.g., 'submit_proposal_user_id')
     * @param {number} limit - Maximum number of attempts
     * @param {number} window - Time window in milliseconds
     * @returns {boolean} - Whether the action is allowed (true) or rate limit is exceeded (false)
     */
    static checkRateLimit(key, limit, window) {
        const now = Date.now();
        
        let attempts = rateLimitStore.get(key) || [];

        // Remove old attempts outside the window
        attempts = attempts.filter(timestamp => now - timestamp < window);

        // Check if limit exceeded
        if (attempts.length >= limit) {
            return false; // Rate limit exceeded
        }

        // Add current attempt
        attempts.push(now);
        
        // Update the in-memory store
        rateLimitStore.set(key, attempts);

        return true; // Action allowed
    }
}

export default InputValidator;
