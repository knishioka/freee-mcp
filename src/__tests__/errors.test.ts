import { formatFreeeApiError } from '../errors.js';

describe('formatFreeeApiError', () => {
  it('should format errors with flattened messages', () => {
    const data = {
      status_code: 400,
      errors: [
        {
          type: 'validation',
          messages: ['取引日は必須です', '勘定科目IDが不正です'],
        },
      ],
    };

    const result = formatFreeeApiError(400, 'Bad Request', data, 'fallback');

    expect(result).toContain('APIリクエストエラー: 400 Bad Request');
    expect(result).toContain('- 取引日は必須です');
    expect(result).toContain('- 勘定科目IDが不正です');
  });

  it('should add hint for 400 errors', () => {
    const data = {
      status_code: 400,
      errors: [{ type: 'validation', messages: ['エラー'] }],
    };

    const result = formatFreeeApiError(400, 'Bad Request', data, 'fallback');

    expect(result).toContain('ヒント: 不正なリクエストエラーが発生しました');
  });

  it('should add hint for 401 errors', () => {
    const data = {
      status_code: 401,
      errors: [{ type: 'status', messages: ['認証エラー'] }],
    };

    const result = formatFreeeApiError(401, 'Unauthorized', data, 'fallback');

    expect(result).toContain('ヒント: 認証エラーが発生しました');
  });

  it('should add hint for 403 errors', () => {
    const data = {
      status_code: 403,
      errors: [{ type: 'status', messages: ['権限がありません'] }],
    };

    const result = formatFreeeApiError(403, 'Forbidden', data, 'fallback');

    expect(result).toContain('ヒント: 権限が不足しています');
  });

  it('should not add hint for unknown status codes', () => {
    const data = {
      status_code: 500,
      errors: [{ type: 'status', messages: ['サーバーエラー'] }],
    };

    const result = formatFreeeApiError(
      500,
      'Internal Server Error',
      data,
      'fallback',
    );

    expect(result).toContain('APIリクエストエラー: 500 Internal Server Error');
    expect(result).toContain('- サーバーエラー');
    expect(result).not.toContain('ヒント:');
  });

  it('should flatten messages from multiple error objects', () => {
    const data = {
      status_code: 400,
      errors: [
        { type: 'validation', messages: ['エラーA'] },
        { type: 'validation', messages: ['エラーB', 'エラーC'] },
      ],
    };

    const result = formatFreeeApiError(400, 'Bad Request', data, 'fallback');

    expect(result).toContain('- エラーA');
    expect(result).toContain('- エラーB');
    expect(result).toContain('- エラーC');
  });

  it('should fall back when errors field is absent', () => {
    const result = formatFreeeApiError(400, 'Bad Request', {}, 'Network error');

    expect(result).toBe('freee API Error: Network error');
  });

  it('should fall back when data is undefined', () => {
    const result = formatFreeeApiError(
      500,
      'Internal Server Error',
      undefined,
      'Server error',
    );

    expect(result).toBe('freee API Error: Server error');
  });

  it('should fall back when errors array is empty', () => {
    const data = { status_code: 400, errors: [] };

    const result = formatFreeeApiError(400, 'Bad Request', data, 'fallback');

    expect(result).toBe('freee API Error: fallback');
  });

  it('should fall back when messages array is empty', () => {
    const data = {
      status_code: 400,
      errors: [{ type: 'validation', messages: [] }],
    };

    const result = formatFreeeApiError(400, 'Bad Request', data, 'fallback');

    expect(result).toBe('freee API Error: fallback');
  });
});
