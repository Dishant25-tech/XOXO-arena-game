'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// This pattern prevents re-initialization on both server and client.
const firebaseApp: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  // The initializeApp function is now called at the module level above.
  // This function simply returns the SDKs for the initialized app.
  return getSdks(firebaseApp);
}

export function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
