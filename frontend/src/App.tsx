import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect } from 'react';
import Login from '@/pages/Login';
import ToggleList from '@/pages/ToggleList';
import { AuthGuard } from '@/guards/AuthGuard';
import { setGlobalMessage } from '@/utils/message';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent = () => {
  const { message } = AntdApp.useApp();

  useEffect(() => {
    setGlobalMessage(message);
  }, [message]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <ToggleList />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#667eea',
            borderRadius: 6,
          },
        }}
      >
        <AntdApp>
          <AppContent />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
