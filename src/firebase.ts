import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCx4ZkC2rD9rw5dyZgtaleEjCg7hDe-rts",
  authDomain: "campusnow-e9554.firebaseapp.com",
  projectId: "campusnow-e9554",
  storageBucket: "campusnow-e9554.firebasestorage.app",
  messagingSenderId: "916967546052",
  appId: "1:916967546052:web:ea436a96abd87b1242fd91",
  measurementId: "G-YMG7X63S01",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
