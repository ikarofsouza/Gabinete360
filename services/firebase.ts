import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuração fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyCrDPc1jOpn1LW6yFmIvi5yAHFL09T-pXI",
  authDomain: "gabinete360-46feb.firebaseapp.com",
  projectId: "gabinete360-46feb",
  storageBucket: "gabinete360-46feb.firebasestorage.app",
  messagingSenderId: "1002205752093",
  appId: "1:1002205752093:web:ed72eaea027f84d25dcff4"
};

// Singleton pattern para evitar erro de inicialização múltipla ou registro de componente
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;