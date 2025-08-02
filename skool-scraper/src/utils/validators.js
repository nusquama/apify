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

    // Validate simple filter inputs
    validateSimpleFilters(validated);

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

/**
 * Validates search filters configuration
 * @param {Object} searchFilters - Search filters object
 */
function validateSearchFilters(searchFilters) {
    if (!searchFilters) return;

    if (typeof searchFilters !== 'object') {
        throw new ValidationError('searchFilters must be an object');
    }

    // Validate date range filter
    if (searchFilters.dateRange) {
        const dateRange = searchFilters.dateRange;
        if (dateRange.enabled && (dateRange.startDate || dateRange.endDate)) {
            if (dateRange.startDate && !isValidDate(dateRange.startDate)) {
                throw new ValidationError('searchFilters.dateRange.startDate must be a valid date (YYYY-MM-DD)');
            }
            if (dateRange.endDate && !isValidDate(dateRange.endDate)) {
                throw new ValidationError('searchFilters.dateRange.endDate must be a valid date (YYYY-MM-DD)');
            }
            if (dateRange.startDate && dateRange.endDate && new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
                throw new ValidationError('searchFilters.dateRange.startDate must be before endDate');
            }
        }
    }

    // Validate engagement filter
    if (searchFilters.engagement) {
        const engagement = searchFilters.engagement;
        if (engagement.enabled) {
            if (engagement.minLikes !== undefined && (typeof engagement.minLikes !== 'number' || engagement.minLikes < 0)) {
                throw new ValidationError('searchFilters.engagement.minLikes must be a non-negative number');
            }
            if (engagement.maxLikes !== undefined && (typeof engagement.maxLikes !== 'number' || engagement.maxLikes < 0)) {
                throw new ValidationError('searchFilters.engagement.maxLikes must be a non-negative number');
            }
            if (engagement.minComments !== undefined && (typeof engagement.minComments !== 'number' || engagement.minComments < 0)) {
                throw new ValidationError('searchFilters.engagement.minComments must be a non-negative number');
            }
            if (engagement.minEngagementRate !== undefined && (typeof engagement.minEngagementRate !== 'number' || engagement.minEngagementRate < 0 || engagement.minEngagementRate > 1)) {
                throw new ValidationError('searchFilters.engagement.minEngagementRate must be a number between 0 and 1');
            }
        }
    }

    // Validate content filter
    if (searchFilters.content) {
        const content = searchFilters.content;
        if (content.enabled) {
            if (content.keywords && !Array.isArray(content.keywords)) {
                throw new ValidationError('searchFilters.content.keywords must be an array');
            }
            if (content.excludeKeywords && !Array.isArray(content.excludeKeywords)) {
                throw new ValidationError('searchFilters.content.excludeKeywords must be an array');
            }
            if (content.minLength !== undefined && (typeof content.minLength !== 'number' || content.minLength < 0)) {
                throw new ValidationError('searchFilters.content.minLength must be a non-negative number');
            }
        }
    }

    // Validate authors filter
    if (searchFilters.authors) {
        const authors = searchFilters.authors;
        if (authors.enabled) {
            if (authors.includeAuthors && !Array.isArray(authors.includeAuthors)) {
                throw new ValidationError('searchFilters.authors.includeAuthors must be an array');
            }
            if (authors.excludeAuthors && !Array.isArray(authors.excludeAuthors)) {
                throw new ValidationError('searchFilters.authors.excludeAuthors must be an array');
            }
        }
    }

    // Validate sorting
    if (searchFilters.sorting) {
        const sorting = searchFilters.sorting;
        const validSortBy = ['date', 'likes', 'comments', 'engagement', 'alphabetical'];
        const validSortOrder = ['asc', 'desc'];

        if (sorting.sortBy && !validSortBy.includes(sorting.sortBy)) {
            throw new ValidationError(`searchFilters.sorting.sortBy must be one of: ${validSortBy.join(', ')}`);
        }
        if (sorting.sortOrder && !validSortOrder.includes(sorting.sortOrder)) {
            throw new ValidationError(`searchFilters.sorting.sortOrder must be one of: ${validSortOrder.join(', ')}`);
        }
    }
}

/**
 * Validates simple filter inputs from UI
 * @param {Object} input - Input object
 */
function validateSimpleFilters(input) {
    // Validate itemStartDate
    if (input.itemStartDate && !isValidDate(input.itemStartDate)) {
        throw new ValidationError('itemStartDate must be in YYYY-MM-DD format');
    }
    
    // Validate commentsLimit
    if (input.commentsLimit !== undefined) {
        const value = Number(input.commentsLimit);
        if (isNaN(value) || value < 1 || value > 1000) {
            throw new ValidationError('commentsLimit must be a number between 1 and 1000');
        }
        input.commentsLimit = value;
    }
    
    // Validate minLikes
    if (input.minLikes !== undefined) {
        const value = Number(input.minLikes);
        if (isNaN(value) || value < 0) {
            throw new ValidationError('minLikes must be a non-negative number');
        }
        input.minLikes = value;
    }
    
    // Validate minComments  
    if (input.minComments !== undefined) {
        const value = Number(input.minComments);
        if (isNaN(value) || value < 0) {
            throw new ValidationError('minComments must be a non-negative number');
        }
        input.minComments = value;
    }
    
    // Validate sortBy
    if (input.sortBy) {
        const validSortBy = ['date', 'likes', 'comments', 'engagement'];
        if (!validSortBy.includes(input.sortBy)) {
            throw new ValidationError(`sortBy must be one of: ${validSortBy.join(', ')}`);
        }
    }
    
    // Validate searchPresets
    if (input.searchPresets) {
        const validPresets = ['none', 'high-engagement', 'recent-posts', 'popular-discussions', 'trending-content'];
        if (!validPresets.includes(input.searchPresets)) {
            throw new ValidationError(`searchPresets must be one of: ${validPresets.join(', ')}`);
        }
    }
    
    // Validate storeName pattern
    if (input.storeName && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.storeName)) {
        throw new ValidationError('storeName can only contain lowercase letters, numbers, and hyphens (not at start/end)');
    }
}

/**
 * Validates date string format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if valid
 */
function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
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
    validateSimpleFilters,
    setDefaults
};