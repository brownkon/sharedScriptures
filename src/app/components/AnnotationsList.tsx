"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirebase } from '../providers';
import { useRouter } from 'next/navigation';

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

interface AnnotationsListProps {
  selectedDate: string | null;
  onClose: () => void;
}


export default function AnnotationsList({ selectedDate, onClose }: AnnotationsListProps) {
  const { db, user } = useFirebase();
  const router = useRouter();
  const [annotations, setAnnotations] = useState<AnnotationWithVerse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !selectedDate) {
      setLoading(false);
      return;
    }

    // Create date range for the selected day
    const startOfDay = new Date(selectedDate + 'T00:00:00');
    const endOfDay = new Date(selectedDate + 'T23:59:59');

    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(annotationsQuery, async (snapshot) => {
      const annotationList: AnnotationWithVerse[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const annotationTimestamp = data.timestamp?.toDate() || new Date();
        
        // Filter by selected date
        const annotationDateKey = annotationTimestamp.toISOString().split('T')[0];
        if (annotationDateKey !== selectedDate) {
          continue; // Skip annotations not from the selected date
        }
        
        const annotation: AnnotationWithVerse = {
          id: docSnapshot.id,
          ...data,
          timestamp: annotationTimestamp,
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
  }, [user, db, selectedDate]);

  const navigateToVerse = (annotation: AnnotationWithVerse) => {
    if (annotation.bookId && annotation.chapterId) {
      // Navigate to scriptures page with the specific book and chapter
      const searchParams = new URLSearchParams({
        book: annotation.bookId,
        chapter: annotation.chapterId,
        verse: annotation.verseId
      });
      router.push(`/scriptures?${searchParams.toString()}`);
      onClose();
    }
  };

  if (!selectedDate) return null;

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Annotations for {formattedDate}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-600 dark:text-gray-400">Loading annotations...</div>
            </div>
          ) : annotations.length > 0 ? (
            <div className="p-6 space-y-4">
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                  onClick={() => navigateToVerse(annotation)}
                >
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
                          {annotation.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        annotation.visibility === 'public' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {annotation.visibility}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {annotation.text}
                    </p>
                  </div>
                  
                  {annotation.verseText && (
                    <div className="border-l-4 border-gray-300 dark:border-gray-500 pl-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        &ldquo;{annotation.verseText.length > 100 
                          ? annotation.verseText.substring(0, 100) + '...' 
                          : annotation.verseText}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No annotations found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You didn&apos;t create any annotations on this date.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
