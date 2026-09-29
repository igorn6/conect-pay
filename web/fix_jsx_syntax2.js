const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  ') => invoiceInputRef.current?.click()}\n                      className="w-full py-2 flex items-center justify-center gap-2 border border-dashed border-gray-600 rounded-lg hover:border-amber-400 hover:bg-amber-500/5 text-gray-400 hover:text-amber-400 text-xs transition-colors"\n                    >\n                      <UploadCloud size={14} />\n                      Anexar arquivo agora\n                    </button>\n                    {isAguardandoNota && <p className="text-[10px] text-amber-400 text-center mt-1 font-semibold">* O Financeiro est aguardando este anexo!</p>}\n                  </div>\n                )}',
  ')}'
);

code = code.replace(
  ')</p>\n                    <p className="text-xs text-gray-500 mt-1">\n                      Apenas para Master/Financeiro. Cole (Ctrl+V) uma imagem ou PDF.<br />\n                      <span className="text-red-400 font-medium">*Obrigatrio para avanar</span>\n                    </p>\n                  </div>\n                  <button\n                    onClick={() => fileInputRef.current?.click()}\n                    className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"\n                  >\n                    Selecionar Arquivo\n                  </button>\n                </>\n              )}',
  ')}'
);

fs.writeFileSync(file, code);
console.log("Fixed JSX syntax in CardDetailModal.tsx");
