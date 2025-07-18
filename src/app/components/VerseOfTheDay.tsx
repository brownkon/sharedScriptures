"use client";

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface Verse {
  bookId: string;
  chapterId: string;
  verse: number;
  reference: string;
  text: string;
  verseId?: string;
}

interface VerseOfTheDayEntry {
  id?: string;
  verse: Verse;
  date: string;
  userId: string;
}

interface VerseOfTheDayProps {
  onHistoryClick?: () => void;
}

const VerseOfTheDay: React.FC<VerseOfTheDayProps> = ({ onHistoryClick }) => {
  const [currentVerse, setCurrentVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allVerses, setAllVerses] = useState<Verse[]>([]);
  const { user } = useFirebase();

  // Load all verses from Firebase
  useEffect(() => {
    const loadAllVerses = async () => {
      try {
        const versesRef = collection(db, 'verses');
        const querySnapshot = await getDocs(versesRef);
        
        const verses: Verse[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          verses.push({
            bookId: data.bookId,
            chapterId: data.chapterId,
            verse: data.verse,
            reference: data.reference,
            text: data.text,
            verseId: doc.id
          });
        });
        
        setAllVerses(verses);
      } catch (error) {
        console.error('Error loading verses:', error);
      }
    };

    loadAllVerses();
  }, []);

  const getTodaysDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getVerseForDate = (date: string): Verse | null => {
    if (allVerses.length === 0) return null;
    
    // Use date as seed for consistent daily verse
    const dateNum = new Date(date).getTime();
    const index = Math.floor((dateNum / (1000 * 60 * 60 * 24)) % allVerses.length);
    return allVerses[index];
  };

  const saveVerseOfTheDay = async (verse: Verse, date: string) => {
    if (!user) return;

    try {
      const docData = {
        verse: {
          bookId: verse.bookId,
          chapterId: verse.chapterId,
          verse: verse.verse,
          reference: verse.reference,
          text: verse.text,
          verseId: verse.verseId
        },
        date,
        userId: user.uid,
        timestamp: new Date()
      };
      
      await addDoc(collection(db, 'verseOfTheDay'), docData);
    } catch (error) {
      console.error('Error saving verse of the day:', error);
    }
  };

  const checkExistingVerse = async (date: string): Promise<Verse | null> => {
    if (!user) return null;

    try {
      const q = query(
        collection(db, 'verseOfTheDay'),
        where('userId', '==', user.uid),
        where('date', '==', date),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return doc.data().verse as Verse;
      }
      return null;
    } catch (error) {
      console.error('Error checking existing verse:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadTodaysVerse = async () => {
      if (!user || allVerses.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        const today = getTodaysDate();
        
        // Check if we already have a verse for today
        const existingVerse = await checkExistingVerse(today);
        
        if (existingVerse) {
          setCurrentVerse(existingVerse);
        } else {
          // Get new verse for today
          const todaysVerse = getVerseForDate(today);
          if (todaysVerse) {
            setCurrentVerse(todaysVerse);
            
            // Save it to the database
            await saveVerseOfTheDay(todaysVerse, today);
          }
        }
      } catch (err) {
        setError('Failed to load verse of the day');
        console.error('Error loading verse:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTodaysVerse();
  }, [user, allVerses]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="flex space-x-2">
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!currentVerse) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verse of the Day
        </h2>
        
        <div className="flex space-x-2">
          {/* History Button */}
          <button
            onClick={onHistoryClick}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="View history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Verse Content */}
      <div className="mb-4">
        <blockquote className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed italic mb-3">
          "{currentVerse.text}"
        </blockquote>
        <cite className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {currentVerse.reference}
        </cite>
      </div>

      {/* Date */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </div>
    </div>
  );
};

export default VerseOfTheDay;
