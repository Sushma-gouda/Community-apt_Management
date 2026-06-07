
const fs = require("fs");
const file = "src/services/supabase/community.ts";
let content = fs.readFileSync(file, "utf8");

// Remove the old checkoutVisitor and insertVisitor
content = content.replace(/export async function checkoutVisitor[\s\S]*?error: null };\r?\n  }/, "");
content = content.replace(/export async function insertVisitor[\s\S]*?return error \? \{ error: error\.message \} : \{ error: null \};\r?\n  }/, "");

// Remove old fetchVisitorsDetailed and fetchActiveVisitorsDetailed and VisitorDetailed
content = content.replace(/export type VisitorDetailed = \{[\s\S]*?export async function fetchActiveVisitorsDetailed\(\): Promise<VisitorDetailed\[\]> \{[\s\S]*?\r?\n  \}/, "");
content = content.replace(/export async function fetchRecentVisitors[\s\S]*?\r?\n  }/, "");
content = content.replace(/export async function fetchVisitorsAll[\s\S]*?\r?\n  }/, "");

// Write it back
fs.writeFileSync(file, content);
console.log("Done");

