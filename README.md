# AI Toolbox

A web-based toolbox for AI-assisted content processing — audio transcription, knowledge base management, document parsing, and more.

Built with [Next.js](https://nextjs.org) (App Router), React, Tailwind CSS, and TypeScript.

## Features

- **Audio Transcription** — Transcribe audio files via Aliyun DashScope ASR, with OSS for temporary storage
- **Knowledge Base** — Vector-based document search with chunking, embeddings (DashScope), and SQLite storage
- **Document Parsing** — Parse PDF, Word (.docx), HTML, Markdown, and Feishu (Lark) documents
- **LLM Integration** — Supports Anthropic Claude and DashScope (Qwen) for text generation
- **Task Pipeline** — Async task processing with real-time progress updates via SSE
- **Mermaid Rendering** — Render Mermaid diagrams for visualizing document content
- **Audio Download** — Download audio from URLs via yt-dlp integration

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/) (for audio download)

```bash
# install system dependencies (macOS)
brew install yt-dlp ffmpeg

# verify dependencies
npm run check
```

### Setup

```bash
# install JS dependencies
npm install

# copy and configure environment variables
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

| Variable | Description |
|----------|-------------|
| `DASHSCOPE_API_KEY` | Aliyun DashScope API key (ASR + LLM) |
| `OSS_REGION` | Aliyun OSS region |
| `OSS_ACCESS_KEY_ID` | Aliyun OSS access key |
| `OSS_ACCESS_KEY_SECRET` | Aliyun OSS secret |
| `OSS_BUCKET` | Aliyun OSS bucket name |
| `LLM_PROVIDER` | `dashscope` or `anthropic` |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Claude) |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS 4, Lightning CSS
- **Database:** SQLite (via better-sqlite3)
- **AI:** Anthropic SDK, Aliyun DashScope API
- **Parsing:** pdf-parse, mammoth, cheerio

## License

MIT
