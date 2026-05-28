import type { HtmlBeautifyConfig } from "../schemas/html-beautify.js";

export interface CreateHtmlBeautifyTemplateInput {
  target?: HtmlBeautifyConfig["target"];
  theme?: HtmlBeautifyConfig["theme"];
  variablePaths?: string[];
}

export interface CreateHtmlBeautifyTemplateResult {
  html: HtmlBeautifyConfig;
}

export function createDefaultHtmlBeautifyConfig(): HtmlBeautifyConfig {
  return createHtmlBeautifyTemplate().html;
}

export function createHtmlBeautifyTemplate(input: CreateHtmlBeautifyTemplateInput = {}): CreateHtmlBeautifyTemplateResult {
  const html = {
    target: input.target ?? "statusbar",
      theme: input.theme ?? "minimal",
      statusbar: {
        html: `<div class="wbm-statusbar">
  <div class="wbm-statusbar__title">状态栏</div>
  <div class="wbm-statusbar__section">
    <span class="wbm-statusbar__label">当前变量</span>
    <span class="wbm-statusbar__value">{{format_message_variable::stat_data}}</span>
  </div>
</div>`,
        scopedCss: `.wbm-statusbar {
  box-sizing: border-box;
  width: 100%;
  max-width: 720px;
  margin: 0.5rem auto;
  padding: 0.75rem;
  border: 1px solid rgba(120, 120, 120, 0.35);
  border-radius: 10px;
  font-size: 0.95em;
}
.wbm-statusbar__title { font-weight: 700; margin-bottom: 0.35rem; }
.wbm-statusbar__section { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.wbm-statusbar__label { opacity: 0.75; }
.wbm-statusbar__value { white-space: pre-wrap; }`,
        hideRegex: true,
      },
      regexPolicy: { generateHideRegex: true, generateStatusbarRegex: true },
    variablePaths: input.variablePaths ?? [],
  } as HtmlBeautifyConfig;
  return { html: Object.assign(html, { statusbar: Object.assign(html.statusbar, { enabled: true }), global: { enabled: false } }) };
}
