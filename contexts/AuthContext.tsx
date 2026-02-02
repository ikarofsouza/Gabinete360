
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User } from '../types';
import { logger } from '../services/LoggerService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identificador: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const buscarPerfilUsuario = async (uid: string): Promise<User | null> => {
    try {
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        if (userData.status !== 'ACTIVE') {
          await firebaseSignOut(auth);
          return null;
        }
        return { ...userData, id: uid };
      }
      return null;
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Se já temos um usuário no estado e o ID é o mesmo, não recarregamos
      if (firebaseUser) {
        if (!user || user.id !== firebaseUser.uid) {
          setLoading(true);
          const perfil = await buscarPerfilUsuario(firebaseUser.uid);
          setUser(perfil);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async (identificador: string, senha: string) => {
    // Iniciamos o carregamento imediatamente
    setLoading(true);
    try {
      let emailFinal = identificador.trim();
      
      if (!identificador.includes('@')) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", identificador.toLowerCase()), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          throw new Error("Usuário não encontrado. Verifique o nome digitado.");
        }
        
        emailFinal = snapshot.docs[0].data().email;
      }

      const credencial = await signInWithEmailAndPassword(auth, emailFinal, senha);
      
      // Forçamos a busca imediata do perfil para evitar o delay do onAuthStateChanged
      const perfil = await buscarPerfilUsuario(credencial.user.uid);
      
      if (!perfil) {
        throw new Error("Conta inativa ou não localizada. Contate o administrador.");
      }
      
      // Atualizamos o estado antes de encerrar o loading
      setUser(perfil);
      await logger.log('LOGIN', 'AUTH', perfil.id, perfil, [{ field: 'acesso', new_value: 'LOGIN_SUCESSO' }]);

    } catch (error: any) {
      console.error("Erro de Login:", error);
      let mensagemErro = "Falha na autenticação.";
      
      if (error.code === 'auth/wrong-password') mensagemErro = "Senha incorreta.";
      else if (error.code === 'auth/user-not-found') mensagemErro = "Usuário não cadastrado.";
      else if (error.code === 'auth/invalid-credential') mensagemErro = "Credenciais inválidas.";
      else if (error.code === 'auth/network-request-failed') mensagemErro = "Sem conexão com o servidor.";
      else if (error.message) mensagemErro = error.message;

      // Se houver erro, garantimos que o usuário seja null e o loading pare
      setUser(null);
      throw new Error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (user) {
        await logger.log('LOGIN', 'AUTH', user.id, user, [{ field: 'sessao', new_value: 'LOGOUT' }]);
      }
      await firebaseSignOut(auth);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
