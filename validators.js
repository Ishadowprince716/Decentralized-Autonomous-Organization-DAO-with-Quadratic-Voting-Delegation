// Input Validation Utilities
// js/utils/validators.js

import { PROPOSAL_LIMITS, ERROR_CODES, MEMBERSHIP_FEE } from './constants.js';

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
        if (!address || typeof address !== 'string') {
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
                isValid: allowEmpty,
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
        let sanitized = input
            .trim()
            .replace(/[<>]/g, '') // Basic XSS prevention
            .replace(/\0/g, '') // Remove null bytes
            .slice(0, maxLength); // Truncate to max length

        // Check length requirements
        if (!allowEmpty && sanitized.length === 0) {
            return {
                isValid: false,
                sanitized,
                error: 'Input cannot be empty'
            };
        }

        if (sanitized.length < minLength) {
            return {
                isValid: false,
                sanitized,
                error: `Input must be at least ${minLength} characters long`
            };
        }

        if (sanitized.length > maxLength) {
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
        if (!data.category || !validCategories.includes(data.category)) {
            errors.push('Category: Please select a valid category');
        } else {
            sanitized.category = data.category;
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
        // Validate proposal ID
        if (!Number.isInteger(proposalId) || proposalId < 0) {
            return false;
        }

        // Validate credits
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
        if (!amount || typeof amount !== 'string') {
            return {
                isValid: false,
                error: 'Amount is required',
                errorCode: ERROR_CODES.INVALID_AMOUNT
            };
        }

        const numAmount = parseFloat(amount);
        
        if (isNaN(numAmount)) {
            return {
                isValid: false,
                error: 'Amount must be a valid number',
                errorCode: ERROR_CODES.INVALID_AMOUNT
            };
        }

        const minAmount = parseFloat(MEMBERSHIP_FEE.MIN_AMOUNT);
        const maxAmount = parseFloat(MEMBERSHIP_FEE.MAX_AMOUNT);

        if (numAmount < minAmount) {
            return {
                isValid: false,
                error: `Amount must be at least ${minAmount} ETH`,
                errorCode: ERROR_CODES.INVALID_AMOUNT
            };
        }

        if (numAmount > maxAmount) {
            return {
                isValid: false,
                error: `Amount must be no more than ${maxAmount} ETH`,
                errorCode: ERROR_CODES.INVALID_AMOUNT
            };
        }

        return {
            isValid: true,
            amount: numAmount,
            error: null
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email address
     * @returns {boolean} - Whether email is valid
     */
    static validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }

        const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return pattern.test(email);
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - Whether URL is valid
     */
    static validateURL(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate numeric range
     * @param {number} value - Number to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} - Whether number is in range
     */
    static validateRange(value, min, max) {
        if (typeof value !== 'number' || isNaN(value)) {
            return false;
        }

        return value >= min && value <= max;
    }

    /**
     * Validate hex color
     * @param {string} color - Hex color string
     * @returns {boolean} - Whether color is valid
     */
    static validateHexColor(color) {
        if (!color || typeof color !== 'string') {
            return false;
        }

        const pattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
        return pattern.test(color);
    }

    /**
     * Validate phone number (US format)
     * @param {string} phone - Phone number
     * @returns {boolean} - Whether phone is valid
     */
    static validatePhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') {
            return false;
        }

        const pattern = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        return pattern.test(phone);
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
            if (rules.required && (value === undefined || value === null || value === '')) {
                fieldErrors.push(`${field} is required`);
                isValid = false;
                continue;
            }

            // Skip further validation if field is not required and empty
            if (!rules.required && (value === undefined || value === null || value === '')) {
                sanitized[field] = value;
                continue;
            }

            // Type validation
            if (rules.type) {
                switch (rules.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            fieldErrors.push(`${field} must be a string`);
                            isValid = false;
                        }
                        break;
                    case 'number':
                        if (typeof value !== 'number' || isNaN(value)) {
                            fieldErrors.push(`${field} must be a number`);
                            isValid = false;
                        }
                        break;
                    case 'email':
                        if (!this.validateEmail(value)) {
                            fieldErrors.push(`${field} must be a valid email`);
                            isValid = false;
                        }
                        break;
                    case 'address':
                        if (!this.validateEthereumAddress(value)) {
                            fieldErrors.push(`${field} must be a valid Ethereum address`);
                            isValid = false;
                        }
                        break;
                }
            }

            // Length validation for strings
            if (typeof value === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
                    isValid = false;
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    fieldErrors.push(`${field} must be no more than ${rules.maxLength} characters`);
                    isValid = false;
                }
            }

            // Range validation for numbers
            if (typeof value === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    fieldErrors.push(`${field} must be at least ${rules.min}`);
                    isValid = false;
                }
                if (rules.max !== undefined && value > rules.max) {
                    fieldErrors.push(`${field} must be no more than ${rules.max}`);
                    isValid = false;
                }
            }

            // Custom validation
            if (rules.validate && typeof rules.validate === 'function') {
                const customResult = rules.validate(value);
                if (customResult !== true) {
                    fieldErrors.push(customResult || `${field} is invalid`);
                    isValid = false;
                }
            }

            // Sanitize string values
            if (typeof value === 'string' && fieldErrors.length === 0) {
                sanitized[field] = value.trim();
            } else {
                sanitized[field] = value;
            }

            if (fieldErrors.length > 0) {
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
     */
    static sanitizeHTML(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Basic HTML sanitization - remove script tags and dangerous attributes
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/on\w+='[^']*'/gi, '')
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

        if (!file || !(file instanceof File)) {
            return {
                isValid: false,
                error: 'No file selected',
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
                error: `File type ${file.type} is not allowed`,
                errorCode: ERROR_CODES.INVALID_INPUT
            };
        }

        // Check file extension
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            return {
                isValid: false,
                error: `File extension ${extension} is not allowed`,
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
        if (!text || typeof text !== 'string') {
            return false;
        }

        // Basic profanity filter - in production, use a more comprehensive solution
        const inappropriateWords = [
            'spam', 'scam', 'hack', 'exploit', 'cheat',
            // Add more words as needed
        ];

        const lowercaseText = text.toLowerCase();
        return inappropriateWords.some(word => lowercaseText.includes(word));
    }

    /**
     * Validate rate limiting
     * @param {string} key - Rate limit key
     * @param {number} limit - Rate limit
     * @param {number} window - Time window in milliseconds
     * @returns {boolean} - Whether rate limit is exceeded
     */
    static checkRateLimit(key, limit, window) {
        const now = Date.now();
        const storageKey = `rate_limit_${key}`;
        
        let attempts = [];
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                attempts = JSON.parse(stored);
            }
        } catch {
            attempts = [];
        }

        // Remove old attempts outside the window
        attempts = attempts.filter(timestamp => now - timestamp < window);

        // Check if limit exceeded
        if (attempts.length >= limit) {
            return false; // Rate limit exceeded
        }

        // Add current attempt
        attempts.push(now);
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(attempts));
        } catch {
            // Storage might be full, continue anyway
        }

        return true; // Rate limit not exceeded
    }
}

export default InputValidator;