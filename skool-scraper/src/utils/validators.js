import { URL_PATTERNS, ERROR_MESSAGES } from '../config/selectors.js';

/**
 * Custom error classes for better error handling
 */
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * Validates input configuration object
 * @param {Object} input - Input configuration from Actor
 * @returns {Object} Validated and normalized input
 */
function validateInput(input) {
    if (!input || typeof input !== 'object') {
        throw new ValidationError('Input must be a valid object');
    }

    const validated = { ...input };

    // Validate startUrls
    validateStartUrls(validated.startUrls);

    // Validate cookies
    validateCookies(validated.cookies);

    // Validate numeric parameters
    validateNumericParams(validated);

    // Validate tab selection
    validateTab(validated.tab);

    // Set defaults for optional parameters
    setDefaults(validated);

    return validated;
}

/**
 * Validates start URLs array
 * @param {Array} startUrls - Array of URL objects
 */
function validateStartUrls(startUrls) {
    if (!Array.isArray(startUrls) || startUrls.length === 0) {
        throw new ValidationError('startUrls must be a non-empty array');
    }

    startUrls.forEach((urlObj, index) => {
        if (!urlObj || typeof urlObj !== 'object' || !urlObj.url) {
            throw new ValidationError(`Invalid URL object at index ${index}. Must have 'url' property.`);
        }

        if (!validateSkoolUrl(urlObj.url)) {
            throw new ValidationError(`Invalid Skool.com URL at index ${index}: ${urlObj.url}. Must be a valid Skool community URL.`);
        }
    });
}

/**
 * Validates Skool.com URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function validateSkoolUrl(url) {
    if (typeof url !== 'string') {
        return false;
    }

    return URL_PATTERNS.community.test(url) || URL_PATTERNS.classroom.test(url);
}

/**
 * Validates cookies array
 * @param {Array} cookies - Array of cookie objects
 */
function validateCookies(cookies) {
    if (!Array.isArray(cookies) || cookies.length === 0) {
        throw new ValidationError('Cookies must be provided as a non-empty array. Please export cookies from your browser after logging into Skool.com.');
    }

    cookies.forEach((cookie, index) => {
        validateCookieFormat(cookie, index);
    });
}

/**
 * Validates individual cookie format
 * @param {Object} cookie - Cookie object
 * @param {number} index - Cookie index for error reporting
 */
function validateCookieFormat(cookie, index) {
    if (!cookie || typeof cookie !== 'object') {
        throw new ValidationError(`Cookie at index ${index} must be an object`);
    }

    const requiredFields = ['name', 'value', 'domain'];
    for (const field of requiredFields) {
        if (!cookie[field] || typeof cookie[field] !== 'string') {
            throw new ValidationError(`Cookie at index ${index} missing required field: ${field}`);
        }
    }

    // Ensure domain is Skool.com related
    if (!cookie.domain.includes('skool.com')) {
        throw new ValidationError(`Cookie at index ${index} must be from skool.com domain`);
    }

    // Validate optional fields
    if (cookie.secure !== undefined && typeof cookie.secure !== 'boolean') {
        throw new ValidationError(`Cookie at index ${index} 'secure' field must be boolean`);
    }

    if (cookie.httpOnly !== undefined && typeof cookie.httpOnly !== 'boolean') {
        throw new ValidationError(`Cookie at index ${index} 'httpOnly' field must be boolean`);
    }
}

/**
 * Validates numeric parameters
 * @param {Object} input - Input object
 */
