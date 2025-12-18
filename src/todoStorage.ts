import * as vscode from 'vscode';
import { Todo } from './todo';

export class TodoStorage {
	private static readonly KEY = 'personal-todo-list.todos';

	constructor(private context: vscode.ExtensionContext) {}

	getTodos(): Todo[] {
		return this.context.globalState.get<Todo[]>(TodoStorage.KEY, []);
	}

	async saveTodos(todos: Todo[]): Promise<void> {
		await this.context.globalState.update(TodoStorage.KEY, todos);
	}

	async addTodo(todo: Todo): Promise<void> {
		const todos = this.getTodos();
		todos.push(todo);
		await this.saveTodos(todos);
	}

	async updateTodo(updatedTodo: Todo): Promise<void> {
		const todos = this.getTodos();
		const index = todos.findIndex(t => t.id === updatedTodo.id);
		if (index !== -1) {
			todos[index] = updatedTodo;
			await this.saveTodos(todos);
		}
	}

	async deleteTodo(id: string): Promise<void> {
		const todos = this.getTodos();
		const newTodos = todos.filter(t => t.id !== id);
		await this.saveTodos(newTodos);
	}
}
