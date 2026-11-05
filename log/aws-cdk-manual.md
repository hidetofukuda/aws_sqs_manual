# AWS CDK v2 プロジェクト作成手順（TypeScript）

この手順では、ワークスペース直下に `my-cdk-app` という CDK アプリを作成し、AWS 環境へデプロイするところまで進めます。`my-cdk-app`、AWS アカウント ID、リージョン、プロファイル名は自分の環境に合わせて変更してください。

## 1. 前提条件

- Node.js の LTS 版と npm
- AWS CLI v2
- AWS アカウントと、デプロイ対象のリソースを作成できる権限
- AWS CLI で利用できる認証情報とデプロイ先リージョン

インストール状態を確認します。

```bash
node --version
npm --version
aws --version
```

### 現在の環境を確認する

2026-10-03 時点で、手元の環境情報は次のとおりです。

| 項目 | 現在 | 判断 |
| --- | --- | --- |
| Node.js | `v25.6.1` | Node.js 25 は EOL です。CDK の前提は 22.x 以降ですが、LTS の Node.js 24.x へ切り替えてください。 |
| npm | `11.9.0` | Node.js と一緒に更新されるため、Node.js 24.x のインストール後に再確認します。 |
| AWS CLI | `2.13.20` | AWS CLI v2 ですが古いリリースです。最新の v2 へ更新してから利用してください。 |

