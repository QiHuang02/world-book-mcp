export const MVU_LOADING_BEAUTIFY_HTML = `<div style="width: 82%; margin: 18px auto;">
  <details class="mvu-loading-details" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 52%,#0f172a 100%);border:1px solid rgba(148,163,184,.22);border-radius:16px;box-shadow:0 4px 22px rgba(96,165,250,.16),inset 0 1px 0 rgba(148,163,184,.1);overflow:hidden;">
    <summary style="padding:14px 20px;color:#e2e8f0;cursor:pointer;list-style:none;position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;font-weight:500;">
      <span style="filter:drop-shadow(0 0 8px rgba(125,211,252,.8));">✦</span><span style="flex:1;">变量更新中</span><small style="opacity:.72;">正在整理状态</small><span style="position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(186,230,253,.12),transparent);animation:mvuShimmer 2s linear infinite;transform:translateX(-100%);pointer-events:none;"></span>
    </summary>
    <div style="max-height:300px;overflow-y:auto;padding:14px 20px;color:#cbd5e1;line-height:1.65;white-space:pre-wrap;background:rgba(15,23,42,.32);">$2</div>
  </details>
</div>
<style>@keyframes mvuShimmer{100%{transform:translateX(100%)}}</style>`;

export const MVU_DONE_BEAUTIFY_HTML = `<div style="width: 82%; margin: 18px auto;">
  <details class="mvu-thinking-description" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 52%,#0f172a 100%);border:1px solid rgba(148,163,184,.22);border-radius:16px;box-shadow:0 4px 22px rgba(56,189,248,.14),inset 0 1px 0 rgba(148,163,184,.1);overflow:hidden;">
    <summary style="padding:14px 20px;color:#e2e8f0;cursor:pointer;list-style:none;font-weight:500;display:flex;align-items:center;gap:10px;"><span style="filter:drop-shadow(0 0 8px rgba(56,189,248,.72));">◈</span><span style="flex:1;">变量更新</span><small style="opacity:.72;">点击查看/隐藏</small></summary>
    <div style="max-height:300px;overflow-y:auto;padding:14px 20px;color:#cbd5e1;line-height:1.65;white-space:pre-wrap;background:rgba(15,23,42,.32);">$2</div>
  </details>
</div>`;
