const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/components/NewRequestModal.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const splitTarget = '<div className="mt-2">\n            <label className={labelClass} style={labelStyle}>\n              Notinha ou Nota Fiscal';

if (content.includes(splitTarget)) {
  const notesField = `
          {/* OBSERVACOES */}
          <div className="mt-2">
            <label className={labelClass} style={labelStyle}>
              Observações *
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (errors.notes) setErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              rows={3}
              placeholder="Detalhes, justificativas, centro de custo..."
              className={\`w-full px-4 py-3 bg-gray-900 border rounded-xl text-sm text-white outline-none focus:border-brand-primary transition-colors resize-none \${
                errors.notes ? "border-red-500" : "border-gray-700 hover:border-gray-600"
              }\`}
            />
            {errors.notes && <span className="text-xs text-red-500 ml-1">{errors.notes}</span>}
          </div>

          `;
  
  content = content.replace(splitTarget, notesField + splitTarget);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Patched JSX!");
} else {
  console.log("Could not find splitTarget");
}
