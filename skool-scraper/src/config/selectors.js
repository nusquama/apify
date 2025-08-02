/**
 * DOM selectors and configuration constants for Skool.com scraping
 * Centralized to make maintenance easier when Skool updates their UI
 */

const SELECTORS = {
    // Authentication and navigation
    AUTH: {
        userAvatar: '.user-avatar, [data-testid="user-avatar"]',
        loginButton: '[data-testid="login-button"], .login-btn',
        profileMenu: '[data-testid="profile-menu"]'
    },

    // Community navigation
    NAVIGATION: {
        communityTab: '[data-testid="community-tab"], .community-tab',
        classroomTab: '[data-testid="classroom-tab"], .classroom-tab',
        postsContainer: '[data-testid="posts-container"], .posts-container'
    },

    // Post elements
    POSTS: {
        postItem: '[data-testid="post-item"], .post-item, article[data-post-id]',
        postTitle: '.post-title, [data-testid="post-title"], h1, h2, h3',
        postContent: '.post-content, [data-testid="post-content"], .content-body',
        postAuthor: '.post-author, [data-testid="post-author"], .author-name',
        authorLink: '.author-link, [data-testid="author-link"], a[href*="/user/"]',
        postUrl: '.post-link, [data-testid="post-link"], a[href*="/post/"]',
        upvoteCount: '.upvote-count, [data-testid="upvote-count"], .votes',
        commentCount: '.comment-count, [data-testid="comment-count"], .comments-count',
        postDate: '.post-date, [data-testid="post-date"], time',
        postId: '[data-post-id]',
        pinnedIndicator: '.pinned, [data-testid="pinned"], .pin-indicator',
        imagePreview: '.post-image, [data-testid="post-image"], img',
        videoPreview: '.post-video, [data-testid="post-video"], video'
    },

    // Comment elements
    COMMENTS: {
        commentsContainer: '.comments-container, [data-testid="comments-container"]',
        commentItem: '.comment-item, [data-testid="comment-item"]',
        commentContent: '.comment-content, [data-testid="comment-content"]',
        commentAuthor: '.comment-author, [data-testid="comment-author"]',
        commentDate: '.comment-date, [data-testid="comment-date"], time',
        commentUpvotes: '.comment-upvotes, [data-testid="comment-upvotes"]',
        replyButton: '.reply-button, [data-testid="reply-button"]',
        nestedComments: '.nested-comments, [data-testid="nested-comments"]',
        loadMoreComments: '.load-more-comments, [data-testid="load-more-comments"]',
        commentId: '[data-comment-id]'
    },

    // User profile elements
    USER: {
        userProfile: '.user-profile, [data-testid="user-profile"]',
        userName: '.user-name, [data-testid="user-name"]',
        userBio: '.user-bio, [data-testid="user-bio"]',
        userAvatar: '.user-avatar, [data-testid="user-avatar"]',
        userLocation: '.user-location, [data-testid="user-location"]',
        userFirstName: '.user-first-name, [data-testid="user-first-name"]',
        userLastName: '.user-last-name, [data-testid="user-last-name"]',
        userId: '[data-user-id]'
    },

    // Pagination and loading
    PAGINATION: {
        loadMoreButton: '.load-more, [data-testid="load-more"]',
        loadingIndicator: '.loading, [data-testid="loading"], .spinner',
        endOfContent: '.end-of-content, [data-testid="end-of-content"]',
        noMoreContent: '.no-more-content, [data-testid="no-more-content"]'
    },

    // Error states
    ERROR: {
        accessDenied: '.access-denied, [data-testid="access-denied"]',
        privateContent: '.private-content, [data-testid="private-content"]',
        loginRequired: '.login-required, [data-testid="login-required"]',
        notFound: '.not-found, [data-testid="not-found"], .error-404'
    }
};

// Wait conditions and timeouts
const WAIT_CONDITIONS = {
    pageLoad: 'networkidle2',
    elementVisible: { visible: true, timeout: 30000 },
    contentLoad: { timeout: 15000 },
    scrollWait: 2000,
    requestDelay: 2000,
    authTimeout: 10000
};

// URL patterns and validation
const URL_PATTERNS = {
    community: /^https:\/\/www\.skool\.com\/[a-zA-Z0-9-_]+\/?$/,
    post: /^https:\/\/www\.skool\.com\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/,
    user: /^https:\/\/www\.skool\.com\/user\/[a-zA-Z0-9-_]+$/,
    classroom: /^https:\/\/www\.skool\.com\/[a-zA-Z0-9-_]+\/classroom/
};

// Data extraction patterns
const EXTRACTION_PATTERNS = {
    postId: /post\/([a-zA-Z0-9-_]+)/,
    userId: /user\/([a-zA-Z0-9-_]+)/,
    communityName: /skool\.com\/([a-zA-Z0-9-_]+)/,
    commentId: /comment-([a-zA-Z0-9-_]+)/
};

// Error messages
const ERROR_MESSAGES = {
    AUTHENTICATION_FAILED: 'Authentication failed. Please check your cookies and ensure they are valid.',
    ACCESS_DENIED: 'Access denied. You must be a member of this community to scrape its content.',
    COMMUNITY_NOT_FOUND: 'Community not found. Please check the URL and try again.',
    INVALID_COOKIES: 'Invalid cookie format. Please export cookies from your browser using Cookie-Editor extension.',
    RATE_LIMITED: 'Rate limited by Skool. Please reduce concurrency or increase delays.',
    NETWORK_ERROR: 'Network error occurred. Please check your internet connection and try again.'
};

module.exports = {
    SELECTORS,
    WAIT_CONDITIONS,
    URL_PATTERNS,
    EXTRACTION_PATTERNS,
    ERROR_MESSAGES
};