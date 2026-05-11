export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Simple keyword matching score based on term overlap
 */
function keywordScore(query: string, content: string): number {
  const queryTerms = extractTerms(query);
  if (queryTerms.length === 0) return 0;

  const contentLower = content.toLowerCase();
  let matched = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) matched++;
  }
  return matched / queryTerms.length;
}

function extractTerms(text: string): string[] {
  // Extract meaningful terms: Chinese words (2+ chars) and English words (2+ chars)
  const terms: string[] = [];
  // Chinese terms
  const cnMatches = text.match(/[\u4e00-\u9fff]{2,}/g);
  if (cnMatches) terms.push(...cnMatches.map((t) => t.toLowerCase()));
  // English/technical terms
  const enMatches = text.match(/[a-zA-Z][a-zA-Z0-9_./-]{1,}/g);
  if (enMatches) terms.push(...enMatches.map((t) => t.toLowerCase()));
  return [...new Set(terms)];
}

import type { KBCategory } from '@/types/kb';

export interface ScoredChunk {
  id: string;
  docId: string;
  content: string;
  score: number;
  category: KBCategory;
  sourceUrl?: string;
}

/**
 * Hybrid search: 70% vector + 30% keyword, with intent-based category boost.
 * When intentCategory matches the chunk's doc category, score gets a 1.3x boost
 * so e.g. "如何集成" (intent=guide) preferentially surfaces guide docs over FAQs.
 */
export function findTopK(
  queryVec: number[],
  candidates: Array<{ id: string; docId: string; content: string; embedding: number[]; category: KBCategory; sourceUrl?: string }>,
  k = 5,
  query?: string,
  intentCategory?: KBCategory
): ScoredChunk[] {
  const scored: ScoredChunk[] = candidates.map((c) => {
    const vecScore = cosineSimilarity(queryVec, c.embedding);
    const kwScore = query ? keywordScore(query, c.content) : 0;
    const hybrid = query ? vecScore * 0.7 + kwScore * 0.3 : vecScore;
    const boost = intentCategory && c.category === intentCategory ? 1.3 : 1.0;
    return {
      id: c.id,
      docId: c.docId,
      content: c.content,
      score: hybrid * boost,
      category: c.category,
      sourceUrl: c.sourceUrl,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
