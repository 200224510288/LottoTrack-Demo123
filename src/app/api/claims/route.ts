// app/api/claims/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

const COLLECTION = "dailyClaims";

// GET: Load data for a specific date
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  try {
    const docRef = doc(db, COLLECTION, date);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return NextResponse.json({ claim: docSnap.data() });
    } else {
      return NextResponse.json({ claim: null });
    }
  } catch (error) {
    console.error("GET /api/claims error:", error);
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}

// POST: Save data for a specific date
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, totalAgentClaim, staffEntries } = body;

    if (!date) {
      return NextResponse.json({ error: "Date required" }, { status: 400 });
    }

    const docRef = doc(db, COLLECTION, date);

    await setDoc(docRef, {
      date,
      totalAgentClaim,
      staffEntries,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/claims error:", error);
    return NextResponse.json(
      { error: "Failed to save claims" },
      { status: 500 }
    );
  }
}
