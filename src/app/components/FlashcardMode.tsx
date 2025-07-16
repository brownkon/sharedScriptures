"use client";

import { useState, useEffect } from 'react';
import { StudySession, StudyVerse } from '../study/page';

interface FlashcardModeProps {
  session: StudySession;
  onSessionEnd: (session: StudySession) => void;
}

interface FlashcardResult {
  verseId: string;
  known: boolean;
  timeSpent: number;
}

export default function FlashcardMode({ session, onSessionEnd }: FlashcardModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVerse, setShowVerse] = useState(false);
  const [results, setResults] = useState<FlashcardResult[]>([]);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [sessionStartTime] = useState<Date>(session.startTime);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewVerses, setReviewVerses] = useState<StudyVerse[]>([]);

  const currentVerse = reviewMode ? reviewVerses[currentIndex] : session.verses[currentIndex];
  const totalVerses = reviewMode ? reviewVerses.length : session.verses.length;
  const isLastCard = currentIndex === totalVerses - 1;

  useEffect(() => {
    setStartTime(new Date());
  }, [currentIndex]);

  // Add keyboard event listeners
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent default behavior for our shortcuts
      if ([' ', '1', '2', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
      }

      switch (event.key) {
        case ' ': // Spacebar
          if (!showVerse) {
            handleReveal();
          }
          break;
        case '1':
          if (showVerse) {
            handleResponse(false); // Don't know
          }
          break;
        case '2':
          if (showVerse) {
            handleResponse(true); // I know this
          }
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleSkip();
          break;
        case '3':
        case 's':
        case 'S':
          handleSkip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showVerse, currentIndex, isLastCard]);

  const handleReveal = () => {
    setShowVerse(true);
  };

  const handleResponse = (known: boolean) => {
    const timeSpent = new Date().getTime() - startTime.getTime();
    
    const result: FlashcardResult = {
      verseId: currentVerse.verseId,
      known,
      timeSpent
    };

    setResults(prev => [...prev, result]);

    if (isLastCard) {
      if (reviewMode) {
        // End the session after review
        finishSession();
      } else {
        // Check if we need to review any verses
        const unknownVerses = [...results, result].filter(r => !r.known);
        if (unknownVerses.length > 0) {
          startReviewMode(unknownVerses);
        } else {
          finishSession();
        }
      }
    } else {
      // Move to next card
      setCurrentIndex(prev => prev + 1);
      setShowVerse(false);
    }
  };

  const startReviewMode = (unknownResults: FlashcardResult[]) => {
    const versesToReview = session.verses.filter(verse => 
      unknownResults.some(result => result.verseId === verse.verseId)
    );
    
    setReviewVerses(versesToReview);
    setReviewMode(true);
    setCurrentIndex(0);
    setShowVerse(false);
  };

  const finishSession = () => {
    const totalTimeSpent = new Date().getTime() - sessionStartTime.getTime();
    const correctAnswers = results.filter(r => r.known).length;
    
    const updatedSession: StudySession = {
      ...session,
      endTime: new Date(),
      correctAnswers,
      accuracy: Math.round((correctAnswers / results.length) * 100),
      timeSpent: Math.round(totalTimeSpent / 1000) // Convert to seconds
    };

    onSessionEnd(updatedSession);
  };

  const handleSkip = () => {
    if (isLastCard) {
      finishSession();
    } else {
      setCurrentIndex(prev => prev + 1);
      setShowVerse(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowVerse(false);
    }
  };

  const progress = ((currentIndex + 1) / totalVerses) * 100;
  const knownCount = results.filter(r => r.known).length;
  const unknownCount = results.filter(r => !r.known).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {reviewMode ? 'Review Mode' : 'Flashcard Study'}
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Card {currentIndex + 1} of {totalVerses}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Stats */}
        <div className="flex justify-center space-x-6 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Known: {knownCount}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Unknown: {unknownCount}</span>
          </div>
          {reviewMode && (
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-gray-700 dark:text-gray-300">Reviewing</span>
            </div>
          )}
        </div>
      </div>

      {/* Flashcard */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6 min-h-[400px] flex flex-col justify-center">
        {!showVerse ? (
          /* Front of card - Reference */
          <div className="text-center">
            <div className="mb-8">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {currentVerse.reference}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Can you recite this verse?
              </p>
            </div>
            
            <button
              onClick={handleReveal}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Reveal Verse
            </button>
          </div>
        ) : (
          /* Back of card - Verse text */
          <div className="text-center">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {currentVerse.reference}
              </h3>
              <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 max-w-3xl mx-auto">
                {currentVerse.text}
              </p>
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleResponse(false)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Don't Know
              </button>
              <button
                onClick={() => handleResponse(true)}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                I Know This
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${
            currentIndex === 0
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-gray-500 hover:bg-gray-600 text-white'
          }`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div className="flex space-x-3">
          <button
            onClick={handleSkip}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            Skip
          </button>
          
          {isLastCard && (
            <button
              onClick={finishSession}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors duration-200 font-medium"
            >
              Finish Session
            </button>
          )}
        </div>

        <div className="w-24"> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">⌨️ Keyboard Shortcuts</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div><kbd className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">Space</kbd> Reveal</div>
          <div><kbd className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">1</kbd> Don't Know</div>
          <div><kbd className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">2</kbd> I Know</div>
          <div><kbd className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">3/S</kbd> Skip</div>
          <div><kbd className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">←</kbd> Previous</div>
        </div>
      </div>
    </div>
  );
}
