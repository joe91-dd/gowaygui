// Preferred CLI entry; retain the historical docs/reports entry for existing callers.
const {main}=require('../../docs/reports/verify-chapter-build.cjs');
if(require.main===module)main();
module.exports={main};
