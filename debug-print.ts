import { EPMLCompiler } from "./src/index.js";

const template = `
<receipt width="48">
  <text>HELLO WORLD</text>
  <cut mode="partial"/>
</receipt>
`;

const res = EPMLCompiler.compile(template, {});
console.log("Bytes:", Array.from(res.bytes));
console.log("String version:", new TextDecoder().decode(res.bytes));
