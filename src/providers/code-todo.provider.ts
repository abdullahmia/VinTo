import * as path from 'path';
import * as vscode from 'vscode';
import { CodeTodoFile, CodeTodoItem } from '../models/code-todo.model';

export class CodeTodoProvider implements vscode.TreeDataProvider<CodeTodoFile | CodeTodoItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CodeTodoFile | CodeTodoItem | undefined | null | void> = new vscode.EventEmitter<CodeTodoFile | CodeTodoItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CodeTodoFile | CodeTodoItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private todos: CodeTodoFile[] = [];

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.scanWorkspace().then(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  getTreeItem(element: CodeTodoFile | CodeTodoItem): vscode.TreeItem {
    if ('resourceUri' in element) {
      // It's a file
      const treeItem = new vscode.TreeItem(element.resourceUri, vscode.TreeItemCollapsibleState.Expanded);
      treeItem.contextValue = 'codeTodoFile';
      treeItem.description = `(${element.items.length})`;
      return treeItem;
    } else {
      // It's a todo item
      const treeItem = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);
      treeItem.contextValue = 'codeTodoItem';
      
      // Icon based on tag
      if (element.tag.toUpperCase() === 'FIXME' || element.tag.toUpperCase() === 'BUG') {
        treeItem.iconPath = new vscode.ThemeIcon('bug');
      } else if (element.tag.toUpperCase() === 'HACK') {
        treeItem.iconPath = new vscode.ThemeIcon('tools');
      } else {
        treeItem.iconPath = new vscode.ThemeIcon('checklist');
      }

      treeItem.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [
          element.file,
          {
            selection: element.range
          }
        ]
      };
      
      treeItem.tooltip = `${element.tag} at Line ${element.line}: ${element.text}`;
      return treeItem;
    }
  }

  getChildren(element?: CodeTodoFile | CodeTodoItem): vscode.ProviderResult<CodeTodoFile[] | CodeTodoItem[]> {
    if (!element) {
      // Root: return files
      if (this.todos.length === 0) {
        return [];
      }
      return this.todos;
    } else if ('resourceUri' in element) {
      // File: return items
      return element.items;
    }
    return [];
  }

  private async scanWorkspace(): Promise<void> {
    const config = vscode.workspace.getConfiguration('personal-todo-list.codeTodos');
    const tags = config.get<string[]>('tags', ['TODO', 'FIXME', 'BUG', 'HACK', 'XXX']);
    const include = config.get<string>('include', '**/*');
    const exclude = config.get<string>('exclude', '{**/node_modules/**,**/dist/**,**/out/**,**/.git/**}');
    
    // Construct regex
    const tagPattern = tags.join('|');
    // Regex explanation:
    // (//|#|<!--|/\*)  -> Match comment start (simplified)
    // We want to be lenient. Let's match the TAG followed by colon or space
    // But we should ensure it looks like a comment.
    // However, languages define comments differently. 
    // The user requested scanning for patterns like "// TODO", "# TODO".
    // A broader regex that catches the Tag in a comment-like structure:
    // We will look for the tag, and ensure it's preceded by comment markers if possible.
    // Or simpler: Just look for the tag and assume if it's in code it's a comment? 
    // No, matching "TODO" in a string "print('TODO')" is bad.
    // But perfect parsing without language support is hard.
    // Let's stick to the patterns the user requested:
    // //, #, <!--, /*
    
    const regex = new RegExp(`(//|#|<!--|/\\*)\\s*(${tagPattern})[:\\s]*(.*)`, 'i');

    const todoMap = new Map<string, CodeTodoFile>();

    const files = await vscode.workspace.findFiles(include, exclude);

    for (const fileUri of files) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const fileEntry: CodeTodoFile = {
            resourceUri: fileUri,
            items: []
        };

        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i);
            const match = regex.exec(line.text);
            
            if (match) {
                const tag = match[2];
                const text = match[3].trim();
                
                fileEntry.items.push({
                    file: fileUri,
                    range: line.range,
                    line: i + 1,
                    text: text,
                    tag: tag.toUpperCase()
                });
            }
        }

        if (fileEntry.items.length > 0) {
            todoMap.set(fileUri.toString(), fileEntry);
        }

      } catch (err) {
        console.error(`Error reading file ${fileUri.fsPath}:`, err);
      }
    }

    this.todos = Array.from(todoMap.values()).sort((a, b) => {
      return path.basename(a.resourceUri.fsPath).localeCompare(path.basename(b.resourceUri.fsPath));
    });
  }
}
