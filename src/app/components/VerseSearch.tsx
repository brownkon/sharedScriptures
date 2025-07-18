"use client";

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface Verse {
  bookId: string;
  chapterId: string;
  verse: number;
  reference: string;
  text: string;
  verseId?: string;
}

interface VerseSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const VerseSearch: React.FC<VerseSearchProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [results, setResults] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [bibleBooks, setBibleBooks] = useState<string[]>([]);
  const [bomBooks, setBomBooks] = useState<string[]>([]);

  // Load unique books from Firebase and separate by scripture type
  useEffect(() => {
    const loadBooks = async () => {
      try {
        const booksRef = collection(db, 'books');
        const q = query(booksRef, orderBy('order'));
        const querySnapshot = await getDocs(q);
        
        const bibleData: { id: string; order: number }[] = [];
        const bomData: { id: string; order: number }[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const bookInfo = {
            id: doc.id,
            order: data.order || 0
          };
          
          // Separate by scripture type
          if (data.scriptureType === 'KJV') {
            bibleData.push(bookInfo);
          } else {
            bomData.push(bookInfo);
          }
        });
        
        // Sort by order and extract book names
        const sortedBibleBooks = bibleData
          .sort((a, b) => a.order - b.order)
          .map(book => book.id);
          
        const sortedBomBooks = bomData
          .sort((a, b) => a.order - b.order)
          .map(book => book.id);
        
        setBibleBooks(sortedBibleBooks);
        setBomBooks(sortedBomBooks);
      } catch (error) {
        console.error('Error loading books:', error);
      }
    };

    loadBooks();
  }, []);

  const searchVerses = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const versesRef = collection(db, 'verses');
      let q = query(versesRef, orderBy('bookId'), orderBy('chapterId'), orderBy('verse'));
      
      // Handle different filter types
      if (selectedBook === 'BIBLE_ALL') {
        // Filter by all Bible books
        q = query(versesRef, where('bookId', 'in', bibleBooks), orderBy('bookId'), orderBy('chapterId'), orderBy('verse'));
      } else if (selectedBook === 'BOM_ALL') {
        // Filter by all Book of Mormon books
        q = query(versesRef, where('bookId', 'in', bomBooks), orderBy('bookId'), orderBy('chapterId'), orderBy('verse'));
      } else if (selectedBook) {
        // Filter by specific book
        q = query(versesRef, where('bookId', '==', selectedBook), orderBy('bookId'), orderBy('chapterId'), orderBy('verse'));
      }
      
      const querySnapshot = await getDocs(q);
      const allVerses: Verse[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allVerses.push({
          bookId: data.bookId,
          chapterId: data.chapterId,
          verse: data.verse,
          reference: data.reference,
          text: data.text,
          verseId: doc.id
        });
      });
      
      // Filter by search term (client-side filtering for text search)
      const filteredVerses = allVerses.filter((verse) => {
        return verse.text.toLowerCase().includes(searchTerm.toLowerCase());
      });

      // Limit results to prevent performance issues
      setResults(filteredVerses.slice(0, 50));
    } catch (error) {
      console.error('Error searching verses:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchVerses();
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedBook('');
    setResults([]);
    setHasSearched(false);
  };

  const formatBookName = (bookId: string) => {
    return bookId
      .replace(/KJV_/g, '')
      .replace(/_/g, ' ')
      .replace(/(\d+)\s+/g, '$1 '); // Ensure space after numbers
  };

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed top-16 left-0 right-0 bottom-0 bg-black bg-opacity-50"></div>
      <div className="fixed top-24 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[calc(100vh-120px)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Verses
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Controls */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search for words or phrases
                </label>
                <div className="relative">
                  <input
                    id="search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter words to search for..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <svg className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Book Filter */}
              <div className="sm:w-48">
                <label htmlFor="book" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter by book
                </label>
                <select
                  id="book"
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Books</option>
                  
                  {/* Bible Collection Options */}
                  {bibleBooks.length > 0 && (
                    <optgroup label="Bible">
                      <option value="BIBLE_ALL">📖 All Bible Books</option>
                      {bibleBooks.map((book) => (
                        <option key={book} value={book}>
                          {formatBookName(book)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {/* Book of Mormon Collection Options */}
                  {bomBooks.length > 0 && (
                    <optgroup label="Book of Mormon">
                      <option value="BOM_ALL">📜 All Book of Mormon Books</option>
                      {bomBooks.map((book) => (
                        <option key={book} value={book}>
                          {formatBookName(book)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={searchVerses}
                disabled={!searchTerm.trim() || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </button>
              
              <button
                onClick={clearSearch}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-[calc(90vh-280px)]">
            {loading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasSearched && results.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No verses found</p>
                <p className="text-sm mt-1">
                  Try different search terms or remove the book filter
                </p>
              </div>
            ) : results.length > 0 ? (
              <div className="p-6 space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Found {results.length} verse{results.length !== 1 ? 's' : ''}
                  {results.length === 50 && ' (showing first 50 results)'}
                  {selectedBook === 'BIBLE_ALL' && ' in Bible'}
                  {selectedBook === 'BOM_ALL' && ' in Book of Mormon'}
                  {selectedBook && !selectedBook.includes('_ALL') && ` in ${formatBookName(selectedBook)}`}
                </div>
                
                {results.map((verse, index) => (
                  <div
                    key={verse.verseId || `${verse.bookId}-${verse.chapterId}-${verse.verse}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                    <cite className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {verse.reference}
                    </cite>
                    </div>
                    <blockquote className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {highlightText(verse.text, searchTerm)}
                    </blockquote>
                  </div>
                ))}
              </div>
            ) : !hasSearched ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>Search for verses by entering words or phrases</p>
                <p className="text-sm mt-1">
                  You can also filter results by selecting a specific book
                </p>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
              <span>
                {hasSearched && results.length > 0 
                  ? `${results.length} result${results.length !== 1 ? 's' : ''} found`
                  : 'Enter search terms above to find verses'
                }
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerseSearch;
