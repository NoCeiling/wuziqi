"use strict";

const LOOPBACK_API_ORIGIN = "http://127.0.0.1:8770";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const CONFIGURED_API_ORIGIN = document.querySelector('meta[name="game-guide-studio-api-origin"]')?.content.trim() || "";
const API_ORIGIN = CONFIGURED_API_ORIGIN || (LOOPBACK_HOSTS.has(window.location.hostname) ? "" : LOOPBACK_API_ORIGIN);

const state = {
  sites: [],
  siteId: "",
  config: null,
  articles: [],
  items: [],
  itemById: new Map(),
  buildItems: {},
  current: null,
  currentSlug: "",
  currentLanguage: "zh-Hans",
  dirty: false,
  activeFilter: "all",
  aiMode: "clarity",
  previewTimer: null,
  backupTimer: null,
  toastTimer: null,
  slugTouched: false,
};

const BUILD_ROLES = [
  { id: "core", label: "核心成型件", help: "定义这套阵容，缺少后不能称为该构筑。" },
  { id: "engine", label: "启动或转型信号", help: "看到后可以考虑进入或转向这条路线。" },
  { id: "transition", label: "前中期过渡件", help: "成型前用于保持战力、经济或资源。" },
  { id: "support", label: "辅助补强件", help: "补足输出、防御、恢复或稳定性。" },
];

const PROFESSION_ITEM_CLASS = {
  "狂战士": "Berserker",
  "游侠": "Ranger",
  "法师": "Mage",
  "冒险家": "Adventurer",
  "火女": "Pyromancer",
  "收割者": "Reaper",
  "工程师": "Engineer",
};

const elements = Object.fromEntries(
  [
    "connectionState", "documentState", "saveButton", "buildButton", "themeToggle",
    "siteSelect", "siteLogo", "emptySiteLogo", "brandTitle", "releaseCheckButton",
    "articleSidebar", "sidebarToggle", "sidebarScrim", "articleCount", "articleSearch",
    "sectionFilter", "articleList", "newArticleButton", "emptyNewArticleButton",
    "emptyWorkspace", "emptyTitle", "emptyDescription", "documentWorkspace", "metadataPanel", "metadataTitle",
    "metadataSummary", "metadataSummaryState", "metadataForm", "metaTitle", "metaSummary",
    "summaryCount", "metaPreview", "metaSection", "professionField", "metaProfession",
    "metaArchetype", "metaCategory", "metaTags", "metaStatus", "metaSourceType",
    "metaSourceUrl", "metaFacts", "metaEditorial", "metaI18n", "metaNotes",
    "buildDataPanel", "buildDataSummary", "buildRequirementState", "buildRoleGrid",
    "recommendableControl", "recommendableToggle", "buildNotes",
    "languageSelect", "formatToolbar", "imageInput", "wordCount", "markdownEditor",
    "dropHint", "previewStatus", "articlePreview", "auditList", "previewPanel", "aiPanel",
    "aiAvailability", "aiModes", "optimizeButton", "aiEmpty", "aiResult",
    "newArticleDialog", "newArticleForm", "newTitle", "newSlug", "newSection",
    "newProfessionField", "newProfession", "newArchetype", "createArticleButton",
    "buildDialog", "buildDialogTitle", "buildDialogDescription", "closeBuildDialog", "buildOutput", "toast",
  ].map((id) => [id, document.getElementById(id)]),
);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function backendUrl(path) {
  const value = String(path || "");
  if (!value || /^(?:data:|blob:|https?:\/\/)/i.test(value)) return value;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return `${API_ORIGIN}${normalized}`;
}

