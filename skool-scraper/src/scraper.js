/**
 * Skool.com scraper using CheerioCrawler and JSON API endpoints
 * Refactored from PuppeteerCrawler for better performance and reliability
 */

import { Actor } from 'apify';
import { CheerioCrawler, createCheerioRouter } from 'crawlee';
import { 
    extractBuildId, 
    extractCommunityName, 
    buildApiUrl, 
    buildClassroomApiUrl,
    parseSkoolApiResponse,
    extractPostData,
    logApiProgress,
    hasCommunitytAccess
} from './utils/api.js';
import { 
    setupAuthenticationHeaders, 
    validateSkoolCookies,
    extractUserInfo
} from './utils/auth.js';
import { validateInput } from './utils/validators.js';

export class SkoolScraper {
    constructor(input) {
        this.input = input;
        this.crawler = null;
        this.authHeaders = null;
        this.buildId = null;
        this.stats = {
            processed: 0,
            errors: [],
            communities: 0,
            posts: 0
        };
    }

    /**
     * Initializes the scraper with CheerioCrawler
     */
    async initialize() {
        try {
            console.log('Initializing Skool scraper with CheerioCrawler...');

            // Validate cookies
            validateSkoolCookies(this.input.cookies);

            // Setup authentication headers
            this.authHeaders = setupAuthenticationHeaders(this.input.cookies);

            // Create proxy configuration if needed
            let proxyConfiguration = undefined;
            if (this.input.proxyConfig?.useApifyProxy) {
                proxyConfiguration = await Actor.createProxyConfiguration({
                    groups: this.input.proxyConfig.apifyProxyGroups || ['RESIDENTIAL']
                });
            }

            // Create router for handling different request types
            const router = createCheerioRouter();

            // Main data fetching handler
            router.addHandler('fetchMainData', async ({ request, $, body }) => {
                await this.handleMainDataRequest(request, $, body);
            });

            // API data handler
            router.addHandler('getContentFromCommunity', async ({ request, json }) => {
                await this.handleApiRequest(request, json);
            });

            // Initialize CheerioCrawler
            this.crawler = new CheerioCrawler({
                proxyConfiguration,
                requestHandler: router,
                failedRequestHandler: async ({ request, error }) => {
                    console.error(`Request ${request.url} failed: ${error.message}`);
                    this.stats.errors.push(`URL ${request.url}: ${error.message}`);
                },
                maxConcurrency: this.input.maxConcurrency || 10,
                maxRequestRetries: this.input.maxRequestRetries || 3,
                requestHandlerTimeoutSecs: 300,
                additionalMimeTypes: ['application/json']
            });

            console.log('Scraper initialization completed');

        } catch (error) {
            throw new Error(`Scraper initialization failed: ${error.message}`);
        }
    }