Node.js 24 LTS は [Node.js 公式ダウンロードページ](https://nodejs.org/en/download) からインストールできます。バージョン管理ツール `nvm` をすでに利用している場合は、次のように切り替えられます。

```bash
nvm install 24
nvm use 24
nvm alias default 24
node --version
npm --version
```

AWS CLI のインストール元を確認します。

```bash
which aws
```

公式 macOS インストーラーで導入した AWS CLI は、更新機能が使える場合は次で更新できます。

```bash
aws update
```

`aws update` が利用できない場合や、Homebrew など別の方法で導入した場合は、その導入元に合った更新方法を使ってください。公式インストーラーを使う場合は [AWS CLI の macOS インストール・更新手順](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html#install-macos) を参照します。更新後は新しいターミナルを開き、実際に使われる CLI の場所とバージョンを確認してください。

```bash
which aws
aws --version
```

CDK が必要とする Node.js の条件は変更される場合があるため、更新時は [AWS CDK prerequisites](https://docs.aws.amazon.com/cdk/v2/guide/prerequisites.html) も確認してください。

## 2. AWS CDK CLI のインストール

CDK CLI はグローバルにインストールできます。

```bash
npm install -g aws-cdk
cdk --version
```

CLI のバージョンをプロジェクトごとに固定したい場合は、グローバルインストールの代わりにプロジェクト内へインストールし、`npx cdk` で実行します。初期化後に次のように追加できます。

```bash
npm install --save-dev aws-cdk
npx cdk --version
```

## 3. AWS 認証情報の準備

CDK は、AWS CLI と同じ認証情報（プロファイル）を使ってデプロイします。開発用と本番用の 2 アカウントを使い分ける場合は、IAM Identity Center（AWS SSO）で、人ごとに一時的な認証情報を発行する方式を推奨します。

<!-- TODO ここまで対応した -->

### 3-1. 既存の IAM ユーザー・グループは作り直さない

IAM Identity Center は、各アカウントの IAM とは別の仕組みです。

| | IAM ユーザー・IAM グループ | IAM Identity Center のユーザー・グループ |
| --- | --- | --- |
| 管理される場所 | アカウントごと（開発・本番で別々） | AWS Organizations 全体で 1 か所 |
| 認証情報 | 長期のアクセスキー | 数時間で失効する一時的な認証情報 |
| 権限の定義 | IAM ポリシー | 許可セット（Permission Set） |

- 既存の IAM ユーザーやグループは、そのまま残して問題ありません。Identity Center の設定を追加しても影響しません。
- Identity Center 側には、グループ・ユーザー・許可セットを新規に作成します。許可セットをアカウントに割り当てると、各アカウントに `AWSReservedSSO_...` という IAM ロールが自動作成されます。
- 移行の目安は次のとおりです。SSO でデプロイできることを確認したあと、不要になったアクセスキーを無効化し、最後に IAM ユーザーを整理します。

前提として、開発用と本番用のアカウントが同じ AWS Organizations に属している必要があります。Organizations を使っていない場合は、先に組織を作成してアカウントを招待・追加してください。

### 3-2. Identity Center の設定（管理者が一度だけ行う）

AWS マネジメントコンソールで、管理アカウント（Organizations の管理アカウント）にサインインして設定します。

1. **有効化**: IAM Identity Center を、デプロイに使うリージョンで有効にします。リージョンはあとから変更できないため、先に決めてください。
2. **グループの作成**: 役割ごとにグループを作ります。例: `Developers`（開発者）、`ProdDeployers`（本番デプロイ担当）。
3. **ユーザーの作成**: ユーザーを作成し、グループに追加します。
4. **許可セットの作成**: 権限のひな形です。例: `DevAdmin`（開発用に広い権限）、`ProdDeploy`（本番用に必要最小限の権限）。
5. **アカウントへの割り当て**: 「どのグループに、どのアカウントで、どの許可セットを与えるか」を設定します。

| グループ | 開発アカウント | 本番アカウント |
| --- | --- | --- |
| `Developers` | `DevAdmin` | 割り当てなし（アクセス不可） |
| `ProdDeployers` | `DevAdmin` | `ProdDeploy` |

開発環境では自由に試せるようにしつつ、本番環境は限られたグループだけが操作できるようにします。権限は最初から絞りすぎず、まず動かしてから狭めていく進め方でも構いません。

### 3-3. プロファイルの設定とログイン（利用者ごとに行う）

AWS CLI にプロファイルを登録します。開発用と本番用で、それぞれ 1 つずつ作成します。

```bash
aws configure sso
```

<!-- TODO ここまで identity centerで設定したユーザーでログインする手順、3-1から見直す必要あり -->

対話形式で次の項目を聞かれます。

- `SSO session name`: セッションの名前（例: `my-sso`）。2 つ目のプロファイルでは同じ名前を再利用できます。
- `SSO start URL`: Identity Center のポータル URL（例: `https://d-xxxxxxxxxx.awsapps.com/start`）
- `SSO region`: Identity Center を有効にしたリージョン
- `SSO registration scopes`: 通常は `sso:account:access`
- そのあと、ブラウザーで認可すると、アクセスできるアカウントと許可セットの一覧が表示されるので、使うものを選びます。
- `CLI default client Region`: デプロイ先のリージョン（例: `ap-northeast-1`）
- `CLI profile name`: プロファイル名（例: `dev`、`prod`）

設定は `~/.aws/config` に保存されます。ログインは、SSO セッション単位で 1 回行えば、同じセッションを使うプロファイルすべてに有効です。

```bash
aws sso login --profile dev
```

一時的な認証情報は期限が切れるので、失効したら同じコマンドで再ログインします。

### 3-4. 認証先アカウントの確認

デプロイ先を取り違えないよう、実行前に必ず確認します。

<!-- TODO 今の自分のユーザーを取得するコマンド　作業前に必須 -->
```bash
aws sts get-caller-identity --profile namacha_dev

aws sts get-caller-identity --profile prod
```

出力の `Account` が、意図したアカウント ID になっていることを確認してください。

### 3-5. プロファイルを省略する場合

コマンドの `--profile` を省略すると、`default` プロファイルが使われます。本番アカウントを誤って操作するのを防ぐため、複数アカウントを扱う場合は `default` に頼らず、毎回 `--profile` を明示するか、環境変数 `AWS_PROFILE` を設定して使ってください。

```bash
export AWS_PROFILE=dev
```

CDK アプリのスタック定義でアカウントやリージョンを明示している場合は、その設定が CLI の値より優先されます。CLI のプロファイルと、スタック定義の `env` が異なるアカウントを指していると、デプロイ時にエラーになったり、意図しないアカウントが対象になったりします。

### 3-6. アクセスキーを使う場合

Identity Center を導入できない場合は、IAM ユーザーのアクセスキーを `aws configure --profile dev` で登録する方法もあります。ただし、長期のキーは漏えい時の影響が大きく、アカウントごとに別のキーを管理する必要があります。特に本番アカウントでは、Identity Center への移行を推奨します。

> 公式ドキュメント: [IAM Identity Center を使用するための AWS CLI の設定](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)、[許可セット](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html)

## 4. CDK アプリの作成

ワークスペース直下で実行します。

```bash
mkdir my-cdk-app
cd my-cdk-app
cdk init app --language typescript
npm install
```

`cdk init` は TypeScript のサンプルアプリ、設定ファイル、依存関係を生成します。主なファイルは以下のとおりです。

- `bin/`: CDK アプリのエントリポイント
- `lib/`: Stack と AWS リソースの定義
- `test/`: テスト
- `cdk.json`: CDK CLI がアプリを実行する方法などの設定

## 5. 生成物の確認

TypeScript をビルドし、テストを実行します。

```bash
npm run build
npm test
```

スタック一覧を確認して、CloudFormation テンプレートを生成します。

```bash
cdk list
cdk synth
```

## 6. AWS 環境の Bootstrap

CDK デプロイに必要な S3 バケット、ECR リポジトリ、IAM ロールなどを、アカウントとリージョンの組み合わせごとに初回だけ作成します。デプロイ先を必ず確認して実行してください。

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION --profile PROFILE_NAME
```

例：

```bash
cdk bootstrap aws://123456789012/ap-northeast-1 --profile my-profile
```

Bootstrap リソースの保管や利用に AWS 料金が発生することがあります。Bootstrap に必要な IAM 権限が不足している場合は、AWS 管理者に確認してください。

## 7. 差分確認とデプロイ

デプロイ前に、AWS に適用される変更を確認します。

```bash
cdk diff --profile PROFILE_NAME
```

内容と対象アカウント・リージョンを確認してからデプロイします。

```bash
cdk deploy --profile PROFILE_NAME
```

CDK CLI が変更内容の承認を求めたら、内容を確認して応答します。承認確認を無効にする設定は、意図しない権限やセキュリティルールの変更につながる可能性があるため、安易に指定しないでください。

## 8. 変更の反映

`lib/` 以下の Stack 定義を編集したら、再度ビルド、差分確認、デプロイを行います。

```bash
npm run build
cdk synth
cdk diff --profile PROFILE_NAME
cdk deploy --profile PROFILE_NAME
```

## 9. リソースの削除

検証用スタックが不要になった場合は、対象を確認して削除します。

```bash
cdk destroy --profile PROFILE_NAME
```

スタック削除時には、CloudFormation の削除ポリシーに応じてリソースが削除または保持されます。必要なデータをバックアップし、削除対象を確認してください。Bootstrap 用の `CDKToolkit` スタックは通常、アプリのスタックとは別に残ります。共有環境で使われていないことを確認せずに削除しないでください。

## よく使うコマンド

| コマンド | 用途 |
| --- | --- |
| `cdk list` | アプリ内のスタック一覧 |
| `cdk synth` | CloudFormation テンプレートの生成 |
| `cdk diff` | 定義とデプロイ済みスタックの差分確認 |
| `cdk deploy` | スタックのデプロイ |
| `cdk destroy` | スタックの削除 |

## 公式ドキュメント

- [AWS CDK v2 Developer Guide: Getting started](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
- [AWS CDK CLI reference](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)
- [AWS CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
