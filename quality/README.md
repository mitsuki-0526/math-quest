# 判定の記録(`judgments.jsonl`)

先生が 1 問ずつ付けた ○/× と理由の記録。`npm run review:import -- <判定のコピーか CSV>` で足される(同じ ID は新しい判定で上書き)。

- 1 行 1 問の JSON: `id`(テンプレート|★|種。同じ問題を作り直せる)・`templateId`・`unit`(単元)・`type`(出題タイプ)・`star`・`verdict`(ok / ng)・`reasons`・`question`・`answer`・`judgedAt`・`game`
- **個人情報は入れない**(生徒のデータは一切ない。判定した先生の名前も入れない)
- 使い道: × の共通点を問題を作るルール・Judge のルールに直す/次のゲームで同じ単元の手本にする/AI に下見をさせるときに先生との一致率を測る([docs/quality-kit.md](../docs/quality-kit.md))
