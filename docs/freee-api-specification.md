# freee会計API仕様書

## 概要

freee会計APIは、freeeの会計機能を外部プログラムから利用するためのインターフェースです。本APIを使用することで、取引データの作成・取得、勘定科目の管理、請求書の発行など、会計業務に関する様々な操作をプログラマティックに実行できます。

## 基本仕様

### API形式
- **プロトコル**: HTTPS
- **データ形式**: JSON
- **文字コード**: UTF-8
- **日付形式**: ISO 8601形式（YYYY-MM-DD）

### ベースURL
```
https://api.freee.co.jp/api/1
```

### リクエストヘッダー
```
Content-Type: application/json
Authorization: Bearer {access_token}
```

## 認証（OAuth 2.0）

freee APIはOAuth 2.0のAuthorization Code Grantフローを使用します。

### 1. アプリケーション登録
freeeアプリストアでアプリケーションを登録し、以下を取得：
- Client ID
- Client Secret

### 2. 認可コード取得

**認証用URL**
```
https://accounts.secure.freee.co.jp/public_api/authorize
```

**パラメータ**
- `client_id`: アプリケーションのClient ID
- `redirect_uri`: リダイレクトURI（例：`urn:ietf:wg:oauth:2.0:oob`）
- `response_type`: `code`
- `prompt`: （オプション）`select_company`を指定すると事業所選択画面を表示

### 3. アクセストークン取得

**エンドポイント**
```
POST https://accounts.secure.freee.co.jp/public_api/token
```

**リクエストボディ**
```
grant_type=authorization_code
client_id={Client ID}
client_secret={Client Secret}
code={認可コード}
redirect_uri={リダイレクトURI}
```

**レスポンス例**
```json
{
  "access_token": "XXXXXXXXXXXXXXXXXXXXXXXXX",
  "token_type": "bearer",
  "expires_in": 86400,
  "refresh_token": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "scope": "read write default_read",
  "created_at": 1556711794
}
```

### 4. トークン更新

**エンドポイント**
```
POST https://accounts.secure.freee.co.jp/public_api/token
```

**リクエストボディ**
```
grant_type=refresh_token
client_id={Client ID}
client_secret={Client Secret}
refresh_token={リフレッシュトークン}
```

### トークン有効期限
- **アクセストークン**: 2時間（7200秒）または24時間（86400秒）
- **リフレッシュトークン**: 無期限（次のリフレッシュトークンを取得するまで）

## 主要エンドポイント

### 1. 事業所（Companies）

#### 事業所一覧取得
```
GET /companies
```

**レスポンス例**
```json
{
  "companies": [
    {
      "id": 1,
      "name": "テスト事業所",
      "name_kana": "テストジギョウショ",
      "display_name": "テスト事業所",
      "role": "admin"
    }
  ]
}
```

### 2. 取引（Deals）

#### 取引一覧取得
```
GET /deals
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `partner_id`: 取引先ID
- `account_item_id`: 勘定科目ID
- `start_issue_date`: 発生日の開始日
- `end_issue_date`: 発生日の終了日
- `offset`: オフセット
- `limit`: 取得件数（デフォルト20、最大100）

#### 取引作成
```
POST /deals
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "issue_date": "2024-01-01",
  "type": "income",
  "partner_id": 10,
  "details": [
    {
      "account_item_id": 101,
      "tax_code": 101,
      "amount": 10000,
      "description": "売上"
    }
  ]
}
```

### 3. 勘定科目（Account Items）

#### 勘定科目一覧取得
```
GET /account_items
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `account_category`: 勘定科目カテゴリー

#### 勘定科目作成
```
POST /account_items
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "name": "新規勘定科目",
  "shortcut": "NEWITEM",
  "account_category": "sales",
  "tax_code": 101
}
```

### 4. 取引先（Partners）

