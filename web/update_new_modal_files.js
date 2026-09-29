const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Change state
code = code.replace(
  'const [invoiceFile, setInvoiceFile] = useState<File | null>(null);',
  'const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);'
);

// 2. Update handleFileChange
code = code.replace(
  'const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n      if (e.target.files && e.target.files[0]) {\n        setInvoiceFile(e.target.files[0]);\n      }\n    };',
  'const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n      if (e.target.files) {\n        setInvoiceFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);\n      }\n    };'
);

// 3. Update input UI
code = code.replace(
  '<input\n                type="file"',
  '<input\n                type="file"\n                multiple'
);

// 4. Update UI rendering
const oldUI = `
              <div 
                className={\`p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors \${
                  invoiceFile 
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'hover:bg-gray-800/10'
                }\`}
                style={{ borderColor: invoiceFile ? "" : "var(--surface-border)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                {invoiceFile ? (
                  <div className="flex flex-col items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={24} />
                    <span className="text-xs font-bold">{invoiceFile.name}</span>
                    <span className="text-[10px] text-gray-400 mt-1">Clique para substituir</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-gray-800/50 text-gray-400">
                      <Upload size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-300">Clique para enviar a notinha</p>
                      <p className="text-[10px] text-gray-500 mt-1">PDF, JPG ou PNG</p>
                    </div>
                  </div>
                )}
              </div>
`;

const newUI = `
              <div 
                className={\`p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors \${
                  invoiceFiles.length > 0
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'hover:bg-gray-800/10'
                }\`}
                style={{ borderColor: invoiceFiles.length > 0 ? "" : "var(--surface-border)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-gray-800/50 text-gray-400">
                    <Upload size={20} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-300">Clique para adicionar anexos</p>
                    <p className="text-[10px] text-gray-500 mt-1">Selecione vários arquivos se necessário</p>
                  </div>
                </div>
              </div>
              
              {invoiceFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {invoiceFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-800 p-2 rounded text-xs text-emerald-400">
                      <span className="truncate flex-1">{f.name}</span>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setInvoiceFiles(prev => prev.filter((_, index) => index !== i)); }}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
`;
code = code.replace(oldUI, newUI);

// 5. Update Upload Logic
const oldUpload = `
        if (invoiceFile) {
          const fileExt = invoiceFile.name.split('.').pop();
          const fileName = \`\${Math.random()}.\${fileExt}\`;
          const filePath = \`invoices/\${fileName}\`;
          const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, invoiceFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
          fileUrl = publicUrl;
        }
`;

const newUpload = `
        if (invoiceFiles.length > 0) {
          const uploadedUrls = [];
          for (const file of invoiceFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = \`\${Math.random()}.\${fileExt}\`;
            const filePath = \`invoices/\${fileName}\`;
            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
            uploadedUrls.push(publicUrl);
          }
          fileUrl = uploadedUrls.join(',');
        }
`;
code = code.replace(oldUpload, newUpload);

// Fix cleanup
code = code.replace('setInvoiceFile(null);', 'setInvoiceFiles([]);');

fs.writeFileSync(file, code);
console.log("Updated NewRequestModal.tsx");
