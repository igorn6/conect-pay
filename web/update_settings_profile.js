const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/settings/SettingsProfile.tsx");
let code = fs.readFileSync(file, 'utf8');

// Import useRef
code = code.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useRef } from "react";'
);

// Add auth context variables
code = code.replace(
  'const { userName } = useAuth();',
  'const { userName, userId, avatarUrl: authAvatarUrl, setAvatarUrl } = useAuth();\n  const fileInputRef = useRef<HTMLInputElement>(null);'
);

// Replace handleAvatarClick
const uploadLogic = `
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("O arquivo deve ter no mximo 2MB.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = \`\${userId}-\${Math.random()}.\${fileExt}\`;
      const filePath = \`\${fileName}\`;

      // Upload para o bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Pegar URL publica
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Atualizar Contexto
      setAvatarUrl(publicUrl);
      showToast("Foto de perfil atualizada com sucesso!", "success");
    } catch (err: any) {
      showToast("Erro ao fazer upload da foto: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
`;
code = code.replace(
  /const handleAvatarClick = \(\) => \{[\s\S]*?\};/,
  uploadLogic
);

// Update Avatar URL display
code = code.replace(
  'const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNome)}&background=334155&color=fff&size=128`;',
  'const avatarUrl = authAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNome)}&background=334155&color=fff&size=128`;'
);

// Add hidden input
code = code.replace(
  '<button \n              onClick={handleAvatarClick}',
  '<input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />\n            <button \n              onClick={handleAvatarClick}'
);

fs.writeFileSync(file, code);
console.log("Updated SettingsProfile.tsx");
