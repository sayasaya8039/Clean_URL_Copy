const MENU_IDS = {
  PAGE: "clean-copy-page-url",
  LINK: "clean-copy-link-url",
  SELECTION: "clean-copy-selection-url",
  SELECTION_LINKS: "clean-copy-selection-links",
};

// 削除すべき広告・アフィリエイト・CMパラメータのリスト
const TRACKING_PARAMS = new Set([
  // UTMパラメータ
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  // 広告トラッキング
  "gclid",
  "fbclid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  // アフィリエイト
  "affiliate_id",
  "aff_id",
  "aff",
  "af_id",
  "af",
  "ref",
  "referrer",
  "source",
  // キャンペーン
  "campaign_id",
  "campaign",
  "cmp_id",
  // その他のトラッキング
  "_ga",
  "_gl",
  "igshid",
  "igsh",
  "si",
  "s",
  "mibextid",
  "feature",
  "mkt_tok",
  "trk",
  "trk_info",
  "ncid",
  "nc",
  "ocid",
  "oc",
  "clickid",
  "click_id",
  "partner_id",
  "partner",
  "pid",
  "rid",
  "r",
  "ref_id",
  "refid",
  "ref_src",
  "ref_source",
  "ref_medium",
  "ref_campaign",
  "ref_term",
  "ref_content",
]);

// URLからトラッキングパラメータを削除する関数
function cleanUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const params = new URLSearchParams(url.search);
    
    // トラッキングパラメータを削除（配列に変換してから削除）
    const keysToDelete = Array.from(params.keys()).filter(key =>
      TRACKING_PARAMS.has(key.toLowerCase())
    );
    
    keysToDelete.forEach(key => {
      params.delete(key);
    });
    
    // クリーンなURLを構築
    url.search = params.toString();
    return url.toString();
  } catch (error) {
    console.error("Error cleaning URL:", rawUrl, error);
    return rawUrl;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
});

