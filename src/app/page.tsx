"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Plus, Trash2, Calendar, Save, Users } from "lucide-react";

interface StaffEntry {
  id: string;
  staffName: string;
  agentParcels: number[];
  publicParcels: number[];
}

interface DailyClaim {
  date: string;
  totalAgentClaim: number;
  staffEntries: StaffEntry[];
}

export default function LotteryClaimsManager() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [totalAgentClaim, setTotalAgentClaim] = useState<string>("");
  const [staffEntries, setStaffEntries] = useState<StaffEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadDateData();
  }, [selectedDate]);

  const loadDateData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims?date=${selectedDate}`);
      const data = await res.json();

      if (data.claim) {
        setTotalAgentClaim(data.claim.totalAgentClaim.toString());
        setStaffEntries(data.claim.staffEntries || []);
      } else {
        setTotalAgentClaim("");
        setStaffEntries([]);
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
      const claimData: DailyClaim = {
        date: selectedDate,
        totalAgentClaim: parseFloat(totalAgentClaim) || 0,
        staffEntries: staffEntries.map((entry) => ({
          ...entry,
          agentParcels: entry.agentParcels.filter((p) => !isNaN(p) && p > 0),
          publicParcels: entry.publicParcels.filter((p) => !isNaN(p) && p > 0),
        })),
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

  const addStaffMember = () => {
    const newStaff: StaffEntry = {
      id: Date.now().toString(),
      staffName: "",
      agentParcels: [],
      publicParcels: [],
    };
    setStaffEntries([...staffEntries, newStaff]);
  };

  const removeStaffMember = (id: string) => {
    setStaffEntries(staffEntries.filter((s) => s.id !== id));
  };

  const updateStaffName = (id: string, name: string) => {
    setStaffEntries(
      staffEntries.map((s) => (s.id === id ? { ...s, staffName: name } : s))
    );
  };

  const addParcel = (id: string, type: "agent" | "public") => {
    setStaffEntries(
      staffEntries.map((s) => {
        if (s.id === id) {
          if (type === "agent") {
            return { ...s, agentParcels: [...s.agentParcels, 0] };
          } else {
            return { ...s, publicParcels: [...s.publicParcels, 0] };
          }
        }
        return s;
      })
    );
  };

  const updateParcel = (
    id: string,
    type: "agent" | "public",
    index: number,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;

    setStaffEntries(
      staffEntries.map((s) => {
        if (s.id === id) {
          if (type === "agent") {
            const newParcels = [...s.agentParcels];
            newParcels[index] = numValue;
            return { ...s, agentParcels: newParcels };
          } else {
            const newParcels = [...s.publicParcels];
            newParcels[index] = numValue;
            return { ...s, publicParcels: newParcels };
          }
        }
        return s;
      })
    );
  };

  const removeParcel = (id: string, type: "agent" | "public", index: number) => {
    setStaffEntries(
      staffEntries.map((s) => {
        if (s.id === id) {
          if (type === "agent") {
            return {
              ...s,
              agentParcels: s.agentParcels.filter((_, i) => i !== index),
            };
          } else {
            return {
              ...s,
              publicParcels: s.publicParcels.filter((_, i) => i !== index),
            };
          }
        }
        return s;
      })
    );
  };

  const calculateStaffTotals = (staff: StaffEntry) => {
    const agentSum = staff.agentParcels.reduce((sum, p) => sum + p, 0);
    const publicSum = staff.publicParcels.reduce((sum, p) => sum + p, 0);
    const effective = agentSum - publicSum;
    return { agentSum, publicSum, effective };
  };

  const totalEffectiveContribution = staffEntries.reduce((sum, staff) => {
    return sum + calculateStaffTotals(staff).effective;
  }, 0);

  const targetAmount = parseFloat(totalAgentClaim) || 0;
  const difference = totalEffectiveContribution - targetAmount;
  const isBalanced = Math.abs(difference) < 0.01;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Lottery Claims Management System
          </h1>
          <p className="text-slate-400 text-sm">
            Track daily agent claims and staff parcel scanning
          </p>
        </div>

        {/* DATE + TARGET */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-3">
              <Calendar className="w-4 h-4 text-blue-400" />
              Select Date
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
              Daily Agent Claim Target (Rs.)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalAgentClaim}
              onChange={(e) => setTotalAgentClaim(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700"
              placeholder="Enter today's total agent claim target..."
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
            <button
              onClick={addStaffMember}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
            >
              <Plus className="w-4 h-4" />
              Add Staff
            </button>
          </div>

          {loading ? (
            <p className="text-center text-slate-400 py-8">Loading...</p>
          ) : staffEntries.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              No staff added. Click &quot;Add Staff&quot; to begin.
            </p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {staffEntries.map((staff) => {
                const totals = calculateStaffTotals(staff);

                return (
                  <div
                    key={staff.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-5"
                  >
                    {/* STAFF NAME */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={staff.staffName}
                        onChange={(e) =>
                          updateStaffName(staff.id, e.target.value)
                        }
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                        placeholder="Staff name..."
                      />
                      <button
                        onClick={() => removeStaffMember(staff.id)}
                        className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* PARCELS */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* AGENT PARCELS */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-xs text-slate-400">
                            Agent Parcels (Rs.)
                          </label>
                          <button
                            onClick={() => addParcel(staff.id, "agent")}
                            className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400"
                          >
                            + Add
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {staff.agentParcels.map((parcel, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={parcel || ""}
                                onChange={(e) =>
                                  updateParcel(
                                    staff.id,
                                    "agent",
                                    idx,
                                    e.target.value
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addParcel(staff.id, "agent");
                                  }
                                }}
                                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                                placeholder="Enter Rs."
                              />
                              <button
                                onClick={() =>
                                  removeParcel(staff.id, "agent", idx)
                                }
                                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
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

                      {/* PUBLIC PARCELS */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-xs text-slate-400">
                            Public Parcels (Walk-in)
                          </label>
                          <button
                            onClick={() => addParcel(staff.id, "public")}
                            className="text-xs px-2 py-1 rounded bg-orange-900/30 text-orange-400"
                          >
                            + Add
                          </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {staff.publicParcels.map((parcel, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={parcel || ""}
                                onChange={(e) =>
                                  updateParcel(
                                    staff.id,
                                    "public",
                                    idx,
                                    e.target.value
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addParcel(staff.id, "public");
                                  }
                                }}
                                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600"
                                placeholder="Enter Rs."
                              />
                              <button
                                onClick={() =>
                                  removeParcel(staff.id, "public", idx)
                                }
                                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                          Sum:{" "}
                          <span className="text-orange-400 font-mono">
                            Rs. {totals.publicSum.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* EFFECTIVE CONTRIBUTION */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-300">
                          Effective Agent Contribution
                        </span>
                        <span className="text-lg font-bold font-mono text-cyan-400">
                          Rs. {totals.effective.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Calculation: Rs. {totals.agentSum.toFixed(2)} (agent) −
                        Rs. {totals.publicSum.toFixed(2)} (public)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SUMMARY */}
        <div className="bg-gradient-to-r from-slate-900/80 to-blue-900/30 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Daily Summary</h2>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Target Amount</p>
              <p className="text-2xl font-bold font-mono text-blue-400">
                Rs. {targetAmount.toFixed(2)}
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">
                Total Effective Contribution
              </p>
              <p className="text-2xl font-bold font-mono text-cyan-400">
                Rs. {totalEffectiveContribution.toFixed(2)}
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
                Balance mismatch. Difference: Rs.{" "}
                {Math.abs(difference).toFixed(2)}
              </p>
            </div>
          )}

          {isBalanced && targetAmount > 0 && (
            <div className="bg-green-950/30 border border-green-700 rounded-lg p-4 flex gap-3">
              <div className="bg-green-500 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs">
                ✓
              </div>
              <p className="text-green-400 text-sm">
                Perfect balance. All staff totals match today&apos;s target.
              </p>
            </div>
          )}
        </div>

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
    </main>
  );
}
