# CLAUDE.md - Skool Scraper Project Rules

## PROJECT OVERVIEW
This project creates a professional-grade Apify Actor for scraping Skool.com posts and comments. The Actor must be production-ready, maintainable, and compliant with Apify platform standards.

## GLOBAL PROJECT RULES

### Project Structure and Organization
- Follow Apify Actor standard directory structure:
  ```
  skool-scraper/
  ├── src/
  │   ├── main.js              # Entry point
  │   ├── scraper.js           # Core scraping logic
  │   ├── utils/
  │   │   ├── auth.js          # Cookie authentication
  │   │   ├── pagination.js    # Scroll and pagination handling
  │   │   ├── parsers.js       # Data extraction and parsing
  │   │   └── validators.js    # Input and data validation
  │   └── config/
  │       └── selectors.js     # DOM selectors and constants
  ├── apify.json               # Actor metadata
  ├── INPUT_SCHEMA.json        # Input validation schema
  ├── README.md               # Actor documentation
  └── package.json            # Dependencies
  ```

### Code Quality Standards
- **File Size Limit**: No single file should exceed 300 lines. Split large files into focused modules.
- **Function Size**: Keep functions under 50 lines. Break complex logic into smaller, testable functions.
- **Naming**: Use descriptive names that explain intent:
  - `extractPostData()` not `getData()`
  - `handleInfiniteScroll()` not `scroll()`
  - `validateCookieFormat()` not `checkCookies()`

### Error Handling Requirements
- **Always** wrap external API calls in try-catch blocks
- **Always** validate input data before processing
- **Always** provide clear error messages with actionable instructions
- **Never** let the Actor crash silently - log all errors with context
- Implement graceful degradation when possible

Example error handling pattern:
```javascript
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    await Apify.utils.log.error(`Failed to perform operation: ${error.message}`, {
        operation: 'operationName',
        context: relevantContext,
        stack: error.stack
    });
    throw new Error(`User-friendly error message with recovery instructions`);
}
```

### Apify Platform Integration
- **Always** use Apify SDK methods for data storage (`Dataset.pushData()`)
- **Always** use Apify's logging system (`Apify.utils.log`)
- **Always** respect the Apify Actor lifecycle (initialization, processing, cleanup)
- **Always** implement proper input validation using INPUT_SCHEMA.json
- **Never** write to local filesystem - use Apify's key-value store instead

### Performance Requirements
- **Maximum concurrency**: Default to 10, allow user configuration up to 50
- **Request delays**: Implement 1-3 second delays between requests to mimic human behavior
- **Memory efficiency**: Process data in batches, don't load entire datasets into memory
- **Timeout handling**: Set reasonable timeouts (30s for page loads, 5s for API calls)

### Authentication and Security
- **Cookie Validation**: Verify cookie format and required fields before processing
- **Access Control**: Clearly communicate authentication requirements to users
- **Sensitive Data**: Never log cookie values or authentication tokens
- **Rate Limiting**: Implement intelligent backoff when rate limits are detected

### Data Structure Standards
- **Consistent Schema**: Always return data in the predefined schema format
- **Data Validation**: Validate extracted data before pushing to dataset
- **Null Handling**: Handle missing or null values gracefully with sensible defaults
- **Date Formatting**: Use ISO 8601 format for all timestamps

### Skool.com Specific Rules
- **DOM Selectors**: Store all CSS selectors in `config/selectors.js` for easy maintenance
- **Wait Conditions**: Always wait for dynamic content to load before extraction
- **Pagination**: Implement proper infinite scroll detection and handling
- **Comment Threading**: Recursively extract nested comments preserving thread structure
- **User Data**: Extract comprehensive user information but respect privacy

### Browser Automation Best Practices
- **Page Lifecycle**: Properly manage page creation, navigation, and cleanup
- **Resource Loading**: Block unnecessary resources (images, fonts) to improve performance
- **Network Conditions**: Handle network errors and timeouts gracefully
- **Memory Leaks**: Close pages and browser contexts properly to prevent memory leaks

### Input Validation Rules
- **Required Fields**: Validate all required input fields with clear error messages
- **URL Validation**: Ensure URLs are valid Skool.com community URLs
- **Cookie Format**: Validate cookie array structure and required fields
- **Numeric Limits**: Validate and enforce reasonable limits for maxItems, concurrency

### Logging and Debugging
- **Log Levels**: Use appropriate log levels (info, warning, error, debug)
- **Structured Logging**: Include relevant context in all log messages
- **Progress Tracking**: Log progress for long-running operations
- **Debug Mode**: Support verbose logging for troubleshooting

### Documentation Requirements
- **README.md**: Comprehensive setup and usage instructions
- **Code Comments**: Document complex logic and important decisions
- **API Documentation**: Clear input/output schema documentation
- **Examples**: Provide working examples for common use cases

### Testing and Quality Assurance
- **Input Validation**: Test with invalid inputs to ensure proper error handling
- **Edge Cases**: Test with empty communities, private content, network issues
- **Performance Testing**: Verify memory usage and processing times
- **Integration Testing**: Test full Actor workflow from input to output

### Deployment and Maintenance
- **Version Control**: Use semantic versioning for Actor releases
- **Backward Compatibility**: Maintain input schema compatibility when possible
- **Dependencies**: Keep dependencies up to date and secure
- **Monitoring**: Implement health checks and error reporting

## CRITICAL REMINDERS
1. **User Authentication**: The Actor CANNOT bypass Skool's access controls. Users must be members of communities they want to scrape.

2. **Rate Limiting**: Skool has anti-bot protections. Always implement delays and respect rate limits.

3. **Dynamic Content**: Skool is a JavaScript-heavy SPA. Always wait for content to load before extraction.

4. **Cookie Security**: Never log or expose cookie values in Actor output or logs.

5. **Error Recovery**: Implement robust error recovery with clear user guidance for common issues.

6. **Platform Compliance**: Follow all Apify platform guidelines and best practices for Actor development.

## DEVELOPMENT WORKFLOW
1. Start each session by reviewing the current Actor structure and INITIAL.md requirements
2. Implement features incrementally with proper testing at each step
3. Validate input/output schemas match the documented requirements
4. Test error handling paths and edge cases
5. Update documentation to reflect any changes or new features
6. Ensure all code follows the established patterns and conventions

Never assume missing context - always ask for clarification when requirements are unclear or conflicting.