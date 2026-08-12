// src/api/tdx/auth.ts

import axios from 'axios';
import type { TdxAuthToken } from '@/types';

const TDX_AUTH_URL =
  'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';

interface TokenCache {
  accessToken: string | null;
  expiresAt: number;
}

const tokenCache: TokenCache = {
  accessToken: null,
  expiresAt: 0,
};

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

/**
 * Single-flight 鎖：避免多個請求同時觸發重複的 Token 取得流程
 * 若已有一個取得 Token 的請求正在進行中，後續呼叫直接共用同一個 Promise，
 * 確保絕不會有請求在 Token 尚未 resolve 完成前，帶著 undefined 送出
 */
let inFlightRequest: Promise<string> | null = null;

/**
 * 向 TDX 認證伺服器發送 Client Credentials 請求，取得全新 Access Token
 */
async function requestNewToken(): Promise<TdxAuthToken> {
  const clientId = import.meta.env.VITE_TDX_CLIENT_ID as string | undefined;
  const clientSecret = import.meta.env.VITE_TDX_CLIENT_SECRET as string | undefined;

  if (!clientId || !clientSecret) {
    throw new Error(
      '缺少 TDX 認證資訊，請確認 .env 檔案已設定 VITE_TDX_CLIENT_ID 與 VITE_TDX_CLIENT_SECRET',
    );
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  const response = await axios.post<TdxAuthToken>(TDX_AUTH_URL, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

/**
 * 取得有效的 TDX Access Token（含快取與 single-flight 保護）
 *
 * 保證：
 * 1. 快取有效時直接回傳字串，不重新請求
 * 2. 快取失效時，若已有請求正在飛行中，所有呼叫者共用同一個 Promise（避免併發重複請求）
 * 3. 絕不會回傳 undefined / null，取得失敗一律 throw，交由呼叫端處理，不讓 header 帶入無效值
 */
export async function fetchToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache.accessToken && now < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokenCache.accessToken;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = (async () => {
    try {
      const tokenData = await requestNewToken();

      if (!tokenData.access_token) {
        throw new Error('TDX 回傳的 Token 為空值');
      }

      tokenCache.accessToken = tokenData.access_token;
      tokenCache.expiresAt = Date.now() + tokenData.expires_in * 1000;

      return tokenCache.accessToken;
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function clearTokenCache(): void {
  tokenCache.accessToken = null;
  tokenCache.expiresAt = 0;
}