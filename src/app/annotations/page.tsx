"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '../providers';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Annotation {
  id: string;
  userId: string;
  verseId: string;
  text: string;
  color: string;
  timestamp: Date;
  visibility: 'private' | 'group' | 'public';
}

interface AnnotationWithVerse extends Annotation {
  verseReference?: string;
  verseText?: string;
  bookId?: string;
  chapterId?: string;
  verse?: number;
}

const colors = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#C5E1A5' },
  { name: 'Blue', value: '#90CAF9' },
  { name: 'Pink', value: '#F8BBD0' },
  { name: 'Purple', value: '#CE93D8' },
];

export default function AnnotationsPage() {
  const { db, user, loading: authLoading } = useFirebase();
  const router = useRouter();
  const [annotations, setAnnotations] = useState<AnnotationWithVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<string[]>(colors.map(c => c.value));
  const [showAllColors, setShowAllColors] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load annotations
  useEffect(() => {
    if (!user) return;

    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(annotationsQuery, async (snapshot) => {
      const annotationList: AnnotationWithVerse[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const annotation: AnnotationWithVerse = {
          id: docSnapshot.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as AnnotationWithVerse;

        // Fetch verse details
        try {
          const verseDoc = await getDoc(doc(db, 'verses', data.verseId));
          if (verseDoc.exists()) {
            const verseData = verseDoc.data();
            annotation.verseReference = verseData.reference;
            annotation.verseText = verseData.text;
            annotation.bookId = verseData.bookId;
            annotation.chapterId = verseData.chapterId;
            annotation.verse = verseData.verse;
          }
        } catch (error) {
          console.error('Error fetching verse details:', error);
        }

        annotationList.push(annotation);
      }

      // Sort by timestamp (newest first)
      annotationList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAnnotations(annotationList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleColorToggle = (colorValue: string) => {
    if (selectedColors.includes(colorValue)) {
      const newColors = selectedColors.filter(c => c !== colorValue);
      setSelectedColors(newColors);
      setShowAllColors(newColors.length === colors.length);
    } else {
      const newColors = [...selectedColors, colorValue];
      setSelectedColors(newColors);
      setShowAllColors(newColors.length === colors.length);
    }
  };

  const handleSelectAll = () => {
    if (showAllColors) {
      setSelectedColors([]);
      setShowAllColors(false);
    } else {
      setSelectedColors(colors.map(c => c.value));
      setShowAllColors(true);
    }
  };

  const navigateToVerse = (annotation: AnnotationWithVerse) => {
    if (annotation.bookId && annotation.chapterId) {
      // Navigate to scriptures page with the specific book and chapter
      const searchParams = new URLSearchParams({
        book: annotation.bookId,
        chapter: annotation.chapterId,
        verse: annotation.verseId
      });
      router.push(`/scriptures?${searchParams.toString()}`);
    }
  };

  const filteredAnnotations = annotations.filter(annotation => 
    selectedColors.includes(annotation.color)
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            Loading annotations...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            My Annotations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all your scripture annotations
          </p>
        </div>

        {/* Color Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Filter by Color
          </h2>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleSelectAll}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                showAllColors
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {showAllColors ? 'Deselect All' : 'Select All'}
            </button>
            
            <div className="flex flex-wrap gap-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorToggle(color.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    selectedColors.includes(color.value)
                      ? 'border-gray-400 dark:border-gray-500'
                      : 'border-gray-200 dark:border-gray-600 opacity-50'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {color.name}
                  </span>
                  {selectedColors.includes(color.value) && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredAnnotations.length} of {annotations.length} annotations
          </div>
        </div>

        {/* Annotations List */}
        <div className="space-y-4">
          {filteredAnnotations.length > 0 ? (
            filteredAnnotations.map((annotation) => (
              <div
                key={annotation.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigateToVerse(annotation)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: annotation.color }}
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {annotation.verseReference || `Verse ${annotation.verseId}`}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {annotation.timestamp.toLocaleDateString()} at {annotation.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        annotation.visibility === 'public' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {annotation.visibility}
                      </span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {annotation.text}
                    </p>
                  </div>
                  
                  {annotation.verseText && (
                    <div className="border-l-4 border-gray-200 dark:border-gray-600 pl-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{annotation.verseText.length > 150 
                          ? annotation.verseText.substring(0, 150) + '...' 
                          : annotation.verseText}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : selectedColors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4zM6 6v12h12V6H6zm3 3a1 1 0 112 0v6a1 1 0 11-2 0V9zm4 0a1 1 0 112 0v6a1 1 0 11-2 0V9z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No colors selected
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select one or more colors to view your annotations.
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No annotations found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {annotations.length === 0 
                  ? "You haven't created any annotations yet."
                  : "No annotations match the selected color filters."
                }
              </p>
              <Link
                href="/scriptures"
                className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Start Reading Scriptures
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
