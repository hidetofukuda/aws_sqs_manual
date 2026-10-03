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

IAM Identity Center（AWS SSO）を使う場合は、プロファイルを設定したうえでログインします。

```bash
aws configure sso
aws sso login --profile PROFILE_NAME
```

アクセスキーなど、別の認証方式を使う場合は AWS CLI の認証設定を済ませます。認証先アカウントを確認してください。

```bash
aws sts get-caller-identity --profile PROFILE_NAME
```

コマンドで `--profile PROFILE_NAME` を省略する場合は、利用する認証情報とデフォルトリージョンが `default` プロファイルに設定されていることを確認します。CDK アプリのスタック定義でアカウントやリージョンを明示する場合は、その設定が CLI の値より優先されます。

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
