name: "Skool.com Apify Actor - Comprehensive Web Scraper"
description: |

## Purpose
Create a production-ready Apify Actor for scraping posts, comments, and user data from Skool.com communities using Node.js and Puppeteer. The Actor must handle authentication, pagination, nested comments, and provide robust error handling with proxy support.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Build a comprehensive Apify Actor to scrape posts and comments from Skool.com communities using Node.js and Puppeteer. The scraper should extract detailed post data, nested comments, user information, and engagement metrics from both Community and Classroom tabs, while handling authentication via cookies, supporting multiple URL inputs, and providing robust error handling with proxy support.

## Why
- **Business value**: Enable content strategy analysis and community engagement insights for Skool.com users
- **Integration**: Follows Apify platform standards and can be monetized on Apify Store
- **Problems solved**: Automates manual data collection from private Skool communities for members with legitimate access

## What
A production-ready Apify Actor that:
- Extracts posts with metadata (title, content, upvotes, comments count, created date, author info)
- Scrapes nested comment threads with full reply chains
- Supports both Community tab (posts/discussions) and Classroom tab (courses/modules)
- Handles cookie-based authentication (user must be member of target groups)
- Processes multiple Skool group URLs in a single run
- Implements pagination to collect all posts/comments
- Supports custom data filtering and limits
- Exports data in structured JSON format via Apify Dataset
- Built-in proxy support for reliability and avoiding blocks
- Configurable concurrency and request retry logic

### Success Criteria
- [ ] Successfully authenticates using imported cookies from browser extensions
- [ ] Extracts complete post data with nested comments preserving thread structure
- [ ] Handles infinite scroll pagination for both posts and comments
- [ ] Processes multiple Skool community URLs in single Actor run
- [ ] Implements proper error handling with clear user guidance
- [ ] Supports both Community and Classroom tab content extraction
- [ ] Validates and stores data using Apify Dataset with proper schema
- [ ] Includes comprehensive logging and debugging capabilities
- [ ] Memory-efficient processing for large communities
- [ ] Passes all validation tests and quality checks

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://docs.apify.com
  why: Core Apify platform architecture, Actor development patterns, SDK best practices
  
- url: https://pptr.dev
  why: Puppeteer API reference for page navigation, cookie handling, dynamic content
  
- url: https://apify.com/memo23/skool-posts-with-comments-scraper
  why: Existing Skool scraper reference for input/output schema patterns
  
- url: https://scrapfly.io/blog/how-to-handle-cookies-in-web-scraping/
  why: Cookie authentication patterns and session management
  
- url: https://www.scrapingbee.com/blog/infinite-scroll-puppeteer/
  why: Infinite scroll pagination handling with Puppeteer
  
- url: https://webscraping.ai/faq/puppeteer/how-to-crawl-a-single-page-application-spa-using-puppeteer
  why: SPA-specific scraping techniques for JavaScript-heavy sites like Skool
  
- file: /Users/franck/Github/apify/CLAUDE.md
  why: Project structure requirements, code quality standards, Apify platform integration rules
  
- file: /Users/franck/Github/apify/initial.md
  why: Complete feature requirements, input/output schema examples, technical specifications