function rewritePreviewAssets(container) {
  container.querySelectorAll("img[src], source[src]").forEach((element) => {
    const value = element.getAttribute("src") || "";
    if (!/^(?:\/?assets\/articles\/|\/?image-cache\/)/.test(value)) return;
    element.setAttribute("src", backendUrl(value));
  });
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(backendUrl(path), {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(state.siteId ? { "X-Guide-Site": state.siteId } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("无法连接本机 Studio，请确认 python studio.py 正在运行");
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.error || payload.output || `请求失败 (${response.status})`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function showToast(message, error = false) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
  elements.toast.classList.add("is-visible");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function setBusy(button, busy, busyLabel, normalLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : normalLabel;
}

function optionLabel(value) {
  const labels = {
    "needs-gameplay-crosscheck": "待实战复核",
    "needs-code-crosscheck": "待代码复核",
    ready: "已完成",
    pending: "待处理",
    "raw-guide-editorial-summary": "原始草稿整理",
    "bilibili-video-asr-editorial-summary": "B站视频 ASR 整理",
    "bilibili-video-metadata-editorial-summary": "B站视频元数据整理",
    "slides-editorial-summary": "演示文稿整理",
    "ppt-code-analysis": "PPT / 代码分析",
  };
  return labels[value] || value;
}

function fillSelect(select, values, selected = "", labeler = optionLabel) {
  select.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labeler(value);
    option.selected = value === selected;
    select.append(option);
  });
}

function initializeConfig(config) {
  state.config = config;
  fillSelect(elements.metaProfession, config.professions);
  fillSelect(elements.newProfession, config.professions);
  fillSelect(elements.metaSourceType, config.sourceTypes);
  fillSelect(elements.metaFacts, config.factReviewStates);
  fillSelect(elements.metaEditorial, config.editorialReviewStates);
  fillSelect(elements.metaI18n, config.editorialReviewStates);
  fillSelect(
    elements.languageSelect,
    Object.keys(config.languages),
    "zh-Hans",
    (language) => config.languages[language].label,
  );
  elements.aiAvailability.textContent = config.ai.configured
    ? `已连接 ${config.ai.model}。建议会先展示，确认后再应用。`
    : "未配置 OPENAI_API_KEY。仍可生成完整优化指令并复制给 AI。";
  const canEdit = config.capabilities?.editor === true;
  elements.newArticleButton.disabled = !canEdit;
  elements.emptyNewArticleButton.classList.toggle("is-hidden", !canEdit);
  elements.buildButton.disabled = config.capabilities?.build !== true;
  elements.releaseCheckButton.disabled = config.capabilities?.release !== true;
}

function articleStatusLabel(status) {
  return { draft: "草稿", published: "已发布", archived: "已归档" }[status] || status;
}

function renderArticleList() {
  if (state.config?.capabilities?.editor !== true) {
    elements.articleCount.textContent = "发布适配器";
    elements.articleList.innerHTML = `<div class="list-empty">${escapeHtml(state.config?.notice || "当前站点尚未接入文章编辑。")}</div>`;
    return;
  }
  const query = elements.articleSearch.value.trim().toLowerCase();
  const filtered = state.articles.filter((article) => {
    if (state.activeFilter !== "all" && article.section !== state.activeFilter) return false;
    const haystack = `${article.title} ${article.slug} ${article.profession}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  elements.articleCount.textContent = `${filtered.length} / ${state.articles.length} 篇`;
  if (!filtered.length) {
    elements.articleList.innerHTML = '<div class="list-empty">没有匹配的文章。<br>可以调整筛选或新建草稿。</div>';
    return;
  }
  elements.articleList.innerHTML = filtered.map((article) => {
    const section = article.section === "builds" ? (article.profession || "构筑") : "秘闻";
    const filterStatus = article.section === "builds" && article.recommendable
      ? '<span class="filter-status">可筛选</span>'
      : "";
    return `
      <button class="article-list-item${article.slug === state.currentSlug ? " is-active" : ""}" type="button" data-slug="${escapeHtml(article.slug)}">
        <strong>${escapeHtml(article.title)}</strong>
        <small><span>${escapeHtml(section)} · ${escapeHtml(article.dateModified || "未标日期")}</span><span class="article-list-states">${filterStatus}<span class="status-label">${escapeHtml(articleStatusLabel(article.status))}</span></span></small>
      </button>`;
  }).join("");
}

async function refreshArticles() {
  const payload = await api("/api/articles");
  state.articles = payload.articles;
  renderArticleList();
}

function emptyBuildItems() {
  return Object.fromEntries(BUILD_ROLES.map((role) => [role.id, []]));
}

function normalizeBuildItems(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = emptyBuildItems();
  const seen = new Set();
  BUILD_ROLES.forEach((role) => {
    const entries = Array.isArray(source[role.id]) ? source[role.id] : [];
    entries.forEach((rawEntry) => {
      const entry = typeof rawEntry === "string" ? { id: rawEntry } : rawEntry;
      const id = String(entry?.id || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      result[role.id].push({
        id,
        count: Math.max(1, Math.min(99, Number.parseInt(entry.count, 10) || 1)),
        note: String(entry.note || "").trim(),
      });
    });
  });
  return result;
}

function playerBuildNotes() {
  return elements.buildNotes.value
    .split(/\r?\n/)
    .map((note) => note.trim())
    .filter((note, index, notes) => note && notes.indexOf(note) === index);
}

function buildRequirements() {
  const missing = BUILD_ROLES
    .filter((role) => !state.buildItems[role.id]?.length)
    .map((role) => role.label);
  if (!playerBuildNotes().length) missing.push("玩家注意事项");
  if (!elements.metaArchetype.value.trim()) missing.push("流派 / 构筑名");
  return missing;
}

function itemImageMarkup(item) {
  if (!item?.image) return '<span class="build-item-image build-item-image--empty" aria-hidden="true">?</span>';
  return `<img class="build-item-image" src="${escapeHtml(backendUrl(item.image))}" alt="" loading="lazy">`;
}

function renderBuildRoles() {
  elements.buildRoleGrid.innerHTML = BUILD_ROLES.map((role) => {
    const entries = state.buildItems[role.id] || [];
    const rows = entries.length ? entries.map((entry) => {
      const item = state.itemById.get(entry.id);
      const displayName = item?.nameZh || item?.name || entry.id;
      return `
        <div class="build-item-row" data-role="${role.id}" data-item-id="${escapeHtml(entry.id)}">
          ${itemImageMarkup(item)}
          <span class="build-item-identity"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(entry.id)}</small></span>
          <label class="build-item-count"><span>数量</span><input type="number" min="1" max="99" value="${entry.count}" data-build-count aria-label="${escapeHtml(displayName)}数量"></label>
          <input class="build-item-note" value="${escapeHtml(entry.note || "")}" maxlength="160" data-build-item-note placeholder="作用说明（可选）" aria-label="${escapeHtml(displayName)}作用说明">
          <button class="build-item-remove" type="button" data-remove-build-item title="移除物品" aria-label="移除${escapeHtml(displayName)}">×</button>
        </div>`;
    }).join("") : '<p class="build-role-empty">尚未选择物品</p>';
    return `
      <section class="build-role-editor" data-build-role="${role.id}">
        <header><span><strong>${role.label}</strong><small>必填</small></span><p>${role.help}</p></header>
        <div class="build-role-items">${rows}</div>
        <div class="build-item-search">
          <label><span class="sr-only">搜索并添加${role.label}</span><input type="search" class="build-item-query" data-build-query placeholder="搜索中英文名称或物品 ID" autocomplete="off"></label>
          <div class="build-item-results" data-build-results hidden></div>
        </div>
      </section>`;
  }).join("");
  updateBuildDataState();
}

function updateBuildDataState() {
  const completedRoles = BUILD_ROLES.filter((role) => state.buildItems[role.id]?.length).length;
  const noteCount = playerBuildNotes().length;
  const missing = buildRequirements();
  elements.buildDataSummary.textContent = `${completedRoles}/4 类已填写 · ${noteCount ? `${noteCount} 条注意事项` : "缺少玩家注意事项"}`;
  elements.buildRequirementState.textContent = missing.length ? `加入筛选前还需补齐：${missing.join("、")}` : "构筑筛选资料完整";
  elements.buildRequirementState.classList.toggle("is-ready", !missing.length);
  elements.buildRequirementState.classList.toggle("is-error", Boolean(missing.length && elements.recommendableToggle.checked));
  elements.recommendableControl.classList.toggle("is-ready", elements.recommendableToggle.checked && !missing.length);
}

function renderBuildVisibility(section) {
  elements.buildDataPanel.classList.toggle("is-hidden", section !== "builds");
}

function itemClassScore(item) {
  const itemClass = PROFESSION_ITEM_CLASS[elements.metaProfession.value];
  if (!itemClass || elements.metaProfession.value === "通用") return 0;
  if (item.classes?.includes(itemClass)) return 30;
  if (item.classes?.includes("Neutral")) return 20;
  return 0;
}

function renderItemSearch(roleId, query) {
  const roleEditor = elements.buildRoleGrid.querySelector(`[data-build-role="${roleId}"]`);
  const results = roleEditor?.querySelector("[data-build-results]");
  if (!results) return;
  const needle = query.trim().toLowerCase();
  if (!needle) {
    results.hidden = true;
    results.replaceChildren();
    return;
  }
  const selected = new Set(BUILD_ROLES.flatMap((role) => state.buildItems[role.id].map((entry) => entry.id)));
  const matches = state.items
    .filter((item) => !selected.has(item.id))
    .map((item) => {
      const id = item.id.toLowerCase();
      const zh = item.nameZh.toLowerCase();
      const en = item.name.toLowerCase();
      const matchesQuery = id.includes(needle) || zh.includes(needle) || en.includes(needle);
      const exact = id === needle || zh === needle || en === needle;
      const starts = id.startsWith(needle) || zh.startsWith(needle) || en.startsWith(needle);
      return { item, matchesQuery, score: (exact ? 100 : starts ? 60 : 20) + itemClassScore(item) };
    })
    .filter((entry) => entry.matchesQuery)
    .sort((a, b) => b.score - a.score || a.item.nameZh.localeCompare(b.item.nameZh, "zh-CN"))
    .slice(0, 10);
  results.hidden = false;
  results.innerHTML = matches.length ? matches.map(({ item }) => `
    <button type="button" data-add-build-item data-role="${roleId}" data-item-id="${escapeHtml(item.id)}">
      ${itemImageMarkup(item)}
      <span><strong>${escapeHtml(item.nameZh)}</strong><small>${escapeHtml(item.name)} · ${escapeHtml(item.id)}</small></span>
      <span class="build-item-add" aria-hidden="true">+</span>
    </button>`).join("") : '<p>没有匹配物品</p>';
}

function addBuildItem(roleId, itemId) {
  const existingRole = BUILD_ROLES.find((role) => state.buildItems[role.id].some((entry) => entry.id === itemId));
  if (existingRole) {
    showToast(`该物品已经属于${existingRole.label}`, true);
    return;
  }
  state.buildItems[roleId].push({ id: itemId, count: 1, note: "" });
  renderBuildRoles();
  markDirty();
}

function removeBuildItem(roleId, itemId) {
  state.buildItems[roleId] = state.buildItems[roleId].filter((entry) => entry.id !== itemId);
  renderBuildRoles();
  markDirty();
}

function currentMetadata() {
  if (!state.current) return {};
  const metadata = { ...state.current.metadata };
  const isBuild = metadata.section === "builds";
  metadata.title = elements.metaTitle.value.trim();
  metadata.summary = elements.metaSummary.value.trim();
  metadata.preview = elements.metaPreview.value.trim();
  metadata.profession = isBuild ? elements.metaProfession.value : "";
  metadata.archetype = isBuild ? elements.metaArchetype.value.trim() : "";
  metadata.category = elements.metaCategory.value.trim();
  metadata.tags = elements.metaTags.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
  metadata.status = elements.metaStatus.value;
  metadata.sourceType = elements.metaSourceType.value;
  metadata.sourceUrl = elements.metaSourceUrl.value.trim();
  metadata.notes = elements.metaNotes.value.trim();
  if (isBuild) {
    metadata.recommendable = elements.recommendableToggle.checked;
    metadata.buildItems = Object.fromEntries(BUILD_ROLES.map((role) => [
      role.id,
      state.buildItems[role.id].map((entry) => ({
        id: entry.id,
        count: entry.count,
        ...(entry.note ? { note: entry.note } : {}),
      })),
    ]));
    metadata.buildNotes = playerBuildNotes();
  } else {
    delete metadata.recommendable;
    delete metadata.buildItems;
    delete metadata.buildNotes;
  }
  metadata.review = {
    ...(metadata.review || {}),
    facts: elements.metaFacts.value,
    editorial: elements.metaEditorial.value,
    i18n: elements.metaI18n.value,
  };
  return metadata;
}

function setSegment(container, value) {
  container.querySelectorAll("button[data-value]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === value);
  });
}

function renderMetadata() {
  const metadata = state.current.metadata;
  elements.metaTitle.value = metadata.title || "";
  elements.metaSummary.value = metadata.summary || "";
  elements.metaPreview.value = metadata.preview || "";
  elements.metaProfession.value = metadata.profession || state.config.professions[0];
  elements.metaArchetype.value = metadata.archetype || "";
  elements.metaCategory.value = metadata.category || "";
  elements.metaTags.value = Array.isArray(metadata.tags) ? metadata.tags.join("，") : "";
  elements.metaStatus.value = metadata.status || "draft";
  elements.metaSourceType.value = metadata.sourceType || state.config.sourceTypes[0];
  elements.metaSourceUrl.value = metadata.sourceUrl || "";
  elements.metaFacts.value = metadata.review?.facts || (metadata.section === "builds" ? "needs-gameplay-crosscheck" : "needs-code-crosscheck");
  elements.metaEditorial.value = metadata.review?.editorial || "pending";
  elements.metaI18n.value = metadata.review?.i18n || "pending";
  elements.metaNotes.value = metadata.notes || "";
  state.buildItems = normalizeBuildItems(metadata.buildItems);
  elements.buildNotes.value = Array.isArray(metadata.buildNotes) ? metadata.buildNotes.join("\n") : "";
  elements.recommendableToggle.checked = metadata.recommendable === true;
  elements.metadataTitle.textContent = metadata.title || "文章信息";
  elements.metadataSummary.textContent = `${metadata.section === "builds" ? "构筑" : "秘闻"} · ${metadata.slug}`;
  setSegment(elements.metaSection, metadata.section);
  elements.professionField.classList.toggle("is-hidden", metadata.section !== "builds");
  renderBuildVisibility(metadata.section);
  renderBuildRoles();
  updateCounts();
}

function renderLanguageSelect() {
  const languages = Object.keys(state.config.languages);
  const existing = new Set(Object.keys(state.current.content));
  fillSelect(
    elements.languageSelect,
    languages,
    state.currentLanguage,
    (language) => `${state.config.languages[language].label}${existing.has(language) ? "" : "（新）"}`,
  );
}

function backupKey() {
  return state.currentSlug ? `article-studio:${state.currentSlug}` : "";
}

function saveLocalBackup() {
  if (!state.current || !state.dirty) return;
  state.current.content[state.currentLanguage] = elements.markdownEditor.value;
  localStorage.setItem(backupKey(), JSON.stringify({
    savedAt: Date.now(),
    language: state.currentLanguage,
    metadata: currentMetadata(),
    content: state.current.content,
  }));
}

function clearLocalBackup() {
  const key = backupKey();
  if (key) localStorage.removeItem(key);
}

function maybeRestoreBackup() {
  const raw = localStorage.getItem(backupKey());
  if (!raw) return;
  try {
    const backup = JSON.parse(raw);
    if (!backup.content || !window.confirm("检测到这篇文章有未保存的本地草稿，是否恢复？")) return;
    state.current.metadata = { ...state.current.metadata, ...(backup.metadata || {}) };
    state.current.content = { ...state.current.content, ...backup.content };
    state.currentLanguage = backup.language || "zh-Hans";
    renderMetadata();
    renderLanguageSelect();
    elements.markdownEditor.value = state.current.content[state.currentLanguage] || "";
    markDirty();
    showToast("已恢复本地草稿");
  } catch {
    localStorage.removeItem(backupKey());
  }
}

function updateDocumentState() {
  if (!state.current) {
    elements.documentState.textContent = "未选择文章";
    elements.documentState.classList.remove("is-dirty");
    elements.saveButton.disabled = true;
    return;
  }
  const label = state.dirty ? "有未保存修改" : `已保存 · ${state.current.metadata.dateModified || "今天"}`;
  elements.documentState.textContent = `${state.current.metadata.title} · ${label}`;
  elements.documentState.classList.toggle("is-dirty", state.dirty);
  elements.saveButton.disabled = false;
}

function updateCounts() {
  const markdown = elements.markdownEditor.value || "";
  const count = markdown.replace(/\s+/g, "").length;
  elements.wordCount.textContent = `${count.toLocaleString("zh-CN")} 字`;
  elements.summaryCount.textContent = String(elements.metaSummary.value.length);
}

function markDirty() {
  if (!state.current) return;
  state.dirty = true;
  state.current.content[state.currentLanguage] = elements.markdownEditor.value;
  updateDocumentState();
  updateCounts();
  schedulePreview();
  clearTimeout(state.backupTimer);
  state.backupTimer = setTimeout(saveLocalBackup, 700);
}

function closeSidebar() {
  elements.articleSidebar.classList.remove("is-open");
  elements.sidebarScrim.classList.remove("is-open");
}

async function loadArticle(slug) {
  if (state.config?.capabilities?.editor !== true) return;
  if (slug === state.currentSlug) {
    closeSidebar();
    return;
  }
  if (state.dirty && !window.confirm("当前修改尚未保存，确定切换文章吗？")) return;
  elements.documentState.textContent = "正在读取文章";
  try {
    const payload = await api(`/api/articles/${encodeURIComponent(slug)}`);
    state.current = payload;
    state.currentSlug = slug;
    state.currentLanguage = payload.content["zh-Hans"] ? "zh-Hans" : (Object.keys(payload.content)[0] || "zh-Hans");
    state.dirty = false;
    elements.emptyWorkspace.classList.add("is-hidden");
    elements.documentWorkspace.classList.remove("is-hidden");
    renderMetadata();
    renderLanguageSelect();
    elements.markdownEditor.value = payload.content[state.currentLanguage] || `# ${payload.metadata.title}\n\n`;
    renderArticleList();
    updateDocumentState();
    updateCounts();
    maybeRestoreBackup();
    schedulePreview(true);
    closeSidebar();
  } catch (error) {
    showToast(error.message, true);
    updateDocumentState();
  }
}

function renderAudit(issues) {
  if (!issues?.length) {
    elements.auditList.innerHTML = '<p class="audit-clean">当前没有发现发布阻断项。</p>';
    return;
  }
  elements.auditList.innerHTML = issues.map((issue) => `
    <div class="audit-item${issue.level === "error" ? " is-error" : ""}">
      <strong>${issue.level === "error" ? "需修复" : "请检查"}</strong>
      <span>${escapeHtml(issue.message)}</span>
    </div>`).join("");
}

function schedulePreview(immediate = false) {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, immediate ? 0 : 260);
}

async function renderPreview() {
  if (!state.current) return;
  const markdown = elements.markdownEditor.value;
  elements.previewStatus.textContent = "正在更新预览";
  try {
    const payload = await api("/api/preview", {
      method: "POST",
      body: JSON.stringify({ markdown, metadata: currentMetadata() }),
    });
    elements.articlePreview.innerHTML = payload.html || '<p class="list-empty">正文为空</p>';
    rewritePreviewAssets(elements.articlePreview);
    elements.previewStatus.textContent = `实时预览 · ${state.config.languages[state.currentLanguage].label}`;
    renderAudit(payload.audit);
  } catch (error) {
    elements.previewStatus.textContent = "预览失败";
    elements.articlePreview.innerHTML = `<p class="list-error">${escapeHtml(error.message)}</p>`;
  }
}

async function saveArticle() {
  if (!state.current) return false;
  setBusy(elements.saveButton, true, "保存中", "保存");
  state.current.content[state.currentLanguage] = elements.markdownEditor.value;
  try {
    const payload = await api(`/api/articles/${encodeURIComponent(state.currentSlug)}`, {
      method: "PUT",
      body: JSON.stringify({
        metadata: currentMetadata(),
        language: state.currentLanguage,
        markdown: elements.markdownEditor.value,
        content: state.current.content,
      }),
    });
    state.current = payload;
    state.dirty = false;
    clearLocalBackup();
    renderMetadata();
    renderLanguageSelect();
    updateDocumentState();
    renderAudit(payload.audit);
    await refreshArticles();
    showToast("文章已保存到 CMS 源文件");
    return true;
  } catch (error) {
    showToast(error.message, true);
    return false;
  } finally {
    setBusy(elements.saveButton, false, "保存中", "保存");
    updateDocumentState();
  }
}

function replaceSelection(before, after = "", placeholder = "文本") {
  const editor = elements.markdownEditor;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end) || placeholder;
  editor.setRangeText(`${before}${selected}${after}`, start, end, "end");
  editor.focus();
  markDirty();
}

