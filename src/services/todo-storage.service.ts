import { ITodo } from '@/models';
import * as vscode from 'vscode';

export class TodoStorageService {
	private static readonly KEY = 'personal-todo-list.todos';

	constructor(private context: vscode.ExtensionContext) {}

	getTodos(): ITodo[] {
		return this.context.globalState.get<ITodo[]>(TodoStorageService.KEY, []);
	}

	async saveTodos(todos: ITodo[]): Promise<void> {
		await this.context.globalState.update(TodoStorageService.KEY, todos);
	}

	async addTodo(todo: ITodo): Promise<void> {
		const todos = this.getTodos();
		todos.push(todo);
		await this.saveTodos(todos);
	}

	async updateTodo(updatedTodo: ITodo): Promise<void> {
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
