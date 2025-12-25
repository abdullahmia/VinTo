import * as vscode from 'vscode';
import { TodoStorageService } from '@/services';
import { TodoItem } from '@/views/items/todo-item';
import { TodoGroupItem } from '@/views/items/todo-group-item';
import { CONFIG } from '@/constants';

export function showPendingTasksAlert(storage: TodoStorageService, treeView: vscode.TreeView<TodoItem | TodoGroupItem>) {
    // Check if setting is enabled
    const config = vscode.workspace.getConfiguration('personal-todo-list');
    const showAlert = config.get<boolean>(CONFIG.SHOW_PENDING_TASKS_ALERT, true);

    if (!showAlert) {
        return;
    }

    // Count pending tasks
    const todos = storage.getTodos();
    const pendingCount = todos.filter(t => !t.isCompleted).length;

    if (pendingCount === 0) {
        return;
    }

    // Show notification
    const message = pendingCount === 1
        ? 'You have 1 pending task'
        : `You have ${pendingCount} pending tasks`;

    vscode.window.showInformationMessage(
        message,
        'View Todos',
        'Dismiss',
        "Don't Show Again"
    ).then(selection => {
        if (selection === 'View Todos') {
            treeView.reveal(treeView.selection[0] || undefined, { focus: true });
        } else if (selection === "Don't Show Again") {
            config.update(CONFIG.SHOW_PENDING_TASKS_ALERT, false, vscode.ConfigurationTarget.Global);
        }
    });
}
