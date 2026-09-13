export function normalizeText(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/[\s\u3000・･\-ー_／/（）()［］\[\]「」『』.,，。]/g, "");
}

function bigrams(text) {
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, index) =>
    text.slice(index, index + 2)
  );
}

export function diceSimilarity(left, right) {
  const a = bigrams(normalizeText(left));
  const b = bigrams(normalizeText(right));
  if (!a.length || !b.length) return 0;
  const pool = [...b];
  let matches = 0;
  a.forEach((part) => {
    const index = pool.indexOf(part);
    if (index >= 0) {
      matches += 1;
      pool.splice(index, 1);
    }
  });
  return (2 * matches) / (a.length + b.length);
}

export function rankItems(items, query, limit = 12) {
  const needle = normalizeText(query);
  if (!needle) return [];

  return items
    .map((item) => {
      const candidates = [item.name, item.kana, ...(item.synonyms || [])]
        .filter(Boolean)
        .map(normalizeText);
      let score = 0;
      candidates.forEach((candidate, index) => {
        if (candidate === needle) score = Math.max(score, index === 0 ? 100 : 96);
        else if (candidate.startsWith(needle) || needle.startsWith(candidate)) {
          score = Math.max(score, 86);
        } else if (candidate.includes(needle) || needle.includes(candidate)) {
          score = Math.max(score, 74);
        } else {
          score = Math.max(score, Math.round(diceSimilarity(candidate, needle) * 55));
        }
      });
      return { item, score };
    })
    .filter(({ score }) => score >= 28)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "ja"))
    .slice(0, limit);
}

export function validateRulesData(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["データ全体がオブジェクトではありません。"];
  if (!Array.isArray(data.items)) errors.push("items が配列ではありません。");
  const ids = new Set();
  (data.items || []).forEach((item, index) => {
    const prefix = `items[${index}]`;
    ["id", "name", "official_url", "checked_date"].forEach((key) => {
      if (!item[key]) errors.push(`${prefix}.${key} がありません。`);
    });
    if (ids.has(item.id)) errors.push(`${prefix}.id が重複しています: ${item.id}`);
    ids.add(item.id);
    if (!item.result && !item.decision) {
      errors.push(`${prefix} に result または decision が必要です。`);
    }
    if (item.result && (!item.result.category || !item.result.instruction)) {
      errors.push(`${prefix}.result に category と instruction が必要です。`);
    }
    if (item.decision) {
      if (!item.decision.start || !item.decision.nodes?.[item.decision.start]) {
        errors.push(`${prefix}.decision.start の参照先がありません。`);
      }
      Object.entries(item.decision.nodes || {}).forEach(([nodeId, node]) => {
        if (!node.prompt || !Array.isArray(node.options) || !node.options.length) {
          errors.push(`${prefix}.decision.nodes.${nodeId} の形式が不正です。`);
        }
        (node.options || []).forEach((option, optionIndex) => {
          if (!option.label || (!option.next && !option.outcome)) {
            errors.push(`${prefix}.${nodeId}.options[${optionIndex}] が不正です。`);
          }
          if (option.next && !item.decision.nodes[option.next]) {
            errors.push(`${prefix}.${nodeId}.options[${optionIndex}] の next が不正です。`);
          }
        });
      });
    }
  });
  return errors;
}

export function getInitialCategory(item) {
  return item.result?.category || "条件を確認";
}

export function validateImageFile(file, maxBytes = 15 * 1024 * 1024) {
  if (!file) return { ok: false, message: "画像が選ばれていません。" };
  if (!String(file.type || "").startsWith("image/")) {
    return { ok: false, message: "画像ファイルを選んでください。" };
  }
  if (Number(file.size || 0) > maxBytes) {
    return { ok: false, message: "画像が大きすぎます。15MB以下の画像を選んでください。" };
  }
  return { ok: true, message: "" };
}

export function assessPredictions(predictions, settings) {
  const threshold = Number(settings?.confidenceThreshold ?? 0.72);
  const margin = Number(settings?.confidenceMargin ?? 0.15);
  const topK = Number(settings?.topK ?? 3);
  const sorted = [...(predictions || [])]
    .filter((entry) => entry && Number.isFinite(Number(entry.probability)))
    .map((entry) => ({
      label: String(entry.label || entry.className || ""),
      ruleId: entry.ruleId ?? null,
      probability: Math.max(0, Math.min(1, Number(entry.probability)))
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topK);

  if (!sorted.length) return { status: "error", candidates: [], reason: "候補がありません。" };
  const top = sorted[0];
  const second = sorted[1]?.probability ?? 0;
  if (!top.ruleId) {
    return { status: "unknown", candidates: sorted, reason: "対象外または不明です。" };
  }
  if (top.probability < threshold) {
    return { status: "low_confidence", candidates: sorted, reason: "確信度が基準未満です。" };
  }
  if (sorted.length > 1 && top.probability - second < margin) {
    return { status: "ambiguous", candidates: sorted, reason: "上位候補の差が小さいため断定できません。" };
  }
  return { status: "candidate", candidates: sorted, reason: "" };
}

export function formatPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}
