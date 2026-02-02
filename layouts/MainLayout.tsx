
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="p-8 text-center mt-auto border-t border-slate-100 bg-white/50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Desenvolvido por <a href="https://www.linkedin.com/in/ikarosouza" target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-blue-600 transition-colors">Íkaro Souza</a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