function prefixSelectedLines(prefixer) {
  const editor = elements.markdownEditor;
  const start = editor.value.lastIndexOf("\n", Math.max(0, editor.selectionStart - 1)) + 1;
  let end = editor.value.indexOf("\n", editor.selectionEnd);
  if (end < 0) end = editor.value.length;
  const lines = editor.value.slice(start, end).split("\n");
  const replacement = lines.map((line, index) => `${prefixer(index)}${line}`).join("\n");
  editor.setRangeText(replacement, start, end, "select");
  editor.focus();
  markDirty();
}

function runFormatCommand(command) {
  if (!state.current) return;
  if (command === "h2") return prefixSelectedLines(() => "## ");
  if (command === "h3") return prefixSelectedLines(() => "### ");
  if (command === "bold") return replaceSelection("**", "**", "重点内容");
  if (command === "italic") return replaceSelection("*", "*", "强调内容");
  if (command === "bullet") return prefixSelectedLines(() => "- ");
  if (command === "number") return prefixSelectedLines((index) => `${index + 1}. `);
  if (command === "quote") return prefixSelectedLines(() => "> ");
  if (command === "table") {
    return replaceSelection(
      "\n| 阶段 | 目标 | 检查点 |\n| --- | --- | --- |\n| 前期 |  |  |\n| 中期 |  |  |\n| 后期 |  |  |\n",
      "",
      "",
    );
  }
  if (command === "link") {
    const url = window.prompt("输入链接地址", "https://");
    if (url) replaceSelection("[", `](${url})`, "链接文字");
    return;
  }
  if (command === "image") elements.imageInput.click();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  if (!state.current) return;
  if (!file.type.startsWith("image/")) {
    showToast("请选择 PNG、JPEG、WebP 或 GIF 图片", true);
    return;
  }
  showToast("正在上传图片");
  try {
    const data = await readFileAsBase64(file);
    const payload = await api(`/api/articles/${encodeURIComponent(state.currentSlug)}/images`, {
      method: "POST",
      body: JSON.stringify({ filename: file.name, contentType: file.type, data }),
    });
    const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, " ").trim() || "文章图片";
    const markdown = payload.markdown.replace("图片说明", alt);
    replaceSelection("\n", "\n", markdown);
    showToast("图片已上传并插入正文");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.imageInput.value = "";
  }
}

