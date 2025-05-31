// This script creates required indexes in Firestore for our queries
import { db } from '../firebase';

// Note: Creating indexes programmatically requires using the Admin SDK
// This file is meant to document the indexes you need to create manually in Firebase console

/*
Required indexes:
1. Collection: books
   Fields: order (Ascending)

2. Collection: chapters
   Fields:
   - bookId (Ascending)
   - chapter (Ascending)

3. Collection: verses
   Fields:
   - chapterId (Ascending)
   - verse (Ascending)

4. Collection: annotations
   Fields:
   - verseId (Ascending)
   - timestamp (Descending)
*/

console.log(`
============================================================
MANUAL INDEX CREATION REQUIRED
============================================================

Please create the following indexes in your Firebase Console:
https://console.firebase.google.com/project/final-scriptures/firestore/indexes

1. Collection: books
   Fields: order (Ascending)

2. Collection: chapters
   Fields:
   - bookId (Ascending)
   - chapter (Ascending)

3. Collection: verses
   Fields:
   - chapterId (Ascending)
   - verse (Ascending)

4. Collection: annotations
   Fields:
   - verseId (Ascending)
   - timestamp (Descending)

============================================================
`); 