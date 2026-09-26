// Rasterize our editable SVG planning diagram only. Does not start Blender or edit any raster asset.
const path=require('node:path');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
sharp(path.join(__dirname,'layout-proposal.svg')).png().toFile(path.join(__dirname,'layout-proposal.png')).then(info=>console.log(info)).catch(error=>{console.error(error);process.exitCode=1;});
