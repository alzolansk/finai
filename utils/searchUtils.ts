/**
 * Utility functions for advanced search and filtering
 */

/**
 * Normalizes text by removing accents and converting to lowercase
 */
export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Calculates Levenshtein distance between two strings
 * Used for fuzzy matching
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
};

/**
 * Calculates similarity score between two strings (0-1)
 * 1 = identical, 0 = completely different
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);

  if (normalized1 === normalized2) return 1;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
};

/**
 * Performs fuzzy search on a string
 * Returns true if query matches target with a minimum similarity threshold
 */
export const fuzzyMatch = (
  target: string,
  query: string,
  threshold: number = 0.6
): boolean => {
  const normalizedTarget = normalizeText(target);
  const normalizedQuery = normalizeText(query);

  // Exact match
  if (normalizedTarget.includes(normalizedQuery)) return true;

  // Word-by-word matching
  const targetWords = normalizedTarget.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);

  for (const queryWord of queryWords) {
    let found = false;
    for (const targetWord of targetWords) {
      const similarity = calculateSimilarity(targetWord, queryWord);
      if (similarity >= threshold) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
};

/**
 * Finds similar strings in a list
 * Useful for detecting duplicates
 */
export const findSimilarStrings = (
  target: string,
  candidates: string[],
  threshold: number = 0.75
): Array<{ text: string; similarity: number }> => {
  return candidates
    .map((candidate) => ({
      text: candidate,
      similarity: calculateSimilarity(target, candidate),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
};

/**
 * Highlights matching parts of a string
 * Returns array of text segments with match flags
 */
export const highlightMatches = (
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> => {
  if (!query) return [{ text, isMatch: false }];

  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const result: Array<{ text: string; isMatch: boolean }> = [];

  let lastIndex = 0;
  let index = normalizedText.indexOf(normalizedQuery);

  while (index !== -1) {
    if (index > lastIndex) {
      result.push({
        text: text.substring(lastIndex, index),
        isMatch: false,
      });
    }

    result.push({
      text: text.substring(index, index + query.length),
      isMatch: true,
    });

    lastIndex = index + query.length;
    index = normalizedText.indexOf(normalizedQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    result.push({
      text: text.substring(lastIndex),
      isMatch: false,
    });
  }

  return result;
};
