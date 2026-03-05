/**
 * Custom error classes for error handling
 */

import { FreeeApiError } from './types/freee.js';

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public companyId?: number,
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

const STATUS_HINTS: Record<number, string> = {
  400: '不正なリクエストエラーが発生しました。既存データを取得して正しい構造を確認することをお勧めします。',
  401: '認証エラーが発生しました。freee_get_auth_url を使用して再認証してください。',
  403: '権限が不足しています。freee アプリの OAuth 権限設定を確認してください。',
};

/**
 * Format a freee API error response into a human/LLM-readable message.
 * Falls back to the raw error message when `errors` field is absent.
 */
export function formatFreeeApiError(
  status: number,
  statusText: string,
  data: unknown,
  fallbackMessage: string,
): string {
  const apiError = data as FreeeApiError | undefined;
  const messages = Array.isArray(apiError?.errors)
    ? apiError.errors.flatMap((e) => e.messages ?? [])
    : [];

  if (!messages || messages.length === 0) {
    return `freee API Error: ${fallbackMessage}`;
  }

  const lines = [
    `APIリクエストエラー: ${status} ${statusText}`,
    '',
    'エラー詳細:',
  ];
  for (const msg of messages) {
    lines.push(`- ${msg}`);
  }

  const hint = STATUS_HINTS[status];
  if (hint) {
    lines.push('', `ヒント: ${hint}`);
  }

  return lines.join('\n');
}
