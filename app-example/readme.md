# 手順
## 準備
- .env.sampleから.envを作成する
- COMMAND_PATHに`node_modules/@modelcontextprotocol/server-filesystem/dist/index.js`の絶対パスを記載する
- DIR_PATHに`app-example/data`の絶対パスを記載する
- `npm i`
- `npm run start`
## 使用例
`listup`と入力するとDIR_PATHにあるファイルを列挙してくれる
`create chiikawa.md and write about chiikawa`と書くとちいかわの説明を書いたmdファイルを作成してくれる