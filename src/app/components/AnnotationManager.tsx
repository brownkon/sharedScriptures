"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface Annotation {
  id?: string;
  userId: string;
  verseId: string;
  text: string;
  color: string;
  timestamp: Date;
  visibility: 'private' | 'group' | 'public';
}

interface AnnotationManagerProps {
  verseId: string;
}

export default function AnnotationManager({ verseId }: AnnotationManagerProps) {
  const { db, user } = useFirebase();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFEB3B'); // Default yellow
  const [visibility, setVisibility] = useState<'private' | 'group' | 'public'>('private');
  const [loading, setLoading] = useState(true);

  const colors = [
    { name: 'Yellow', value: '#FFEB3B' },
    { name: 'Green', value: '#C5E1A5' },
    { name: 'Blue', value: '#90CAF9' },
    { name: 'Pink', value: '#F8BBD0' },
    { name: 'Purple', value: '#CE93D8' },
  ];

  // Listen for annotation changes
  useEffect(() => {
    if (!verseId || !user) return;

    // Query for personal and public annotations
    const personalAndPublicQuery = query(
      collection(db, 'annotations'),
      where('verseId', '==', verseId)
    );

    const unsubscribe = onSnapshot(personalAndPublicQuery, (snapshot) => {
      const annotationList: Annotation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include annotations that are public or belong to the current user
        if (data.visibility === 'public' || data.userId === user.uid) {
          annotationList.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
          } as Annotation);
        }
      });
      setAnnotations(annotationList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [verseId, user, db]);

  const handleAddAnnotation = async () => {
    if (!newAnnotationText.trim() || !user || !verseId) return;

    try {
      const newAnnotation: Omit<Annotation, 'id'> = {
        userId: user.uid,
        verseId,
        text: newAnnotationText.trim(),
        color: selectedColor,
        timestamp: new Date(),
        visibility,
      };

      await addDoc(collection(db, 'annotations'), newAnnotation);
      setNewAnnotationText('');
    } catch (error) {
      console.error('Error adding annotation:', error);
    }
  };

  const handleDeleteAnnotation = async (annotationId: string | undefined) => {
    if (!annotationId) return;
    
    try {
      await deleteDoc(doc(db, 'annotations', annotationId));
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading annotations...</div>;
  }

  if (!user) {
    return <div className="p-4 bg-yellow-100 text-yellow-800 rounded">Sign in to add annotations</div>;
  }

  return (
    <div className="mt-8">
      
      {/* Display existing annotations */}
      <div className="space-y-3 mb-6">
        {annotations.length > 0 ? (
          annotations.map((annotation) => (
            <div 
              key={annotation.id} 
              className="p-3 rounded relative"
              style={{ backgroundColor: annotation.color + '40' }} // Add transparency
            >
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {annotation.visibility === 'public' ? 'Public' : 'Private'} · 
                  {' '}{new Date(annotation.timestamp).toLocaleString()}
                </span>
                {annotation.userId === user.uid && (
                  <button 
                    onClick={() => handleDeleteAnnotation(annotation.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    title="Delete annotation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-1 text-gray-800 dark:text-gray-200">{annotation.text}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm"></p>
        )}
      </div>
      
      {/* Add new annotation */}
      <div className="border rounded p-4 dark:border-gray-700">
        <h4 className="font-medium mb-2 text-gray-800 dark:text-gray-200">Add Annotation</h4>
        
        <div className="mb-3">
          <textarea
            value={newAnnotationText}
            onChange={(e) => setNewAnnotationText(e.target.value)}
            className="w-full border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
            rows={3}
            placeholder="Write your annotation here..."
          />
        </div>
        
        
        <div className="flex items-center mb-4">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'private' | 'group' | 'public')}
            className="border rounded p-1 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        
        <button
          onClick={handleAddAnnotation}
          disabled={!newAnnotationText.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          Add Annotation
        </button>
      </div>
    </div>
  );
} 