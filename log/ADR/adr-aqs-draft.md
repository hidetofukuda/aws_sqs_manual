# ADR-01: システム間連携の境界にAmazon SQSを採用する

## Status
Proposed（YYYY-MM-DD）

## Context
- 受付処理（Producer）と業務処理（Consumer: Lambda→DynamoDB）の間で連携方式を決める必要がある
- 要件: Consumer障害時もProducerを止めない／一時的な失敗は自動リトライ／
  失敗データを失わず調査・再処理できる／流量の急増を吸収したい
- 制約: 運用要員が少ない、サーバーレスで構成したい

## Decision
Producer と Consumer の間に SQS 標準キュー（DLQ付き）を置き、非同期連携とする。
- maxReceiveCount回失敗したメッセージはDLQへ移し、CloudWatchアラームで検知する
- Lambdaは部分バッチ失敗（ReportBatchItemFailures）を返す
- 重複配信を前提に、DynamoDBの条件付き書き込みで冪等性を担保する

## Alternatives Considered
| 方式 | 不採用理由 |
|---|---|
| 同期API呼び出し | Consumer障害がProducerへ波及する。リトライ制御を呼び出し側で実装する必要がある |
| SNS + SQS | 現時点で配信先は1つのため過剰。将来ファンアウトが必要になったら拡張する |
| EventBridge | ルーティングには強いが、バッファリングと流量制御はSQSのほうが単純 |
| Kinesis / MSK(Kafka) | 順序保証とリプレイには強いが、シャード・パーティション管理や運用コストが要件に対して過大 |
| Step Functions | ワークフロー制御向き。単純な1対1の非同期連携には過剰 |

## Consequences
### Positive
- 疎結合: Producer/Consumerを独立してデプロイ・スケールできる
- 障害の分離とバッファリング: Consumer停止中もメッセージはキューに保持される
- リトライとDLQを設定だけで実現でき、失敗データを失わない
- maxConcurrencyで下流（DynamoDB）への負荷を制御できる
### Negative
- 結果整合になり、即時応答が必要な処理には使えない
- at-least-once配信のため冪等性の実装が必須になる
- 標準キューは順序保証なし（必要になればFIFOキューを検討）
- 処理の追跡が難しくなるため、相関IDとログ設計が必要になる
- DLQの再処理手順（redrive）を運用設計に含める必要がある