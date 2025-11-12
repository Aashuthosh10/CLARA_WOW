// Location Matching Service using NLP techniques
import { ALL_LOCATIONS, Location } from './locationsDatabase';

export interface LocationMatchResult {
  intent: 'navigate' | 'info' | 'unknown';
  location: Location | null;
  confidence: number;
}

class LocationMatcher {
  private allLocations: Location[] = [];

  constructor() {
    this.allLocations = [...ALL_LOCATIONS];
  }

  private similarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  matchLocation(query: string): Location | null {
    const queryLower = query.toLowerCase().trim();

    // Strategy 1: Exact keyword match
    for (const location of this.allLocations) {
      for (const keyword of location.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          return location;
        }
      }
    }

    // Strategy 2: Room number match
    const roomPattern = /\b(?:room|lh|cabin|lab)[\s-]*(\d+[a-z]?)\b/i;
    const roomMatch = query.match(roomPattern);
    if (roomMatch) {
      const roomNum = roomMatch[1];
      for (const location of this.allLocations) {
        if (location.room_number && 
            location.room_number.toLowerCase().includes(roomNum.toLowerCase())) {
          return location;
        }
      }
    }

    // Strategy 3: Fuzzy matching
    let bestMatch: Location | null = null;
    let bestScore = 0.0;

    for (const location of this.allLocations) {
      // Check similarity with name
      const nameScore = this.similarity(queryLower, location.name.toLowerCase());

      // Check similarity with keywords
      const keywordScores = location.keywords.map(keyword =>
        this.similarity(queryLower, keyword.toLowerCase())
      );
      const maxKeywordScore = Math.max(...keywordScores, 0);

      // Use the highest score
      const score = Math.max(nameScore, maxKeywordScore);

      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = location;
      }
    }

    return bestMatch;
  }

  extractLocationIntent(query: string): LocationMatchResult {
    const queryLower = query.toLowerCase();

    // Intent patterns
    const navigatePatterns = [
      /\b(where|show|find|locate|take me|go to|how to reach|direction to|way to)\b/i,
      /\b(कहाँ|दिखाओ|ले जाओ)\b/,  // Hindi
      /\b(ಎಲ್ಲಿ|ತೋರಿಸು)\b/  // Kannada
    ];

    const infoPatterns = [
      /\b(what is|tell me about|info about|information on)\b/i
    ];

    let intent: 'navigate' | 'info' | 'unknown' = 'unknown';
    
    for (const pattern of navigatePatterns) {
      if (pattern.test(queryLower)) {
        intent = 'navigate';
        break;
      }
    }

    if (intent === 'unknown') {
      for (const pattern of infoPatterns) {
        if (pattern.test(queryLower)) {
          intent = 'info';
          break;
        }
      }
    }

    // If no explicit intent but location found, assume navigate
    const location = this.matchLocation(query);
    if (location && intent === 'unknown') {
      intent = 'navigate';
    }

    const confidence = location && intent !== 'unknown' ? 0.9 : location ? 0.5 : 0.0;

    return {
      intent,
      location,
      confidence
    };
  }
}

export default LocationMatcher;
