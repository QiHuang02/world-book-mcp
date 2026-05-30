export const MVU_LOADING_BEAUTIFY_HTML = `<div style="width: 80%; margin: 20px auto;">
  <details class="mvu-loading-details" style="background:#2d2d2d;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);overflow:hidden;">
    <summary style="padding:12px 16px;color:#e0e0e0;cursor:pointer;list-style:none;background:#363636;position:relative;overflow:hidden;">👾变量更新 - <small>正在更新...</small><span style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:mvuShimmer 2s linear infinite;transform:translateX(-100%);"></span></summary>
    <div style="max-height:300px;overflow-y:auto;padding:12px 16px;color:#b0b0b0;line-height:1.6;white-space:pre-wrap;">$2</div>
  </details>
</div>
<style>@keyframes mvuShimmer{100%{transform:translateX(100%)}}</style>`;

export const MVU_DONE_BEAUTIFY_HTML = `<div style="width: 80%; margin: 20px auto;">
  <details class="mvu-thinking-description" style="background:#2d2d2d;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);overflow:hidden;">
    <summary style="padding:12px 16px;color:#e0e0e0;cursor:pointer;list-style:none;font-weight:500;">👾变量更新 - <small>点击查看/隐藏</small></summary>
    <div style="max-height:300px;overflow-y:auto;padding:12px 16px;color:#b0b0b0;line-height:1.6;white-space:pre-wrap;">$2</div>
  </details>
</div>`;
