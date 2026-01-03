import { startKnowledgeProvider } from '@xorng/template-knowledge';
import { createLogger } from '@xorng/template-base';
import { DocumentationProvider } from './provider/DocumentationProvider.js';
import type { ProviderConfig } from './types/index.js';

const logger = createLogger('info', 'knowledge-documentation');

// Default configuration - can be overridden via environment or config file
const defaultConfig: ProviderConfig = {
  sources: [
    {
      name: 'local-docs',
      type: 'local',
      path: process.env.DOCS_PATH || './docs',
      patterns: ['**/*.md', '**/*.mdx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  ],
  chunkSize: 1000,
  chunkOverlap: 200,
  maxResults: 10,
  minScore: 0.3,
  syncOnStart: true,
};

// Load config from environment or use defaults
async function loadConfig(): Promise<ProviderConfig> {
  const configPath = process.env.XORNG_DOCS_CONFIG;
  
  if (configPath) {
    try {
      // Dynamic import for JSON/JS config (ES module compatible)
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      logger.info({ configPath }, 'Loaded configuration from file');
      return { ...defaultConfig, ...config };
    } catch (error) {
      logger.warn({ configPath, error }, 'Failed to load config, using defaults');
    }
  }

  // Check for additional sources from environment
  const additionalSources = process.env.XORNG_DOCS_SOURCES;
  if (additionalSources) {
    try {
      const sources = JSON.parse(additionalSources);
      return { ...defaultConfig, sources: [...defaultConfig.sources, ...sources] };
    } catch (error) {
      logger.warn('Failed to parse XORNG_DOCS_SOURCES');
    }
  }

  return defaultConfig;
}

// Main entry point
async function main(): Promise<void> {
  const config = await loadConfig();
  
  logger.info({
    sourceCount: config.sources.length,
    sources: config.sources.map(s => s.name),
  }, 'Starting documentation knowledge provider');

  const provider = new DocumentationProvider(config);
  
  await startKnowledgeProvider(provider);
}

main().catch((error) => {
  logger.error(error, 'Failed to start documentation provider');
  process.exit(1);
});

// Export for programmatic use
export { DocumentationProvider } from './provider/DocumentationProvider.js';
export { LocalDocumentationSource, GitDocumentationSource } from './sources/index.js';
export { DocumentationChunker } from './utils/chunker.js';
export * from './types/index.js';
