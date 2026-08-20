// src/api/http.ts

import axios, {
  type AxiosInstance,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { fetchToken, clearTokenCache } from '@/api/tdx/auth';

export const TDX_API_BASE_URL = 'https://tdx.transportdata.tw/api/basic';

/**
 * 共用 Axios Instance
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: TDX_API_BASE_URL,
  timeout: 15000,
});

/**
 * Request 攔截器
 * 強制 await fetchToken() 直到取得非空字串後，才使用 headers.set() 組裝 Authorization，
 * 確保絕不會發生 "Bearer undefined" 或 "Bearer null" 的情況
 */
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await fetchToken();

    if (!token || typeof token !== 'string') {
      // 理論上 fetchToken() 失敗時會 throw，此處為最後一道防線，避免帶入無效值送出請求
      throw new Error('取得 TDX Access Token 失敗，已中止請求');
    }

    config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

/**
 * Response 攔截器
 */
httpClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError | Error) => {
    let message = '未知錯誤，請稍後再試';

    if (!axios.isAxiosError(error)) {
      console.error('[httpClient] 非 Axios 錯誤：', error);
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }

    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        message = 'TDX 認證失敗或 Token 已過期，請確認 Client ID / Secret 是否正確';
        clearTokenCache();
      } else if (status === 429) {
        message = 'TDX API 請求次數超過限制，請稍後再試';
      } else {
        message = `TDX API 回應錯誤（狀態碼 ${status}）`;
      }
    } else if (error.request) {
      message = '無法連線至 TDX API，請檢查網路連線';
    }

    return Promise.reject(new Error(message));
  },
);

export default httpClient;