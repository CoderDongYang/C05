import axios, { AxiosError } from 'axios';
import { getToken, logout } from '@/utils';
import { getGlobalMessage } from '@/utils/message';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ message?: string }>) => {
    const message = getGlobalMessage();
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        window.location.href = '/login';
      } else if (status === 403) {
        message.error('没有权限执行此操作');
      } else {
        const msg = data?.message || error.message;
        message.error(msg);
      }
    } else if (error.request) {
      message.error('网络错误，请稍后重试');
    }
    return Promise.reject(error);
  },
);

export default client;
