/**
 * Pre-built "Hat Energy" extension (sandboxed Alpine mini-app). Runs inside the
 * extension iframe; reaches the app only through the bridge helper `appAction`.
 * The session id arrives via `window.slotContext.sessionId` (set by ControlsStrip).
 */
export const HAT_ENERGY_NAME = "Hat Energy";

export const HAT_ENERGY_HTML = `<style>
  html,body{margin:0;min-height:100%;background:transparent;color:#eef1ee}
  *{box-sizing:border-box}
  body{padding:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .hat-energy{display:grid;grid-template-columns:1fr 44px;align-items:center;gap:5px 12px;min-height:54px;padding:7px 9px;border:1px solid #354047;border-radius:4px;background:#171d21}
  .hat-energy__head{display:flex;align-items:center;gap:7px;min-width:0}
  .hat-energy__lamp{width:6px;height:6px;flex:none;border-radius:50%;background:#9bcb79}
  .hat-energy__label{color:#9ca7a8;font-size:9px;font-weight:750;text-transform:uppercase}
  .hat-energy__value{color:#55d6e1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;text-align:right}
  .hat-energy input{grid-column:1 / -1;width:100%;height:13px;margin:0;accent-color:#55d6e1;cursor:pointer}
  .hat-energy input:disabled{opacity:.45;cursor:not-allowed}
  .hat-energy__error{grid-column:1 / -1;color:#f2b64a;font-size:9px}
  @media(max-width:360px){.hat-energy{grid-template-columns:1fr 40px}}
</style>
<div x-data="hatEnergy" class="hat-energy">
  <div class="hat-energy__head"><i class="hat-energy__lamp"></i><span class="hat-energy__label">Hat energy</span></div>
  <span class="hat-energy__value" x-text="Math.round(level * 100) + '%'" aria-live="polite"></span>
  <input type="range" min="0" max="100" step="1" x-model.number="pct" @input="onInput()" :disabled="!sessionId" aria-label="Hat energy" />
  <div x-show="!sessionId" class="hat-energy__error">No session in context</div>
  <div x-show="$data.err" x-text="$data.err" class="hat-energy__error" role="status"></div>
</div>
<script>
  document.addEventListener("alpine:init", () => { Alpine.data("hatEnergy", () => ({
    sessionId: "",
    pct: 50,
    err: "",
    timer: null,
    get level() { return this.pct / 100; },
    init() {
      const apply = (ctx) => {
        if (!ctx || !ctx.sessionId) return;
        this.sessionId = String(ctx.sessionId);
        if (typeof ctx.energy === "number" && Number.isFinite(ctx.energy)) {
          this.pct = Math.max(0, Math.min(100, Math.round(ctx.energy * 100)));
        }
      };
      apply(window.slotContext);
      if (window.onSlotContext) window.onSlotContext(apply);
    },
    onInput() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.send(), 250);
    },
    async send() {
      if (!this.sessionId) return;
      try {
        this.err = "";
        await appAction("set-energy", { sessionId: this.sessionId, track: "hat", level: this.level });
        if (window.agentNative && agentNative.ui) agentNative.ui.output({ track: "hat", level: this.level }, { label: "Hat energy" });
      } catch (e) {
        this.err = String((e && e.message) || e);
      }
    },
  })); });
</script>`;
