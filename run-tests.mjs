import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assessPredictions,
  diceSimilarity,
  formatPercent,
  normalizeText,
  rankItems,
  validateImageFile,
  validateRulesData
} from "../js/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = JSON.parse(await readFile(path.join(root, "data/garbage_rules.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "model/manifest.json"), "utf8"));
const html = await readFile(path.join(root, "index.html"), "utf8");
const appSource = await readFile(path.join(root, "app.js"), "utf8");
const aiSource = await readFile(path.join(root, "js/ai-adapter.js"), "utf8");
const css = await readFile(path.join(root, "style.css"), "utf8");

test("01 JSONデータを読み込める", () => assert.equal(rules.schema_version, "1.1"));
test("02 初期登録品目が50件ある", () => assert.equal(rules.items.length, 50));
test("03 スキーマ検査でエラーがない", () => assert.deepEqual(validateRulesData(rules), []));
test("04 品目IDが重複していない", () => {
  const ids = rules.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("05 すべての根拠URLが足利市公式HTTPS", () => {
  for (const item of rules.items) {
    assert.match(item.official_url, /^https:\/\/www\.city\.ashikaga\.tochigi\.jp\//);
  }
});
test("06 すべての品目に情報確認日がある", () => {
  assert.ok(rules.items.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.checked_date)));
});
test("07 カタカナをひらがなへ正規化できる", () => assert.equal(normalizeText("ペット ボトル"), "ぺっとぼとる"));
test("08 全角英数字を正規化できる", () => assert.equal(normalizeText("ＰＥＴボトル"), "petぼとる"));
test("09 記号を除いて検索できる", () => assert.equal(normalizeText("CD・DVD"), "cddvd"));
test("10 完全一致検索でペットボトルが先頭", () => assert.equal(rankItems(rules.items, "ペットボトル")[0].item.id, "pet_bottle"));
test("11 ひらがな検索でペットボトルが先頭", () => assert.equal(rankItems(rules.items, "ぺっとぼとる")[0].item.id, "pet_bottle"));
test("12 同義語検索で雨傘が先頭", () => assert.equal(rankItems(rules.items, "かさ")[0].item.id, "umbrella"));
test("13 部分一致検索でモバイルバッテリーを検出", () => assert.ok(rankItems(rules.items, "バッテリー").some(({ item }) => item.id === "mobile_battery")));
test("14 存在しない品目は候補なし", () => assert.equal(rankItems(rules.items, "量子転送装置").length, 0));
test("15 文字列類似度は同一語で1", () => assert.equal(diceSimilarity("新聞紙", "新聞紙"), 1));
test("16 画像ファイルを許可", () => assert.equal(validateImageFile({ type: "image/jpeg", size: 1024 }).ok, true));
test("17 非画像ファイルを拒否", () => assert.equal(validateImageFile({ type: "text/plain", size: 20 }).ok, false));
test("18 15MB超の画像を拒否", () => assert.equal(validateImageFile({ type: "image/png", size: 16 * 1024 * 1024 }).ok, false));
test("19 AI高確信度候補を受理", () => {
  const result = assessPredictions([
    { label: "pet_bottle", ruleId: "pet_bottle", probability: 0.88 },
    { label: "empty_can", ruleId: "empty_can", probability: 0.08 }
  ], { confidenceThreshold: 0.72, confidenceMargin: 0.15, topK: 3 });
  assert.equal(result.status, "candidate");
});
test("20 AI低確信度を断定しない", () => {
  const result = assessPredictions([{ label: "pet_bottle", ruleId: "pet_bottle", probability: 0.6 }], { confidenceThreshold: 0.72, confidenceMargin: 0.15, topK: 3 });
  assert.equal(result.status, "low_confidence");
});
test("21 AI上位差が小さい場合を断定しない", () => {
  const result = assessPredictions([
    { label: "pet_bottle", ruleId: "pet_bottle", probability: 0.8 },
    { label: "glass_bottle", ruleId: "glass_bottle", probability: 0.71 }
  ], { confidenceThreshold: 0.72, confidenceMargin: 0.15, topK: 3 });
  assert.equal(result.status, "ambiguous");
});
test("22 その他・不明を品目として断定しない", () => {
  const result = assessPredictions([{ label: "other_unknown", ruleId: null, probability: 0.95 }], { confidenceThreshold: 0.72, confidenceMargin: 0.15, topK: 3 });
  assert.equal(result.status, "unknown");
});
test("23 確信度を百分率表示できる", () => assert.equal(formatPercent(0.874), "87%"));
test("24 モデル未作成時の状態が明示される", () => assert.equal(manifest.status, "not_trained"));
test("25 初期AIラベルにその他・不明がある", () => assert.ok(Object.hasOwn(manifest.labels, "other_unknown")));
test("26 高危険品目が登録される", () => {
  const required = ["spray_can", "cassette_cylinder", "lithium_battery", "mobile_battery", "chemicals"];
  required.forEach((id) => assert.equal(rules.items.find((item) => item.id === id)?.safety_level, "high"));
});
test("27 名草地区の地域分岐がある", () => {
  const tray = rules.items.find((item) => item.id === "food_tray");
  assert.equal(tray.decision.start, "area");
  assert.ok(JSON.stringify(tray).includes("名草地区限定"));
});
test("28 電池内蔵家電に二段階以上の分岐がある", () => {
  const item = rules.items.find((entry) => entry.id === "small_appliance");
  assert.ok(Object.keys(item.decision.nodes).length >= 3);
});
test("29 画面に主要アクセシビリティ要素がある", () => {
  assert.match(html, /lang="ja"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="tablist"/);
});
test("30 画面に必須の注意表示がある", () => {
  assert.match(html, /個人が作成した非公式サービス/);
  assert.match(html, /AIの判定は参考/);
  assert.match(html, /足利市公式情報/);
});
test("31 画像アップロード処理を含まない", () => {
  const combined = `${appSource}\n${aiSource}`;
  assert.doesNotMatch(combined, /FormData|XMLHttpRequest|sendBeacon|\.upload\s*\(/);
});
test("32 アクセス解析や広告SDKを含まない", () => {
  assert.doesNotMatch(html + appSource, /google-analytics|googletagmanager|gtag\(|facebook\.net|doubleclick|adsbygoogle/i);
});
test("33 位置情報APIを呼び出さない", () => assert.doesNotMatch(appSource, /geolocation|getCurrentPosition|watchPosition/));
test("34 APIキーらしい文字列を含まない", () => {
  const combined = `${html}\n${appSource}\n${aiSource}\n${JSON.stringify(rules)}`;
  assert.doesNotMatch(combined, /(api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{20,})/i);
});
test("35 Content Security Policyがある", () => assert.match(html, /Content-Security-Policy/));
test("36 すべての外部リンクがHTTPS", () => {
  const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  assert.ok(urls.length >= 2);
  assert.ok(urls.every((url) => url.startsWith("https://")));
});
test("37 相対参照された主要ファイルが存在する", async () => {
  const refs = ["style.css", "config.js", "app.js", "data/garbage_rules.json", "model/manifest.json"];
  await Promise.all(refs.map((ref) => access(path.join(root, ref), constants.R_OK)));
});
test("38 CSSの波かっこが対応する", () => {
  const opens = (css.match(/{/g) || []).length;
  const closes = (css.match(/}/g) || []).length;
  assert.equal(opens, closes);
});
test("39 小画面向けCSSがある", () => assert.match(css, /@media \(max-width: 430px\)/));
test("40 動きを減らす設定に対応", () => assert.match(css, /prefers-reduced-motion/));
test("41 すべてのHTML内の相対ファイル参照が存在する", async () => {
  const htmlFiles = (await readdir(root)).filter((name) => name.endsWith(".html"));
  for (const fileName of htmlFiles) {
    const source = await readFile(path.join(root, fileName), "utf8");
    const refs = [...source.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((ref) => !ref.startsWith("#") && !/^https?:/.test(ref))
      .map((ref) => ref.replace(/^\.\//, "").split(/[?#]/)[0]);
    for (const ref of refs) await access(path.join(root, ref), constants.R_OK);
  }
});
test("42 条件分岐内の個別URLも足利市公式HTTPS", () => {
  for (const item of rules.items) {
    for (const node of Object.values(item.decision?.nodes || {})) {
      for (const option of node.options || []) {
        if (option.outcome?.official_url) {
          assert.match(option.outcome.official_url, /^https:\/\/www\.city\.ashikaga\.tochigi\.jp\//);
        }
      }
    }
  }
});
test("43 公開ファイルに作業環境の絶対パスがない", async () => {
  const sources = [html, appSource, aiSource, css, JSON.stringify(rules), await readFile(path.join(root, "README.md"), "utf8")];
  assert.doesNotMatch(sources.join("\n"), /\/workspace\/|[A-Z]:\\Users\\/i);
});
test("44 ユーザー入力をinnerHTMLへ入れない", () => assert.doesNotMatch(appSource, /innerHTML|insertAdjacentHTML|document\.write/));
test("45 新しいタブの外部リンクにnoopenerがある", () => {
  const links = [...html.matchAll(/<a\s+[^>]*target="_blank"[^>]*>/g)].map((match) => match[0]);
  assert.ok(links.length >= 3);
  links.forEach((link) => assert.match(link, /rel="noopener noreferrer"/));
});
