const Apify = require('apify');
const SkoolScraper = require('./scraper');
const { validateInput, ValidationError, AuthenticationError } = require('./utils/validators');
const { getAuthErrorMessage } = require('./utils/auth');

/**
 * Main Actor entry point
 */
Apify.main(async () => {
    try {
        Apify.utils.log.info('=== SKOOL SCRAPER ACTOR STARTING ===');

        // Get and validate input
        const input = await Apify.getInput();
        Apify.utils.log.info('Input received, validating...');

        let validatedInput;
        try {
            validatedInput = validateInput(input);
            Apify.utils.log.info('Input validation successful');
        } catch (validationError) {
            Apify.utils.log.error(`Input validation failed: ${validationError.message}`);
            throw validationError;
        }

        // Log configuration (without sensitive data)
        logConfiguration(validatedInput);

        // Initialize dataset for storing results
        const dataset = await Apify.openDataset();
        
        // Initialize scraper
        const scraper = new SkoolScraper(validatedInput);
        
        try {
            // Initialize browser and authentication
            await scraper.initialize();

            // Start scraping all communities
            Apify.utils.log.info('Starting scraping process...');
            const allPosts = await scraper.scrapeAllCommunities();

            // Store results in dataset
            if (allPosts.length > 0) {
                await storeResults(dataset, allPosts, validatedInput);
                Apify.utils.log.info(`Successfully stored ${allPosts.length} posts in dataset`);
            } else {
                Apify.utils.log.warning('No posts were scraped - check community access and URLs');
            }

            // Log completion summary
            logCompletionSummary(allPosts, scraper.stats);

        } catch (scrapingError) {
            await handleScrapingError(scrapingError);
            throw scrapingError;
        } finally {
            // Always cleanup browser resources
            await scraper.cleanup();
        }

        Apify.utils.log.info('=== SKOOL SCRAPER ACTOR COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        await handleFatalError(error);
        process.exit(1);
    }
});

/**
 * Logs the configuration (without sensitive information)
 * @param {Object} input - Validated input configuration
 */
function logConfiguration(input) {
    Apify.utils.log.info('=== CONFIGURATION ===');
    Apify.utils.log.info(`Communities to scrape: ${input.startUrls.length}`);
    input.startUrls.forEach((urlObj, index) => {
        Apify.utils.log.info(`  ${index + 1}. ${urlObj.url}`);
    });
    Apify.utils.log.info(`Tab: ${input.tab}`);
    Apify.utils.log.info(`Include comments: ${input.includeComments}`);
    Apify.utils.log.info(`Max items: ${input.maxItems || 'unlimited'}`);
    Apify.utils.log.info(`Max concurrency: ${input.maxConcurrency}`);
    Apify.utils.log.info(`Request delay: ${input.requestDelay}s`);
    Apify.utils.log.info(`Scroll delay: ${input.scrollDelay}s`);
    Apify.utils.log.info(`Debug mode: ${input.debug}`);
    Apify.utils.log.info(`Cookies provided: ${input.cookies.length} items`);
    Apify.utils.log.info(`Proxy enabled: ${input.proxyConfig?.useApifyProxy || false}`);
    Apify.utils.log.info('=====================');
}

/**
 * Stores scraped results in the dataset
 * @param {Object} dataset - Apify dataset instance
 * @param {Array} posts - Array of scraped posts
 * @param {Object} input - Input configuration
 */
async function storeResults(dataset, posts, input) {
    try {
        // Store posts in batches for better performance
        const batchSize = 100;
        let storedCount = 0;

        for (let i = 0; i < posts.length; i += batchSize) {
            const batch = posts.slice(i, i + batchSize);
            
            // Add metadata to each post
            const enrichedBatch = batch.map(post => ({
                ...post,
                scrapedAt: new Date().toISOString(),
                scrapingConfig: {
                    tab: input.tab,
                    includeComments: input.includeComments,
                    actorVersion: '1.0.0'
                }
            }));

            await dataset.pushData(enrichedBatch);
            storedCount += batch.length;

            Apify.utils.log.info(`Stored batch: ${storedCount}/${posts.length} posts`);

            // Small delay between batches
            if (i + batchSize < posts.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (storageError) {
        Apify.utils.log.error(`Failed to store results: ${storageError.message}`);
        throw storageError;
    }
}

/**
 * Logs completion summary
 * @param {Array} posts - Array of scraped posts
 * @param {Object} stats - Scraping statistics
 */
function logCompletionSummary(posts, stats) {
    Apify.utils.log.info('=== SCRAPING SUMMARY ===');
    Apify.utils.log.info(`Total communities processed: ${stats.communitiesProcessed}`);
    Apify.utils.log.info(`Total posts scraped: ${stats.totalPosts}`);
    Apify.utils.log.info(`Total comments scraped: ${stats.totalComments}`);
    
    if (posts.length > 0) {
        const postsWithComments = posts.filter(post => post.comments && post.comments.length > 0);
        Apify.utils.log.info(`Posts with comments: ${postsWithComments.length}`);
        
        const avgCommentsPerPost = stats.totalComments / stats.totalPosts;
        Apify.utils.log.info(`Average comments per post: ${avgCommentsPerPost.toFixed(2)}`);
    }

    if (stats.errors.length > 0) {
        Apify.utils.log.warning(`Errors encountered: ${stats.errors.length}`);
    }

    Apify.utils.log.info('========================');
}

/**
 * Handles scraping errors with user-friendly messages
 * @param {Error} error - Scraping error
 */
async function handleScrapingError(error) {
    Apify.utils.log.error('=== SCRAPING ERROR ===');
    
    if (error instanceof AuthenticationError) {
        const authMessage = getAuthErrorMessage(error);
        Apify.utils.log.error(authMessage);
        
        // Store error details for user
        await Apify.setValue('AUTHENTICATION_ERROR', {
            error: authMessage,
            timestamp: new Date().toISOString(),
            troubleshooting: {
                step1: 'Login to Skool.com in your browser',
                step2: 'Install Cookie-Editor or EditThisCookie extension',
                step3: 'Export cookies as JSON after logging in',
                step4: 'Paste cookies into the Actor input field',
                step5: 'Ensure you are a member of the communities you want to scrape'
            }
        });
        
    } else if (error instanceof ValidationError) {
        Apify.utils.log.error(`Input validation error: ${error.message}`);
        
        await Apify.setValue('VALIDATION_ERROR', {
            error: error.message,
            timestamp: new Date().toISOString(),
            inputSchema: 'Check INPUT_SCHEMA.json for required field formats'
        });
        
    } else {
        Apify.utils.log.error(`Scraping failed: ${error.message}`);
        Apify.utils.log.error(`Stack trace: ${error.stack}`);
        
        await Apify.setValue('SCRAPING_ERROR', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Handles fatal errors that prevent the Actor from running
 * @param {Error} error - Fatal error
 */
async function handleFatalError(error) {
    Apify.utils.log.error('=== FATAL ERROR ===');
    Apify.utils.log.error(`Actor failed: ${error.message}`);
    
    if (error.stack) {
        Apify.utils.log.error(`Stack trace: ${error.stack}`);
    }

    // Store error information for debugging
    await Apify.setValue('FATAL_ERROR', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
    });

    // Provide user guidance based on error type
    if (error.message.includes('Input validation')) {
        Apify.utils.log.error('\n🔧 FIX: Check your input parameters and ensure all required fields are provided.');
    } else if (error.message.includes('Authentication')) {
        Apify.utils.log.error('\n🔧 FIX: Verify your cookies are valid and you have access to the communities.');
    } else if (error.message.includes('Network') || error.message.includes('timeout')) {
        Apify.utils.log.error('\n🔧 FIX: Check your network connection and try again. Consider using proxy configuration.');
    } else {
        Apify.utils.log.error('\n🔧 FIX: Check the error details above and contact support if the issue persists.');
    }

    Apify.utils.log.error('==================');
}

/**
 * Handles graceful shutdown
 */
process.on('SIGTERM', async () => {
    Apify.utils.log.info('Received SIGTERM, performing graceful shutdown...');
    // Cleanup will be handled in the finally block of main()
});

process.on('SIGINT', async () => {
    Apify.utils.log.info('Received SIGINT, performing graceful shutdown...');
    // Cleanup will be handled in the finally block of main()
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    Apify.utils.log.error('Unhandled Promise Rejection:', reason);
    // Don't exit process, let main error handler deal with it
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    Apify.utils.log.error('Uncaught Exception:', error);
    process.exit(1);
});