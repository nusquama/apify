const Apify = require('apify');
const { SELECTORS, WAIT_CONDITIONS, ERROR_MESSAGES } = require('../config/selectors');
const { ValidationError, AuthenticationError, normalizeCookies } = require('./validators');

/**
 * Sets up authentication by setting cookies and verifying login status
 * @param {Object} page - Puppeteer page instance
 * @param {Array} cookies - Array of cookie objects from input
 * @returns {Promise<boolean>} True if authentication successful
 */
async function setupAuthentication(page, cookies) {
    try {
        Apify.utils.log.info('Setting up authentication with provided cookies...');

        // Normalize cookies for Puppeteer
        const normalizedCookies = normalizeCookies(cookies);
        
        // Set cookies before navigation
        await setCookies(page, normalizedCookies);
        
        // Verify authentication by checking login status
        const isAuthenticated = await verifyAuthentication(page);
        
        if (!isAuthenticated) {
            throw new AuthenticationError(ERROR_MESSAGES.AUTHENTICATION_FAILED);
        }

        Apify.utils.log.info('Authentication successful');
        return true;

    } catch (error) {
        if (error instanceof AuthenticationError) {
            throw error;
        }
        throw new AuthenticationError(`Authentication setup failed: ${error.message}`);
    }
}

/**
 * Sets cookies in the browser page
 * @param {Object} page - Puppeteer page instance
 * @param {Array} cookies - Normalized cookie objects
 */
async function setCookies(page, cookies) {
    try {
        // Clear any existing cookies first
        await page.deleteCookie(...await page.cookies());
        
        // Set each cookie
        for (const cookie of cookies) {
            try {
                await page.setCookie(cookie);
                Apify.utils.log.debug(`Set cookie: ${cookie.name} for domain: ${cookie.domain}`);
            } catch (cookieError) {
                Apify.utils.log.warning(`Failed to set cookie ${cookie.name}: ${cookieError.message}`);
                // Continue with other cookies even if one fails
            }
        }

        Apify.utils.log.info(`Successfully set ${cookies.length} cookies`);

    } catch (error) {
        throw new Error(`Failed to set cookies: ${error.message}`);
    }
}

/**
 * Verifies authentication by navigating to Skool and checking for login indicators
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if authenticated
 */
async function verifyAuthentication(page) {
    try {
        Apify.utils.log.info('Verifying authentication status...');

        // Navigate to Skool discovery page to check login status
        await page.goto('https://www.skool.com/discovery', {
            waitUntil: WAIT_CONDITIONS.pageLoad,
            timeout: WAIT_CONDITIONS.authTimeout
        });

        // Wait a bit for the page to fully load
        await page.waitForTimeout(3000);

        // Check for authentication indicators
        const authChecks = await Promise.all([
            checkUserAvatar(page),
            checkProfileMenu(page),
            checkLoginButton(page)
        ]);

        const isAuthenticated = authChecks[0] || authChecks[1];
        const hasLoginButton = authChecks[2];

        if (hasLoginButton && !isAuthenticated) {
            Apify.utils.log.error('Login button found - user is not authenticated');
            return false;
        }

        if (isAuthenticated) {
            Apify.utils.log.info('User is authenticated - avatar or profile menu found');
            return true;
        }

        // Additional check - try to access user profile
        try {
            await page.goto('https://www.skool.com/profile', { 
                waitUntil: 'networkidle2',
                timeout: 10000
            });
            
            // If we can access profile without redirect, we're authenticated
            const currentUrl = page.url();
            if (!currentUrl.includes('/login') && !currentUrl.includes('/signin')) {
                Apify.utils.log.info('Authentication verified via profile access');
                return true;
            }
        } catch (profileError) {
            Apify.utils.log.debug(`Profile check failed: ${profileError.message}`);
        }

        Apify.utils.log.warning('Could not verify authentication status');
        return false;

    } catch (error) {
        Apify.utils.log.error(`Authentication verification failed: ${error.message}`);
        return false;
    }
}

/**
 * Checks for user avatar presence (indicates logged in)
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if avatar found
 */
async function checkUserAvatar(page) {
    try {
        const avatar = await page.$(SELECTORS.AUTH.userAvatar);
        if (avatar) {
            Apify.utils.log.debug('User avatar found - user is authenticated');
            return true;
        }
        return false;
    } catch (error) {
        Apify.utils.log.debug(`Avatar check failed: ${error.message}`);
        return false;
    }
}

/**
 * Checks for profile menu presence (indicates logged in)
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if profile menu found
 */
