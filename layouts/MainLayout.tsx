
import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw } from 'lucide-react';

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
          <footer className="p-8 text-center mt-auto border-t border-slate-100 bg-white/50 space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
              Desenvolvido por <a href="https://www.linkedin.com/in/ikarosouza" target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-blue-600 transition-colors">Íkaro Souza</a>
            </p>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Gabinete360 v2.5.2</span>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 font-black uppercase text-[8px] cursor-help group relative">
                <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
                Atualização detectada pelo sistema
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-slate-900 text-white text-[9px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl border border-white/10 z-50">
                  <p className="leading-relaxed">Core v2.5.2 em execução. Todos os módulos de Inteligência Legislativa e Auditoria estão sincronizados com a versão estável.</p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
