# Digital Learning Bot - SvelteKit Version

A modern AI-powered Telegram bot built with SvelteKit, Prisma, and SQLite. This is a complete rewrite of the original Vue.js application using modern web technologies.

## Features

- 🤖 **Telegram Bot Integration**: Full Telegram bot functionality with Telegraf
- 🧠 **AI Integration**: OpenAI GPT-4 for chat completions and image generation
- 🖼️ **Image Processing**: HuggingFace integration for image captioning
- 📅 **Task Scheduling**: Schedule different types of content (TEXT, IMAGE, VIDEO, PROMPT)
- 💾 **Database**: SQLite with Prisma ORM for data persistence
- 🎨 **Modern UI**: SvelteKit frontend with real-time updates
- 📁 **File Management**: Upload and manage images/videos for scheduled posts
- ⚡ **Real-time**: Live updates between frontend and backend

## Tech Stack

- **Frontend**: SvelteKit, TypeScript
- **Backend**: SvelteKit API routes
- **Database**: SQLite with Prisma ORM
- **Bot**: Telegraf (Telegram)
- **AI**: OpenAI API, HuggingFace Inference API
- **Scheduling**: node-schedule
- **Styling**: CSS (ported from original)

## Setup

### Prerequisites

- Node.js 18+ or Bun
- Telegram Bot Token
- OpenAI API Key
- HuggingFace Access Token

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd digital-learning-bot
   bun install
   ```

2. **Set up environment variables**:
   Create a `.env` file and add your API keys:
   ```bash
   # Database (will be created automatically)
   DATABASE_URL="file:./dev.db"

   # Telegram Bot
   TELEGRAM_KEY="your_telegram_bot_token_here"

   # OpenAI
   OPENAI_KEY="your_openai_api_key_here"

   # HuggingFace
   HF_ACCESS_TOKEN="your_huggingface_token_here"
   ```

3. **Initialize the database**:
   ```bash
   bunx prisma generate
   bunx prisma db push
   ```
   This will create the SQLite database file automatically.

4. **Start the development server**:
   ```bash
   bun run dev
   ```

The application will be available at `http://localhost:5173`

## API Endpoints

- `GET /api/jobs` - Get all scheduled jobs
- `POST /api/jobs` - Create a new job
- `PUT /api/jobs/[id]` - Update a job
- `DELETE /api/jobs/[id]` - Delete a job
- `GET /api/messages` - Get chat history
- `POST /api/messages` - Create a new message
- `DELETE /api/messages/[id]` - Delete a message
- `GET /api/context` - Get bot context
- `PUT /api/context` - Update bot context
- `GET /api/files` - Get uploaded files
- `POST /api/files` - Upload a file
- `GET /api/settings` - Get bot settings
- `PUT /api/settings` - Update bot settings

## Database Schema

- **Job**: Scheduled tasks with type, message, date, and state
- **Message**: Chat history with role and content
- **Context**: Bot system context
- **File**: Uploaded images and videos
- **BotSettings**: Bot configuration (name, conversation ID)

## Telegram Bot Commands

- `/help` - Show bot information
- `/stats` - Show current conversation ID
- `@botname` - Mention the bot to get AI responses
- `imagine` or `Traum` - Generate images with AI

## Development

- **Type checking**: `bun run check`
- **Build**: `bun run build`
- **Preview**: `bun run preview`

## Migration from Original

This version maintains full compatibility with the original Vue.js application while providing:

- Modern TypeScript codebase
- Better error handling
- Improved database schema
- Cleaner API design
- Real-time updates
- Better file organization

## License

Same as the original project.