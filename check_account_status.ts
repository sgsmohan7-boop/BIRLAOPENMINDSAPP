import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkAccount() {
  console.log("=== Checking Counsellor Accounts for sgsmohan7@gmail.com or active status ===");
  const counsellorsSnap = await getDocs(collection(db, "counsellor_accounts"));
  counsellorsSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Name: ${data.name} | Username: ${data.username} | Email: ${data.email} | Status: ${data.status} | Role: ${data.roleTitle}`);
  });
}

checkAccount().catch(console.error).finally(() => process.exit(0));
