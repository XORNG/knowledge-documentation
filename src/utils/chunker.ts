import type { DocumentChunk, DocumentMetadata } from '@xorng/template-knowledge';

/**
 * Enhanced chunking utilities for documentation
 * 
 * Implements content-aware chunking strategies from best practices:
 * - Recursive character splitting with semantic boundaries
 * - Markdown-aware splitting (headers, code blocks, paragraphs)
 * - Code block preservation
 * - Overlap for context continuity
 */
export class DocumentationChunker {
  private chunkSize: number;
  private chunkOverlap: number;
  
  // Separators in order of priority (most semantic to least)
  private separators = [
    '\n## ',      // H2 headers
    '\n### ',     // H3 headers
    '\n#### ',    // H4 headers
    '\n```',      // Code blocks
    '\n\n',       // Paragraphs
    '\n',         // Lines
    '. ',         // Sentences
    ' ',          // Words
  ];

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * Chunk a document using recursive character splitting
   */
  chunkDocument(
    documentId: string,
    content: string,
    metadata: DocumentMetadata
  ): DocumentChunk[] {
    // First, extract and handle code blocks specially
    const { textParts, codeBlocks } = this.extractCodeBlocks(content);
    
    const chunks: DocumentChunk[] = [];
    let offset = 0;

    // Process text parts
    for (const part of textParts) {
      const partChunks = this.recursiveSplit(part.text, 0);
      
      for (let i = 0; i < partChunks.length; i++) {
        chunks.push({
          id: `${documentId}-chunk-${chunks.length}`,
          documentId,
          content: partChunks[i],
          startOffset: part.startOffset + offset,
          endOffset: part.startOffset + offset + partChunks[i].length,
          metadata: {
            ...metadata,
            chunkType: 'text',
            chunkIndex: chunks.length,
          },
        });
        offset += partChunks[i].length;
      }
    }

    // Add code blocks as separate chunks (preserve whole blocks when possible)
    for (const block of codeBlocks) {
      // If code block is too large, split it
      if (block.code.length > this.chunkSize * 2) {
        const codeChunks = this.splitCodeBlock(block.code);
        for (const codeChunk of codeChunks) {
          chunks.push({
            id: `${documentId}-code-${chunks.length}`,
            documentId,
            content: `\`\`\`${block.language}\n${codeChunk}\n\`\`\``,
            startOffset: block.startOffset,
            endOffset: block.endOffset,
            metadata: {
              ...metadata,
              chunkType: 'code',
              codeLanguage: block.language,
              chunkIndex: chunks.length,
            },
          });
        }
      } else {
        // Keep code block whole
        chunks.push({
          id: `${documentId}-code-${chunks.length}`,
          documentId,
          content: `\`\`\`${block.language}\n${block.code}\n\`\`\``,
          startOffset: block.startOffset,
          endOffset: block.endOffset,
          metadata: {
            ...metadata,
            chunkType: 'code',
            codeLanguage: block.language,
            chunkIndex: chunks.length,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Recursively split text using separators
   */
  private recursiveSplit(text: string, separatorIndex: number): string[] {
    if (text.length <= this.chunkSize) {
      return text.trim() ? [text.trim()] : [];
    }

    if (separatorIndex >= this.separators.length) {
      // Last resort: hard split
      return this.hardSplit(text);
    }

    const separator = this.separators[separatorIndex];
    const parts = text.split(separator);

    if (parts.length === 1) {
      // Separator not found, try next
      return this.recursiveSplit(text, separatorIndex + 1);
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const withSeparator = i > 0 ? separator + part : part;

      if ((currentChunk + withSeparator).length <= this.chunkSize) {
        currentChunk += withSeparator;
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // Check if this part itself needs splitting
        if (withSeparator.length > this.chunkSize) {
          const subChunks = this.recursiveSplit(withSeparator, separatorIndex + 1);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          // Add overlap from previous chunk
          const overlap = this.getOverlap(currentChunk);
          currentChunk = overlap + withSeparator;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Hard split when no separators work
   */
  private hardSplit(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + this.chunkSize, text.length);
      
      // Try to break at a word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - this.chunkOverlap;
      if (start < 0) start = end;
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlap(text: string): string {
    if (text.length <= this.chunkOverlap) {
      return text;
    }
    
    // Try to start overlap at a word boundary
    const overlapStart = text.length - this.chunkOverlap;
    const firstSpace = text.indexOf(' ', overlapStart);
    
    if (firstSpace > overlapStart && firstSpace < text.length) {
      return text.slice(firstSpace + 1);
    }
    
    return text.slice(overlapStart);
  }

  /**
   * Extract code blocks from content
   */
  private extractCodeBlocks(content: string): {
    textParts: Array<{ text: string; startOffset: number }>;
    codeBlocks: Array<{ language: string; code: string; startOffset: number; endOffset: number }>;
  } {
    const textParts: Array<{ text: string; startOffset: number }> = [];
    const codeBlocks: Array<{ language: string; code: string; startOffset: number; endOffset: number }> = [];
    
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        textParts.push({
          text: content.slice(lastIndex, match.index),
          startOffset: lastIndex,
        });
      }

      // Code block
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        startOffset: match.index,
        endOffset: regex.lastIndex,
      });

      lastIndex = regex.lastIndex;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      textParts.push({
        text: content.slice(lastIndex),
        startOffset: lastIndex,
      });
    }

    return { textParts, codeBlocks };
  }

  /**
   * Split a large code block
   */
  private splitCodeBlock(code: string): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const line of lines) {
      if (currentLength + line.length + 1 > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        // Keep some overlap
        const overlapLines = currentChunk.slice(-3);
        currentChunk = overlapLines;
        currentLength = overlapLines.join('\n').length;
      }

      currentChunk.push(line);
      currentLength += line.length + 1;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}
