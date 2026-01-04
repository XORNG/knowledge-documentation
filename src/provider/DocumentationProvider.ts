import {
  BaseKnowledgeProvider,
  type KnowledgeQuery,
  type KnowledgeResult,
  type KnowledgeProviderConfig,
} from '@xorng/template-knowledge';
import { createToolHandler, type SubAgentMetadata, type SubAgentConfig } from '@xorng/template-base';
import { z } from 'zod';
import type { ProviderConfig, DocumentationQuery, SourceConfig } from '../types/index.js';
import { LocalDocumentationSource } from '../sources/LocalDocumentationSource.js';
import { GitDocumentationSource } from '../sources/GitDocumentationSource.js';
import { DocumentationChunker } from '../utils/chunker.js';

/**
 * Documentation Knowledge Provider
 * 
 * Provides documentation retrieval for coding tasks:
 * - Searches across multiple documentation sources
 * - Supports local files and git repositories
 * - Filters by category, language, framework
 * - Returns relevant code examples
 */
export class DocumentationProvider extends BaseKnowledgeProvider {
  private docConfig: ProviderConfig;
  private chunker: DocumentationChunker;

  constructor(
    config: ProviderConfig,
    metadata?: Partial<SubAgentMetadata>,
    subAgentConfig?: SubAgentConfig
  ) {
    const fullMetadata: SubAgentMetadata = {
      name: 'knowledge-documentation',
      version: '0.1.0',
      description: 'Documentation knowledge provider for coding assistance',
      capabilities: ['retrieve', 'search'],
      ...metadata,
    };

    const knowledgeConfig: KnowledgeProviderConfig = {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      maxResults: config.maxResults,
      minScore: config.minScore,
    };

    super(fullMetadata, subAgentConfig, knowledgeConfig);
    
    this.docConfig = config;
    this.chunker = new DocumentationChunker(config.chunkSize, config.chunkOverlap);

    // Register sources
    this.setupSources(config.sources);

    // Register documentation-specific tools
    this.registerDocumentationTools();
  }

  /**
   * Initialize sources from configuration
   */
  private setupSources(sources: SourceConfig[]): void {
    for (const sourceConfig of sources) {
      let source;
      
      switch (sourceConfig.type) {
        case 'local':
          source = new LocalDocumentationSource(sourceConfig);
          break;
        case 'git':
          source = new GitDocumentationSource(sourceConfig);
          break;
        default:
          this.logger.warn({ source: sourceConfig.name }, 'Unknown source type, skipping');
          continue;
      }

      this.registerSource(source);
    }
  }

  /**
   * Search documentation with filters
   */
  async searchDocumentation(query: DocumentationQuery): Promise<KnowledgeResult> {
    // Build filters from query
    const filters: KnowledgeQuery['filters'] = {};
    
    if (query.language) {
      filters.language = query.language;
    }
    if (query.tags) {
      filters.tags = query.tags;
    }

    // Perform base search
    const result = await this.search({
      query: query.query,
      filters,
      limit: query.limit || this.docConfig.maxResults,
    });

    // Additional filtering by category/framework
    if (query.category || query.framework) {
      result.chunks = result.chunks.filter(item => {
        const meta = item.chunk.metadata;
        if (query.category && meta.category !== query.category) {
          return false;
        }
        if (query.framework && meta.framework !== query.framework) {
          return false;
        }
        return true;
      });
      result.totalCount = result.chunks.length;
    }

    return result;
  }

