"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Save,
  Users,
} from "lucide-react";

type Mode = "admin" | "staff";

interface StaffEntry {
  id: string;
  staffName: string;

  // Money flows
  agentParcels: number[]; // Assigned to PC/agents at start
  additionalBalanceOnly: number[]; // Extra for this balance (yesterday)
  additionalTodayWins: number[]; // New agent wins for tomorrow (entered while balancing this date)

  previousBalance: number; // PC claim balance before starting
  mailAmount: number; // Mail to board amount (reduces)
  returnClaims: number; // Returned claims (reduces)
  actualClosingBalance: number; // What staff tells you at the end

  // UI-only draft inputs
  agentDraft?: string;
  additionalBalanceDraft?: string;
  additionalTodayDraft?: string;
}

interface StaffEntryPayload {
  id: string;
  staffName: string;
  agentParcels: number[];
  additionalBalanceOnly: number[];
  additionalTodayWins: number[];
  previousBalance: number;
  mailAmount: number;
  returnClaims: number;
  actualClosingBalance: number;
}

interface DailyClaim {
  date: string;
  totalAgentClaim: number; // daily target for "today wins"
  staffEntries: StaffEntryPayload[];
}

export default function LotteryClaimsManager() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [mode, setMode] = useState<Mode>("staff");
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  const [totalAgentClaim, setTotalAgentClaim] = useState<string>("");
  const [staffEntries, setStaffEntries] = useState<StaffEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin password prompt
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Admin password change form
  const [currentPassInput, setCurrentPassInput] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmNewPassInput, setConfirmNewPassInput] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] =
    useState<string | null>(null);

  // Brought forward wins from yesterday (for information)
  // key = staffName, value = sum of yesterday.additionalTodayWins
  const [broughtForwardWins, setBroughtForwardWins] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    loadDateData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const normalizeStaffEntry = (
    entry: Partial<StaffEntryPayload> & {
      closingBalance?: number;
      additionalScans?: number[];
    }
  ): StaffEntry => {
    const agentParcels: number[] = entry.agentParcels || [];

    // Backwards compatibility: old "additionalScans" are treated as "for this balance"
    const additionalBalanceOnly: number[] =
      entry.additionalBalanceOnly || entry.additionalScans || [];

    const additionalTodayWins: number[] = entry.additionalTodayWins || [];

    const previousBalance =
      typeof entry.previousBalance === "number" ? entry.previousBalance : 0;

    const mailAmount =
      typeof entry.mailAmount === "number" ? entry.mailAmount : 0;

    const returnClaims =
      typeof entry.returnClaims === "number" ? entry.returnClaims : 0;

    const actualClosingBalance =
      typeof entry.actualClosingBalance === "number"
        ? entry.actualClosingBalance
        : typeof entry.closingBalance === "number"
        ? entry.closingBalance
        : 0;

    return {
      id: entry.id?.toString() ?? Date.now().toString(),
      staffName: entry.staffName || "",
      agentParcels,
      additionalBalanceOnly,
      additionalTodayWins,
      previousBalance,
      mailAmount,
      returnClaims,
      actualClosingBalance,
      agentDraft: "",
      additionalBalanceDraft: "",
      additionalTodayDraft: "",
    };
  };

  const loadDateData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Load current selected date document
      const res = await fetch(`/api/claims?date=${selectedDate}`);
      const data = await res.json();

      if (data.claim) {
        setTotalAgentClaim((data.claim.totalAgentClaim ?? "").toString());
        const entries = (data.claim.staffEntries || []).map((e: unknown) =>
          normalizeStaffEntry(
            e as Partial<StaffEntryPayload> & {
              closingBalance?: number;
              additionalScans?: number[];
            }
          )
        );
        setStaffEntries(entries);
      } else {
        setTotalAgentClaim("");
        setStaffEntries([]);
      }

      // 2) Load PREVIOUS date to show brought-forward "today wins"
      const current = new Date(selectedDate);
      if (isNaN(current.getTime())) {
        setBroughtForwardWins({});
      } else {
        const prev = new Date(current);
        prev.setDate(prev.getDate() - 1);
        const prevStr = prev.toISOString().split("T")[0];

        try {
          const prevRes = await fetch(`/api/claims?date=${prevStr}`);
          const prevData = await prevRes.json();

          if (prevData.claim && Array.isArray(prevData.claim.staffEntries)) {
            const map: Record<string, number> = {};

            for (const rawEntry of prevData.claim.staffEntries) {
              const e = rawEntry as Partial<StaffEntryPayload>;
              const name = (e.staffName || "").toString();
              if (!name) continue;

              const arr = (e.additionalTodayWins || []) as number[];
              const sum = arr.reduce(
                (s, v) => s + (typeof v === "number" ? v : 0),
                0
              );

              if (sum > 0) {
                map[name] = (map[name] || 0) + sum;
              }
            }

            setBroughtForwardWins(map);
          } else {
            setBroughtForwardWins({});
          }
        } catch {
          setBroughtForwardWins({});
        }
      }
    } catch (err) {
      setError("Failed to load data for selected date");
      setBroughtForwardWins({});
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payloadStaffEntries: StaffEntryPayload[] = staffEntries.map(
        (entry) => ({
          id: entry.id,
          staffName: entry.staffName,
          agentParcels: entry.agentParcels.filter(
            (p) => !isNaN(p) && p > 0
          ),
          additionalBalanceOnly: entry.additionalBalanceOnly.filter(
            (p) => !isNaN(p) && p > 0
          ),
          additionalTodayWins: entry.additionalTodayWins.filter(
            (p) => !isNaN(p) && p > 0
          ),
          previousBalance: entry.previousBalance || 0,
          mailAmount: entry.mailAmount || 0,
          returnClaims: entry.returnClaims || 0,
          actualClosingBalance: entry.actualClosingBalance || 0,
        })
      );

      const claimData: DailyClaim = {
        date: selectedDate,
        totalAgentClaim: parseFloat(totalAgentClaim) || 0,
        staffEntries: payloadStaffEntries,
      };

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimData),
      });

      if (!res.ok) throw new Error("Failed to save");

      setSuccess("Data saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  // ---------- ADMIN / STAFF MODE + PASSWORD ----------

  const handleModeChange = (newMode: Mode) => {
    if (newMode === "admin") {
      if (isAdminUnlocked) {
        setMode("admin");
      } else {
        setPasswordInput("");
        setPasswordError(null);
        setShowPasswordPrompt(true);
      }
    } else {
      setMode("staff");
    }
  };

  const handleConfirmAdminPassword = async () => {
    try {
      setPasswordError(null);

      const res = await fetch("/api/admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          password: passwordInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Failed to verify password");
        return;
      }

      if (data.valid) {
        setIsAdminUnlocked(true);
        setMode("admin");
        setShowPasswordPrompt(false);
        setPasswordInput("");
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setPasswordError("Error contacting server");
    }
  };

  // ---------- STAFF ENTRY HELPERS ----------

  const addStaffMember = () => {
    const newStaff: StaffEntry = {
      id: Date.now().toString(),
      staffName: "",
      agentParcels: [],
      additionalBalanceOnly: [],
      additionalTodayWins: [],
      previousBalance: 0,
      mailAmount: 0,
      returnClaims: 0,
      actualClosingBalance: 0,
      agentDraft: "",
      additionalBalanceDraft: "",
      additionalTodayDraft: "",
    };
    setStaffEntries((prev) => [...prev, newStaff]);
  };

  const removeStaffMember = (id: string) => {
    setStaffEntries((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStaffName = (id: string, name: string) => {
    setStaffEntries((prev) =>
      prev.map((s) => (s.id === id ? { ...s, staffName: name } : s))
    );
  };

  const updateStaffNumberField = (
    id: string,
    field:
      | "previousBalance"
      | "mailAmount"
      | "returnClaims"
      | "actualClosingBalance",
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setStaffEntries((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: numValue } : s
      )
    );
  };

  const updateDraft = (
    id: string,
    type: "agent" | "additionalBalance" | "additionalToday",
    value: string
  ) => {
    setStaffEntries((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (type === "agent") return { ...s, agentDraft: value };
        if (type === "additionalBalance")
          return { ...s, additionalBalanceDraft: value };
        return { ...s, additionalTodayDraft: value };
      })
    );
  };

  const addValueFromDraft = (
    id: string,
    type: "agent" | "additionalBalance" | "additionalToday"
  ) => {
    setStaffEntries((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        const draftValue =
          type === "agent"
            ? s.agentDraft
            : type === "additionalBalance"
            ? s.additionalBalanceDraft
            : s.additionalTodayDraft;

        if (!draftValue || draftValue.trim() === "") return s;

        const amount = parseFloat(draftValue);
        if (isNaN(amount) || amount <= 0) {
          if (type === "agent") return { ...s, agentDraft: "" };
          if (type === "additionalBalance")
            return { ...s, additionalBalanceDraft: "" };
          return { ...s, additionalTodayDraft: "" };
        }

        if (type === "agent") {
          return {
            ...s,
            agentParcels: [...s.agentParcels, amount],
            agentDraft: "",
          };
        }
        if (type === "additionalBalance") {
          return {
            ...s,
            additionalBalanceOnly: [...s.additionalBalanceOnly, amount],
            additionalBalanceDraft: "",
          };
        }
        // additionalToday
        return {
          ...s,
          additionalTodayWins: [...s.additionalTodayWins, amount],
          additionalTodayDraft: "",
        };
      })
    );
  };

  const removeValue = (
    id: string,
    type: "agent" | "additionalBalance" | "additionalToday",
    index: number
  ) => {
    setStaffEntries((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (type === "agent") {
          return {
            ...s,
            agentParcels: s.agentParcels.filter((_, i) => i !== index),
          };
        }
        if (type === "additionalBalance") {
          return {
            ...s,
            additionalBalanceOnly: s.additionalBalanceOnly.filter(
              (_, i) => i !== index
            ),
          };
        }
        return {
          ...s,
          additionalTodayWins: s.additionalTodayWins.filter(
            (_, i) => i !== index
          ),
        };
      })
    );
  };

  const calculateStaffTotals = (staff: StaffEntry) => {
    const agentSum = staff.agentParcels.reduce((sum, p) => sum + p, 0);
    const extraBalanceSum = staff.additionalBalanceOnly.reduce(
      (sum, p) => sum + p,
      0
    );
    const todayWinsSum = staff.additionalTodayWins.reduce(
      (sum, p) => sum + p,
      0
    );

    // Wins for this balance (includes today's wins also)
    const winsForBalance = agentSum + extraBalanceSum + todayWinsSum;

    // System predicted closing for this balance
    const predictedClosing =
      (staff.previousBalance || 0) +
      winsForBalance -
      (staff.mailAmount || 0) -
      (staff.returnClaims || 0);

    const actualClosing = staff.actualClosingBalance || 0;
    const balanceDiff = actualClosing - predictedClosing;

    // Assigned scanned value from assigned parcels only
    // assignedScanned = mail + closing - previous - returns - extra - todayWins
    const assignedScanned =
      (staff.mailAmount || 0) +
      (staff.actualClosingBalance || 0) -
      (staff.previousBalance || 0) -
      (staff.returnClaims || 0) -
      extraBalanceSum -
      todayWinsSum;

    return {
      agentSum,
      extraBalanceSum,
      todayWinsSum,
      winsForBalance,
      predictedClosing,
      actualClosing,
      balanceDiff,
      assignedScanned,
    };
  };

  // ----------- TOTALS FOR DAILY SUMMARY -----------

  // Total assigned scanned (from parcels only) across all staff
  const totalAssignedScannedForTarget = staffEntries.reduce((sum, staff) => {
    const totals = calculateStaffTotals(staff);
    return sum + totals.assignedScanned;
  }, 0);

  // This is the value you want to compare with ERP target
  const totalWinsForTarget = totalAssignedScannedForTarget;

  const targetAmount = parseFloat(totalAgentClaim) || 0;
  const difference = totalWinsForTarget - targetAmount;
  const isBalanced = Math.abs(difference) < 0.01;

  // ---------- RENDER ----------

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Lottery Claims Management System
            </h1>
            <p className="text-slate-400 text-sm">
              Assign parcels, track daily agent wins, and match staff balances.
            </p>
          </div>

          {/* MODE TOGGLE */}
          <div className="inline-flex rounded-xl bg-slate-800/70 border border-slate-700 p-1">
            <button
              onClick={() => handleModeChange("admin")}
              className={`px-4 py-2 text-sm rounded-lg ${
                mode === "admin"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-700/70"
              }`}
            >
              Admin View
            </button>
            <button
              onClick={() => handleModeChange("staff")}
              className={`px-4 py-2 text-sm rounded-lg ${
                mode === "staff"
                  ? "bg-cyan-600 text-white"
                  : "text-slate-300 hover:bg-slate-700/70"
              }`}
            >
              Staff View
            </button>
          </div>
        </div>

        {/* DATE + TARGET */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-3">
              <Calendar className="w-4 h-4 text-blue-400" />
              Select Balance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700"
            />
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <label className="text-sm text-slate-300 mb-3 block">
              Today&apos;s Agent Wins Target (Rs.)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalAgentClaim}
              onChange={(e) =>
                mode === "admin" && setTotalAgentClaim(e.target.value)
              }
              disabled={mode === "staff"}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-60"
              placeholder="Enter today's total wins target..."
            />
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-950/40 border border-green-800 rounded-xl p-4 mb-6 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* STAFF SECTION */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Staff Members
            </h2>
            {mode === "admin" && (
              <button
                onClick={addStaffMember}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                <Plus className="w-4 h-4" />
                Add Staff
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-center text-slate-400 py-8">Loading...</p>
          ) : staffEntries.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              No staff added.{" "}
              {mode === "admin" && 'Click "Add Staff" to begin.'}
            </p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {staffEntries.map((staff) => {
                const totals = calculateStaffTotals(staff);
                const carriedForToday =
                  broughtForwardWins[staff.staffName] || 0;

                return (
                  <div
                    key={staff.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-5"
                  >
                    {/* STAFF NAME + REMOVE */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={staff.staffName}
                        onChange={(e) =>
                          mode === "admin" &&
                          updateStaffName(staff.id, e.target.value)
                        }
                        disabled={mode === "staff"}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 disabled:opacity-60"
                        placeholder="Staff name..."
                      />
                      {mode === "admin" && (
                        <button
                          onClick={() => removeStaffMember(staff.id)}
                          className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* BALANCE FIELDS */}
                    <div className="grid md:grid-cols-4 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Previous Claim Balance (Rs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={staff.previousBalance || ""}
                          onChange={(e) =>
                            mode === "admin" &&
                            updateStaffNumberField(
                              staff.id,
                              "previousBalance",
                              e.target.value
                            )
                          }
                          disabled={mode === "staff"}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Mail to Board (Rs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={staff.mailAmount || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "mailAmount",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Return Claims (Rs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={staff.returnClaims || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "returnClaims",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Actual Closing Balance (Rs.)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={staff.actualClosingBalance || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "actualClosingBalance",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                        />
                      </div>
                    </div>

                    {/* PARCELS / ADDITIONALS */}
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* AGENT PARCELS */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-2">
                          Agent Parcels Assigned (Rs.)
                        </label>

                        {mode === "admin" && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={staff.agentDraft ?? ""}
                            onChange={(e) =>
                              updateDraft(
                                staff.id,
                                "agent",
                                e.target.value
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addValueFromDraft(staff.id, "agent");
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 mb-2"
                            placeholder="Type amount and press Enter..."
                          />
                        )}

                        <div className="flex flex-wrap gap-2">
                          {staff.agentParcels.map((parcel, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-slate-600 text-xs"
                            >
                              <span>Rs. {parcel.toFixed(2)}</span>
                              {mode === "admin" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeValue(staff.id, "agent", idx)
                                  }
                                  className="text-slate-400 hover:text-red-400"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                          Sum:{" "}
                          <span className="text-green-400 font-mono">
                            Rs. {totals.agentSum.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* ADDITIONAL FOR THIS BALANCE */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-2">
                          Additional (for this balance) (Rs.)
                        </label>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={staff.additionalBalanceDraft ?? ""}
                          onChange={(e) =>
                            updateDraft(
                              staff.id,
                              "additionalBalance",
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addValueFromDraft(
                                staff.id,
                                "additionalBalance"
                              );
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 mb-2"
                          placeholder="Type amount and press Enter..."
                        />

                        <div className="flex flex-wrap gap-2">
                          {staff.additionalBalanceOnly.map((parcel, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-slate-600 text-xs"
                            >
                              <span>Rs. {parcel.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  removeValue(
                                    staff.id,
                                    "additionalBalance",
                                    idx
                                  )
                                }
                                className="text-slate-400 hover:text-red-400"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                          Sum:{" "}
                          <span className="text-cyan-400 font-mono">
                            Rs. {totals.extraBalanceSum.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* TODAY'S AGENT WINS (for tomorrow) */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-2">
                          Today&apos;s Agent Wins (balance tomorrow) (Rs.)
                        </label>

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={staff.additionalTodayDraft ?? ""}
                          onChange={(e) =>
                            updateDraft(
                              staff.id,
                              "additionalToday",
                              e.target.value
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addValueFromDraft(
                                staff.id,
                                "additionalToday"
                              );
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 mb-2"
                          placeholder="Type amount and press Enter..."
                        />

                        <div className="flex flex-wrap gap-2">
                          {staff.additionalTodayWins.map((parcel, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-slate-600 text-xs"
                            >
                              <span>Rs. {parcel.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  removeValue(
                                    staff.id,
                                    "additionalToday",
                                    idx
                                  )
                                }
                                className="text-slate-400 hover:text-red-400"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                          Sum (Tomorrow Wins):{" "}
                          <span className="text-amber-300 font-mono">
                            Rs. {totals.todayWinsSum.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PREDICTED VS ACTUAL CLOSING + WINS INFO */}
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">
                          Wins for this balance (assigned + additional + today
                          wins)
                        </span>
                        <span className="text-lg font-bold font-mono text-cyan-400">
                          Rs. {totals.winsForBalance.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Calculation: Rs. {totals.agentSum.toFixed(2)} (assigned)
                        {" + "}
                        Rs. {totals.extraBalanceSum.toFixed(2)} (additional for
                        this balance)
                        {" + "}
                        Rs. {totals.todayWinsSum.toFixed(2)} (today&apos;s agent
                        wins during this session)
                      </p>

                      <div className="mt-3 grid md:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-slate-400 mb-1">
                            Predicted Closing Balance
                          </div>
                          <div className="font-mono text-green-300">
                            Rs. {totals.predictedClosing.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-slate-400 mb-1">
                            Actual Closing Balance
                          </div>
                          <div className="font-mono text-blue-300">
                            Rs. {totals.actualClosing.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-2">
                          <div className="text-slate-400 mb-1">
                            Difference (Actual - Predicted)
                          </div>
                          <div
                            className={
                              "font-mono " +
                              (Math.abs(totals.balanceDiff) < 0.01
                                ? "text-green-400"
                                : "text-red-400")
                            }
                          >
                            Rs. {totals.balanceDiff.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-400">
                        Brought forward wins (from yesterday) for this staff:{" "}
                        <span className="font-mono text-emerald-300">
                          Rs. {carriedForToday.toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Assigned scanned from parcels only (for target):{" "}
                        <span className="font-mono text-lime-300">
                          Rs. {totals.assignedScanned.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DAILY SUMMARY */}
        <div className="bg-gradient-to-r from-slate-900/80 to-blue-900/30 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Daily Summary</h2>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Today&apos;s Target</p>
              <p className="text-2xl font-bold font-mono text-blue-400">
                Rs. {targetAmount.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">
                Total Today Agent Wins (for target)
              </p>
              <p className="text-2xl font-bold font-mono text-cyan-400">
                Rs. {totalWinsForTarget.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                = Sum of each staff&apos;s{" "}
                <span className="font-mono">assigned scanned from parcels</span>.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Difference</p>
              <p
                className={`text-2xl font-bold font-mono ${
                  isBalanced
                    ? "text-green-400"
                    : difference > 0
                    ? "text-orange-400"
                    : "text-red-400"
                }`}
              >
                {difference >= 0 ? "+" : ""}Rs. {difference.toFixed(2)}
              </p>
            </div>
          </div>

          {!isBalanced && targetAmount > 0 && (
            <div className="bg-yellow-950/30 border border-yellow-700 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <p className="text-yellow-200 text-sm">
                Target mismatch. Difference: Rs.{" "}
                {Math.abs(difference).toFixed(2)}. Check staff balances and
                assigned scanned values.
              </p>
            </div>
          )}

          {isBalanced && targetAmount > 0 && (
            <div className="bg-green-950/30 border border-green-700 rounded-lg p-4 flex gap-3">
              <div className="bg-green-500 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs">
                ✓
              </div>
              <p className="text-green-400 text-sm">
                Perfect. Sum of assigned scanned from parcels matches today&apos;s
                target.
              </p>
            </div>
          )}
        </div>

        {/* ADMIN PASSWORD SETTINGS */}
        {mode === "admin" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 mb-6">
            <h3 className="text-lg font-semibold mb-3">
              Admin Password Settings
            </h3>

            <div className="grid md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassInput}
                  onChange={(e) => setConfirmNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setPasswordChangeMessage(null);

                  if (!newPassInput) {
                    setPasswordChangeMessage(
                      "New password cannot be empty."
                    );
                    return;
                  }
                  if (newPassInput !== confirmNewPassInput) {
                    setPasswordChangeMessage(
                      "New password and confirmation do not match."
                    );
                    return;
                  }

                  try {
                    const res = await fetch("/api/admin-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        mode: "change",
                        currentPassword: currentPassInput || null,
                        newPassword: newPassInput,
                      }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                      setPasswordChangeMessage(
                        data.error || "Failed to update password."
                      );
                      return;
                    }

                    setCurrentPassInput("");
                    setNewPassInput("");
                    setConfirmNewPassInput("");
                    setPasswordChangeMessage(
                      "Admin password updated successfully."
                    );
                  } catch (err) {
                    setPasswordChangeMessage("Error contacting server.");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm"
              >
                Update Password
              </button>

              {passwordChangeMessage && (
                <span className="text-xs text-slate-300">
                  {passwordChangeMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* SAVE BUTTON */}
        <div className="flex justify-center">
          <button
            onClick={saveData}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:bg-blue-500 disabled:opacity-60"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Data"}
          </button>
        </div>
      </div>

      {/* ADMIN PASSWORD PROMPT MODAL */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Enter Admin Password</h3>

            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmAdminPassword();
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 mb-3"
              placeholder="Admin password"
            />

            {passwordError && (
              <p className="text-xs text-red-400 mb-3">{passwordError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPasswordInput("");
                  setPasswordError(null);
                }}
                className="px-3 py-2 rounded-lg bg-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdminPassword}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
