const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// Find the img closing and the Link tag that should be closed
// The issue is the </div> was turned into </Link> at the WRONG place
// Let's find the logo section precisely
const logoStart = code.indexOf('aria-label="Ir para');
const imgEnd = code.indexOf("mix-blend-lighten", logoStart);
const closingArea = code.indexOf('/>', imgEnd);

// Find the next </Link> or </div> after the img tag ends
const afterImg = code.substring(closingArea);
console.log("After img (first 100):", JSON.stringify(afterImg.substring(0, 100)));

// The problem: we replaced a </div> that was NOT the logo wrapper
// Let's look for the pattern after the img closing
const firstCloseAfterImg = afterImg.indexOf('</');
console.log("First close tag:", afterImg.substring(firstCloseAfterImg, firstCloseAfterImg + 20));
