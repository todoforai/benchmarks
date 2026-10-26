import fs from "node:fs";
const root="/home/hm/repo/todoforai/benchmarks/airbench-ai/runs/qwen38-isolated-20261007-113654";
function done(){const f=root+"/run.json";if(fs.existsSync(f)){try{const r=JSON.parse(fs.readFileSync(f,"utf8"));console.log(JSON.stringify(r));process.exit(0)}catch{}}}
const watcher=fs.watch(root,(event,name)=>{if(name==="run.json")done()});done();
