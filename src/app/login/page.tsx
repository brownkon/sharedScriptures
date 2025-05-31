"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useFirebase } from "../providers";

export default function LoginPage() {
  const router = useRouter();
  const { auth, db, user, loading } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push("/scriptures");
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        // Save user to Firestore
        await saveUserToFirestore(result.user);
        console.log("Login successful");
        router.push("/scriptures");
      } else {
        setError("Failed to sign in. Please try again.");
      }
    } catch (err) {
      console.error("Error signing in:", err);
      setError("An error occurred while signing in.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save user information to Firestore
  const saveUserToFirestore = async (user: any) => {
    if (!user) return;
    
    const userRef = doc(db, "user_data", user.uid);
    
    // Check if user document already exists
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user document
      await setDoc(userRef, {
        displayName: user.displayName || "Anonymous User",
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date(),
        lastLogin: new Date()
      });
    } else {
      // Update last login time
      await setDoc(userRef, {
        lastLogin: new Date()
      }, { merge: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Scripture Study</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to mark scriptures and share with others</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
        >
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            By signing in, you'll be able to save annotations and share them with others.
          </p>
        </div>
      </div>
    </div>
  );
} 