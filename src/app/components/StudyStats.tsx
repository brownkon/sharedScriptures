"use client";

import { StudySession } from '../types/study';

interface StudyStatsProps {
  session: StudySession;
  onClose: () => void;
}

export default function StudyStats({ session, onClose }: StudyStatsProps) {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPerformanceMessage = (accuracy: number): { message: string; color: string; emoji: string } => {
    if (accuracy >= 90) {
      return {
        message: "Excellent work! You have great knowledge of these verses.",
        color: "text-green-600 dark:text-green-400",
        emoji: "🌟"
      };
    } else if (accuracy >= 75) {
      return {
        message: "Good job! Keep practicing to improve your recall.",
        color: "text-blue-600 dark:text-blue-400",
        emoji: "👍"
      };
    } else if (accuracy >= 50) {
      return {
        message: "Nice effort! Consider reviewing these verses more often.",
        color: "text-yellow-600 dark:text-yellow-400",
        emoji: "📚"
      };
    } else {
      return {
        message: "Keep studying! Regular practice will help you improve.",
        color: "text-orange-600 dark:text-orange-400",
        emoji: "💪"
      };
    }
  };

  const performance = getPerformanceMessage(session.accuracy);
  const averageTimePerVerse = Math.round(session.timeSpent / session.totalVerses);

  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="text-6xl mb-4">{performance.emoji}</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Study Session Complete!
        </h2>
        <p className={`text-lg ${performance.color}`}>
          {performance.message}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {session.accuracy}%
          </div>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            Accuracy
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {session.correctAnswers}/{session.totalVerses}
          </div>
          <div className="text-sm text-green-800 dark:text-green-300">
            Correct
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="space-y-4 mb-6">
        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300">Study Mode:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
            {session.mode === 'fill-in-blank' ? 'Fill in the Blanks' : 'Flashcard'}
          </span>
        </div>
        
        {session.difficulty && (
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-300">Difficulty:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
              {session.difficulty}
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300">Total Time:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatTime(session.timeSpent)}
          </span>
        </div>
        
        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span className="text-gray-700 dark:text-gray-300">Average per Verse:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatTime(averageTimePerVerse)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span>{session.correctAnswers} of {session.totalVerses} verses</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${session.accuracy}%` }}
          ></div>
        </div>
      </div>

      {/* Achievements */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Achievements
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {session.accuracy === 100 && (
            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full text-sm">
              🏆 Perfect Score!
            </span>
          )}
          {session.accuracy >= 90 && (
            <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm">
              ⭐ Excellent
            </span>
          )}
          {session.totalVerses >= 10 && (
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
              📚 Dedicated Studier
            </span>
          )}
          {averageTimePerVerse <= 30 && (
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-3 py-1 rounded-full text-sm">
              ⚡ Quick Learner
            </span>
          )}
          {session.mode === 'fill-in-blank' && session.difficulty === 'hard' && session.accuracy >= 75 && (
            <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-3 py-1 rounded-full text-sm">
              🔥 Challenge Master
            </span>
          )}
        </div>
      </div>

      {/* Study Tips */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Study Tips for Next Time</h4>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          {session.accuracy < 75 && (
            <li>• Try reviewing verses multiple times before studying</li>
          )}
          {session.mode === 'flashcard' && (
            <li>• Consider using fill-in-the-blank mode for more challenge</li>
          )}
          {session.difficulty === 'easy' && session.accuracy >= 85 && (
            <li>• You're ready to try medium or hard difficulty!</li>
          )}
          {averageTimePerVerse > 60 && (
            <li>• Practice reciting verses aloud to improve recall speed</li>
          )}
          <li>• Regular daily practice leads to better long-term retention</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Study More Verses
        </button>
        <button
          onClick={() => {
            // This could save the session or navigate somewhere
            onClose();
          }}
          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Finish
        </button>
      </div>

      {/* Session Details */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Session completed on {session.endTime?.toLocaleDateString()} at {session.endTime?.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
