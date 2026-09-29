const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Update handlePaymentProofUpload
const oldPaymentUpload = /const handlePaymentProofUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?setIsUploading\(false\);\n    \};/;
const newPaymentUpload = `const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls = [];
    
    for (const file of Array.from(e.target.files)) {
      if (file.size > 5 * 1024 * 1024) continue;
      
      const fileExt = file.name.split('.').pop();
      const fileName = \`\${card.id}_\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`;
      const filePath = \`receipts/\${fileName}\`;
  
      const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      const newCombinedUrl = paymentProofUrl ? \`\${paymentProofUrl},\${uploadedUrls.join(',')}\` : uploadedUrls.join(',');
      setPaymentProofUrl(newCombinedUrl);
      await supabase.from("payment_requests").update({ payment_proof_url: newCombinedUrl }).eq("id", card.id);
    }
    
    setIsUploading(false);
  };`;
code = code.replace(oldPaymentUpload, newPaymentUpload);

// 2. Update handleInvoiceUpload
const oldInvoiceUpload = /const handleInvoiceUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?setIsUploadingInvoice\(false\);\n    onUpdate\("Notinha anexada com sucesso\."\);\n  \};/;
const newInvoiceUpload = `const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploadingInvoice(true);
    const uploadedUrls = [];
    
    for (const file of Array.from(e.target.files)) {
      if (file.size > 5 * 1024 * 1024) continue;
      
      const fileExt = file.name.split('.').pop();
      const fileName = \`invoice_\${card.id}_\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`;
      const filePath = \`receipts/\${fileName}\`;
  
      const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    if (uploadedUrls.length > 0) {
      const newCombinedUrl = invoiceUrl ? \`\${invoiceUrl},\${uploadedUrls.join(',')}\` : uploadedUrls.join(',');
      setInvoiceUrl(newCombinedUrl);
      await supabase.from("payment_requests").update({ invoice_url: newCombinedUrl }).eq("id", card.id);
      onUpdate("Notinha(s) anexada(s) com sucesso.");
    }
    
    setIsUploadingInvoice(false);
  };`;
code = code.replace(oldInvoiceUpload, newInvoiceUpload);

// 3. Update Inputs to accept multiple files
code = code.replace(
  '<input type="file" accept="image/*,.pdf" className="hidden" ref={fileInputRef} onChange={handlePaymentProofUpload} />',
  '<input type="file" multiple accept="image/*,.pdf" className="hidden" ref={fileInputRef} onChange={handlePaymentProofUpload} />'
);
code = code.replace(
  '<input type="file" accept="image/*,.pdf" className="hidden" ref={invoiceInputRef} onChange={handleInvoiceUpload} />',
  '<input type="file" multiple accept="image/*,.pdf" className="hidden" ref={invoiceInputRef} onChange={handleInvoiceUpload} />'
);

// 4. Update UI rendering for multiple files
const invoiceUIOld = /invoiceUrl \? \([\s\S]*?\)\s*:\s*\([\s\S]*?\)/;
const invoiceUINew = `invoiceUrl ? (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex flex-wrap gap-2">
                      {invoiceUrl.split(',').map((url, i) => (
                        <a 
                          key={i}
                          href={url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors flex items-center gap-1"
                        >
                          Nota {i + 1}
                        </a>
                      ))}
                    </div>
                    <button onClick={() => invoiceInputRef.current?.click()} className="text-[10px] text-gray-400 hover:text-white underline self-start">
                      + Adicionar Mais
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button 
                      onClick={() => invoiceInputRef.current?.click()}
                      disabled={isUploadingInvoice}
                      className="px-3 py-1.5 text-xs font-medium border border-dashed border-gray-600 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-colors w-full flex items-center justify-center gap-2"
                    >
                      {isUploadingInvoice ? "Enviando..." : "+ Anexar Nota / Recibo"}
                    </button>
                  </div>
                )`;
code = code.replace(invoiceUIOld, invoiceUINew);

const paymentUIOld = /paymentProofUrl \? \([\s\S]*?\)\s*:\s*\([\s\S]*?\)/;
const paymentUINew = `paymentProofUrl ? (
                <div className="flex flex-col items-center gap-2 text-emerald-400 w-full">
                  <CheckCircle2 size={32} />
                  <span className="text-sm font-bold">Comprovante(s) Anexado(s)</span>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {paymentProofUrl.split(',').map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs underline text-blue-400 hover:text-blue-300">
                        Visualizar {i + 1}
                      </a>
                    ))}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs mt-2 text-gray-400 hover:text-white underline"
                  >
                    + Adicionar Mais Comprovantes
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud size={36} className="text-gray-500" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-300">Comprovante(s) de Pagamento</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Apenas para Master/Financeiro. Anexe as imagens ou PDFs.<br />
                      <span className="text-red-400 font-medium">*Obrigatório para avançar</span>
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Selecionar Arquivos
                  </button>
                </>
              )`;
code = code.replace(paymentUIOld, paymentUINew);

fs.writeFileSync(file, code);
console.log("Updated CardDetailModal.tsx");