function validateNumericParams(input) {
    const numericParams = {
        maxItems: { min: 0, max: 50000, default: 1000 },
        maxConcurrency: { min: 1, max: 50, default: 10 },
        minConcurrency: { min: 1, max: 10, default: 1 },
        maxRequestRetries: { min: 0, max: 10, default: 3 },
        requestDelay: { min: 1, max: 10, default: 2 },
        scrollDelay: { min: 1, max: 5, default: 2 }
    };

    for (const [param, config] of Object.entries(numericParams)) {
        if (input[param] !== undefined) {
            const value = Number(input[param]);
            if (isNaN(value) || value < config.min || value > config.max) {
                throw new ValidationError(`${param} must be a number between ${config.min} and ${config.max}`);
            }
            input[param] = value;
        }
    }

    // Validate concurrency relationship
    if (input.minConcurrency && input.maxConcurrency && input.minConcurrency > input.maxConcurrency) {
        throw new ValidationError('minConcurrency cannot be greater than maxConcurrency');
    }
}

/**
 * Validates tab selection
 * @param {string} tab - Tab name
 */
function validateTab(tab) {
    if (tab && !['community', 'classroom'].includes(tab)) {
        throw new ValidationError('tab must be either "community" or "classroom"');
    }
}

/**
 * Sets default values for optional parameters
 * @param {Object} input - Input object to modify
 */
function setDefaults(input) {
    const defaults = {
        tab: 'community',
        includeComments: true,
        maxItems: 1000,
        maxConcurrency: 10,
        minConcurrency: 1,
        maxRequestRetries: 3,
        requestDelay: 2,
        scrollDelay: 2,
        debug: false
    };

    for (const [key, value] of Object.entries(defaults)) {
        if (input[key] === undefined) {
            input[key] = value;
        }
    }

    // Set default proxy config if not provided
    if (!input.proxyConfig) {
        input.proxyConfig = {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
        };
    }
}

/**
 * Validates extracted post data structure
 * @param {Object} post - Post object to validate
 * @returns {boolean} True if valid
 */
function validatePostData(post) {
    if (!post || typeof post !== 'object') {
        return false;
    }

    // Required fields
    const requiredFields = ['id', 'metadata', 'user'];
    for (const field of requiredFields) {
        if (!post[field]) {
            return false;
        }
    }

    // Validate metadata structure
    if (!post.metadata || typeof post.metadata !== 'object') {
        return false;
    }

    // Validate user structure
    if (!post.user || typeof post.user !== 'object' || !post.user.name) {
        return false;
    }

    return true;
}

/**
 * Validates extracted comment data structure
 * @param {Object} comment - Comment object to validate
 * @returns {boolean} True if valid
 */
function validateCommentData(comment) {
    if (!comment || typeof comment !== 'object') {
        return false;
    }

    // Check for post structure in comment
    if (!comment.post || typeof comment.post !== 'object') {
        return false;
    }

    if (!comment.post.id || !comment.post.metadata || !comment.post.user) {
        return false;
    }

    return true;
}

/**
 * Normalizes cookie format for Puppeteer
 * @param {Array} cookies - Raw cookies from input
 * @returns {Array} Normalized cookies
 */
function normalizeCookies(cookies) {
    return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
        path: cookie.path || '/',
        secure: cookie.secure !== false, // Default to true for HTTPS
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'Lax'
    }));
}

/**
 * Validates proxy configuration
 * @param {Object} proxyConfig - Proxy configuration object
 */
function validateProxyConfig(proxyConfig) {
    if (!proxyConfig || typeof proxyConfig !== 'object') {
        throw new ValidationError('proxyConfig must be an object');
    }

    if (proxyConfig.useApifyProxy !== undefined && typeof proxyConfig.useApifyProxy !== 'boolean') {
        throw new ValidationError('proxyConfig.useApifyProxy must be boolean');
    }

    if (proxyConfig.apifyProxyGroups && !Array.isArray(proxyConfig.apifyProxyGroups)) {
        throw new ValidationError('proxyConfig.apifyProxyGroups must be an array');
    }
}

export {
    ValidationError,
    AuthenticationError,
    validateInput,
    validateStartUrls,
    validateSkoolUrl,
    validateCookies,
    validateCookieFormat,
    validateNumericParams,
    validateTab,
    validatePostData,
    validateCommentData,
    normalizeCookies,
    validateProxyConfig,
    setDefaults
};