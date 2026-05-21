import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";

export function createHtmlBeautifyTemplate(input: { target: "statusbar" | "global" | "both"; theme: "minimal" | "dark" | "light" | "custom" }): { html: HtmlBeautifyConfig; rules: string[] } {
  const statusbarEnabled = input.target === "statusbar" || input.target === "both";
  const globalEnabled = input.target === "global" || input.target === "both";
  return {
    html: {
      enabled: true,
      target: input.target,
      theme: input.theme,
      statusbar: {
        enabled: statusbarEnabled,
        html: statusbarEnabled ? statusbarHtml(input.theme) : "",
        hide_regex: true,
      },
      global: {
        enabled: globalEnabled,
        regex_scripts: globalEnabled ? [globalLineBreakRegex()] : [],
      },
    },
    rules: [
      "状态栏 HTML 不要包含 <script>",
      "CSS 使用 .wbm-statusbar 作用域，避免污染全局",
      "状态栏通常配合 MVU 和 <StatusPlaceHolderImpl/> 使用",
      "全局美化 regex 必须确认不会破坏宏和代码块",
    ],
  };
}

function statusbarHtml(theme: string): string {
  const palette = theme === "dark"
    ? { bg: "#171717", fg: "#f5f5f5", border: "#3f3f46" }
    : theme === "light"
      ? { bg: "#ffffff", fg: "#27272a", border: "#d4d4d8" }
      : { bg: "rgba(24,24,27,.82)", fg: "#f4f4f5", border: "rgba(244,244,245,.18)" };
  return `<style>\n.wbm-statusbar {\n  box-sizing: border-box;\n  width: 100%;\n  margin: .75rem 0;\n  padding: .75rem .9rem;\n  border: 1px solid ${palette.border};\n  border-radius: 12px;\n  background: ${palette.bg};\n  color: ${palette.fg};\n  font-size: 13px;\n  line-height: 1.6;\n  white-space: pre-wrap;\n}\n.wbm-statusbar__title {\n  font-weight: 700;\n  margin-bottom: .35rem;\n}\n</style>\n<div class="wbm-statusbar">\n  <div class="wbm-statusbar__title">状态</div>\n  <div class="wbm-statusbar__content">{{format_message_variable::stat_data}}</div>\n</div>`;
}

function globalLineBreakRegex() {
  return {
    name: "[美化]保留换行",
    findRegex: "/\\n/g",
    replaceString: "\n",
    markdownOnly: true,
    promptOnly: false,
    placement: [2],
    runOnEdit: true,
  };
}
