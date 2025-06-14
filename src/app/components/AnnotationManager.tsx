"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, onSnapshot, or } from 'firebase/firestore';
import { useFirebase } from '../providers';
import GroupAnnotations from './GroupAnnotations';

interface Annotation {
  id?: string;
  userId: string;
  verseId: string;
  text: string;
  color: string;
  timestamp: Date;
  visibility: 'private' | 'group' | 'public';
  groupId?: string;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members: string[];
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
  const [userGroups, setUserGroups] = useState<StudyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const colors = [
    { name: 'Yellow', value: '#FFEB3B' },
    { name: 'Green', value: '#C5E1A5' },
    { name: 'Blue', value: '#90CAF9' },
    { name: 'Pink', value: '#F8BBD0' },
    { name: 'Purple', value: '#CE93D8' },
  ];

  // Fetch user's groups
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'studyGroups'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(groupsQuery, (snapshot) => {
      const groups: StudyGroup[] = [];
      snapshot.forEach((doc) => {
        groups.push({
          id: doc.id,
          ...doc.data(),
        } as StudyGroup);
      });
      setUserGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, db]);

  // Listen for annotation changes
  useEffect(() => {
    if (!verseId || !user) return;

    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('verseId', '==', verseId)
    );

    const unsubscribe = onSnapshot(annotationsQuery, async (snapshot) => {
      const annotationList: Annotation[] = [];
      
      const userGroupIds = userGroups.map(group => group.id);

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const annotation = {
          id: docSnapshot.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as Annotation;

        // Include annotation if:
        // 1. It's the user's own annotation (any visibility)
        // 2. It's a public annotation
        // 3. It's a group annotation and user is in that group
        if (
          annotation.userId === user.uid ||
          annotation.visibility === 'public' ||
          (annotation.visibility === 'group' && 
           annotation.groupId && 
           userGroupIds.includes(annotation.groupId))
        ) {
          annotationList.push(annotation);
        }
      });

      // Sort by timestamp
      annotationList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setAnnotations(annotationList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [verseId, user, db, userGroups]);

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
        ...(visibility === 'group' && selectedGroupId && { groupId: selectedGroupId }),
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
                  {annotation.visibility === 'public' ? 'Public' : 
                   annotation.visibility === 'group' ? 'Group' : 'Private'} · 
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
        
        {/* Color Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Highlight Color
          </label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  selectedColor === color.value
                    ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-600'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title={`Select ${color.name} color`}
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {color.name}
                </span>
                {selectedColor === color.value && (
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Visibility
          </label>
          <div className="flex items-center space-x-4">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'private' | 'group' | 'public')}
              className="border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="private">Private</option>
              {userGroups.length > 0 && <option value="group">Group</option>}
              <option value="public">Public</option>
            </select>
            
            {visibility === 'group' && userGroups.length > 0 && (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
              >
                {userGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {visibility === 'group' && userGroups.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Join a study group to share annotations with group members.
            </p>
          )}
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
