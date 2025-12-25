import * as moduleAlias from 'module-alias';
moduleAlias.addAlias('@', __dirname);

import * as vscode from 'vscode';
import { activate as activateLogic } from './activate';

export function activate(context: vscode.ExtensionContext) {
	activateLogic(context);
}

export function deactivate() {
	// Cleanup happens via context.subscriptions
}