    /**
     * Handles main data request to extract buildId and user info
     */
    async handleMainDataRequest(request, $, body) {
        try {
            const url = request.url;
            logApiProgress('fetchMainData', `${url} ${request.response?.statusCode || 'unknown'}`);

            // Extract buildId from HTML
            this.buildId = extractBuildId(body);
            if (!this.buildId) {
                throw new Error('Could not extract buildId from page');
            }

            // Increment communities counter
            this.stats.communities++;

            // Extract user info for authentication verification
            const userInfo = extractUserInfo(body);
            if (userInfo.email) {
                logApiProgress('fetchMainData', `Account detected, here is EMAIL: ${userInfo.email}`);
            }

            // Extract community name from URL
            const communityName = extractCommunityName(url);
            if (!communityName) {
                throw new Error('Could not extract community name from URL');
            }

            // Get total users count from HTML if available
            const totalUsersMatch = body.match(/memberCount['"]\s*:\s*(\d+)/i) ||
                                   body.match(/totalUsers['"]\s*:\s*(\d+)/i);
            const totalUsers = totalUsersMatch ? parseInt(totalUsersMatch[1]) : 0;

            logApiProgress('fetchMainData', `totalPages and totalUsers: { totalUsers: ${totalUsers}, totalPages: 0, counter: 1 }`);
            logApiProgress('fetchMainData', `BUILD ID: { buildId: '${this.buildId}', group: '${communityName}' }`);

            // Build API URL for community data
            const apiUrl = this.input.tab === 'classroom' 
                ? buildClassroomApiUrl(this.buildId, communityName, { page: 1 })
                : buildApiUrl(this.buildId, communityName, { page: 1 });

            // Queue API request
            await this.crawler.addRequests([{
                url: apiUrl,
                label: 'getContentFromCommunity',
                headers: this.authHeaders,
                userData: {
                    buildId: this.buildId,
                    communityName,
                    totalUsers,
                    originalUrl: url,
                    tab: this.input.tab,
                    currentPage: 1
                }
            }]);

        } catch (error) {
            console.error(`Failed to process main data request: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handles API requests for community content
     */
    async handleApiRequest(request, json) {
        try {
            const { buildId, communityName, originalUrl, tab, currentPage = 1 } = request.userData;
            
            logApiProgress('GET_CONTENT_FROM_COMMUNITY', 
                `entering... ${request.url} ${request.response?.statusCode || 'unknown'} originalUrl: ${originalUrl}`);

            // Parse API response
            const apiData = parseSkoolApiResponse(JSON.stringify(json));
            
            if (!hasCommunitytAccess(apiData)) {
                throw new Error(`No access to community: ${originalUrl}`);
            }

            const posts = apiData.posts || [];
            logApiProgress('GET_CONTENT_FROM_COMMUNITY', `1.posts number: ${posts.length}`);
            logApiProgress('GET_CONTENT_FROM_COMMUNITY', `2.posts number: ${posts.length}`);

            // Process posts
            const processedPosts = [];
            let itemCount = 0;
            const maxItems = this.input.maxItems || 30;

            for (const post of posts) {
                if (itemCount >= maxItems) {
                    logApiProgress('GET_CONTENT_FROM_COMMUNITY', `maxItems reached: ${posts.length}`);
                    break;
                }

                const processedPost = await this.processPost(post, communityName, originalUrl);
                if (processedPost) {
                    processedPosts.push(processedPost);
                    itemCount++;
                    this.stats.posts++;
                }
            }

            logApiProgress('GET_CONTENT_FROM_COMMUNITY', `stateItems counter: ${posts.length} maxItems ${maxItems}`);

            // Save processed posts
            if (processedPosts.length > 0) {
                await Actor.pushData(processedPosts);
                console.log(`Saved ${processedPosts.length} posts to dataset`);
            }

            // Handle pagination if needed and not reached max items
            if (apiData.hasNextPage && itemCount < maxItems) {
                const nextPage = currentPage + 1;
                const nextApiUrl = this.input.tab === 'classroom' 
                    ? buildClassroomApiUrl(buildId, communityName, { page: nextPage })
                    : buildApiUrl(buildId, communityName, { page: nextPage });

                await this.crawler.addRequests([{
                    url: nextApiUrl,
                    label: 'getContentFromCommunity',
                    headers: this.authHeaders,
                    userData: {
                        ...request.userData,
                        currentPage: nextPage
                    }
                }]);
            }

            this.stats.processed += processedPosts.length;

        } catch (error) {
            console.error(`Failed to process API request: ${error.message}`);
            throw error;
        }
    }

    /**
     * Processes a single post from API data
     */
    async processPost(postData, communityName, originalUrl) {
        try {
            const post = extractPostData(postData);
            if (!post) {
                return null;
            }

            // Add community context
            post.community = {
                name: communityName,
                url: originalUrl,
                tab: this.input.tab
            };

            // Process comments if requested
            if (this.input.includeComments && postData.comments) {
                post.comments = await this.processComments(postData.comments);
            }

            // Add metadata
            post.scrapedAt = new Date().toISOString();
            post.scrapedBy = 'skool-scraper';

            return post;

        } catch (error) {
            console.error(`Error processing post: ${error.message}`);
            return null;
        }
    }

    /**
     * Processes comments for a post
     */
    async processComments(commentsData) {
        try {
            if (!Array.isArray(commentsData)) {
                return [];
            }

            const processedComments = [];
            const maxComments = this.input.commentsLimit || 50;

            for (let i = 0; i < Math.min(commentsData.length, maxComments); i++) {
                const comment = commentsData[i];
                
                const processedComment = {
                    id: comment.id,
                    content: comment.content || comment.text,
                    author: {
                        id: comment.author?.id,
                        name: comment.author?.name || comment.author?.displayName,
                        avatar: comment.author?.avatar
                    },
                    createdAt: comment.createdAt || comment.created_at,
                    likes: comment.likes || comment.likeCount || 0,
                    replies: comment.replies || []
                };

                processedComments.push(processedComment);
            }

            return processedComments;

        } catch (error) {
            console.error(`Error processing comments: ${error.message}`);
            return [];
        }
    }

    /**
     * Runs the scraper
     */
    async run() {
        try {
            console.log('Starting scraping process...');
            console.log(`Starting to scrape ${this.input.startUrls.length} communities`);

            // Prepare start URLs with authentication headers
            const requests = this.input.startUrls.map(urlObj => ({
                url: urlObj.url,
                label: 'fetchMainData',
                headers: this.authHeaders,
                userData: {
                    originalUrl: urlObj.url
                }
            }));

            // Start crawling
            await this.crawler.run(requests);

            // Log final stats
            console.log(`Scraping completed. Processed: ${this.stats.processed} items, Posts: ${this.stats.posts}, Errors: ${this.stats.errors.length}`);

            if (this.stats.errors.length > 0) {
                console.error('Errors encountered:');
                this.stats.errors.forEach(error => console.error(`- ${error}`));
            }

        } catch (error) {
            console.error(`Scraping failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            console.log('Crawler cleanup completed automatically');
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }
}