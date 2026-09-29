const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// The problematic block 1
// ) => invoiceInputRef.current?.click()}
//                       className="w-full py-2 flex items-center justify-center gap-2 border border-dashed border-gray-600 rounded-lg hover:border-amber-400 hover:bg-amber-500/5 text-gray-400 hover:text-amber-400 text-xs transition-colors"
//                     >
//                       <UploadCloud size={14} />
//                       Anexar arquivo agora
//                     </button>
//                     {isAguardandoNota && <p className="text-[10px] text-amber-400 text-center mt-1 font-semibold">* O Financeiro est aguardando este anexo!</p>}
//                   </div>
//                 )}
// I'll replace everything from `) => invoiceInputRef.current?.click()}` down to `)}` with just `)}`
code = code.replace(/\) => invoiceInputRef\.current\?\.click\(\)\}[\s\S]*?\* O Financeiro est.*?<\/p>\}[\s\S]*?<\/div>[\s\S]*?\)\}/g, ')}');

// The problematic block 2
// )</p>
//                     <p className="text-xs text-gray-500 mt-1">
//                       Apenas para Master/Financeiro. Cole (Ctrl+V) uma imagem ou PDF.<br />
//                       <span className="text-red-400 font-medium">*Obrigatrio para avanar</span>
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => fileInputRef.current?.click()}
//                     className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
//                   >
//                     Selecionar Arquivo
//                   </button>
//                 </>
//               )}
code = code.replace(/\)<\/p>[\s\S]*?Selecionar Arquivo[\s\S]*?<\/button>[\s\S]*?<\/>[\s\S]*?\)\}/g, ')}');

fs.writeFileSync(file, code);
console.log("Fixed JSX syntax in CardDetailModal.tsx with looser regex");
