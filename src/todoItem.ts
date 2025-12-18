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
		
		let desc = new Date(todo.createdAt).toLocaleDateString();
		if (todo.dueDate) {
			desc += ` (Due: ${new Date(todo.dueDate).toLocaleDateString()})`;
		}
		this.description = desc;

		this.iconPath = this.getPriorityIcon(todo.priority);
		
		if (todo.isCompleted) {
			this.checkboxState = vscode.TreeItemCheckboxState.Checked;
			this.contextValue = 'todo-completed';
		} else {
			this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
			this.contextValue = 'todo-active';
		}

		this.command = {
			command: 'personal-todo-list.openTodo',
			title: 'Open Todo',
			arguments: [todo]
		};
	}

	private getPriorityIcon(priority: TodoPriority): vscode.ThemeIcon {
		switch (priority) {
			case TodoPriority.High:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.red'));
			case TodoPriority.Medium:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
			case TodoPriority.Low:
				return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
			default:
				return new vscode.ThemeIcon('circle-outline');
		}
	}
}
