import { assessPredictions } from "./core.js";

function loadScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ai-library="${globalName}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window[globalName]), { once: true });
      existing.addEventListener("error", () => reject(new Error(`${globalName}の読込みに失敗しました。`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.aiLibrary = globalName;
    script.addEventListener("load", () => resolve(window[globalName]), { once: true });
    script.addEventListener("error", () => reject(new Error(`${globalName}の読込みに失敗しました。`)), { once: true });
    document.head.append(script);
  });
}

export class AIAdapter {
  constructor(config) {
    this.config = config;
    this.manifest = null;
    this.model = null;
  }

  async checkAvailability() {
    const response = await fetch(this.config.modelManifestPath, { cache: "no-store" });
    if (!response.ok) throw new Error("AI設定を確認できませんでした。");
    this.manifest = await response.json();
    return {
      ready: this.manifest.status === "ready",
      message: this.manifest.message || "画像AIは準備中です。"
    };
  }

  async ensureModel() {
    if (this.model) return this.model;
    if (!this.manifest || this.manifest.status !== "ready") {
      throw new Error(this.manifest?.message || "画像AIは準備中です。");
    }
    await loadScript(this.config.ai.tensorflowJsUrl, "tf");
    await loadScript(this.config.ai.teachableMachineUrl, "tmImage");
    this.model = await window.tmImage.load(
      new URL(this.manifest.model_url, new URL(this.config.modelManifestPath, location.href)).href,
      new URL(this.manifest.metadata_url, new URL(this.config.modelManifestPath, location.href)).href
    );
    return this.model;
  }

  async predict(imageElement) {
    const model = await this.ensureModel();
    const raw = await model.predict(imageElement, false);
    const predictions = raw.map((entry) => {
      const mapped = this.manifest.labels?.[entry.className];
      return {
        label: entry.className,
        ruleId: mapped === undefined ? null : mapped,
        probability: entry.probability
      };
    });
    return assessPredictions(predictions, this.config.ai);
  }
}
