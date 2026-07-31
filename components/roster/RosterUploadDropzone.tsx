"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface RosterUploadDropzoneProps {
  onFileSelected: (file: File) => void;
  fileName?: string | null;
  isBusy?: boolean;
}

export function RosterUploadDropzone({ onFileSelected, fileName, isBusy }: RosterUploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const valid = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (!valid) return;
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
        dragging ? "border-accent bg-accent/5" : "border-border-line bg-surface/40"
      )}
    >
      <div className="text-3xl">📤</div>
      <p className="text-sm font-semibold text-text-primary">
        {fileName ? `Selected: ${fileName}` : "Drag and drop your completed roster file here"}
      </p>
      <p className="text-xs text-text-faint">Accepts .xlsx, .xls, or .csv</p>
      <Button type="button" variant="secondary" size="sm" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        {isBusy ? "Processing…" : "Browse files"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
