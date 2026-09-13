/*
 * 初心者が変更しやすい設定ファイルです。
 * AIモデルを更新するときは、通常は model/manifest.json とモデル本体を差し替えます。
 */
window.ASHIKAGA_GARBAGE_CONFIG = Object.freeze({
  appName: "足利ごみ分別AI",
  dataPath: "./data/garbage_rules.json",
  modelManifestPath: "./model/manifest.json",
  ai: {
    confidenceThreshold: 0.72,
    confidenceMargin: 0.15,
    topK: 3,
    tensorflowJsUrl: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
    teachableMachineUrl: "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js"
  },
  limits: {
    maxImageBytes: 15 * 1024 * 1024
  },
  featuredItemIds: [
    "pet_bottle",
    "empty_can",
    "glass_bottle",
    "cardboard",
    "dry_cell",
    "spray_can",
    "small_appliance",
    "mobile_battery"
  ]
});
