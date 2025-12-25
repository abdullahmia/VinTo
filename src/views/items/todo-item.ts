import { ITodo, TodoPriority, ITodoStatus } from '@/models';
import * as vscode from 'vscode';

export class TodoItem extends vscode.TreeItem {
	constructor(
		public readonly todo: ITodo,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		private readonly statusConfig?: ITodoStatus
	) {
		super(todo.title, collapsibleState);

		this.id = todo.id;
		this.tooltip = this.getTooltip();
		this.description = this.getDescription();

		const isCompleted = this.statusConfig?.type === 'completed';
		this.checkboxState = isCompleted ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;

		// Set context value for menus
		// Format: todo-item-<statusType>-<priority>
		this.contextValue = `todo-item-${isCompleted ? 'completed' : 'incomplete'}`;

		this.iconPath = this.getIcon();

		// Strikethrough for completed
		if (isCompleted) {
			this.resourceUri = vscode.Uri.parse(`todo:${this.label}`);
		}

		this.command = {
			command: 'personal-todo-list.openTodo',
			title: 'Open Todo',
			arguments: [this.todo]
		};
	}

	private getTooltip(): string {
		const cleanDescription = this.todo.description ? this.todo.description.replace(/<[^>]*>?/gm, '') : '';
		const statusLabel = this.statusConfig ? this.statusConfig.label : 'Unknown';
		const parts = [
			`Status: ${statusLabel}`,
			`Priority: ${this.todo.priority}`,
			cleanDescription ? `\n${cleanDescription}` : '',
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

			const isCompleted = this.statusConfig?.type === 'completed';

			if (this.todo.dueDate < Date.now() && !isCompleted) {
				return 'Overdue';
			}
			return isToday ? 'Today' : date.toLocaleDateString();
		}
		return '';
	}

	private getIcon(): vscode.ThemeIcon {
		if (this.statusConfig?.type === 'completed') {
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
