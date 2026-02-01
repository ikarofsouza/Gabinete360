
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('ana@gabinete.leg.br');
  const [password, setPassword] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await login(email);
      navigate('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-8 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-200">
              <span className="text-2xl font-bold">G</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Gabinete360</h1>
            <p className="text-slate-500 mt-2 text-sm">Acesse sua plataforma de gestão legislativa</p>
          </div>

          <div className="px-8 pb-8">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-100 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Acessar Gabinete'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Ambiente de Demonstração</p>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 flex justify-between">
                    <span>Admin:</span> <span className="font-medium">ana@gabinete.leg.br</span>
                  </p>
                  <p className="text-xs text-slate-600 flex justify-between">
                    <span>Assessor:</span> <span className="font-medium">marcos@gabinete.leg.br</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center mt-8 text-slate-400 text-xs">
          &copy; 2024 Gabinete360 - Tecnologia Legislativa
        </p>
      </div>
    </div>
  );
};

export default Login;
