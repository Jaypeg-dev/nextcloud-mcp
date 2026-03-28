# Nextcloud MCP Server

A Model Context Protocol (MCP) server that integrates with Nextcloud to provide access to tasks, calendar, notes, email, files, and Deck boards. Supports both local stdio (Claude Desktop) and remote HTTP/SSE transport (Claude Mobile via a Pi or server deployment).

## Features

### Tasks
- Get tasks across all lists or a specific list (filter by status: all/open/completed)
- Create new tasks with due dates and priorities
- Update tasks (mark complete, change summary, etc.)
- Discover all available task lists

### Calendar
- Get calendar events with date range filtering
- Create new calendar events with details and location

### Notes
- Get all notes
- Create new notes with markdown support
- Get specific note content by ID

### Email
- Get emails from inbox (requires Nextcloud Mail app)

### Files (WebDAV)
- List files and folders with metadata (size, type, last modified)
- Read text file content
- Upload / create or overwrite files
- Create folders
- Move or rename files and folders

### Deck (Kanban)
- List all boards
- Get a full board view — all stacks (columns) and cards with assignees and labels
- Create cards in a stack
- Update card title, description, or due date
- Move cards between columns

## Prerequisites

1. **Nextcloud instance** (any recent version with CalDAV support)
2. **Required Nextcloud apps**:
   - Tasks — task management
   - Calendar — events
   - Notes — note-taking
   - Deck — Kanban boards
   - Mail — optional, for email access
3. **App password**: generate in Nextcloud Settings > Security > Devices & sessions

## Installation

```bash
npm install
npm run build
```

## Configuration

Set these environment variables (or put them in a `.env` file for local dev):

```env
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-app-password

# HTTP/SSE mode (omit for stdio)
MCP_TRANSPORT=http
MCP_PORT=3000
MCP_AUTH_TOKEN=your-secret-token
```

⚠️ Always use an app password, never your main Nextcloud password.

## Transport modes

### stdio (default) — Claude Desktop, local

The server is launched as a subprocess by Claude Desktop.

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "node",
      "args": ["/path/to/nextcloud-mcp/build/index.js"],
      "env": {
        "NEXTCLOUD_URL": "https://your-nextcloud.com",
        "NEXTCLOUD_USERNAME": "your-username",
        "NEXTCLOUD_PASSWORD": "your-app-password"
      }
    }
  }
}
```

### HTTP/SSE — Raspberry Pi or server deployment

Set `MCP_TRANSPORT=http` and the server listens on `MCP_PORT` (default `3000`).

Endpoints:
- `GET /sse` — SSE connection
- `POST /messages?sessionId=…` — inbound messages
- `GET /health` — health check (no auth required)

#### systemd service

Create `/etc/systemd/system/nextcloud-mcp.service`:

```ini
[Unit]
Description=Nextcloud MCP Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/nextcloud-mcp
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
Environment=MCP_TRANSPORT=http
Environment=MCP_PORT=3000
Environment=MCP_AUTH_TOKEN=your-secret-token
Environment=NEXTCLOUD_URL=https://your-nextcloud.com
Environment=NEXTCLOUD_USERNAME=your-username
Environment=NEXTCLOUD_PASSWORD=your-app-password

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now nextcloud-mcp
```

#### Apache reverse proxy

Add a location block to your existing SSL vhost. SSE requires buffering to be disabled or the event stream stalls.

```apache
<Location /mcp/>
    ProxyPass        http://localhost:3000/
    ProxyPassReverse http://localhost:3000/

    # Required for SSE — disable buffering
    ProxyBufSize         0
    ProxyBuffering       off
    SetEnv               proxy-nokeepalive 1
    SetEnv               proxy-initial-not-buffered 1
</Location>
```

Enable the required modules if not already active:

```bash
sudo a2enmod proxy proxy_http
sudo systemctl reload apache2
```

#### Connecting clients

**Claude Desktop** (local LAN, no Apache needed):
```json
{
  "mcpServers": {
    "nextcloud": {
      "url": "http://raspberrypi.local:3000/sse",
      "headers": { "Authorization": "Bearer your-secret-token" }
    }
  }
}
```

**Claude Mobile** (via Apache/HTTPS):

Add as a remote integration in the Claude app:
```
URL:           https://yourdomain.com/mcp/sse
Authorization: Bearer your-secret-token
```

## Available tools

### Tasks
| Tool | Description |
|------|-------------|
| `get_task_lists` | Discover all VTODO-capable lists |
| `get_tasks` | Retrieve tasks; filter by list, status, limit |
| `create_task` | Create task with summary, description, due date, priority |
| `update_task` | Update status, summary, or percent complete |

### Calendar
| Tool | Description |
|------|-------------|
| `get_calendar_events` | Get events in a date range |
| `create_calendar_event` | Create event with title, times, description, location |

### Notes
| Tool | Description |
|------|-------------|
| `get_notes` | List all notes |
| `create_note` | Create note with title, content, category |
| `get_note_content` | Get full content of a note by ID |

### Email
| Tool | Description |
|------|-------------|
| `get_emails` | Get recent inbox emails |

### Files
| Tool | Description |
|------|-------------|
| `list_files` | List folder contents with metadata |
| `get_file` | Read a text file's content |
| `upload_file` | Create or overwrite a file |
| `create_folder` | Create a new directory |
| `move_file` | Move or rename a file or folder |

### Deck
| Tool | Description |
|------|-------------|
| `get_deck_boards` | List all boards |
| `get_deck_board` | Full board view with stacks and cards |
| `create_deck_card` | Add a card to a stack |
| `update_deck_card` | Edit card title, description, or due date |
| `move_deck_card` | Move card to a different column |

## Example prompts

```
"Show me my open tasks"
"Create a task to review the Q4 report, due next Friday"
"What meetings do I have this week?"
"List the files in my Documents folder"
"Read the file Projects/notes.md"
"Show me the boards in Deck"
"Move the 'Fix login bug' card to In Progress"
"What are my latest emails?"
```

## Troubleshooting

**Connection issues**
- Use HTTPS for your Nextcloud URL, no trailing slash
- Verify the app password is correct
- Ensure required apps are installed in Nextcloud

**SSE stream not working through Apache**
- Confirm `proxy_http` module is enabled
- Ensure `ProxyBuffering off` is set — without this, events are buffered and clients appear to hang

**Deck cards not showing**
- `get_deck_board` fetches stacks in a separate request from boards — ensure the Deck app is installed and the board ID is correct

**CalDAV issues**
- Task list and calendar names are case-sensitive and must match your Nextcloud setup
- Default calendar is `personal`; use `get_task_lists` to discover list IDs

**Email issues**
- Nextcloud Mail app must be installed and have at least one account configured
- Account ID defaults to `0` (first account)

**Debug logs**
- macOS: `~/Library/Logs/Claude/mcp*.log`
- HTTP mode: stdout/stderr from the systemd service (`journalctl -u nextcloud-mcp -f`)

## Security

- Always use app passwords, never your main Nextcloud password
- Set `MCP_AUTH_TOKEN` whenever the server is reachable over a network
- Use HTTPS (via your existing Apache SSL vhost) for internet-facing deployments
- Store credentials in environment variables or the systemd unit file, not in code

## API endpoints used

- CalDAV: `/remote.php/dav/calendars/{username}/`
- WebDAV: `/remote.php/dav/files/{username}/`
- Notes: `/index.php/apps/notes/api/v1/`
- Mail: `/index.php/apps/mail/api/`
- Deck: `/ocs/v2.php/apps/deck/api/v1.0/`

## License

MIT
