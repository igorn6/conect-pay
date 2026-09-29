const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/app/(main)/configuracoes/page.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const oldHandleAdd = `  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatLoading(true);
    await supabase.from("categories").insert([{ name: newCatName.trim(), color: "bg-gray-500" }]);
    setNewCatName("");
    await fetchCategories();
    setCatLoading(false);
  };`;

const newHandleAdd = `  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatLoading(true);
    const { error } = await supabase.from("categories").insert([{ name: newCatName.trim(), color: "bg-gray-500" }]);
    if (error) {
      alert("Erro ao adicionar categoria: " + error.message);
      console.error(error);
    }
    setNewCatName("");
    await fetchCategories();
    setCatLoading(false);
  };`;

content = content.replace(oldHandleAdd, newHandleAdd);

const oldHandleSec = `  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName.trim()) return;
    setSecLoading(true);
    await supabase.from("sectors").insert([{ name: newSecName.trim() }]);
    setNewSecName("");
    await fetchSectors();
    setSecLoading(false);
  };`;

const newHandleSec = `  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName.trim()) return;
    setSecLoading(true);
    const { error } = await supabase.from("sectors").insert([{ name: newSecName.trim() }]);
    if (error) {
      alert("Erro ao adicionar setor: " + error.message);
      console.error(error);
    }
    setNewSecName("");
    await fetchSectors();
    setSecLoading(false);
  };`;

content = content.replace(oldHandleSec, newHandleSec);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched handlers");
