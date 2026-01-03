# XORNG Documentation Knowledge Provider

A knowledge retrieval sub-agent for the XORNG framework that provides documentation search and retrieval capabilities.

## Overview

This provider enables AI agents to search and retrieve relevant documentation:

- **Multi-Source Support** - Load from local files, git repositories, or URLs
- **Smart Chunking** - Content-aware splitting that preserves code blocks
- **Filtered Search** - Filter by category, language, framework, tags
- **Code Examples** - Extract and search code snippets separately

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

```bash
# Set documentation path
export DOCS_PATH=/path/to/docs

# Start server
npm start
```

### Configuration

Create a config file or use environment variables:

```json
{
  "sources": [
    {
      "name": "project-docs",
      "type": "local",
      "path": "./docs",
      "patterns": ["**/*.md", "**/*.mdx"],
      "excludePatterns": ["**/node_modules/**"],
      "defaultLanguage": "typescript",
      "defaultFramework": "react"
    },
    {
      "name": "external-docs",
      "type": "git",
      "path": "https://github.com/org/repo.git",
      "patterns": ["docs/**/*.md"]
    }
  ],
  "chunkSize": 1000,
  "chunkOverlap": 200,
  "maxResults": 10,
  "minScore": 0.3
}
```

```bash
export XORNG_DOCS_CONFIG=/path/to/config.json
npm start
```

### Available Tools

#### `search-docs`
Search documentation with advanced filtering.

```json
{
  "query": "how to implement authentication",
  "category": "tutorial",
  "language": "typescript",
  "framework": "express",
  "limit": 5
}
```

#### `get-topic`
Get comprehensive documentation for a topic including code examples.

```json
{
  "topic": "JWT authentication",
  "language": "typescript",
  "includeExamples": true
}
```

#### `find-examples`
Find code examples for a specific task.

```json
{
  "query": "database connection pooling",
  "language": "typescript",
  "limit": 5
}
```

#### Standard Knowledge Tools
- `search` - Basic search
- `retrieve` - Get document by ID
- `list-sources` - List configured sources
- `sync` - Re-sync sources
- `stats` - Get statistics

## Source Types

### Local Source
Load documentation from local filesystem:

```json
{
  "name": "local-docs",
  "type": "local",
  "path": "/path/to/docs",
  "patterns": ["**/*.md"],
  "excludePatterns": ["**/drafts/**"]
}
```

### Git Source
Clone and load from git repositories:

```json
{
  "name": "repo-docs",
  "type": "git",
  "path": "https://github.com/org/repo.git",
  "patterns": ["docs/**/*.md"]
}
```

## Document Categories

Documents are automatically categorized based on path or frontmatter:

- `api-reference` - API documentation
- `tutorial` - Step-by-step tutorials
- `guide` - How-to guides
- `example` - Code examples
- `concept` - Conceptual explanations
- `troubleshooting` - FAQ and troubleshooting
- `changelog` - Release notes
- `readme` - README files

## Frontmatter Support

Documents can include frontmatter for metadata:

```markdown
---
title: Authentication Guide
category: tutorial
language: typescript
framework: express
tags:
  - auth
  - jwt
  - security
---

# Authentication Guide

Content here...
```

## Chunking Strategy

Uses content-aware chunking based on best practices:

1. **Recursive Character Splitting** - Splits by semantic boundaries (headers, paragraphs, sentences)
2. **Code Block Preservation** - Keeps code blocks intact when possible
3. **Overlap for Context** - Maintains context between chunks
4. **Markdown Awareness** - Respects markdown structure

### Separators (in priority order):
- H2 headers (`## `)
- H3 headers (`### `)
- H4 headers (`#### `)
- Code blocks (` ``` `)
- Paragraphs (`\n\n`)
- Lines (`\n`)
- Sentences (`. `)
- Words (` `)

## Docker

```bash
# Build
docker build -t xorng/knowledge-documentation .

# Run with mounted docs
docker run -v /path/to/docs:/docs xorng/knowledge-documentation
```

## Example Output

### Search Results

```json
{
  "chunks": [
    {
      "chunk": {
        "id": "local-docs:guides/auth.md-chunk-0",
        "content": "## JWT Authentication\n\nJSON Web Tokens provide...",
        "metadata": {
          "source": "local-docs",
          "category": "tutorial",
          "language": "typescript",
          "chunkType": "text"
        }
      },
      "score": 0.85,
      "highlights": ["JWT", "authentication"]
    }
  ],
  "totalCount": 5,
  "queryTimeMs": 23
}
```

### Code Examples

```json
{
  "examples": [
    {
      "code": "```typescript\nimport jwt from 'jsonwebtoken';\n\nconst token = jwt.sign(payload, secret);\n```",
      "language": "typescript",
      "source": "local-docs",
      "score": 0.92
    }
  ]
}
```

## License

MIT
