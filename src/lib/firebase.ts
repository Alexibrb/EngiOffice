
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "engiflow-74dlq",
  "appId": "1:700766733055:web:1e4d597364d4810cb142ca",
  "storageBucket": "engiflow-74dlq.firebasestorage.app",
  "apiKey": "AIzaSyALI2S7-ja1Gcfaa5Kgmz9iMKrC1Fqagyo",
  "authDomain": "engiflow-74dlq.firebaseapp.com",
  "messagingSenderId": "700766733055"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
