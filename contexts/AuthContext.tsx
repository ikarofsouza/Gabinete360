
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

  /**
   * Busca o perfil do usuário no Firestore com tolerância a falhas de permissão.
   */
  const buscarPerfilUsuario = async (uid: string, emailAuth?: string | null): Promise<User | null> => {
    try {
      // 1. Tentativa por ID Direto (UID do Firebase Auth ou ID do Doc)
      try {
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.status !== 'ACTIVE') {
            if (auth.currentUser) await firebaseSignOut(auth);
            return null;
          }
          return { ...userData, id: uid };
        }
      } catch (docError: any) {
        // Ignora erros de permissão na busca direta, tenta fallback por email
        if (docError.code !== 'permission-denied') {
            console.warn("AuthContext: Falha ao buscar doc direto.", docError.code);
        }
      }

      // 2. Fallback: Busca por e-mail com múltiplas variações
      if (emailAuth) {
        const emailClean = emailAuth.trim();
        const usersRef = collection(db, "users");
        const variações = [emailClean, emailClean.toLowerCase(), emailClean.toUpperCase()];
        
        try {
          const q = query(usersRef, where("email", "in", variações), limit(1));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const foundDoc = querySnapshot.docs[0];
            const userData = foundDoc.data() as User;
            
            if (userData.status !== 'ACTIVE') {
              if (auth.currentUser) await firebaseSignOut(auth);
              return null;
            }
            return { ...userData, id: foundDoc.id };
          }
        } catch (queryError: any) {
          // Se falhar por permissão aqui, o usuário autenticado não tem acesso à coleção
          if (queryError.code !== 'permission-denied') {
             console.error("AuthContext: Erro ao listar usuários.", queryError);
          }
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error("AuthContext: Erro crítico não tratado ao carregar perfil:", error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (user && (user.id === firebaseUser.uid || user.email?.toLowerCase() === firebaseUser.email?.toLowerCase())) {
          setLoading(false);
          return;
        }
        
        const perfil = await buscarPerfilUsuario(firebaseUser.uid, firebaseUser.email);
        setUser(perfil);
      } else {
        // Fallback: Verificar sessão customizada
        const storedSession = localStorage.getItem('g360_custom_session');
        if (storedSession) {
          try {
            const sessionUser = JSON.parse(storedSession);
            if (user && user.id === sessionUser.id) {
                setLoading(false);
                return;
            }
            // Valida se o usuário ainda existe e está ativo no banco
            const perfil = await buscarPerfilUsuario(sessionUser.id, sessionUser.email);
            if (perfil) {
              setUser(perfil);
            } else {
              localStorage.removeItem('g360_custom_session');
              setUser(null);
            }
          } catch (e) {
            localStorage.removeItem('g360_custom_session');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async (identificador: string, senha: string) => {
    setLoading(true);
    try {
      setUser(null);
      const idLimpo = identificador.trim();
      let emailFinal = idLimpo;
      
      // Resolução de Credencial (Username ou ID) antes do Auth
      // Isso pode falhar se as regras de segurança bloquearem leitura pública
      if (!idLimpo.includes('@')) {
        try {
          const usersRef = collection(db, "users");
          // Busca por Username
          const qUsername = query(usersRef, where("username", "==", idLimpo.toLowerCase()), limit(1));
          const snapUsername = await getDocs(qUsername);
          
          if (!snapUsername.empty) {
            emailFinal = snapUsername.docs[0].data().email;
          } else {
            // Se falhar a busca por username, tenta ID direto apenas se parecer um ID
            if (idLimpo.length > 5) {
                try {
                    const docRef = doc(db, "users", idLimpo);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                    emailFinal = docSnap.data().email;
                    }
                } catch(e) { /* Ignora erro de permissão no lookup direto */ }
            }
          }
        } catch (lookupError: any) {
          // Se der erro de permissão, assumimos que o input JÁ É o email ou que o login falhará no Auth se não for
          if (lookupError.code !== 'permission-denied') {
             console.warn("AuthContext: Falha ao resolver username.", lookupError);
          }
        }
      }

      // Tentativa 1: Autenticação no Firebase Auth
      try {
        const credencial = await signInWithEmailAndPassword(auth, emailFinal, senha);
        const perfil = await buscarPerfilUsuario(credencial.user.uid, credencial.user.email);
        
        if (!perfil) {
          await firebaseSignOut(auth);
          throw new Error("Seu perfil foi autenticado, mas o registro interno não pôde ser acessado (Permissão ou Inexistente).");
        }
        
        setUser(perfil);
        // Log não bloqueante
        logger.log('LOGIN', 'AUTH', perfil.id, perfil, [{ field: 'acesso', new_value: 'LOGIN_FIREBASE' }]).catch(console.error);
        
      } catch (authError: any) {
        // Códigos que justificam tentar o login interno (Fallback)
        const errorCodes = ['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-email', 'permission-denied'];
        
        // Se o erro foi 'permission-denied' ou auth falhou, tentamos o método legado/interno SE possível
        if (errorCodes.includes(authError.code) || authError.code?.includes('permission')) {
           try {
             const usersRef = collection(db, "users");
             const q = query(usersRef, where("email", "==", emailFinal), limit(1));
             const snapshot = await getDocs(q);

             if (!snapshot.empty) {
               const docData = snapshot.docs[0].data();
               // Validação rudimentar de senha para sistema legado sem Auth
               if (docData.password === senha) {
                 if (docData.status !== 'ACTIVE') throw new Error("Conta inativa ou bloqueada.");
                 
                 const customUser = { ...docData, id: snapshot.docs[0].id } as User;
                 
                 localStorage.setItem('g360_custom_session', JSON.stringify(customUser));
                 setUser(customUser);
                 logger.log('LOGIN', 'AUTH', customUser.id, customUser, [{ field: 'acesso', new_value: 'LOGIN_INTERNO' }]).catch(console.error);
                 return; 
               }
             }
           } catch (fallbackError: any) {
             // Se falhar o fallback por permissão, significa que realmente não temos acesso.
             // Não logamos como erro crítico para não poluir o console.
             if (fallbackError.code !== 'permission-denied') {
                console.error("AuthContext: Fallback falhou.", fallbackError);
             }
           }
        }
        
        throw authError;
      }

    } catch (error: any) {
      setUser(null);
      let mensagemErro = "Não foi possível realizar o acesso.";
      
      const txt = error.message || error.code || '';
      
      if (txt.includes('password') || txt.includes('credential')) {
        mensagemErro = "Credenciais inválidas. Verifique e-mail e senha.";
      } else if (txt.includes('user-not-found')) {
        mensagemErro = "Usuário não localizado.";
      } else if (txt.includes('too-many-requests')) {
        mensagemErro = "Conta temporariamente bloqueada por excesso de tentativas.";
      } else if (txt.includes('permission') || txt.includes('insufficient')) {
        mensagemErro = "Acesso Negado: Permissões insuficientes para ler o perfil do usuário.";
      } else {
        mensagemErro = txt;
      }
      
      throw new Error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (user) await logger.log('LOGIN', 'AUTH', user.id, user, [{ field: 'sessao', new_value: 'LOGOUT' }]).catch(console.error);
      
      localStorage.removeItem('g360_custom_session');
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
