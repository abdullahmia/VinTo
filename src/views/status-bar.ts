import * as vscode from 'vscode';
import { TodoStorageService, FocusSessionService } from '@/services';
import { TodoTreeProvider } from './todo-tree-provider';
import { COMMANDS } from '@/constants';

export class StatusBarManager {
    private todoStatusBarItem: vscode.StatusBarItem;
    private focusStatusBarItem: vscode.StatusBarItem;

    constructor(
        private context: vscode.ExtensionContext,
        private storage: TodoStorageService,
        private focusService: FocusSessionService,
        private todoProvider: TodoTreeProvider
    ) {
        // Status Bar Item for Todo Count
        this.todoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.todoStatusBarItem.command = COMMANDS.FOCUS_VIEW;
        context.subscriptions.push(this.todoStatusBarItem);

        // Status Bar Item for Active Focus Session
        this.focusStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
        this.focusStatusBarItem.command = COMMANDS.STOP_FOCUS_SESSION;
        context.subscriptions.push(this.focusStatusBarItem);

        // Initial update
        this.updateTodoStatusBar();
        this.updateFocusStatusBar();

        // Register listeners
        this.registerListeners();
    }

    private registerListeners() {
        // Update on changes
        this.todoProvider.onDidChangeTreeData(() => {
            this.updateTodoStatusBar();
        });

        // Listen to focus session updates
        this.focusService.onSessionUpdate(() => {
            this.updateFocusStatusBar();
        });
    }

    private updateTodoStatusBar() {
        const todos = this.storage.getTodos();
        const total = todos.length;
        const pending = todos.filter(t => !t.isCompleted).length;
        this.todoStatusBarItem.text = `$(checklist) ${total} todos (${pending} pending)`;
        this.todoStatusBarItem.tooltip = 'Click to show Personal Todo List';
        this.todoStatusBarItem.show();
    }

    private updateFocusStatusBar() {
        const activeSession = this.focusService.getActiveFocusSession();

        if (!activeSession) {
            this.focusStatusBarItem.hide();
            return;
        }

        // Get todo title
        const todos = this.storage.getTodos();
        const todo = todos.find(t => t.id === activeSession.todoId);
        const todoTitle = todo ? todo.title : 'Task';

        // Format remaining time
        const minutes = Math.floor(activeSession.remainingTime / 60000);
        const seconds = Math.floor((activeSession.remainingTime % 60000) / 1000);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        this.focusStatusBarItem.text = `$(watch) ${timeStr} - ${todoTitle}`;
        this.focusStatusBarItem.tooltip = 'Click to stop focus session';
        this.focusStatusBarItem.show();
    }
}
