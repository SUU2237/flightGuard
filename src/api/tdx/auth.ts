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
//過期緩衝區：如果 Token 只剩不到 1 分鐘就要過期，就提早視為失效並重新取得
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

/**
 * 記錄「正在向伺服器請求 Token 的 Promise」
 * 避免多個請求同時觸發重複的 Token 取得流程
 */
let inFlightRequest: Promise<string> | null = null;

/**
 * 向 TDX 認證伺服器發送請求，取得全新 Access Token
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
 * 取得 TDX Access Token 前的快取與保護
 * 刷新頁面的時候，可能會同時呼叫「查全量機場」、「查全量航空公司」、「查航班看板」3 支 API，如果沒有鎖就會重複發送請求
 */
export async function fetchToken(): Promise<string> {
  const now = Date.now();
  // 1. 快取還有效，直接回傳
  if (tokenCache.accessToken && now < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokenCache.accessToken;
  }
  // 2. 如果已經有別人在排隊要 Token，直接共用他的 Promise
  if (inFlightRequest) {
    return inFlightRequest;
  }
  // 3. 真正發送請求，並把 Promise 存入 inFlightRequest 鎖定
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