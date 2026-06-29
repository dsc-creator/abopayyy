import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  runTransaction,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const generateAccountNumber = () =>
  "0" + Math.floor(Math.random() * 9000000000 + 1000000000);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email, password, fullName, phone) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: fullName });
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      fullName,
      email,
      phone,
      balance: 0,
      savingsBalance: 0,
      accountNumber: generateAccountNumber(),
      createdAt: new Date().toISOString(),
      transactions: [],
    });
    return result;
  };

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    const userRef = doc(db, "users", result.user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: result.user.uid,
        fullName: result.user.displayName || "",
        email: result.user.email || "",
        phone: result.user.phoneNumber || "",
        balance: 0,
        savingsBalance: 0,
        accountNumber: generateAccountNumber(),
        createdAt: new Date().toISOString(),
        transactions: [],
      });
    }
    return result;
  };

  const logout = () => signOut(auth);

  const fetchUserData = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) setUserData(snap.data());
  };

  /**
   * Credit wallet after a verified Paystack deposit.
   * Uses a Firestore transaction to read-then-write atomically,
   * preventing stale-state race conditions.
   */
  const creditBalance = async (amount, reference) => {
    if (!user) throw new Error("Not authenticated");
    const userRef = doc(db, "users", user.uid);

    const newTx = {
      id: reference,
      type: "credit",
      title: "Wallet Deposit",
      amount,
      date: new Date().toISOString(),
      category: "💳",
      reference,
    };

    let newBalance;
    await runTransaction(db, async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists()) throw new Error("User document not found");

      const current = snap.data();
      newBalance = (current.balance || 0) + amount;

      // Prevent duplicate: skip if reference already exists in transactions
      const existing = (current.transactions || []);
      const alreadyRecorded = existing.some((tx) => tx.reference === reference);
      if (alreadyRecorded) {
        newBalance = current.balance; // no change
        return;
      }

      // Keep latest 200 transactions in the array (trim oldest)
      const updated = [newTx, ...existing].slice(0, 200);

      t.update(userRef, {
        balance: newBalance,
        transactions: updated,
      });
    });

    // Sync local state after Firestore write
    await fetchUserData(user.uid);
  };

  /**
   * Debit wallet for a payment.
   * Uses a Firestore transaction to ensure we never debit more than the
   * actual server-side balance (prevents double-spend if two tabs are open).
   */
  const debitBalance = async (amount, title, category, reference, meta = {}) => {
    if (!user) throw new Error("Not authenticated");
    const userRef = doc(db, "users", user.uid);

    const newTx = {
      id: reference,
      type: "debit",
      title,
      amount,
      date: new Date().toISOString(),
      category,
      reference,
      ...meta,
    };

    await runTransaction(db, async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists()) throw new Error("User document not found");

      const current = snap.data();
      const currentBalance = current.balance || 0;

      if (currentBalance < amount) {
        throw new Error("Insufficient balance");
      }

      // Prevent duplicate debit on retry
      const existing = (current.transactions || []);
      const alreadyRecorded = existing.some((tx) => tx.reference === reference);
      if (alreadyRecorded) return;

      const updated = [newTx, ...existing].slice(0, 200);

      t.update(userRef, {
        balance: currentBalance - amount,
        transactions: updated,
      });
    });

    // Sync local state after Firestore write
    await fetchUserData(user.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) await fetchUserData(firebaseUser.uid);
      else setUserData(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        signup,
        login,
        loginWithGoogle,
        logout,
        fetchUserData,
        creditBalance,
        debitBalance,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
