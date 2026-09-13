import {
  assessPredictions,
  formatPercent,
  getInitialCategory,
  rankItems,
  validateImageFile,
  validateRulesData
} from "./js/core.js";
import { AIAdapter } from "./js/ai-adapter.js";

const config = window.ASHIKAGA_GARBAGE_CONFIG;
const elements = {
  modeBadge: document.querySelector("#modeBadge"),
  photoTab: document.querySelector("#photoTab"),
  searchTab: document.querySelector("#searchTab"),
  photoPanel: document.querySelector("#photoPanel"),
  searchPanel: document.querySelector("#searchPanel"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  previewFigure: document.querySelector("#previewFigure"),
  aiStatus: document.querySelector("#aiStatus"),
  aiResults: document.querySelector("#aiResults"),
  goToSearchButton: document.querySelector("#goToSearchButton"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  quickButtons: document.querySelector("#quickButtons"),
  searchMessage: document.querySelector("#searchMessage"),
  searchResults: document.querySelector("#searchResults"),
  decisionSection: document.querySelector("#decisionSection"),
  decisionContent: document.querySelector("#decisionContent"),
  resultSection: document.querySelector("#resultSection"),
  answerTitle: document.querySelector("#answerTitle"),
  categoryBadge: document.querySelector("#categoryBadge"),
  instructionText: document.querySelector("#instructionText"),
  cautionList: document.querySelector("#cautionList"),
  safetyBadge: document.querySelector("#safetyBadge"),
  safetyWarning: document.querySelector("#safetyWarning"),
  checkedDate: document.querySelector("#checkedDate"),
  officialLink: document.querySelector("#officialLink"),
  resetButton: document.querySelector("#resetButton"),
  aiScopeText: document.querySelector("#aiScopeText")
};

const state = {
  items: [],
  itemMap: new Map(),
  imageUrl: null,
  selectedItem: null,
  aiReady: false,
  mode: getMode()
};

const aiAdapter = new AIAdapter(config);

function getMode() {
  const requested = new URLSearchParams(location.search).get("mode");
  return ["manual", "ai", "public"].includes(requested) ? requested : "public";
}

function setModeBadge() {
  const labels = {
    manual: "STEP1・AIなし確認版",
    ai: "STEP2・画像AI確認版",
    public: "STEP3・一般公開版"
  };
  elements.modeBadge.textContent = labels[state.mode];
}

function setAIStatus(stateName, title, detail) {
  elements.aiStatus.dataset.state = stateName;
  elements.aiStatus.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "status-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = stateName === "ready" ? "✓" : stateName === "error" ? "×" : "!";
  const text = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = detail;
  text.append(strong, paragraph);
  elements.aiStatus.append(icon, text);
}

async function loadData() {
  try {
    const response = await fetch(config.dataPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const errors = validateRulesData(data);
    if (errors.length) throw new Error(errors[0]);
    state.items = data.items;
    state.itemMap = new Map(data.items.map((item) => [item.id, item]));
    renderQuickButtons();
    elements.searchMessage.textContent = `${data.items.length}品目の初期データから検索できます。`;
  } catch (error) {
    elements.searchMessage.textContent = "分別データを読み込めませんでした。通信を確認して、ページを再読み込みしてください。";
    elements.searchResults.replaceChildren();
    console.error("Rules data load failed", error);
  }
}

async function initializeAI() {
  if (state.mode === "manual") {
    setAIStatus("warning", "STEP1では画像AIを使いません", "写真の確認後、品目名から検索してください。");
    elements.aiScopeText.textContent = "STEP1確認モードです。画像AIを使わず、品目名検索と追加質問だけで動作します。";
    return;
  }
  try {
    const availability = await aiAdapter.checkAvailability();
    state.aiReady = availability.ready;
    if (availability.ready) {
      const labels = Object.keys(aiAdapter.manifest.labels || {}).filter((label) => aiAdapter.manifest.labels[label]);
      setAIStatus("ready", "画像AIを利用できます", `現在の対象は${labels.length}品目です。写真を選ぶと候補を表示します。`);
      elements.aiScopeText.textContent = `現在、画像AIで候補を出せるのは${labels.length}品目と「その他・不明」です。対象外は品目名から検索してください。`;
    } else {
      setAIStatus("warning", "画像AIは準備中です", availability.message);
      elements.aiScopeText.textContent = "現在、学習画像の提供前のため画像AIは準備中です。品目名検索は利用できます。";
    }
  } catch (error) {
    state.aiReady = false;
    setAIStatus("error", "画像AIを読み込めませんでした", "品目名から検索してください。アプリ本体は利用できます。");
    console.error("AI availability check failed", error);
  }
}

function switchTab(name, focus = false) {
  const photoActive = name === "photo";
  elements.photoTab.classList.toggle("is-active", photoActive);
  elements.searchTab.classList.toggle("is-active", !photoActive);
  elements.photoTab.setAttribute("aria-selected", String(photoActive));
  elements.searchTab.setAttribute("aria-selected", String(!photoActive));
  elements.photoTab.tabIndex = photoActive ? 0 : -1;
  elements.searchTab.tabIndex = photoActive ? -1 : 0;
  elements.photoPanel.hidden = !photoActive;
  elements.searchPanel.hidden = photoActive;
  if (focus) (photoActive ? elements.photoTab : elements.searchInput).focus();
}

function renderQuickButtons() {
  elements.quickButtons.replaceChildren();
  config.featuredItemIds.forEach((id) => {
    const item = state.itemMap.get(id);
    if (!item) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.textContent = item.name;
    button.addEventListener("click", () => selectItem(item));
    elements.quickButtons.append(button);
  });
}

function performSearch(query) {
  elements.searchResults.replaceChildren();
  const trimmed = query.trim();
  if (!trimmed) {
    elements.searchMessage.textContent = "調べたい品目名を入力してください。";
    return [];
  }
  const ranked = rankItems(state.items, trimmed);
  if (!ranked.length) {
    elements.searchMessage.textContent = `「${trimmed}」に近い登録品目が見つかりませんでした。足利市公式の五十音一覧をご確認ください。`;
    return [];
  }
  elements.searchMessage.textContent = `${ranked.length}件の候補があります。近い品目を選んでください。`;
  ranked.forEach(({ item }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-button";
    const label = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const hint = document.createElement("small");
    hint.textContent = item.search_hint || (item.synonyms || []).slice(0, 3).join("・");
    label.append(name, hint);
    const category = document.createElement("span");
    category.className = "item-category";
    category.textContent = getInitialCategory(item);
    button.append(label, category);
    button.addEventListener("click", () => selectItem(item));
    elements.searchResults.append(button);
  });
  return ranked;
}

function selectItem(item) {
  state.selectedItem = item;
  elements.resultSection.hidden = true;
  elements.decisionSection.hidden = true;
  if (item.decision) showDecisionNode(item, item.decision.start);
  else showResult(item, item.result);
}

function showDecisionNode(item, nodeId) {
  const node = item.decision.nodes[nodeId];
  if (!node) {
    showResult(item, {
      category: "要公式確認",
      instruction: "条件を判定できませんでした。足利市公式情報をご確認ください。",
      cautions: ["分別データの設定を確認してください。"]
    });
    return;
  }
  elements.decisionContent.replaceChildren();
  const question = document.createElement("p");
  question.className = "question-text";
  question.textContent = node.prompt;
  elements.decisionContent.append(question);
  if (node.help) {
    const help = document.createElement("p");
    help.className = "question-help";
    help.textContent = node.help;
    elements.decisionContent.append(help);
  }
  const choices = document.createElement("div");
  choices.className = "choice-list";
  node.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      if (option.next) showDecisionNode(item, option.next);
      else showResult(item, option.outcome);
    });
    choices.append(button);
  });
  elements.decisionContent.append(choices);
  elements.decisionSection.hidden = false;
  elements.decisionSection.scrollIntoView({ block: "start" });
}

