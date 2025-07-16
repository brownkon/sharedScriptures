"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ScriptureReader from '../components/ScriptureReader';
import { useFirebase } from '../providers';

export default function ScripturesPage() {
  const router = useRouter();
  const { user, loading } = useFirebase();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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
        <ScriptureReader />
      </div>
    </div>
  );
}
