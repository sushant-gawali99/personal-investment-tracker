export type RowStatus =
  | "pending"
  | "extracting"
  | "extracted"
  | "extract_failed"
  | "saving"
  | "saved"
  | "save_failed";

export type FdExtracted = {
  bankName: string | null;
  fdNumber: string | null;
  accountNumber: string | null;
  principal: number | null;
  interestRate: number | null;
  tenureMonths: number | null;
  tenureDays: number | null;
  tenureText: string | null;
  startDate: string | null;
  maturityDate: string | null;
  maturityAmount: number | null;
  interestType: "simple" | "compound" | null;
  compoundFreq: "monthly" | "quarterly" | "annually" | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
  nomineeName: string | null;
  nomineeRelation: string | null;
};

export type EditableFields = {
  bankName: string;
  fdNumber: string;
  accountNumber: string;
  principal: string;
  interestRate: string;
  tenureMonths: string;
  tenureDays: string;
  tenureText: string;
  startDate: string;
  maturityDate: string;
  maturityAmount: string;
  interestType: string;
  compoundFreq: string;
  maturityInstruction: string;
  payoutFrequency: string;
  nomineeName: string;
  nomineeRelation: string;
};

export type BulkRow = {
  id: string;
  file: File;
  kind: "pdf" | "image";
  status: RowStatus;
  error?: string;
  isDuplicate?: boolean;
  selected: boolean;
  extracted?: FdExtracted;
  edited: Partial<EditableFields>;
};

export type BulkState = { rows: BulkRow[] };

export type BulkAction =
  | { type: "ADD_ROWS"; rows: BulkRow[] }
  | { type: "REMOVE_ROW"; id: string }
  | { type: "SET_STATUS"; id: string; status: RowStatus; error?: string }
  | { type: "SET_EXTRACTED"; id: string; extracted: FdExtracted }
  | { type: "SET_DUPLICATES"; keys: Array<{ bankName: string; fdNumber: string }> }
  | { type: "TOGGLE_SELECTED"; id: string }
  | { type: "SET_SELECTED"; id: string; selected: boolean }
  | { type: "EDIT_FIELD"; id: string; field: keyof EditableFields; value: string }
  | { type: "RESET" };

export function extractedToEditable(e: FdExtracted): Partial<EditableFields> {
  const toStr = (v: number | null) => (v == null ? "" : String(v));
  const toDate = (v: string | null) => {
    if (!v) return "";
    try {
      return new Date(v).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };
  return {
    bankName: e.bankName ?? "",
    fdNumber: e.fdNumber ?? "",
    accountNumber: e.accountNumber ?? "",
    principal: toStr(e.principal),
    interestRate: toStr(e.interestRate),
    tenureMonths: toStr(e.tenureMonths),
    tenureDays: toStr(e.tenureDays),
    tenureText: e.tenureText ?? "",
    startDate: toDate(e.startDate),
    maturityDate: toDate(e.maturityDate),
    maturityAmount: toStr(e.maturityAmount),
    interestType: e.interestType ?? "compound",
    compoundFreq: e.compoundFreq ?? "quarterly",
    maturityInstruction: e.maturityInstruction ?? "",
    payoutFrequency: e.payoutFrequency ?? "",
    nomineeName: e.nomineeName ?? "",
    nomineeRelation: e.nomineeRelation ?? "",
  };
}

export const initialState: BulkState = { rows: [] };

export function bulkReducer(state: BulkState, action: BulkAction): BulkState {
  switch (action.type) {
    case "ADD_ROWS":
      return { rows: [...state.rows, ...action.rows] };

    case "REMOVE_ROW":
      return { rows: state.rows.filter((r) => r.id !== action.id) };

    case "SET_STATUS":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, status: action.status, error: action.error } : r,
        ),
      };

    case "SET_EXTRACTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id
            ? {
                ...r,
                extracted: action.extracted,
                edited: { ...extractedToEditable(action.extracted), ...r.edited },
              }
            : r,
        ),
      };

    case "SET_DUPLICATES": {
      const keySet = new Set(
        action.keys.map((k) => `${k.bankName}|${k.fdNumber}`),
      );
      return {
        rows: state.rows.map((r) => {
          const bank = r.edited.bankName ?? r.extracted?.bankName ?? "";
          const fdn = r.edited.fdNumber ?? r.extracted?.fdNumber ?? "";
          const isDup = bank && fdn ? keySet.has(`${bank}|${fdn}`) : false;
          return { ...r, isDuplicate: isDup };
        }),
      };
    }

    case "TOGGLE_SELECTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, selected: !r.selected } : r,
        ),
      };

    case "SET_SELECTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, selected: action.selected } : r,
        ),
      };

    case "EDIT_FIELD":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id
            ? { ...r, edited: { ...r.edited, [action.field]: action.value } }
            : r,
        ),
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function mergedFields(row: BulkRow): EditableFields {
  const base: EditableFields = {
    bankName: "",
    fdNumber: "",
    accountNumber: "",
    principal: "",
    interestRate: "",
    tenureMonths: "",
    tenureDays: "",
    tenureText: "",
    startDate: "",
    maturityDate: "",
    maturityAmount: "",
    interestType: "compound",
    compoundFreq: "quarterly",
    maturityInstruction: "",
    payoutFrequency: "",
    nomineeName: "",
    nomineeRelation: "",
  };
  return { ...base, ...row.edited };
}