function categoryClass(category) {
  if (category.includes("プラスチック")) return "category-plastic";
  if (category.includes("資源")) return "category-resource";
  if (category.includes("金属")) return "category-metal";
  if (category.includes("燃やせない")) return "category-nonburnable";
  if (category.includes("燃やせる") || category.includes("燃やすしかない")) return "category-burnable";
  if (category.includes("有害")) return "category-hazardous";
  if (category.includes("粗大")) return "category-oversized";
  return "category-unavailable";
}

function showResult(item, outcome) {
  elements.decisionSection.hidden = true;
  elements.answerTitle.textContent = item.name;
  elements.categoryBadge.textContent = outcome.category;
  elements.categoryBadge.className = `category-badge ${categoryClass(outcome.category)}`;
  elements.instructionText.textContent = outcome.instruction;
  elements.cautionList.replaceChildren();
  const cautions = outcome.cautions?.length ? outcome.cautions : ["足利市公式情報で最新の内容をご確認ください。"];
  cautions.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    elements.cautionList.append(li);
  });
  const safetyLevel = outcome.safety_level || item.safety_level || "standard";
  const highRisk = safetyLevel === "high";
  elements.safetyBadge.hidden = !highRisk;
  elements.safetyBadge.textContent = highRisk ? "安全確認が必要" : "";
  elements.safetyWarning.hidden = !highRisk;
  elements.safetyWarning.textContent = highRisk
    ? "危険につながる可能性がある品目です。画像だけで判断せず、中身・電池・破損や変形の有無を確認し、必ず公式情報に従ってください。"
    : "";
  elements.checkedDate.textContent = outcome.checked_date || item.checked_date;
  elements.officialLink.href = outcome.official_url || item.official_url;
  elements.resultSection.hidden = false;
  elements.resultSection.scrollIntoView({ block: "start" });
}

