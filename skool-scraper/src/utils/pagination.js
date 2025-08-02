// Apify SDK v3 import removed
const { SELECTORS, WAIT_CONDITIONS } = require('../config/selectors');

/**
 * Handles infinite scroll pagination to load all available content
 * @param {Object} page - Puppeteer page instance
 * @param {number} maxItems - Maximum number of items to load (0 = unlimited)
 * @param {number} scrollDelay - Delay between scroll actions in seconds
 * @param {string} itemSelector - CSS selector for items to count
 * @returns {Promise<number>} Total number of items loaded
 */
async function handleInfiniteScroll(page, maxItems = 0, scrollDelay = 2, itemSelector = SELECTORS.POSTS.postItem) {
    try {
        console.info(`Starting infinite scroll pagination (maxItems: ${maxItems || 'unlimited'})`);

        let itemCount = 0;
        let previousHeight = 0;
        let stableScrollCount = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 200; // Prevent infinite loops
        const scrollDelayMs = scrollDelay * 1000;

        // Initial wait for content to load
        await page.waitForTimeout(3000);

        while (scrollAttempts < maxScrollAttempts) {
            // Get current page height and item count
            const [currentHeight, currentItemCount] = await page.evaluate((selector) => {
                const items = document.querySelectorAll(selector);
                return [document.body.scrollHeight, items.length];
            }, itemSelector);

            itemCount = currentItemCount;

            // Check if we've reached the desired number of items
            if (maxItems > 0 && itemCount >= maxItems) {
                console.info(`Reached maximum items limit: ${itemCount}/${maxItems}`);
                break;
            }

            // Check if page height changed (indicates new content loaded)
            if (currentHeight === previousHeight) {
                stableScrollCount++;
                
                // If height hasn't changed for 3 consecutive attempts, we might be at the end
                if (stableScrollCount >= 3) {
                    // Try clicking load more button if available
                    const loadMoreClicked = await clickLoadMoreButton(page);
                    if (!loadMoreClicked) {
                        console.info('No more content to load - reached end of page');
                        break;
                    } else {
                        stableScrollCount = 0; // Reset counter if load more worked
                        await page.waitForTimeout(scrollDelayMs);
                        continue;
                    }
                }
            } else {
                stableScrollCount = 0;
                previousHeight = currentHeight;
            }

            // Perform scroll action
            await performScrollAction(page, scrollDelayMs);
            scrollAttempts++;

            // Log progress periodically
            if (scrollAttempts % 10 === 0) {
                console.info(`Scroll progress: ${itemCount} items loaded, ${scrollAttempts} scroll attempts`);
            }

            // Check for loading indicators and wait for them to disappear
            await waitForContentToLoad(page);
        }

        console.info(`Infinite scroll completed: ${itemCount} items loaded in ${scrollAttempts} scroll attempts`);
        return itemCount;

    } catch (error) {
        console.error(`Infinite scroll failed: ${error.message}`);
        throw error;
    }
}

/**
 * Performs a scroll action to trigger content loading
 * @param {Object} page - Puppeteer page instance
 * @param {number} scrollDelayMs - Delay after scrolling in milliseconds
 */
async function performScrollAction(page, scrollDelayMs) {
    try {
        // Scroll to bottom of page
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait for scroll delay
        await page.waitForTimeout(scrollDelayMs);

        // Additional scroll techniques for stubborn content
        await page.evaluate(() => {
            // Scroll a bit up and down to trigger lazy loading
            window.scrollBy(0, -100);
            setTimeout(() => window.scrollBy(0, 200), 500);
        });

        await page.waitForTimeout(500);

    } catch (error) {
        console.debug(`Scroll action failed: ${error.message}`);
    }
}

/**
 * Clicks "Load More" or similar pagination buttons
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if button was found and clicked
 */
