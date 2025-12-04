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

  agentParcels: number[];
  additionalBalanceOnly: number[];
  additionalTodayWins: number[];

  previousBalance: number;
  mailAmount: number;
  returnClaims: number;
  actualClosingBalance: number;

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
  totalAgentClaim: number;
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

  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [currentPassInput, setCurrentPassInput] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmNewPassInput, setConfirmNewPassInput] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] =
    useState<string | null>(null);

  const [broughtForwardWins, setBroughtForwardWins] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    loadDateData();
  }, [selectedDate]);

  const normalizeStaffEntry = (
    entry: Partial<StaffEntryPayload> & {
      closingBalance?: number;
      additionalScans?: number[];
    }
  ): StaffEntry => {
    const agentParcels: number[] = entry.agentParcels || [];
    const additionalBalanceOnly: number[] =
      entry.additionalBalanceOnly || entry.additionalScans || [];
    const additionalTodayWins: number[] = entry.additionalTodayWins || [];

    const previousBalance = entry.previousBalance ?? 0;
    const mailAmount = entry.mailAmount ?? 0;
    const returnClaims = entry.returnClaims ?? 0;
    const actualClosingBalance =
      entry.actualClosingBalance ??
      entry.closingBalance ??
      0;

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
      const res = await fetch(`/api/claims?date=${selectedDate}`);
      const data = await res.json();

      if (data.claim) {
        setTotalAgentClaim((data.claim.totalAgentClaim ?? "").toString());
        setStaffEntries(
          data.claim.staffEntries.map((e: unknown) =>
            normalizeStaffEntry(e as Partial<StaffEntryPayload> & { closingBalance?: number; additionalScans?: number[] })
          )
        );
      } else {
        setTotalAgentClaim("");
        setStaffEntries([]);
      }

      // Load previous date wins
      const current = new Date(selectedDate);
      const prev = new Date(current);
      prev.setDate(prev.getDate() - 1);
      const prevStr = prev.toISOString().split("T")[0];

      try {
        const prevRes = await fetch(`/api/claims?date=${prevStr}`);
        const prevData = await prevRes.json();

        const map: Record<string, number> = {};

        if (prevData.claim && Array.isArray(prevData.claim.staffEntries)) {
          for (const raw of prevData.claim.staffEntries) {
            const e = raw as StaffEntryPayload;
            const sum = (e.additionalTodayWins || []).reduce(
              (s, v) => s + (typeof v === "number" ? v : 0),
              0
            );
            if (sum > 0) map[e.staffName] = sum;
          }
        }

        setBroughtForwardWins(map);
      } catch {
        setBroughtForwardWins({});
      }
    } catch (err) {
      setError("Failed to load data for selected date");
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
          agentParcels: entry.agentParcels.filter((p) => p > 0),
          additionalBalanceOnly: entry.additionalBalanceOnly.filter(
            (p) => p > 0
          ),
          additionalTodayWins: entry.additionalTodayWins.filter(
            (p) => p > 0
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

      if (!res.ok) throw new Error();

      setSuccess("Data saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    if (newMode === "admin") {
      if (isAdminUnlocked) {
        setMode("admin");
      } else {
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

      if (!res.ok || !data.valid) {
        setPasswordError("Incorrect password.");
        return;
      }

      setIsAdminUnlocked(true);
      setMode("admin");
      setShowPasswordPrompt(false);
      setPasswordInput("");
    } catch {
      setPasswordError("Error verifying password");
    }
  };

  const addStaffMember = () => {
    setStaffEntries((prev) => [
      ...prev,
      {
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
      },
    ]);
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
    field: keyof Pick<
      StaffEntry,
      "previousBalance" | "mailAmount" | "returnClaims" | "actualClosingBalance"
    >,
    value: string
  ) => {
    const num = parseFloat(value) || 0;
    setStaffEntries((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: num } : s
      )
    );
  };

  const updateDraft = (
    id: string,
    type: "agent" | "additionalBalance" | "additionalToday",
    value: string
  ) => {
    setStaffEntries((prev) =>
      prev.map((s) =>
        s.id !== id
          ? s
          : {
              ...s,
              [`${type}Draft`]: value,
            }
      )
    );
  };

  const addValueFromDraft = (
    id: string,
    type: "agent" | "additionalBalance" | "additionalToday"
  ) => {
    setStaffEntries((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        const draftField =
          type === "agent"
            ? "agentDraft"
            : type === "additionalBalance"
            ? "additionalBalanceDraft"
            : "additionalTodayDraft";

        const raw = s[draftField] ?? "";
        const amount = parseFloat(raw);

        if (!amount || amount <= 0)
          return { ...s, [draftField]: "" };

        return {
          ...s,
          [draftField]: "",
          [type === "agent"
            ? "agentParcels"
            : type === "additionalBalance"
            ? "additionalBalanceOnly"
            : "additionalTodayWins"]: [
            ...(s[
              type === "agent"
                ? "agentParcels"
                : type === "additionalBalance"
                ? "additionalBalanceOnly"
                : "additionalTodayWins"
            ] || []),
            amount,
          ],
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

        const key =
          type === "agent"
            ? "agentParcels"
            : type === "additionalBalance"
            ? "additionalBalanceOnly"
            : "additionalTodayWins";

        return {
          ...s,
          [key]: s[key].filter((_, i) => i !== index),
        };
      })
    );
  };

  const calculateStaffTotals = (staff: StaffEntry) => {
    const agentSum = staff.agentParcels.reduce((s, v) => s + v, 0);
    const extraSum = staff.additionalBalanceOnly.reduce((s, v) => s + v, 0);
    const todaySum = staff.additionalTodayWins.reduce((s, v) => s + v, 0);

    const winsForBalance = agentSum + extraSum + todaySum;

    const predicted =
      staff.previousBalance +
      winsForBalance -
      staff.mailAmount -
      staff.returnClaims;

    const actual = staff.actualClosingBalance;
    const diff = actual - predicted;

    const assignedScanned =
      staff.mailAmount +
      staff.actualClosingBalance -
      staff.previousBalance -
      staff.returnClaims -
      extraSum -
      todaySum;

    return {
      agentSum,
      extraSum,
      todaySum,
      winsForBalance,
      predicted,
      actual,
      diff,
      assignedScanned,
    };
  };

  const totalAssignedScannedForTarget = staffEntries.reduce((sum, s) => {
    return sum + calculateStaffTotals(s).assignedScanned;
  }, 0);

  const targetAmount = parseFloat(totalAgentClaim) || 0;
  const difference = totalAssignedScannedForTarget - targetAmount;
  const isBalanced = Math.abs(difference) < 0.01;

  return (
    <main className="min-h-screen bg-gray-200 text-black p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="bg-white border border-gray-400 rounded-lg p-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-700">
              Lottery Claims Management System
            </h1>
            <p className="text-gray-700 text-sm">
              Assign parcels, track daily agent wins, and match staff balances.
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-gray-300 border border-gray-500 p-1 mt-4">
            <button
              onClick={() => handleModeChange("admin")}
              className={`px-4 py-2 text-sm rounded ${
                mode === "admin"
                  ? "bg-blue-600 text-white"
                  : "text-gray-800 hover:bg-gray-200"
              }`}
            >
              Admin View
            </button>

            <button
              onClick={() => handleModeChange("staff")}
              className={`px-4 py-2 text-sm rounded ${
                mode === "staff"
                  ? "bg-blue-600 text-white"
                  : "text-gray-800 hover:bg-gray-200"
              }`}
            >
              Staff View
            </button>
          </div>
        </div>

        {/* DATE + TARGET */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white border border-gray-400 rounded-lg p-5">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              Select Balance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-500 rounded bg-white text-black"
            />
          </div>

          <div className="bg-white border border-gray-400 rounded-lg p-5">
            <label className="text-sm text-gray-700 mb-2 block">
              Today&apos;s Agent Wins Target (Rs.)
            </label>
            <input
              type="number"
              value={totalAgentClaim}
              disabled={mode === "staff"}
              onChange={(e) =>
                mode === "admin" && setTotalAgentClaim(e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-500 rounded bg-white text-black disabled:bg-gray-200"
            />
          </div>
        </div>

        {/* ERROR & SUCCESS */}
        {error && (
          <div className="bg-red-100 border border-red-600 text-red-700 rounded p-3 mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-600 text-green-700 rounded p-3 mb-6">
            {success}
          </div>
        )}

        {/* STAFF LIST */}
        <div className="bg-white border border-gray-400 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <Users className="w-5 h-5 text-blue-700" />
              Staff Members
            </h2>

            {mode === "admin" && (
              <button
                onClick={addStaffMember}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Staff
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-center text-gray-700 py-8">Loading…</p>
          ) : staffEntries.length === 0 ? (
            <p className="text-center text-gray-700 py-8">
              No staff added.
            </p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {staffEntries.map((staff) => {
                const t = calculateStaffTotals(staff);

                return (
                  <div
                    key={staff.id}
                    className="bg-gray-100 border border-gray-400 rounded-lg p-5"
                  >
                    {/* STAFF NAME */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={staff.staffName}
                        disabled={mode === "staff"}
                        onChange={(e) =>
                          updateStaffName(staff.id, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-500 rounded bg-white text-black disabled:bg-gray-200"
                      />
                      {mode === "admin" && (
                        <button
                          onClick={() => removeStaffMember(staff.id)}
                          className="px-2 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* BALANCE FIELDS */}
                    <div className="grid md:grid-cols-4 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Previous Claim Balance (Rs.)
                        </label>
                        <input
                          type="number"
                          disabled={mode === "staff"}
                          value={staff.previousBalance || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "previousBalance",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white disabled:bg-gray-200"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Mail to Board (Rs.)
                        </label>
                        <input
                          type="number"
                          value={staff.mailAmount || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "mailAmount",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Return Claims (Rs.)
                        </label>
                        <input
                          type="number"
                          value={staff.returnClaims || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "returnClaims",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Actual Closing Balance (Rs.)
                        </label>
                        <input
                          type="number"
                          value={staff.actualClosingBalance || ""}
                          onChange={(e) =>
                            updateStaffNumberField(
                              staff.id,
                              "actualClosingBalance",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                        />
                      </div>
                    </div>

                    {/* PARCELS / ADDITIONALS */}
                    <div className="grid md:grid-cols-3 gap-4">

                      {/* AGENT PARCELS */}
                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Agent Parcels (Rs.)
                        </label>

                        {mode === "admin" && (
                          <input
                            type="number"
                            value={staff.agentDraft ?? ""}
                            onChange={(e) =>
                              updateDraft(staff.id, "agent", e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addValueFromDraft(staff.id, "agent");
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-500 rounded bg-white mb-2"
                          />
                        )}

                        {/* List */}
                        <div className="flex flex-wrap gap-2">
                          {staff.agentParcels.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 border border-gray-500 bg-gray-200 rounded text-xs flex items-center gap-1"
                            >
                              Rs. {p.toFixed(2)}
                              {mode === "admin" && (
                                <button
                                  onClick={() =>
                                    removeValue(staff.id, "agent", idx)
                                  }
                                  className="text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>

                        <div className="mt-1 text-xs text-gray-700">
                          Sum: <strong>Rs. {t.agentSum.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* ADDITIONAL BALANCE */}
                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Additional (This Balance) (Rs.)
                        </label>

                        <input
                          type="number"
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
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white mb-2"
                        />

                        {/* List */}
                        <div className="flex flex-wrap gap-2">
                          {staff.additionalBalanceOnly.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 border border-gray-500 bg-gray-200 rounded text-xs flex items-center gap-1"
                            >
                              Rs. {p.toFixed(2)}
                              <button
                                onClick={() =>
                                  removeValue(
                                    staff.id,
                                    "additionalBalance",
                                    idx
                                  )
                                }
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="mt-1 text-xs text-gray-700">
                          Sum: <strong>Rs. {t.extraSum.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* TODAY WINS */}
                      <div>
                        <label className="text-xs text-gray-700 block mb-1">
                          Today’s Agent Wins (Tomorrow Balance) (Rs.)
                        </label>

                        <input
                          type="number"
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
                              addValueFromDraft(staff.id, "additionalToday");
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-500 rounded bg-white mb-2"
                        />

                        {/* List */}
                        <div className="flex flex-wrap gap-2">
                          {staff.additionalTodayWins.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 border border-gray-500 bg-gray-200 rounded text-xs flex items-center gap-1"
                            >
                              Rs. {p.toFixed(2)}
                              <button
                                onClick={() =>
                                  removeValue(
                                    staff.id,
                                    "additionalToday",
                                    idx
                                  )
                                }
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="mt-1 text-xs text-gray-700">
                          Sum: <strong>Rs. {t.todaySum.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* CALCULATION SUMMARY */}
                    <div className="mt-4 border-t border-gray-400 pt-3 text-sm">

                      <div className="flex justify-between">
                        <span className="text-gray-700">
                          Wins for this balance:
                        </span>
                        <span className="font-mono text-blue-700 font-semibold">
                          Rs. {t.winsForBalance.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid md:grid-cols-3 gap-2 mt-3">
                        <div className="bg-white border border-gray-400 rounded p-2">
                          <p className="text-gray-700 text-xs">
                            Predicted Closing
                          </p>
                          <p className="font-mono text-green-700">
                            Rs. {t.predicted.toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-white border border-gray-400 rounded p-2">
                          <p className="text-gray-700 text-xs">Actual</p>
                          <p className="font-mono text-blue-700">
                            Rs. {t.actual.toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-white border border-gray-400 rounded p-2">
                          <p className="text-gray-700 text-xs">Difference</p>
                          <p
                            className={`font-mono ${
                              Math.abs(t.diff) < 0.01
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            Rs. {t.diff.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-700">
                        Assigned Scanned (for target):{" "}
                        <strong className="text-blue-700">
                          Rs. {t.assignedScanned.toFixed(2)}
                        </strong>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DAILY SUMMARY */}
        <div className="bg-white border border-gray-400 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Daily Summary
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            <div className="bg-gray-100 border border-gray-400 rounded p-4">
              <p className="text-xs text-gray-700">Target</p>
              <p className="text-2xl font-mono text-blue-700">
                Rs. {targetAmount.toFixed(2)}
              </p>
            </div>

            <div className="bg-gray-100 border border-gray-400 rounded p-4">
              <p className="text-xs text-gray-700">
                Total Assigned Scanned
              </p>
              <p className="text-2xl font-mono text-blue-800">
                Rs. {totalAssignedScannedForTarget.toFixed(2)}
              </p>
            </div>

            <div className="bg-gray-100 border border-gray-400 rounded p-4">
              <p className="text-xs text-gray-700">Difference</p>
              <p
                className={`text-2xl font-mono ${
                  isBalanced
                    ? "text-green-700"
                    : difference > 0
                    ? "text-orange-700"
                    : "text-red-700"
                }`}
              >
                {difference >= 0 ? "+" : ""}
                Rs. {difference.toFixed(2)}
              </p>
            </div>
          </div>

          {!isBalanced && targetAmount > 0 && (
            <div className="mt-3 bg-yellow-100 border border-yellow-600 rounded p-3 text-yellow-800 flex gap-2">
              <AlertCircle className="w-5 h-5" />
              Target mismatch. Review balances carefully.
            </div>
          )}

          {isBalanced && targetAmount > 0 && (
            <div className="mt-3 bg-green-100 border border-green-600 rounded p-3 text-green-700">
              Perfect. Balances match the target.
            </div>
          )}
        </div>

        {/* ADMIN PASSWORD SETTINGS */}
        {mode === "admin" && (
          <div className="bg-white border border-gray-400 rounded-lg p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Admin Password Settings
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-700">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-700">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassInput}
                  onChange={(e) => setConfirmNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-500 rounded bg-white"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!newPassInput) {
                  setPasswordChangeMessage("Password cannot be empty.");
                  return;
                }
                if (newPassInput !== confirmNewPassInput) {
                  setPasswordChangeMessage("Passwords do not match.");
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
                    setPasswordChangeMessage(data.error);
                    return;
                  }

                  setCurrentPassInput("");
                  setNewPassInput("");
                  setConfirmNewPassInput("");
                  setPasswordChangeMessage("Password updated successfully.");
                } catch {
                  setPasswordChangeMessage("Error updating password.");
                }
              }}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Update Password
            </button>

            {passwordChangeMessage && (
              <p className="text-xs text-gray-800 mt-2">
                {passwordChangeMessage}
              </p>
            )}
          </div>
        )}

        {/* SAVE BUTTON */}
        <div className="flex justify-center mb-10">
          <button
            onClick={saveData}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-lg disabled:bg-gray-400"
          >
            <Save className="inline-block w-5 h-5 mr-2" />
            {saving ? "Saving…" : "Save Data"}
          </button>
        </div>
      </div>

      {/* PASSWORD PROMPT MODAL */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-500 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Enter Admin Password
            </h3>

            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmAdminPassword();
              }}
              className="w-full px-3 py-2 border border-gray-500 rounded bg-white mb-3"
            />

            {passwordError && (
              <p className="text-xs text-red-700 mb-3">{passwordError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPasswordInput("");
                  setPasswordError(null);
                }}
                className="px-4 py-2 bg-gray-300 text-black rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmAdminPassword}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
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
