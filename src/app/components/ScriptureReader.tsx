"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot, writeBatch, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import AnnotationManager from './AnnotationManager';
import { useFirebase } from '../providers';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import { useHighlight } from '../contexts/HighlightContext';
import { useTheme } from '../contexts/ThemeContext';

interface Verse {
  bookId: string;
  chapterId: string;
  verse: number;
  reference: string;
  text: string;
  verseId?: string;
}

interface HighlightedWord {
  id?: string;
  verseId: string;
  startIndex: number;
  endIndex: number;
  color: string;
  userId: string;
}

interface SelectionState {
  isSelecting: boolean;
  startIndex: number | null;
  endIndex: number | null;
  verseId: string | null;
}

interface Chapter {
  bookId: string;
  chapter: number;
  reference: string;
  numberOfVerses: number;
  chapterId?: string;
}

interface Book {
  title: string;
  numberOfChapters: number;
  order: number;
}

interface LocalHighlights {
  [verseId: string]: HighlightedWord[];
}

const colors = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#C5E1A5' },
  { name: 'Blue', value: '#90CAF9' },
  { name: 'Pink', value: '#F8BBD0' },
  { name: 'Purple', value: '#CE93D8' },
];

export default function ScriptureReader() {
  const router = useRouter();
  const { db, user, loading: authLoading } = useFirebase();
  const { needsSync, setNeedsSync, isSyncing, setIsSyncing, localHighlights, setLocalHighlights } = useHighlight();
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [verses, setVerses] = useState<Verse[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<string>('');
  const [highlightedWords, setHighlightedWords] = useState<HighlightedWord[]>([]);
  const [selectedColor, setSelectedColor] = useState('#FFEB3B');
  const [selection, setSelection] = useState<SelectionState>({
    isSelecting: false,
    startIndex: null,
    endIndex: null,
    verseId: null
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<HighlightedWord | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const { isDarkMode } = useTheme();
  const [selectLastChapter, setSelectLastChapter] = useState<boolean>(false);
  const navigationRef = useRef<{book: string, chapter: string} | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch all books on component mount
  useEffect(() => {
    async function fetchBooks() {
      try {
        console.log("Attempting to fetch books...");
        setLoading(true);
        const booksQuery = query(collection(db, 'books'), orderBy('order'));
        // console.log("Query created:", booksQuery);
        const booksSnapshot = await getDocs(booksQuery);
        // console.log("Books snapshot received:", booksSnapshot.size, "books found");
        
        const booksData: Book[] = [];
        booksSnapshot.forEach((doc) => {
          // console.log("Book doc:", doc.id, doc.data());
          booksData.push({ 
            title: doc.id, 
            ...doc.data() 
          } as Book);
        });
        
        // console.log("Processed books:", booksData.length);
        setBooks(booksData);
        
        // Select first book by default if available
        if (booksData.length > 0 && !selectedBook) {
          // console.log("Setting default book:", booksData[0].title);
          setSelectedBook(booksData[0].title);
        }
        
      } catch (err) {
        console.error('Error fetching books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, []);

  // Fetch chapters when a book is selected
  useEffect(() => {
    async function fetchChapters() {
      if (!selectedBook) return;
      
      try {
        setLoading(true);
        const chaptersQuery = query(
          collection(db, 'chapters'),
          where('bookId', '==', selectedBook),
          orderBy('chapter')
        );
        const chaptersSnapshot = await getDocs(chaptersQuery);
        
        const chaptersData: Chapter[] = [];
        chaptersSnapshot.forEach((doc) => {
          // Fix type assignment
          const data = doc.data() as Omit<Chapter, 'chapterId'>;
          chaptersData.push({ 
            ...data,
            chapterId: doc.id
          });
        });
        
        setChapters(chaptersData);
        
        // Handle navigation if needed
        if (navigationRef.current && navigationRef.current.book === selectedBook) {
          if (navigationRef.current.chapter === 'last' && chaptersData.length > 0) {
            setSelectedChapter(chaptersData[chaptersData.length - 1].chapterId || '');
          } else {
            setSelectedChapter(navigationRef.current.chapter);
          }
          navigationRef.current = null;
        } else if (chaptersData.length > 0) {
          setSelectedChapter(chaptersData[0].chapterId || '');
        } else {
          setSelectedChapter('');
          setVerses([]);
        }
        
      } catch (err) {
        console.error('Error fetching chapters:', err);
        setError('Failed to load chapters. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchChapters();
  }, [selectedBook]);

  // Fetch verses when a chapter is selected
  useEffect(() => {
    async function fetchVerses() {
      if (!selectedChapter) return;
      
      try {
        setLoading(true);
        const versesQuery = query(
          collection(db, 'verses'),
          where('chapterId', '==', selectedChapter),
          orderBy('verse')
        );
        const versesSnapshot = await getDocs(versesQuery);
        
        const versesData: Verse[] = [];
        versesSnapshot.forEach((doc) => {
          // Fix type assignment
          const data = doc.data() as Omit<Verse, 'verseId'>;
          versesData.push({ 
            ...data,
            verseId: doc.id 
          });
        });
        
        setVerses(versesData);
        
        // Reset selected verse
        setSelectedVerse('');
        
      } catch (err) {
        console.error('Error fetching verses:', err);
        setError('Failed to load verses. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchVerses();
  }, [selectedChapter]);

  // Load saved highlights when component mounts and when user changes
  useEffect(() => {
    async function loadHighlights() {
      if (!user) return;

      try {
        const highlightsRef = collection(db, 'highlights');
        const highlightsQuery = query(
          highlightsRef,
          where('userId', '==', user.uid)
        );
        
        const highlightsSnapshot = await getDocs(highlightsQuery);
        const savedHighlights: HighlightedWord[] = [];
        
        highlightsSnapshot.forEach((doc) => {
          const data = doc.data();
          const verseId = data.verseId;
          savedHighlights.push({
            id: doc.id,
            verseId,
            startIndex: data.startIndex,
            endIndex: data.endIndex,
            color: data.color,
            userId: data.userId
          });
        });

        // Group highlights by verseId
        const groupedHighlights: LocalHighlights = {};
        savedHighlights.forEach(highlight => {
          if (!groupedHighlights[highlight.verseId]) {
            groupedHighlights[highlight.verseId] = [];
          }
          groupedHighlights[highlight.verseId].push(highlight);
        });

        // Update both states
        setLocalHighlights(groupedHighlights);
        setHighlightedWords(savedHighlights);
        setNeedsSync(false);
      } catch (error) {
        console.error('Error loading highlights:', error);
      }
    }

    loadHighlights();
  }, [user, setNeedsSync]);

  // Update highlights when verses change
  useEffect(() => {
    if (highlightedWords.length > 0) {
      const groupedHighlights: LocalHighlights = {};
      highlightedWords.forEach(highlight => {
        if (!groupedHighlights[highlight.verseId]) {
          groupedHighlights[highlight.verseId] = [];
        }
        groupedHighlights[highlight.verseId].push(highlight);
      });
      setLocalHighlights(groupedHighlights);
    }
  }, [verses, highlightedWords]);

  // Handle book selection
  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBook(e.target.value);
    setSelectedChapter('');
    setVerses([]);
    setSelectedVerse('');
  };

  // Handle chapter selection
  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChapter(e.target.value);
    setVerses([]);
    setSelectedVerse('');
  };

  // Handle verse selection
  const handleVerseClick = (verseId: string) => {
    setSelectedVerse(selectedVerse === verseId ? '' : verseId);
  };

  const handleMouseDown = (verseId: string, startIndex: number) => {
    setSelection({
      isSelecting: true,
      startIndex,
      endIndex: startIndex,
      verseId
    });
  };

  const handleMouseMove = (verseId: string, currentIndex: number) => {
    if (selection.isSelecting && selection.verseId === verseId) {
      setSelection(prev => ({
        ...prev,
        endIndex: currentIndex
      }));
    }
  };

  const handleMouseUp = () => {
    if (selection.isSelecting && selection.startIndex !== null && selection.endIndex !== null && selection.verseId) {
      const start = Math.min(selection.startIndex, selection.endIndex);
      const end = Math.max(selection.startIndex, selection.endIndex);
      
      if (end > start) {
        const verse = verses.find(v => v.verseId === selection.verseId);
        if (verse && verse.verseId) {
          const verseId = verse.verseId;
          const newHighlight: HighlightedWord = {
            verseId,
            startIndex: start,
            endIndex: end,
            color: selectedColor,
            userId: user?.uid || ''
          };

          setLocalHighlights((prev: LocalHighlights): LocalHighlights => {
            const newHighlights = { ...prev };
            if (!newHighlights[verseId]) {
              newHighlights[verseId] = [];
            }
            newHighlights[verseId] = newHighlights[verseId].filter((h: HighlightedWord) => 
              h.startIndex < start || h.endIndex > end
            );
            newHighlights[verseId].push(newHighlight);
            return newHighlights;
          });

          setHighlightedWords(prev => {
            const filteredHighlights = prev.filter((h: HighlightedWord) => 
              h.verseId !== verseId || h.startIndex < start || h.endIndex > end
            );
            return [...filteredHighlights, newHighlight];
          });

          setNeedsSync(true);

          if (socket && isConnected) {
            socket.emit('highlight', newHighlight);
          }
        }
      }
    }
    
    setSelection({
      isSelecting: false,
      startIndex: null,
      endIndex: null,
      verseId: null
    });
  };

  const deleteHighlight = async (highlight: HighlightedWord) => {
    if (!user) return;

    try {
      setLocalHighlights((prev: LocalHighlights): LocalHighlights => {
        const newHighlights = { ...prev };
        if (newHighlights[highlight.verseId]) {
          newHighlights[highlight.verseId] = newHighlights[highlight.verseId].filter(
            (h: HighlightedWord) => h.startIndex !== highlight.startIndex || h.endIndex !== highlight.endIndex
          );
        }
        return newHighlights;
      });

      setHighlightedWords(prev => 
        prev.filter(h => 
          h.verseId !== highlight.verseId || 
          h.startIndex !== highlight.startIndex || 
          h.endIndex !== highlight.endIndex
        )
      );

      setNeedsSync(true);

      if (highlight.id) {
        const highlightRef = doc(db, 'highlights', highlight.id);
        await deleteDoc(highlightRef);
      }

      saveHighlights();
    } catch (error) {
      console.error('Error deleting highlight:', error);
    }
  };

  const updateHighlightColor = async (highlight: HighlightedWord, newColor: string) => {
    if (!user) return;

    try {
      // Update local state
      setLocalHighlights((prev: LocalHighlights): LocalHighlights => {
        const newHighlights = { ...prev };
        if (newHighlights[highlight.verseId]) {
          newHighlights[highlight.verseId] = newHighlights[highlight.verseId].map((h: HighlightedWord) => 
            h.startIndex === highlight.startIndex && h.endIndex === highlight.endIndex
              ? { ...h, color: newColor }
              : h
          );
        }
        return newHighlights;
      });

      setHighlightedWords(prev => 
        prev.map(h => 
          h.verseId === highlight.verseId && 
          h.startIndex === highlight.startIndex && 
          h.endIndex === highlight.endIndex
            ? { ...h, color: newColor }
            : h
        )
      );

      setNeedsSync(true);

      // If the highlight has an ID (was saved to Firestore), update it
      if (highlight.id) {
        const highlightRef = doc(db, 'highlights', highlight.id);
        await updateDoc(highlightRef, { color: newColor });
      }

      setSelectedHighlight(null);
    } catch (error) {
      console.error('Error updating highlight color:', error);
    }
  };

  const handleColorPickerClick = (e: React.MouseEvent, highlight: HighlightedWord) => {
    e.stopPropagation();
    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // Position the popup to the right of the color picker button
    setPopupPosition({
      top: rect.top,
      left: rect.right + 10
    });
    
    setSelectedHighlight(highlight);
  };

  const renderVerseText = (verse: Verse) => {
    const words = verse.text.split(/(\s+)/);
    let currentPosition = 0;
    
    // Find all highlight ranges for this verse
    const highlightRanges = highlightedWords
      .filter(h => h.verseId === verse.verseId)
      .sort((a, b) => a.startIndex - b.endIndex);

    console.log('Rendering verse:', verse.verseId, 'with highlights:', highlightRanges);

    return (
      <div className="relative inline-block text-lg leading-relaxed">
        {words.map((word, index) => {
          const startIndex = currentPosition;
          const endIndex = startIndex + word.length;
          currentPosition = endIndex;

          // Check if this word or space is within any highlight range
          const highlight = highlightRanges.find(h => {
            // Word is within highlight range
            if (startIndex >= h.startIndex && endIndex <= h.endIndex) {
              return true;
            }
            // Word starts within highlight
            if (startIndex >= h.startIndex && startIndex < h.endIndex) {
              return true;
            }
            // Word ends within highlight
            if (endIndex > h.startIndex && endIndex <= h.endIndex) {
              return true;
            }
            // Highlight is within word
            if (startIndex <= h.startIndex && endIndex >= h.endIndex) {
              return true;
            }
            return false;
          });

          const isSelected = selection.isSelecting && 
            selection.verseId === verse.verseId &&
            startIndex >= Math.min(selection.startIndex || 0, selection.endIndex || 0) &&
            endIndex <= Math.max(selection.startIndex || 0, selection.endIndex || 0);

          return (
            <span
              key={`${verse.verseId}-${startIndex}-${endIndex}`}
              onMouseDown={() => handleMouseDown(verse.verseId || '', startIndex)}
              onMouseMove={() => handleMouseMove(verse.verseId || '', endIndex)}
              className={`cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
              style={{
                position: 'relative',
                zIndex: highlight ? 1 : 0,
                padding: '2px 0',
                margin: '0',
                display: 'inline-block',
                backgroundColor: highlight ? highlight.color + '80' : 'transparent',
                whiteSpace: 'pre',
                fontFamily: 'var(--font-geist-sans)',
                letterSpacing: '0.01em'
              }}
            >
              {word}
              {highlight && startIndex === highlight.startIndex && (
                <div className="absolute -right-2 -top-2 flex gap-1">
                  <button
                    onClick={(e) => handleColorPickerClick(e, highlight)}
                    className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-blue-600"
                    title="Change color"
                  >
                    🎨
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteHighlight(highlight);
                    }}
                    className="bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600"
                    title="Delete highlight"
                  >
                    ×
                  </button>
                </div>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Set up Socket.IO connection
  useEffect(() => {
    if (!user) return;

    const socketConnection = io('http://localhost:3000');

    socketConnection.on('connect', () => {
      console.log('Socket.IO connected');
      setIsConnected(true);
      socketConnection.emit('auth', user.uid);
    });

    socketConnection.on('highlight', (data) => {
      console.log('Received highlight from another tab:', data);
      
      // Add the received highlight to local state
      setHighlightedWords(prev => {
        // Check if highlight already exists to avoid duplicates
        const exists = prev.some(h => 
          h.verseId === data.verseId && 
          h.startIndex === data.startIndex && 
          h.endIndex === data.endIndex &&
          h.userId === data.userId
        );
        
        if (!exists) {
          return [...prev, data];
        }
        return prev;
      });

      // Update local highlights for rendering
      setLocalHighlights(prev => {
        const newHighlights = { ...prev };
        if (!newHighlights[data.verseId]) {
          newHighlights[data.verseId] = [];
        }
        
        // Check if highlight already exists
        const exists = newHighlights[data.verseId].some(h => 
          h.startIndex === data.startIndex && 
          h.endIndex === data.endIndex &&
          h.userId === data.userId
        );
        
        if (!exists) {
          newHighlights[data.verseId].push(data);
        }
        
        return newHighlights;
      });
    });

    socketConnection.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, [user]);

  const saveHighlights = async () => {
    if (!user || isSyncing) return;

    try {
      setIsSyncing(true);
      console.log('Saving highlights to Firebase');
      
      // Get all highlights from local state
      const allHighlights = Object.values(localHighlights).flat();
      console.log('Saving highlights:', allHighlights);

      if (allHighlights.length === 0) {
        console.log('No highlights to save');
        setNeedsSync(false);
        return;
      }

      const batch = writeBatch(db);
      const highlightsRef = collection(db, 'highlights');
      
      // Delete all existing highlights for this user
      const existingHighlightsQuery = query(
        highlightsRef, 
        where('userId', '==', user.uid)
      );
      
      const existingHighlights = await getDocs(existingHighlightsQuery);
      existingHighlights.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Add new highlights
      const newHighlightDocs = [];
      for (const highlight of allHighlights) {
        const docRef = doc(highlightsRef);
        const highlightData = {
          verseId: highlight.verseId,
          startIndex: highlight.startIndex,
          endIndex: highlight.endIndex,
          color: highlight.color,
          userId: user.uid,
          timestamp: serverTimestamp()
        };
        batch.set(docRef, highlightData);
        newHighlightDocs.push({ id: docRef.id, ...highlightData });
      }

      await batch.commit();
      console.log('Highlights saved to Firebase successfully');
      
      // Update the highlightedWords state with the saved highlights
      const updatedHighlights = newHighlightDocs.map(doc => ({
        id: doc.id,
        verseId: doc.verseId,
        startIndex: doc.startIndex,
        endIndex: doc.endIndex,
        color: doc.color,
        userId: doc.userId
      }));
      
      console.log('Updating highlightedWords with:', updatedHighlights);
      setHighlightedWords(updatedHighlights);
      setNeedsSync(false);
    } catch (error) {
      console.error('Error saving highlights to Firebase:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className={`max-w-7xl mx-auto p-4 ${isDarkMode ? 'dark' : ''}`} onMouseUp={handleMouseUp}>
      <div className="mb-6">
        <div className="mb-6">
        </div>
        
        {/* Book and Chapter Selection */}
        <div className="flex space-x-4 mb-8">
          <div className="w-1/2">
            <label htmlFor="book-select" className="block mb-2 font-medium text-gray-200">
              Book
            </label>
            <select
              id="book-select"
              value={selectedBook}
              onChange={handleBookChange}
              className="w-full p-2 border rounded text-gray-800 bg-white"
              disabled={loading || books.length === 0}
            >
              {books.map((book) => (
                <option key={book.title} value={book.title}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-1/2">
            <label htmlFor="chapter-select" className="block mb-2 font-medium text-gray-200">
              Chapter
            </label>
            <select
              id="chapter-select"
              value={selectedChapter}
              onChange={handleChapterChange}
              className="w-full p-2 border rounded text-gray-800 bg-white"
              disabled={loading || chapters.length === 0}
            >
              {chapters.map((chapter) => (
                <option key={chapter.chapterId} value={chapter.chapterId || ''}>
                  {chapter.chapter}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Main Content with Side Panel */}
      <div className="flex gap-8">
        {/* Scripture Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {loading ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>
          ) : verses.length > 0 ? (
            <div>
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-gray-100">
                { `${selectedBook} ${selectedChapter?.split('_')[1]}` || verses[0]?.reference}
              </h2>
              
              {/* Color Selection and Connection Status */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-sm mr-3 font-bold text-gray-800 dark:text-gray-200">Highlight Color:</span>
                  <div className="flex space-x-2">
                    {colors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setSelectedColor(color.value)}
                        className={`w-6 h-6 rounded-full border ${
                          selectedColor === color.value ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                        }`}
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {verses.map((verse) => (
                  <div key={verse.verseId || `${verse.chapterId}_${verse.verse}`} className="mb-8">
                    <div 
                      className={`flex cursor-pointer p-3 rounded-lg transition-colors duration-200 ${
                        selectedVerse === verse.verseId ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() => handleVerseClick(verse.verseId || '')}
                    >
                      <span className="font-bold mr-3 flex-shrink-0 text-gray-800 dark:text-gray-200 text-lg">{verse.verse}</span>
                      <div className="text-gray-900 dark:text-gray-100">
                        {renderVerseText(verse)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chapter Navigation */}
              <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  {!(selectedBook === '1 Nephi' && chapters[0]?.chapterId === selectedChapter) && (
                    <button
                      onClick={() => {
                        const currentIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
                        if (currentIndex > 0) {
                          // Move to previous chapter in same book
                          handleChapterChange({ target: { value: chapters[currentIndex - 1].chapterId || '' } } as React.ChangeEvent<HTMLSelectElement>);
                        } else {
                          // Move to previous book's last chapter
                          const currentBookIndex = books.findIndex(b => b.title === selectedBook);
                          if (currentBookIndex > 0) {
                            const prevBook = books[currentBookIndex - 1];
                            // Set navigation intent in ref
                            navigationRef.current = {
                              book: prevBook.title,
                              chapter: 'last'
                            };
                            setSelectedBook(prevBook.title);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Previous Chapter
                    </button>
                  )}
                </div>
                <div>
                  {!(selectedBook === 'Moroni' && selectedChapter === chapters[chapters.length - 1]?.chapterId) && (
                    <button
                      onClick={() => {
                        const currentIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
                        if (currentIndex < chapters.length - 1) {
                          // Move to next chapter in same book
                          handleChapterChange({ target: { value: chapters[currentIndex + 1].chapterId || '' } } as React.ChangeEvent<HTMLSelectElement>);
                        } else {
                          // Move to next book's first chapter
                          const currentBookIndex = books.findIndex(b => b.title === selectedBook);
                          if (currentBookIndex < books.length - 1) {
                            const nextBook = books[currentBookIndex + 1];
                            setSelectedBook(nextBook.title);
                          }
                        }
                      }}
                      disabled={selectedBook === books[books.length - 1].title && selectedChapter === chapters[chapters.length - 1]?.chapterId}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      Next Chapter
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l4-4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400 text-lg">
              {selectedBook && selectedChapter
                ? 'No verses found for this chapter.'
                : 'Select a book and chapter to view scriptures.'}
            </div>
          )}
        </div>

        {/* Annotation Side Panel */}
        {selectedVerse && (
          <div className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-0 h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Annotations</h3>
              <button
                onClick={() => setSelectedVerse('')}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <AnnotationManager verseId={selectedVerse} />
          </div>
        )}
      </div>

      {/* Color picker popup */}
      {selectedHighlight && (
        <div 
          className="fixed z-50"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`
          }}
        >
          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
            <div className="flex gap-2 mb-2">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={(e) => updateHighlightColor(selectedHighlight, color.value)}
                  className={`w-6 h-6 rounded-full border ${
                    selectedHighlight.color === color.value ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <button
              onClick={() => setSelectedHighlight(null)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
