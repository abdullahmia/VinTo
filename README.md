# Personal Todo List

A personalized todo list manager for VS Code that keeps you organized without leaving your editor. Features priority management, due dates, filtering, and status bar integration.

## Features

- **Todo Management**: Add, edit, delete, and complete todos directly from the VS Code Explorer sidebar.
- **Priority Levels**: Assign High, Medium, or Low priority to your tasks.
- **Due Dates**: Set due dates for your tasks.
- **Filtering**:
    - **By Priority**: Filter tasks to focus on High, Medium, or Low priority items.
    - **By Date**: See what's Due Today, This Week, or Overdue.
    - **Combined Filtering**: Filters work together (e.g., "High Priority" AND "Due Today").
- **Status Bar Integration**:
    - View total and pending todo counts at a glance (`📝 5 todos (2 pending)`).
    - Click the status bar item to instantly focus the Todo List view.
- **Data Persistence**: Your todos are saved automatically within VS Code's global state.

## Usage

### Managing Todos
1. Open the **Explorer** view in VS Code.
2. Locate the **Personal Todo List** section.
3. Click the **+** (Add) icon in the view title to create a new todo.
4. Right-click any item to **Edit** or **Delete** it.
5. Click the checkbox (or toggle command) to mark an item as complete.

### Filtering
- Click the **Filter (Funnel)** icon to filter by **Priority**.
- Click the **Calendar** icon to filter by **Date** (Today, Week, Overdue, Custom).
- Select **All** in either menu to clear that filter.

## Extension Commands

| Command | Description |
| --- | --- |
| `Todo: Add New Todo` | Create a new todo item with title, description, priority, and due date. |
| `Edit` | Edit an existing todo item. |
| `Delete` | Permanently remove a todo item (requires confirmation). |
| `Toggle Completion` | Mark a todo as completed or incomplete. |
| `Filter by Priority` | Filter the list by High, Medium, or Low priority. |
| `Filter by Date` | Filter the list by date range (Today, Week, Overdue, Custom). |

## Development

### Prerequisites
- [Node.js](https://nodejs.org/) installed.
- [VS Code](https://code.visualstudio.com/) installed.5

### Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Press `F5` to start debugging. This opens a new VS Code window with the extension loaded.

### Testing
- Run `npm run test` to execute the test suite.

## Release Notes

### 0.0.1
- Initial release with core features: CRUD operations, priority/date filtering, and status bar counter.

---
**Enjoy staying organized!**
