/**
 * Advanced filtering and search capabilities for Skool posts
 */

import { Actor } from 'apify';

/**
 * Smart filtering engine for posts
 */
export class SmartFilterEngine {
    constructor(posts) {
        this.posts = posts;
    }

    /**
     * Apply all enabled filters to posts
     */
    applyFilters(searchFilters) {
        let filteredPosts = [...this.posts];
        let filtersApplied = [];

        // Apply date range filter
        if (searchFilters.dateRange?.enabled) {
            filteredPosts = this.filterByDateRange(
                filteredPosts,
                searchFilters.dateRange.startDate,
                searchFilters.dateRange.endDate
            );
            filtersApplied.push('dateRange');
        }

        // Apply engagement filter
        if (searchFilters.engagement?.enabled) {
            filteredPosts = this.filterByEngagement(filteredPosts, searchFilters.engagement);
            filtersApplied.push('engagement');
        }

        // Apply content filter
        if (searchFilters.content?.enabled) {
            filteredPosts = this.filterByContent(filteredPosts, searchFilters.content);
            filtersApplied.push('content');
        }

        // Apply author filter
        if (searchFilters.authors?.enabled) {
            filteredPosts = this.filterByAuthor(filteredPosts, searchFilters.authors);
            filtersApplied.push('authors');
        }

        // Apply sorting
        if (searchFilters.sorting) {
            filteredPosts = this.sortPosts(filteredPosts, searchFilters.sorting);
            filtersApplied.push('sorting');
        }

        console.log(`Filters applied: ${filtersApplied.join(', ')}`);
        console.log(`Results: ${this.posts.length} → ${filteredPosts.length} posts`);

        return filteredPosts;
    }

    /**
     * Filter posts by date range
     */
    filterByDateRange(posts, startDate, endDate) {
        if (!startDate && !endDate) return posts;

        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Date.now();

        return posts.filter(post => {
            const postDate = new Date(post.createdAt).getTime();
            return postDate >= start && postDate <= end;
        });
    }

    /**
     * Filter posts by engagement metrics
     */
    filterByEngagement(posts, criteria) {
        return posts.filter(post => {
            const likes = post.likes || 0;
            const comments = post.comments || 0;
            const engagementRate = likes > 0 ? (likes + comments) / likes : 0;

            // Check minimum likes
            if (criteria.minLikes && likes < criteria.minLikes) {
                return false;
            }

            // Check maximum likes
            if (criteria.maxLikes && likes > criteria.maxLikes) {
                return false;
            }

            // Check minimum comments
            if (criteria.minComments && comments < criteria.minComments) {
                return false;
            }

            // Check engagement rate
            if (criteria.minEngagementRate && engagementRate < criteria.minEngagementRate) {
                return false;
            }

            return true;
        });
    }

    /**
     * Filter posts by content
     */
    filterByContent(posts, criteria) {
        return posts.filter(post => {
            const content = ((post.title || '') + ' ' + (post.content || '')).toLowerCase();

            // Check required keywords
            if (criteria.keywords && criteria.keywords.length > 0) {
                const hasKeywords = criteria.keywords.some(keyword => 
                    content.includes(keyword.toLowerCase())
                );
                if (!hasKeywords) return false;
            }

            // Check excluded keywords
            if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
                const hasExcluded = criteria.excludeKeywords.some(keyword => 
                    content.includes(keyword.toLowerCase())
                );
                if (hasExcluded) return false;
            }

            // Check minimum length
            if (criteria.minLength && content.length < criteria.minLength) {
                return false;
            }

            // Check media presence
            if (criteria.hasMedia && !post.media?.imagePreview) {
                return false;
            }

            return true;
        });
    }

    /**
     * Filter posts by author
     */
    filterByAuthor(posts, criteria) {
        return posts.filter(post => {
            const authorName = (post.author?.name || '').toLowerCase();
            const authorId = post.author?.id || '';

            // Check included authors
            if (criteria.includeAuthors && criteria.includeAuthors.length > 0) {
                const isIncluded = criteria.includeAuthors.some(author => 
                    authorName.includes(author.toLowerCase()) || authorId === author
                );
                if (!isIncluded) return false;
            }

            // Check excluded authors
            if (criteria.excludeAuthors && criteria.excludeAuthors.length > 0) {
                const isExcluded = criteria.excludeAuthors.some(author => 
                    authorName.includes(author.toLowerCase()) || authorId === author
                );
                if (isExcluded) return false;
            }

            return true;
        });
    }

    /**
     * Sort posts based on criteria
     */
    sortPosts(posts, criteria) {
        return posts.sort((a, b) => {
            let comparison = 0;

            switch (criteria.sortBy) {
                case 'date':
                    comparison = new Date(b.createdAt) - new Date(a.createdAt);
                    break;
                case 'likes':
                    comparison = (b.likes || 0) - (a.likes || 0);
                    break;
                case 'comments':
                    comparison = (b.comments || 0) - (a.comments || 0);
                    break;
                case 'engagement':
                    const aEng = (a.likes || 0) + (a.comments || 0);
                    const bEng = (b.likes || 0) + (b.comments || 0);
                    comparison = bEng - aEng;
                    break;
                case 'alphabetical':
                    comparison = (a.title || '').localeCompare(b.title || '');
                    break;
                default:
                    comparison = new Date(b.createdAt) - new Date(a.createdAt);
            }

            return criteria.sortOrder === 'asc' ? -comparison : comparison;
        });
    }
}

/**
 * Search presets for common filtering scenarios
 */