#### 取引先一覧取得
```
GET /partners
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `name`: 取引先名（部分一致）
- `shortcut1`: ショートカット1
- `offset`: オフセット
- `limit`: 取得件数

#### 取引先作成
```
POST /partners
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "name": "新規取引先株式会社",
  "shortcut1": "NEWPARTNER",
  "country_code": "JP",
  "long_name": "新規取引先株式会社",
  "name_kana": "シンキトリヒキサキカブシキガイシャ"
}
```

### 5. 部門（Sections）

#### 部門一覧取得
```
GET /sections
```

**パラメータ**
- `company_id`: 事業所ID（必須）

#### 部門作成
```
POST /sections
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "name": "営業部",
  "shortcut1": "SALES"
}
```

### 6. メモタグ（Tags）

#### メモタグ一覧取得
```
GET /tags
```

**パラメータ**
- `company_id`: 事業所ID（必須）

#### メモタグ作成
```
POST /tags
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "name": "重要",
  "shortcut": "IMP"
}
```

### 7. 仕訳帳（Journals）

#### 仕訳帳ダウンロード
```
GET /journals
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `download_type`: ダウンロード形式（`csv`, `pdf`, `yayoi`）
- `start_date`: 開始日
- `end_date`: 終了日

**注意**: 無料プランでは利用不可

### 8. 請求書（Invoices）

#### 請求書一覧取得
```
GET /invoices
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `partner_id`: 取引先ID
- `invoice_status`: 請求書ステータス
- `payment_status`: 入金ステータス

#### 請求書作成
```
POST /invoices
```

**リクエストボディ例**
```json
{
  "company_id": 1,
  "issue_date": "2024-01-01",
  "due_date": "2024-01-31",
  "partner_id": 10,
  "invoice_status": "draft",
  "invoice_lines": [
    {
      "name": "商品A",
      "quantity": 1,
      "unit_price": 10000,
      "tax_code": 101
    }
  ]
}
```

### 9. 経費申請（Expense Applications）

#### 経費申請一覧取得
```
GET /expense_applications
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `status`: 申請ステータス
- `start_application_date`: 申請日開始
- `end_application_date`: 申請日終了

#### 経費申請作成
```
POST /expense_applications
```

### 10. ファイルボックス（Receipts）

#### ファイルアップロード
```
POST /receipts
```

**パラメータ**
- `company_id`: 事業所ID（必須）
- `receipt`: アップロードファイル（multipart/form-data）
- `description`: ファイルの説明

## エラーレスポンス

APIは以下の形式でエラーを返します：

```json
{
  "status_code": 400,
  "errors": [
    {
      "type": "bad_request",
      "messages": ["不正なリクエストです"]
    }
  ]
}
```

### 主なステータスコード
- `200`: 成功
- `201`: 作成成功
- `400`: 不正なリクエスト
- `401`: 認証エラー
- `403`: アクセス権限なし
- `404`: リソースが見つからない
- `429`: レート制限超過
- `500`: サーバーエラー

## レート制限

- 1時間あたり3,600リクエスト
- 1分あたり60リクエスト

レート制限に達した場合、`429 Too Many Requests`が返されます。

## Webhook

freee APIはWebhook機能を提供しており、以下のイベントで通知を受け取れます：

- 経費申請の作成
- 申請の承認・却下
- ワークフローイベント

### Webhook設定
1. freeeアプリストアでWebhook URLを設定
2. 通知を受け取りたいイベントを選択
3. シークレットトークンを使用して署名を検証

## 注意事項

1. **company_id**: ほとんどのAPIコールで事業所ID（company_id）が必須です
2. **勘定科目ID**: 勘定科目IDは事業所ごとに異なるため、事前に取得が必要です
3. **日付形式**: すべての日付はISO 8601形式（YYYY-MM-DD）で指定します
4. **金額**: 金額は税込み・税抜きの設定に注意が必要です
5. **トークン管理**: アクセストークンの有効期限に注意し、適切に更新してください

## 参考リンク

- [freee Developers Community](https://developer.freee.co.jp/)
- [会計API リファレンス](https://developer.freee.co.jp/reference/accounting/reference)
- [スタートガイド](https://developer.freee.co.jp/startguide)
- [FAQ](https://developer.freee.co.jp/reference/faq)