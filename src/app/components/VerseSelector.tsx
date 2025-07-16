"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '../providers';
import { StudyVerse } from '../types/study';

interface VerseSelectorProps {
  onVersesSelected: (verses: StudyVerse[]) => void;
  selectedVerses: StudyVerse[];
}

interface Book {
  title: string;
  numberOfChapters: number;
  order: number;
}

interface Chapter {
  bookId: string;
  chapter: number;
  reference: string;
  numberOfVerses: number;
  chapterId?: string;
}

interface VerseGroup {
  id: string;
  name: string;
  description: string;
  verseIds: string[];
  userId: string;
  createdAt: Date;
}

export default function VerseSelector({ onVersesSelected, selectedVerses }: VerseSelectorProps) {
  const { db, user } = useFirebase();
  const [selectionMode, setSelectionMode] = useState<'books' | 'groups' | 'favorites'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [chapterVerses, setChapterVerses] = useState<StudyVerse[]>([]);
  const [selectedIndividualVerses, setSelectedIndividualVerses] = useState<string[]>([]);
  const [verseGroups, setVerseGroups] = useState<VerseGroup[]>([]);
  const [favoriteVerses, setFavoriteVerses] = useState<StudyVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [scriptureVersion, setScriptureVersion] = useState<'bom' | 'kjv'>('bom');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<VerseGroup | null>(null);
  const [editingGroupVerses, setEditingGroupVerses] = useState<StudyVerse[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [modalBooks, setModalBooks] = useState<Book[]>([]);
  const [modalSelectedBooks, setModalSelectedBooks] = useState<string[]>([]);
  const [modalChapters, setModalChapters] = useState<Chapter[]>([]);
  const [modalSelectedChapters, setModalSelectedChapters] = useState<string[]>([]);
  const [modalChapterVerses, setModalChapterVerses] = useState<StudyVerse[]>([]);
  const [modalSelectedVerses, setModalSelectedVerses] = useState<string[]>([]);

  // Load books
  useEffect(() => {
    loadBooks();
  }, [scriptureVersion]);

  // Load chapters when books are selected
  useEffect(() => {
    if (selectedBooks.length > 0) {
      loadChapters();
    }
  }, [selectedBooks]);

  // Load verses when chapters are selected
  useEffect(() => {
    if (selectedChapters.length > 0) {
      loadChapterVerses();
    } else {
      setChapterVerses([]);
      setSelectedIndividualVerses([]);
    }
  }, [selectedChapters]);

  // Load verse groups and favorites
  useEffect(() => {
    if (user) {
      loadVerseGroups();
      loadFavoriteVerses();
    }
  }, [user]);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const booksQuery = query(
        collection(db, 'books'),
        orderBy('order')
      );
      
      const booksSnapshot = await getDocs(booksQuery);
      const booksData: Book[] = [];
      
      booksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (scriptureVersion === 'kjv') {
          if (data.scriptureType === 'KJV') {
            booksData.push({ title: doc.id, ...data } as Book);
          }
        } else if (scriptureVersion === 'bom') {
          if (!data.scriptureType || data.scriptureType !== 'KJV') {
            booksData.push({ title: doc.id, ...data } as Book);
          }
        }
      });
      
      setBooks(booksData);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async () => {
    try {
      setLoading(true);
      const allChapters: Chapter[] = [];
      
      for (const bookId of selectedBooks) {
        const chaptersQuery = query(
          collection(db, 'chapters'),
          where('bookId', '==', bookId),
          orderBy('chapter')
        );
        
        const chaptersSnapshot = await getDocs(chaptersQuery);
        chaptersSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Chapter, 'chapterId'>;
          allChapters.push({
            ...data,
            chapterId: doc.id
          });
        });
      }
      
      setChapters(allChapters);
    } catch (error) {
      console.error('Error loading chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChapterVerses = async () => {
    try {
      setLoading(true);
      const allVerses: StudyVerse[] = [];
      
      for (const chapterId of selectedChapters) {
        const versesQuery = query(
          collection(db, 'verses'),
          where('chapterId', '==', chapterId),
          orderBy('verse')
        );
        
        const versesSnapshot = await getDocs(versesQuery);
        versesSnapshot.forEach((doc) => {
          const data = doc.data();
          allVerses.push({
            verseId: doc.id,
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text
          });
        });
      }
      
      setChapterVerses(allVerses);
    } catch (error) {
      console.error('Error loading chapter verses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVerseGroups = async () => {
    if (!user) return;
    
    try {
      const groupsQuery = query(
        collection(db, 'verseGroups'),
        where('userId', '==', user.uid)
      );
      
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData: VerseGroup[] = [];
      
      groupsSnapshot.forEach((doc) => {
        const data = doc.data();
        groupsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as VerseGroup);
      });
      
      setVerseGroups(groupsData);
    } catch (error) {
      console.error('Error loading verse groups:', error);
    }
  };

  const loadFavoriteVerses = async () => {
    if (!user) return;
    
    try {
      // Load user's favorite verses
      const favoritesQuery = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid)
      );
      
      const favoritesSnapshot = await getDocs(favoritesQuery);
      const favoriteVerseIds: string[] = [];
      
      favoritesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.verseIds) {
          favoriteVerseIds.push(...data.verseIds);
        }
      });
      
      if (favoriteVerseIds.length > 0) {
        // Load the actual verse data
        const verses: StudyVerse[] = [];
        for (const verseId of favoriteVerseIds) {
          const verseQuery = query(
            collection(db, 'verses'),
            where('__name__', '==', verseId)
          );
          
          const verseSnapshot = await getDocs(verseQuery);
          verseSnapshot.forEach((doc) => {
            const data = doc.data();
            verses.push({
              verseId: doc.id,
              bookId: data.bookId,
              chapterId: data.chapterId,
              verse: data.verse,
              reference: data.reference,
              text: data.text,
              isFavorite: true
            });
          });
        }
        
        setFavoriteVerses(verses);
      }
    } catch (error) {
      console.error('Error loading favorite verses:', error);
    }
  };

  const generateRandomVerses = async () => {
    if (selectedChapters.length === 0) return;
    
    try {
      setLoading(true);
      const verses: StudyVerse[] = [];
      
      for (const chapterId of selectedChapters) {
        const versesQuery = query(
          collection(db, 'verses'),
          where('chapterId', '==', chapterId),
          orderBy('verse')
        );
        
        const versesSnapshot = await getDocs(versesQuery);
        const chapterVerses: StudyVerse[] = [];
        
        versesSnapshot.forEach((doc) => {
          const data = doc.data();
          chapterVerses.push({
            verseId: doc.id,
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text
          });
        });
        
        // Randomly select 1-3 verses from each chapter
        const numToSelect = Math.min(Math.floor(Math.random() * 3) + 1, chapterVerses.length);
        const shuffled = chapterVerses.sort(() => 0.5 - Math.random());
        verses.push(...shuffled.slice(0, numToSelect));
      }
      
      // Shuffle the final selection
      const finalSelection = verses.sort(() => 0.5 - Math.random()).slice(0, 20); // Max 20 verses
      onVersesSelected(finalSelection);
    } catch (error) {
      console.error('Error generating random verses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupVerses = async (group: VerseGroup) => {
    try {
      setLoading(true);
      const verses: StudyVerse[] = [];
      
      for (const verseId of group.verseIds) {
        const verseQuery = query(
          collection(db, 'verses'),
          where('__name__', '==', verseId)
        );
        
        const verseSnapshot = await getDocs(verseQuery);
        verseSnapshot.forEach((doc) => {
          const data = doc.data();
          verses.push({
            verseId: doc.id,
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text
          });
        });
      }
      
      onVersesSelected(verses);
    } catch (error) {
      console.error('Error loading group verses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEditingGroupVerses = async (group: VerseGroup) => {
    try {
      const verses: StudyVerse[] = [];
      
      for (const verseId of group.verseIds) {
        const verseQuery = query(
          collection(db, 'verses'),
          where('__name__', '==', verseId)
        );
        
        const verseSnapshot = await getDocs(verseQuery);
        verseSnapshot.forEach((doc) => {
          const data = doc.data();
          verses.push({
            verseId: doc.id,
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text
          });
        });
      }
      
      setEditingGroupVerses(verses);
    } catch (error) {
      console.error('Error loading editing group verses:', error);
    }
  };

  const deleteVerseGroup = async (group: VerseGroup) => {
    if (!user) return;
    
    const confirmed = confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await deleteDoc(doc(db, 'verseGroups', group.id));
      alert('Verse group deleted successfully!');
      await loadVerseGroups();
    } catch (error) {
      console.error('Error deleting verse group:', error);
      alert(`Error deleting verse group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Modal-specific loading functions
  const loadModalBooks = async () => {
    try {
      const booksQuery = query(
        collection(db, 'books'),
        orderBy('order')
      );
      
      const booksSnapshot = await getDocs(booksQuery);
      const booksData: Book[] = [];
      
      booksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (scriptureVersion === 'kjv') {
          if (data.scriptureType === 'KJV') {
            booksData.push({ title: doc.id, ...data } as Book);
          }
        } else if (scriptureVersion === 'bom') {
          if (!data.scriptureType || data.scriptureType !== 'KJV') {
            booksData.push({ title: doc.id, ...data } as Book);
          }
        }
      });
      
      setModalBooks(booksData);
    } catch (error) {
      console.error('Error loading modal books:', error);
    }
  };

  const loadModalChapters = async () => {
    try {
      const allChapters: Chapter[] = [];
      
      for (const bookId of modalSelectedBooks) {
        const chaptersQuery = query(
          collection(db, 'chapters'),
          where('bookId', '==', bookId),
          orderBy('chapter')
        );
        
        const chaptersSnapshot = await getDocs(chaptersQuery);
        chaptersSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Chapter, 'chapterId'>;
          allChapters.push({
            ...data,
            chapterId: doc.id
          });
        });
      }
      
      setModalChapters(allChapters);
    } catch (error) {
      console.error('Error loading modal chapters:', error);
    }
  };

  const loadModalChapterVerses = async () => {
    try {
      const allVerses: StudyVerse[] = [];
      
      for (const chapterId of modalSelectedChapters) {
        const versesQuery = query(
          collection(db, 'verses'),
          where('chapterId', '==', chapterId),
          orderBy('verse')
        );
        
        const versesSnapshot = await getDocs(versesQuery);
        versesSnapshot.forEach((doc) => {
          const data = doc.data();
          allVerses.push({
            verseId: doc.id,
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text
          });
        });
      }
      
      setModalChapterVerses(allVerses);
    } catch (error) {
      console.error('Error loading modal chapter verses:', error);
    }
  };

  const createOrUpdateVerseGroup = async () => {
    if (!user || !newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }

    // For editing, we don't require selected verses since we're just updating name/description
    if (!editingGroup && selectedVerses.length === 0) {
      alert('Please select some verses first.');
      return;
    }
    
    try {
      if (editingGroup) {
        // Update existing group
        console.log('Updating verse group:', editingGroup.id);
        const groupRef = doc(db, 'verseGroups', editingGroup.id);
        
        // If we have editingGroupVerses, update the verses too
        const updateData: any = {
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
        };
        
        if (editingGroupVerses.length > 0) {
          updateData.verseIds = editingGroupVerses.map(v => v.verseId);
        }
        
        await updateDoc(groupRef, updateData);
        
        alert('Verse group updated successfully!');
      } else {
        // Create new group
        console.log('Creating verse group with data:', {
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
          verseIds: selectedVerses.map(v => v.verseId),
          userId: user.uid,
          selectedVersesCount: selectedVerses.length
        });

        const groupData = {
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
          verseIds: selectedVerses.map(v => v.verseId),
          userId: user.uid,
          createdAt: new Date()
        };
        
        // Add a new document to the verseGroups collection
        const docRef = await addDoc(collection(db, 'verseGroups'), groupData);
        console.log('Verse group created with ID:', docRef.id);
        
        alert('Verse group created successfully!');
      }
      
      setNewGroupName('');
      setNewGroupDescription('');
      setEditingGroup(null);
      setEditingGroupVerses([]);
      setShowCreateGroup(false);
      
      // Clear modal state
      setModalBooks([]);
      setModalSelectedBooks([]);
      setModalChapters([]);
      setModalSelectedChapters([]);
      setModalChapterVerses([]);
      setModalSelectedVerses([]);
      
      // Reload the groups
      await loadVerseGroups();
    } catch (error) {
      console.error('Error saving verse group:', error);
      alert(`Error saving verse group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div>
      
      {/* Selection Mode Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {[
          { key: 'books', label: 'By Books', icon: '📚' },
          { key: 'groups', label: 'Verse Groups', icon: '📝' },
          { key: 'favorites', label: 'Favorites', icon: '⭐' }
        ].map((mode) => (
          <button
            key={mode.key}
            onClick={() => setSelectionMode(mode.key as any)}
            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectionMode === mode.key
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <span className="mr-2">{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {/* Scripture Version Selection */}
      {selectionMode === 'books' && (
        <div className="mb-6">
          <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
            Scripture Version
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setScriptureVersion('bom')}
              className={`px-4 py-2 rounded ${
                scriptureVersion === 'bom' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
              }`}
            >
              Book of Mormon
            </button>
            <button
              onClick={() => setScriptureVersion('kjv')}
              className={`px-4 py-2 rounded ${
                scriptureVersion === 'kjv' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
              }`}
            >
              King James Version
            </button>
          </div>
        </div>
      )}

      {/* Selected Verses Summary - Always Visible */}
      {selectedVerses.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Selected for Study ({selectedVerses.length} verses)
          </h3>
          <div className="flex flex-wrap gap-1">
            {selectedVerses.map((verse) => (
              <span key={verse.verseId} className="inline-block text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                {verse.reference}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content based on selection mode */}
      {selectionMode === 'books' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side - Book and Chapter Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Book Selection */}
            <div>
              <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                Select Books
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 max-h-48 overflow-y-auto border rounded p-2">
                {books.map((book) => (
                  <label key={book.title} className="flex items-center space-x-1 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedBooks.includes(book.title)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBooks([...selectedBooks, book.title]);
                        } else {
                          setSelectedBooks(selectedBooks.filter(b => b !== book.title));
                          setSelectedChapters(selectedChapters.filter(c => 
                            !chapters.find(ch => ch.chapterId === c && ch.bookId === book.title)
                          ));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {book.title.replace('KJV_', '').replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Chapter Selection */}
            {chapters.length > 0 && (
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
                  Select Chapters
                </label>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                  {chapters.map((chapter) => (
                    <label key={chapter.chapterId} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedChapters.includes(chapter.chapterId || '')}
                        onChange={(e) => {
                          const chapterId = chapter.chapterId || '';
                          if (e.target.checked) {
                            setSelectedChapters([...selectedChapters, chapterId]);
                          } else {
                            setSelectedChapters(selectedChapters.filter(c => c !== chapterId));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {chapter.bookId.replace('KJV_', '').replace(/_/g, ' ')} {chapter.chapter}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedChapters.length > 0 && (
              <div className="flex space-x-4">
                <button
                  onClick={generateRandomVerses}
                  disabled={loading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Loading...' : `Generate Random Verses`}
                </button>
                {selectedIndividualVerses.length > 0 && (
                  <button
                    onClick={() => {
                      const selectedVersesFromIndividual = chapterVerses.filter(v => 
                        selectedIndividualVerses.includes(v.verseId)
                      );
                      onVersesSelected(selectedVersesFromIndividual);
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg"
                  >
                    Study Selected Verses ({selectedIndividualVerses.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right side - Individual Verse Selection */}
          <div className="lg:col-span-1">
            {chapterVerses.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Select Individual Verses
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {chapterVerses.map((verse) => (
                    <label key={verse.verseId} className="flex items-start space-x-2 cursor-pointer p-3 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIndividualVerses.includes(verse.verseId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIndividualVerses([...selectedIndividualVerses, verse.verseId]);
                            // Add to selected verses
                            if (!selectedVerses.find(v => v.verseId === verse.verseId)) {
                              onVersesSelected([...selectedVerses, verse]);
                            }
                          } else {
                            setSelectedIndividualVerses(selectedIndividualVerses.filter(id => id !== verse.verseId));
                            // Remove from selected verses
                            onVersesSelected(selectedVerses.filter(v => v.verseId !== verse.verseId));
                          }
                        }}
                        className="rounded mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                          {verse.reference}
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 line-clamp-3">
                          {verse.text}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectionMode === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Your Verse Groups
            </h3>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Create New Group
            </button>
          </div>

          {verseGroups.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No verse groups created yet. Create your first group to organize verses for study.
            </p>
          ) : (
            <div className="grid gap-4">
              {verseGroups.map((group) => (
                <div key={group.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{group.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {group.verseIds.length} verses
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          setEditingGroup(group);
                          setNewGroupName(group.name);
                          setNewGroupDescription(group.description);
                          // Load the verses in this group for editing
                          await loadEditingGroupVerses(group);
                          setShowCreateGroup(true);
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => loadGroupVerses(group)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Study
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Group Modal */}
          {showCreateGroup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {editingGroup ? 'Edit Verse Group' : 'Create Verse Group'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Enter group name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      rows={3}
                      placeholder="Describe this group"
                    />
                  </div>
                  
                  {/* Verses in Group (for editing) */}
                  {editingGroup && (
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Verses in this group: {editingGroupVerses.length}
                        </p>
                        <button
                          onClick={() => {
                            // Add selected verses from "By Books" tab to the editing group
                            const newVerses = selectedVerses.filter(v => 
                              !editingGroupVerses.find(ev => ev.verseId === v.verseId)
                            );
                            setEditingGroupVerses([...editingGroupVerses, ...newVerses]);
                          }}
                          disabled={selectedVerses.length === 0}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          Add Selected Verses ({selectedVerses.length})
                        </button>
                      </div>
                      
                      {editingGroupVerses.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                          {editingGroupVerses.map((verse) => (
                            <div key={verse.verseId} className="flex items-start justify-between p-2 bg-white dark:bg-gray-600 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                  {verse.reference}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                  {verse.text}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingGroupVerses(editingGroupVerses.filter(v => v.verseId !== verse.verseId));
                                }}
                                className="ml-2 text-red-500 hover:text-red-700 text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700 p-3 rounded">
                          No verses in this group. Use "By Books" tab to select verses, then click "Add Selected Verses".
                        </p>
                      )}
                      
                      {/* Verse Selection within Modal */}
                      <div className="mt-4 border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Add More Verses
                        </h4>
                        
                        {/* Load books for modal */}
                        {modalBooks.length === 0 && (
                          <button
                            onClick={loadModalBooks}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm mb-3"
                          >
                            Load Books
                          </button>
                        )}
                        
                        {/* Modal Book Selection */}
                        {modalBooks.length > 0 && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              Select Books
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-32 overflow-y-auto border rounded p-2">
                              {modalBooks.map((book) => (
                                <label key={book.title} className="flex items-center space-x-1 cursor-pointer text-xs">
                                  <input
                                    type="checkbox"
                                    checked={modalSelectedBooks.includes(book.title)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setModalSelectedBooks([...modalSelectedBooks, book.title]);
                                      } else {
                                        setModalSelectedBooks(modalSelectedBooks.filter(b => b !== book.title));
                                        setModalSelectedChapters(modalSelectedChapters.filter(c => 
                                          !modalChapters.find(ch => ch.chapterId === c && ch.bookId === book.title)
                                        ));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {book.title.replace('KJV_', '').replace(/_/g, ' ')}
                                  </span>
                                </label>
                              ))}
                            </div>
                            {modalSelectedBooks.length > 0 && (
                              <button
                                onClick={loadModalChapters}
                                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                              >
                                Load Chapters
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Modal Chapter Selection */}
                        {modalChapters.length > 0 && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              Select Chapters
                            </label>
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-1 max-h-32 overflow-y-auto border rounded p-2">
                              {modalChapters.map((chapter) => (
                                <label key={chapter.chapterId} className="flex items-center space-x-1 cursor-pointer text-xs">
                                  <input
                                    type="checkbox"
                                    checked={modalSelectedChapters.includes(chapter.chapterId || '')}
                                    onChange={(e) => {
                                      const chapterId = chapter.chapterId || '';
                                      if (e.target.checked) {
                                        setModalSelectedChapters([...modalSelectedChapters, chapterId]);
                                      } else {
                                        setModalSelectedChapters(modalSelectedChapters.filter(c => c !== chapterId));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {chapter.bookId.replace('KJV_', '').replace(/_/g, ' ')} {chapter.chapter}
                                  </span>
                                </label>
                              ))}
                            </div>
                            {modalSelectedChapters.length > 0 && (
                              <button
                                onClick={loadModalChapterVerses}
                                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                              >
                                Load Verses
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Modal Individual Verse Selection */}
                        {modalChapterVerses.length > 0 && (
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              Select Individual Verses
                            </label>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                              {modalChapterVerses.map((verse) => (
                                <label key={verse.verseId} className="flex items-start space-x-2 cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-gray-600 rounded text-xs">
                                  <input
                                    type="checkbox"
                                    checked={modalSelectedVerses.includes(verse.verseId)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setModalSelectedVerses([...modalSelectedVerses, verse.verseId]);
                                      } else {
                                        setModalSelectedVerses(modalSelectedVerses.filter(id => id !== verse.verseId));
                                      }
                                    }}
                                    className="rounded mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {verse.reference}
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                                      {verse.text}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                            {modalSelectedVerses.length > 0 && (
                              <button
                                onClick={() => {
                                  const selectedVersesToAdd = modalChapterVerses.filter(v => 
                                    modalSelectedVerses.includes(v.verseId) && 
                                    !editingGroupVerses.find(ev => ev.verseId === v.verseId)
                                  );
                                  setEditingGroupVerses([...editingGroupVerses, ...selectedVersesToAdd]);
                                  setModalSelectedVerses([]);
                                }}
                                className="mt-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                              >
                                Add Selected Verses ({modalSelectedVerses.length})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Instructions for creating new group */}
                  {!editingGroup && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 To add verses to this group: First select verses using the "By Books" tab, then come back here to create the group.
                      </p>
                    </div>
                  )}
                  
                  {!editingGroup && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Selected verses: {selectedVerses.length}
                      </p>
                      {selectedVerses.length > 0 ? (
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          {selectedVerses.map((verse) => (
                            <div key={verse.verseId} className="text-xs text-gray-600 dark:text-gray-400">
                              {verse.reference}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No verses selected. Go to "By Books" tab to select verses first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-6">
                  {/* Delete button (only for editing) */}
                  {editingGroup && (
                    <button
                      onClick={async () => {
                        await deleteVerseGroup(editingGroup);
                        setShowCreateGroup(false);
                        setEditingGroup(null);
                        setEditingGroupVerses([]);
                        setNewGroupName('');
                        setNewGroupDescription('');
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
                    >
                      Delete Group
                    </button>
                  )}
                  
                  {/* Right side buttons */}
                  <div className="flex space-x-3 ml-auto">
                    <button
                      onClick={() => {
                        setShowCreateGroup(false);
                        setEditingGroup(null);
                        setEditingGroupVerses([]);
                        setNewGroupName('');
                        setNewGroupDescription('');
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createOrUpdateVerseGroup}
                      disabled={!newGroupName.trim() || (!editingGroup && selectedVerses.length === 0)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {editingGroup ? 'Update Group' : 'Create Group'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectionMode === 'favorites' && (
        <div>
          {favoriteVerses.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No favorite verses yet. Add verses to your favorites while reading to study them here.
            </p>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => onVersesSelected(favoriteVerses)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg"
              >
                Study All Favorite Verses ({favoriteVerses.length})
              </button>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {favoriteVerses.map((verse) => (
                  <div key={verse.verseId} className="border border-gray-200 dark:border-gray-600 rounded p-3">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {verse.reference}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {verse.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
