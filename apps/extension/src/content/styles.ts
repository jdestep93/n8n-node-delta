export const contentStyles = `
:host { all: initial; color-scheme: light dark; }
*, *::before, *::after { box-sizing: border-box; }
.nodedelta { color: #171717; font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.launcher { all: unset; background: #171717; border: 1px solid #404040; border-radius: 999px; box-shadow: 0 8px 28px rgb(0 0 0 / 25%); color: #fafafa; cursor: pointer; font: 600 13px/1.2 system-ui, sans-serif; padding: 12px 16px; position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; }
.launcher:focus-visible, .close:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
.panel { background: #fff; border: 1px solid #d4d4d4; border-radius: 14px; box-shadow: 0 18px 60px rgb(0 0 0 / 25%); color: #171717; padding: 18px; position: fixed; right: 20px; bottom: 76px; width: min(360px, calc(100vw - 40px)); z-index: 2147483000; }
.panel-header { align-items: center; display: flex; gap: 12px; justify-content: space-between; }
.panel h2 { font: 700 18px/1.2 system-ui, sans-serif; margin: 0; }
.panel p { margin: 12px 0 0; }
.privacy { color: #525252; font-size: 12px; }
.close { all: unset; border-radius: 6px; color: #525252; cursor: pointer; font: 600 13px/1 system-ui, sans-serif; padding: 7px; }
@media (prefers-color-scheme: dark) {
  .panel { background: #171717; border-color: #404040; color: #fafafa; }
  .privacy, .close { color: #d4d4d4; }
}
`;
