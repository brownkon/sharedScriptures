"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface HighlightContextType {
  needsSync: boolean;
  setNeedsSync: (value: boolean) => void;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  localHighlights: LocalHighlights;
  setLocalHighlights: React.Dispatch<React.SetStateAction<LocalHighlights>>;
}

interface HighlightedWord {
  id?: string;
  verseId: string;
  startIndex: number;
  endIndex: number;
  color: string;
  userId: string;
}

interface LocalHighlights {
  [verseId: string]: HighlightedWord[];
}

const HighlightContext = createContext<HighlightContextType | undefined>(undefined);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [needsSync, setNeedsSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localHighlights, setLocalHighlights] = useState<LocalHighlights>({});

  return (
    <HighlightContext.Provider value={{ 
      needsSync, 
      setNeedsSync, 
      isSyncing, 
      setIsSyncing,
      localHighlights,
      setLocalHighlights
    }}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (context === undefined) {
    throw new Error('useHighlight must be used within a HighlightProvider');
  }
  return context;
} 