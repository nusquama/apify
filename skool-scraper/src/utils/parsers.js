const Apify = require('apify');
const { SELECTORS, EXTRACTION_PATTERNS } = require('../config/selectors');
const { validatePostData, validateCommentData } = require('./validators');

/**
 * Extracts post data from a post element
 * @param {Object} postElement - Puppeteer element handle for a post
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<Object>} Parsed post data
 */
async function parsePostData(postElement, page) {
    try {
        const postData = await page.evaluate((element, selectors) => {
            // Helper function to safely get text content
            const getText = (selector, fallback = '') => {
                const el = element.querySelector(selector);
                return el ? el.textContent.trim() : fallback;
            };

            // Helper function to safely get attribute
            const getAttr = (selector, attr, fallback = '') => {
                const el = element.querySelector(selector);
                return el ? (el.getAttribute(attr) || fallback) : fallback;
            };

            // Helper function to parse numbers
            const getNumber = (selector, fallback = 0) => {
                const text = getText(selector);
                const match = text.match(/\d+/);
                return match ? parseInt(match[0], 10) : fallback;
            };

            // Extract basic post information
            const postId = element.getAttribute('data-post-id') || 
                          getAttr('a[href*="/post/"]', 'href').split('/').pop() ||
                          `post-${Date.now()}`;

            const title = getText(selectors.POSTS.postTitle);
            const content = getText(selectors.POSTS.postContent);
            const url = getAttr(selectors.POSTS.postUrl, 'href') || window.location.href;

            // Extract engagement metrics
            const upvotes = getNumber(selectors.POSTS.upvoteCount);
            const comments = getNumber(selectors.POSTS.commentCount);

            // Extract author information
            const authorName = getText(selectors.POSTS.postAuthor);
            const authorLink = getAttr(selectors.POSTS.authorLink, 'href');
            const authorId = authorLink ? authorLink.split('/').pop() : '';

            // Extract additional metadata
            const pinned = element.querySelector(selectors.POSTS.pinnedIndicator) ? 1 : 0;
            const imagePreview = getAttr(selectors.POSTS.imagePreview, 'src');
            
            // Extract date information
            const dateElement = element.querySelector(selectors.POSTS.postDate);
            let createdAt = '';
            let updatedAt = '';
            
            if (dateElement) {
                const datetime = dateElement.getAttribute('datetime') || 
                               dateElement.getAttribute('title') ||
                               dateElement.textContent;
                createdAt = datetime;
                updatedAt = datetime; // Often the same for posts
            }

            return {
                id: postId,
                name: url.split('/').pop() || postId,
                metadata: {
                    content: content,
                    comments: comments,
                    upvotes: upvotes,
                    title: title,
                    pinned: pinned,
                    imagePreview: imagePreview,
                    videoLinksData: '[]', // Default empty array as string
                    contributors: '[]', // Default empty array as string
                    labels: '' // Default empty string
                },
                createdAt: createdAt || new Date().toISOString(),
                updatedAt: updatedAt || new Date().toISOString(),
                user: {
                    id: authorId,
                    name: authorName,
                    metadata: {
                        bio: '',
                        pictureBubble: '',
                        pictureProfile: '',
                        location: ''
                    },
                    firstName: authorName.split(' ')[0] || '',
                    lastName: authorName.split(' ').slice(1).join(' ') || ''
                },
                url: url,
                comments: [] // Will be populated separately if needed
            };
        }, postElement, SELECTORS);

        // Enhance user data if possible
        if (postData.user.id) {
            try {
                const enhancedUser = await extractUserData(page, postData.user.id);
                postData.user = { ...postData.user, ...enhancedUser };
            } catch (userError) {
                Apify.utils.log.debug(`Failed to enhance user data for ${postData.user.id}: ${userError.message}`);
            }
        }

        // Validate the extracted data
        if (!validatePostData(postData)) {
            throw new Error('Invalid post data structure');
        }

        return postData;

    } catch (error) {
        Apify.utils.log.error(`Failed to parse post data: ${error.message}`);
        throw error;
    }
}

/**
 * Extracts comment data from a comment element
 * @param {Object} commentElement - Puppeteer element handle for a comment
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<Object>} Parsed comment data
 */
