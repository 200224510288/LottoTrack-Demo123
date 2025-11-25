// app/api/admin-password/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_COLLECTION = "settings";
const ADMIN_DOC_ID = "adminConfig";

/**
 * GET /api/admin-password
 * -> returns whether a password exists
 */
export async function GET() {
  try {
    const docRef = doc(collection(db, SETTINGS_COLLECTION), ADMIN_DOC_ID);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ hasPassword: false });
    }

    const data = snap.data();
    const hasPassword = !!data.adminPassword;

    return NextResponse.json({ hasPassword });
  } catch (error) {
    console.error("GET /api/admin-password error:", error);
    return NextResponse.json(
      { error: "Failed to load admin password status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin-password
 *
 * Body for verify:
 *  { "mode": "verify", "password": "xxxx" }
 *
 * Body for change:
 *  { "mode": "change", "currentPassword": "old", "newPassword": "new" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode as "verify" | "change";

    const docRef = doc(collection(db, SETTINGS_COLLECTION), ADMIN_DOC_ID);
    const snap = await getDoc(docRef);
    const existingData = snap.exists() ? snap.data() : {};
    const storedPassword = (existingData.adminPassword ?? "") as string;

    // VERIFY
    if (mode === "verify") {
      const { password } = body;
      if (!password) {
        return NextResponse.json(
          { error: "Password required" },
          { status: 400 }
        );
      }

      const isValid = password === storedPassword;
      return NextResponse.json({ valid: isValid });
    }

    // CHANGE / SET
    if (mode === "change") {
      const { currentPassword, newPassword } = body;

      if (!newPassword) {
        return NextResponse.json(
          { error: "New password required" },
          { status: 400 }
        );
      }

      // If password already exists, verify currentPassword
      if (storedPassword) {
        if (!currentPassword || currentPassword !== storedPassword) {
          return NextResponse.json(
            { error: "Current password incorrect" },
            { status: 403 }
          );
        }
      }

      await setDoc(docRef, {
        adminPassword: newPassword,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/admin-password error:", error);
    return NextResponse.json(
      { error: "Failed to process admin password request" },
      { status: 500 }
    );
  }
}
