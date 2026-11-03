/**
 * Pre-built "Hat Energy" extension (sandboxed Alpine mini-app). Runs inside the
 * extension iframe; reaches the app only through the bridge helper `appAction`.
 * The session id arrives via `window.slotContext.sessionId` (set by ControlsStrip).
 */
export const HAT_ENERGY_NAME = "Hat Energy";

export const HAT_ENERGY_HTML = `<style>html,body{margin:0;min-height:100%;background:#101014;color:#d9d9de}body{padding:8px}</style><div x-data="hatEnergy" class="p-3" style="background:transparent;border:1px solid #26262d;border-radius:6px;font-family:ui-monospace,monospace;color:#d9d9de">
  <div class="flex items-center justify-between" style="margin-bottom:6px">
    <span style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#7b7b86">Hat energy</span>
    <span x-text="Math.round(level * 100) + '%'" style="font-size:12px;color:#2fd4e6"></span>
  </div>
  <input type="range" min="0" max="100" step="1" x-model.number="pct" @input="onInput()" style="width:100%;accent-color:#2fd4e6" :disabled="!sessionId" />
  <div x-show="!sessionId" style="font-size:10px;color:#ffb02e;margin-top:4px">No session in context</div>
  <div x-show="$data.err" x-text="$data.err" style="font-size:10px;color:#ffb02e;margin-top:4px"></div>
</div>
<script>
  document.addEventListener("alpine:init", () => { Alpine.data("hatEnergy", () => ({
    sessionId: "",
    pct: 50,
    err: "",
    timer: null,
    get level() { return this.pct / 100; },
    init() {
      const apply = async (ctx) => {
        if (!ctx || !ctx.sessionId) return;
        this.sessionId = String(ctx.sessionId);
        try {
          const result = await appAction("get-session", { id: this.sessionId });
          const track = result && result.tracks && result.tracks.find((item) => item.kind === "hat");
          const steps = track && Array.isArray(track.steps) ? track.steps : [];
          const hits = steps.filter((value) => typeof value === "number" && value > 0).length;
          this.pct = steps.length ? Math.round((hits / steps.length) * 100) : 0;
        } catch (e) {
          this.err = String((e && e.message) || e);
        }
      };
      void apply(window.slotContext);
      if (window.onSlotContext) window.onSlotContext((ctx) => { void apply(ctx); });
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
