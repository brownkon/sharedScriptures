import 'dotenv/config';
import fetch from 'node-fetch';
import { db } from './firebase-config.js';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

console.log('API KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log('PROJECT ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

async function fetchKJV() {
  try {
    // First try to use local file if available
    const fs = await import('fs');
    const path = await import('path');
    const localPath = path.join(process.cwd(), 'public', 'kjv.json');
    
    if (fs.existsSync(localPath)) {
      console.log('Using local KJV file...');
      const fileContent = fs.readFileSync(localPath, 'utf8');
      const data = JSON.parse(fileContent);
      console.log('Local file structure:', typeof data);
      console.log('Data keys:', data ? Object.keys(data) : 'undefined');
      console.log('Data length:', data?.length);
      console.log('Is array:', Array.isArray(data));
      
      // Check if data has a verses property or is the verses array directly
      let verses = data;
      if (data && data.verses) {
        verses = data.verses;
      } else if (data && data.books) {
        // If it's already in book format, return it
        return data.books;
      }
      
      if (!Array.isArray(verses)) {
        console.error('Expected verses array, got:', typeof verses);
        throw new Error('Invalid data structure - expected verses array');
      }
      
      console.log('Processing', verses.length, 'verses');
      
      // Group verses by book and chapter
      const booksMap = new Map();
      
      verses.forEach(verse => {
        const bookName = verse.book_name;
        const chapterNum = verse.chapter;
        const verseNum = verse.verse;
        
        if (!booksMap.has(bookName)) {
          booksMap.set(bookName, {
            book: bookName,
            chapters: new Map()
          });
        }
        
        const book = booksMap.get(bookName);
        
        if (!book.chapters.has(chapterNum)) {
          book.chapters.set(chapterNum, {
            chapter: chapterNum,
            reference: `${bookName} ${chapterNum}`,
            verses: []
          });
        }
        
        const chapter = book.chapters.get(chapterNum);
        chapter.verses.push({
          verse: verseNum,
          reference: `${bookName} ${chapterNum}:${verseNum}`,
          text: verse.text
        });
      });
      
      // Convert to expected format
      const books = Array.from(booksMap.values()).map(book => ({
        ...book,
        chapters: Array.from(book.chapters.values())
      }));
      
      console.log('Processed into', books.length, 'books');
      return books;
    }
    
    // Fallback to remote URL
    console.log('Fetching KJV from remote URL...');
    const url = 'https://raw.githubusercontent.com/bcbooks/scriptures-json/refs/heads/master/king-james-version.json';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Response preview:', text.substring(0, 200));
    
    const data = JSON.parse(text);
    return data.books;
  } catch (error) {
    console.error('Error fetching KJV data:', error);
    throw error;
  }
}

async function uploadKJV() {
  try {
    console.log("Starting KJV upload process...");
    const bookData = await fetchKJV();
    if (!bookData || !Array.isArray(bookData)) {
      console.error('Invalid book data received:', bookData);
      return;
    }
    console.log(`KJV data fetched successfully. Found ${bookData.length} books.`);

    let batch = writeBatch(db);
    let batchCount = 0;
    let totalWrites = 0;

    for (let i = 0; i < bookData.length; i++) {
      const book = bookData[i];
      const bookId = `KJV_${book.book.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const bookRef = doc(db, 'books', bookId);
      const bookDocData = {
        title: bookId,
        displayName: book.book,
        numberOfChapters: book.chapters.length,
        order: 100 + i,
        scriptureType: 'KJV'
      };
      batch.set(bookRef, bookDocData); batchCount++; totalWrites++;

      for (let j = 0; j < book.chapters.length; j++) {
        const chapter = book.chapters[j];
        const chapterId = `kjv_${bookId}_${chapter.chapter}`;
        const chapterRef = doc(db, 'chapters', chapterId);
        const chapterData = {
          bookId: bookId,
          chapter: chapter.chapter,
          reference: chapter.reference,
          numberOfVerses: chapter.verses.length
        };
        batch.set(chapterRef, chapterData); batchCount++; totalWrites++;

        for (let k = 0; k < chapter.verses.length; k++) {
          const verse = chapter.verses[k];
          const verseId = `kjv_${bookId}_${chapter.chapter}_${verse.verse}`;
          const verseRef = doc(db, 'verses', verseId);
          const sanitizedText = verse.text
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/\uFFFD/g, '')
            .trim();
          const verseData = {
            bookId: bookId,
            chapterId: chapterId,
            verse: verse.verse,
            reference: verse.reference,
            text: sanitizedText
          };
          batch.set(verseRef, verseData); batchCount++; totalWrites++;

          // Commit batch every 400 writes
          if (batchCount >= 400) {
            await batch.commit();
            console.log(`Committed batch at total write #${totalWrites}`);
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }
    // Commit any remaining writes
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch at total write #${totalWrites}`);
    }
    console.log('All KJV scriptures uploaded successfully!');
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

uploadKJV().catch(console.error);