```

### Current Codebase tree
```bash
apify/
├── CLAUDE.md                    # Project rules and standards
├── initial.md                   # Feature requirements and examples
├── PRPs/
│   ├── templates/
│   │   └── prp_base.md         # PRP template structure
│   └── EXAMPLE_multi_agent_prp.md
└── README.md
```

### Desired Codebase tree with files to be added
```bash
skool-scraper/
├── src/
│   ├── main.js                  # Entry point - Actor initialization and orchestration
│   ├── scraper.js              # Core scraping logic with Puppeteer
│   ├── utils/
│   │   ├── auth.js             # Cookie authentication and session management
│   │   ├── pagination.js       # Infinite scroll and pagination handling
│   │   ├── parsers.js          # Data extraction and parsing utilities
│   │   └── validators.js       # Input and data validation functions
│   └── config/
│       └── selectors.js        # DOM selectors and constants
├── apify.json                  # Actor metadata and configuration
├── INPUT_SCHEMA.json           # Input validation schema
├── README.md                   # Actor documentation and usage guide
└── package.json               # Dependencies and scripts
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: Skool.com uses JavaScript-heavy SPA architecture - wait for content to load
// CRITICAL: Authentication REQUIRED - user must be member of communities to scrape
// CRITICAL: Cookie format validation essential - invalid cookies cause silent failures
// CRITICAL: Infinite scroll requires proper scroll detection and content loading waits
// CRITICAL: Comments can be deeply nested - implement recursive extraction
// CRITICAL: Rate limiting protections - implement delays between requests (1-3 seconds)
// CRITICAL: Dynamic content loading - use proper wait conditions for element visibility
// CRITICAL: Apify Dataset requires consistent schema - validate before pushing data
// CRITICAL: Memory management for large communities - process in batches
// CRITICAL: Proxy configuration for geo-restricted content and reliability
// CRITICAL: Error recovery with clear user guidance for common authentication failures
```

## Implementation Blueprint

### Data models and structure

```javascript
// Core data models for type safety and consistency
const PostSchema = {
  id: "string",              // unique post identifier
  name: "string",            // url-friendly post name
  metadata: {
    content: "string",       // post content/body
    comments: "number",      // comment count
    upvotes: "number",       // upvote count
    title: "string",         // post title
    pinned: "number",        // pinned status
    imagePreview: "string",  // image URL if present
    videoLinksData: "string", // video data JSON
    contributors: "string",   // contributors JSON
    labels: "string"         // label identifiers
  },
  createdAt: "ISO date",     // creation timestamp
  updatedAt: "ISO date",     // last update timestamp
  user: {
    id: "string",            // user identifier
    name: "string",          // username
    metadata: {
      bio: "string",         // user biography
      pictureBubble: "string", // profile bubble URL
      pictureProfile: "string", // profile picture URL
      location: "string"     // user location
    },
    firstName: "string",     // user first name
    lastName: "string"       // user last name
  },
  url: "string",             // full post URL
  comments: []               // nested comment array
};

const CommentSchema = {
  post: {
    id: "string",            // comment identifier
    metadata: {
      content: "string",     // comment content
      upvotes: "number"      // comment upvotes
    },
    created_at: "ISO date",  // comment timestamp
    user: {
      id: "string",          // commenter ID
      name: "string",        // commenter username
      first_name: "string",  // commenter first name
      last_name: "string"    // commenter last name
    }
  }
};

const InputSchema = {
  startUrls: [],             // Array of Skool community URLs
  tab: "community",          // "community" or "classroom"
  includeComments: true,     // Whether to extract comments
  maxItems: 1000,            // Maximum items to scrape
  maxConcurrency: 100,       // Concurrent request limit
  minConcurrency: 1,         // Minimum concurrent requests
  maxRequestRetries: 30,     // Retry attempts for failed requests
  cookies: [],               // Cookie array from browser extension
  proxyConfig: {}            // Proxy configuration object
};
```

### List of tasks to be completed to fulfill the PRP in order

```yaml
Task 1: Setup Project Structure and Configuration
CREATE package.json:
  - PATTERN: Follow Apify Actor package.json standards
  - Dependencies: apify, puppeteer, lodash for utilities
  - Scripts for development and testing

CREATE apify.json:
  - PATTERN: Standard Apify Actor metadata format
  - Actor title, description, version, categories
  - Resource requirements and timeout configuration

CREATE INPUT_SCHEMA.json:
  - PATTERN: Apify input schema validation format
  - All required and optional input fields with validation
  - Clear descriptions and examples for each field

Task 2: Implement Core Configuration and Selectors
CREATE src/config/selectors.js:
  - PATTERN: Centralized selector management
  - CSS selectors for posts, comments, user info, pagination
  - Wait conditions and timeout configurations

CREATE src/utils/validators.js:
  - PATTERN: Input validation with clear error messages
  - URL validation for Skool.com domains
  - Cookie format validation and structure checking
  - Numeric limits validation for maxItems, concurrency

