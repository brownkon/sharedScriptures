"use client";

import { useState } from 'react';
import { StudyVerse, StudyMode, DifficultyLevel } from '../types/study';

interface StudyModeSelectorProps {
  onStartStudy: (mode: StudyMode, verses: StudyVerse[], difficulty?: DifficultyLevel) => void;
  selectedVerses: StudyVerse[];
}

export default function StudyModeSelector({ onStartStudy, selectedVerses }: StudyModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<StudyMode>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');

  const studyModes = [
    {
      key: 'flashcard' as StudyMode,
      title: 'Flashcard Mode',
      icon: '🃏',
      description: 'Study verses with traditional flashcards. See the reference first, then reveal the verse text.',
      features: [
        'Show reference → reveal verse',
        'Mark as known/unknown',
        'Review missed verses',
        'Progress tracking'
      ]
    },
    {
      key: 'fill-in-blank' as StudyMode,
      title: 'Fill in the Blanks',
      icon: '✏️',
      description: 'Test your memory by filling in missing words from verses with varying difficulty levels.',
      features: [
        'Easy: Remove 1-2 words per verse',
        'Medium: Remove 3-5 words per verse',
        'Hard: Remove 6+ words per verse',
        'Instant feedback on answers'
      ]
    }
  ];

  const difficultyLevels = [
    {
      key: 'easy' as DifficultyLevel,
      title: 'Easy',
      description: 'Remove 1-2 words per verse',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    },
    {
      key: 'medium' as DifficultyLevel,
      title: 'Medium',
      description: 'Remove 3-5 words per verse',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    {
      key: 'hard' as DifficultyLevel,
      title: 'Hard',
      description: 'Remove 6+ words per verse',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
  ];

  const handleStartStudy = () => {
    if (selectedMode) {
      onStartStudy(selectedMode, selectedVerses, selectedMode === 'fill-in-blank' ? difficulty : undefined);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Choose Your Study Mode
      </h2>
      
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {studyModes.map((mode) => (
          <div
            key={mode.key}
            className={`border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ${
              selectedMode === mode.key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
            onClick={() => setSelectedMode(mode.key)}
          >
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">{mode.icon}</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {mode.title}
              </h3>
              {selectedMode === mode.key && (
                <div className="ml-auto">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {mode.description}
            </p>
            
          </div>
        ))}
      </div>

      {/* Difficulty Selection for Fill-in-Blank Mode */}
      {selectedMode === 'fill-in-blank' && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Select Difficulty Level
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {difficultyLevels.map((level) => (
              <button
                key={level.key}
                onClick={() => setDifficulty(level.key)}
                className={`p-3 rounded-lg text-center transition-all duration-200 ${
                  difficulty === level.key
                    ? level.color + ' ring-2 ring-blue-500'
                    : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500'
                }`}
              >
                <div className="font-medium">{level.title}</div>
                <div className="text-xs mt-1">{level.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Start Study Button */}
      <button
        onClick={handleStartStudy}
        disabled={!selectedMode}
        className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all duration-200 ${
          selectedMode
            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        }`}
      >
        {selectedMode ? (
          <div className="flex items-center justify-center">
            <span className="mr-2">🚀</span>
            Start Study Session
          </div>
        ) : (
          'Select a Study Mode to Continue'
        )}
      </button>

    </div>
  );
}
