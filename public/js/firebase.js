// Importações oficiais do Firebase (Versão 10.12.3)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// ==========================================
// 1. CREDENCIAIS DO PROJETO (Não altere as suas chaves!)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBF12hSZxCHFCp8PYq_p8kEvtZS_JbhC0k",
  authDomain: "olomi-428be.firebaseapp.com",
  projectId: "olomi-428be",
  storageBucket: "olomi-428be.firebasestorage.app",
  messagingSenderId: "914110620241",
  appId: "1:914110620241:web:9fcedc4651822e8a94ce70",
  measurementId: "G-TB11JRLDNK"
};

// ==========================================
// 2. INICIALIZAÇÃO DO APLICATIVO
// ==========================================
const app = initializeApp(firebaseConfig);

// ==========================================
// 3. BLINDAGEM DO FIRESTORE CONTRA O SAFARI (APPLE)
// ==========================================
// Utilizamos o initializeFirestore forçando o Long Polling
// para impedir que o iPhone bloqueie a conexão WebSockets.
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

// ==========================================
// 4. INICIALIZAÇÃO DA AUTENTICAÇÃO
// ==========================================
const auth = getAuth(app);
const storage = getStorage(app);

// Exporta as variáveis para serem usadas em outros arquivos (main.js, catalogo.js, admin.js)
export { app, db, auth, storage };