export class SearchPresets {
    static getPresetConfig(presetName) {
        const presets = {
            'high-engagement': {
                engagement: {
                    enabled: true,
                    minLikes: 50,
                    minComments: 10
                },
                sorting: {
                    sortBy: 'engagement',
                    sortOrder: 'desc'
                }
            },
            'recent-posts': {
                dateRange: {
                    enabled: true,
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                },
                sorting: {
                    sortBy: 'date',
                    sortOrder: 'desc'
                }
            },
            'popular-discussions': {
                engagement: {
                    enabled: true,
                    minLikes: 25,
                    minComments: 5
                },
                sorting: {
                    sortBy: 'comments',
                    sortOrder: 'desc'
                }
            },
            'trending-content': {
                dateRange: {
                    enabled: true,
                    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                },
                engagement: {
                    enabled: true,
                    minLikes: 20,
                    minComments: 3
                },
                sorting: {
                    sortBy: 'engagement',
                    sortOrder: 'desc'
                }
            }
        };

        return presets[presetName] || {};
    }
}

/**
 * Filter analytics and reporting
 */
export class FilterAnalytics {
    static generateFilterReport(originalPosts, filteredPosts, appliedFilters) {
        const report = {
            summary: {
                originalCount: originalPosts.length,
                filteredCount: filteredPosts.length,
                filterEfficiency: filteredPosts.length / originalPosts.length,
                filtersApplied: Object.keys(appliedFilters).filter(key => 
                    appliedFilters[key] && appliedFilters[key].enabled
                )
            },
            metrics: {
                averageLikes: this.calculateAverage(filteredPosts, 'likes'),
                averageComments: this.calculateAverage(filteredPosts, 'comments'),
                totalEngagement: filteredPosts.reduce((sum, post) => 
                    sum + (post.likes || 0) + (post.comments || 0), 0
                ),
                dateRange: this.getDateRange(filteredPosts),
                topAuthors: this.getTopAuthors(filteredPosts, 5)
            },
            distribution: {
                byEngagement: this.categorizeByEngagement(filteredPosts),
                byDate: this.categorizeByDate(filteredPosts),
                byContentLength: this.categorizeByContentLength(filteredPosts)
            }
        };

        return report;
    }

    static calculateAverage(posts, field) {
        if (posts.length === 0) return 0;
        const sum = posts.reduce((acc, post) => acc + (post[field] || 0), 0);
        return Math.round(sum / posts.length * 100) / 100;
    }

    static getDateRange(posts) {
        if (posts.length === 0) return { start: null, end: null };
        
        const dates = posts
            .map(post => new Date(post.createdAt))
            .filter(date => !isNaN(date));
        
        if (dates.length === 0) return { start: null, end: null };
        
        return {
            start: new Date(Math.min(...dates)).toISOString().split('T')[0],
            end: new Date(Math.max(...dates)).toISOString().split('T')[0]
        };
    }

    static getTopAuthors(posts, limit = 5) {
        const authorCounts = {};
        
        posts.forEach(post => {
            const authorName = post.author?.name || 'Unknown';
            authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
        });

        return Object.entries(authorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([name, count]) => ({ name, posts: count }));
    }

    static categorizeByEngagement(posts) {
        const categories = {
            high: posts.filter(p => (p.likes || 0) >= 50).length,
            medium: posts.filter(p => (p.likes || 0) >= 10 && (p.likes || 0) < 50).length,
            low: posts.filter(p => (p.likes || 0) < 10).length
        };
        return categories;
    }

    static categorizeByDate(posts) {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        
        return {
            today: posts.filter(p => new Date(p.createdAt) > now - day).length,
            thisWeek: posts.filter(p => new Date(p.createdAt) > now - 7 * day).length,
            thisMonth: posts.filter(p => new Date(p.createdAt) > now - 30 * day).length,
            older: posts.filter(p => new Date(p.createdAt) <= now - 30 * day).length
        };
    }

    static categorizeByContentLength(posts) {
        return {
            short: posts.filter(p => (p.content || '').length < 100).length,
            medium: posts.filter(p => (p.content || '').length >= 100 && (p.content || '').length < 500).length,
            long: posts.filter(p => (p.content || '').length >= 500).length
        };
    }
}

/**
 * Main filter processor
 */
export function processAdvancedFilters(posts, input) {
    let searchFilters = input.searchFilters || {};
    
    // Apply preset if selected
    if (input.searchPresets && input.searchPresets !== 'none') {
        const presetConfig = SearchPresets.getPresetConfig(input.searchPresets);
        searchFilters = { ...searchFilters, ...presetConfig };
        console.log(`Applied preset: ${input.searchPresets}`);
    }

    // Skip filtering if no filters are enabled
    const hasEnabledFilters = Object.values(searchFilters).some(filter => 
        filter && filter.enabled === true
    );
    
    if (!hasEnabledFilters && !searchFilters.sorting) {
        console.log('No search filters enabled, returning all posts');
        return {
            posts: posts,
            analytics: FilterAnalytics.generateFilterReport(posts, posts, {})
        };
    }

    // Apply filters
    const filterEngine = new SmartFilterEngine(posts);
    const filteredPosts = filterEngine.applyFilters(searchFilters);

    // Generate analytics
    const analytics = FilterAnalytics.generateFilterReport(posts, filteredPosts, searchFilters);
    
    // Log analytics
    console.log('=== FILTER ANALYTICS ===');
    console.log(`Original posts: ${analytics.summary.originalCount}`);
    console.log(`Filtered posts: ${analytics.summary.filteredCount}`);
    console.log(`Filter efficiency: ${Math.round(analytics.summary.filterEfficiency * 100)}%`);
    console.log(`Filters applied: ${analytics.summary.filtersApplied.join(', ')}`);
    console.log('========================');

    return {
        posts: filteredPosts,
        analytics: analytics
    };
}