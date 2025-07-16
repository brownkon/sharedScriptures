"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { useFirebase } from '../providers';
import StudyModeSelector from '../components/StudyModeSelector';
import FlashcardMode from '../components/FlashcardMode';
import FillInBlankMode from '../components/FillInBlankMode';
import VerseSelector from '../components/VerseSelector';
import StudyDashboard from '../components/StudyDashboard';
import { StudyMode, DifficultyLevel, StudyVerse, StudySession } from '../types/study';

export default function StudyPage() {
  const router = useRouter();
  const { db, user, loading } = useFirebase();
  const [studyMode, setStudyMode] = useState<StudyMode>(null);
  const [selectedVerses, setSelectedVerses] = useState<StudyVerse[]>([]);
  const [currentSession, setCurrentSession] = useState<StudySession | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'study' | 'dashboard'>('study');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleStartStudy = (mode: StudyMode, verses: StudyVerse[], difficulty?: DifficultyLevel) => {
    if (!user || verses.length === 0) return;

    const session: StudySession = {
      id: `session_${Date.now()}`,
      userId: user.uid,
      mode,
      difficulty,
      verses,
      startTime: new Date(),
      totalVerses: verses.length,
      correctAnswers: 0,
      accuracy: 0,
      timeSpent: 0
    };

    setCurrentSession(session);
    setStudyMode(mode);
  };

  const handleEndSession = async (session: StudySession) => {
    // Save the session to Firebase
    if (user && session.endTime) {
      try {
        await addDoc(collection(db, 'studySessions'), {
          userId: session.userId,
          mode: session.mode,
          difficulty: session.difficulty,
          totalVerses: session.totalVerses,
          correctAnswers: session.correctAnswers,
          accuracy: session.accuracy,
          timeSpent: session.timeSpent,
          date: session.endTime,
          startTime: session.startTime,
          endTime: session.endTime
        });
        console.log('Study session saved successfully');
      } catch (error) {
        console.error('Error saving study session:', error);
      }
    }
    
    setCurrentSession(null);
    setStudyMode(null);
  };


  const handleBackToSelection = () => {
    setStudyMode(null);
    setCurrentSession(null);
    setSelectedVerses([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        {!studyMode && (
          <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('study')}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'study'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Study
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Progress
            </button>
          </div>
        )}

        {/* Main Content */}
        {!studyMode ? (
          <div>
            {activeTab === 'study' ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <VerseSelector 
                  onVersesSelected={setSelectedVerses}
                  selectedVerses={selectedVerses}
                />
                
                {/* Study Mode Selection */}
                {selectedVerses.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <StudyModeSelector 
                      onStartStudy={handleStartStudy}
                      selectedVerses={selectedVerses}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Study Dashboard */
              <StudyDashboard />
            )}
          </div>
        ) : (
          <div>
            {/* Back Button */}
            <button
              onClick={handleBackToSelection}
              className="mb-6 flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Selection
            </button>

            {/* Study Mode Components */}
            {studyMode === 'flashcard' && currentSession && (
              <FlashcardMode 
                session={currentSession}
                onSessionEnd={handleEndSession}
              />
            )}
            
            {studyMode === 'fill-in-blank' && currentSession && (
              <FillInBlankMode 
                session={currentSession}
                onSessionEnd={handleEndSession}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
