import type Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_transactions",
    description:
      "Search bank transactions by keyword, date range, amount, or direction. Use for questions like 'how much did I send to Amruta', 'show all Swiggy orders', 'credits in March'.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description:
            "Search term matched against transaction description (e.g. 'amruta', 'swiggy'). Case-insensitive.",
        },
        fromDate: {
          type: "string",
          description: "Start date inclusive, YYYY-MM-DD format.",
        },
        toDate: {
          type: "string",
          description: "End date inclusive, YYYY-MM-DD format.",
        },
        minAmount: {
          type: "number",
          description: "Minimum transaction amount in INR.",
        },
        maxAmount: {
          type: "number",
          description: "Maximum transaction amount in INR.",
        },
        direction: {
          type: "string",
          enum: ["debit", "credit"],
          description: "Filter to only debits (money out) or credits (money in).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_transaction_summary",
    description:
      "Get aggregated totals grouped by category, month, or payee. Use for questions like 'how much did I spend on groceries', 'my monthly spending trend', 'top merchants this year'.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromDate: {
          type: "string",
          description: "Start date inclusive, YYYY-MM-DD format.",
        },
        toDate: {
          type: "string",
          description: "End date inclusive, YYYY-MM-DD format.",
        },
        groupBy: {
          type: "string",
          enum: ["category", "month", "payee"],
          description: "Dimension to group results by.",
        },
        direction: {
          type: "string",
          enum: ["debit", "credit"],
          description: "Summarise only debits or credits.",
        },
      },
      required: ["groupBy"],
    },
  },
  {
    name: "get_fixed_deposits",
    description:
      "Get all active fixed deposits with principal, interest rate, maturity date, and latest renewal details.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_equity_holdings",
    description:
      "Get current equity holdings (stocks, mutual funds) from Zerodha Kite with quantity, current value, and P&L.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_gold_holdings",
    description:
      "Get gold items with weight, karat, and current market value based on the latest gold rate.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_nj_india_mutual_funds",
    description:
      "Get mutual fund holdings from the latest NJ India valuation statement. Returns per-scheme invested amount, units, current value, gain/loss, absolute return %, XIRR, and sub-type (ELSS, Flexi Cap, etc.). Also returns overall totals and the report date.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_net_worth_summary",
    description:
      "Get total net worth broken down by asset class: fixed deposits, equity, Zerodha mutual funds, NJ India mutual funds, and gold.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