async function clickLoadMoreButton(page) {
    try {
        const loadMoreButton = await page.$(SELECTORS.PAGINATION.loadMoreButton);
        
        if (!loadMoreButton) {
            return false;
        }

        // Check if button is visible and clickable
        const isVisible = await page.evaluate(button => {
            if (!button) return false;
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   getComputedStyle(button).visibility !== 'hidden' &&
                   getComputedStyle(button).display !== 'none';
        }, loadMoreButton);

        if (!isVisible) {
            return false;
        }

        // Scroll button into view
        await page.evaluate(button => {
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, loadMoreButton);

        await page.waitForTimeout(1000);

        // Click the button
        await loadMoreButton.click();
        
        console.debug('Clicked load more button');
        return true;

    } catch (error) {
        console.debug(`Load more button click failed: ${error.message}`);
        return false;
    }
}

/**
 * Waits for content loading indicators to disappear
 * @param {Object} page - Puppeteer page instance
 */
async function waitForContentToLoad(page) {
    try {
        // Wait for loading indicators to appear and then disappear
        const loadingIndicator = await page.$(SELECTORS.PAGINATION.loadingIndicator);
        
        if (loadingIndicator) {
            // Wait for loading to start
            await page.waitForTimeout(500);
            
            // Wait for loading to finish (element to disappear or become invisible)
            await page.waitForFunction(
                (selector) => {
                    const element = document.querySelector(selector);
                    if (!element) return true;
                    const style = getComputedStyle(element);
                    return style.display === 'none' || style.visibility === 'hidden';
                },
                { timeout: 10000 },
                SELECTORS.PAGINATION.loadingIndicator
            ).catch(() => {
                // Timeout is okay, content might have loaded anyway
                console.debug('Loading indicator timeout - proceeding anyway');
            });
        }

        // Additional wait for network activity to settle
        await page.waitForTimeout(1000);

    } catch (error) {
        console.debug(`Content loading wait failed: ${error.message}`);
    }
}

/**
 * Handles pagination for comment sections within posts
 * @param {Object} page - Puppeteer page instance
 * @param {number} maxComments - Maximum comments to load per post
 * @returns {Promise<number>} Number of comments loaded
 */
async function handleCommentPagination(page, maxComments = 0) {
    try {
        console.debug('Handling comment pagination');

        let commentCount = 0;
        let loadMoreAttempts = 0;
        const maxAttempts = 20;

        while (loadMoreAttempts < maxAttempts) {
            // Get current comment count
            const currentComments = await page.evaluate((selector) => {
                return document.querySelectorAll(selector).length;
            }, SELECTORS.COMMENTS.commentItem);

            commentCount = currentComments;

            // Check if we've reached max comments
            if (maxComments > 0 && commentCount >= maxComments) {
                break;
            }

            // Try to click load more comments button
            const loadMoreClicked = await clickLoadMoreComments(page);
            if (!loadMoreClicked) {
                break; // No more comments to load
            }

            loadMoreAttempts++;
            await page.waitForTimeout(2000);
        }

        console.debug(`Comment pagination completed: ${commentCount} comments loaded`);
        return commentCount;

    } catch (error) {
        console.debug(`Comment pagination failed: ${error.message}`);
        return 0;
    }
}

/**
 * Clicks "Load More Comments" buttons
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if button was clicked
 */
async function clickLoadMoreComments(page) {
    try {
        const loadMoreButton = await page.$(SELECTORS.COMMENTS.loadMoreComments);
        
        if (!loadMoreButton) {
            return false;
        }

        const isClickable = await page.evaluate(button => {
            if (!button) return false;
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return rect.width > 0 && rect.height > 0 && 
                   style.visibility !== 'hidden' && 
                   style.display !== 'none' &&
                   !button.disabled;
        }, loadMoreButton);

        if (!isClickable) {
            return false;
        }

        await loadMoreButton.click();
        return true;

    } catch (error) {
        console.debug(`Load more comments click failed: ${error.message}`);
        return false;
    }
}

/**
 * Implements smart scrolling that adapts to page behavior
 * @param {Object} page - Puppeteer page instance
 * @param {Object} options - Scrolling options
 * @returns {Promise<Object>} Scrolling results
 */
async function smartScroll(page, options = {}) {
    const {
        maxItems = 0,
        itemSelector = SELECTORS.POSTS.postItem,
        scrollDelay = 2,
        adaptiveDelay = true,
        checkContentChanges = true
    } = options;

    try {
        let itemCount = 0;
        let scrollMetrics = {
            totalScrolls: 0,
            totalTime: 0,
            averageItemsPerScroll: 0,
            stuckCount: 0
        };

        const startTime = Date.now();
        let lastItemCount = 0;
        let currentDelay = scrollDelay * 1000;

        while (true) {
            const scrollStart = Date.now();

            // Get current metrics
            const [currentHeight, currentItems] = await page.evaluate((selector) => {
                return [document.body.scrollHeight, document.querySelectorAll(selector).length];
            }, itemSelector);

            itemCount = currentItems;

            // Check stopping conditions
            if (maxItems > 0 && itemCount >= maxItems) {
                break;
            }

            // Adaptive delay based on loading speed
            if (adaptiveDelay && scrollMetrics.totalScrolls > 5) {
                const itemsGained = itemCount - lastItemCount;
                if (itemsGained === 0) {
                    scrollMetrics.stuckCount++;
                    currentDelay = Math.min(currentDelay * 1.5, 5000); // Increase delay when stuck
                } else {
                    scrollMetrics.stuckCount = 0;
                    currentDelay = Math.max(currentDelay * 0.9, scrollDelay * 1000); // Decrease delay when flowing
                }

                // If stuck too long, try different strategies
                if (scrollMetrics.stuckCount >= 3) {
                    const loadMoreClicked = await clickLoadMoreButton(page);
                    if (!loadMoreClicked) {
                        break; // Truly at the end
                    }
                    scrollMetrics.stuckCount = 0;
                }
            }

            // Perform scroll
            await performScrollAction(page, currentDelay);
            
            // Update metrics
            scrollMetrics.totalScrolls++;
            scrollMetrics.totalTime = Date.now() - startTime;
            scrollMetrics.averageItemsPerScroll = itemCount / scrollMetrics.totalScrolls;

            lastItemCount = itemCount;

            // Log progress
            if (scrollMetrics.totalScrolls % 10 === 0) {
                console.info(
                    `Smart scroll progress: ${itemCount} items, ` +
                    `${scrollMetrics.totalScrolls} scrolls, ` +
                    `${(scrollMetrics.averageItemsPerScroll).toFixed(1)} items/scroll avg`
                );
            }
        }

        scrollMetrics.totalTime = Date.now() - startTime;
        
        console.info(
            `Smart scroll completed: ${itemCount} items in ${scrollMetrics.totalScrolls} scrolls ` +
            `(${(scrollMetrics.totalTime / 1000).toFixed(1)}s)`
        );

        return {
            itemCount,
            metrics: scrollMetrics
        };

    } catch (error) {
        console.error(`Smart scroll failed: ${error.message}`);
        throw error;
    }
}

/**
 * Checks if we've reached the end of content
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if at end of content
 */
async function isAtEndOfContent(page) {
    try {
        // Check for explicit end-of-content indicators
        const endIndicators = await page.evaluate((selectors) => {
            const endOfContent = document.querySelector(selectors.PAGINATION.endOfContent);
            const noMoreContent = document.querySelector(selectors.PAGINATION.noMoreContent);
            return {
                hasEndIndicator: !!(endOfContent || noMoreContent),
                isAtBottom: window.innerHeight + window.scrollY >= document.body.offsetHeight - 100
            };
        }, SELECTORS);

        return endIndicators.hasEndIndicator || endIndicators.isAtBottom;

    } catch (error) {
        console.debug(`End of content check failed: ${error.message}`);
        return false;
    }
}

module.exports = {
    handleInfiniteScroll,
    performScrollAction,
    clickLoadMoreButton,
    waitForContentToLoad,
    handleCommentPagination,
    clickLoadMoreComments,
    smartScroll,
    isAtEndOfContent
};