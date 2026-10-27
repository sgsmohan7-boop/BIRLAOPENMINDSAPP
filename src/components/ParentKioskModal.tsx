import React from "react";
import ParentKioskView from "./ParentKioskView";
import { ParentSelfEntry } from "../types";

interface ParentKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitParentEntry: (entry: ParentSelfEntry) => void;
  userRole?: string;
  defaultMode?: "register" | "print_qr";
}

export default function ParentKioskModal({
  isOpen,
  onClose,
  onSubmitParentEntry,
  defaultMode = "print_qr"
}: ParentKioskModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl relative my-auto animate-in zoom-in-95 duration-150">
        <ParentKioskView
          isStandalone={false}
          onClose={onClose}
          onSubmitSuccess={(entry) => onSubmitParentEntry(entry)}
          defaultMode={defaultMode}
        />
      </div>
    </div>
  );
}
