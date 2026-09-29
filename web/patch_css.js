const fs = require('fs');
const path = require('path');

const cssPath = path.join(process.cwd(), "src/app/globals.css");
let css = fs.readFileSync(cssPath, "utf-8");

const lightThemeCSS = `
/* Light Theme Overrides (Tailwind v4 Variables) */
.light-theme {
  --color-background: #f8fafc;
  --color-foreground: #0f172a;
  
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-elevated: #f1f5f9;
  
  --surface-hover: #e2e8f0;
  --surface-border: #e2e8f0;
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  
  /* Overriding Tailwind Slate Colors */
  --color-slate-50: #020617;
  --color-slate-100: #0f172a;
  --color-slate-200: #1e293b;
  --color-slate-300: #334155;
  --color-slate-400: #475569;
  --color-slate-500: #64748b;
  --color-slate-600: #94a3b8;
  --color-slate-700: #cbd5e1;
  --color-slate-800: #e2e8f0;
  --color-slate-900: #f1f5f9;
  --color-slate-950: #f8fafc;
  
  /* Overriding White and Black */
  --color-white: #020617; /* Makes text-white dark */
  --color-black: #ffffff; /* Makes bg-black light */
}
`;

if (!css.includes(".light-theme")) {
  css = css + "\n" + lightThemeCSS;
  fs.writeFileSync(cssPath, css);
  console.log("globals.css updated!");
} else {
  console.log("globals.css already has light-theme.");
}
