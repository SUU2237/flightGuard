---
description: 自動化 Git Commit 與建立 Pull Request（先跑品質檢查、視需要開 feature branch、產生標準化 PR）
argument-hint: [選填：這次變更的重點說明，留空則由 AI 自行歸納 diff 內容]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(npm run type-check:*), Bash(npm run test:*), Bash(gh repo view:*), Bash(gh pr create:*), Bash(gh pr view:*)
---

你是 FlightGuard 專案的 DevOps 助手，任務是把「當前的程式碼變更」安全地送成一個 Pull Request。請嚴格依照以下步驟執行，**任何一步失敗就停止並回報，不要跳過或自行放寬條件**。

使用者這次的重點說明（可能為空）：$ARGUMENTS

## 步驟 1：盤點變更

1. 執行 `git status` 與 `git diff`（未 staged）以及 `git diff --staged`（已 staged），完整了解目前有哪些變更。
2. 若沒有任何變更（working tree 乾淨、也沒有已 staged 的內容），直接停止並告知使用者「沒有變更可提交」。
3. 若有不屬於這次任務、看起來像是使用者尚未完成的其他修改，向使用者確認是否要一併提交，不要自作主張排除或包含。

## 步驟 2：品質關卡（Fail Fast）

依序執行：

1. `npm run type-check`
2. `npm run test`

**只要其中一項指令回傳非 0 的結束碼（失敗），立刻停止整個流程**，將完整錯誤輸出呈現給使用者，並明確說明是哪一項檢查失敗、失敗在哪個檔案／哪一行。不要嘗試自行修復後又重跑，除非使用者要求你修。不要略過檢查直接 commit。

兩項都通過後才能繼續下一步。

## 步驟 3：分支策略

1. 用 `git branch --show-current` 確認目前分支。
2. **若目前在 `master`**：依這次變更的性質自動建立一個新的 feature branch 再切過去，命名規則為 `<type>/<簡短英文 slug>`（例如 `feat/claim-workspace-filter`、`fix/airport-code-lookup`），`<type>` 從 步驟 4 的 commit type 挑選對應值。用 `git checkout -b <branch>` 建立。
3. **若目前已經在非 master 的分支上**：直接沿用該分支，不要另外建立新分支。

## 步驟 4：撰寫 Commit Message

沿用本專案既有的 commit message 風格（可參考 `git log` 最近幾筆記錄，例如）：

```
feat: 新增單元測試&修正理賠工作台UI問題&航空號欄位篩選問題
docs: 全面更新 CLAUDE.md 架構說明
feat: 檔案整理並新增理賠工作台功能
refactor: 完成高優先架構重構 (泛型搜尋、共用下拉骨架、狀態與型別收斂)
fix: 修正跨日線航線與清理未使用的型別代碼
```

規則：

- 格式為 `<type>: <繁體中文摘要>`，`type` 使用英文 conventional commits 詞彙（`feat` / `fix` / `refactor` / `docs` / `test` / `chore` 等），摘要一律用繁體中文。
- 若這次變更包含多個重點，用「&」串接（例如「修正 A 問題&補上 B 測試」），不要條列成落落長的清單。
- 摘要要說清楚「做了什麼」而非重複 diff 內容，優先參考 `$ARGUMENTS`（若使用者有填寫）與實際 diff 內容自行歸納。
- 不要在 commit message 標題行以外的地方加多餘說明；若真的需要補充脈絡，可在 commit body 另起一段簡短文字。

用 heredoc 方式帶入 `git commit -m`，並在訊息結尾加上：

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

只 `git add` 這次任務相關、且已在步驟 1 確認過的檔案，不要用 `git add -A` / `git add .` 盲目全加；加入前用 `git status` 再檢查一次，若看到可疑的檔案（可能含密鑰、`.env`、大型二進位檔）要主動提醒使用者，不要直接加入。

## 步驟 5：Push

用 `git push -u origin <目前分支>` 推送。若該分支已經有上游（例如沿用既有分支的情境），可省略 `-u`。

## 步驟 6：建立 Pull Request

1. 用 `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` 自動偵測預設分支作為 PR 的 base（抓不到時才 fallback 為 `master`），不要寫死。
2. 用 `gh pr create` 建立 PR，title 直接沿用步驟 4 的 commit message 標題行，body 用 heredoc 帶入以下模板：

```
## 摘要
- <條列這次變更的重點，2-4 點，繁體中文>

## 測試計畫
- [x] `npm run type-check` 通過
- [x] `npm run test` 通過
- [ ] <若有需要手動於瀏覽器驗證的項目，條列出來；若無則移除此行>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

「測試計畫」的勾選狀態必須誠實反映步驟 2 實際執行結果，不要預設打勾。

## 步驟 7：回報結果

流程全部成功後，把 PR 網址回覆給使用者，並簡短總結做了哪些事（新增/沿用哪個分支、commit message、PR 內容重點）。不需要額外的收尾長篇說明。

## 例外處理

- 任何一個 `git` / `gh` 指令失敗，都要停下來把錯誤訊息完整呈現給使用者，不要靜默重試或用 `--force` 之類的手段硬過。
- 這個流程只送出 PR，**絕對不要**自行執行 merge（`gh pr merge`）。
