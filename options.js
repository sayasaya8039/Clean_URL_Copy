const button = document.getElementById("collect");
const selectModeBtn = document.getElementById("select-mode");
const copySelectedBtn = document.getElementById("copy-selected");
const viewSelectedBtn = document.getElementById("view-selected");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
let currentSource = "page";

// デバッグ: ボタン要素が正しく取得できているか確認
console.log("viewSelectedBtn element:", viewSelectedBtn);
if (!viewSelectedBtn) {
  console.error("viewSelectedBtn element not found!");
}

// 「URLを取得して一覧表示」も「選択範囲のURLをクリア」と同等に動かす
button.addEventListener("click", clearSelectedUrls);
selectModeBtn.addEventListener("click", startSelectionMode);
copySelectedBtn.addEventListener("click", copySelected);
viewSelectedBtn.addEventListener("click", viewSelectedUrls);
document.addEventListener("DOMContentLoaded", async () => {
  // まず選択範囲のURLを確認（確実に待つ）
  const hasSelected = await checkSelectedUrls();
  if (!hasSelected) {
    // 選択範囲のURLがない場合のみ通常のURL取得
    await collectUrls(true);
  }

  // ストレージの変更を監視して、選択範囲のURLが更新されたときに自動更新
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && (changes.selectedUrls || changes.urlSource)) {
      // 選択範囲のURLが更新された場合、表示を更新
      // urlSourceが"selection"の場合は、選択範囲のURLを優先表示
      if (changes.urlSource?.newValue === "selection" || 
          (changes.selectedUrls?.newValue && changes.selectedUrls.newValue.length > 0)) {
        checkSelectedUrls();
      }
    }
  });
});

async function checkSelectedUrls() {
  try {
    // ストレージから直接取得（より確実）
    const storageResult = await chrome.storage.local.get(["selectedUrls", "urlSource"]);
    console.log("checkSelectedUrls - storageResult:", storageResult);

    // 選択範囲のURLが1件以上ある場合は urlSource に関係なく表示
    const hasSelectedUrls = Array.isArray(storageResult.selectedUrls) && storageResult.selectedUrls.length > 0;
    if (hasSelectedUrls) {
      currentSource = storageResult.urlSource || "selection";
      renderList(storageResult.selectedUrls);
      const label = storageResult.urlSource === "selection" ? "選択範囲URL" : "取得済みURL";
      statusEl.textContent = `${storageResult.selectedUrls.length} 件の${label}を表示中。クリックまたはチェック→まとめてコピーできます。`;
      if (viewSelectedBtn) {
        viewSelectedBtn.style.display = "inline-block";
        console.log("checkSelectedUrls - viewSelectedBtn displayed (any selection URLs)");
      } else {
        console.error("checkSelectedUrls - viewSelectedBtn is null!");
      }
      return true;
    }

    currentSource = "page";
    viewSelectedBtn.style.display = "none";
    console.log("checkSelectedUrls - no selection URLs found");
  } catch (error) {
    console.error("Error checking selected URLs:", error);
    // フォールバック: メッセージ経由で取得を試みる
    try {
      const result = await chrome.runtime.sendMessage({ type: "get-selected-urls" });
      console.log("checkSelectedUrls - fallback result:", result);
      if (result?.success && 
          result?.source === "selection" && 
          result?.urls?.length > 0) {
        currentSource = "selection";
        renderList(result.urls);
        statusEl.textContent = `${result.urls.length} 件の選択範囲URLを表示中。クリックまたはチェック→まとめてコピーできます。`;
        if (viewSelectedBtn) {
          viewSelectedBtn.style.display = "inline-block";
          console.log("checkSelectedUrls - viewSelectedBtn displayed via fallback");
        } else {
          console.error("checkSelectedUrls - viewSelectedBtn is null in fallback!");
        }
        console.log("checkSelectedUrls - showing selection URLs via fallback, button should be visible");
        return true;
      }
    } catch (fallbackError) {
      console.error("Fallback error:", fallbackError);
    }
  }
  return false;
}

async function clearSelectedUrls() {
  try {
    await chrome.runtime.sendMessage({ type: "clear-selected-urls" });
    currentSource = "page";
    viewSelectedBtn.style.display = "none";
    // 通常のURL取得に戻す（強制更新）
    await collectUrls(true);
  } catch (error) {
    statusEl.textContent = error?.message || "クリアに失敗しました";
  }
}

async function collectUrls(forceRefresh = false) {
  // 強制更新でない場合、選択範囲のURLをチェック
  if (!forceRefresh) {
    const hasSelectedUrls = await checkSelectedUrls();
    if (hasSelectedUrls) {
      // 選択範囲のURLがある場合は、それだけを表示して通常のURL取得は実行しない
      return;
    }
  }

  // 通常のURL取得を実行する前に、選択データを必ずクリアする
  await chrome.runtime.sendMessage({ type: "clear-selected-urls" });
  currentSource = "page";

  statusEl.textContent = "取得中...";
  listEl.innerHTML = "";

  try {
    const result = await chrome.runtime.sendMessage({ type: "collect-urls" });
    if (!result?.success) {
      statusEl.textContent = result?.error || "取得に失敗しました";
      return;
    }

    if (!result.urls?.length) {
      statusEl.textContent = "URLが見つかりませんでした。";
      return;
    }

    renderList(result.urls);
    statusEl.textContent = `${result.urls.length} 件のメインコンテンツURLを取得しました。クリックまたはチェック→まとめてコピーできます。`;
    viewSelectedBtn.style.display = "none";
  } catch (error) {
    statusEl.textContent = error?.message || "取得に失敗しました";
  }
}

