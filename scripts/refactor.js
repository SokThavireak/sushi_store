import fs from 'fs';

let content = fs.readFileSync('c:/Users/SOK THAVIREAK/Desktop/sushi_store/controllers/adminController.js', 'utf8');

content = content.replace(/res\.render\([^,]+,\s*(\{[\s\S]*?\})\);/g, 'res.json($1);');
content = content.replace(/return res\.redirect\(307,\s*[^)]+\);/g, 'return res.json({ success: false, action: "redirect" });');
content = content.replace(/return res\.redirect\([^)]+\);/g, 'return res.json({ success: true });');
content = content.replace(/res\.redirect\([^)]+\);/g, 'res.json({ success: true });');
content = content.replace(/res\.send\(`<script>.*?<\/script>`\);/g, 'res.status(400).json({ error: "Action failed" });');
content = content.replace(/res\.status\([^)]+\)\.send\([^)]+\);/g, 'res.status(500).json({ error: "Server error" });');

fs.writeFileSync('c:/Users/SOK THAVIREAK/Desktop/sushi_store/controllers/adminController.js', content);
console.log("adminController refactored");

let managerContent = fs.readFileSync('c:/Users/SOK THAVIREAK/Desktop/sushi_store/controllers/managerController.js', 'utf8');
managerContent = managerContent.replace(/res\.render\([^,]+,\s*(\{[\s\S]*?\})\);/g, 'res.json($1);');
managerContent = managerContent.replace(/return res\.redirect\(307,\s*[^)]+\);/g, 'return res.json({ success: false, action: "redirect" });');
managerContent = managerContent.replace(/return res\.redirect\([^)]+\);/g, 'return res.json({ success: true });');
managerContent = managerContent.replace(/res\.redirect\([^)]+\);/g, 'res.json({ success: true });');
managerContent = managerContent.replace(/res\.send\(`<script>.*?<\/script>`\);/g, 'res.status(400).json({ error: "Action failed" });');
managerContent = managerContent.replace(/res\.status\([^)]+\)\.send\([^)]+\);/g, 'res.status(500).json({ error: "Server error" });');
fs.writeFileSync('c:/Users/SOK THAVIREAK/Desktop/sushi_store/controllers/managerController.js', managerContent);
console.log("managerController refactored");
