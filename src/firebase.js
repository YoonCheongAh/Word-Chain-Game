import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDPzrtdLnVMsSxI7yVPDactAZ8iURiRo8A",
  authDomain: "word---chain.firebaseapp.com",
  databaseURL: "https://word---chain-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "word---chain",
  storageBucket: "word---chain.firebasestorage.app",
  messagingSenderId: "113499626744",
  appId: "1:113499626744:web:37f46c9a633a1d51be6f0d"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);