function renderList(urls) {
  listEl.innerHTML = "";
  const fragment = document.createDocumentFragment();
  urls.forEach((url) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const a = document.createElement("a");

    checkbox.type = "checkbox";
    checkbox.value = url;
    checkbox.title = "このURLを選択";
    checkbox.checked = true;

    a.href = url;
    a.textContent = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      await navigator.clipboard.writeText(url);
      statusEl.textContent = "コピーしました";
    });

    label.appendChild(checkbox);
    label.appendChild(a);
    li.appendChild(label);
    fragment.appendChild(li);
  });
  listEl.appendChild(fragment);
}

async function startSelectionMode() {
  try {
    // 既存の通常取得結果を一旦クリアし、選択待ち状態にする
    listEl.innerHTML = "";
    statusEl.textContent = "ページ上でドラッグして範囲を選択してください...";
    currentSource = "selection";
    
    // アクティブなタブを取得
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusEl.textContent = "アクティブなタブが見つかりません";
      return;
    }

    // 選択モードを開始
    const result = await chrome.runtime.sendMessage({ 
      type: "start-selection-mode",
      tabId: tab.id
    });

    if (result?.success) {
      statusEl.textContent = "ページ上でドラッグして範囲を選択してください。選択が完了すると自動的にURLが取得されます。";
      
      // ストレージの変更を監視して、選択範囲のURLが取得されたら表示を更新
      const checkInterval = setInterval(async () => {
        const hasSelected = await checkSelectedUrls();
        if (hasSelected) {
          clearInterval(checkInterval);
          statusEl.textContent = "選択範囲のURLを取得しました。";
        }
      }, 500);

      // 10秒後にタイムアウト
      setTimeout(() => {
        clearInterval(checkInterval);
        if (statusEl.textContent.includes("選択範囲のURLを取得しました")) {
          // 既に取得済みの場合は何もしない
        } else {
          statusEl.textContent = "選択モードがタイムアウトしました。もう一度お試しください。";
        }
      }, 10000);
    } else {
      statusEl.textContent = result?.error || "選択モードの開始に失敗しました";
    }
  } catch (error) {
    statusEl.textContent = error?.message || "選択モードの開始に失敗しました";
  }
}

async function copySelected() {
  const selected = Array.from(
    listEl.querySelectorAll('input[type="checkbox"]:checked')
  ).map((el) => el.value);

  if (!selected.length) {
    statusEl.textContent = "選択されているURLがありません。";
    return;
  }

  try {
    await navigator.clipboard.writeText(selected.join("\n"));
    statusEl.textContent = `${selected.length} 件コピーしました`;
  } catch (error) {
    statusEl.textContent = error?.message || "コピーに失敗しました";
  }
}

async function viewSelectedUrls() {
  try {
    // ストレージから選択範囲のURLを取得
    const storageResult = await chrome.storage.local.get(["selectedUrls", "urlSource"]);
    console.log("viewSelectedUrls - storageResult:", storageResult);
    
    // 選択範囲のURLがあれば表示（urlSourceが何でも表示する）
    if (!storageResult.selectedUrls || storageResult.selectedUrls.length === 0) {
      statusEl.textContent = "選択範囲のURLが見つかりません。";
      return;
    }

    // HTMLコンテンツを生成
    const urlsHtml = storageResult.selectedUrls
      .map((url, index) => `<li><a href="${url}" target="_blank">${index + 1}. ${url}</a></li>`)
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>選択範囲のURL一覧</title>
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      margin: 20px;
      color: #222;
      max-width: 1200px;
      margin: 20px auto;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 16px;
      color: #1268ff;
    }
    .info {
      background: #f0f0f0;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    ol {
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
      word-break: break-all;
    }
    a {
      color: #1268ff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .copy-btn {
      margin-top: 20px;
      padding: 8px 16px;
      background: #1268ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .copy-btn:hover {
      background: #0d5ae0;
    }
  </style>
</head>
<body>
  <h1>選択範囲のURL一覧</h1>
  <div class="info">
    <strong>${storageResult.selectedUrls.length}</strong> 件のURLが取得されました。
  </div>
  <ol>
    ${urlsHtml}
  </ol>
  <button class="copy-btn" onclick="copyAll()">すべてのURLをコピー</button>
  <script>
    function copyAll() {
      const urls = ${JSON.stringify(storageResult.selectedUrls)};
      navigator.clipboard.writeText(urls.join("\\n")).then(() => {
        alert("すべてのURLをコピーしました！");
      }).catch(err => {
        alert("コピーに失敗しました: " + err.message);
      });
    }
  </script>
</body>
</html>`;

    // 新しいタブで表示
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await chrome.tabs.create({ url: dataUrl });
    
    statusEl.textContent = "選択範囲のURLを別窓で表示しました。";
  } catch (error) {
    console.error("Error viewing selected URLs:", error);
    statusEl.textContent = error?.message || "別窓での表示に失敗しました";
  }
}

