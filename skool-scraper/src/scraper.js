import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { SELECTORS, WAIT_CONDITIONS, ERROR_MESSAGES } from './config/selectors.js';
import { setupAuthentication, checkCommunityAccess } from './utils/auth.js';
import { parsePostData, extractCommentsForPost } from './utils/parsers.js';
import { handleInfiniteScroll, smartScroll } from './utils/pagination.js';
import { validatePostData } from './utils/validators.js';

/**
 * Main scraper class for Skool.com communities
 */
class SkoolScraper {
    constructor(input) {
        this.input = input;
        this.crawler = null;
        this.stats = {
            totalPosts: 0,
            totalComments: 0,
            communitiesProcessed: 0,
            errors: []
        };
    }

    /**
     * Initializes the scraper with PuppeteerCrawler
     */
    async initialize() {
        try {
            console.log('Initializing Skool scraper...');

            // Initialize PuppeteerCrawler which handles browser launching automatically
            this.crawler = new PuppeteerCrawler({
                // Browser launch configuration
                launchContext: {
                    launchOptions: {
                        headless: true,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-accelerated-2d-canvas',
                            '--no-first-run',
                            '--no-zygote',
                            '--disable-gpu',
                            '--disable-web-security',
                            '--disable-features=site-per-process'
                        ]
                    },
                    useChrome: false,
                    useIncognitoPages: true
                },
                
                // Proxy configuration
                proxyConfiguration: this.input.proxyConfig?.useApifyProxy ? 
                    Actor.createProxyConfiguration({
                        groups: this.input.proxyConfig.apifyProxyGroups || ['RESIDENTIAL']
                    }) : undefined,

                // Request handler - this will be called for each URL
                requestHandler: async ({ request, page }) => {
                    // This is where we'll handle individual community scraping
                    await this.handleCommunityRequest(request, page);
                },

                // Error handler
                failedRequestHandler: async ({ request, error }) => {
                    console.error(`Request ${request.url} failed: ${error.message}`);
                    this.stats.errors.push(`URL ${request.url}: ${error.message}`);
                },

                // Crawler configuration
                maxConcurrency: this.input.maxConcurrency || 10,
                requestHandlerTimeoutSecs: 300, // 5 minutes timeout per request
                maxRequestRetries: this.input.maxRequestRetries || 3
            });

            console.log('Scraper initialization completed');

        } catch (error) {
            throw new Error(`Scraper initialization failed: ${error.message}`);
        }
    }

    /**
     * Handles a single community request
     * @param {Object} request - Crawlee request object
     * @param {Object} page - Puppeteer page instance
     */
    async handleCommunityRequest(request, page) {
        try {
            console.log(`Processing community: ${request.url}`);

            // Setup authentication
            await setupAuthentication(page, this.input.cookies);

            // Check community access
            const hasAccess = await checkCommunityAccess(page, request.url);
            if (!hasAccess) {
                throw new Error(`No access to community: ${request.url}`);
            }

            // Navigate to the appropriate tab
            const targetUrl = this.input.tab === 'classroom' ? 
                `${request.url}/classroom` : request.url;

            await page.goto(targetUrl, {
                waitUntil: WAIT_CONDITIONS.pageLoad,
                timeout: 30000
            });

            // Wait for content to load
            await this.waitForCommunityContent(page);

            // Handle pagination to load all posts
            const itemCount = await this.handlePagination(page);
            console.log(`Loaded ${itemCount} posts for pagination`);

            // Extract all posts
            const posts = await this.extractPosts(page);
            
            // Store results
            if (posts.length > 0) {
                await Actor.pushData(posts);
                console.log(`Stored ${posts.length} posts from ${request.url}`);
            }

            // Update statistics
            this.stats.totalPosts += posts.length;
            this.stats.communitiesProcessed++;

        } catch (error) {
            this.stats.errors.push(`Community ${request.url}: ${error.message}`);
            console.error(`Failed to process community ${request.url}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Waits for community content to load
     */
    async waitForCommunityContent(page) {
        try {
            // Wait for main content areas
            await Promise.race([
                page.waitForSelector(SELECTORS.NAVIGATION.postsContainer, { timeout: 15000 }),
                page.waitForSelector(SELECTORS.POSTS.postItem, { timeout: 15000 }),
                page.waitForSelector(SELECTORS.NAVIGATION.communityTab, { timeout: 15000 })
            ]);

            // Additional wait for dynamic content
            await page.waitForTimeout(3000);

        } catch (error) {
            console.warn(`Content loading timeout - proceeding anyway: ${error.message}`);
        }
    }

    /**
     * Handles pagination based on input configuration
     * @param {Object} page - Puppeteer page instance
     * @returns {Promise<number>} Number of items loaded
     */
    async handlePagination(page) {
        try {
            if (this.input.smartScrolling) {
                const result = await smartScroll(page, {
                    maxItems: this.input.maxItems,
                    itemSelector: SELECTORS.POSTS.postItem,
                    scrollDelay: this.input.scrollDelay,
                    adaptiveDelay: true
                });
                return result.itemCount;
            } else {
                return await handleInfiniteScroll(
                    page,
                    this.input.maxItems,
                    this.input.scrollDelay,
                    SELECTORS.POSTS.postItem
                );
            }
        } catch (error) {
            console.error(`Pagination failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extracts all posts from the current page
     * @param {Object} page - Puppeteer page instance
     * @returns {Promise<Array>} Array of post data
     */
    async extractPosts(page) {
        try {
            const postElements = await page.$$(SELECTORS.POSTS.postItem);
            const posts = [];
            const batchSize = 10; // Process posts in batches to manage memory

            console.log(`Found ${postElements.length} posts to extract`);

            for (let i = 0; i < postElements.length; i += batchSize) {
                const batch = postElements.slice(i, i + batchSize);
                const batchPosts = await this.processBatch(batch, page, i);
                posts.push(...batchPosts);

                // Apply delay between batches to avoid rate limiting
                if (i > 0 && this.input.requestDelay > 0) {
                    await page.waitForTimeout(this.input.requestDelay * 1000);
                }
            }

            return posts;

        } catch (error) {
            console.error(`Post extraction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Processes a batch of post elements
     * @param {Array} postElements - Array of post element handles
     * @param {Object} page - Puppeteer page instance
     * @param {number} startIndex - Starting index for logging
     * @returns {Promise<Array>} Array of processed posts
     */
    async processBatch(postElements, page, startIndex) {
        const batchPosts = [];

        for (let j = 0; j < postElements.length; j++) {
            try {
                const postElement = postElements[j];
                const postIndex = startIndex + j + 1;

                if (this.input.debug) {
                    console.debug(`Processing post ${postIndex}/${postElements.length}`);
                }

                // Extract basic post data
                const postData = await parsePostData(postElement, page);

                // Extract comments if requested
                if (this.input.includeComments && postData.url) {
                    try {
                        const comments = await extractCommentsForPost(page, postData.url);
                        postData.comments = comments;
                        this.stats.totalComments += comments.length;
                    } catch (commentError) {
                        console.warn(`Failed to extract comments for post ${postData.id}: ${commentError.message}`);
                        postData.comments = [];
                    }
                }

                // Add scraping metadata
                postData.scrapedAt = new Date().toISOString();
                postData.scrapingConfig = {
                    tab: this.input.tab,
                    includeComments: this.input.includeComments,
                    actorVersion: '1.0.0'
                };

                // Validate post data before adding
                if (validatePostData(postData)) {
                    batchPosts.push(postData);
                } else {
                    console.warn(`Invalid post data structure for post ${postIndex}, skipping`);
                }

            } catch (postError) {
                console.warn(`Failed to process post ${startIndex + j + 1}: ${postError.message}`);
                continue;
            }
        }

        if (this.input.debug) {
            console.debug(`Batch processed: ${batchPosts.length}/${postElements.length} posts successful`);
        }

        return batchPosts;
    }

    /**
     * Runs the scraper for all communities
     * @returns {Promise<void>}
     */
    async run() {
        try {
            const { startUrls } = this.input;
            console.log(`Starting to scrape ${startUrls.length} communities`);

            // Convert startUrls to Crawlee format
            const requests = startUrls.map(urlObj => ({ url: urlObj.url }));

            // Run the crawler
            await this.crawler.run(requests);

            // Log final statistics
            this.logFinalStats();

        } catch (error) {
            console.error(`Scraping failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Logs final scraping statistics
     */
    logFinalStats() {
        console.log('=== SCRAPING COMPLETED ===');
        console.log(`Communities processed: ${this.stats.communitiesProcessed}`);
        console.log(`Total posts scraped: ${this.stats.totalPosts}`);
        console.log(`Total comments scraped: ${this.stats.totalComments}`);
        
        if (this.stats.errors.length > 0) {
            console.warn(`Errors encountered: ${this.stats.errors.length}`);
            this.stats.errors.forEach(error => {
                console.error(`- ${error}`);
            });
        }
    }

    /**
     * Cleanup method (not needed with PuppeteerCrawler as it handles cleanup automatically)
     */
    async cleanup() {
        // PuppeteerCrawler handles browser cleanup automatically
        console.log('Crawler cleanup completed automatically');
    }
}

export default SkoolScraper;