export const WINDOW_NAMES = {
    main: 'main',
    login: 'login',
}

export const WINDOW_LIST: { [key: string]: any } = {
    [WINDOW_NAMES.main]: {
        width: 1200,
        height: 800,
        titleBarStyle: 'hidden',
        // title: '主窗口',
        devPort: 11069,
    },
    [WINDOW_NAMES.login]: {
        width: 500,
        height: 400,
        titleBarStyle: 'hidden',
        // title: '登录窗口',
        devPort: 11070,
    },
}
