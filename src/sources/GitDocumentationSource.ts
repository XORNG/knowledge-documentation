import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  BaseSource,
  type SourceContext,
  type SourceResult,
  type Document,
} from '@xorng/template-knowledge';
import type { SourceConfig } from '../types/index.js';
import { LocalDocumentationSource } from './LocalDocumentationSource.js';

const execAsync = promisify(exec);

/**
 * Source for loading documentation from Git repositories
 */
export class GitDocumentationSource extends BaseSource {
  private config: SourceConfig;
  private localSource: LocalDocumentationSource | null = null;
  private localPath: string;

  constructor(config: SourceConfig, cacheDir: string = '.xorng-docs-cache') {
    super(config.name, `Git documentation from ${config.path}`);
    this.config = config;
    
    // Create a safe directory name from the repo URL
    const safeName = config.path
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9-]/g, '_');
    
    this.localPath = path.join(cacheDir, safeName);
  }

  async connect(context: SourceContext): Promise<void> {
    context.logger.info({ repo: this.config.path }, 'Cloning/updating git repository');

    try {
      // Check if already cloned
      const exists = await this.pathExists(this.localPath);

      if (exists) {
        // Pull latest changes
        await this.gitPull(context);
      } else {
        // Clone the repository
        await this.gitClone(context);
      }

      // Create local source pointing to cloned repo
      const localConfig: SourceConfig = {
        ...this.config,
        type: 'local',
        path: this.localPath,
      };
      
      this.localSource = new LocalDocumentationSource(localConfig);
      await this.localSource.connect(context);
      
      this.connected = true;
      context.logger.info({ path: this.localPath }, 'Git source connected');
    } catch (error) {
      context.logger.error({ error }, 'Failed to connect git source');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.localSource) {
      await this.localSource.disconnect();
      this.localSource = null;
    }
    this.connected = false;
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    if (!this.localSource) {
      throw new Error('Git source not connected');
    }
    return this.localSource.fetchDocuments(context);
  }

  async fetchDocument(id: string, context: SourceContext): Promise<Document | null> {
    if (!this.localSource) {
      throw new Error('Git source not connected');
    }
    return this.localSource.fetchDocument(id, context);
  }

  async getDocumentCount(): Promise<number> {
    if (!this.localSource) {
      return 0;
    }
    return this.localSource.getDocumentCount();
  }

  /**
   * Clone the git repository
   */
  private async gitClone(context: SourceContext): Promise<void> {
    const parentDir = path.dirname(this.localPath);
    await fs.mkdir(parentDir, { recursive: true });

    context.logger.debug({ repo: this.config.path, target: this.localPath }, 'Cloning repository');
    
    // Clone with depth 1 for faster clone
    await execAsync(`git clone --depth 1 "${this.config.path}" "${this.localPath}"`);
  }

  /**
   * Pull latest changes
   */
  private async gitPull(context: SourceContext): Promise<void> {
    context.logger.debug({ path: this.localPath }, 'Pulling latest changes');
    
    await execAsync(`cd "${this.localPath}" && git pull --ff-only`);
  }

  /**
   * Check if path exists
   */
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
