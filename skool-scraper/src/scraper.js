const Apify = require('apify');
const { SELECTORS, WAIT_CONDITIONS, ERROR_MESSAGES } = require('./config/selectors');
const { setupAuthentication, checkCommunityAccess } = require('./utils/auth');
const { parsePostData, extractCommentsForPost } = require('./utils/parsers');
const { handleInfiniteScroll, smartScroll } = require('./utils/pagination');
const { validatePostData } = require('./utils/validators');

/**
 * Main scraper class for Skool.com communities
 */
class SkoolScraper {
    constructor(input) {
        this.input = input;
        this.browser = null;
        this.page = null;
        this.stats = {
            totalPosts: 0,
            totalComments: 0,
            communitiesProcessed: 0,
            errors: []
        };
    }

    /**
     * Initializes the scraper with browser and authentication
     */
    async initialize() {
        try {
            Apify.utils.log.info('Initializing Skool scraper...');

            // Launch browser with appropriate configuration
            this.browser = await Apify.launchPuppeteer({
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                },
                proxyUrl: this.input.proxyConfig?.useApifyProxy ? undefined : this.input.proxyConfig?.proxyUrl,
                useApifyProxy: this.input.proxyConfig?.useApifyProxy,
                apifyProxyGroups: this.input.proxyConfig?.apifyProxyGroups
            });

            // Create new page
            this.page = await this.browser.newPage();

            // Set user agent to mimic real browser
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            // Set viewport
            await this.page.setViewport({ width: 1920, height: 1080 });

            // Setup request interception for optimization
            await this.setupRequestInterception();

            // Setup authentication
            await setupAuthentication(this.page, this.input.cookies);

            Apify.utils.log.info('Scraper initialization completed');

        } catch (error) {
            await this.cleanup();
            throw new Error(`Scraper initialization failed: ${error.message}`);
        }
    }

    /**
     * Sets up request interception to block unnecessary resources
     */
    async setupRequestInterception() {
        try {
            await this.page.setRequestInterception(true);

            this.page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url();

                // Block unnecessary resources to improve performance
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    request.abort();
                } else if (url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

        } catch (error) {
            Apify.utils.log.warning(`Request interception setup failed: ${error.message}`);
        }
    }

    /**
     * Scrapes a single community
     * @param {string} communityUrl - URL of the community to scrape
     * @returns {Promise<Array>} Array of scraped posts
     */
    async scrapeCommunity(communityUrl) {
        try {
            Apify.utils.log.info(`Starting to scrape community: ${communityUrl}`);

            // Check community access
            const hasAccess = await checkCommunityAccess(this.page, communityUrl);
            if (!hasAccess) {
                throw new Error(`No access to community: ${communityUrl}`);
            }

            // Navigate to the appropriate tab
            const targetUrl = this.input.tab === 'classroom' ? 
                `${communityUrl}/classroom` : communityUrl;

            await this.page.goto(targetUrl, {
                waitUntil: WAIT_CONDITIONS.pageLoad,
                timeout: 30000
            });

            // Wait for content to load
            await this.waitForCommunityContent();

            // Handle pagination to load all posts
            const itemCount = await this.handlePagination();
            Apify.utils.log.info(`Loaded ${itemCount} posts for pagination`);

            // Extract all posts
            const posts = await this.extractPosts();
            
            // Update statistics
            this.stats.totalPosts += posts.length;
            this.stats.communitiesProcessed++;

            Apify.utils.log.info(`Successfully scraped ${posts.length} posts from ${communityUrl}`);
            return posts;

        } catch (error) {
            this.stats.errors.push(`Community ${communityUrl}: ${error.message}`);
            Apify.utils.log.error(`Failed to scrape community ${communityUrl}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Waits for community content to load
     */
    async waitForCommunityContent() {
        try {
            // Wait for main content areas
            await Promise.race([
                this.page.waitForSelector(SELECTORS.NAVIGATION.postsContainer, { timeout: 15000 }),
                this.page.waitForSelector(SELECTORS.POSTS.postItem, { timeout: 15000 }),
                this.page.waitForSelector(SELECTORS.NAVIGATION.communityTab, { timeout: 15000 })
            ]);

            // Additional wait for dynamic content
            await this.page.waitForTimeout(3000);

        } catch (error) {
            Apify.utils.log.warning(`Content loading timeout - proceeding anyway: ${error.message}`);
        }
    }

    /**
     * Handles pagination based on input configuration
     * @returns {Promise<number>} Number of items loaded
     */
    async handlePagination() {
        try {
            if (this.input.smartScrolling) {
                const result = await smartScroll(this.page, {
                    maxItems: this.input.maxItems,
                    itemSelector: SELECTORS.POSTS.postItem,
                    scrollDelay: this.input.scrollDelay,
                    adaptiveDelay: true
                });
                return result.itemCount;
            } else {
                return await handleInfiniteScroll(
                    this.page,
                    this.input.maxItems,
                    this.input.scrollDelay,
                    SELECTORS.POSTS.postItem
                );
            }
        } catch (error) {
            Apify.utils.log.error(`Pagination failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extracts all posts from the current page
     * @returns {Promise<Array>} Array of post data
     */
    async extractPosts() {
        try {
            const postElements = await this.page.$$(SELECTORS.POSTS.postItem);
            const posts = [];
            const batchSize = 10; // Process posts in batches to manage memory

            Apify.utils.log.info(`Found ${postElements.length} posts to extract`);

            for (let i = 0; i < postElements.length; i += batchSize) {
                const batch = postElements.slice(i, i + batchSize);
                const batchPosts = await this.processBatch(batch, i);
                posts.push(...batchPosts);

                // Apply delay between batches to avoid rate limiting
                if (i > 0 && this.input.requestDelay > 0) {
                    await this.page.waitForTimeout(this.input.requestDelay * 1000);
                }

                // Memory cleanup for large batches
                if (i % 50 === 0 && i > 0) {
                    await this.performMemoryCleanup();
                }
            }

            return posts;

        } catch (error) {
            Apify.utils.log.error(`Post extraction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Processes a batch of post elements
     * @param {Array} postElements - Array of post element handles
     * @param {number} startIndex - Starting index for logging
     * @returns {Promise<Array>} Array of processed posts
     */
    async processBatch(postElements, startIndex) {
        const batchPosts = [];

        for (let j = 0; j < postElements.length; j++) {
            try {
                const postElement = postElements[j];
                const postIndex = startIndex + j + 1;

                if (this.input.debug) {
                    Apify.utils.log.debug(`Processing post ${postIndex}/${postElements.length}`);
                }

                // Extract basic post data
                const postData = await parsePostData(postElement, this.page);

                // Extract comments if requested
                if (this.input.includeComments && postData.url) {
                    try {
                        const comments = await extractCommentsForPost(this.page, postData.url);
                        postData.comments = comments;
                        this.stats.totalComments += comments.length;
                    } catch (commentError) {
                        Apify.utils.log.warning(`Failed to extract comments for post ${postData.id}: ${commentError.message}`);
                        postData.comments = [];
                    }
                }

                // Validate post data before adding
                if (validatePostData(postData)) {
                    batchPosts.push(postData);
                } else {
                    Apify.utils.log.warning(`Invalid post data structure for post ${postIndex}, skipping`);
                }

            } catch (postError) {
                Apify.utils.log.warning(`Failed to process post ${startIndex + j + 1}: ${postError.message}`);
                continue;
            }
        }

        if (this.input.debug) {
            Apify.utils.log.debug(`Batch processed: ${batchPosts.length}/${postElements.length} posts successful`);
        }

        return batchPosts;
    }

    /**
     * Performs memory cleanup
     */
    async performMemoryCleanup() {
        try {
            await this.page.evaluate(() => {
                if (window.gc) {
                    window.gc();
                }
            });
            
            // Small delay to allow cleanup
            await this.page.waitForTimeout(1000);
            
        } catch (error) {
            Apify.utils.log.debug(`Memory cleanup failed: ${error.message}`);
        }
    }

    /**
     * Scrapes multiple communities from the input URLs
     * @returns {Promise<Array>} Array of all scraped posts
     */
    async scrapeAllCommunities() {
        try {
            const allPosts = [];
            const { startUrls } = this.input;

            Apify.utils.log.info(`Starting to scrape ${startUrls.length} communities`);

            for (let i = 0; i < startUrls.length; i++) {
                const urlObj = startUrls[i];
                try {
                    const posts = await this.scrapeCommunity(urlObj.url);
                    allPosts.push(...posts);

                    // Delay between communities to avoid rate limiting
                    if (i < startUrls.length - 1 && this.input.requestDelay > 0) {
                        await this.page.waitForTimeout(this.input.requestDelay * 1000);
                    }

                } catch (communityError) {
                    Apify.utils.log.error(`Failed to scrape community ${urlObj.url}: ${communityError.message}`);
                    // Continue with other communities
                    continue;
                }
            }

            // Log final statistics
            this.logFinalStats();

            return allPosts;

        } catch (error) {
            Apify.utils.log.error(`Multi-community scraping failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Logs final scraping statistics
     */
    logFinalStats() {
        Apify.utils.log.info('=== SCRAPING COMPLETED ===');
        Apify.utils.log.info(`Communities processed: ${this.stats.communitiesProcessed}`);
        Apify.utils.log.info(`Total posts scraped: ${this.stats.totalPosts}`);
        Apify.utils.log.info(`Total comments scraped: ${this.stats.totalComments}`);
        
        if (this.stats.errors.length > 0) {
            Apify.utils.log.warning(`Errors encountered: ${this.stats.errors.length}`);
            this.stats.errors.forEach(error => {
                Apify.utils.log.error(`- ${error}`);
            });
        }
    }

    /**
     * Handles errors during scraping with retry logic
     * @param {Function} operation - Operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<any>} Operation result
     */
    async handleWithRetry(operation, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                Apify.utils.log.warning(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
                
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
                    await this.page.waitForTimeout(delayMs);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Cleans up browser resources
     */
    async cleanup() {
        try {
            if (this.page && !this.page.isClosed()) {
                await this.page.close();
            }
            if (this.browser) {
                await this.browser.close();
            }
            Apify.utils.log.info('Browser cleanup completed');
        } catch (error) {
            Apify.utils.log.error(`Cleanup failed: ${error.message}`);
        }
    }
}

module.exports = SkoolScraper;