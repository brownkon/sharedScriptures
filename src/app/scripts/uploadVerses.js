import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: "final-scriptures.appspot.com",
  messagingSenderId: "889401009784",
  appId: "1:889401009784:web:6fd29335a5f2a9b8406f8d",
  measurementId: "G-2GC3YEE3R5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadVerses() {
  try {
    // Read the KJV JSON file
    const kjvPath = path.join(__dirname, '../../../kjv.json');
    const kjvData = JSON.parse(fs.readFileSync(kjvPath, 'utf8'));
    
    console.log(`Found ${kjvData.verses.length} verses to upload`);
    
    // Upload verses in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    const verses = kjvData.verses;
    
    for (let i = 0; i < verses.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchVerses = verses.slice(i, i + batchSize);
      
      console.log(`Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(verses.length / batchSize)}`);
      
      batchVerses.forEach((verse) => {
        const docRef = doc(collection(db, 'verses'));
        batch.set(docRef, {
          book: verse.book,
          book_name: verse.book_name,
          chapter: verse.chapter,
          verse_number: verse.verse,
          text: verse.text
        });
      });
      
      await batch.commit();
      console.log(`Batch ${Math.floor(i / batchSize) + 1} uploaded successfully`);
    }
    
    console.log('All verses uploaded successfully!');
  } catch (error) {
    console.error('Error uploading verses:', error);
  }
}

// Run the upload
uploadVerses();