async function handleImage(file) {
  const validation = validateImageFile(file, config.limits.maxImageBytes);
  if (!validation.ok) {
    setAIStatus("error", "画像を利用できません", validation.message);
    return;
  }
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  elements.imagePreview.src = state.imageUrl;
  elements.previewFigure.hidden = false;
  elements.aiResults.hidden = true;
  if (state.mode === "manual") {
    setAIStatus("warning", "写真を確認しました", "STEP1ではAI判定を行いません。品目名から検索してください。");
    return;
  }
  if (!state.aiReady) {
    setAIStatus("warning", "写真を確認しました", "現在、画像AIは準備中です。品目名から検索してください。");
    return;
  }
  setAIStatus("ready", "画像を判定しています", "画像は外部へ送信せず、このブラウザ内で処理します。");
  try {
    await elements.imagePreview.decode();
    const assessment = await aiAdapter.predict(elements.imagePreview);
    renderPredictions(assessment);
  } catch (error) {
    setAIStatus("error", "画像AIの読込みに失敗しました", "品目名から検索してください。アプリ本体は利用できます。");
    console.error("AI prediction failed", error);
  }
}

function renderPredictions(assessment) {
  elements.aiResults.replaceChildren();
  const heading = document.createElement("h3");
  const safeCandidate = assessment.status === "candidate";
  heading.textContent = safeCandidate ? "AIの候補です。合っていますか？" : "画像だけでは判断できませんでした";
  elements.aiResults.append(heading);
  const list = document.createElement("div");
  list.className = "prediction-list";
  assessment.candidates.forEach((candidate) => {
    const row = document.createElement("div");
    row.className = "prediction-row";
    const label = document.createElement("span");
    label.textContent = state.itemMap.get(candidate.ruleId)?.name || candidate.label || "その他・不明";
    const track = document.createElement("div");
    track.className = "confidence-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("div");
    fill.className = "confidence-fill";
    fill.style.width = formatPercent(candidate.probability);
    track.append(fill);
    const percent = document.createElement("strong");
    percent.textContent = formatPercent(candidate.probability);
    row.append(label, track, percent);
    list.append(row);
  });
  elements.aiResults.append(list);
  const note = document.createElement("p");
  note.textContent = safeCandidate
    ? "最上位候補を確認してください。分別方法は、次の登録済み公式ルールから表示します。"
    : `${assessment.reason} 品目名検索を利用してください。`;
  elements.aiResults.append(note);

  const actions = document.createElement("div");
  actions.className = "candidate-actions";
  if (safeCandidate) {
    const topItem = state.itemMap.get(assessment.candidates[0].ruleId);
    if (topItem) {
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "primary-button";
      yes.textContent = `はい、${topItem.name}です`;
      yes.addEventListener("click", () => selectItem(topItem));
      actions.append(yes);
    }
    assessment.candidates.slice(1).forEach((candidate) => {
      const item = state.itemMap.get(candidate.ruleId);
      if (!item) return;
      const alternative = document.createElement("button");
      alternative.type = "button";
      alternative.className = "candidate-button";
      alternative.textContent = item.name;
      alternative.addEventListener("click", () => selectItem(item));
      actions.append(alternative);
    });
  }
  const no = document.createElement("button");
  no.type = "button";
  no.className = "secondary-button";
  no.textContent = safeCandidate ? "違います・品目名から探す" : "品目名から探す";
  no.addEventListener("click", () => switchTab("search", true));
  actions.append(no);
  elements.aiResults.append(actions);
  elements.aiResults.hidden = false;
  setAIStatus(safeCandidate ? "ready" : "warning", safeCandidate ? "候補を表示しました" : "低確信度または対象外です", safeCandidate ? "品目が合っているか確認してください。" : "無理に断定せず、手動検索へ切り替えます。");
}

function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = null;
  state.selectedItem = null;
  elements.imageInput.value = "";
  elements.imagePreview.removeAttribute("src");
  elements.previewFigure.hidden = true;
  elements.aiResults.hidden = true;
  elements.aiResults.replaceChildren();
  elements.searchInput.value = "";
  elements.searchResults.replaceChildren();
  elements.decisionSection.hidden = true;
  elements.resultSection.hidden = true;
  switchTab("photo");
  initializeAI();
  document.querySelector("#main").scrollIntoView({ block: "start" });
}

function registerWebMCPTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const report = (error) => console.error("WebMCP registration failed", error);
  try {
    void Promise.resolve(context.registerTool({
      name: "search_garbage_item",
      title: "ごみ品目を検索",
      description: "足利市の登録済み家庭ごみデータから品目名を検索し、画面に候補を表示します。",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input.query !== "string" || !input.query.trim()) throw new Error("queryが必要です。");
        switchTab("search");
        elements.searchInput.value = input.query;
        const matches = performSearch(input.query);
        return { matches: matches.map(({ item, score }) => ({ id: item.id, name: item.name, score })) };
      }
    })).catch(report);
  } catch (error) { report(error); }
}

elements.photoTab.addEventListener("click", () => switchTab("photo"));
elements.searchTab.addEventListener("click", () => switchTab("search"));
elements.goToSearchButton.addEventListener("click", () => switchTab("search", true));
elements.imageInput.addEventListener("change", (event) => handleImage(event.target.files?.[0]));
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(elements.searchInput.value);
});
elements.resetButton.addEventListener("click", resetApp);

setModeBadge();
await loadData();
await initializeAI();
registerWebMCPTools();

// テスト環境から同じ判定規則を確認できるよう、純粋関数だけを公開します。
export { assessPredictions, performSearch };