async function checkProfileMenu(page) {
    try {
        const profileMenu = await page.$(SELECTORS.AUTH.profileMenu);
        if (profileMenu) {
            Apify.utils.log.debug('Profile menu found - user is authenticated');
            return true;
        }
        return false;
    } catch (error) {
        Apify.utils.log.debug(`Profile menu check failed: ${error.message}`);
        return false;
    }
}

/**
 * Checks for login button presence (indicates not logged in)
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if login button found
 */
async function checkLoginButton(page) {
    try {
        const loginButton = await page.$(SELECTORS.AUTH.loginButton);
        if (loginButton) {
            Apify.utils.log.debug('Login button found - user is not authenticated');
            return true;
        }
        return false;
    } catch (error) {
        Apify.utils.log.debug(`Login button check failed: ${error.message}`);
        return false;
    }
}

/**
 * Checks if user has access to a specific community
 * @param {Object} page - Puppeteer page instance
 * @param {string} communityUrl - URL of the community to check
 * @returns {Promise<boolean>} True if user has access
 */
async function checkCommunityAccess(page, communityUrl) {
    try {
        Apify.utils.log.info(`Checking access to community: ${communityUrl}`);

        await page.goto(communityUrl, {
            waitUntil: WAIT_CONDITIONS.pageLoad,
            timeout: 30000
        });

        // Wait for page to load completely
        await page.waitForTimeout(3000);

        // Check for access denied indicators
        const accessDenied = await page.$(SELECTORS.ERROR.accessDenied);
        const privateContent = await page.$(SELECTORS.ERROR.privateContent);
        const loginRequired = await page.$(SELECTORS.ERROR.loginRequired);
        const notFound = await page.$(SELECTORS.ERROR.notFound);

        if (accessDenied || privateContent || loginRequired) {
            Apify.utils.log.error('Access denied to community - user is not a member');
            return false;
        }

        if (notFound) {
            Apify.utils.log.error('Community not found - check URL');
            return false;
        }

        // Check for community content indicators
        const communityTab = await page.$(SELECTORS.NAVIGATION.communityTab);
        const postsContainer = await page.$(SELECTORS.NAVIGATION.postsContainer);

        if (communityTab || postsContainer) {
            Apify.utils.log.info('Community access verified - user is a member');
            return true;
        }

        // Additional check - look for any post items
        try {
            await page.waitForSelector(SELECTORS.POSTS.postItem, { timeout: 5000 });
            Apify.utils.log.info('Community access verified - posts found');
            return true;
        } catch (waitError) {
            Apify.utils.log.warning('No posts found - community might be empty or access restricted');
        }

        return true; // Assume access if no clear denial indicators

    } catch (error) {
        Apify.utils.log.error(`Community access check failed: ${error.message}`);
        return false;
    }
}

/**
 * Handles authentication errors with helpful user guidance
 * @param {Error} error - Authentication error
 * @returns {string} User-friendly error message
 */
function getAuthErrorMessage(error) {
    if (error.message.includes('Authentication failed')) {
        return `${ERROR_MESSAGES.AUTHENTICATION_FAILED}\n\nTroubleshooting steps:\n1. Ensure you are logged into Skool.com in your browser\n2. Export fresh cookies using Cookie-Editor or EditThisCookie extension\n3. Verify the cookies include session tokens and are not expired\n4. Make sure cookies are from the correct Skool.com domain`;
    }

    if (error.message.includes('Access denied')) {
        return `${ERROR_MESSAGES.ACCESS_DENIED}\n\nTo fix this:\n1. Join the community you want to scrape\n2. Verify you can access the community content in your browser\n3. Export fresh cookies after confirming access`;
    }

    return `Authentication error: ${error.message}\n\nPlease check your cookies and try again.`;
}

/**
 * Refreshes authentication if needed
 * @param {Object} page - Puppeteer page instance
 * @param {Array} cookies - Cookie array
 * @returns {Promise<boolean>} True if refresh successful
 */
async function refreshAuthentication(page, cookies) {
    try {
        Apify.utils.log.info('Refreshing authentication...');
        
        // Clear existing cookies and set fresh ones
        await page.deleteCookie(...await page.cookies());
        await setCookies(page, normalizeCookies(cookies));
        
        // Verify authentication again
        return await verifyAuthentication(page);
        
    } catch (error) {
        Apify.utils.log.error(`Authentication refresh failed: ${error.message}`);
        return false;
    }
}

module.exports = {
    setupAuthentication,
    setCookies,
    verifyAuthentication,
    checkCommunityAccess,
    getAuthErrorMessage,
    refreshAuthentication,
    checkUserAvatar,
    checkProfileMenu,
    checkLoginButton
};