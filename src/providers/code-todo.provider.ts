import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CodeTodoFile, CodeTodoItem } from '../models/code-todo.model';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.mp3', '.mp4', '.wav', '.mov', '.avi',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
]);

const NON_HUMAN_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'package.json', '.eslintrc.json', '.eslintrc.js', '.prettierrc',
  'LICENSE', 'CHANGELOG.md'
]);

export class CodeTodoProvider implements vscode.TreeDataProvider<CodeTodoFile | CodeTodoItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CodeTodoFile | CodeTodoItem | undefined | null | void> = new vscode.EventEmitter<CodeTodoFile | CodeTodoItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CodeTodoFile | CodeTodoItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private todos: CodeTodoFile[] = [];
  private isLoading: boolean = false;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (this.isLoading) {
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Scanning codebase for TODOs...",
      cancellable: false
    }, async (progress) => {
      this.isLoading = true;
      this._onDidChangeTreeData.fire();
      
      try {
        await this.scanWorkspace();
      } finally {
        this.isLoading = false;
        this._onDidChangeTreeData.fire();
      }
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
      if (element?.tag?.toUpperCase() === 'FIXME' || element?.tag?.toUpperCase() === 'BUG') {
        treeItem.iconPath = new vscode.ThemeIcon('bug');
      } else if (element?.tag?.toUpperCase() === 'HACK') {
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

  getChildren(element?: CodeTodoFile | CodeTodoItem): vscode.ProviderResult<any[]> {
    if (this.isLoading && !element) {
      return [{ label: 'Scanning codebase...', isLoading: true }];
    }

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
    const rawTags = config.get<string[]>('tags', ['TODO', 'FIXME', 'BUG', 'HACK', 'XXX']);
    const tags = rawTags.filter(t => t && typeof t === 'string' && t.trim().length > 0);
    
    if (tags.length === 0) {
      this.todos = [];
      return;
    }

    const include = config.get<string>('include', '**/*');
    const exclude = config.get<string>('exclude', '{**/node_modules/**,**/dist/**,**/out/**,**/.git/**,**/build/**,**/.vscode/**}');
    
    // Read .gitignore
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const gitignoreRegexes: RegExp[] = [];
    
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const gitignorePath = path.join(folder.uri.fsPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          try {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            const patterns = content.split(/\r?\n/)
              .map(line => line.trim())
              .filter(line => line && !line.startsWith('#'));
            
            for (const pattern of patterns) {
              let regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
              
              if (pattern.endsWith('/')) {
                regexPattern = regexPattern + '.*';
              }
              gitignoreRegexes.push(new RegExp(`(^|/|\\\\)${regexPattern}($|/|\\\\)`, 'i'));
            }
          } catch (e) {
            console.error(`Error reading .gitignore: ${e}`);
          }
        }
      }
    }

    const shouldIgnore = (uri: vscode.Uri) => {
      const fsPath = uri.fsPath;
      const fileName = path.basename(fsPath);
      const ext = path.extname(fsPath).toLowerCase();

      if (BINARY_EXTENSIONS.has(ext)) return true;
      if (NON_HUMAN_FILES.has(fileName)) return true;

      const relativePath = workspaceFolders ? path.relative(workspaceFolders[0].uri.fsPath, fsPath) : fsPath;
      for (const regex of gitignoreRegexes) {
        if (regex.test(relativePath) || regex.test(fsPath)) {
          return true;
        }
      }
      return false;
    };
    
    const tagPattern = tags.join('|');
    const regex = new RegExp(`(//|#|<!--|/\\*)\\s*(${tagPattern})[:\\s]*(.*)`, 'i');
    const todoMap = new Map<string, CodeTodoFile>();

    const files = await vscode.workspace.findFiles(include, exclude);
    
    // Parallel processing with concurrency limit
    const CONCURRENCY_LIMIT = 20;
    for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
      const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(async (fileUri) => {
        if (shouldIgnore(fileUri)) {
          return;
        }

        try {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const items: CodeTodoItem[] = [];

          for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
            const line = doc.lineAt(lineIndex);
            const match = regex.exec(line.text);
            
            if (match && match[2] && match[3] !== undefined) {
              items.push({
                file: fileUri,
                range: line.range,
                line: lineIndex + 1,
                text: (match[3] || '').trim(),
                tag: match[2].toUpperCase()
              });
            }
          }

          if (items.length > 0) {
            todoMap.set(fileUri.toString(), {
              resourceUri: fileUri,
              items: items
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (!errorMessage.includes('File seems to be binary')) {
            console.error(`Error reading file ${fileUri.fsPath}:`, err);
          }
        }
      }));
    }

    this.todos = Array.from(todoMap.values()).sort((a, b) => {
      return path.basename(a.resourceUri.fsPath).localeCompare(path.basename(b.resourceUri.fsPath));
    });
  }
}