Task 3: Implement Authentication System
CREATE src/utils/auth.js:
  - PATTERN: Cookie-based authentication like existing Skool scrapers
  - Cookie parsing and validation functions
  - Session management and authentication verification
  - Clear error messages for authentication failures

Task 4: Implement Data Parsing and Extraction
CREATE src/utils/parsers.js:
  - PATTERN: Structured data extraction with error handling
  - Post metadata extraction functions
  - User information parsing with fallbacks
  - Comment thread recursive extraction
  - Data validation before storage

Task 5: Implement Pagination and Scrolling
CREATE src/utils/pagination.js:
  - PATTERN: Infinite scroll handling like modern SPA scrapers
  - Scroll detection and content loading waits
  - Load more button handling for comments
  - Progress tracking and batch processing
  - Memory cleanup between batches

Task 6: Implement Core Scraper Logic
CREATE src/scraper.js:
  - PATTERN: Puppeteer-based scraper with proper lifecycle management
  - Page navigation and cookie setting
  - Dynamic content waiting and extraction
  - Error handling with retries and fallbacks
  - Concurrent processing with rate limiting

Task 7: Implement Main Actor Entry Point
CREATE src/main.js:
  - PATTERN: Standard Apify Actor main.js structure
  - Input validation and processing
  - RequestQueue and Dataset initialization
  - Progress tracking and logging
  - Cleanup and resource management

Task 8: Add Comprehensive Documentation
CREATE README.md:
  - PATTERN: Apify Actor documentation standards
  - Setup instructions and authentication guide
  - Input/output schema documentation
  - Usage examples and troubleshooting
  - Cookie extraction guide with browser extensions

Task 9: Add Error Handling and Logging
MODIFY all files:
  - PATTERN: Comprehensive error handling throughout
  - Structured logging with appropriate levels
  - User-friendly error messages with recovery instructions
  - Progress indicators and debugging information

Task 10: Add Tests and Quality Assurance
CREATE tests/:
  - PATTERN: Unit tests for utility functions
  - Integration tests for scraping workflows
  - Mock data for testing without live scraping
  - Edge case handling validation
```

### Per task pseudocode as needed

```javascript
// Task 3: Authentication System
async function validateAndSetCookies(page, cookies) {
    // PATTERN: Always validate input first
    if (!cookies || !Array.isArray(cookies)) {
        throw new ValidationError('Cookies must be provided as array from browser extension');
    }
    
    // GOTCHA: Cookie format varies by browser extension
    const validatedCookies = cookies.map(cookie => {
        if (!cookie.name || !cookie.value || !cookie.domain) {
            throw new ValidationError('Invalid cookie format - missing required fields');
        }
        return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain.includes('skool.com') ? cookie.domain : '.skool.com',
            path: cookie.path || '/',
            secure: true,
            httpOnly: cookie.httpOnly || false
        };
    });
    
    // CRITICAL: Set cookies before navigation
    await page.setCookie(...validatedCookies);
    
    // PATTERN: Verify authentication by checking for login indicators
    await page.goto('https://www.skool.com/discovery');
    await page.waitForTimeout(2000); // Allow page to load
    
    const isAuthenticated = await page.$('.user-avatar') !== null;
    if (!isAuthenticated) {
        throw new AuthenticationError('Authentication failed - check cookie validity and expiration');
    }
}

// Task 5: Infinite Scroll Pagination
async function handleInfiniteScroll(page, maxItems = 1000) {
    let itemCount = 0;
    let previousHeight = 0;
    let stableScrollCount = 0;
    
    while (itemCount < maxItems) {
        // PATTERN: Scroll to bottom and wait for new content
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        // CRITICAL: Wait for new content to load
        await page.waitForTimeout(2000);
        
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        
        // GOTCHA: Check if new content actually loaded
        if (currentHeight === previousHeight) {
            stableScrollCount++;
            if (stableScrollCount >= 3) {
                console.log('No more content to load - reached end');
                break;
            }
        } else {
            stableScrollCount = 0;
            previousHeight = currentHeight;
        }
        
        // PATTERN: Count loaded items and check limits
        const items = await page.$$('[data-testid="post-item"]');
        itemCount = items.length;
        
        console.log(`Loaded ${itemCount} items so far...`);
    }
    
    return itemCount;
}