function switchReviewTab(tab) {
  document.querySelectorAll("[data-review-tab]").forEach((button) => {
    const active = button.dataset.reviewTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.previewPanel.classList.toggle("is-hidden", tab !== "preview");
  elements.aiPanel.classList.toggle("is-hidden", tab !== "ai");
}

function renderAiPrompt(prompt, fallbackReason = "") {
  elements.aiEmpty.classList.add("is-hidden");
  elements.aiResult.classList.remove("is-hidden");
  elements.aiResult.innerHTML = `
    <h3>可复制的优化指令</h3>
    <p>${fallbackReason ? `直接建议暂不可用：${escapeHtml(fallbackReason)}。` : "当前未配置 API 密钥。"}下面的指令已经包含分区、来源、复核状态和正文。</p>
    <textarea id="aiPromptOutput" readonly>${escapeHtml(prompt)}</textarea>
    <div class="ai-result-actions"><button class="secondary-button full-width" id="copyAiPrompt" type="button">复制指令</button></div>`;
  document.getElementById("copyAiPrompt").addEventListener("click", async () => {
    await navigator.clipboard.writeText(prompt);
    showToast("优化指令已复制");
  });
}

function renderAiSuggestion(suggestion, model) {
  const changes = Array.isArray(suggestion.changes) ? suggestion.changes : [];
  elements.aiEmpty.classList.add("is-hidden");
  elements.aiResult.classList.remove("is-hidden");
  elements.aiResult.innerHTML = `
    <p>由 ${escapeHtml(model)} 生成。应用前请检查事实与来源。</p>
    <h3>建议标题</h3><p>${escapeHtml(suggestion.title)}</p>
    <h3>建议摘要</h3><p>${escapeHtml(suggestion.summary)}</p>
    <h3>主要修改</h3>
    <ul>${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}</ul>
    <h3>建议正文</h3>
    <textarea id="aiMarkdownOutput" readonly>${escapeHtml(suggestion.markdown)}</textarea>
    <div class="ai-result-actions">
      <button class="secondary-button" id="copyAiResult" type="button">复制正文</button>
      <button class="primary-button" id="applyAiResult" type="button">应用建议</button>
    </div>`;
  document.getElementById("copyAiResult").addEventListener("click", async () => {
    await navigator.clipboard.writeText(suggestion.markdown || "");
    showToast("建议正文已复制");
  });
  document.getElementById("applyAiResult").addEventListener("click", () => {
    const metadata = currentMetadata();
    state.current.metadata = {
      ...metadata,
      title: suggestion.title || metadata.title,
      summary: suggestion.summary || metadata.summary,
      preview: suggestion.preview || metadata.preview,
    };
    elements.markdownEditor.value = suggestion.markdown || elements.markdownEditor.value;
    state.current.content[state.currentLanguage] = elements.markdownEditor.value;
    renderMetadata();
    markDirty();
    switchReviewTab("preview");
    showToast("AI 建议已应用，保存前仍可撤销或修改");
  });
}

async function optimizeArticle() {
  if (!state.current) return;
  setBusy(elements.optimizeButton, true, "处理中", "开始优化");
  elements.aiEmpty.classList.remove("is-hidden");
  elements.aiEmpty.innerHTML = "<p>正在整理文章上下文并检查来源约束。</p>";
  elements.aiResult.classList.add("is-hidden");
  try {
    const payload = await api("/api/ai/optimize", {
      method: "POST",
      body: JSON.stringify({
        metadata: currentMetadata(),
        markdown: elements.markdownEditor.value,
        language: state.currentLanguage,
        mode: state.aiMode,
      }),
    });
    if (payload.configured) renderAiSuggestion(payload.suggestion, payload.model);
    else renderAiPrompt(payload.prompt, payload.fallbackReason || "");
  } catch (error) {
    elements.aiEmpty.innerHTML = `<p class="list-error">${escapeHtml(error.message)}</p>`;
    showToast(error.message, true);
  } finally {
    setBusy(elements.optimizeButton, false, "处理中", "开始优化");
  }
}

function openNewArticleDialog() {
  state.slugTouched = false;
  elements.newArticleForm.reset();
  elements.newProfession.value = state.config.professions[0];
  setSegment(elements.newSection, "builds");
  elements.newProfessionField.classList.remove("is-hidden");
  elements.newArticleDialog.showModal();
  setTimeout(() => elements.newTitle.focus(), 0);
}

function suggestedSlug(title) {
  const ascii = title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  if (ascii.length >= 8) return `backpack-battles-${ascii}`.slice(0, 90).replace(/-$/, "");
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `backpack-battles-${stamp}-new-guide`;
}

async function createArticle(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    elements.newArticleDialog.close();
    return;
  }
  if (!elements.newArticleForm.reportValidity()) return;
  setBusy(elements.createArticleButton, true, "创建中", "创建草稿");
  const section = elements.newSection.querySelector("button.is-active")?.dataset.value || "builds";
  try {
    const payload = await api("/api/articles", {
      method: "POST",
      body: JSON.stringify({
        title: elements.newTitle.value.trim(),
        slug: elements.newSlug.value.trim(),
        section,
        profession: section === "builds" ? elements.newProfession.value : "",
        archetype: elements.newArchetype.value.trim(),
      }),
    });
    elements.newArticleDialog.close();
    await refreshArticles();
    state.current = payload;
    state.currentSlug = payload.metadata.slug;
    state.currentLanguage = "zh-Hans";
    state.dirty = false;
    elements.emptyWorkspace.classList.add("is-hidden");
    elements.documentWorkspace.classList.remove("is-hidden");
    renderMetadata();
    renderLanguageSelect();
    elements.markdownEditor.value = payload.content["zh-Hans"] || "";
    updateDocumentState();
    updateCounts();
    renderArticleList();
    schedulePreview(true);
    showToast("草稿已创建");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.createArticleButton, false, "创建中", "创建草稿");
  }
}

