export const SIDEBAR_DEFAULT_WIDTH = 384;
export const SIDEBAR_MIN_WIDTH = 240;
export const sidebarMaxWidth = () => window.innerWidth < 1024 ? 560 : Math.max(SIDEBAR_MIN_WIDTH, Math.min(560, Math.floor(window.innerWidth * 0.45)));
export const clampSidebarWidth = (width: number) => Math.max(SIDEBAR_MIN_WIDTH, Math.min(sidebarMaxWidth(), width));
