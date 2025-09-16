# Bot Authentication System

This document explains how to use the bot-based authentication system for API requests.

## Overview

The authentication system uses the bot ID as an authentication token. Each bot has a unique ID that serves as its authentication credential.

## Authentication Methods

The system supports multiple ways to provide the bot ID:

### 1. Authorization Header (Bearer Token)
```javascript
fetch('/api/context', {
    headers: {
        'Authorization': `Bearer ${botId}`,
        'Content-Type': 'application/json'
    }
});
```

### 2. X-Bot-ID Header
```javascript
fetch('/api/messages', {
    headers: {
        'X-Bot-ID': botId,
        'Content-Type': 'application/json'
    }
});
```

### 3. Query Parameter (GET requests only)
```javascript
fetch(`/api/context?botId=${botId}`);
```

### 4. Request Body (POST/PUT requests)
```javascript
fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        botId: botId,
        role: 'user',
        content: 'Hello!'
    })
});
```

## Protected API Endpoints

The following endpoints now require authentication:

- `GET /api/context` - Get bot context
- `PUT /api/context` - Update bot context
- `GET /api/messages` - Get bot messages
- `POST /api/messages` - Create new message
- `GET /api/jobs` - Get bot jobs
- `POST /api/jobs` - Create new job

## Public API Endpoints

The following endpoints do not require authentication:

- `GET /api/bots/[id]` - Get specific bot info (for bot verification)
- `POST /api/bots` - Create new bot
- `PUT /api/bots/[id]` - Update bot settings
- `DELETE /api/bots/[id]` - Delete bot
- `GET /api/files` - Get static files
- `POST /api/files` - Upload files

## Authentication Flow

1. **Extract Bot ID**: The system checks for bot ID in this order:
   - Authorization header (Bearer token)
   - X-Bot-ID header
   - Query parameter (botId)
   - Request body (botId field)

2. **Validate Bot**: The system verifies:
   - Bot ID exists in database
   - Bot is active (isActive = true)

3. **Access Control**: Authenticated requests can only access data belonging to their bot

## Error Responses

### 401 Unauthorized
```json
{
    "error": "Authentication required. Provide bot ID via Authorization header, X-Bot-ID header, or botId query parameter."
}
```

### 401 Invalid Bot
```json
{
    "error": "Invalid or inactive bot ID"
}
```

## Usage Examples

### Client-Side JavaScript
```javascript
// Using the helper function
import { createAuthHeaders } from '$lib/auth.js';

const botId = 'your-bot-id';
const response = await fetch('/api/messages', {
    headers: {
        ...createAuthHeaders(botId),
        'Content-Type': 'application/json'
    }
});
```

### Server-Side (SvelteKit)
```javascript
// In a load function or API route
import { authenticateBot } from '$lib/auth.js';

export async function load({ request, url }) {
    try {
        const bot = await authenticateBot(request, url);
        // Use authenticated bot
        return { bot };
    } catch (error) {
        throw error; // Handle authentication error
    }
}
```

## Security Notes

- Bot IDs are treated as sensitive credentials
- Only active bots can authenticate
- Each bot can only access its own data
- Consider using HTTPS in production
- Bot IDs should be kept secure and not exposed in client-side code

## Migration Notes

- Existing API calls without authentication will fail
- Update client code to include authentication headers
- Test all API endpoints after implementing authentication

## Removed Endpoints

The following endpoints have been removed for security and cleanup:

- `GET /api/bots` - Removed to prevent listing all bots (security risk)
- `POST /api/bot/restart` - Removed as it was unused
- `/api/settings` - Removed empty directory