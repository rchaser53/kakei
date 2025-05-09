# 便利コマンド
imageを利用した動作確認用のスクリプト

```sh
docker run -it --rm \
  -v "$(pwd)":/db \
  keinos/sqlite3 \
  sqlite3 /db/database.sqlite
```