// Task 6: Core Scraper Logic
async function scrapeSkoolCommunity(page, startUrl, options) {
    // PATTERN: Navigate with proper wait conditions
    await page.goto(startUrl, { waitUntil: 'networkidle2' });
    
    // CRITICAL: Wait for dynamic content
    await page.waitForSelector('[data-testid="community-posts"]', { timeout: 30000 });
    
    // PATTERN: Handle pagination first
    const itemCount = await handleInfiniteScroll(page, options.maxItems);
    
    // PATTERN: Extract data in batches for memory efficiency
    const batchSize = 50;
    const allPosts = [];
    
    for (let i = 0; i < itemCount; i += batchSize) {
        const batchPosts = await page.evaluate((startIndex, endIndex) => {
            const posts = [];
            const postElements = document.querySelectorAll('[data-testid="post-item"]');
            
            for (let j = startIndex; j < Math.min(endIndex, postElements.length); j++) {
                const postEl = postElements[j];
                
                // PATTERN: Robust data extraction with fallbacks
                const post = {
                    id: postEl.getAttribute('data-post-id') || `post-${j}`,
                    metadata: {
                        title: postEl.querySelector('.post-title')?.textContent?.trim() || '',
                        content: postEl.querySelector('.post-content')?.textContent?.trim() || '',
                        upvotes: parseInt(postEl.querySelector('.upvote-count')?.textContent) || 0,
                        comments: parseInt(postEl.querySelector('.comment-count')?.textContent) || 0
                    },
                    user: {
                        name: postEl.querySelector('.author-name')?.textContent?.trim() || 'Unknown',
                        id: postEl.querySelector('.author-link')?.getAttribute('href')?.split('/').pop() || ''
                    },
                    url: postEl.querySelector('.post-link')?.href || ''
                };
                
                posts.push(post);
            }
            
            return posts;
        }, i, i + batchSize);
        
        allPosts.push(...batchPosts);
        
        // PATTERN: Process comments if requested
        if (options.includeComments) {
            for (const post of batchPosts) {
                try {
                    const comments = await extractCommentsForPost(page, post.url);
                    post.comments = comments;
                } catch (error) {
                    console.log(`Failed to extract comments for post ${post.id}:`, error.message);
                    post.comments = [];
                }
            }
        }
        
        // CRITICAL: Memory cleanup between batches
        if (i > 0 && i % 200 === 0) {
            await page.evaluate(() => {
                if (window.gc) window.gc();
            });
        }
    }
    
    return allPosts;
}
```

### Integration Points
```yaml
APIFY PLATFORM:
  - Dataset: Store scraped data with consistent schema validation
  - RequestQueue: Manage multiple community URLs with proper queuing
  - Key-Value Store: Cache user data and session information
  - Proxy: Configure residential proxies for reliability

PUPPETEER:
  - Browser: Launch with stealth mode and proper user agent
  - Page: Handle navigation, cookies, and dynamic content
  - Selectors: Wait for elements and handle SPA loading
  - Network: Intercept requests for debugging and optimization

CONFIGURATION:
  - Environment: Support for different Skool.com domains and regions
  - Input Schema: Comprehensive validation with clear error messages
  - Logging: Structured logging with different levels for debugging
  - Error Handling: Graceful degradation with user-friendly messages
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npx eslint src/ --fix              # JavaScript linting and auto-fix
npm audit                          # Security vulnerability check

# Expected: No errors. If errors, READ and fix before proceeding.
```

### Level 2: Unit Tests
```javascript
// test/auth.test.js
const { validateAndSetCookies } = require('../src/utils/auth');

