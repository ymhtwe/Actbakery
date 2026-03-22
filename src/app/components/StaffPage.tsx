import { useNavigate } from "react-router";
import { LogOut, Cake } from "lucide-react";
import { DataEntryContent } from "./DataEntryContent";
import { supabase } from "./supabaseClient";

export function StaffPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-[#F7F6F3] flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20" style={{ height: "72px" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#FAF6EC] border border-[#E5E7EB] flex items-center justify-center shrink-0">
            <Cake className="w-3.5 h-3.5 text-[#D6B25E]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[#1F2937]" style={{ fontSize: "18px", fontWeight: 600 }}>ACT Bakery</span>
            <span className="hidden sm:inline text-[#9CA3AF]" style={{ fontSize: "13px" }}>Production Entry</span>
          </div>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F7F6F3] px-3 sm:px-4 py-2 rounded-[12px] border border-[#E5E7EB] transition-colors cursor-pointer"
          style={{ fontSize: "0.85rem" }}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6 max-w-2xl mx-auto w-full pb-36">
        <DataEntryContent />
      </main>
    </div>
  );
}
