"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface ReadingDay {
  date: string; // YYYY-MM-DD format
  versesRead: number;
  annotationsCount: number;
}

interface CalendarProps {
  onDateSelect?: (date: string) => void;
}

export default function ReadingCalendar({ onDateSelect }: CalendarProps) {
  const { db, user } = useFirebase();
  const [readingDays, setReadingDays] = useState<Map<string, ReadingDay>>(new Map());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get reading activity data
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Query annotations to determine reading days
    const annotationsQuery = query(
      collection(db, 'annotations'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(annotationsQuery, (snapshot) => {
      const readingData = new Map<string, ReadingDay>();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || new Date();
        const dateKey = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (readingData.has(dateKey)) {
          const existing = readingData.get(dateKey)!;
          existing.annotationsCount += 1;
        } else {
          readingData.set(dateKey, {
            date: dateKey,
            versesRead: 1, // Assuming each annotation represents reading activity
            annotationsCount: 1,
          });
        }
      });

      setReadingDays(readingData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateClick = (date: Date) => {
    const dateKey = formatDateKey(date);
    setSelectedDate(dateKey);
    onDateSelect?.(dateKey);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    const today = formatDateKey(new Date());
    setSelectedDate(today);
    onDateSelect?.(today);
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = formatDateKey(new Date());
  const totalReadingDays = readingDays.size;
  const totalAnnotations = Array.from(readingDays.values()).reduce((sum, day) => sum + day.annotationsCount, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Reading Calendar
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track your daily scripture reading
          </p>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {totalReadingDays}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            Days Read
          </div>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalAnnotations}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Annotations
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {dayNames.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="p-2"></div>;
          }
          
          const dateKey = formatDateKey(day);
          const readingDay = readingDays.get(dateKey);
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDate;
          const hasReading = !!readingDay;
          
          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(day)}
              className={`
                p-2 text-sm rounded-lg transition-colors relative
                ${isToday ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'bg-blue-500 text-white' : ''}
                ${!isSelected && hasReading ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : ''}
                ${!isSelected && !hasReading ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                ${!isSelected && isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
              `}
              title={hasReading ? `${readingDay.annotationsCount} annotations` : 'No reading recorded'}
            >
              <span className="block">{day.getDate()}</span>
              {hasReading && (
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full transform translate-x-1 translate-y-1"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && readingDays.has(selectedDate) && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {readingDays.get(selectedDate)!.annotationsCount} annotations created
          </p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-lg">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      )}
    </div>
  );
}
