import { generateGemini } from "./dist/src/lib/geminiRunner.js";

const res = await generateGemini("Liste moi ma structure.");
console.log(res);