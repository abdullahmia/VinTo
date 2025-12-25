import * as vscode from 'vscode';
import * as commands from './commands';
import { ITodo, TodoPriority } from '@/models';
import { CodeTodoProvider, TodoItem, TodoTreeProvider } from '@/views';
import { TodoStorageService, UserProfileService, FocusSessionService } from '@/services';
import { COMMANDS, VIEWS } from '@/constants';
import { StatusBarManager } from '@/views/status-bar';
import { showPendingTasksAlert } from '@/utils/notifications';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "VinTo" is now active!');

    const storage = new TodoStorageService(context);
    const profileService = new UserProfileService(context);
    const focusService = new FocusSessionService(context);
    const todoProvider = new TodoTreeProvider(storage);
    const codeTodoProvider = new CodeTodoProvider(context.extensionUri);

    const treeView = vscode.window.createTreeView(VIEWS.TODO_LIST, {
        treeDataProvider: todoProvider
    });

    // Code TODOs View
    const codeTodoCodeView = vscode.window.createTreeView(VIEWS.CODE_TODOS, {
        treeDataProvider: codeTodoProvider
    });

    // Register CodeTodo watchers
    codeTodoProvider.registerWatchers(context);

    // Status Bar
    const statusBar = new StatusBarManager(context, storage, focusService, todoProvider);

    treeView.onDidChangeCheckboxState(e => {
        for (const [item, state] of e.items) {
            if (item instanceof TodoItem) {
                commands.toggleTodo(item, storage, todoProvider);
            }
        }
    });

    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.HELLO_WORLD, () => {
            vscode.window.showInformationMessage('Hello World from VinTo!');
        }),
        vscode.commands.registerCommand(COMMANDS.ADD_TODO, () => {
            commands.addTodo(context.extensionUri, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.EDIT_TODO, (item: TodoItem) => {
            commands.editTodo(context.extensionUri, item, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.OPEN_TODO, (todo: ITodo) => {
            commands.openTodo(context.extensionUri, todo, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.TOGGLE_TODO, (item: TodoItem) => {
            commands.toggleTodo(item, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.DELETE_TODO, (item: TodoItem) => {
            commands.deleteTodo(item, storage, todoProvider);
        }),

        vscode.commands.registerCommand(COMMANDS.SET_PRIORITY_HIGH, (item: TodoItem) => {
            commands.setPriority(item, storage, todoProvider, TodoPriority.High);
        }),
        vscode.commands.registerCommand(COMMANDS.SET_PRIORITY_MEDIUM, (item: TodoItem) => {
            commands.setPriority(item, storage, todoProvider, TodoPriority.Medium);
        }),
        vscode.commands.registerCommand(COMMANDS.SET_PRIORITY_LOW, (item: TodoItem) => {
            commands.setPriority(item, storage, todoProvider, TodoPriority.Low);
        }),
        vscode.commands.registerCommand(COMMANDS.SET_DUE_DATE, (item: TodoItem) => {
            commands.setDueDate(item, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.DUPLICATE_TODO, (item: TodoItem) => {
            commands.duplicateTodo(item, storage, todoProvider);
        }),

        vscode.commands.registerCommand(COMMANDS.CHANGE_VIEW_MODE, () => {
            commands.changeViewMode(todoProvider, treeView);
        }),
        vscode.commands.registerCommand(COMMANDS.FILTER_TODOS, () => {
            commands.filterTodos(todoProvider, treeView);
        }),
        vscode.commands.registerCommand(COMMANDS.SEARCH_TODOS, () => {
            commands.searchTodos(todoProvider, treeView);
        }),
        vscode.commands.registerCommand(COMMANDS.CLEAR_SEARCH, () => {
            commands.clearSearch(todoProvider, treeView);
        }),
        vscode.commands.registerCommand(COMMANDS.SETUP_PROFILE, () => {
            commands.setupProfile(context.extensionUri, profileService);
        }),
        vscode.commands.registerCommand(COMMANDS.VIEW_PROFILE, () => {
            commands.viewProfile(context.extensionUri, profileService, storage);
        }),

        vscode.commands.registerCommand(COMMANDS.SHOW_PROFILE_OVERVIEW, () => {
            commands.showProfileOverview(context.extensionUri, profileService, storage);
        }),
        vscode.commands.registerCommand(COMMANDS.REFRESH_CODE_TODOS, () => {
            codeTodoProvider.refresh();
        }),

        // Focus Session Commands
        vscode.commands.registerCommand(COMMANDS.START_FOCUS_SESSION, (item: TodoItem) => {
            commands.startFocusSession(item, focusService, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.STOP_FOCUS_SESSION, () => {
            commands.stopFocusSession(focusService, storage, todoProvider);
        }),
        vscode.commands.registerCommand(COMMANDS.VIEW_FOCUS_STATS, (item: TodoItem) => {
            commands.viewFocusStats(context.extensionUri, item, focusService, storage);
        }),

        // Register focus view command (called by status bar)
        vscode.commands.registerCommand(COMMANDS.FOCUS_VIEW, () => {
            treeView.reveal(treeView.selection[0] || undefined, { focus: true });
        })
    );

    // Check for first-time setup
    if (!profileService.hasProfile()) {
        setTimeout(() => {
            commands.setupProfile(context.extensionUri, profileService);
        }, 500);
    }

    setTimeout(() => {
        showPendingTasksAlert(storage, treeView);
    }, 1000);
}
