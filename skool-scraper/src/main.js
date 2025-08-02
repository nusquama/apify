import { Actor } from 'apify';
import { SkoolScraper } from './scraper.js';
import { validateInput, ValidationError, AuthenticationError } from './utils/validators.js';

// Initialize Actor
await Actor.init();

try {
    await Actor.main(async () => {
        try {
            console.log('=== SKOOL SCRAPER ACTOR STARTING ===');

            // Get and validate input
            const input = await Actor.getInput();
            console.log('Input received, validating...');

            let validatedInput;
            try {
                validatedInput = validateInput(input);
                console.log('Input validation successful');
            } catch (validationError) {
                console.error(`Input validation failed: ${validationError.message}`);
                throw validationError;
            }

            // Log configuration (without sensitive data)
            logConfiguration(validatedInput);

            // Initialize dataset for storing results
            const dataset = await Actor.openDataset();
            
            // Initialize scraper
            const scraper = new SkoolScraper(validatedInput);
            
            try {
                // Initialize the PuppeteerCrawler
                await scraper.initialize();

                // Start scraping all communities
                console.log('Starting scraping process...');
                await scraper.run();

                // Log completion summary
                logCompletionSummary([], scraper.stats);

            } catch (scrapingError) {
                await handleScrapingError(scrapingError);
                throw scrapingError;
            } finally {
                // Cleanup (automatic with PuppeteerCrawler)
                await scraper.cleanup();
            }

            console.log('=== SKOOL SCRAPER ACTOR COMPLETED SUCCESSFULLY ===');

        } catch (error) {
            await handleFatalError(error);
            await Actor.fail('Actor execution failed');
        }
    });
} catch (error) {
    console.error('Fatal error in Actor execution:', error);
    await Actor.fail('Critical Actor failure');
} finally {
    await Actor.exit();
}

/**
 * Logs the configuration (without sensitive information)
 * @param {Object} input - Validated input configuration
 */
function logConfiguration(input) {
    console.log('=== CONFIGURATION ===');
    console.log(`Communities to scrape: ${input.startUrls.length}`);
    input.startUrls.forEach((urlObj, index) => {
        console.log(`  ${index + 1}. ${urlObj.url}`);
    });
    console.log(`Tab: ${input.tab}`);
    console.log(`Include comments: ${input.includeComments}`);
    console.log(`Max items: ${input.maxItems || 'unlimited'}`);
    console.log(`Max concurrency: ${input.maxConcurrency}`);
    console.log(`Request delay: ${input.requestDelay}s`);
    console.log(`Scroll delay: ${input.scrollDelay}s`);
    console.log(`Debug mode: ${input.debug}`);
    console.log(`Cookies provided: ${input.cookies.length} items`);
    console.log(`Proxy enabled: ${input.proxyConfig?.useApifyProxy || false}`);
    console.log('=====================');
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

            console.log(`Stored batch: ${storedCount}/${posts.length} posts`);

            // Small delay between batches
            if (i + batchSize < posts.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (storageError) {
        console.error(`Failed to store results: ${storageError.message}`);
        throw storageError;
    }
}

/**
 * Logs completion summary
 * @param {Array} posts - Array of scraped posts
 * @param {Object} stats - Scraping statistics
 */
function logCompletionSummary(posts, stats) {
    console.log('=== SCRAPING SUMMARY ===');
    console.log(`Total communities processed: ${stats.communities || 0}`);
    console.log(`Total posts scraped: ${stats.posts || 0}`);
    console.log(`Total items processed: ${stats.processed || 0}`);
    
    if (posts.length > 0) {
        const postsWithComments = posts.filter(post => post.comments && post.comments.length > 0);
        console.log(`Posts with comments: ${postsWithComments.length}`);
        
        if (stats.posts > 0) {
            console.log(`Posts with comments: ${postsWithComments.length}/${stats.posts}`);
        }
    }

    if (stats.errors.length > 0) {
        console.warn(`Errors encountered: ${stats.errors.length}`);
    }

    console.log('========================');
}

/**
 * Handles scraping errors with user-friendly messages
 * @param {Error} error - Scraping error
 */
async function handleScrapingError(error) {
    console.error('=== SCRAPING ERROR ===');
    
    if (error instanceof AuthenticationError) {
        const authMessage = getAuthErrorMessage(error);
        console.error(authMessage);
        
        // Store error details for user
        await Actor.setValue('AUTHENTICATION_ERROR', {
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
        console.error(`Input validation error: ${error.message}`);
        
        await Actor.setValue('VALIDATION_ERROR', {
            error: error.message,
            timestamp: new Date().toISOString(),
            inputSchema: 'Check INPUT_SCHEMA.json for required field formats'
        });
        
    } else {
        console.error(`Scraping failed: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        
        await Actor.setValue('SCRAPING_ERROR', {
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
    console.error('=== FATAL ERROR ===');
    console.error(`Actor failed: ${error.message}`);
    
    if (error.stack) {
        console.error(`Stack trace: ${error.stack}`);
    }

    // Store error information for debugging
    await Actor.setValue('FATAL_ERROR', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
    });

    // Provide user guidance based on error type
    if (error.message.includes('Input validation')) {
        console.error('\n🔧 FIX: Check your input parameters and ensure all required fields are provided.');
    } else if (error.message.includes('Authentication')) {
        console.error('\n🔧 FIX: Verify your cookies are valid and you have access to the communities.');
    } else if (error.message.includes('Network') || error.message.includes('timeout')) {
        console.error('\n🔧 FIX: Check your network connection and try again. Consider using proxy configuration.');
    } else {
        console.error('\n🔧 FIX: Check the error details above and contact support if the issue persists.');
    }

    console.error('==================');
}