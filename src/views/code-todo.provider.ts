import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CodeTodoFile, CodeTodoItem } from '@/models/code-todo.model';

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

  private todoMap: Map<string, CodeTodoFile> = new Map();
  private isLoading: boolean = false;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
    this.refresh();
  }

  get todos(): CodeTodoFile[] {
    return Array.from(this.todoMap.values()).sort((a, b) => {
      return path.basename(a.resourceUri.fsPath).localeCompare(path.basename(b.resourceUri.fsPath));
    });
  }

  refresh(uri?: vscode.Uri, silent: boolean = false): void {
    if (this.isLoading) {
      return;
    }

    if (uri) {
      // Incremental update (always silent)
      this.scanFile(uri).then(() => {
        this._onDidChangeTreeData.fire();
      });
      return;
    }

    // Full scan
    if (silent) {
      this.isLoading = true;
      this.scanWorkspace().finally(() => {
        this.isLoading = false;
        this._onDidChangeTreeData.fire();
      });
    } else {
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
  }

  getTreeItem(element: CodeTodoFile | CodeTodoItem): vscode.TreeItem {
    if ('resourceUri' in element) {
      // It's a file
      const treeItem = new vscode.TreeItem(element.resourceUri, vscode.TreeItemCollapsibleState.Expanded);
      treeItem.contextValue = 'codeTodoFile';
      treeItem.description = `(${element.items.length})`;
      treeItem.iconPath = this.getFileIcon(element.resourceUri);
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
      const sortedTodos = this.todos;
      if (sortedTodos.length === 0) {
        return [];
      }
      return sortedTodos;
    } else if ('resourceUri' in element) {
      // File: return items
      return element.items;
    }
    return [];
  }

  private getFileIcon(uri: vscode.Uri): vscode.Uri {
    const ext = path.extname(uri.fsPath).toLowerCase().replace('.', '');
    const fileName = path.basename(uri.fsPath).toLowerCase();

    // Mapping for common files/extensions to icon names
    const extensionMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'reactts',
      'js': 'js',
      'jsx': 'reactjs',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'html': 'html',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'sql': 'sql',
      'svg': 'svg',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'pdf': 'pdf',
      'zip': 'zip',
      'tar': 'zip',
      'gz': 'zip',
      'mp3': 'audio',
      'wav': 'audio',
      'mp4': 'video',
      'mov': 'video'
    };

    // Specific file name checks
    if (fileName === 'package.json') return this.getIconUri('file_type_npm.svg');
    if (fileName === 'tsconfig.json') return this.getIconUri('file_type_tsconfig.svg');
    if (fileName === 'package-lock.json') return this.getIconUri('file_type_npm.svg');
    if (fileName === 'yarn.lock') return this.getIconUri('file_type_yarn.svg');
    if (fileName === '.gitignore') return this.getIconUri('file_type_git.svg');
    if (fileName === 'license') return this.getIconUri('file_type_license.svg');

    const iconName = extensionMap[ext] || ext;
    const iconFileName = `file_type_${iconName}.svg`;

    const fullPath = path.join(this.extensionUri.fsPath, 'assets', 'icons', iconFileName);
    if (fs.existsSync(fullPath)) {
      return vscode.Uri.file(fullPath);
    }

    return this.getIconUri('default_file.svg');
  }

  private getIconUri(iconName: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.extensionUri.fsPath, 'assets', 'icons', iconName));
  }

  private getRegex(): RegExp {
    const config = vscode.workspace.getConfiguration('personal-todo-list.codeTodos');
    const rawTags = config.get<string[]>('tags', ['TODO', 'FIXME', 'BUG', 'HACK', 'XXX']);
    const tags = rawTags.filter(t => t && typeof t === 'string' && t.trim().length > 0);
    const tagPattern = tags.length > 0 ? tags.join('|') : 'TODO|FIXME';
    return new RegExp(`(//|#|<!--|/\\*|\\*)\\s*(${tagPattern})[:\\s]*(.*)`, 'i');
  }

  private async getIgnoreRegexes(): Promise<RegExp[]> {
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
    return gitignoreRegexes;
  }

  private async shouldIgnore(uri: vscode.Uri, ignoreRegexes?: RegExp[]): Promise<boolean> {
    const fsPath = uri.fsPath;
    const fileName = path.basename(fsPath);
    const ext = path.extname(fsPath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) return true;
    if (NON_HUMAN_FILES.has(fileName)) return true;

    const regexes = ignoreRegexes || await this.getIgnoreRegexes();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const relativePath = workspaceFolders ? path.relative(workspaceFolders[0].uri.fsPath, fsPath) : fsPath;

    for (const regex of regexes) {
      if (regex.test(relativePath) || regex.test(fsPath)) {
        return true;
      }
    }
    return false;
  }

  private async scanFile(uri: vscode.Uri): Promise<void> {
    if (await this.shouldIgnore(uri)) {
      this.todoMap.delete(uri.toString());
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const regex = this.getRegex();
      const items: CodeTodoItem[] = [];

      for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
        const line = doc.lineAt(lineIndex);
        const match = regex.exec(line.text);

        if (match && match[2] && match[3] !== undefined) {
          items.push({
            file: uri,
            range: line.range,
            line: lineIndex + 1,
            text: (match[3] || '').trim(),
            tag: match[2].toUpperCase()
          });
        }
      }

      if (items.length > 0) {
        this.todoMap.set(uri.toString(), {
          resourceUri: uri,
          items: items
        });
      } else {
        this.todoMap.delete(uri.toString());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes('File seems to be binary')) {
        console.error(`Error reading file ${uri.fsPath}:`, err);
      }
      this.todoMap.delete(uri.toString());
    }
  }

  private async scanWorkspace(): Promise<void> {
    const config = vscode.workspace.getConfiguration('personal-todo-list.codeTodos');
    const include = config.get<string>('include', '**/*');
    const exclude = config.get<string>('exclude', '{**/node_modules/**,**/dist/**,**/out/**,**/.git/**,**/build/**,**/.vscode/**,**/package-lock.json,**/yarn.lock,**/pnpm-lock.yaml}');

    const ignoreRegexes = await this.getIgnoreRegexes();
    const regex = this.getRegex();

    const files = await vscode.workspace.findFiles(include, exclude);
    const newTodoMap = new Map<string, CodeTodoFile>();

    const CONCURRENCY_LIMIT = 20;
    for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
      const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(async (fileUri) => {
        if (await this.shouldIgnore(fileUri, ignoreRegexes)) {
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
            newTodoMap.set(fileUri.toString(), {
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

    this.todoMap = newTodoMap;
  }
  registerWatchers(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.refresh(doc.uri, true);
      })
    );

    const scanInterval = setInterval(() => {
      this.refresh(undefined, true);
    }, 30 * 60 * 1000);

    context.subscriptions.push({
      dispose: () => clearInterval(scanInterval)
    });
  }
}