describe('Cookie Authentication', () => {
  test('validates correct cookie format', async () => {
    const validCookies = [
      { name: 'session', value: 'abc123', domain: '.skool.com' }
    ];
    // Should not throw error
    expect(() => validateCookieFormat(validCookies)).not.toThrow();
  });
  
  test('rejects invalid cookie format', async () => {
    const invalidCookies = [{ name: 'session' }]; // missing value
    expect(() => validateCookieFormat(invalidCookies)).toThrow('Invalid cookie format');
  });
});

// test/pagination.test.js
describe('Infinite Scroll Pagination', () => {
  test('handles empty page gracefully', async () => {
    const mockPage = createMockPage([]);
    const result = await handleInfiniteScroll(mockPage, 100);
    expect(result).toBe(0);
  });
  
  test('respects maxItems limit', async () => {
    const mockPage = createMockPageWithInfiniteContent();
    const result = await handleInfiniteScroll(mockPage, 50);
    expect(result).toBeLessThanOrEqual(50);
  });
});

// test/parsers.test.js
describe('Data Parsing', () => {
  test('extracts post data with all fields', () => {
    const mockPostElement = createMockPostElement();
    const parsed = parsePostData(mockPostElement);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('metadata.title');
    expect(parsed).toHaveProperty('user.name');
  });
  
  test('handles missing fields gracefully', () => {
    const incompletePostElement = createIncompletePostElement();
    const parsed = parsePostData(incompletePostElement);
    expect(parsed.metadata.title).toBe(''); // fallback to empty string
    expect(parsed.metadata.upvotes).toBe(0); // fallback to zero
  });
});
```

```bash
# Run tests iteratively until passing:
npm test
npm run test:coverage

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Test full Actor workflow
npm start

# Expected behavior:
# 1. Actor starts and validates input
# 2. Authenticates using provided cookies
# 3. Navigates to Skool community URLs
# 4. Handles infinite scroll pagination
# 5. Extracts posts and comments
# 6. Stores data in Apify Dataset
# 7. Provides progress updates and completion summary

# Manual validation:
# - Check Apify Dataset for proper data structure
# - Verify comment threading is preserved
# - Confirm user information is extracted correctly
# - Validate that authentication errors provide clear guidance
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npx eslint src/`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Input schema validation works: Test with invalid inputs
- [ ] Cookie authentication flow complete: Test with expired cookies
- [ ] Infinite scroll pagination functional: Test with large communities
- [ ] Comment threading preserved: Verify nested comment structure
- [ ] Multiple URL processing: Test with array of community URLs
- [ ] Error handling comprehensive: Test network failures, timeouts
- [ ] Memory usage reasonable: Monitor during large community scraping
- [ ] Proxy support functional: Test with Apify proxy configuration
- [ ] Documentation complete: README covers all setup and usage
- [ ] Data schema consistent: All output matches defined structure

---

## Anti-Patterns to Avoid
- ❌ Don't attempt to scrape without proper authentication - will fail silently
- ❌ Don't ignore JavaScript rendering time - wait for content to load
- ❌ Don't hardcode selectors - Skool may change DOM structure frequently
- ❌ Don't skip request retry logic - network issues are common with SPA sites
- ❌ Don't forget to handle empty communities or private content gracefully
- ❌ Don't overwhelm server with concurrent requests - implement proper delays
- ❌ Don't assume infinite scroll will always work - have fallback strategies
- ❌ Don't skip data validation - malformed data causes Dataset errors
- ❌ Don't log sensitive cookie values - security risk and privacy violation
- ❌ Don't use sync operations in async context - breaks Puppeteer workflows

## Confidence Score: 8/10

High confidence due to:
- Clear feature requirements and examples from initial.md
- Comprehensive research on Apify Actor patterns and Puppeteer techniques
- Existing Skool scraper references for input/output schema validation
- Well-established patterns for SPA scraping and cookie authentication
- Detailed validation gates and testing strategy

Minor uncertainty factors:
- Skool.com DOM structure may change requiring selector updates
- Rate limiting behavior not fully documented
- Comment threading complexity may require iterative refinement