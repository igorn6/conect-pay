const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Fix handleFileChange
code = code.replace(
  /const handleFileChange = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?\};/,
  `const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);
    }
  };`
);

// 2. Fix the upload logic
code = code.replace(
  /let fileUrl = null;[\s\S]*?if \(invoiceFiles\) \{[\s\S]*?fileUrl = publicUrl;\n      \}/,
  `let fileUrl = null;
      if (invoiceFiles && invoiceFiles.length > 0) {
        const uploadedUrls = [];
        for (const file of invoiceFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = \`\${Math.random()}.\${fileExt}\`;
          const filePath = \`invoices/\${fileName}\`;
          const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
          uploadedUrls.push(publicUrl);
        }
        fileUrl = uploadedUrls.join(',');
      }`
);

// 3. Fix the invoiceFiless UI remnants
code = code.replace(/invoiceFiless/g, 'invoiceFiles');
code = code.replace(/invoiceFiles\.length > 0s/g, 'invoiceFiles');
code = code.replace(/setInvoiceFiles\(\[\]\)\(null\)/g, 'setInvoiceFiles([])');

// 4. Ensure UI has the multiple files display (if not already there)
// I will just let it be for now and check TS errors.

fs.writeFileSync(file, code);
console.log("Fixed NewRequestModal.tsx");
