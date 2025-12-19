import * as vscode from 'vscode';

export interface CodeTodoItem {
  file: vscode.Uri;
  range: vscode.Range;
  line: number;
  text: string;
  tag: string;
}

export interface CodeTodoFile {
  resourceUri: vscode.Uri;
  items: CodeTodoItem[];
}
