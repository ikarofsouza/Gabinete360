import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ConstituentList from './pages/ConstituentList';
import DemandList from './pages/DemandList';
import TerritorialMap from './pages/TerritorialMap';
import ControlCenter from './pages/ControlCenter';

// Placeholders simples para rotas em construção
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-4">
        <span className="text-2xl font-bold">!</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-4 text-slate-500 max-w-md mx-auto">
        Este módulo está sendo preparado pela engenharia e estará disponível na próxima atualização do MVP.
      </p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />

            {/* Rotas Protegidas (Dashboard, etc) */}
            <Route path="/app" element={<MainLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="eleitores" element={<ConstituentList />} />
              <Route path="demandas" element={<DemandList />} />
              <Route path="mapa" element={<TerritorialMap />} />
              <Route path="config-gabinete" element={<ControlCenter />} />
              <Route path="agenda" element={<Placeholder title="Agenda Legislativa" />} />
              <Route path="relatorios" element={<Placeholder title="Relatórios e KPIs" />} />
              <Route path="comunicacao" element={<Placeholder title="Comunicação WhatsApp" />} />
              <Route path="config" element={<Placeholder title="Configurações do Gabinete" />} />
            </Route>

            {/* Redirecionamento Padrão */}
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;