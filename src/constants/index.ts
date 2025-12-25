export const COMMANDS = {
    HELLO_WORLD: 'personal-todo-list.helloWorld',
    ADD_TODO: 'personal-todo-list.addTodo',
    EDIT_TODO: 'personal-todo-list.editTodo',
    OPEN_TODO: 'personal-todo-list.openTodo',
    TOGGLE_TODO: 'personal-todo-list.toggleTodo',
    DELETE_TODO: 'personal-todo-list.deleteTodo',
    SET_PRIORITY_HIGH: 'personal-todo-list.setPriorityHigh',
    SET_PRIORITY_MEDIUM: 'personal-todo-list.setPriorityMedium',
    SET_PRIORITY_LOW: 'personal-todo-list.setPriorityLow',
    SET_DUE_DATE: 'personal-todo-list.setDueDate',
    DUPLICATE_TODO: 'personal-todo-list.duplicateTodo',
    CHANGE_VIEW_MODE: 'personal-todo-list.changeViewMode',
    FILTER_TODOS: 'personal-todo-list.filterTodos',
    SEARCH_TODOS: 'personal-todo-list.searchTodos',
    CLEAR_SEARCH: 'personal-todo-list.clearSearch',
    SETUP_PROFILE: 'personal-todo-list.setupProfile',
    VIEW_PROFILE: 'personal-todo-list.viewProfile',
    SHOW_PROFILE_OVERVIEW: 'personal-todo-list.showProfileOverview',
    REFRESH_CODE_TODOS: 'personal-todo-list.refreshCodeTodos',
    START_FOCUS_SESSION: 'personal-todo-list.startFocusSession',
    STOP_FOCUS_SESSION: 'personal-todo-list.stopFocusSession',
    VIEW_FOCUS_STATS: 'personal-todo-list.viewFocusStats',
    FOCUS_VIEW: 'personal-todo-list.focusView',
    OPEN_SETTINGS: 'vinto.openSettings',
    RESET_PROFILE: 'vinto.resetProfile'
} as const;

export const VIEWS = {
    TODO_LIST: 'personal-todo-list.todoView',
    CODE_TODOS: 'personal-todo-list.codeTodoView'
} as const;

export const CONFIG = {
    SHOW_PENDING_TASKS_ALERT: 'showPendingTasksAlert',
    CODE_TODOS: {
        TAGS: 'codeTodos.tags',
        INCLUDE: 'codeTodos.include',
        EXCLUDE: 'codeTodos.exclude'
    },
    FOCUS_SESSION: {
        DEFAULT_DURATION: 'focusSession.defaultDuration',
        SHOW_NOTIFICATIONS: 'focusSession.showNotifications'
    }
} as const;

export const NAMESPACE = 'personal-todo-list';