// 拡張機能が有効になったときにもメニューを作成
chrome.runtime.onStartup.addListener(() => {
  createMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  // 選択範囲内のリンクを取得する場合
  if (info.menuItemId === MENU_IDS.SELECTION_LINKS) {
    const result = await extractLinksFromSelection(tab.id);
    if (result?.success && result?.urls?.length > 0) {
      console.log("Original URLs:", result.urls);
      const cleanedUrls = result.urls.map(url => {
        const cleaned = cleanUrl(url);
        console.log(`Before: ${url}`);
        console.log(`After: ${cleaned}`);
        return cleaned;
      });
      const textToCopy = cleanedUrls.join("\n");
      console.log("Cleaned URLs to copy:", cleanedUrls);
      
      // ストレージに保存（オプションページで表示するため）
      await chrome.storage.local.set({ 
        selectedUrls: cleanedUrls,
        urlSource: "selection"
      });
      console.log("Saved selected URLs to storage:", cleanedUrls);
      
      const copyResult = await copyViaTab(tab.id, textToCopy);
      if (!copyResult?.success) {
        console.error("Copy failed", copyResult?.error);
      }
    } else {
      console.error("Failed to extract links:", result?.error);
    }
    return;
  }

  const targetUrl =
    info.linkUrl ||
    (info.menuItemId === MENU_IDS.SELECTION
      ? extractUrlFromText(info.selectionText)
      : null) ||
    tab.url;

  if (!targetUrl) return;

  // URLをクリーンアップしてコピー
  const cleanedUrl = cleanUrl(targetUrl);
  const result = await copyViaTab(tab.id, cleanedUrl);
  if (!result?.success) {
    console.error("Copy failed", result?.error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "collect-urls") {
    collectFromActiveTab().then(sendResponse);
    return true;
  }
  if (message?.type === "get-selected-urls") {
    chrome.storage.local.get(["selectedUrls", "urlSource"], (result) => {
      try {
        console.log("Storage get result:", result);
        sendResponse({ 
          success: true, 
          urls: result.selectedUrls || [], 
          source: result.urlSource || "page" 
        });
      } catch (error) {
        console.error("Error in get-selected-urls:", error);
        sendResponse({ 
          success: false, 
          error: error?.message || "Failed to get selected URLs",
          urls: [],
          source: "page"
        });
      }
    });
    return true;
  }
  if (message?.type === "clear-selected-urls") {
    chrome.storage.local.remove(["selectedUrls", "urlSource"], () => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (message?.type === "start-selection-mode") {
    startSelectionMode(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type === "save-selected-urls") {
    // 選択範囲のURLをクリーンアップして保存
    const cleanedUrls = message.urls.map(url => cleanUrl(url));
    chrome.storage.local.set({
      selectedUrls: cleanedUrls,
      urlSource: "selection"
    });
    sendResponse({ success: true });
    return true;
  }
  return undefined;
});

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    // 選択範囲コンテキスト - リンクURL取得（最初に作成して優先表示）
    chrome.contextMenus.create({
      id: MENU_IDS.SELECTION_LINKS,
      title: "選択範囲内のリンクURLを取得",
      contexts: ["selection"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error creating selection links menu:", chrome.runtime.lastError);
      } else {
        console.log("Selection links menu created successfully");
      }
    });

    // 選択範囲コンテキスト - テキスト内URL抽出
    chrome.contextMenus.create({
      id: MENU_IDS.SELECTION,
      title: "選択テキスト内のURLをクリーンアップしてコピー",
      contexts: ["selection"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error creating selection menu:", chrome.runtime.lastError);
      } else {
        console.log("Selection menu created successfully");
      }
    });

    // ページコンテキスト
    chrome.contextMenus.create({
      id: MENU_IDS.PAGE,
      title: "クリーンなURLをコピー",
      contexts: ["page"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error creating page menu:", chrome.runtime.lastError);
      }
    });

    // リンクコンテキスト
    chrome.contextMenus.create({
      id: MENU_IDS.LINK,
      title: "リンクのクリーンなURLをコピー",
      contexts: ["link"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error creating link menu:", chrome.runtime.lastError);
      }
    });
  });
}

function extractUrlFromText(text) {
  if (!text) return null;
  // URLパターンを抽出
  const match = text.match(/https?:\/\/[^\s"')<>]+/i);
  return match ? match[0] : null;
}

// 選択範囲内のリンクを取得する関数
async function extractLinksFromSelection(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) {
            return { success: false, error: "選択範囲が見つかりません" };
          }

          const range = selection.getRangeAt(0);
          if (!range) {
            return { success: false, error: "選択範囲を取得できませんでした" };
          }

          const urls = new Set();

          // 選択範囲内のテキストからURLを抽出
          const selectedText = selection.toString();
          const textMatches = selectedText.match(/https?:\/\/[^\s"')<>]+/gi);
          if (textMatches) {
            textMatches.forEach((url) => urls.add(url.trim()));
          }

          // 選択範囲のDOMフラグメントから a[href] を抽出
          const fragment = range.cloneContents();
          fragment.querySelectorAll?.("a[href]").forEach((link) => {
            try {
              const u = new URL(link.href);
              if (u.protocol === "http:" || u.protocol === "https:") {
                urls.add(u.toString());
              }
            } catch {
              /* ignore invalid */
            }
          });

          // 共通祖先から intersectsNode でも拾う（より広い範囲で補完）
          const commonAncestor = range.commonAncestorContainer;
          const containerElement = commonAncestor?.nodeType === Node.TEXT_NODE
            ? commonAncestor.parentElement
            : commonAncestor;
          if (containerElement) {
            containerElement.querySelectorAll("a[href]").forEach((link) => {
              try {
                if (range.intersectsNode(link)) {
                  const u = new URL(link.href);
                  if (u.protocol === "http:" || u.protocol === "https:") {
                    urls.add(u.toString());
                  }
                }
              } catch {
                /* ignore */
              }
            });
          }

          if (urls.size === 0) {
            return { success: false, error: "選択範囲内にリンクが見つかりません" };
          }

          return { success: true, urls: Array.from(urls) };
        } catch (error) {
          return {
            success: false,
            error: error?.message || "リンクの取得に失敗しました",
          };
        }
      },
    });

    return result?.result || { success: false, error: "extract failed" };
  } catch (error) {
    return { success: false, error: error?.message || "extract failed" };
  }
}

async function copyViaTab(tabId, text) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (value) => {
        try {
          await navigator.clipboard.writeText(value);
          return { success: true };
        } catch (error) {
          return { success: false, error: error?.message || "copy failed" };
        }
      },
      args: [text],
    });

    return result?.result;
  } catch (error) {
    return { success: false, error: error?.message || "copy failed" };
  }
}

