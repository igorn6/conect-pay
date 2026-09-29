const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(p, "utf-8");

// 1. Fix "Desconhecido"
// We need to change: const requesterName = profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido";
// To prefer real_requester_id over created_by
const oldRequester = 'const requesterName = profilesMap[card.created_by] || profilesMap[card.real_requester_id || ""] || "Desconhecido";';
const newRequester = 'const requesterName = profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido";';
code = code.replace(oldRequester, newRequester);

// 2. Add paste handler
if (!code.includes("handleGlobalPaste")) {
  const uploadFunc = 'const handleUploadPaymentProof = async (e: React.ChangeEvent<HTMLInputElement>) => {';
  
  const pasteCode = `useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("pdf") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              setErrorMsg("O arquivo colado deve ter no m\u00e1ximo 5MB.");
              return;
            }
            
            // Upload immediately depending on status
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`;
            
            if (isEmAprovacao && (userRole === "FINANCEIRO" || userRole === "MASTER")) {
              // Upload Payment Proof
              setIsUploading(true);
              const filePath = \`comprovantes/\${fileName}\`;
              const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
              if (!uploadError) {
                const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);
                const { error: updateError } = await supabase.from("payment_requests").update({ payment_proof_url: data.publicUrl }).eq("id", card.id);
                if (!updateError) {
                  setPaymentProofUrl(data.publicUrl);
                  onUpdate("Comprovante anexado via colar");
                }
              }
              setIsUploading(false);
            } else if (isAguardandoNotinha && (userRole === "GESTOR" || userRole === "MASTER")) {
              // Upload Invoice
              setIsUploadingInvoice(true);
              const filePath = \`receipts/\${fileName}\`;
              const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
              if (!uploadError) {
                const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);
                const { error: updateError } = await supabase.from("payment_requests").update({ invoice_url: data.publicUrl }).eq("id", card.id);
                if (!updateError) {
                  setInvoiceUrl(data.publicUrl);
                  onUpdate("Nota fiscal anexada via colar");
                }
              }
              setIsUploadingInvoice(false);
            }
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [userRole, isEmAprovacao, isAguardandoNotinha, card.id, onUpdate]);

  const handleUploadPaymentProof = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
  
  // also need to import useEffect if not there, but it is imported as `import { useState, useRef } from "react";`
  // so we need to add useEffect
  code = code.replace(
    'import { useState, useRef } from "react";',
    'import { useState, useRef, useEffect } from "react";'
  );
  
  // define isAguardandoNotinha because it's used in our paste handler
  if (!code.includes('const isAguardandoNotinha = card.status === "AGUARDANDO_NOTINHA";')) {
    code = code.replace(
      'const isEmAprovacao = card.status === "EM_APROVACAO";',
      'const isEmAprovacao = card.status === "EM_APROVACAO";\n  const isAguardandoNotinha = card.status === "AGUARDANDO_NOTINHA";'
    );
  }
  
  code = code.replace(uploadFunc, pasteCode);
  
  fs.writeFileSync(p, code);
  console.log("CardDetailModal paste handler and Desconhecido fix added.");
} else {
  console.log("CardDetailModal already has paste handler.");
}
