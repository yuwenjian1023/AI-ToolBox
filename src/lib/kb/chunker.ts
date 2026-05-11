const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;
const MIN_CHUNK_SIZE = 80;

/**
 * Smart chunker: splits by Markdown headings first, then by paragraphs
 * Keeps content under the same heading together as much as possible
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  // Step 1: Split by headings (##, ###, etc.) into sections
  const sections = splitByHeadings(normalized);

  // Step 2: For each section, if it's within chunk size keep it whole
  //         otherwise split by paragraphs
  const rawChunks: string[] = [];
  for (const section of sections) {
    if (section.length <= chunkSize) {
      rawChunks.push(section);
    } else {
      rawChunks.push(...splitByParagraphs(section, chunkSize));
    }
  }

  // Step 3: Merge tiny chunks with previous
  const merged: string[] = [];
  for (const chunk of rawChunks) {
    if (chunk.length < MIN_CHUNK_SIZE && merged.length > 0) {
      merged[merged.length - 1] += '\n\n' + chunk;
    } else {
      merged.push(chunk);
    }
  }

  // Step 4: Apply overlap — prepend context from previous chunk
  if (overlap <= 0 || merged.length <= 1) return merged;

  const result: string[] = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1];
    // Take the last `overlap` characters of the previous chunk as context
    const overlapText = prev.slice(-overlap);
    // Find a clean break point (start of a sentence or line)
    const cleanBreak = overlapText.indexOf('\n');
    const contextPrefix = cleanBreak >= 0 ? overlapText.slice(cleanBreak + 1) : overlapText;
    result.push(contextPrefix + '\n' + merged[i]);
  }

  return result;
}

/**
 * Split text by Markdown headings, keeping the heading with its content
 */
function splitByHeadings(text: string): string[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    // Detect heading: starts with # (but not inside code block)
    if (/^#{1,4}\s+/.test(line) && current.length > 0) {
      const sectionText = current.join('\n').trim();
      if (sectionText) sections.push(sectionText);
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    const sectionText = current.join('\n').trim();
    if (sectionText) sections.push(sectionText);
  }

  return sections;
}

/**
 * Split long text by paragraphs, then by sentences if needed
 */
function splitByParagraphs(text: string, chunkSize: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) chunks.push(current);

      if (para.length <= chunkSize) {
        current = para;
      } else {
        // Split long paragraph by sentences
        const sentences = para.split(/(?<=[。！？.!?\n])/);
        current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length <= chunkSize) {
            current += sentence;
          } else {
            if (current) chunks.push(current);
            if (sentence.length <= chunkSize) {
              current = sentence;
            } else {
              // Hard cut
              for (let i = 0; i < sentence.length; i += chunkSize) {
                chunks.push(sentence.slice(i, i + chunkSize));
              }
              current = '';
            }
          }
        }
      }
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/**
 * For CSV/tabular data: each row is a chunk
 */
export function chunkRows(rows: string[]): string[] {
  return rows.filter((r) => r.trim().length >= MIN_CHUNK_SIZE);
}