// 選択モードを開始する関数
async function startSelectionMode(tabId) {
  try {
    // ページに選択モード用のスクリプトを注入
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 既存の選択モードをクリア
        if (window.cleanUrlCopySelectionMode) {
          window.cleanUrlCopySelectionMode.cleanup();
        }

        let isSelecting = false;
        let startX = 0;
        let startY = 0;
        let overlay = null;
        let selectionBox = null;

        // オーバーレイを作成
        function createOverlay() {
          overlay = document.createElement("div");
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.1);
            z-index: 999998;
            cursor: crosshair;
            pointer-events: auto;
          `;

          selectionBox = document.createElement("div");
          selectionBox.style.cssText = `
            position: absolute;
            border: 2px dashed #1268ff;
            background: rgba(18, 104, 255, 0.1);
            pointer-events: none;
            display: none;
          `;
          overlay.appendChild(selectionBox);
          document.body.appendChild(overlay);
        }

        // 選択範囲内のリンクを取得
        function extractLinksFromSelection() {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) {
            return [];
          }

          const range = selection.getRangeAt(0);

          // 選択範囲を含む共通の祖先要素を取得
          const commonAncestor = range.commonAncestorContainer;
          const containerElement = commonAncestor.nodeType === Node.TEXT_NODE
            ? commonAncestor.parentElement
            : commonAncestor;

          if (!containerElement) {
            // テキストからURLを抽出
            const selectedText = selection.toString();
            const urlMatches = selectedText.match(/https?:\/\/[^\s"')<>]+/gi);
            return urlMatches ? urlMatches.map(url => url.trim()) : [];
          }

        const urls = new Set();

        // 範囲のテキストから抽出
        const textMatches = selection.toString().match(/https?:\/\/[^\s"')<>]+/gi);
        if (textMatches) {
          textMatches.forEach((url) => urls.add(url.trim()));
        }

        // クローンしたフラグメント内の a[href] を取得
        const frag = range.cloneContents();
        frag.querySelectorAll?.("a[href]").forEach((link) => {
          try {
            const u = new URL(link.href);
            if (u.protocol === "http:" || u.protocol === "https:") {
              urls.add(u.toString());
            }
          } catch {
            /* ignore */
          }
        });

        // 共通祖先から intersectsNode で補完
        containerElement.querySelectorAll("a[href]").forEach((link) => {
          try {
            if (range.intersectsNode(link)) {
              const u = new URL(link.href);
              if (u.protocol === "http:" || u.protocol === "https:") {
                urls.add(u.toString());
              }
            }
          } catch {
            /* ignore */
          }
        });

        return Array.from(urls);
        }

        // 矩形と要素の交差判定
        function rectsIntersect(a, b) {
          return !(
            b.left > a.right ||
            b.right < a.left ||
            b.top > a.bottom ||
            b.bottom < a.top
          );
        }

        // マウスダウン
        function onMouseDown(e) {
          if (e.button !== 0) return; // 左クリックのみ
          isSelecting = true;
          startX = e.clientX;
          startY = e.clientY;
          selectionBox.style.display = "block";
          selectionBox.style.left = startX + "px";
          selectionBox.style.top = startY + "px";
          selectionBox.style.width = "0px";
          selectionBox.style.height = "0px";
          e.preventDefault();
        }

        // マウスムーブ
        function onMouseMove(e) {
          if (!isSelecting) return;
          const currentX = e.clientX;
          const currentY = e.clientY;
          const left = Math.min(startX, currentX);
          const top = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          selectionBox.style.left = left + "px";
          selectionBox.style.top = top + "px";
          selectionBox.style.width = width + "px";
          selectionBox.style.height = height + "px";
        }

        // マウスアップ
        function onMouseUp(e) {
          if (!isSelecting) return;
          isSelecting = false;
          selectionBox.style.display = "none";

          const endX = e.clientX;
          const endY = e.clientY;
          const rect = {
            left: Math.min(startX, endX),
            top: Math.min(startY, endY),
            right: Math.max(startX, endX),
            bottom: Math.max(startY, endY),
          };

          const urls = new Set();

          // 1) 実際のテキスト選択がある場合はそこからURL抽出
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const selectedText = selection.toString();
            const textMatches = selectedText.match(/https?:\/\/[^\s"')<>]+/gi);
            if (textMatches) {
              textMatches.forEach((url) => urls.add(url.trim()));
            }
          }

          // 2) 矩形と交差するリンク要素を抽出
          document.querySelectorAll("a[href]").forEach((link) => {
            try {
              const r = link.getBoundingClientRect();
              if (!rectsIntersect(rect, r)) return;
              const u = new URL(link.href);
              if (u.protocol === "http:" || u.protocol === "https:") {
                urls.add(u.toString());
              }
            } catch {
              /* ignore invalid */
            }
          });

          if (urls.size > 0) {
            chrome.runtime.sendMessage({
              type: "save-selected-urls",
              urls: Array.from(urls)
            });
          }

          cleanup();
        }

        // クリーンアップ
        function cleanup() {
          if (overlay) {
            overlay.remove();
            overlay = null;
            selectionBox = null;
          }
          isSelecting = false;
          window.cleanUrlCopySelectionMode = null;
        }

        // 初期化
        createOverlay();
        overlay.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        // ESCキーでキャンセル
        function onKeyDown(e) {
          if (e.key === "Escape") {
            cleanup();
            document.removeEventListener("keydown", onKeyDown);
          }
        }
        document.addEventListener("keydown", onKeyDown);

        // グローバルに保存
        window.cleanUrlCopySelectionMode = { cleanup };
      },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || "選択モードの開始に失敗しました" };
  }
}

async function collectFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      return { success: false, error: "アクティブなタブが見つかりません" };
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          // ナビゲーション、フッター、サイドバーなどの除外対象セレクタ
          const excludeSelectors = [
            "nav",
            "header",
            "footer",
            "aside",
            ".nav",
            ".navigation",
            ".header",
            ".footer",
            ".sidebar",
            ".menu",
            ".breadcrumb",
            ".breadcrumbs",
            "#nav",
            "#navigation",
            "#header",
            "#footer",
            "#sidebar",
            "#menu",
          ];

          // 除外対象の要素を取得
          const excludeElements = new Set();
          excludeSelectors.forEach((selector) => {
            try {
              document.querySelectorAll(selector).forEach((el) => {
                excludeElements.add(el);
                // 子要素もすべて除外
                el.querySelectorAll("*").forEach((child) => {
                  excludeElements.add(child);
                });
              });
            } catch (e) {
              // セレクタが無効な場合は無視
            }
          });

          // メインコンテンツエリアを探す（優先順位順）
          let mainContent = null;
          const mainSelectors = [
            "main",
            "article",
            ".main",
            ".main-content",
            ".content",
            ".mainContent",
            "#main",
            "#content",
            "#main-content",
            "[role='main']",
          ];

          for (const selector of mainSelectors) {
            try {
              const found = document.querySelector(selector);
              if (found) {
                mainContent = found;
                break;
              }
            } catch (e) {
              // セレクタが無効な場合は次へ
            }
          }

          // メインコンテンツが見つからない場合はbody全体を使用
          const searchArea = mainContent || document.body;

          // メインコンテンツエリア内のリンクを取得
          const anchors = Array.from(searchArea.querySelectorAll("a[href]"));
          const urls = anchors
            .filter((a) => {
              // 除外対象の要素内のリンクは除外
              let element = a;
              while (element && element !== document.body) {
                if (excludeElements.has(element)) {
                  return false;
                }
                element = element.parentElement;
              }
              return true;
            })
            .map((a) => a.href)
            .filter((href) => {
              try {
                const url = new URL(href);
                // 同じドメインまたは外部リンクの有効なURLのみ
                return url.protocol === "http:" || url.protocol === "https:";
              } catch {
                return false;
              }
            })
            .map((href) => {
              try {
                const u = new URL(href);
                return u.toString();
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          // 重複を削除
          const unique = Array.from(new Set(urls));
          return { success: true, urls: unique };
        } catch (error) {
          return { success: false, error: error?.message || "collect failed" };
        }
      },
    });

    const collected = result?.result || { success: false, error: "collect failed" };
    if (collected.success && collected.urls) {
      // URLをクリーンアップ
      collected.urls = collected.urls.map((url) => cleanUrl(url));
    }
    return collected;
  } catch (error) {
    return { success: false, error: error?.message || "collect failed" };
  }
}
