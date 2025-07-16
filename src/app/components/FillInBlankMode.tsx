"use client";

import { useState, useEffect } from 'react';
import { StudySession, StudyVerse, DifficultyLevel } from '../types/study';

interface FillInBlankModeProps {
  session: StudySession;
  onSessionEnd: (session: StudySession) => void;
}

interface BlankWord {
  word: string;
  index: number;
  userAnswer: string;
  isCorrect?: boolean;
  blankNumber?: number;
}

interface VerseWithBlanks {
  verse: StudyVerse;
  blanks: BlankWord[];
  displayText: string;
  isCompleted: boolean;
  isCorrect: boolean;
  attempts: number;
}

export default function FillInBlankMode({ session, onSessionEnd }: FillInBlankModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [versesWithBlanks, setVersesWithBlanks] = useState<VerseWithBlanks[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [sessionStartTime] = useState<Date>(session.startTime);

  const currentVerseWithBlanks = versesWithBlanks[currentIndex];
  const isLastVerse = currentIndex === versesWithBlanks.length - 1;

  // Initialize verses with blanks based on difficulty
  useEffect(() => {
    const processedVerses = session.verses.map(verse => createVerseWithBlanks(verse, session.difficulty || 'medium'));
    setVersesWithBlanks(processedVerses);
  }, [session]);

  const createVerseWithBlanks = (verse: StudyVerse, difficulty: DifficultyLevel): VerseWithBlanks => {
    const words = verse.text.split(/(\s+)/);
    const wordIndices = words.map((word, index) => ({ word, index })).filter(item => /\w/.test(item.word));
    
    // Determine number of blanks based on difficulty
    let numBlanks: number;
    switch (difficulty) {
      case 'easy':
        numBlanks = Math.min(2, Math.max(1, Math.floor(wordIndices.length * 0.1)));
        break;
      case 'medium':
        numBlanks = Math.min(5, Math.max(3, Math.floor(wordIndices.length * 0.2)));
        break;
      case 'hard':
        numBlanks = Math.min(8, Math.max(6, Math.floor(wordIndices.length * 0.3)));
        break;
      default:
        numBlanks = 3;
    }

    // Randomly select words to blank out (avoid very short words and common words)
    const commonWords = ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'];
    
    const eligibleWords = wordIndices.filter(item => 
      item.word.length > 3 && 
      !commonWords.includes(item.word.toLowerCase()) &&
      /^[a-zA-Z]+$/.test(item.word)
    );
    
    const selectedIndices = eligibleWords
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(numBlanks, eligibleWords.length))
      .map(item => item.index)
      .sort((a, b) => a - b); // Sort by position in text

    // Create blanks array with proper ordering
    const blanks: BlankWord[] = selectedIndices.map((index, blankNumber) => ({
      word: words[index].replace(/[^\w]/g, ''), // Remove punctuation for comparison
      index,
      userAnswer: '',
      isCorrect: false,
      blankNumber: blankNumber + 1 // Add sequential blank number
    }));

    // Create display text by replacing words with numbered placeholders
    let displayText = verse.text;
    const wordsArray = verse.text.split(/(\s+)/);
    
    // Replace from end to beginning to maintain indices
    for (let i = selectedIndices.length - 1; i >= 0; i--) {
      const wordIndex = selectedIndices[i];
      const blankNumber = i + 1;
      const originalWord = wordsArray[wordIndex];
      const wordWithoutPunctuation = originalWord.replace(/[^\w]/g, '');
      const punctuation = originalWord.replace(/\w/g, '');
      const blankLength = Math.max(wordWithoutPunctuation.length, 4);
      const placeholder = `[BLANK_${blankNumber}]`;
      
      wordsArray[wordIndex] = placeholder + punctuation;
    }
    
    displayText = wordsArray.join('');

    return {
      verse,
      blanks,
      displayText,
      isCompleted: false,
      isCorrect: false,
      attempts: 0
    };
  };

  const handleAnswerChange = (blankIndex: number, value: string) => {
    setVersesWithBlanks(prev => {
      const updated = [...prev];
      updated[currentIndex].blanks[blankIndex].userAnswer = value;
      return updated;
    });
  };

  const checkAnswers = () => {
    setVersesWithBlanks(prev => {
      const updated = [...prev];
      const current = updated[currentIndex];
      
      current.blanks.forEach(blank => {
        const userAnswer = blank.userAnswer.toLowerCase().trim();
        const correctAnswer = blank.word.toLowerCase();
        blank.isCorrect = userAnswer === correctAnswer || 
                         // Allow partial matches for longer words
                         (correctAnswer.length > 5 && userAnswer.length >= 3 && correctAnswer.includes(userAnswer));
      });
      
      current.isCompleted = true;
      current.isCorrect = current.blanks.every(blank => blank.isCorrect);
      current.attempts += 1;
      
      return updated;
    });
    
    setShowAnswers(true);
  };

  const handleNext = () => {
    if (isLastVerse) {
      finishSession();
    } else {
      setCurrentIndex(prev => prev + 1);
      setShowAnswers(false);
    }
  };

  const handleTryAgain = () => {
    setVersesWithBlanks(prev => {
      const updated = [...prev];
      updated[currentIndex].blanks.forEach(blank => {
        if (!blank.isCorrect) {
          blank.userAnswer = '';
        }
      });
      updated[currentIndex].isCompleted = false;
      return updated;
    });
    setShowAnswers(false);
  };

  const finishSession = () => {
    const totalTimeSpent = new Date().getTime() - sessionStartTime.getTime();
    const correctAnswers = versesWithBlanks.filter(v => v.isCorrect).length;
    
    const updatedSession: StudySession = {
      ...session,
      endTime: new Date(),
      correctAnswers,
      accuracy: Math.round((correctAnswers / versesWithBlanks.length) * 100),
      timeSpent: Math.round(totalTimeSpent / 1000)
    };

    onSessionEnd(updatedSession);
  };

  const handleSkip = () => {
    if (isLastVerse) {
      finishSession();
    } else {
      setCurrentIndex(prev => prev + 1);
      setShowAnswers(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowAnswers(false);
    }
  };

  if (!currentVerseWithBlanks) {
    return <div>Loading...</div>;
  }

  const progress = ((currentIndex + 1) / versesWithBlanks.length) * 100;
  const completedCount = versesWithBlanks.filter(v => v.isCompleted).length;
  const correctCount = versesWithBlanks.filter(v => v.isCorrect).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Fill in the Blanks
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Verse {currentIndex + 1} of {versesWithBlanks.length}
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
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Completed: {completedCount}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Correct: {correctCount}</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">
              Difficulty: {session.difficulty ? session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1) : 'Medium'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
        {/* Reference */}
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          {currentVerseWithBlanks.verse.reference}
        </h3>

        {/* Verse with blanks or answers */}
        <div className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 mb-8">
          {showAnswers ? (
            // Show answers with color coding
            <div className="space-y-4">
              <div className="whitespace-pre-wrap">
                {currentVerseWithBlanks.verse.text.split(/(\s+)/).map((part, index) => {
                  const blank = currentVerseWithBlanks.blanks.find(b => 
                    currentVerseWithBlanks.verse.text.split(/(\s+)/)[b.index] === part
                  );
                  
                  if (blank) {
                    return (
                      <span
                        key={index}
                        className={`font-bold px-1 rounded ${
                          blank.isCorrect 
                            ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                            : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {part}
                      </span>
                    );
                  }
                  return part;
                })}
              </div>
              
              {/* Show user answers vs correct answers */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Your Answers:</h4>
                <div className="space-y-2">
                  {currentVerseWithBlanks.blanks.map((blank, index) => (
                    <div key={index} className="flex items-center space-x-4 text-sm">
                      <span className="w-4 text-gray-600 dark:text-gray-400">#{index + 1}</span>
                      <span className={`font-medium ${blank.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        Your answer: "{blank.userAnswer || '(empty)'}"
                      </span>
                      {!blank.isCorrect && (
                        <span className="text-gray-600 dark:text-gray-400">
                          Correct: "{blank.word}"
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${blank.isCorrect ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                        {blank.isCorrect ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Show verse with input fields
            <div className="space-y-6">
              <div className="text-center text-gray-600 dark:text-gray-400 mb-4">
                Fill in the missing words:
              </div>
              
              <div className="whitespace-pre-wrap leading-relaxed">
                {currentVerseWithBlanks.displayText.split(/(\[BLANK_\d+\])/g).map((part, index) => {
                  const blankMatch = part.match(/\[BLANK_(\d+)\]/);
                  if (blankMatch) {
                    const blankNumber = parseInt(blankMatch[1]) - 1; // Convert to 0-based index
                    const blank = currentVerseWithBlanks.blanks[blankNumber];
                    
                    if (blank) {
                      return (
                        <input
                          key={`blank-${blankNumber}-${index}`}
                          type="text"
                          value={blank.userAnswer}
                          onChange={(e) => handleAnswerChange(blankNumber, e.target.value)}
                          className="inline-block mx-1 px-2 py-1 border-b-2 border-blue-500 bg-transparent text-center font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-600"
                          style={{ width: `${Math.max((blank.word?.length || 4) * 0.8, 4)}em` }}
                          placeholder={`${blankNumber + 1}`}
                        />
                      );
                    }
                  }
                  return <span key={`text-${index}`}>{part}</span>;
                })}
              </div>

              {/* Hints */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Hints:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {currentVerseWithBlanks.blanks.map((blank, index) => (
                    <div key={`hint-${blank.index}-${index}`} className="text-blue-800 dark:text-blue-200">
                      Blank #{index + 1}: {blank.word.length} letters
                      {blank.word.length > 4 && `, starts with "${blank.word.charAt(0).toUpperCase()}"`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          {!showAnswers ? (
            <button
              onClick={checkAnswers}
              disabled={currentVerseWithBlanks.blanks.some(blank => !blank.userAnswer.trim())}
              className={`px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                currentVerseWithBlanks.blanks.some(blank => !blank.userAnswer.trim())
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Check Answers
            </button>
          ) : (
            <div className="flex space-x-4">
              {!currentVerseWithBlanks.isCorrect && (
                <button
                  onClick={handleTryAgain}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={handleNext}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                {isLastVerse ? 'Finish Session' : 'Next Verse'}
              </button>
            </div>
          )}
        </div>
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

        <button
          onClick={handleSkip}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          Skip
        </button>

        <div className="w-24"> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">📝 Instructions</h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>• Fill in all the blanks with the missing words</li>
          <li>• Use the hints to help you remember the correct words</li>
          <li>• Spelling must be exact, but capitalization is ignored</li>
          <li>• You can try again if you get some words wrong</li>
        </ul>
      </div>
    </div>
  );
}
