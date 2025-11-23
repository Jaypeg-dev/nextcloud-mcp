# Nextcloud MCP Server

A Model Context Protocol (MCP) server that integrates with Nextcloud to provide access to:
- **Tasks** (via CalDAV)
- **Calendar Events** (via CalDAV)
- **Notes** (via Notes API)
- **Emails** (via Mail API)

## Features

### Tasks
- ✅ Get tasks (filter by status: all/open/completed)
- ✅ Create new tasks with due dates and priorities
- ✅ Update tasks (mark complete, change summary, etc.)

### Calendar
- ✅ Get calendar events with date range filtering
- ✅ Create new calendar events with details and location

### Notes
- ✅ Get all notes
- ✅ Create new notes with markdown support
- ✅ Get specific note content by ID

### Email
- ✅ Get emails from inbox
- 📧 Requires Nextcloud Mail app configured

## Prerequisites

1. **Nextcloud Instance** (any recent version with CalDAV support)
2. **Required Nextcloud Apps**:
   - Tasks (for task management)
   - Calendar (for events)
   - Notes (for note-taking)
   - Mail (optional, for email access)

3. **App Password**: Generate in Nextcloud Settings > Security > Devices & sessions

## Installation

```bash
npm install
npm run build
```

## Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your Nextcloud credentials:
```env
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-app-password
```

⚠️ **Important**: Always use an app password, never your main Nextcloud password!

## Usage

### Testing Locally

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm run start
```

### Using with Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Or use the development version with tsx:

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/nextcloud-mcp/src/index.ts"],
      "env": {
        "NEXTCLOUD_URL": "https://your-nextcloud.com",
        "NEXTCLOUD_USERNAME": "your-username",
        "NEXTCLOUD_PASSWORD": "your-app-password"
      }
    }
  }
}
```

Restart Claude Desktop to load the MCP server.

## Available Tools

Once connected, Claude can use these tools:

### Tasks
- `get_tasks` - Retrieve tasks (filter by status, limit results)
- `create_task` - Create new task with summary, description, due date, priority
- `update_task` - Update existing task (mark complete, change details)

### Calendar
- `get_calendar_events` - Get events in date range
- `create_calendar_event` - Create new event with details

### Notes
- `get_notes` - List all notes
- `create_note` - Create new note with markdown
- `get_note_content` - Get full content of specific note

### Email
- `get_emails` - Retrieve recent emails from inbox

## Example Prompts for Claude

Once the MCP server is connected, you can ask Claude:

```
"Show me my open tasks for this week"
"Create a task to review the Q4 report, due next Friday"
"What meetings do I have tomorrow?"
"Create a calendar event for team standup tomorrow at 10am"
"Show me my recent notes"
"Create a note about the meeting outcomes"
"What are my latest emails?"
```

## Troubleshooting

### Connection Issues
- Verify your Nextcloud URL (use HTTPS, no trailing slash)
- Ensure app password is correct
- Check that required apps (Tasks, Calendar, Notes) are installed

### CalDAV Issues
- Verify calendar/task list names match your Nextcloud setup
- Default calendar name is "personal" - adjust in code if needed
- Default task list name is "tasks" - adjust in code if needed

### Email Issues
- Ensure Nextcloud Mail app is installed and configured
- Check that at least one email account is set up
- Account ID defaults to 0 (first account)

### Debug Mode
Check the MCP server logs in Claude Desktop:
- **macOS**: `~/Library/Logs/Claude/mcp*.log`
- **Windows**: `%APPDATA%\Claude\logs\mcp*.log`

## API Endpoints Used

- CalDAV: `/remote.php/dav/calendars/{username}/`
- Notes: `/index.php/apps/notes/api/v1/notes`
- Mail: `/index.php/apps/mail/api/`

## Security Notes

- 🔐 Always use app passwords, never your main password
- 🔒 Store credentials securely (environment variables, not in code)
- 🛡️ Use HTTPS for your Nextcloud instance
- 🔑 Limit app password scopes if possible in Nextcloud

## Customization

### Changing Calendar Names
Edit `src/index.ts` and update the calendar paths:
```typescript
// Default personal calendar
const caldavPath = `/remote.php/dav/calendars/${this.config.username}/personal/`;

// For a different calendar, change "personal" to your calendar name
const caldavPath = `/remote.php/dav/calendars/${this.config.username}/work/`;
```

### Changing Task List Names
```typescript
// Default tasks list
const caldavPath = `/remote.php/dav/calendars/${this.config.username}/tasks/`;

// For a different task list
const caldavPath = `/remote.php/dav/calendars/${this.config.username}/personal-tasks/`;
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run watch  # In one terminal
npm run dev    # In another terminal

# Build for production
npm run build
```

## License

MIT

## Contributing

Feel free to submit issues and pull requests for:
- Additional Nextcloud integrations
- Bug fixes
- Documentation improvements
- Feature enhancements

## Resources

- [MCP Documentation](https://docs.anthropic.com/mcp)
- [Nextcloud API Documentation](https://docs.nextcloud.com/server/latest/developer_manual/)
- [CalDAV Documentation](https://www.rfc-editor.org/rfc/rfc4791)
