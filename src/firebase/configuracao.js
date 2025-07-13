// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDIYdXdF9T41b_-T9mq1iBSfxDt-B794E8",
  authDomain: "projeto-despesas-9f88d.firebaseapp.com",
  projectId: "projeto-despesas-9f88d",
  storageBucket: "projeto-despesas-9f88d.firebasestorage.app",
  messagingSenderId: "771204969340",
  appId: "1:771204969340:web:c2ecd3175c448cf1c9eaf9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 
export { app };