  /**
   * Get documentation for a specific topic
   */
  async getTopicDocumentation(topic: string, options?: {
    category?: string;
    language?: string;
    includeExamples?: boolean;
  }): Promise<{
    overview: string;
    codeExamples: string[];
    relatedTopics: string[];
  }> {
    const query: DocumentationQuery = {
      query: topic,
      category: options?.category as any,
      language: options?.language,
      limit: 10,
    };

    const result = await this.searchDocumentation(query);

    // Compile overview from top results
    const overview = result.chunks
      .filter(c => c.chunk.metadata.chunkType !== 'code')
      .slice(0, 3)
private async processContent(c: string): Promise<void> {
}

    // Extract code examples
    const codeExamples = result.chunks
      .filter(c => c.chunk.metadata.chunkType === 'code')
      .slice(0, 5)
      .map(c => c.chunk.content);

    // Find related topics from metadata
    const relatedTopics = new Set<string>();
    for (const chunk of result.chunks) {
      const tags = chunk.chunk.metadata.tags as string[] || [];
      tags.forEach(tag => relatedTopics.add(tag));
    }

    return {
      overview,
      codeExamples: options?.includeExamples !== false ? codeExamples : [],
      relatedTopics: Array.from(relatedTopics).slice(0, 10),
    };
  }

  /**
   * Register documentation-specific MCP tools
   */
  private registerDocumentationTools(): void {
    // Search documentation tool
    this.registerTool(createToolHandler({
      name: 'search-docs',
      description: 'Search documentation with advanced filtering',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        category: z.enum([
          'api-reference', 'tutorial', 'guide', 'example',
          'concept', 'troubleshooting', 'changelog', 'readme'
        ]).optional().describe('Filter by documentation category'),
        language: z.string().optional().describe('Filter by programming language'),
        framework: z.string().optional().describe('Filter by framework'),
        limit: z.number().optional().describe('Maximum results'),
      }),
      handler: async (input) => {
        return this.searchDocumentation(input);
      },
    }));

    // Get topic documentation
    this.registerTool(createToolHandler({
      name: 'get-topic',
      description: 'Get comprehensive documentation for a topic',
      inputSchema: z.object({
        topic: z.string().describe('The topic to get documentation for'),
        category: z.string().optional(),
        language: z.string().optional(),
        includeExamples: z.boolean().optional().default(true),
      }),
      handler: async (input) => {
        return this.getTopicDocumentation(input.topic, {
          category: input.category,
          language: input.language,
          includeExamples: input.includeExamples,
        });
      },
    }));

    // Find code examples
    this.registerTool(createToolHandler({
      name: 'find-examples',
      description: 'Find code examples for a specific task or API',
      inputSchema: z.object({
        query: z.string().describe('What you need an example for'),
        language: z.string().optional().describe('Programming language'),
        limit: z.number().optional().default(5),
      }),
      handler: async (input) => {
        const result = await this.searchDocumentation({
          query: input.query,
          language: input.language,
          limit: input.limit || 5,
        });

        // Filter to just code chunks
        const codeChunks = result.chunks
          .filter(c => c.chunk.metadata.chunkType === 'code')
          .map(c => ({
            code: c.chunk.content,
            language: c.chunk.metadata.codeLanguage || 'unknown',
            source: c.chunk.metadata.source,
            score: c.score,
          }));

        return { examples: codeChunks };
      },
    }));

    // List available categories
    this.registerTool(createToolHandler({
      name: 'list-categories',
      description: 'List available documentation categories',
      inputSchema: z.object({}),
      handler: async () => {
        const categories = new Map<string, number>();
        const docs = this.store.all();

        for (const doc of docs) {
          const cat = doc.metadata.category as string || 'uncategorized';
          categories.set(cat, (categories.get(cat) || 0) + 1);
        }

        return {
          categories: Array.from(categories.entries()).map(([name, count]) => ({
            name,
            documentCount: count,
          })),
        };
      },
    }));
  }

  /**
   * Override indexDocument to use enhanced chunker
   */
  async indexDocument(document: import('@xorng/template-knowledge').Document): Promise<void> {
    // Store the document
    this.store.add(document);

    // Chunk with enhanced chunker
    const chunks = this.chunker.chunkDocument(
      document.id,
      document.content,
      document.metadata
    );

    // Index each chunk
    for (const chunk of chunks) {
      this.index.add(chunk);
    }

    this.logger.debug({
      documentId: document.id,
      chunkCount: chunks.length,
    }, 'Document indexed with enhanced chunking');
  }
}
