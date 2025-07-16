"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useFirebase } from '../providers';
import { useHighlight } from '../contexts/HighlightContext';
import { useTheme } from '../contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface HighlightedWord {
  id?: string;
  verseId: string;
  startIndex: number;
  endIndex: number;
  color: string;
  userId: string;
}

interface LocalHighlights {
  [verseId: string]: HighlightedWord[];
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, auth } = useFirebase();
  const { needsSync, setNeedsSync, isSyncing, setIsSyncing, localHighlights } = useHighlight();
  const { isDarkMode } = useTheme();
  
  useEffect(() => {
    console.log('Navbar - needsSync:', needsSync);
  }, [needsSync]);
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const saveHighlights = async () => {
    if (!user || isSyncing) return;

    try {
      setIsSyncing(true);
      
      // Get all highlights from local state
      const highlightsRef = collection(db, 'highlights');
      const highlightsQuery = query(
        highlightsRef,
        where('userId', '==', user.uid)
      );
      
      const highlightsSnapshot = await getDocs(highlightsQuery);
      const batch = writeBatch(db);
      
      // Delete all existing highlights
      highlightsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Add new highlights
      const allHighlights = Object.values(localHighlights).flat();
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
      }
      
      await batch.commit();
      setNeedsSync(false);
    } catch (error) {
      console.error('Error saving highlights:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent whitespace-nowrap">
              Scripture Study
            </span>
          </Link>
          
          <div className="flex items-center space-x-6">
            {user ? (
              <>
                <Link 
                  href="/scriptures" 
                  className={`text-sm font-medium transition-colors duration-200 ${
                    pathname === '/scriptures' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Scriptures
                </Link>
                
                <Link 
                  href="/annotations" 
                  className={`text-sm font-medium transition-colors duration-200 ${
                    pathname === '/annotations' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  My Annotations
                </Link>
                
                <Link 
                  href="/groups" 
                  className={`text-sm font-medium transition-colors duration-200 ${
                    pathname === '/groups' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Study Groups
                </Link>
                
                <Link 
                  href="/study" 
                  className={`text-sm font-medium transition-colors duration-200 ${
                    pathname === '/study' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Study Verses
                </Link>
                
                {needsSync && (
                  <div className="flex items-center bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg">
                    <button
                      onClick={saveHighlights}
                      disabled={isSyncing}
                      className={`bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-1 px-3 rounded shadow-md transition-colors duration-200 text-sm ${
                        isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSyncing ? 'Saving...' : 'Save Highlights'}
                    </button>
                    <span className="ml-2 text-gray-700 dark:text-gray-300 text-sm">⚠️</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    {user.photoURL && (
                      <img 
                        src={user.photoURL} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full ring-2 ring-gray-200 dark:ring-gray-700" 
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.displayName}</span>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <Link 
                href="/login" 
                className={`text-sm font-medium transition-colors duration-200 ${
                  pathname === '/login' 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
