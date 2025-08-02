/**
 * Authentication utilities for Skool scraper using HTTP headers
 * Refactored to work with CheerioCrawler instead of PuppeteerCrawler
 */

import { Actor } from 'apify';
import { createAuthHeaders, verifyAuthFromHtml } from './api.js';
import { ValidationError, AuthenticationError, normalizeCookies } from './validators.js';

/**
 * Sets up authentication headers for HTTP requests
 * @param {Array} cookies - Array of cookie objects from input
 * @returns {Object} HTTP headers with authentication
 */
export function setupAuthenticationHeaders(cookies) {
    try {
        console.info('Setting up authentication headers with provided cookies...');

        // Normalize cookies for HTTP headers
        const normalizedCookies = normalizeCookies(cookies);
        
        // Create headers with cookies
        const headers = createAuthHeaders(normalizedCookies);
        
        console.info(`Successfully created auth headers with ${normalizedCookies.length} cookies`);
        return headers;

    } catch (error) {
        throw new AuthenticationError(`Authentication header setup failed: ${error.message}`);
    }
}

/**
 * Verifies authentication by making a test request to Skool
 * @param {Object} crawler - CheerioCrawler instance
 * @param {Object} headers - HTTP headers with authentication
 * @returns {Promise<Object>} Authentication verification result
 */
export async function verifyAuthentication(crawler, headers) {
    try {
        console.info('Verifying authentication status...');

        // Make a test request to Skool homepage
        const response = await crawler.request({
            url: 'https://www.skool.com/',
            headers,
            method: 'GET'
        });

        // Verify authentication from response
        const authResult = verifyAuthFromHtml(response.body);
        
        if (authResult.isAuthenticated) {
            console.info(authResult.message);
            return {
                success: true,
                email: authResult.email,
                message: authResult.message
            };
        } else {
            console.error(authResult.message);
            return {
                success: false,
                message: authResult.message
            };
        }

    } catch (error) {
        console.error(`Authentication verification failed: ${error.message}`);
        return {
            success: false,
            message: `Verification failed: ${error.message}`
        };
    }
}

/**
 * Creates a cookie string from cookie array for HTTP headers
 * @param {Array} cookies - Array of cookie objects
 * @returns {string} Cookie string for HTTP headers
 */
export function createCookieString(cookies) {
    try {
        const normalizedCookies = normalizeCookies(cookies);
        return normalizedCookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
    } catch (error) {
        throw new Error(`Failed to create cookie string: ${error.message}`);
    }
}

/**
 * Validates cookie array and checks for required Skool cookies
 * @param {Array} cookies - Array of cookie objects
 * @returns {boolean} True if cookies are valid
 */
export function validateSkoolCookies(cookies) {
    try {
        if (!Array.isArray(cookies) || cookies.length === 0) {
            throw new ValidationError('Cookies array is empty or invalid');
        }

        // Check for essential Skool cookies
        const cookieNames = cookies.map(c => c.name);
        const requiredCookies = ['auth_token']; // Main authentication cookie
        
        for (const required of requiredCookies) {
            if (!cookieNames.includes(required)) {
                console.warning(`Missing required cookie: ${required}`);
                // Don't throw error, just warn - other cookies might work
            }
        }

        // Validate cookie structure
        for (const cookie of cookies) {
            if (!cookie.name || typeof cookie.value === 'undefined') {
                throw new ValidationError(`Invalid cookie structure: ${JSON.stringify(cookie)}`);
            }
        }

        console.info(`Cookie validation passed for ${cookies.length} cookies`);
        return true;

    } catch (error) {
        throw new ValidationError(`Cookie validation failed: ${error.message}`);
    }
}

/**
 * Checks if community access is available with current authentication
 * @param {string} communityUrl - URL of the community to check
 * @param {Object} headers - HTTP headers with authentication
 * @param {Object} gotScraping - got-scraping instance
 * @returns {Promise<boolean>} True if access is available
 */
export async function checkCommunityAccess(communityUrl, headers, gotScraping) {
    try {
        console.info(`Checking community access: ${communityUrl}`);

        const response = await gotScraping({
            url: communityUrl,
            headers,
            method: 'GET',
            timeout: { request: 30000 }
        });

        // Check if redirected to login
        if (response.url.includes('/login') || response.url.includes('/signin')) {
            console.error('Redirected to login - no access to community');
            return false;
        }

        // Check for access denied indicators in content
        const content = response.body;
        if (content.includes('access denied') || 
            content.includes('private community') ||
            content.includes('join this community')) {
            console.error('Community access denied');
            return false;
        }

        console.info('Community access verified');
        return true;

    } catch (error) {
        console.error(`Community access check failed: ${error.message}`);
        return false;
    }
}

/**
 * Extracts user information from authenticated response
 * @param {string} html - HTML content from authenticated request
 * @returns {Object} User information
 */
export function extractUserInfo(html) {
    try {
        const userInfo = {
            email: null,
            name: null,
            id: null,
            avatar: null
        };

        // Extract email
        const emailMatch = html.match(/email['"]\s*:\s*['"]([^'"]+)['"]/i);
        if (emailMatch) {
            userInfo.email = emailMatch[1];
        }

        // Extract user name
        const nameMatch = html.match(/name['"]\s*:\s*['"]([^'"]+)['"]/i) ||
                         html.match(/displayName['"]\s*:\s*['"]([^'"]+)['"]/i);
        if (nameMatch) {
            userInfo.name = nameMatch[1];
        }

        // Extract user ID
        const idMatch = html.match(/user_id['"]\s*:\s*['"]([^'"]+)['"]/i) ||
                       html.match(/userId['"]\s*:\s*['"]([^'"]+)['"]/i);
        if (idMatch) {
            userInfo.id = idMatch[1];
        }

        return userInfo;

    } catch (error) {
        console.error('Error extracting user info:', error.message);
        return {
            email: null,
            name: null,
            id: null,
            avatar: null
        };
    }
}

/**
 * Legacy function - kept for compatibility but not used in new approach
 * @deprecated Use setupAuthenticationHeaders instead
 */
export async function setupAuthentication() {
    throw new Error('setupAuthentication is deprecated. Use setupAuthenticationHeaders instead.');
}