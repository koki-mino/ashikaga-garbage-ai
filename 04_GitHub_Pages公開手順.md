# GitHub Pages公開手順（初心者向け）

この手順は、コマンド、`git`、`push`を使いません。GitHubのWeb画面だけで公開します。

## 公開前に知っておくこと

- GitHub Freeで公開する場合、通常は公開リポジトリを使います。
- GitHub PagesのWebサイトはインターネット上で公開されます。
- このフォルダには学習写真、個人情報、APIキーを入れないでください。
- 公開後のURLは通常 `https://あなたのユーザー名.github.io/リポジトリ名/` です。
- GitHubの反映には数分かかることがあります。公式説明では最大10分程度の案内があります。

## 1 GitHubアカウントを用意する

1. [GitHub](https://github.com/)を開きます。
2. アカウントがない場合は `Sign up` を押します。
3. メールアドレスを確認し、ログインします。
4. ユーザー名は公開URLの一部になります。

## 2 新しいリポジトリを作る

1. 右上の `＋` を押します。
2. `New repository` を押します。
3. `Repository name` に `ashikaga-garbage-ai` と入力します。
4. 説明欄に「足利市の家庭ごみ分別を確認する個人開発の非公式Webアプリ」等と入力します。
5. `Public` を選びます。
6. `Add a README file` はオフのままにします。完成一式にREADMEが含まれているためです。
7. `Create repository` を押します。

## 3 完成ファイルをアップロードする

1. 完成版ZIPをPCで展開します。
2. GitHubの作成したリポジトリを開きます。
3. `uploading an existing file` または `Add file` → `Upload files` を押します。
4. 展開した `ashikaga-garbage-ai` フォルダの**中身**をすべて、アップロード欄へドラッグします。
5. `index.html` がリポジトリの一番上に見えることを確認します。
6. 画面下の変更説明に `初回公開` と入力します。
7. `Commit changes` を押します。

### 重要

フォルダ全体をさらに1段深く入れないでください。GitHubの最上部に `index.html`、`style.css`、`app.js`、`data`、`model` が並ぶ状態が正解です。

## 4 GitHub Pagesを有効にする

1. リポジトリ上部の `Settings` を押します。
2. 左側の `Pages` を押します。
3. `Build and deployment` の `Source` で `Deploy from a branch` を選びます。
4. Branchで `main` を選びます。
5. Folderで `/(root)` を選びます。
6. `Save` を押します。

このアプリはビルド作業が不要な静的ファイルのため、ブランチのルートから公開する方式を使います。`.nojekyll` も同梱しています。

## 5 公開URLを確認する

1. 数分待ちます。
2. `Settings` → `Pages` をもう一度開きます。
3. `Visit site` を押します。
4. 通常は次のURLになります。

```text
https://あなたのユーザー名.github.io/ashikaga-garbage-ai/
```

表示されない場合は10分程度待ち、リポジトリの `Actions` タブに赤い失敗表示がないか確認します。

## 6 HTTPSを確認する

`github.io` のサイトはHTTPSで開きます。`Settings` → `Pages` に `Enforce HTTPS` が表示される場合は有効にします。公開URLが `https://` で始まることを確認してください。

## 7 スマートフォンで確認する

1. 公開URLをスマートフォンへ送ります。
2. AndroidのChrome、iPhoneのSafariで開きます。
3. 次を確認します。
   - 横スクロールが出ない
   - ボタンが押しやすい
   - 写真を撮る・選ぶが開く
   - 写真が表示される
   - 「ペットボトル」「電池」「かさ」を検索できる
   - 名草地区の追加質問が表示される
   - 公式リンクが開く

## 8 ファイルを更新する

### 1ファイルだけ直す場合

1. GitHubで対象ファイルを開きます。
2. 鉛筆マーク `Edit this file` を押します。
3. 内容を修正します。
4. `Commit changes` を押します。
5. 数分後に公開サイトを再読み込みします。

### 複数ファイルを入れ替える場合

1. `Add file` → `Upload files` を押します。
2. 同じ名前の新しいファイルをアップロードします。
3. 変更説明を入力し、`Commit changes` を押します。

分別データだけを変える場合は `data/garbage_rules.json` を更新します。AIモデルの変更は不要です。

## 9 公開を一時停止したい場合

`Settings` → `Pages` で公開元を `None` に変更します。ただし、公開リポジトリ内のファイル自体は引き続き誰でも閲覧できます。完全に非公開にしたい場合は、リポジトリの公開設定も見直してください。

## 10 よくある問題

### 404と表示される

- `index.html` が最上部にあるか確認
- PagesのBranchが `main`、Folderが `/(root)` か確認
- 10分程度待って再読み込み

### 分別データを読み込めない

- `data/garbage_rules.json` があるか確認
- ファイル名の大文字・小文字が一致するか確認
- JSONの末尾カンマや引用符の欠落がないか確認

### AIが準備中と表示される

現在の正常な状態です。モデル学習後にWork側で `model/` を更新します。手動検索は利用できます。

### 写真が送信されないか心配

画像はブラウザ内だけで扱います。リポジトリには画像送信処理、サーバー処理、解析タグを含めていません。

## 参照したGitHub公式仕様

- [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

仕様確認日：2026年9月10日
