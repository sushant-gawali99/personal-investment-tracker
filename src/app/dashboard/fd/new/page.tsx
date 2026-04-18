import { FDNewForm } from "./fd-new-form";

export default function NewFDPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Add Fixed Deposit</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Upload your FD document for AI extraction, or fill in the details manually.
        </p>
      </div>
      <FDNewForm />
    </div>
  );
}
