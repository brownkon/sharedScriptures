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
    console.log("Scriptures page auth state:", { user, loading });
    if (!loading && !user) {
      console.log("User not authenticated, redirecting to login");
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p>You need to log in to view scriptures.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <ScriptureReader />
    </div>
  );
} 