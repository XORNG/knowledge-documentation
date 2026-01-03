import { z } from 'zod';

/**
 * Document category for organizing documentation
 */
export type DocumentCategory =
  | 'api-reference'
  | 'tutorial'
  | 'guide'
  | 'example'
  | 'concept'
  | 'troubleshooting'
  | 'changelog'
  | 'readme';

/**
 * Supported programming languages
 */
export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'other';

/**
 * Documentation metadata schema
 */
export const DocumentationMetadataSchema = z.object({
  title: z.string(),
  category: z.enum([
    'api-reference',
    'tutorial',
    'guide',
    'example',
    'concept',
    'troubleshooting',
    'changelog',
    'readme',
  ]).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lastUpdated: z.string().optional(),
  author: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export type DocumentationMetadata = z.infer<typeof DocumentationMetadataSchema>;

/**
 * Source configuration for documentation
 */
export const SourceConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['local', 'git', 'url']),
  path: z.string(),
  patterns: z.array(z.string()).default(['**/*.md', '**/*.mdx']),
  excludePatterns: z.array(z.string()).optional(),
  defaultCategory: z.enum([
    'api-reference',
    'tutorial',
    'guide',
    'example',
    'concept',
    'troubleshooting',
    'changelog',
    'readme',
  ]).optional(),
  defaultLanguage: z.string().optional(),
  defaultFramework: z.string().optional(),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;

/**
 * Provider configuration
 */
export const ProviderConfigSchema = z.object({
  sources: z.array(SourceConfigSchema),
  chunkSize: z.number().default(1000),
  chunkOverlap: z.number().default(200),
  maxResults: z.number().default(10),
  minScore: z.number().default(0.3),
  syncOnStart: z.boolean().default(true),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Query for searching documentation
 */
export const DocumentationQuerySchema = z.object({
  query: z.string(),
  category: z.enum([
    'api-reference',
    'tutorial',
    'guide',
    'example',
    'concept',
    'troubleshooting',
    'changelog',
    'readme',
  ]).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export type DocumentationQuery = z.infer<typeof DocumentationQuerySchema>;

/**
 * Parsed frontmatter from markdown
 */
export interface ParsedMarkdown {
  content: string;
  data: Record<string, unknown>;
  excerpt?: string;
}

/**
 * Code block extracted from documentation
 */
export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
  endLine: number;
}