async function buildSite() {
  if (state.current && state.dirty) {
    const saved = await saveArticle();
    if (!saved) return;
  }
  setBusy(elements.buildButton, true, "构建中", "构建站点");
  elements.buildDialogTitle.textContent = `${state.config.site.name} · 构建结果`;
  elements.buildDialogDescription.textContent = "构建只更新本地源站文件，不会提交或推送。";
  elements.buildOutput.textContent = "正在运行该站点注册的构建命令";
  elements.buildDialog.showModal();
  try {
    const payload = await api("/api/build", { method: "POST", body: "{}" });
    elements.buildOutput.textContent = payload.output || "构建完成";
    showToast("CMS 站点文件已生成");
  } catch (error) {
    elements.buildOutput.textContent = error.payload?.output || error.message;
    showToast("构建失败，请查看结果", true);
  } finally {
    setBusy(elements.buildButton, false, "构建中", "构建站点");
  }
}

async function checkRelease() {
  setBusy(elements.releaseCheckButton, true, "检查中", "发布检查");
  elements.buildDialogTitle.textContent = `${state.config?.site?.name || "当前站点"} · 发布检查`;
  elements.buildDialogDescription.textContent = "这是只读检查，不会暂存、提交、推送或触发部署。";
  elements.buildOutput.textContent = "正在检查站点、分支、Git 远程和 Vercel 连接";
  elements.buildDialog.showModal();
  try {
    const status = await api("/api/release/status");
    const lines = [
      `站点：${status.name} (${status.id})`,
      `域名：${status.domain}`,
      `目录：${status.root}`,
      `分支：${status.branch || "未识别"}${status.expectedBranch ? ` / 要求 ${status.expectedBranch}` : ""}`,
      `远程：${status.remote?.name || "origin"} -> ${status.remote?.url || "未配置"}`,
      `Vercel：${status.vercel?.linked ? `已连接 ${status.vercel.projectName || "项目"}` : "未连接"}`,
      `工作区变更：${status.changedFiles} 项`,
      `发布状态：${status.ready ? "可以进入 dry-run" : "已阻止"}`,
    ];
    if (status.blockers?.length) lines.push("", "阻断原因：", ...status.blockers.map((item) => `- ${item}`));
    lines.push("", "实际发布由 publish-game-guides Skill 执行，并且先做 dry-run。");
    elements.buildOutput.textContent = lines.join("\n");
  } catch (error) {
    elements.buildOutput.textContent = error.message;
    showToast("发布检查失败", true);
  } finally {
    setBusy(elements.releaseCheckButton, false, "检查中", "发布检查");
  }
}

