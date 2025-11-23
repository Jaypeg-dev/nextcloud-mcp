# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Get Your Nextcloud App Password

1. Log into your Nextcloud instance
2. Go to **Settings** → **Security**
3. Scroll to "Devices & sessions"
4. Enter a name (e.g., "MCP Server") and click "Create new app password"
5. Copy the generated password

### Step 2: Configure the Server

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your details:

```env
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=paste-your-app-password-here
```

### Step 3: Build and Test

```bash
# Build the project
npm run build

# Test it works (Ctrl+C to exit)
npm run start
```

You should see: `Nextcloud MCP Server running on stdio`

### Step 4: Connect to Claude Desktop

Edit your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration (replace the path with your actual path):

```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "node",
      "args": ["/full/path/to/nextcloud-mcp/build/index.js"],
      "env": {
        "NEXTCLOUD_URL": "https://your-nextcloud.com",
        "NEXTCLOUD_USERNAME": "your-username",
        "NEXTCLOUD_PASSWORD": "your-app-password"
      }
    }
  }
}
```

**Important**: Use the full absolute path to the build/index.js file!

### Step 5: Restart Claude Desktop

Quit Claude Desktop completely and reopen it.

### Step 6: Test with Claude

Try these prompts in Claude:

```
"Show me my open tasks"
"What meetings do I have today?"
"List my recent notes"
"Show me my latest emails"
```

## ✅ Verification Checklist

Before asking Claude to use Nextcloud:

- [ ] Nextcloud URL is correct (HTTPS, no trailing slash)
- [ ] App password is correctly copied (no extra spaces)
- [ ] Required apps are installed:
  - [ ] Tasks app
  - [ ] Calendar app
  - [ ] Notes app
  - [ ] Mail app (if using email features)
- [ ] Full absolute path used in Claude Desktop config
- [ ] Claude Desktop has been restarted

## 🔧 Common Issues

### "Connection refused" or timeout
- Check your Nextcloud URL is accessible
- Verify you're using HTTPS
- Try accessing the URL in your browser

### "Authentication failed" or 401 error
- Regenerate a new app password
- Make sure there are no spaces before/after the password
- Try your username in lowercase

### "Calendar not found" or "Tasks not found"
- Check that you have at least one calendar created
- Verify the Tasks app is installed and has a task list
- See customization section in README for different calendar names

### Claude doesn't show Nextcloud tools
- Verify Claude Desktop config file syntax (use a JSON validator)
- Check the path to build/index.js is correct and absolute
- Look at Claude Desktop logs for errors
- Restart Claude Desktop after config changes

## 🎯 Next Steps

Once working:
1. Customize calendar/task list names in `src/index.ts` if needed
2. Add more tools as needed for your workflow
3. Check out the full README.md for advanced features

## 📚 Example Use Cases

**Task Management**:
```
"Create a task to review the integration docs, due tomorrow"
"Show me all my completed tasks this week"
"Mark task X as complete"
```

**Calendar**:
```
"What's on my calendar tomorrow?"
"Schedule a meeting with the team next Monday at 2pm"
"Show me my events for next week"
```

**Notes**:
```
"Create a note with my meeting notes from today"
"Show me all my notes"
"What's in note ID 123?"
```

**Email**:
```
"Show me my latest emails"
"What are my unread messages?"
```

## 🆘 Getting Help

If you're stuck:
1. Check the logs: `~/Library/Logs/Claude/mcp*.log` (macOS)
2. Review the full README.md
3. Verify all prerequisites are met
4. Test the Nextcloud API directly using curl to isolate issues

Happy automating! 🎉
