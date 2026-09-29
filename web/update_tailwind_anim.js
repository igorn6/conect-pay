const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "tailwind.config.ts");
const fileMjs = path.join(process.cwd(), "tailwind.config.mjs");

const targetFile = fs.existsSync(file) ? file : (fs.existsSync(fileMjs) ? fileMjs : null);

if (targetFile) {
  let code = fs.readFileSync(targetFile, 'utf8');

  if (!code.includes('slow-pan')) {
    code = code.replace(
      'extend: {',
      'extend: {\n      keyframes: {\n        "slow-pan": {\n          "0%, 100%": { transform: "scale(1.05) translate(0, 0)" },\n          "50%": { transform: "scale(1.1) translate(-2%, 2%)" },\n        },\n      },\n      animation: {\n        "slow-pan": "slow-pan 30s ease-in-out infinite alternate",\n      },'
    );
    fs.writeFileSync(targetFile, code);
    console.log("Updated " + targetFile);
  }
}
