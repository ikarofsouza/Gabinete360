
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User as UserIcon, Loader2, ShieldCheck, Eye, EyeOff, ChevronRight, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Se o usuário já estiver logado (estado estabilizado), redireciona
  useEffect(() => {
    if (user) {
      navigate('/app/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErro('');

    try {
      await login(identificador, senha);
      // O useEffect acima cuidará do redirecionamento assim que o estado 'user' for preenchido
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado ao conectar com o gabinete.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-[480px] z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-200/60">
          
          {/* Cabeçalho do Login */}
          <div className="p-12 pb-8 text-center bg-slate-50/50 border-b border-slate-100">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-blue-600 text-white mb-8 shadow-2xl shadow-blue-200 group transition-transform hover:scale-105 duration-500">
              <ShieldCheck size={48} className="group-hover:rotate-6 transition-transform" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">
              Gabinete<span className="text-blue-600">360</span>
            </h1>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2">
              <span className="w-8 h-[1px] bg-slate-200" />
              Acesso Restrito
              <span className="w-8 h-[1px] bg-slate-200" />
            </p>
          </div>

          {/* Formulário */}
          <div className="p-12 space-y-8">
            {erro && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl animate-in shake flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-[11px] font-black uppercase tracking-tight leading-relaxed">{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Usuário ou E-mail</label>
                <div className="relative group">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="E-mail ou nome de usuário"
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-slate-900 font-bold text-sm focus:ring-4 focus:ring-blue-600/5 focus:bg-white focus:border-blue-600/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="px-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha de Acesso</label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-14 pr-14 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-slate-900 font-bold text-sm focus:ring-4 focus:ring-blue-600/5 focus:bg-white focus:border-blue-600/20 outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 bg-blue-600 text-white font-black uppercase text-xs tracking-[0.2em] rounded-[1.5rem] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-2xl shadow-blue-200 disabled:opacity-70 flex items-center justify-center gap-3 group"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Rodapé Interno */}
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Conexão segura. Sua sessão é monitorada para auditoria.
            </p>
          </div>
        </div>

        {/* Rodapé Externo */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
            Desenvolvido por <a href="https://www.linkedin.com/in/ikarosouza" target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-blue-600 transition-colors">Íkaro Souza</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
