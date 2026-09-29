const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  'import { useState, useRef } from "react";',
  'import { useState, useRef, useEffect } from "react";'
);

fs.writeFileSync(p, code);
console.log("Fixed NewRequestModal import.");