async function parseCommentData(commentElement, page) {
    try {
        const commentData = await page.evaluate((element, selectors) => {
            // Helper functions
            const getText = (selector, fallback = '') => {
                const el = element.querySelector(selector);
                return el ? el.textContent.trim() : fallback;
            };

            const getAttr = (selector, attr, fallback = '') => {
                const el = element.querySelector(selector);
                return el ? (el.getAttribute(attr) || fallback) : fallback;
            };

            const getNumber = (selector, fallback = 0) => {
                const text = getText(selector);
                const match = text.match(/\d+/);
                return match ? parseInt(match[0], 10) : fallback;
            };

            // Extract comment information
            const commentId = element.getAttribute('data-comment-id') || 
                            `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const content = getText(selectors.COMMENTS.commentContent);
            const upvotes = getNumber(selectors.COMMENTS.commentUpvotes);

            // Extract author information
            const authorName = getText(selectors.COMMENTS.commentAuthor);
            const authorId = getAttr(selectors.COMMENTS.commentAuthor, 'data-user-id') || '';

            // Extract date
            const dateElement = element.querySelector(selectors.COMMENTS.commentDate);
            let createdAt = '';
            
            if (dateElement) {
                createdAt = dateElement.getAttribute('datetime') || 
                           dateElement.getAttribute('title') ||
                           dateElement.textContent.trim();
            }

            return {
                post: {
                    id: commentId,
                    metadata: {
                        content: content,
                        upvotes: upvotes
                    },
                    created_at: createdAt || new Date().toISOString(),
                    user: {
                        id: authorId,
                        name: authorName,
                        first_name: authorName.split(' ')[0] || '',
                        last_name: authorName.split(' ').slice(1).join(' ') || ''
                    }
                }
            };
        }, commentElement, SELECTORS);

        // Validate the extracted data
        if (!validateCommentData(commentData)) {
            throw new Error('Invalid comment data structure');
        }

        return commentData;

    } catch (error) {
        Apify.utils.log.error(`Failed to parse comment data: ${error.message}`);
        throw error;
    }
}

/**
 * Extracts enhanced user data from user profile or hover card
 * @param {Object} page - Puppeteer page instance
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Enhanced user data
 */
async function extractUserData(page, userId) {
    try {
        // This would require navigating to user profile or extracting from hover cards
        // For now, return minimal data to avoid performance issues
        return {
            metadata: {
                bio: '',
                pictureBubble: '',
                pictureProfile: '',
                location: ''
            }
        };
    } catch (error) {
        Apify.utils.log.debug(`Failed to extract user data for ${userId}: ${error.message}`);
        return {
            metadata: {
                bio: '',
                pictureBubble: '',
                pictureProfile: '',
                location: ''
            }
        };
    }
}

/**
 * Recursively extracts nested comments from a post
 * @param {Object} page - Puppeteer page instance
 * @param {string} postUrl - URL of the post
 * @param {number} maxDepth - Maximum nesting depth for comments
 * @returns {Promise<Array>} Array of comment objects
 */
async function extractCommentsForPost(page, postUrl, maxDepth = 5) {
    try {
        Apify.utils.log.debug(`Extracting comments for post: ${postUrl}`);

        // Navigate to the post page
        await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for comments to load
        try {
            await page.waitForSelector(SELECTORS.COMMENTS.commentsContainer, { timeout: 10000 });
        } catch (waitError) {
            Apify.utils.log.debug('No comments container found - post may have no comments');
            return [];
        }

        // Load all comments by clicking "load more" buttons
        await loadAllComments(page);

        // Extract all comment elements
        const commentElements = await page.$$(SELECTORS.COMMENTS.commentItem);
        const comments = [];

        for (const commentElement of commentElements) {
            try {
                const commentData = await parseCommentData(commentElement, page);
                
                // Extract nested replies if they exist
                const nestedComments = await extractNestedComments(
                    page, 
                    commentElement, 
                    maxDepth - 1
                );
                
                if (nestedComments.length > 0) {
                    commentData.replies = nestedComments;
                }

                comments.push(commentData);
            } catch (commentError) {
                Apify.utils.log.debug(`Failed to parse comment: ${commentError.message}`);
                continue;
            }
        }

        Apify.utils.log.debug(`Extracted ${comments.length} comments for post`);
        return comments;

    } catch (error) {
        Apify.utils.log.error(`Failed to extract comments for post ${postUrl}: ${error.message}`);
        return [];
    }
}

/**
 * Extracts nested replies for a comment
 * @param {Object} page - Puppeteer page instance
 * @param {Object} commentElement - Parent comment element
 * @param {number} depth - Remaining depth for recursion
 * @returns {Promise<Array>} Array of nested comment objects
 */
async function extractNestedComments(page, commentElement, depth) {
    if (depth <= 0) {
        return [];
    }

    try {
        // Look for nested comments within this comment element
        const nestedElements = await commentElement.$$(SELECTORS.COMMENTS.nestedComments);
        const nestedComments = [];

        for (const nestedElement of nestedElements) {
            try {
                const nestedData = await parseCommentData(nestedElement, page);
                
                // Recursively extract deeper nesting
                const deeperNested = await extractNestedComments(page, nestedElement, depth - 1);
                if (deeperNested.length > 0) {
                    nestedData.replies = deeperNested;
                }

                nestedComments.push(nestedData);
            } catch (nestedError) {
                Apify.utils.log.debug(`Failed to parse nested comment: ${nestedError.message}`);
                continue;
            }
        }

        return nestedComments;

    } catch (error) {
        Apify.utils.log.debug(`Failed to extract nested comments: ${error.message}`);
        return [];
    }
}

/**
 * Loads all comments by clicking "load more" buttons
 * @param {Object} page - Puppeteer page instance
 */
async function loadAllComments(page) {
    try {
        let loadMoreAttempts = 0;
        const maxAttempts = 20; // Prevent infinite loops

        while (loadMoreAttempts < maxAttempts) {
            const loadMoreButton = await page.$(SELECTORS.COMMENTS.loadMoreComments);
            
            if (!loadMoreButton) {
                break; // No more load buttons
            }

            // Check if button is visible and clickable
            const isVisible = await page.evaluate(button => {
                return button && button.offsetParent !== null;
            }, loadMoreButton);

            if (!isVisible) {
                break;
            }

            // Click the load more button
            await loadMoreButton.click();
            
            // Wait for new comments to load
            await page.waitForTimeout(2000);
            
            loadMoreAttempts++;
        }

        Apify.utils.log.debug(`Loaded additional comments with ${loadMoreAttempts} load more clicks`);

    } catch (error) {
        Apify.utils.log.debug(`Failed to load all comments: ${error.message}`);
    }
}

/**
 * Extracts metadata from post content (hashtags, mentions, etc.)
 * @param {string} content - Post content text
 * @returns {Object} Extracted metadata
 */
function extractContentMetadata(content) {
    try {
        const metadata = {
            hashtags: [],
            mentions: [],
            links: [],
            wordCount: 0
        };

        if (!content || typeof content !== 'string') {
            return metadata;
        }

        // Extract hashtags
        const hashtagMatches = content.match(/#[a-zA-Z0-9_]+/g);
        if (hashtagMatches) {
            metadata.hashtags = hashtagMatches.map(tag => tag.slice(1)); // Remove #
        }

        // Extract mentions
        const mentionMatches = content.match(/@[a-zA-Z0-9_]+/g);
        if (mentionMatches) {
            metadata.mentions = mentionMatches.map(mention => mention.slice(1)); // Remove @
        }

        // Extract links
        const linkMatches = content.match(/(https?:\/\/[^\s]+)/g);
        if (linkMatches) {
            metadata.links = linkMatches;
        }

        // Word count
        metadata.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

        return metadata;

    } catch (error) {
        Apify.utils.log.debug(`Failed to extract content metadata: ${error.message}`);
        return {
            hashtags: [],
            mentions: [],
            links: [],
            wordCount: 0
        };
    }
}

module.exports = {
    parsePostData,
    parseCommentData,
    extractUserData,
    extractCommentsForPost,
    extractNestedComments,
    loadAllComments,
    extractContentMetadata
};