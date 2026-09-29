const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(p, "utf-8");

// Remove the window notification and toast from kanban/page.tsx listener
const listenerRegex = /if \(payload\.eventType === "INSERT"\) \{[\s\S]*?if \(payload\.eventType === "UPDATE"\) \{/g;
code = code.replace(listenerRegex, (match) => {
  return `if (payload.eventType === "INSERT") {
              const newRequest = payload.new as PaymentRequest;
              if (userRole === "GESTOR" && newRequest.real_requester_id !== userId && newRequest.created_by !== userId) {
                return;
              }
              setCards((prev) => {
                  if (prev.some(c => c.id === newRequest.id)) return prev;
                  return [newRequest, ...prev];
              });
            }

            if (payload.eventType === "UPDATE") {`;
});

const updateRegex = /if \(payload\.eventType === "UPDATE"\) \{[\s\S]*?if \(oldRequest && oldRequest\.status !== updatedRequest\.status\) \{[\s\S]*?setToast\(\{ message:[^\n]+\n[\s\S]*?if \("Notification" in window && Notification\.permission === "granted"\) \{[\s\S]*?new Notification\([^\n]+\n[\s\S]*?body:[^\n]+\n[\s\S]*?\}\);[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/g;

code = code.replace(updateRegex, (match) => {
  return `if (payload.eventType === "UPDATE") {
              const updatedRequest = payload.new as PaymentRequest;
              const oldRequest = payload.old as PaymentRequest;
              
              setCards((prev) =>
                prev.map((c) => (c.id === updatedRequest.id ? updatedRequest : c))
              );
            }`;
});

fs.writeFileSync(p, code);
console.log("kanban/page.tsx realtime listener simplified.");
