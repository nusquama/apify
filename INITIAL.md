# INITIAL.md - Skool Scraper Apify Actor

## FEATURE:
Build a comprehensive Apify Actor to scrape posts and comments from Skool.com communities using Node.js and Puppeteer. The scraper should extract detailed post data, nested comments, user information, and engagement metrics from both Community and Classroom tabs. The Actor must handle authentication via cookies, support multiple URL inputs, include pagination handling, and provide robust error handling with proxy support.

**Core Functionality Required:**
- Extract posts with metadata (title, content, upvotes, comments count, created date, author info)
- Scrape nested comment threads with full reply chains
- Support both Community tab (posts/discussions) and Classroom tab (courses/modules)
- Handle cookie-based authentication (user must be member of target groups)
- Process multiple Skool group URLs in a single run
- Implement pagination to collect all posts/comments
- Support custom data filtering and limits
- Export data in multiple formats (JSON, CSV, Excel)
- Built-in proxy support for reliability and avoiding blocks
- Configurable concurrency and request retry logic

**Technical Requirements:**
- Built on Apify platform using Node.js and Apify SDK
- Use Puppeteer for browser automation and JavaScript rendering
- Handle dynamic content loading and infinite scroll pagination
- Implement robust error handling and request retries
- Support residential proxies for geo-targeting
- Store data in Apify Dataset with proper schema validation
- Include comprehensive logging and debugging capabilities
- Memory-efficient processing for large communities

## EXAMPLES:
Based on the analysis of existing Skool scrapers on Apify, refer to these implementation patterns:

**Input Configuration Pattern:**
```javascript
{
  "startUrls": [
    {"url": "https://www.skool.com/ai-automation-mastery"},
    {"url": "https://www.skool.com/another-community"}
  ],
  "tab": "community", // or "classroom"
  "includeComments": true,
  "maxItems": 1000,
  "maxConcurrency": 100,
  "minConcurrency": 1,
  "maxRequestRetries": 30,
  "cookies": [], // Cookie array from browser extension
  "proxyConfig": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

**Expected Output Structure for Posts:**
```javascript
{
  "id": "unique-post-id",
  "name": "url-friendly-post-name",
  "metadata": {
    "content": "Post content here...",
    "comments": 37,
    "upvotes": 50,
    "title": "Post Title",
    "pinned": 1,
    "imagePreview": "image-url",
    "videoLinksData": "[]",
    "contributors": "[{...}]",
    "labels": "label-id"
  },
  "createdAt": "2024-11-07T23:26:18.04203Z",
  "updatedAt": "2024-11-14T09:50:05.802436Z",
  "user": {
    "id": "user-id",
    "name": "username",
    "metadata": {
      "bio": "User bio...",
      "pictureBubble": "profile-bubble-url",
      "pictureProfile": "profile-picture-url",
      "location": "User location"
    },
    "firstName": "First",
    "lastName": "Last"
  },
  "url": "https://www.skool.com/group-name/post-name",
  "comments": [
    {
      "post": {
        "id": "comment-id",
        "metadata": {
          "content": "Comment content...",
          "upvotes": 4
        },
        "created_at": "2024-11-07T23:28:36.995Z",
        "user": {
          "id": "user-id",
          "name": "username",
          "first_name": "First",
          "last_name": "Last"
        }
      }
    }
  ]
}
```

**Cookie Authentication Setup:**
Users must install Cookie-Editor or EditThisCookie browser extension, login to Skool.com, export cookies as JSON, and paste into the Actor's cookie input field.

## DOCUMENTATION:

**Essential API Documentation:**
- **Apify SDK Documentation**: https://docs.apify.com/sdk/
  - Dataset API for data storage: https://docs.apify.com/sdk/js/docs/api/apify/class/Dataset
  - Request Queue management: https://docs.apify.com/sdk/js/docs/api/apify/class/RequestQueue
  - Proxy configuration: https://docs.apify.com/proxy
  
- **Puppeteer Documentation**: https://pptr.dev/
  - Page navigation and evaluation: https://pptr.dev/api/puppeteer.page
  - Cookie handling: https://pptr.dev/api/puppeteer.page.setcookie
  - Request interception: https://pptr.dev/api/puppeteer.page.setRequestInterception

- **Existing Skool Scraper Reference**: https://apify.com/memo23/skool-posts-with-comments-scraper
  - Study the input/output schema and implementation patterns
  - Note the authentication requirements and cookie handling
  - Understand pagination and comment threading logic

- **Apify Actor Templates**: https://docs.apify.com/academy/actor-marketing-playbook/store-basics/how-to-build-actors
  - JavaScript/Node.js templates for web scraping
  - Best practices for Actor development and deployment

**Skool.com Technical Details:**
- Skool uses JavaScript-heavy SPA architecture requiring full browser rendering
- Authentication required for most community content (private groups)
- Infinite scroll pagination for posts and comments
- Dynamic content loading via AJAX requests
- Rate limiting protections requiring careful request timing

## OTHER CONSIDERATIONS:

**Critical Implementation Details:**
1. **Authentication Requirements**: User MUST be a member of the Skool communities they want to scrape. The Actor cannot bypass access restrictions.

2. **Cookie Management**: Implement robust cookie parsing and validation. Invalid or expired cookies should trigger clear error messages with instructions for renewal.

3. **Pagination Handling**: Skool uses infinite scroll. Implement proper scroll-to-load detection and wait for content loading before extraction.

4. **Rate Limiting**: Implement intelligent delays between requests. Skool has anti-bot protections, so requests should mimic human behavior.

5. **Comment Threading**: Comments can be deeply nested. Implement recursive comment extraction to capture full conversation threads.

6. **Dynamic Content**: Posts and comments load dynamically. Use proper wait conditions for content visibility before extraction.

7. **Proxy Configuration**: Include residential proxy support for reliability. Some content may be geo-restricted.

8. **Error Recovery**: Implement comprehensive error handling for network timeouts, authentication failures, and content loading issues.

9. **Memory Management**: Large communities can have thousands of posts. Implement efficient batching and memory cleanup.

10. **Data Validation**: Validate extracted data structure and handle missing fields gracefully.

**Common Pitfalls to Avoid:**
- Don't attempt to scrape without proper authentication
- Don't ignore JavaScript rendering time - wait for content to load
- Don't hardcode selectors - Skool may change DOM structure
- Don't skip request retry logic - network issues are common
- Don't forget to handle empty communities or private content
- Don't overwhelm the server with concurrent requests

**Performance Optimization:**
- Use efficient CSS selectors for data extraction
- Implement smart scrolling detection for pagination
- Cache user data across posts to avoid redundant extraction
- Use concurrent processing for multiple communities
- Implement early termination for large datasets

**Compliance Notes:**
- Respect Skool's Terms of Service
- Only scrape communities where user has legitimate access
- Implement reasonable rate limiting to avoid server overload
- Include user agent strings that identify the scraper appropriately