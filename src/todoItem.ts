import * as vscode from 'vscode';
import { Todo, TodoPriority } from './todo';

export class TodoItem extends vscode.TreeItem {
	constructor(
		public readonly todo: Todo,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(todo.title, collapsibleState);
		
		this.id = todo.id;
		this.tooltip = `${todo.title} - ${todo.priority}`;
		
		this.tooltip = this.getTooltip();
		this.description = this.getDescription();
		
		this.checkboxState = todo.isCompleted ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
		
		// Set context value for menus
		// Format: todo-item-<status>-<priority>
		this.contextValue = `todo-item-${todo.isCompleted ? 'completed' : 'incomplete'}`;
		
		this.iconPath = this.getIcon();
		
		// Strikethrough for completed
		if (todo.isCompleted) {
			this.resourceUri = vscode.Uri.parse(`todo:${this.label}`); // Hack to trigger decoration if needed, but mainly relying on icon
		}
	}

	private getTooltip(): string {
		const parts = [
			`Status: ${this.todo.isCompleted ? 'Completed' : 'Pending'}`,
			`Priority: ${this.todo.priority}`,
			this.todo.description ? `\n${this.todo.description}` : '',
			this.todo.dueDate ? `\nDue: ${new Date(this.todo.dueDate).toLocaleDateString()}` : ''
		];
		return parts.filter(Boolean).join('\n');
	}

	private getDescription(): string {
		if (this.todo.dueDate) {
			const date = new Date(this.todo.dueDate);
			const today = new Date();
			const isToday = date.getDate() === today.getDate() && 
						  date.getMonth() === today.getMonth() && 
						  date.getFullYear() === today.getFullYear();
						  
			if (this.todo.dueDate < Date.now() && !this.todo.isCompleted) {
				return 'Overdue';
			}
			return isToday ? 'Today' : date.toLocaleDateString();
		}
		return '';
	}

	private getIcon(): vscode.ThemeIcon {
		if (this.todo.isCompleted) {
			return new vscode.ThemeIcon('check', new vscode.ThemeColor('gitDecoration.ignoredResourceForeground'));
		}
		
		switch (this.todo.priority) {
			case TodoPriority.High:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.red'));
			case TodoPriority.Medium:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
			case TodoPriority.Low:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
			default:
				return new vscode.ThemeIcon('circle-outline');
		}
	}
}
