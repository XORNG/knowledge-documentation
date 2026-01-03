import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
  FileSource,
  type SourceContext,
  type SourceResult,
  type Document,
} from '@xorng/template-knowledge';
import type { SourceConfig, DocumentCategory, ParsedMarkdown, CodeBlock } from '../types/index.js';

/**
 * Source for loading local documentation files
 */
export class LocalDocumentationSource extends FileSource {
  private config: SourceConfig;
  private documentCache: Map<string, Document> = new Map();

  constructor(config: SourceConfig) {
    super(config.name, `Local documentation from ${config.path}`, config.path);
    this.config = config;
  }

  async connect(context: SourceContext): Promise<void> {
    // Verify path exists
    try {
      await fs.access(this.basePath);
      this.connected = true;
      context.logger.info({ path: this.basePath }, 'Connected to local documentation source');
    } catch {
      throw new Error(`Documentation path not found: ${this.basePath}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.documentCache.clear();
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    const documents: Document[] = [];
    
    // Find all matching files
    const files = await this.findFiles();
    context.logger.info({ fileCount: files.length }, 'Found documentation files');

    for (const file of files) {
      try {
        const doc = await this.loadDocument(file, context);
        if (doc) {
          documents.push(doc);
          this.documentCache.set(doc.id, doc);
        }
      } catch (error) {
        context.logger.warn({ file, error }, 'Failed to load document');
      }
    }

    return { documents };
  }

  async fetchDocument(id: string, context: SourceContext): Promise<Document | null> {
    // Check cache first
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id)!;
    }

    // Try to load by file path
    try {
      const doc = await this.loadDocument(id, context);
      if (doc) {
        this.documentCache.set(doc.id, doc);
      }
      return doc;
    } catch {
      return null;
    }
  }

  async getDocumentCount(): Promise<number> {
    const files = await this.findFiles();
    return files.length;
  }

  /**
   * Find all documentation files matching patterns
   */
  private async findFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.config.patterns) {
      const files = await glob(pattern, {
        cwd: this.basePath,
        absolute: true,
        ignore: this.config.excludePatterns,
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }

  /**
   * Load and parse a single document
   */
  private async loadDocument(filePath: string, context: SourceContext): Promise<Document | null> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.basePath, filePath);
    const fileName = path.basename(filePath, path.extname(filePath));

    // Parse frontmatter
    const parsed = this.parseMarkdown(content);
    
    // Determine document type
    const ext = path.extname(filePath).toLowerCase();
    const docType = ext === '.md' || ext === '.mdx' ? 'markdown' : 'text';

    // Extract metadata
    const category = this.determineCategory(relativePath, parsed.data);
    const language = this.determineLanguage(parsed.data);
    const title = this.extractTitle(parsed, fileName);

    // Extract code blocks for better searchability
    const codeBlocks = this.extractCodeBlocks(parsed.content);

    return {
      id: this.generateId(relativePath),
      type: docType,
      content: parsed.content,
      title,
      metadata: {
        source: this.name,
        path: relativePath,
        category,
        language,
        framework: parsed.data.framework as string || this.config.defaultFramework,
        tags: this.extractTags(parsed.data, codeBlocks),
        createdAt: new Date().toISOString(),
        ...this.flattenFrontmatter(parsed.data),
      },
    };
  }

  /**
   * Parse markdown with frontmatter
   */
  private parseMarkdown(content: string): ParsedMarkdown {
    const { content: body, data, excerpt } = matter(content, { excerpt: true });
    return { content: body, data, excerpt };
  }

  /**
   * Determine document category from path or frontmatter
   */
  private determineCategory(
    relativePath: string,
    frontmatter: Record<string, unknown>
  ): DocumentCategory | undefined {
    // Check frontmatter first
    if (frontmatter.category) {
      return frontmatter.category as DocumentCategory;
    }

    // Infer from path
    const pathLower = relativePath.toLowerCase();
    
    if (pathLower.includes('api') || pathLower.includes('reference')) {
      return 'api-reference';
    }
    if (pathLower.includes('tutorial')) {
      return 'tutorial';
    }
    if (pathLower.includes('guide') || pathLower.includes('how-to')) {
      return 'guide';
    }
    if (pathLower.includes('example')) {
      return 'example';
    }
    if (pathLower.includes('concept') || pathLower.includes('explanation')) {
      return 'concept';
    }
    if (pathLower.includes('troubleshoot') || pathLower.includes('faq')) {
      return 'troubleshooting';
    }
    if (pathLower.includes('changelog') || pathLower.includes('release')) {
      return 'changelog';
    }
    if (pathLower.includes('readme')) {
      return 'readme';
    }

    return this.config.defaultCategory;
  }

  /**
   * Determine programming language
   */
  private determineLanguage(frontmatter: Record<string, unknown>): string | undefined {
    if (frontmatter.language) {
      return frontmatter.language as string;
    }
    return this.config.defaultLanguage;
  }

  /**
   * Extract title from parsed markdown
   */
  private extractTitle(parsed: ParsedMarkdown, fileName: string): string {
    // Check frontmatter
    if (parsed.data.title) {
      return parsed.data.title as string;
    }

    // Look for first H1 in content
    const h1Match = parsed.content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    // Fall back to file name
    return fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Extract code blocks from markdown
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    const lines = content.split('\n');
    
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const startLine = beforeMatch.split('\n').length;
      const codeLines = match[2].split('\n').length;

      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        startLine,
        endLine: startLine + codeLines,
      });
    }

    return blocks;
  }

  /**
   * Extract tags from frontmatter and code blocks
   */
  private extractTags(
    frontmatter: Record<string, unknown>,
    codeBlocks: CodeBlock[]
  ): string[] {
    const tags = new Set<string>();

    // Add frontmatter tags
    if (Array.isArray(frontmatter.tags)) {
      frontmatter.tags.forEach(tag => tags.add(String(tag).toLowerCase()));
    }

    // Add keywords
    if (Array.isArray(frontmatter.keywords)) {
      frontmatter.keywords.forEach(kw => tags.add(String(kw).toLowerCase()));
    }

    // Add languages from code blocks
    for (const block of codeBlocks) {
      if (block.language && block.language !== 'text') {
        tags.add(block.language.toLowerCase());
      }
    }

    return Array.from(tags);
  }

  /**
   * Flatten frontmatter for metadata
   */
  private flattenFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flat[key] = value;
      } else if (value instanceof Date) {
        flat[key] = value.toISOString();
      }
    }

    return flat;
  }

  /**
   * Generate a stable ID from the file path
   */
  protected generateId(relativePath: string): string {
    return `${this.name}:${relativePath.replace(/\\/g, '/')}`;
  }
}
