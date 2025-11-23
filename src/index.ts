#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { parseISO, format } from "date-fns";

interface NextcloudConfig {
  url: string;
  username: string;
  password: string; // App password recommended
}

class NextcloudMCPServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private config: NextcloudConfig;

  constructor(config: NextcloudConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: "nextcloud-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Create axios instance with basic auth
    this.axiosInstance = axios.create({
      baseURL: config.url,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        "Content-Type": "application/xml",
        "Accept": "application/xml",
      },
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_tasks":
            return await this.getTasks(args as any);
          case "create_task":
            return await this.createTask(args as any);
          case "update_task":
            return await this.updateTask(args as any);
          case "get_calendar_events":
            return await this.getCalendarEvents(args as any);
          case "create_calendar_event":
            return await this.createCalendarEvent(args as any);
          case "get_notes":
            return await this.getNotes(args as any);
          case "create_note":
            return await this.createNote(args as any);
          case "get_note_content":
            return await this.getNoteContent(args as any);
          case "get_emails":
            return await this.getEmails(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      // Tasks tools
      {
        name: "get_tasks",
        description:
          "Retrieve tasks from Nextcloud. Can filter by status (completed/open) and limit results.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["all", "open", "completed"],
              description: "Filter tasks by status",
              default: "all",
            },
            limit: {
              type: "number",
              description: "Maximum number of tasks to return",
              default: 50,
            },
          },
        },
      },
      {
        name: "create_task",
        description: "Create a new task in Nextcloud",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Task title/summary",
            },
            description: {
              type: "string",
              description: "Task description (optional)",
            },
            due: {
              type: "string",
              description: "Due date in ISO format (YYYY-MM-DD) (optional)",
            },
            priority: {
              type: "number",
              description: "Priority (1-9, where 1 is highest) (optional)",
            },
          },
          required: ["summary"],
        },
      },
      {
        name: "update_task",
        description: "Update an existing task (mark as complete, change summary, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task ID/UID",
            },
            summary: {
              type: "string",
              description: "New task title/summary (optional)",
            },
            status: {
              type: "string",
              enum: ["NEEDS-ACTION", "IN-PROCESS", "COMPLETED", "CANCELLED"],
              description: "New task status (optional)",
            },
            percentComplete: {
              type: "number",
              description: "Completion percentage 0-100 (optional)",
            },
          },
          required: ["taskId"],
        },
      },
      // Calendar tools
      {
        name: "get_calendar_events",
        description:
          "Retrieve calendar events from Nextcloud. Can specify date range.",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description:
                "Start date in ISO format (YYYY-MM-DD). Defaults to today.",
            },
            endDate: {
              type: "string",
              description:
                "End date in ISO format (YYYY-MM-DD). Defaults to 30 days from start.",
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return",
              default: 50,
            },
          },
        },
      },
      {
        name: "create_calendar_event",
        description: "Create a new calendar event in Nextcloud",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Event title/summary",
            },
            description: {
              type: "string",
              description: "Event description (optional)",
            },
            startDateTime: {
              type: "string",
              description: "Start date/time in ISO format (YYYY-MM-DDTHH:mm:ss)",
            },
            endDateTime: {
              type: "string",
              description: "End date/time in ISO format (YYYY-MM-DDTHH:mm:ss)",
            },
            location: {
              type: "string",
              description: "Event location (optional)",
            },
          },
          required: ["summary", "startDateTime", "endDateTime"],
        },
      },
      // Notes tools
      {
        name: "get_notes",
        description: "Retrieve all notes from Nextcloud Notes app",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of notes to return",
              default: 50,
            },
          },
        },
      },
      {
        name: "create_note",
        description: "Create a new note in Nextcloud Notes app",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Note title (first line)",
            },
            content: {
              type: "string",
              description: "Note content (markdown supported)",
            },
            category: {
              type: "string",
              description: "Note category/folder (optional)",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "get_note_content",
        description: "Get the full content of a specific note by ID",
        inputSchema: {
          type: "object",
          properties: {
            noteId: {
              type: "number",
              description: "Note ID",
            },
          },
          required: ["noteId"],
        },
      },
      // Email tools
      {
        name: "get_emails",
        description:
          "Retrieve emails from Nextcloud Mail app. Returns recent emails from inbox.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "number",
              description: "Mail account ID (use 0 for default)",
              default: 0,
            },
            limit: {
              type: "number",
              description: "Maximum number of emails to return",
              default: 20,
            },
          },
        },
      },
    ];
  }

  // ========== TASKS METHODS ==========
  private async getTasks(args: any) {
    const status = args.status || "all";
    const limit = args.limit || 50;

    try {
      // CalDAV REPORT request to get tasks
      const caldavPath = `/remote.php/dav/calendars/${this.config.username}/tasks/`;

      const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VTODO" />
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

      const response = await this.axiosInstance.request({
        method: "REPORT",
        url: caldavPath,
        data: requestBody,
        headers: {
          "Content-Type": "application/xml",
          Depth: "1",
        },
      });

      const tasks = this.parseTasksFromCalDAV(response.data, status, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }
  }

  private parseTasksFromCalDAV(
    xmlData: string,
    status: string,
    limit: number
  ): any[] {
    const tasks: any[] = [];

    // Basic XML parsing for VTODO components
    const todoMatches = xmlData.matchAll(
      /<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/g
    );

    for (const match of todoMatches) {
      if (tasks.length >= limit) break;

      const todoData = match[1];
      const task = this.parseVTODO(todoData);

      if (task) {
        if (status === "all") {
          tasks.push(task);
        } else if (
          status === "completed" &&
          task.status === "COMPLETED"
        ) {
          tasks.push(task);
        } else if (
          status === "open" &&
          task.status !== "COMPLETED"
        ) {
          tasks.push(task);
        }
      }
    }

    return tasks;
  }

  private parseVTODO(todoData: string): any | null {
    const lines = todoData.split(/\r?\n/);
    const task: any = {};

    for (const line of lines) {
      if (line.startsWith("UID:")) {
        task.uid = line.substring(4).trim();
      } else if (line.startsWith("SUMMARY:")) {
        task.summary = line.substring(8).trim();
      } else if (line.startsWith("STATUS:")) {
        task.status = line.substring(7).trim();
      } else if (line.startsWith("PERCENT-COMPLETE:")) {
        task.percentComplete = parseInt(line.substring(17).trim());
      } else if (line.startsWith("DUE")) {
        const dueMatch = line.match(/DUE[^:]*:(\d{8}T?\d{6}Z?)/);
        if (dueMatch) {
          task.due = this.parseICalDate(dueMatch[1]);
        }
      } else if (line.startsWith("PRIORITY:")) {
        task.priority = parseInt(line.substring(9).trim());
      } else if (line.startsWith("DESCRIPTION:")) {
        task.description = line.substring(12).trim();
      }
    }

    return task.uid ? task : null;
  }

  private async createTask(args: any) {
    const { summary, description, due, priority } = args;
    const uid = this.generateUID();

    let vtodo = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud MCP Server//EN
BEGIN:VTODO
UID:${uid}
SUMMARY:${summary}
STATUS:NEEDS-ACTION
CREATED:${this.formatICalDateTime(new Date())}`;

    if (description) {
      vtodo += `\nDESCRIPTION:${description}`;
    }
    if (due) {
      vtodo += `\nDUE:${this.formatICalDate(new Date(due))}`;
    }
    if (priority) {
      vtodo += `\nPRIORITY:${priority}`;
    }

    vtodo += `\nEND:VTODO
END:VCALENDAR`;

    try {
      const caldavPath = `/remote.php/dav/calendars/${this.config.username}/tasks/${uid}.ics`;

      await this.axiosInstance.put(caldavPath, vtodo, {
        headers: {
          "Content-Type": "text/calendar",
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Task created successfully with UID: ${uid}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  private async updateTask(args: any) {
    const { taskId, summary, status, percentComplete } = args;

    // First, fetch the existing task
    const caldavPath = `/remote.php/dav/calendars/${this.config.username}/tasks/${taskId}.ics`;

    try {
      const response = await this.axiosInstance.get(caldavPath);
      let vtodo = response.data;

      // Update fields
      if (summary) {
        vtodo = vtodo.replace(/SUMMARY:.*/, `SUMMARY:${summary}`);
      }
      if (status) {
        vtodo = vtodo.replace(/STATUS:.*/, `STATUS:${status}`);
      }
      if (percentComplete !== undefined) {
        if (vtodo.includes("PERCENT-COMPLETE:")) {
          vtodo = vtodo.replace(
            /PERCENT-COMPLETE:.*/,
            `PERCENT-COMPLETE:${percentComplete}`
          );
        } else {
          vtodo = vtodo.replace(
            /END:VTODO/,
            `PERCENT-COMPLETE:${percentComplete}\nEND:VTODO`
          );
        }
      }

      // Update LAST-MODIFIED
      vtodo = vtodo.replace(
        /LAST-MODIFIED:.*/,
        `LAST-MODIFIED:${this.formatICalDateTime(new Date())}`
      );

      await this.axiosInstance.put(caldavPath, vtodo, {
        headers: {
          "Content-Type": "text/calendar",
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Task ${taskId} updated successfully`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  // ========== CALENDAR METHODS ==========
  private async getCalendarEvents(args: any) {
    const startDate = args.startDate || format(new Date(), "yyyy-MM-dd");
    const endDate =
      args.endDate ||
      format(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd"
      );
    const limit = args.limit || 50;

    try {
      const caldavPath = `/remote.php/dav/calendars/${this.config.username}/personal/`;

      const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${this.formatICalDate(
          new Date(startDate)
        )}" end="${this.formatICalDate(new Date(endDate))}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

      const response = await this.axiosInstance.request({
        method: "REPORT",
        url: caldavPath,
        data: requestBody,
        headers: {
          "Content-Type": "application/xml",
          Depth: "1",
        },
      });

      const events = this.parseEventsFromCalDAV(response.data, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch calendar events: ${error.message}`);
    }
  }

  private parseEventsFromCalDAV(xmlData: string, limit: number): any[] {
    const events: any[] = [];

    const eventMatches = xmlData.matchAll(
      /<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/g
    );

    for (const match of eventMatches) {
      if (events.length >= limit) break;

      const eventData = match[1];
      const event = this.parseVEVENT(eventData);

      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private parseVEVENT(eventData: string): any | null {
    const lines = eventData.split(/\r?\n/);
    const event: any = {};

    for (const line of lines) {
      if (line.startsWith("UID:")) {
        event.uid = line.substring(4).trim();
      } else if (line.startsWith("SUMMARY:")) {
        event.summary = line.substring(8).trim();
      } else if (line.startsWith("DESCRIPTION:")) {
        event.description = line.substring(12).trim();
      } else if (line.startsWith("LOCATION:")) {
        event.location = line.substring(9).trim();
      } else if (line.startsWith("DTSTART")) {
        const startMatch = line.match(/DTSTART[^:]*:(\d{8}T?\d{6}Z?)/);
        if (startMatch) {
          event.start = this.parseICalDate(startMatch[1]);
        }
      } else if (line.startsWith("DTEND")) {
        const endMatch = line.match(/DTEND[^:]*:(\d{8}T?\d{6}Z?)/);
        if (endMatch) {
          event.end = this.parseICalDate(endMatch[1]);
        }
      }
    }

    return event.uid ? event : null;
  }

  private async createCalendarEvent(args: any) {
    const { summary, description, startDateTime, endDateTime, location } = args;
    const uid = this.generateUID();

    let vevent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud MCP Server//EN
BEGIN:VEVENT
UID:${uid}
SUMMARY:${summary}
DTSTART:${this.formatICalDateTime(new Date(startDateTime))}
DTEND:${this.formatICalDateTime(new Date(endDateTime))}
CREATED:${this.formatICalDateTime(new Date())}`;

    if (description) {
      vevent += `\nDESCRIPTION:${description}`;
    }
    if (location) {
      vevent += `\nLOCATION:${location}`;
    }

    vevent += `\nEND:VEVENT
END:VCALENDAR`;

    try {
      const caldavPath = `/remote.php/dav/calendars/${this.config.username}/personal/${uid}.ics`;

      await this.axiosInstance.put(caldavPath, vevent, {
        headers: {
          "Content-Type": "text/calendar",
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Calendar event created successfully with UID: ${uid}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  // ========== NOTES METHODS ==========
  private async getNotes(args: any) {
    const limit = args.limit || 50;

    try {
      const response = await this.axiosInstance.get(
        `/index.php/apps/notes/api/v1/notes`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const notes = response.data.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(notes, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }
  }

  private async createNote(args: any) {
    const { title, content, category } = args;

    // Nextcloud Notes uses the first line as title
    const noteContent = title ? `${title}\n\n${content}` : content;

    try {
      const payload: any = {
        content: noteContent,
      };

      if (category) {
        payload.category = category;
      }

      const response = await this.axiosInstance.post(
        `/index.php/apps/notes/api/v1/notes`,
        payload,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Note created successfully with ID: ${response.data.id}`,
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }

  private async getNoteContent(args: any) {
    const { noteId } = args;

    try {
      const response = await this.axiosInstance.get(
        `/index.php/apps/notes/api/v1/notes/${noteId}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch note: ${error.message}`);
    }
  }

  // ========== EMAIL METHODS ==========
  private async getEmails(args: any) {
    const accountId = args.accountId || 0;
    const limit = args.limit || 20;

    try {
      // Get mailboxes first
      const mailboxesResponse = await this.axiosInstance.get(
        `/index.php/apps/mail/api/accounts/${accountId}/mailboxes`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      // Find INBOX
      const inbox = mailboxesResponse.data.find(
        (mb: any) => mb.specialRole === "inbox"
      );

      if (!inbox) {
        throw new Error("Inbox not found");
      }

      // Get messages from inbox
      const messagesResponse = await this.axiosInstance.get(
        `/index.php/apps/mail/api/messages?mailboxId=${inbox.id}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const emails = messagesResponse.data.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(emails, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  // ========== UTILITY METHODS ==========
  private generateUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private formatICalDate(date: Date): string {
    return format(date, "yyyyMMdd");
  }

  private formatICalDateTime(date: Date): string {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  }

  private parseICalDate(icalDate: string): string {
    // Parse iCal date format (e.g., 20240101 or 20240101T120000Z)
    if (icalDate.includes("T")) {
      const year = icalDate.substring(0, 4);
      const month = icalDate.substring(4, 6);
      const day = icalDate.substring(6, 8);
      const hour = icalDate.substring(9, 11);
      const minute = icalDate.substring(11, 13);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    } else {
      const year = icalDate.substring(0, 4);
      const month = icalDate.substring(4, 6);
      const day = icalDate.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Nextcloud MCP Server running on stdio");
  }
}

// Main execution
const config: NextcloudConfig = {
  url: process.env.NEXTCLOUD_URL || "",
  username: process.env.NEXTCLOUD_USERNAME || "",
  password: process.env.NEXTCLOUD_PASSWORD || "",
};

if (!config.url || !config.username || !config.password) {
  console.error(
    "Error: NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD environment variables are required"
  );
  process.exit(1);
}

const server = new NextcloudMCPServer(config);
server.run().catch(console.error);
