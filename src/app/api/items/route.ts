import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

const COLLECTION = "inputs";

// GET: return list of items
export async function GET() {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// POST: add one item
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const value = (body.value ?? "").toString().trim();

    if (!value) {
      return NextResponse.json(
        { error: "Value is required" },
        { status: 400 }
      );
    }

    const ref = await addDoc(collection(db, COLLECTION), {
      value,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: ref.id, value });
  } catch (error) {
    console.error("POST /api/items error:", error);
    return NextResponse.json(
      { error: "Failed to add item" },
      { status: 500 }
    );
  }
}
