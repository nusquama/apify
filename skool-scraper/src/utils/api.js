/**
 * Skool API utilities for accessing JSON endpoints
 * Based on reverse engineering of Skool's internal API
 */

import { Actor } from 'apify';

/**
 * Extracts buildId from Skool HTML page
 * @param {string} html - HTML content from Skool page
 * @returns {string|null} Build ID or null if not found
 */
export function extractBuildId(html) {
    try {
        // Look for Next.js buildId in script tags
        const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
        if (buildIdMatch) {
            return buildIdMatch[1];
        }

        // Alternative: look in __NEXT_DATA__ script
        const nextDataMatch = html.match(/__NEXT_DATA__.*?"buildId":"([^"]+)"/);
        if (nextDataMatch) {
            return nextDataMatch[1];
        }

        // Fallback: look for any build-like pattern
        const fallbackMatch = html.match(/\/([0-9]{13,})\//);
        if (fallbackMatch) {
            return fallbackMatch[1];
        }

        return null;
    } catch (error) {
        console.error('Error extracting buildId:', error.message);
        return null;
    }
}

/**
 * Extracts community name from URL
 * @param {string} url - Skool community URL
 * @returns {string} Community name
 */
export function extractCommunityName(url) {
    const match = url.match(/skool\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
}

/**
 * Builds Skool API endpoint URL
 * @param {string} buildId - Next.js build ID
 * @param {string} community - Community name
 * @param {object} params - Query parameters
 * @returns {string} API endpoint URL
 */
export function buildApiUrl(buildId, community, params = {}) {
    const baseUrl = `https://www.skool.com/_next/data/${buildId}/${community}.json`;
    
    const queryParams = new URLSearchParams();
    
    // Add common parameters
    if (params.page) queryParams.set('p', params.page);
    if (params.filter) queryParams.set('fl', params.filter);
    if (params.category) queryParams.set('c', params.category);
    
    const queryString = queryParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Builds classroom API endpoint URL
 * @param {string} buildId - Next.js build ID
 * @param {string} community - Community name
 * @param {object} params - Query parameters
 * @returns {string} Classroom API endpoint URL
 */
export function buildClassroomApiUrl(buildId, community, params = {}) {
    const baseUrl = `https://www.skool.com/_next/data/${buildId}/${community}/classroom.json`;
    
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('p', params.page);
    
    const queryString = queryParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Creates HTTP headers with authentication cookies
 * @param {Array} cookies - Array of cookie objects
 * @returns {Object} HTTP headers object
 */
export function createAuthHeaders(cookies) {
    const cookieString = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');

    return {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.skool.com/',
        'Origin': 'https://www.skool.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    };
}

/**
 * Verifies authentication by checking API response
 * @param {string} html - HTML content from authenticated request
 * @returns {Object} Authentication info
 */
export function verifyAuthFromHtml(html) {
    try {
        // Look for email in the HTML (indicates logged in user)
        const emailMatch = html.match(/email['"]\s*:\s*['"]([^'"]+)['"]/i);
        if (emailMatch) {
            return {
                isAuthenticated: true,
                email: emailMatch[1],
                message: `Account detected, here is EMAIL: ${emailMatch[1]}`
            };
        }

        // Check for login indicators
        if (html.includes('/login') || html.includes('/signin') || html.includes('Log in')) {
            return {
                isAuthenticated: false,
                message: 'Login page detected - user not authenticated'
            };
        }

        // Check for user-specific data
        if (html.includes('"user"') || html.includes('"profile"')) {
            return {
                isAuthenticated: true,
                message: 'User data found - likely authenticated'
            };
        }

        return {
            isAuthenticated: false,
            message: 'Could not determine authentication status'
        };

    } catch (error) {
        return {
            isAuthenticated: false,
            message: `Error verifying auth: ${error.message}`
        };
    }
}

/**
 * Parses JSON data from Skool API response
 * @param {string} jsonResponse - JSON response from API
 * @returns {Object} Parsed data with posts and metadata
 */
export function parseSkoolApiResponse(jsonResponse) {
    try {
        const data = JSON.parse(jsonResponse);
        
        // Debug: log the structure to understand what we're getting
        console.log('API Response structure keys:', Object.keys(data));
        
        // Navigate through Next.js data structure
        const pageProps = data?.pageProps || {};
        
        // Debug: log pageProps structure
        if (pageProps) {
            console.log('PageProps keys:', Object.keys(pageProps));
        }

        // Try multiple possible locations for posts data
        let posts = [];
        
        // Check common locations for posts
        if (pageProps.posts) {
            posts = pageProps.posts;
        } else if (pageProps.items) {
            posts = pageProps.items;
        } else if (pageProps.feed) {
            posts = pageProps.feed;
        } else if (pageProps.data) {
            posts = pageProps.data;
        } else if (pageProps.content) {
            posts = pageProps.content;
        } else if (data.posts) {
            posts = data.posts;
        }

        console.log(`Found ${posts.length} posts in API response`);
        
        return {
            posts: posts || [],
            totalPages: pageProps.totalPages || pageProps.maxPage || 0,
            totalUsers: pageProps.totalUsers || pageProps.memberCount || pageProps.membersCount || 0,
            buildId: data.buildId,
            community: pageProps.community || pageProps.group || pageProps.groupData || {},
            hasNextPage: pageProps.hasNextPage || pageProps.hasMore || false,
            currentPage: pageProps.currentPage || pageProps.page || pageProps.pageNumber || 1,
            rawData: data // Keep raw data for debugging
        };

    } catch (error) {
        console.error('Error parsing Skool API response:', error.message);
        return {
            posts: [],
            totalPages: 0,
            totalUsers: 0,
            buildId: null,
            community: {},
            hasNextPage: false,
            currentPage: 1,
            rawData: null
        };
    }
}

/**
 * Extracts post data from Skool API response
 * @param {Object} post - Post object from API
 * @returns {Object} Normalized post data
 */
export function extractPostData(post) {
    try {
        return {
            id: post.id || post._id,
            title: post.title || post.subject,
            content: post.content || post.body || post.text,
            author: {
                id: post.author?.id || post.user?.id,
                name: post.author?.name || post.user?.name || post.author?.displayName,
                email: post.author?.email || post.user?.email,
                avatar: post.author?.avatar || post.user?.avatar || post.author?.profilePicture
            },
            createdAt: post.createdAt || post.created_at || post.timestamp,
            updatedAt: post.updatedAt || post.updated_at,
            likes: post.likes || post.likeCount || post.reactions?.like || 0,
            comments: post.comments || post.commentCount || 0,
            url: post.url || `https://www.skool.com/post/${post.id}`,
            isPrivate: post.isPrivate || post.private || false,
            tags: post.tags || [],
            media: post.media || post.attachments || [],
            commentsData: post.commentsData || []
        };
    } catch (error) {
        console.error('Error extracting post data:', error.message);
        return null;
    }
}

/**
 * Logs API progress information
 * @param {string} step - Current step name
 * @param {Object} data - Data to log
 */
export function logApiProgress(step, data) {
    console.log(`[${step}] ${JSON.stringify(data)}`);
}

/**
 * Checks if user has access to the community
 * @param {Object} apiResponse - Response from community API
 * @returns {boolean} True if user has access
 */
export function hasCommunitytAccess(apiResponse) {
    // If we get valid data back, user has access
    if (apiResponse.posts && Array.isArray(apiResponse.posts)) {
        return true;
    }

    // Check for access denied indicators
    if (apiResponse.error || apiResponse.message?.includes('access')) {
        return false;
    }

    return true;
}