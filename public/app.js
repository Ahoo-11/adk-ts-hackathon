function $(id){return document.getElementById(id)}
function setText(id, text){ const el = $(id); if(el) el.textContent = text }

// Base URLs
const baseUrl = window.location.origin;
const mcpUrl = baseUrl + "/mcp";
setText("baseUrl", baseUrl);
setText("mcpUrl", mcpUrl);

// Fill connect URL and start commands dynamically
setText("connectUrl", mcpUrl);
const port = window.location.port || "3000";
setText("cmdStartPort", `$env:PORT=${port}; npm run dev:http`);

// Copy buttons
Array.from(document.querySelectorAll(".copy")).forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const target = $(targetId);
    const text = target?.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = btn.getAttribute("data-target")?.includes("URL") ? "Copy URL" : "Copy", 1200);
    }).catch(() => {
      alert("Copy failed. Please copy manually.");
    });
  });
});

// REST playground
function params(){
  const q = new URLSearchParams();
  const city = $("city").value.trim();
  const country = $("country").value.trim();
  const units = $("units").value;
  if(city) q.set("city", city);
  if(country) q.set("country", country);
  if(units) q.set("units", units);
  return q;
}

$("btnCurrent").addEventListener("click", async () => {
  try{
    const q = params();
    const res = await fetch(`/api/current?${q}`);
    const data = await res.json();
    $("output").textContent = JSON.stringify(data, null, 2);
  }catch(e){
    $("output").textContent = String(e);
  }
});

$("btnForecast").addEventListener("click", async () => {
  try{
    const q = params();
    const days = $("days").value;
    if(days) q.set("days", days);
    const res = await fetch(`/api/forecast?${q}`);
    const data = await res.json();
    $("output").textContent = JSON.stringify(data, null, 2);
  }catch(e){
    $("output").textContent = String(e);
  }
});