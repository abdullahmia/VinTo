import * as vscode from 'vscode';

export class TodoGroupItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly count: number,
        public readonly contextValue: string, // 'group-priority', 'group-date', etc.
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Expanded
    ) {
        super(label, collapsibleState);
        this.description = `(${count})`;
        this.tooltip = `${label} - ${count} items`;
        
        // Use a folder-like icon for groups
        this.iconPath = new vscode.ThemeIcon('list-tree');
    }
}
