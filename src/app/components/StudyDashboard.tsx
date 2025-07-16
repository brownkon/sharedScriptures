"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface StudySessionData {
  id: string;
  userId: string;
  mode: 'flashcard' | 'fill-in-blank';
  difficulty?: 'easy' | 'medium' | 'hard';
  totalVerses: number;
  correctAnswers: number;
  accuracy: number;
  timeSpent: number;
  date: Date;
}

interface StudyStats {
  totalSessions: number;
  totalVersesStudied: number;
  averageAccuracy: number;
  totalTimeSpent: number;
  favoriteMode: string;
  streakDays: number;
  weeklyProgress: { day: string; sessions: number; accuracy: number }[];
  accuracyTrend: { date: string; accuracy: number }[];
  difficultyBreakdown: { difficulty: string; count: number; avgAccuracy: number }[];
}

export default function StudyDashboard() {
  const { db, user } = useFirebase();
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    if (user) {
      loadStudyStats();
    }
  }, [user, timeRange]);

  const loadStudyStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }

      // Load study sessions from Firebase (simplified query to avoid index requirement)
      try {
        const sessionsQuery = query(
          collection(db, 'studySessions'),
          where('userId', '==', user.uid)
        );
        
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const allSessions: StudySessionData[] = [];
        
        sessionsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.date && data.date.toDate) {
            allSessions.push({
              id: doc.id,
              userId: data.userId,
              mode: data.mode,
              difficulty: data.difficulty,
              totalVerses: data.totalVerses,
              correctAnswers: data.correctAnswers,
              accuracy: data.accuracy,
              timeSpent: data.timeSpent,
              date: data.date.toDate()
            });
          }
        });
        
        // Filter by date range in JavaScript to avoid Firebase index requirement
        const sessions = allSessions.filter(session => 
          session.date >= startDate && session.date <= now
        ).sort((a, b) => b.date.getTime() - a.date.getTime());
        
        const calculatedStats = calculateStats(sessions);
        setStats(calculatedStats);
      } catch (queryError) {
        console.log('Firebase query failed:', queryError);
        // If Firebase query fails, show empty stats
        setStats({
          totalSessions: 0,
          totalVersesStudied: 0,
          averageAccuracy: 0,
          totalTimeSpent: 0,
          favoriteMode: 'flashcard',
          streakDays: 0,
          weeklyProgress: [],
          accuracyTrend: [],
          difficultyBreakdown: []
        });
      }
    } catch (error) {
      console.error('Error loading study stats:', error);
      // Show empty stats if there's any other error
      setStats({
        totalSessions: 0,
        totalVersesStudied: 0,
        averageAccuracy: 0,
        totalTimeSpent: 0,
        favoriteMode: 'flashcard',
        streakDays: 0,
        weeklyProgress: [],
        accuracyTrend: [],
        difficultyBreakdown: []
      });
    } finally {
      setLoading(false);
    }
  };


  const calculateStats = (sessions: StudySessionData[]): StudyStats => {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalVersesStudied: 0,
        averageAccuracy: 0,
        totalTimeSpent: 0,
        favoriteMode: 'flashcard',
        streakDays: 0,
        weeklyProgress: [],
        accuracyTrend: [],
        difficultyBreakdown: []
      };
    }

    const totalSessions = sessions.length;
    const totalVersesStudied = sessions.reduce((sum, s) => sum + s.totalVerses, 0);
    const averageAccuracy = Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length);
    const totalTimeSpent = sessions.reduce((sum, s) => sum + s.timeSpent, 0);

    // Calculate favorite mode
    const modeCount = sessions.reduce((acc, s) => {
      acc[s.mode] = (acc[s.mode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const favoriteMode = Object.entries(modeCount).sort(([,a], [,b]) => b - a)[0]?.[0] || 'flashcard';

    // Calculate streak days
    const uniqueDays = [...new Set(sessions.map(s => s.date.toDateString()))];
    const streakDays = calculateStreak(uniqueDays);

    // Weekly progress
    const weeklyProgress = calculateWeeklyProgress(sessions);

    // Accuracy trend
    const accuracyTrend = calculateAccuracyTrend(sessions);

    // Difficulty breakdown
    const difficultyBreakdown = calculateDifficultyBreakdown(sessions);

    return {
      totalSessions,
      totalVersesStudied,
      averageAccuracy,
      totalTimeSpent,
      favoriteMode,
      streakDays,
      weeklyProgress,
      accuracyTrend,
      difficultyBreakdown
    };
  };

  const calculateStreak = (uniqueDays: string[]): number => {
    if (uniqueDays.length === 0) return 0;
    
    const sortedDays = uniqueDays.sort();
    let streak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < sortedDays.length; i++) {
      const prevDate = new Date(sortedDays[i - 1]);
      const currDate = new Date(sortedDays[i]);
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (diffDays === 1) {
        currentStreak++;
        streak = Math.max(streak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return streak;
  };

  const calculateWeeklyProgress = (sessions: StudySessionData[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = days.map(day => ({ day, sessions: 0, accuracy: 0 }));
    
    const dayGroups = sessions.reduce((acc, session) => {
      const dayIndex = session.date.getDay();
      if (!acc[dayIndex]) acc[dayIndex] = [];
      acc[dayIndex].push(session);
      return acc;
    }, {} as Record<number, StudySessionData[]>);
    
    Object.entries(dayGroups).forEach(([dayIndex, daySessions]) => {
      const index = parseInt(dayIndex);
      weeklyData[index].sessions = daySessions.length;
      weeklyData[index].accuracy = Math.round(
        daySessions.reduce((sum, s) => sum + s.accuracy, 0) / daySessions.length
      );
    });
    
    return weeklyData;
  };

  const calculateAccuracyTrend = (sessions: StudySessionData[]) => {
    const dailyGroups = sessions.reduce((acc, session) => {
      const dateKey = session.date.toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(session);
      return acc;
    }, {} as Record<string, StudySessionData[]>);
    
    return Object.entries(dailyGroups)
      .map(([date, daySessions]) => ({
        date,
        accuracy: Math.round(daySessions.reduce((sum, s) => sum + s.accuracy, 0) / daySessions.length)
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days
  };

  const calculateDifficultyBreakdown = (sessions: StudySessionData[]) => {
    const difficulties = ['easy', 'medium', 'hard'];
    return difficulties.map(difficulty => {
      const difficultySessions = sessions.filter(s => s.difficulty === difficulty);
      return {
        difficulty,
        count: difficultySessions.length,
        avgAccuracy: difficultySessions.length > 0 
          ? Math.round(difficultySessions.reduce((sum, s) => sum + s.accuracy, 0) / difficultySessions.length)
          : 0
      };
    }).filter(d => d.count > 0);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400">No study data available yet. Start studying to see your progress!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Study Dashboard
        </h2>
        <div className="flex space-x-2">
          {(['week', 'month', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {range === 'all' ? 'All Time' : `Past ${range.charAt(0).toUpperCase() + range.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sessions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Verses Studied</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalVersesStudied}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Accuracy</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.averageAccuracy}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Time Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatTime(stats.totalTimeSpent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Progress Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Weekly Activity
          </h3>
          <div className="space-y-3">
            {stats.weeklyProgress.map((day) => (
              <div key={day.day} className="flex items-center">
                <div className="w-12 text-sm text-gray-600 dark:text-gray-400">{day.day}</div>
                <div className="flex-1 mx-3">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (day.sessions / Math.max(...stats.weeklyProgress.map(d => d.sessions), 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                  {day.sessions} sessions
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Accuracy Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Accuracy Trend (Last 7 Days)
          </h3>
          <div className="space-y-3">
            {stats.accuracyTrend.length > 0 ? stats.accuracyTrend.map((item, index) => (
              <div key={item.date} className="flex items-center">
                <div className="w-16 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        item.accuracy >= 80 ? 'bg-green-500' : 
                        item.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${item.accuracy}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-12 text-sm text-gray-600 dark:text-gray-400 text-right">
                  {item.accuracy}%
                </div>
              </div>
            )) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No recent activity to display
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Difficulty Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Difficulty Breakdown
          </h3>
          <div className="space-y-4">
            {stats.difficultyBreakdown.length > 0 ? stats.difficultyBreakdown.map((item) => (
              <div key={item.difficulty} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    item.difficulty === 'easy' ? 'bg-green-500' :
                    item.difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {item.difficulty}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.count} sessions
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {item.avgAccuracy}% avg
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No difficulty data available
              </p>
            )}
          </div>
        </div>

        {/* Study Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Study Insights
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Favorite Mode:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                {stats.favoriteMode === 'fill-in-blank' ? 'Fill in Blanks' : 'Flashcard'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Study Streak:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {stats.streakDays} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Session Time:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {stats.totalSessions > 0 ? formatTime(Math.round(stats.totalTimeSpent / stats.totalSessions)) : '0m'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Verses per Session:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {stats.totalSessions > 0 ? Math.round(stats.totalVersesStudied / stats.totalSessions) : 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
