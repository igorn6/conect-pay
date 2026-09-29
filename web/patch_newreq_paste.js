const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(p, "utf-8");

// Add useEffect to NewRequestModal for pasting
if (!code.includes("handleGlobalPaste")) {
  code = code.replace(
    'const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {',
    `useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("pdf") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              alert("O arquivo colado deve ter no m\u00e1ximo 5MB.");
              return;
            }
            setInvoiceFile(file);
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {`
  );
  fs.writeFileSync(p, code);
  console.log("NewRequestModal paste handler added.");
} else {
  console.log("NewRequestModal already has paste handler.");
}
