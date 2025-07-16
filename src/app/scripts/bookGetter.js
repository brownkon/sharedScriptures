import fetch from 'node-fetch';
import { db } from '../../firebase.js'; // Ensure .js extension for Node.js
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

async function fetchBookOfMormon() {
  const url = 'https://raw.githubusercontent.com/bcbooks/scriptures-json/refs/heads/master/book-of-mormon.json';
  const response = await fetch(url);
  const data = await response.json();
  return data.books; // Access the books array from the JSON
}

async function uploadBookOfMormon() {
  try {
    console.log("Starting upload process...");
    const bookData = await fetchBookOfMormon();
    console.log(`Book data fetched successfully. Found ${bookData.length} books.`);
    
    // Get collection references
    const booksCollection = collection(db, 'books');
    const chaptersCollection = collection(db, 'chapters');
    const versesCollection = collection(db, 'verses');
    
    // Process each book
    for (let bookIndex = 0; bookIndex < bookData.length; bookIndex++) {
      const book = bookData[bookIndex];
      console.log(`Processing book ${bookIndex + 1}/${bookData.length}: ${book.book}`);
      
      // Create book document
      const bookRef = doc(booksCollection, book.book);
      await setDoc(bookRef, {
        title: book.book,
        numberOfChapters: book.chapters.length,
        order: bookIndex
      });
      
      // Process each chapter in this book
      for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex++) {
        const chapter = book.chapters[chapterIndex];
        const chapterId = `${book.book}_${chapter.chapter}`;
        
        // Create chapter document
        const chapterRef = doc(chaptersCollection, chapterId);
        await setDoc(chapterRef, {
          bookId: book.book,
          chapter: chapter.chapter,
          reference: chapter.reference,
          numberOfVerses: chapter.verses.length
        });
        
        // Use batched writes for verses (more efficient)
        const batch = writeBatch(db);
        
        // Process each verse in this chapter
        for (let verseIndex = 0; verseIndex < chapter.verses.length; verseIndex++) {
          const verse = chapter.verses[verseIndex];
          const verseId = `${book.book}_${chapter.chapter}_${verseIndex + 1}`;
          
          // Add verse to batch
          const verseRef = doc(versesCollection, verseId);
          batch.set(verseRef, {
            bookId: book.book,
            chapterId: chapterId,
            verse: verseIndex + 1,
            reference: verse.reference,
            text: verse.text
          });
        }
        
        // Commit the batch
        await batch.commit();
        console.log(`  Uploaded chapter ${chapter.chapter} with ${chapter.verses.length} verses`);
      }
      
      console.log(`Finished uploading book: ${book.book}`);
    }
    
    console.log('All scriptures uploaded successfully!');
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

// Call the function to upload the data
uploadBookOfMormon().catch(console.error);
