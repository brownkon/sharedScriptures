import fetch from 'node-fetch';
import { db } from '../../firebase.js';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

async function fetchKJV() {
  // Replace with your KJV JSON file path or URL
  const url = '/Users/konnerbrown/School/clean-final-scriptures/kjv.json';
  const response = await fetch(url);
  const data = await response.json();
  return data.verses;
}

async function uploadKJV() {
  try {
    console.log("Starting KJV upload process...");
    const verses = await fetchKJV();
    console.log(`KJV data fetched successfully. Found ${verses.length} verses.`);
    
    // Get collection references with 'kjv_' prefix
    const booksCollection = collection(db, 'kjv_books');
    const chaptersCollection = collection(db, 'kjv_chapters');
    const versesCollection = collection(db, 'kjv_verses');
    
    // Group verses by book and chapter
    const booksMap = new Map();
    
    verses.forEach(verse => {
      const bookName = verse.book_name;
      const chapterNum = verse.chapter;
      
      if (!booksMap.has(bookName)) {
        booksMap.set(bookName, {
          name: bookName,
          bookNumber: verse.book,
          chapters: new Map()
        });
      }
      
      const book = booksMap.get(bookName);
      if (!book.chapters.has(chapterNum)) {
        book.chapters.set(chapterNum, []);
      }
      
      book.chapters.get(chapterNum).push(verse);
    });
    
    // Upload books
    let bookOrder = 0;
    for (const [bookName, bookData] of booksMap) {
      console.log(`Processing book: ${bookName}`);
      
      // Create book document
      const bookRef = doc(booksCollection, bookName);
      await setDoc(bookRef, {
        title: bookName,
        numberOfChapters: bookData.chapters.size,
        order: bookOrder++,
        bookNumber: bookData.bookNumber
      });
      
      // Process chapters
      for (const [chapterNum, chapterVerses] of bookData.chapters) {
        const chapterId = `${bookName}_${chapterNum}`;
        
        // Create chapter document
        const chapterRef = doc(chaptersCollection, chapterId);
        await setDoc(chapterRef, {
          bookId: bookName,
          chapter: chapterNum,
          reference: `${bookName} ${chapterNum}`,
          numberOfVerses: chapterVerses.length
        });
        
        // Batch upload verses
        const batch = writeBatch(db);
        
        chapterVerses.forEach(verse => {
          const verseId = `${bookName}_${chapterNum}_${verse.verse}`;
          const verseRef = doc(versesCollection, verseId);
          
          // Clean the text (remove ¶ and other special characters if needed)
          const cleanText = verse.text.replace(/¶\s*/g, '').trim();
          
          batch.set(verseRef, {
            bookId: bookName,
            chapterId: chapterId,
            verse: verse.verse,
            reference: `${bookName} ${chapterNum}:${verse.verse}`,
            text: cleanText
          });
        });
        
        await batch.commit();
        console.log(`  Uploaded chapter ${chapterNum} with ${chapterVerses.length} verses`);
      }
    }
    
    console.log('KJV upload completed successfully!');
  } catch (error) {
    console.error('Error uploading KJV:', error);
  }
}

uploadKJV().catch(console.error);