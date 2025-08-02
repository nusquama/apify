# 🔍 Search Filter Examples

## Quick Search Presets

### High Engagement Posts
```json
{
  "searchPresets": "high-engagement"
}
```
*Automatically filters for posts with 50+ likes and 10+ comments*

### Recent Posts (Last 30 Days)
```json
{
  "searchPresets": "recent-posts"
}
```

### Popular Discussions
```json
{
  "searchPresets": "popular-discussions"
}
```
*Posts with 25+ likes and 5+ comments*

### Trending Content
```json
{
  "searchPresets": "trending-content"  
}
```
*Recent posts (7 days) with high engagement*

## Advanced Custom Filters

### Date Range Filtering
```json
{
  "searchFilters": {
    "dateRange": {
      "enabled": true,
      "startDate": "2024-07-01",
      "endDate": "2024-07-31"
    }
  }
}
```

### Engagement-Based Filtering
```json
{
  "searchFilters": {
    "engagement": {
      "enabled": true,
      "minLikes": 10,
      "maxLikes": 500,
      "minComments": 2,
      "minEngagementRate": 0.15
    }
  }
}
```

### Keyword Content Filtering
```json
{
  "searchFilters": {
    "content": {
      "enabled": true,
      "keywords": ["AI", "machine learning", "automation"],
      "excludeKeywords": ["spam", "promotional", "affiliate"],
      "minLength": 200,
      "hasMedia": true
    }
  }
}
```

### Author-Based Filtering
```json
{
  "searchFilters": {
    "authors": {
      "enabled": true,
      "includeAuthors": ["expert-user", "community-manager"],
      "excludeAuthors": ["spam-account", "inactive-user"]
    }
  }
}
```

## Combined Filters

### High-Value Content Analysis
```json
{
  "searchFilters": {
    "dateRange": {
      "enabled": true,
      "startDate": "2024-06-01",
      "endDate": "2024-12-31"
    },
    "engagement": {
      "enabled": true,
      "minLikes": 25,
      "minComments": 8,
      "minEngagementRate": 0.2
    },
    "content": {
      "enabled": true,
      "keywords": ["strategy", "growth", "success"],
      "minLength": 300
    },
    "sorting": {
      "sortBy": "engagement",
      "sortOrder": "desc"
    }
  }
}
```

### Content Research Setup
```json
{
  "searchFilters": {
    "engagement": {
      "enabled": true,
      "minLikes": 5,
      "minComments": 2
    },
    "content": {
      "enabled": true,
      "keywords": ["tutorial", "guide", "how-to"],
      "excludeKeywords": ["spam", "self-promotion"],
      "minLength": 150
    },
    "sorting": {
      "sortBy": "comments",
      "sortOrder": "desc"
    }
  }
}
```

### Community Health Analysis
```json
{
  "searchFilters": {
    "dateRange": {
      "enabled": true,
      "startDate": "2024-07-01",
      "endDate": "2024-07-31"
    },
    "engagement": {
      "enabled": true,
      "minLikes": 1,
      "minComments": 0
    },
    "sorting": {
      "sortBy": "date",
      "sortOrder": "asc"
    }
  }
}
```

## Sorting Options

- `"date"` - Sort by publication date
- `"likes"` - Sort by number of likes  
- `"comments"` - Sort by number of comments
- `"engagement"` - Sort by total engagement (likes + comments)
- `"alphabetical"` - Sort by post title

## Tips

1. **Start Simple**: Use presets first, then customize with advanced filters
2. **Test Filters**: Try with a small `maxItems` first to verify results  
3. **Combine Wisely**: Too many restrictive filters may return no results
4. **Monitor Analytics**: Check filter efficiency in the logs
5. **Date Formats**: Always use YYYY-MM-DD format for dates