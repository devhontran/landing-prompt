// Sao chép bộ giải mã KTX2/Basis (dùng khi model .glb có texture KTX2) vào public/basis/.
import { cpSync, mkdirSync, existsSync } from 'node:fs'
const src = 'node_modules/three/examples/jsm/libs/basis'
if (existsSync(src)) {
  mkdirSync('public/basis', { recursive: true })
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) cpSync(`${src}/${f}`, `public/basis/${f}`)
}
