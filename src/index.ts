#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { format } from "date-fns";
import express from "express";

interface NextcloudConfig {
  url: string;
  username: string;
  password: string;
}

interface TaskList {
  id: string;
  displayName: string;
  url: string;
}

class NextcloudMCPServer {
  private axiosInstance: AxiosInstance;
  private config: NextcloudConfig;

  constructor(config: NextcloudConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.url,
      auth: { username: config.username, password: config.password },
      headers: { "Content-Type": "application/xml", "Accept": "application/xml" },
    });
  }

  /** Creates and fully configures a fresh MCP Server instance. */
  private createMCPServer(): Server {
    const server = new Server(
      { name: "nextcloud-mcp-server", version: "1.3.0" },
      { capabilities: { tools: {} } }
    );

    server.onerror = (error) => console.error("[MCP Error]", error);

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.getTools() }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case "get_task_lists":        return await this.getTaskLists();
          case "get_tasks":             return await this.getTasks(args as any);
          case "create_task":           return await this.createTask(args as any);
          case "update_task":           return await this.updateTask(args as any);
          case "get_calendar_events":   return await this.getCalendarEvents(args as any);
          case "create_calendar_event": return await this.createCalendarEvent(args as any);
          case "get_notes":             return await this.getNotes(args as any);
          case "create_note":           return await this.createNote(args as any);
          case "get_note_content":      return await this.getNoteContent(args as any);
          case "get_emails":            return await this.getEmails(args as any);
          // Files
          case "list_files":            return await this.listFiles(args as any);
          case "get_file":              return await this.getFile(args as any);
          case "upload_file":           return await this.uploadFile(args as any);
          case "create_folder":         return await this.createFolder(args as any);
          case "move_file":             return await this.moveFile(args as any);
          // Deck
          case "get_deck_boards":       return await this.getDeckBoards();
          case "get_deck_board":        return await this.getDeckBoard(args as any);
          case "create_deck_card":      return await this.createDeckCard(args as any);
          case "update_deck_card":      return await this.updateDeckCard(args as any);
          case "move_deck_card":        return await this.moveDeckCard(args as any);
          default: throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }
    });

    return server;
  }

  private getTools(): Tool[] {
    return [
      {
        name: "get_task_lists",
        description:
          "Discover all task lists (CalDAV calendars that support VTODO) available for this user. " +
          "Returns each list's id (the CalDAV path segment) and display name. " +
          "Use the id as the listId parameter when calling get_tasks or create_task.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_tasks",
        description:
          "Retrieve tasks from Nextcloud. " +
          "If listId is omitted all VTODO-capable lists are queried and results are tagged with their source list. " +
          "Use get_task_lists first to see available list IDs.",
        inputSchema: {
          type: "object",
          properties: {
            listId: {
              type: "string",
              description: "CalDAV path segment of a specific list to query (e.g. 'personal'). Omit to query ALL lists.",
            },
            status: {
              type: "string",
              enum: ["all", "open", "completed"],
              description: "Filter tasks by status (default: all)",
              default: "all",
            },
            limit: {
              type: "number",
              description: "Maximum total number of tasks to return (default: 50)",
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
            summary: { type: "string", description: "Task title/summary" },
            description: { type: "string", description: "Task description (optional)" },
            due: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
            priority: { type: "number", description: "Priority 1-9 where 1 is highest (optional)" },
            listId: { type: "string", description: "List to create in (default: personal)", default: "personal" },
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
            taskId: { type: "string", description: "Task UID" },
            listId: { type: "string", description: "List the task lives in (required if not in personal list)" },
            summary: { type: "string", description: "New title (optional)" },
            status: { type: "string", enum: ["NEEDS-ACTION", "IN-PROCESS", "COMPLETED", "CANCELLED"], description: "New status (optional)" },
            percentComplete: { type: "number", description: "Completion 0-100 (optional)" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "get_calendar_events",
        description: "Retrieve calendar events from Nextcloud. Can specify date range.",
        inputSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Start date YYYY-MM-DD (defaults to today)" },
            endDate: { type: "string", description: "End date YYYY-MM-DD (defaults to 30 days from start)" },
            limit: { type: "number", description: "Max events to return", default: 50 },
          },
        },
      },
      {
        name: "create_calendar_event",
        description: "Create a new calendar event in Nextcloud",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Event title" },
            description: { type: "string", description: "Event description (optional)" },
            startDateTime: { type: "string", description: "Start YYYY-MM-DDTHH:mm:ss" },
            endDateTime: { type: "string", description: "End YYYY-MM-DDTHH:mm:ss" },
            location: { type: "string", description: "Event location (optional)" },
          },
          required: ["summary", "startDateTime", "endDateTime"],
        },
      },
      {
        name: "get_notes",
        description: "Retrieve all notes from Nextcloud Notes app",
        inputSchema: { type: "object", properties: { limit: { type: "number", default: 50 } } },
      },
      {
        name: "create_note",
        description: "Create a new note in Nextcloud Notes app",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            category: { type: "string" },
          },
          required: ["content"],
        },
      },
      {
        name: "get_note_content",
        description: "Get the full content of a specific note by ID",
        inputSchema: { type: "object", properties: { noteId: { type: "number" } }, required: ["noteId"] },
      },
      {
        name: "get_emails",
        description: "Retrieve emails from Nextcloud Mail app. Returns recent emails from inbox.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "number", default: 0 },
            limit: { type: "number", default: 20 },
          },
        },
      },
      // ---- Files ----
      {
        name: "list_files",
        description: "List files and folders in a Nextcloud directory. Returns name, type (file/folder), size, and last modified date for each item.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path relative to user root (e.g. '/' for home, 'Documents', 'Documents/Reports'). Defaults to root.",
              default: "/",
            },
          },
        },
      },
      {
        name: "get_file",
        description: "Download and return the content of a file from Nextcloud. Best suited for text files (markdown, txt, csv, json, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to user root (e.g. 'Documents/notes.md')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "upload_file",
        description: "Create or overwrite a file in Nextcloud with the given text content.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Destination path relative to user root (e.g. 'Documents/notes.md')",
            },
            content: {
              type: "string",
              description: "Text content to write to the file",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "create_folder",
        description: "Create a new folder in Nextcloud.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Folder path to create relative to user root (e.g. 'Projects/NewProject')",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "move_file",
        description: "Move or rename a file or folder in Nextcloud.",
        inputSchema: {
          type: "object",
          properties: {
            fromPath: {
              type: "string",
              description: "Current path of the file/folder relative to user root",
            },
            toPath: {
              type: "string",
              description: "New destination path relative to user root",
            },
          },
          required: ["fromPath", "toPath"],
        },
      },
      // ---- Deck ----
      {
        name: "get_deck_boards",
        description: "List all Nextcloud Deck boards the user has access to. Returns board IDs, titles, and colors.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_deck_board",
        description: "Get a Deck board with all its stacks (columns) and cards. Use get_deck_boards first to find the board ID.",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "number", description: "Board ID from get_deck_boards" },
          },
          required: ["boardId"],
        },
      },
      {
        name: "create_deck_card",
        description: "Create a new card in a Nextcloud Deck board stack (column). Use get_deck_board to find stack IDs.",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "number", description: "Board ID" },
            stackId: { type: "number", description: "Stack (column) ID to add the card to" },
            title: { type: "string", description: "Card title" },
            description: { type: "string", description: "Card description/notes (optional)" },
            dueDate: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          },
          required: ["boardId", "stackId", "title"],
        },
      },
      {
        name: "update_deck_card",
        description: "Update an existing Deck card's title, description, or due date.",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "number", description: "Board ID" },
            stackId: { type: "number", description: "Stack (column) ID the card currently belongs to" },
            cardId: { type: "number", description: "Card ID" },
            title: { type: "string", description: "New title (optional)" },
            description: { type: "string", description: "New description (optional)" },
            dueDate: { type: "string", description: "New due date YYYY-MM-DD, or null to clear (optional)" },
          },
          required: ["boardId", "stackId", "cardId"],
        },
      },
      {
        name: "move_deck_card",
        description: "Move a Deck card to a different stack (column), e.g. from 'To Do' to 'In Progress'.",
        inputSchema: {
          type: "object",
          properties: {
            boardId: { type: "number", description: "Board ID" },
            stackId: { type: "number", description: "Current stack (column) ID of the card" },
            cardId: { type: "number", description: "Card ID to move" },
            targetStackId: { type: "number", description: "Destination stack (column) ID" },
          },
          required: ["boardId", "stackId", "cardId", "targetStackId"],
        },
      },
    ];
  }

  // ========== TASK LIST DISCOVERY ==========

  private async discoverTaskLists(): Promise<TaskList[]> {
    const principalPath = `/remote.php/dav/calendars/${this.config.username}/`;

    const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <c:supported-calendar-component-set />
  </d:prop>
</d:propfind>`;

    const response = await this.axiosInstance.request({
      method: "PROPFIND",
      url: principalPath,
      data: requestBody,
      headers: { "Content-Type": "application/xml", Depth: "1" },
    });

    return this.parseTaskListsFromPropfind(response.data);
  }

  private parseTaskListsFromPropfind(xmlData: string): TaskList[] {
    const lists: TaskList[] = [];
    const responseMatches = xmlData.matchAll(/<d:response>([\s\S]*?)<\/d:response>/g);

    for (const match of responseMatches) {
      const block = match[1];
      if (!block.includes("VTODO")) continue;

      const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/);
      if (!hrefMatch) continue;
      const href = hrefMatch[1].trim();

      const segments = href.replace(/\/$/, "").split("/");
      const id = segments[segments.length - 1];
      if (!id || id === this.config.username) continue;

      const nameMatch = block.match(/<d:displayname>([^<]*)<\/d:displayname>/);
      const displayName = nameMatch ? nameMatch[1].trim() : id;

      lists.push({ id, displayName, url: href });
    }

    return lists;
  }

  private async getTaskLists() {
    try {
      const lists = await this.discoverTaskLists();
      return { content: [{ type: "text", text: JSON.stringify(lists, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to discover task lists: ${error.message}`);
    }
  }

  // ========== TASKS METHODS ==========

  private async getTasks(args: any) {
    const status = args.status || "all";
    const limit = args.limit || 50;
    const listId: string | undefined = args.listId;

    try {
      let lists: TaskList[];

      if (listId) {
        const path = `/remote.php/dav/calendars/${this.config.username}/${listId}/`;
        lists = [{ id: listId, displayName: listId, url: path }];
      } else {
        lists = await this.discoverTaskLists();
      }

      const allTasks: any[] = [];

      for (const list of lists) {
        if (allTasks.length >= limit) break;
        try {
          const tasks = await this.fetchTasksFromList(list, status, limit - allTasks.length);
          allTasks.push(...tasks);
        } catch (listError: any) {
          console.error(`[get_tasks] Skipping list "${list.id}": ${listError.message}`);
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(allTasks, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }
  }

  private async fetchTasksFromList(list: TaskList, status: string, limit: number): Promise<any[]> {
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
      url: list.url,
      data: requestBody,
      headers: { "Content-Type": "application/xml", Depth: "1" },
    });

    return this.parseTasksFromCalDAV(response.data, status, limit, list.id, list.displayName);
  }

  private parseTasksFromCalDAV(
    xmlData: string,
    status: string,
    limit: number,
    listId: string,
    listName: string
  ): any[] {
    const tasks: any[] = [];

    // Namespace-agnostic: matches calendar-data regardless of prefix (c:, cal:, x:, etc.)
    const todoMatches = xmlData.matchAll(
      /<[^:>\s]+:calendar-data[^>]*>([\s\S]*?)<\/[^:>\s]+:calendar-data>/g
    );

    for (const match of todoMatches) {
      if (tasks.length >= limit) break;

      const task = this.parseVTODO(match[1]);
      if (!task) continue;

      // Skip Deck board column headers — not real tasks
      if (task.uid && task.uid.startsWith("deck-stack-")) continue;

      task.listId = listId;
      task.listName = listName;

      if (status === "all") {
        tasks.push(task);
      } else if (status === "completed" && task.status === "COMPLETED") {
        tasks.push(task);
      } else if (status === "open" && task.status !== "COMPLETED") {
        tasks.push(task);
      }
    }

    return tasks;
  }

  private parseVTODO(todoData: string): any | null {
    const lines = todoData.split(/\r?\n/);
    const task: any = {};

    for (const line of lines) {
      if (line.startsWith("UID:"))                 task.uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY:"))        task.summary = line.substring(8).trim();
      else if (line.startsWith("STATUS:"))         task.status = line.substring(7).trim();
      else if (line.startsWith("PERCENT-COMPLETE:")) task.percentComplete = parseInt(line.substring(17).trim());
      else if (line.startsWith("DUE")) {
        const m = line.match(/DUE[^:]*:(\d{8}T?\d{6}Z?)/);
        if (m) task.due = this.parseICalDate(m[1]);
      }
      else if (line.startsWith("PRIORITY:"))      task.priority = parseInt(line.substring(9).trim());
      else if (line.startsWith("DESCRIPTION:"))   task.description = line.substring(12).trim();
      else if (line.startsWith("URL:"))            task.url = line.substring(4).trim().replace(/&amp;/g, '&');
    }

    return task.uid ? task : null;
  }

  private async createTask(args: any) {
    const { summary, description, due, priority } = args;
    const listId: string = args.listId || "personal";
    const uid = this.generateUID();

    let vtodo = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Nextcloud MCP Server//EN\nBEGIN:VTODO\nUID:${uid}\nSUMMARY:${summary}\nSTATUS:NEEDS-ACTION\nCREATED:${this.formatICalDateTime(new Date())}`;
    if (description) vtodo += `\nDESCRIPTION:${description}`;
    if (due)         vtodo += `\nDUE:${this.formatICalDate(new Date(due))}`;
    if (priority)    vtodo += `\nPRIORITY:${priority}`;
    vtodo += `\nEND:VTODO\nEND:VCALENDAR`;

    try {
      await this.axiosInstance.put(
        `/remote.php/dav/calendars/${this.config.username}/${listId}/${uid}.ics`,
        vtodo,
        { headers: { "Content-Type": "text/calendar" } }
      );
      return { content: [{ type: "text", text: `Task created in list "${listId}" with UID: ${uid}` }] };
    } catch (error: any) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  private async updateTask(args: any) {
    const { taskId, summary, status, percentComplete } = args;
    const listId: string = args.listId || "personal";
    const caldavPath = `/remote.php/dav/calendars/${this.config.username}/${listId}/${taskId}.ics`;

    try {
      const response = await this.axiosInstance.get(caldavPath);
      let vtodo = response.data;

      if (summary) vtodo = vtodo.replace(/SUMMARY:.*/, `SUMMARY:${summary}`);
      if (status) {
        vtodo = vtodo.includes("STATUS:")
          ? vtodo.replace(/STATUS:.*/, `STATUS:${status}`)
          : vtodo.replace(/END:VTODO/, `STATUS:${status}\nEND:VTODO`);
      }
      if (percentComplete !== undefined) {
        vtodo = vtodo.includes("PERCENT-COMPLETE:")
          ? vtodo.replace(/PERCENT-COMPLETE:.*/, `PERCENT-COMPLETE:${percentComplete}`)
          : vtodo.replace(/END:VTODO/, `PERCENT-COMPLETE:${percentComplete}\nEND:VTODO`);
      }

      const lastMod = `LAST-MODIFIED:${this.formatICalDateTime(new Date())}`;
      vtodo = vtodo.includes("LAST-MODIFIED:")
        ? vtodo.replace(/LAST-MODIFIED:.*/, lastMod)
        : vtodo.replace(/END:VTODO/, `${lastMod}\nEND:VTODO`);

      await this.axiosInstance.put(caldavPath, vtodo, { headers: { "Content-Type": "text/calendar" } });
      return { content: [{ type: "text", text: `Task ${taskId} in list "${listId}" updated successfully` }] };
    } catch (error: any) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  // ========== CALENDAR METHODS ==========

  private async getCalendarEvents(args: any) {
    const startDate = args.startDate || format(new Date(), "yyyy-MM-dd");
    const endDate = args.endDate || format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const limit = args.limit || 50;

    try {
      const requestBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop><d:getetag /><c:calendar-data /></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${this.formatICalDate(new Date(startDate))}" end="${this.formatICalDate(new Date(endDate))}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

      const response = await this.axiosInstance.request({
        method: "REPORT",
        url: `/remote.php/dav/calendars/${this.config.username}/personal/`,
        data: requestBody,
        headers: { "Content-Type": "application/xml", Depth: "1" },
      });

      const xml: string = response.data;
      const events: any[] = [];
      const eventMatches = xml.matchAll(/<[^:>\s]+:calendar-data[^>]*>([\s\S]*?)<\/[^:>\s]+:calendar-data>/g);
      for (const match of eventMatches) {
        if (events.length >= limit) break;
        const event = this.parseVEVENT(match[1]);
        if (event) events.push(event);
      }

      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch calendar events: ${error.message}`);
    }
  }

  private parseVEVENT(eventData: string): any | null {
    const lines = eventData.split(/\r?\n/);
    const event: any = {};

    for (const line of lines) {
      if (line.startsWith("UID:"))             event.uid = line.substring(4).trim();
      else if (line.startsWith("SUMMARY:"))    event.summary = line.substring(8).trim();
      else if (line.startsWith("DESCRIPTION:")) event.description = line.substring(12).trim();
      else if (line.startsWith("LOCATION:"))   event.location = line.substring(9).trim();
      else if (line.startsWith("DTSTART")) {
        const m = line.match(/DTSTART[^:]*:(\d{8}T?\d{6}Z?)/);
        if (m) event.start = this.parseICalDate(m[1]);
      }
      else if (line.startsWith("DTEND")) {
        const m = line.match(/DTEND[^:]*:(\d{8}T?\d{6}Z?)/);
        if (m) event.end = this.parseICalDate(m[1]);
      }
    }

    return event.uid ? event : null;
  }

  private async createCalendarEvent(args: any) {
    const { summary, description, startDateTime, endDateTime, location } = args;
    const uid = this.generateUID();

    let vevent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Nextcloud MCP Server//EN\nBEGIN:VEVENT\nUID:${uid}\nSUMMARY:${summary}\nDTSTART:${this.formatICalDateTime(new Date(startDateTime))}\nDTEND:${this.formatICalDateTime(new Date(endDateTime))}\nCREATED:${this.formatICalDateTime(new Date())}`;
    if (description) vevent += `\nDESCRIPTION:${description}`;
    if (location)    vevent += `\nLOCATION:${location}`;
    vevent += `\nEND:VEVENT\nEND:VCALENDAR`;

    try {
      await this.axiosInstance.put(
        `/remote.php/dav/calendars/${this.config.username}/personal/${uid}.ics`,
        vevent,
        { headers: { "Content-Type": "text/calendar" } }
      );
      return { content: [{ type: "text", text: `Calendar event created with UID: ${uid}` }] };
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
        { headers: { Accept: "application/json", "Content-Type": "application/json" } }
      );
      return { content: [{ type: "text", text: JSON.stringify(response.data.slice(0, limit), null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }
  }

  private async createNote(args: any) {
    const { title, content, category } = args;
    const noteContent = title ? `${title}\n\n${content}` : content;
    try {
      const payload: any = { content: noteContent };
      if (category) payload.category = category;
      const response = await this.axiosInstance.post(
        `/index.php/apps/notes/api/v1/notes`, payload,
        { headers: { Accept: "application/json", "Content-Type": "application/json" } }
      );
      return { content: [{ type: "text", text: `Note created with ID: ${response.data.id}` }] };
    } catch (error: any) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }

  private async getNoteContent(args: any) {
    const { noteId } = args;
    try {
      const response = await this.axiosInstance.get(
        `/index.php/apps/notes/api/v1/notes/${noteId}`,
        { headers: { Accept: "application/json", "Content-Type": "application/json" } }
      );
      return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch note: ${error.message}`);
    }
  }

  // ========== EMAIL METHODS ==========

  private async getEmails(args: any) {
    const accountId = args.accountId || 0;
    const limit = args.limit || 20;
    try {
      const mailboxesResponse = await this.axiosInstance.get(
        `/index.php/apps/mail/api/accounts/${accountId}/mailboxes`,
        { headers: { Accept: "application/json", "Content-Type": "application/json" } }
      );
      const inbox = mailboxesResponse.data.find((mb: any) => mb.specialRole === "inbox");
      if (!inbox) throw new Error("Inbox not found");
      const messagesResponse = await this.axiosInstance.get(
        `/index.php/apps/mail/api/messages?mailboxId=${inbox.id}`,
        { headers: { Accept: "application/json", "Content-Type": "application/json" } }
      );
      return { content: [{ type: "text", text: JSON.stringify(messagesResponse.data.slice(0, limit), null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  // ========== FILES METHODS ==========

  private filesPath(relativePath: string): string {
    const clean = relativePath.replace(/^\/+/, "");
    return `/remote.php/dav/files/${this.config.username}/${clean}`;
  }

  private async listFiles(args: any) {
    const path = args.path || "/";
    const davPath = this.filesPath(path);

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>`;

    try {
      const response = await this.axiosInstance.request({
        method: "PROPFIND",
        url: davPath,
        data: body,
        headers: { "Content-Type": "application/xml", Depth: "1" },
      });

      const items = this.parsePropfindFiles(response.data, davPath);
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to list files at "${path}": ${error.message}`);
    }
  }

  private parsePropfindFiles(xml: string, requestedPath: string): any[] {
    const items: any[] = [];
    const responseBlocks = xml.matchAll(/<d:response>([\s\S]*?)<\/d:response>/g);

    for (const match of responseBlocks) {
      const block = match[1];
      const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/);
      if (!hrefMatch) continue;

      const href = decodeURIComponent(hrefMatch[1].trim());
      // Skip the directory itself (the requested path is the first response)
      const normalizedRequest = requestedPath.replace(/\/$/, "");
      const normalizedHref = href.replace(/\/$/, "");
      if (normalizedHref === normalizedRequest) continue;

      const isFolder = block.includes("<d:collection");
      const nameMatch = block.match(/<d:displayname>([^<]*)<\/d:displayname>/);
      const sizeMatch = block.match(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/);
      const modifiedMatch = block.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/);
      const mimeMatch = block.match(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/);

      const segments = href.replace(/\/$/, "").split("/");
      const name = nameMatch ? nameMatch[1] : segments[segments.length - 1];

      items.push({
        name,
        type: isFolder ? "folder" : "file",
        ...(isFolder ? {} : { size: sizeMatch ? parseInt(sizeMatch[1]) : null }),
        ...(isFolder ? {} : { mimeType: mimeMatch ? mimeMatch[1] : null }),
        lastModified: modifiedMatch ? modifiedMatch[1] : null,
        path: href,
      });
    }

    return items;
  }

  private async getFile(args: any) {
    const { path } = args;
    try {
      const response = await this.axiosInstance.get(this.filesPath(path), {
        headers: { Accept: "*/*" },
        responseType: "text",
      });
      return { content: [{ type: "text", text: response.data }] };
    } catch (error: any) {
      throw new Error(`Failed to get file "${path}": ${error.message}`);
    }
  }

  private async uploadFile(args: any) {
    const { path, content } = args;
    try {
      await this.axiosInstance.put(this.filesPath(path), content, {
        headers: { "Content-Type": "text/plain" },
      });
      return { content: [{ type: "text", text: `File uploaded to "${path}"` }] };
    } catch (error: any) {
      throw new Error(`Failed to upload file "${path}": ${error.message}`);
    }
  }

  private async createFolder(args: any) {
    const { path } = args;
    try {
      await this.axiosInstance.request({
        method: "MKCOL",
        url: this.filesPath(path),
      });
      return { content: [{ type: "text", text: `Folder created at "${path}"` }] };
    } catch (error: any) {
      throw new Error(`Failed to create folder "${path}": ${error.message}`);
    }
  }

  private async moveFile(args: any) {
    const { fromPath, toPath } = args;
    const destination = `${this.config.url}${this.filesPath(toPath)}`;
    try {
      await this.axiosInstance.request({
        method: "MOVE",
        url: this.filesPath(fromPath),
        headers: { Destination: destination, Overwrite: "T" },
      });
      return { content: [{ type: "text", text: `Moved "${fromPath}" to "${toPath}"` }] };
    } catch (error: any) {
      throw new Error(`Failed to move "${fromPath}" to "${toPath}": ${error.message}`);
    }
  }

  // ========== DECK METHODS ==========

  private deckHeaders() {
    return { Accept: "application/json", "Content-Type": "application/json", "OCS-APIRequest": "true" };
  }

  private deckData(response: any): any {
    return response.data?.ocs?.data ?? response.data;
  }

  private async getDeckBoards() {
    try {
      const response = await this.axiosInstance.get(
        "/ocs/v2.php/apps/deck/api/v1.0/boards",
        { headers: this.deckHeaders() }
      );
      const boards = this.deckData(response).map((b: any) => ({
        id: b.id,
        title: b.title,
        color: b.color,
        archived: b.archived,
        stacksCount: b.stacks?.length ?? 0,
      }));
      return { content: [{ type: "text", text: JSON.stringify(boards, null, 2) }] };
    } catch (error: any) {
      throw new Error(`Failed to fetch Deck boards: ${error.message}`);
    }
  }

  private async getDeckBoard(args: any) {
    const { boardId } = args;
    try {
      const [boardResp, stacksResp] = await Promise.all([
        this.axiosInstance.get(`/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}`, { headers: this.deckHeaders() }),
        this.axiosInstance.get(`/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks`, { headers: this.deckHeaders() }),
      ]);

      const board = this.deckData(boardResp);
      const stacks = this.deckData(stacksResp).map((stack: any) => ({
        id: stack.id,
        title: stack.title,
        order: stack.order,
        cards: (stack.cards || []).map((card: any) => ({
          id: card.id,
          title: card.title,
          description: card.description || null,
          dueDate: card.duedate || null,
          archived: card.archived,
          order: card.order,
          assignees: (card.assignedUsers || []).map((u: any) => u.participant?.displayname || u.participant?.uid),
          labels: (card.labels || []).map((l: any) => l.title),
        })),
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ id: board.id, title: board.title, color: board.color, stacks }, null, 2),
        }],
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch Deck board ${boardId}: ${error.message}`);
    }
  }

  private async createDeckCard(args: any) {
    const { boardId, stackId, title, description, dueDate } = args;
    const payload: any = { title, type: "plain", order: 999 };
    if (description) payload.description = description;
    if (dueDate)     payload.duedate = `${dueDate}T00:00:00+00:00`;

    try {
      const response = await this.axiosInstance.post(
        `/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards`,
        payload,
        { headers: this.deckHeaders() }
      );
      const card = this.deckData(response);
      return { content: [{ type: "text", text: `Deck card created with ID: ${card.id} — "${card.title}"` }] };
    } catch (error: any) {
      throw new Error(`Failed to create Deck card: ${error.message}`);
    }
  }

  private async updateDeckCard(args: any) {
    const { boardId, stackId, cardId, title, description, dueDate } = args;

    // Fetch current card to preserve required fields
    try {
      const currentResp = await this.axiosInstance.get(
        `/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
        { headers: this.deckHeaders() }
      );
      const current = this.deckData(currentResp);

      const payload: any = {
        title: title ?? current.title,
        description: description ?? current.description,
        type: current.type || "plain",
        order: current.order ?? 0,
        duedate: dueDate !== undefined
          ? (dueDate ? `${dueDate}T00:00:00+00:00` : null)
          : current.duedate,
      };

      await this.axiosInstance.put(
        `/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
        payload,
        { headers: this.deckHeaders() }
      );
      return { content: [{ type: "text", text: `Deck card ${cardId} updated successfully` }] };
    } catch (error: any) {
      throw new Error(`Failed to update Deck card ${cardId}: ${error.message}`);
    }
  }

  private async moveDeckCard(args: any) {
    const { boardId, stackId, cardId, targetStackId } = args;

    try {
      const currentResp = await this.axiosInstance.get(
        `/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
        { headers: this.deckHeaders() }
      );
      const current = this.deckData(currentResp);

      const payload: any = {
        title: current.title,
        description: current.description,
        type: current.type || "plain",
        order: current.order ?? 0,
        duedate: current.duedate,
        stackId: targetStackId,
      };

      await this.axiosInstance.put(
        `/ocs/v2.php/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
        payload,
        { headers: this.deckHeaders() }
      );
      return { content: [{ type: "text", text: `Deck card ${cardId} moved to stack ${targetStackId}` }] };
    } catch (error: any) {
      throw new Error(`Failed to move Deck card ${cardId}: ${error.message}`);
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
    if (icalDate.includes("T")) {
      return `${icalDate.substring(0, 4)}-${icalDate.substring(4, 6)}-${icalDate.substring(6, 8)} ${icalDate.substring(9, 11)}:${icalDate.substring(11, 13)}`;
    }
    return `${icalDate.substring(0, 4)}-${icalDate.substring(4, 6)}-${icalDate.substring(6, 8)}`;
  }

  async run(): Promise<void> {
    const mode = process.env.MCP_TRANSPORT || "stdio";
    if (mode === "http") {
      await this.runHttp();
    } else {
      await this.runStdio();
    }
  }

  private async runStdio(): Promise<void> {
    const server = this.createMCPServer();
    process.on("SIGINT", async () => { await server.close(); process.exit(0); });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Nextcloud MCP Server running on stdio");
  }

  private async runHttp(): Promise<void> {
    const port = parseInt(process.env.MCP_PORT || "3000");
    const authToken = process.env.MCP_AUTH_TOKEN;

    const app = express();
    app.use(express.json());

    // Optional bearer token auth — skip for health check
    if (authToken) {
      app.use((req, res, next) => {
        if (req.path === "/health") return next();
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${authToken}`) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        next();
      });
    }

    app.get("/health", (_req, res) => {
      res.json({ status: "ok", name: "nextcloud-mcp-server", version: "1.3.0" });
    });

    // Track active SSE transports by session ID so POST messages can be routed
    const transports = new Map<string, SSEServerTransport>();

    app.get("/sse", async (_req, res) => {
      const server = this.createMCPServer();
      const transport = new SSEServerTransport("/messages", res);
      transports.set(transport.sessionId, transport);

      res.on("close", () => {
        transports.delete(transport.sessionId);
      });

      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handlePostMessage(req, res, req.body);
    });

    process.on("SIGINT", async () => {
      for (const t of transports.values()) await t.close();
      process.exit(0);
    });

    app.listen(port, () => {
      console.error(`Nextcloud MCP Server running on HTTP (SSE) — port ${port}`);
      if (authToken) console.error("Bearer token auth enabled");
    });
  }
}

const config: NextcloudConfig = {
  url: process.env.NEXTCLOUD_URL || "",
  username: process.env.NEXTCLOUD_USERNAME || "",
  password: process.env.NEXTCLOUD_PASSWORD || "",
};

if (!config.url || !config.username || !config.password) {
  console.error("Error: NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD environment variables are required");
  process.exit(1);
}

const server = new NextcloudMCPServer(config);
server.run().catch(console.error);
