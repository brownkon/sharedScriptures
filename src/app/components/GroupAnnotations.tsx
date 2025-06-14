"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members: string[];
}

interface GroupAnnotationsProps {
  verseId: string;
}

export default function GroupAnnotations({ verseId }: GroupAnnotationsProps) {
  const { db, user } = useFirebase();
  const [userGroups, setUserGroups] = useState<StudyGroup[]>([]);
  const [groupAnnotations, setGroupAnnotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's groups with names
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
    });

    return () => unsubscribe();
  }, [user, db]);

  // Fetch group annotations for this verse
  useEffect(() => {
    if (!verseId || !user || userGroups.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = userGroups.map(g => g.id);
    
    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('verseId', '==', verseId),
      where('visibility', '==', 'group')
    );

    const unsubscribe = onSnapshot(annotationsQuery, (snapshot) => {
      const annotations: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include annotations from groups the user is in
        if (data.groupId && groupIds.includes(data.groupId)) {
          const group = userGroups.find(g => g.id === data.groupId);
          annotations.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
            groupName: group?.name || 'Unknown Group',
          });
        }
      });
      
      // Sort by timestamp
      annotations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setGroupAnnotations(annotations);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [verseId, user, db, userGroups]);

  if (loading) {
    return null;
  }

  if (!user || groupAnnotations.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h5 className="font-medium mb-3 text-gray-800 dark:text-gray-200">Group Comments</h5>
      <div className="space-y-3">
        {groupAnnotations.map((annotation) => (
          <div 
            key={annotation.id} 
            className="p-3 rounded border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {annotation.groupName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {annotation.timestamp.toLocaleString()}
              </span>
            </div>
            <p className="text-gray-800 dark:text-gray-200">{annotation.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
