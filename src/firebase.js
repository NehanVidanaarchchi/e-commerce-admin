import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAHBab6eXwDUlqAXXNy9bDoa7B993zC4xg",
  authDomain: "gadgetmart-75bad.firebaseapp.com",
  projectId: "gadgetmart-75bad",
  storageBucket: "gadgetmart-75bad.firebasestorage.app",
  messagingSenderId: "1079436186094",
  appId: "1:1079436186094:web:86124060b946bbd1f27eff",
  measurementId: "G-LQV3PG5EH5"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);