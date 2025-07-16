"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, doc, orderBy, writeBatch, serverTimestamp, deleteDoc, updateDoc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import AnnotationManager from './AnnotationManager';
import { useFirebase } from '../providers';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
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
  const [scriptureVersion, setScriptureVersion] = useState<'bom' | 'kjv'>('bom');
  const [fontSize, setFontSize] = useState<number>(18); // Default 18px
  const [verseSpacing, setVerseSpacing] = useState<number>(16); // Default spacing level
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [favoriteVerseIds, setFavoriteVerseIds] = useState<string[]>([]);


  // Update the collection references based on version
  const getCollectionName = (baseName: string) => {
    return scriptureVersion === 'kjv' ? baseName : baseName; // Both use the same collection names
  };


  useEffect(() => {
    if (books.length > 0 && !selectedBook) {
      // Check if we have a saved position to restore
      if (navigationRef.current) {
        const savedBook = books.find(book => book.title === navigationRef.current?.book);
        if (savedBook) {
          console.log('Restoring saved book:', savedBook.title);
          setSelectedBook(savedBook.title);
        } else {
          // Fallback to first book if saved book not found
          setSelectedBook(books[0].title);
        }
      } else {
        // No saved position, use first book
        setSelectedBook(books[0].title);
      }
    }
  }, [books]);
  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Handle URL parameters for navigation from annotations
  useEffect(() => {
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const verse = searchParams.get('verse');

    if (book && books.length > 0) {
      setSelectedBook(book);
      
      if (chapter) {
        // Set navigation intent for the chapter
        navigationRef.current = {
          book: book,
          chapter: chapter
        };
      }
      
      if (verse) {
        // Set the verse to be selected after verses are loaded
        setTimeout(() => {
          setSelectedVerse(verse);
        }, 500);
      }
    }
  }, [searchParams, books]);

  // Load saved position from localStorage
  useEffect(() => {
    if (user) {
      const savedPosition = localStorage.getItem(`scripturePosition_${user.uid}_${scriptureVersion}`);
      if (savedPosition) {
        try {
          const { book, chapter } = JSON.parse(savedPosition);
          console.log('Loading saved position:', { book, chapter });
          // Set navigation intent to restore position
          navigationRef.current = { book, chapter };
        } catch (error) {
          console.error('Error parsing saved position:', error);
        }
      }
    }
  }, [user, scriptureVersion]);

  // Save position to localStorage whenever book/chapter changes
  useEffect(() => {
    if (user && selectedBook && selectedChapter) {
      const position = { book: selectedBook, chapter: selectedChapter };
      localStorage.setItem(`scripturePosition_${user.uid}_${scriptureVersion}`, JSON.stringify(position));
      console.log('Saved position:', position);
    }
  }, [user, selectedBook, selectedChapter, scriptureVersion]);

  // Fetch all books on component mount
  useEffect(() => {
    async function fetchBooks() {
      try {
        console.log("Attempting to fetch books...");
        setLoading(true);
        
        const booksQuery = query(
          collection(db, 'books'), // Same collection for both
          orderBy('order')
        );
        
        const booksSnapshot = await getDocs(booksQuery);
        
        const booksData: Book[] = [];
        booksSnapshot.forEach((doc) => {
          const data = doc.data();
          // Filter books based on scripture type
          if (scriptureVersion === 'kjv') {
            // KJV books have scriptureType: 'KJV'
            if (data.scriptureType === 'KJV') {
              booksData.push({ 
                title: doc.id, 
                ...data 
              } as Book);
            }
          } else if (scriptureVersion === 'bom') {
            // BOM books don't have scriptureType or it's not 'KJV'
            if (!data.scriptureType || data.scriptureType !== 'KJV') {
              booksData.push({ 
                title: doc.id, 
                ...data 
              } as Book);
            }
          }
        });
        
        console.log(`Found ${booksData.length} ${scriptureVersion} books`);
        setBooks(booksData);
        
        // Don't clear selections when switching versions if we have a saved position
        if (!navigationRef.current) {
          setSelectedBook('');
          setSelectedChapter('');
          setVerses([]);
        }
        
      } catch (err) {
        console.error('Error fetching books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
  
    fetchBooks();
  }, [scriptureVersion]);

  // Fetch chapters when a book is selected
  useEffect(() => {
    async function fetchChapters() {
      if (!selectedBook) return;
      
      try {
        setLoading(true);
        
        // Both versions use the same 'chapters' collection
        const chaptersQuery = query(
          collection(db, 'chapters'), // Same collection for both
          where('bookId', '==', selectedBook),
          orderBy('chapter')
        );
        
        console.log(`Fetching chapters for book: ${selectedBook}`);
        
        const chaptersSnapshot = await getDocs(chaptersQuery);
        
        const chaptersData: Chapter[] = [];
        chaptersSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Chapter, 'chapterId'>;
          chaptersData.push({ 
            ...data,
            chapterId: doc.id
          });
        });
        
        console.log(`Found ${chaptersData.length} chapters for ${selectedBook}`);
        setChapters(chaptersData);
        
        
         // Handle navigation
         if (selectLastChapter && chaptersData.length > 0) {
          // Select the last chapter when coming from next book
          const lastChapter = chaptersData[chaptersData.length - 1];
          setSelectedChapter(lastChapter.chapterId || '');
          setSelectLastChapter(false);
        } else if (navigationRef.current && navigationRef.current.book === selectedBook) {
          if (navigationRef.current.chapter === 'last' && chaptersData.length > 0) {
            setSelectedChapter(chaptersData[chaptersData.length - 1].chapterId || '');
          } else {
            setSelectedChapter(navigationRef.current.chapter);
          }
          navigationRef.current = null;
        } else if (chaptersData.length > 0 && !selectedChapter) {
          // Only auto-select first chapter if no chapter is selected
          setSelectedChapter(chaptersData[0].chapterId || '');
        }
        
      } catch (err) {
        console.error('Error fetching chapters:', err);
        setError('Failed to load chapters. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
  
    fetchChapters();
  }, [selectedBook, scriptureVersion]);

  // Navigation functions
  const [isNavigating, setIsNavigating] = useState(false);

  // Use useCallback to memoize navigation functions
  const handlePreviousChapter = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      console.log('Previous Chapter - Current state:', { selectedBook, selectedChapter, chaptersLength: chapters.length });
      const currentChapterIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
      console.log('Current chapter index:', currentChapterIndex);
      
      if (currentChapterIndex > 0) {
        // Simple case: go to previous chapter in same book
        const prevChapterId = chapters[currentChapterIndex - 1].chapterId;
        console.log('Going to previous chapter in same book:', prevChapterId);
        if (prevChapterId) {
          setSelectedChapter(prevChapterId);
        }
      } else if (currentChapterIndex === 0) {
        // Complex case: go to last chapter of previous book
        const currentBookIndex = books.findIndex(b => b.title === selectedBook);
        console.log('Current book index:', currentBookIndex);
        
        if (currentBookIndex > 0) {
          const prevBookTitle = books[currentBookIndex - 1].title;
          console.log('Going to previous book:', prevBookTitle);
          
          // Get chapters for previous book
          const chaptersRef = collection(db, 'chapters');
          const q = query(
            chaptersRef,
            where('bookId', '==', prevBookTitle),
            orderBy('chapter', 'desc')
          );
          
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const lastChapter = snapshot.docs[0];
            console.log('Last chapter of previous book:', lastChapter.id);
            
            // Change book and chapter together
            setSelectedBook(prevBookTitle);
            // Small delay to ensure book change is processed
            setTimeout(() => {
              setSelectedChapter(lastChapter.id);
            }, 50);
          }
        }
      }
    } finally {
      setTimeout(() => setIsNavigating(false), 200);
    }
  }, [isNavigating, selectedBook, selectedChapter, chapters, books, db]);
  
  const handleNextChapter = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      console.log('Next Chapter - Current state:', { selectedBook, selectedChapter, chaptersLength: chapters.length });
      const currentChapterIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
      console.log('Current chapter index:', currentChapterIndex);
      
      if (currentChapterIndex < chapters.length - 1) {
        // Simple case: go to next chapter in same book
        const nextChapterId = chapters[currentChapterIndex + 1].chapterId;
        console.log('Going to next chapter in same book:', nextChapterId);
        if (nextChapterId) {
          setSelectedChapter(nextChapterId);
        }
      } else if (currentChapterIndex === chapters.length - 1) {
        // Complex case: go to first chapter of next book
        const currentBookIndex = books.findIndex(b => b.title === selectedBook);
        console.log('Current book index:', currentBookIndex);
        
        if (currentBookIndex < books.length - 1) {
          const nextBookTitle = books[currentBookIndex + 1].title;
          console.log('Going to next book:', nextBookTitle);
          setSelectedBook(nextBookTitle);
          // First chapter will be auto-selected by existing useEffect
        }
      }
    } finally {
      setTimeout(() => setIsNavigating(false), 200);
    }
  }, [isNavigating, selectedBook, selectedChapter, chapters, books, db]);

  useEffect(() => {
    async function fetchVerses() {
      if (!selectedChapter) return;
      
      try {
        setLoading(true);
        
        // Both versions use the same 'verses' collection
        const versesQuery = query(
          collection(db, 'verses'), // Same collection for both
          where('chapterId', '==', selectedChapter),
          orderBy('verse')
        );
        
        console.log(`Fetching verses for chapter: ${selectedChapter}`);
        
        const versesSnapshot = await getDocs(versesQuery);
        
        const versesData: Verse[] = [];
        versesSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Verse, 'verseId'>;
          versesData.push({ 
            ...data,
            verseId: doc.id 
          });
        });
        
        console.log(`Found ${versesData.length} verses`);
        setVerses(versesData);
        setSelectedVerse('');
        
      } catch (err) {
        console.error('Error fetching verses:', err);
        setError('Failed to load verses. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
  
    fetchVerses();
  }, [selectedChapter, scriptureVersion]);

  // Load saved highlights and favorites when component mounts and when user changes
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

    async function loadFavorites() {
      if (!user) return;

      try {
        const favoritesQuery = query(
          collection(db, 'favorites'),
          where('userId', '==', user.uid)
        );
        
        const favoritesSnapshot = await getDocs(favoritesQuery);
        const favoriteIds: string[] = [];
        
        favoritesSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.verseIds) {
            favoriteIds.push(...data.verseIds);
          }
        });
        
        setFavoriteVerseIds(favoriteIds);
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }

    loadHighlights();
    loadFavorites();
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



  const isFirstChapter = useCallback(() => {
    if (!selectedBook || !selectedChapter || chapters.length === 0) return false;
    
    const currentBookIndex = books.findIndex(b => b.title === selectedBook);
    const currentChapterIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
    
    const result = currentBookIndex === 0 && currentChapterIndex === 0;
    return result;
  }, [selectedBook, selectedChapter, chapters, books]);
  
  const isLastChapter = useCallback(() => {
    if (!selectedBook || !selectedChapter || chapters.length === 0) return false;
    
    const currentBookIndex = books.findIndex(b => b.title === selectedBook);
    const currentChapterIndex = chapters.findIndex(c => c.chapterId === selectedChapter);
    
    const result = currentBookIndex === books.length - 1 && currentChapterIndex === chapters.length - 1;
    return result;
  }, [selectedBook, selectedChapter, chapters, books]);
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) {
        if (e.key === 'ArrowLeft' && !isFirstChapter()) {
          e.preventDefault();
          handlePreviousChapter();
        } else if (e.key === 'ArrowRight' && !isLastChapter()) {
          e.preventDefault();
          handleNextChapter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePreviousChapter, handleNextChapter, isFirstChapter, isLastChapter]);
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

  const handleMouseUp = (e?: React.MouseEvent) => {
    // If this is a mouse event and the target is a button, don't process highlighting
    if (e && (e.target as HTMLElement).closest('button')) {
      setSelection({
        isSelecting: false,
        startIndex: null,
        endIndex: null,
        verseId: null
      });
      return;
    }

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
    
    const highlightRanges = highlightedWords
      .filter(h => h.verseId === verse.verseId)
      .sort((a, b) => a.startIndex - b.endIndex);

    return (
      <div className="relative inline-block leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
        {words.map((word, index) => {
          const startIndex = currentPosition;
          const endIndex = startIndex + word.length;
          currentPosition = endIndex;

          const highlight = highlightRanges.find(h => {
            if (startIndex >= h.startIndex && endIndex <= h.endIndex) return true;
            if (startIndex >= h.startIndex && startIndex < h.endIndex) return true;
            if (endIndex > h.startIndex && endIndex <= h.endIndex) return true;
            if (startIndex <= h.startIndex && endIndex >= h.endIndex) return true;
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

  const toggleFavorite = async (verse: Verse) => {
    if (!user || !verse.verseId) return;

    try {
      // Check if verse is already in favorites
      const favoritesQuery = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid)
      );
      
      const favoritesSnapshot = await getDocs(favoritesQuery);
      let userFavoritesDoc = null;
      let currentFavorites: string[] = [];

      if (!favoritesSnapshot.empty) {
        userFavoritesDoc = favoritesSnapshot.docs[0];
        currentFavorites = userFavoritesDoc.data().verseIds || [];
      }

      const isCurrentlyFavorite = currentFavorites.includes(verse.verseId);

      if (userFavoritesDoc) {
        // Update existing document
        if (isCurrentlyFavorite) {
          // Remove from favorites
          await updateDoc(userFavoritesDoc.ref, {
            verseIds: arrayRemove(verse.verseId)
          });
          setFavoriteVerseIds(prev => prev.filter(id => id !== verse.verseId));
          alert('Verse removed from favorites!');
        } else {
          // Add to favorites
          await updateDoc(userFavoritesDoc.ref, {
            verseIds: arrayUnion(verse.verseId)
          });
          setFavoriteVerseIds(prev => [...prev, verse.verseId!]);
          alert('Verse added to favorites!');
        }
      } else {
        // Create new favorites document
        await addDoc(collection(db, 'favorites'), {
          userId: user.uid,
          verseIds: [verse.verseId],
          createdAt: new Date()
        });
        setFavoriteVerseIds([verse.verseId]);
        alert('Verse added to favorites!');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Error updating favorites. Please try again.');
    }
  };
  const NavigationButtons = useCallback(() => {
    const handlePrevClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Previous button clicked!');
      console.log('isFirstChapter:', isFirstChapter());
      console.log('isNavigating:', isNavigating);
      await handlePreviousChapter();
    };

    const handleNextClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Next button clicked!');
      console.log('isLastChapter:', isLastChapter());
      console.log('isNavigating:', isNavigating);
      await handleNextChapter();
    };

    const showPrevButton = !isFirstChapter();
    const showNextButton = !isLastChapter();

    return (
      <div className="flex justify-between items-center">
        <div>
          {showPrevButton && (
            <button
              onClick={handlePrevClick}
              disabled={isNavigating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                isNavigating
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {isNavigating ? 'Loading...' : 'Previous'}
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Use Alt+← / Alt+→ for navigation
        </div>
        <div>
          {showNextButton && (
            <button
              onClick={handleNextClick}
              disabled={isNavigating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                isNavigating
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {isNavigating ? 'Loading...' : 'Next'}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }, [handlePreviousChapter, handleNextChapter, isFirstChapter, isLastChapter, isNavigating]);

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className={`max-w-7xl mx-auto p-4 ${isDarkMode ? 'dark' : ''}`} onMouseUp={(e) => handleMouseUp(e)}>
      <div className="mb-6">
        {/* Version Selection */}
        <div className="mb-6">
          <label className="block mb-2 font-medium text-gray-200">
            Scripture Version
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setScriptureVersion('bom');
                setSelectedBook('');
                setSelectedChapter('');
                setVerses([]);
              }}
              className={`px-4 py-2 rounded ${
                scriptureVersion === 'bom' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              Book of Mormon
            </button>
            <button
              onClick={() => {
                setScriptureVersion('kjv');
                setSelectedBook('');
                setSelectedChapter('');
                setVerses([]);
              }}
              className={`px-4 py-2 rounded ${
                scriptureVersion === 'kjv' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              King James Version
            </button>
          </div>
        </div>
        
        {/* Book, Chapter Selection and Settings */}
        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
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
              {!selectedBook && <option value="">Select a book</option>}
              {books.map((book) => (
                <option key={book.title} value={book.title}>
                  {book.title.replace('KJV_', '').replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label htmlFor="chapter-select" className="block mb-2 font-medium text-gray-200">
              Chapter
            </label>
            <select
              id="chapter-select"
              value={selectedChapter}
              onChange={handleChapterChange}
              className="w-full p-2 border rounded text-gray-800 bg-white"
              disabled={loading || chapters.length === 0 || !selectedBook}
            >
              {!selectedChapter && <option value="">Select a chapter</option>}
              {chapters.map((chapter) => (
                <option key={chapter.chapterId} value={chapter.chapterId || ''}>
                  {chapter.chapter}
                </option>
              ))}
            </select>
          </div>

          {/* Settings Button */}
          <div className="flex items-end">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              title="Display Settings"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-200">
                  Font Size: {fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-200">
                  Verse Spacing: {verseSpacing}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="4"
                  value={verseSpacing}
                  onChange={(e) => setVerseSpacing(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation at the top */}
        {verses.length > 0 && (
          <div className="mb-4">
            <NavigationButtons />
          </div>
        )}
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
                {(() => {
                  const bookName = selectedBook.replace('KJV_', '').replace(/_/g, ' ');
                  const chapterNum = chapters.find(c => c.chapterId === selectedChapter)?.chapter || '';
                  return `${bookName} ${chapterNum}`;
                })()}
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

              {/* Verses with dynamic spacing */}
              <div>
                {verses.map((verse, index) => (
                  <div 
                    key={verse.verseId || `${verse.chapterId}_${verse.verse}`} 
                    style={{ marginBottom: `${verseSpacing}px` }}
                  >
                    <div 
                      className={`flex cursor-pointer p-3 rounded-lg transition-colors duration-200 ${
                        selectedVerse === verse.verseId ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() => handleVerseClick(verse.verseId || '')}
                    >
                      <span 
                        className="font-bold mr-3 flex-shrink-0 text-gray-800 dark:text-gray-200" 
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {verse.verse}
                      </span>
                      <div className="flex-1 text-gray-900 dark:text-gray-100">
                        {renderVerseText(verse)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(verse);
                        }}
                        className="ml-3 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title={favoriteVerseIds.includes(verse.verseId || '') ? "Remove from favorites" : "Add to favorites"}
                      >
                        {favoriteVerseIds.includes(verse.verseId || '') ? (
                          // Filled star for favorites
                          <svg className="w-5 h-5 text-yellow-500 hover:text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ) : (
                          // Outline star for non-favorites
                          <svg className="w-5 h-5 text-gray-400 hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chapter Navigation at bottom */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <NavigationButtons />
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

        {/* Annotation Side Panel - keep as is */}
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

      {/* Color picker popup - keep as is */}
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