function resetWorkspaceForSite() {
  state.current = null;
  state.currentSlug = "";
  state.currentLanguage = "zh-Hans";
  state.dirty = false;
  state.articles = [];
  state.items = [];
  state.itemById = new Map();
  state.buildItems = emptyBuildItems();
  elements.documentWorkspace.classList.add("is-hidden");
  elements.emptyWorkspace.classList.remove("is-hidden");
  elements.saveButton.disabled = true;
  elements.documentState.textContent = "未选择文章";
  elements.documentState.classList.remove("is-dirty");
}

async function loadSite() {
  resetWorkspaceForSite();
  elements.connectionState.textContent = "正在连接本地站点";
  elements.articleList.innerHTML = '<div class="list-skeleton" aria-label="正在读取文章"><span></span><span></span><span></span><span></span></div>';
  try {
    const [config, articles, items] = await Promise.all([
      api("/api/config"),
      api("/api/articles"),
      api("/api/items"),
    ]);
    initializeConfig(config);
    state.articles = articles.articles;
    state.items = items.items;
    state.itemById = new Map(state.items.map((item) => [item.id, item]));
    const logoUrl = backendUrl(`/api/site-logo?site=${encodeURIComponent(state.siteId)}`);
    elements.siteLogo.src = logoUrl;
    elements.emptySiteLogo.src = logoUrl;
    elements.brandTitle.textContent = config.site.name;
    document.title = `Game Guide Studio | ${config.site.name}`;
    const canEdit = config.capabilities?.editor === true;
    elements.emptyTitle.textContent = canEdit ? "选择文章开始编辑" : "站点发布流程已接入";
    elements.emptyDescription.textContent = canEdit
      ? "也可以新建一篇构筑或秘闻草稿。"
      : config.notice;
    const releaseLabel = config.site.release?.ready ? "发布检查通过" : "发布存在阻断";
    elements.connectionState.textContent = canEdit
      ? `本地 CMS 已连接 · ${state.articles.length} 篇文章 · ${state.items.length} 件物品 · ${releaseLabel}`
      : `已接入构建与发布检查 · ${releaseLabel}`;
    renderArticleList();
  } catch (error) {
    elements.connectionState.textContent = "本地站点连接失败";
    elements.articleList.innerHTML = `<div class="list-error">${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
  }
}

async function switchSite(nextSiteId) {
  if (nextSiteId === state.siteId) return;
  if (state.dirty && !window.confirm("当前文章有未保存修改，确认切换站点吗？")) {
    elements.siteSelect.value = state.siteId;
    return;
  }
  state.siteId = nextSiteId;
  localStorage.setItem("game-guide-studio-site", nextSiteId);
  await loadSite();
}

function bindEvents() {
  elements.articleSearch.addEventListener("input", renderArticleList);
  elements.sectionFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.activeFilter = button.dataset.filter;
    elements.sectionFilter.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    renderArticleList();
  });
  elements.articleList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-slug]");
    if (button) loadArticle(button.dataset.slug);
  });
  elements.newArticleButton.addEventListener("click", openNewArticleDialog);
  elements.emptyNewArticleButton.addEventListener("click", openNewArticleDialog);
  elements.newArticleForm.addEventListener("submit", createArticle);
  elements.newTitle.addEventListener("input", () => {
    if (!state.slugTouched) elements.newSlug.value = suggestedSlug(elements.newTitle.value);
  });
  elements.newSlug.addEventListener("input", () => { state.slugTouched = true; });
  elements.newSection.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    setSegment(elements.newSection, button.dataset.value);
    elements.newProfessionField.classList.toggle("is-hidden", button.dataset.value !== "builds");
  });

  elements.metadataForm.addEventListener("input", markDirty);
  elements.metadataForm.addEventListener("change", markDirty);
  elements.metaArchetype.addEventListener("input", updateBuildDataState);
  elements.recommendableControl.addEventListener("click", (event) => event.stopPropagation());
  elements.recommendableToggle.addEventListener("change", () => {
    const missing = buildRequirements();
    if (elements.recommendableToggle.checked && missing.length) {
      elements.recommendableToggle.checked = false;
      updateBuildDataState();
      showToast(`加入物品筛选前请补齐：${missing.join("、")}`, true);
      return;
    }
    updateBuildDataState();
    markDirty();
  });
  elements.buildNotes.addEventListener("input", () => {
    updateBuildDataState();
    markDirty();
  });
  elements.buildRoleGrid.addEventListener("input", (event) => {
    const roleEditor = event.target.closest("[data-build-role]");
    if (!roleEditor) return;
    const roleId = roleEditor.dataset.buildRole;
    if (event.target.matches("[data-build-query]")) {
      renderItemSearch(roleId, event.target.value);
      return;
    }
    const row = event.target.closest("[data-item-id]");
    const entry = state.buildItems[roleId].find((item) => item.id === row?.dataset.itemId);
    if (!entry) return;
    if (event.target.matches("[data-build-count]")) {
      entry.count = Math.max(1, Math.min(99, Number.parseInt(event.target.value, 10) || 1));
    }
    if (event.target.matches("[data-build-item-note]")) entry.note = event.target.value.trim();
    markDirty();
  });
  elements.buildRoleGrid.addEventListener("change", (event) => {
    if (!event.target.matches("[data-build-count]")) return;
    event.target.value = String(Math.max(1, Math.min(99, Number.parseInt(event.target.value, 10) || 1)));
  });
  elements.buildRoleGrid.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-build-item]");
    if (addButton) {
      addBuildItem(addButton.dataset.role, addButton.dataset.itemId);
      return;
    }
    const removeButton = event.target.closest("[data-remove-build-item]");
    const row = removeButton?.closest("[data-item-id]");
    const roleEditor = removeButton?.closest("[data-build-role]");
    if (row && roleEditor) removeBuildItem(roleEditor.dataset.buildRole, row.dataset.itemId);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".build-item-search")) return;
    elements.buildRoleGrid.querySelectorAll("[data-build-results]").forEach((result) => { result.hidden = true; });
  });
  elements.metaSection.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button || !state.current) return;
    state.current.metadata.section = button.dataset.value;
    setSegment(elements.metaSection, button.dataset.value);
    elements.professionField.classList.toggle("is-hidden", button.dataset.value !== "builds");
    renderBuildVisibility(button.dataset.value);
    if (button.dataset.value === "builds" && elements.metaFacts.value === "needs-code-crosscheck") {
      elements.metaFacts.value = "needs-gameplay-crosscheck";
    }
    if (button.dataset.value === "secrets" && elements.metaFacts.value === "needs-gameplay-crosscheck") {
      elements.metaFacts.value = "needs-code-crosscheck";
    }
    markDirty();
  });
  elements.metaSummary.addEventListener("input", updateCounts);
  elements.markdownEditor.addEventListener("input", markDirty);
  elements.languageSelect.addEventListener("change", () => {
    state.current.content[state.currentLanguage] = elements.markdownEditor.value;
    state.currentLanguage = elements.languageSelect.value;
    if (!(state.currentLanguage in state.current.content)) {
      state.current.content[state.currentLanguage] = `# ${elements.metaTitle.value.trim()}\n\n`;
      state.dirty = true;
    }
    elements.markdownEditor.value = state.current.content[state.currentLanguage];
    updateDocumentState();
    updateCounts();
    schedulePreview(true);
  });
  elements.formatToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-command]");
    if (button) runFormatCommand(button.dataset.command);
  });
  elements.imageInput.addEventListener("change", () => {
    if (elements.imageInput.files[0]) uploadImage(elements.imageInput.files[0]);
  });
  elements.markdownEditor.addEventListener("paste", (event) => {
    const file = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"))?.getAsFile();
    if (file) {
      event.preventDefault();
      uploadImage(file);
    }
  });
  const writingPane = elements.markdownEditor.closest(".writing-pane");
  ["dragenter", "dragover"].forEach((name) => writingPane.addEventListener(name, (event) => {
    event.preventDefault();
    writingPane.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((name) => writingPane.addEventListener(name, (event) => {
    event.preventDefault();
    writingPane.classList.remove("is-dragging");
  }));
  writingPane.addEventListener("drop", (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
    if (file) uploadImage(file);
  });

  elements.saveButton.addEventListener("click", saveArticle);
  elements.buildButton.addEventListener("click", buildSite);
  elements.releaseCheckButton.addEventListener("click", checkRelease);
  elements.siteSelect.addEventListener("change", () => switchSite(elements.siteSelect.value));
  elements.closeBuildDialog.addEventListener("click", () => elements.buildDialog.close());
  document.querySelectorAll("[data-review-tab]").forEach((button) => {
    button.addEventListener("click", () => switchReviewTab(button.dataset.reviewTab));
  });
  elements.aiModes.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-ai-mode]");
    if (!button) return;
    state.aiMode = button.dataset.aiMode;
    elements.aiModes.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
  elements.optimizeButton.addEventListener("click", optimizeArticle);

  elements.sidebarToggle.addEventListener("click", () => {
    elements.articleSidebar.classList.add("is-open");
    elements.sidebarScrim.classList.add("is-open");
  });
  elements.sidebarScrim.addEventListener("click", closeSidebar);
  document.querySelectorAll("[data-mobile-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mobileMode;
      document.body.dataset.mobileView = mode;
      document.querySelectorAll("[data-mobile-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
      if (mode === "preview") switchReviewTab("preview");
      if (mode === "ai") switchReviewTab("ai");
    });
  });
  elements.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("article-studio-theme", next);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveArticle();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function initialize() {
  const savedTheme = localStorage.getItem("article-studio-theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  bindEvents();
  try {
    const payload = await api("/api/sites");
    state.sites = payload.sites;
    const storedSite = localStorage.getItem("game-guide-studio-site");
    state.siteId = state.sites.some((site) => site.id === storedSite) ? storedSite : payload.defaultSite;
    fillSelect(elements.siteSelect, state.sites.map((site) => site.id), state.siteId, (siteId) => {
      const site = state.sites.find((entry) => entry.id === siteId);
      return `${site.name}${site.ready ? "" : " · 待配置"}`;
    });
    await loadSite();
  } catch (error) {
    elements.connectionState.textContent = "站点注册表读取失败";
    elements.articleList.innerHTML = `<div class="list-error">${escapeHtml(error.message)}</div>`;
    showToast(error.message, true);
  }
}

initialize();
