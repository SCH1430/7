// Shared browser setup for local Windows, macOS/Linux and GitHub Actions.
const path=require('node:path'),os=require('node:os');
function loadPlaywright(){
  if(process.env.PLAYWRIGHT_MODULE)return require(process.env.PLAYWRIGHT_MODULE);
  try{return require('playwright');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  const bundled=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright');
  try{return require(bundled);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  throw Error('Browser checks need Playwright. Run: npm install --no-save --package-lock=false --ignore-scripts playwright@1.62.1; npx playwright install chromium. Or set PLAYWRIGHT_MODULE.');
}
const browser=process.env.PLAYWRIGHT_BROWSER||(process.platform==='win32'?'msedge':'chromium');
if(!['chromium','msedge','chrome'].includes(browser))throw Error('PLAYWRIGHT_BROWSER must be chromium, msedge or chrome.');
const launchOptions={headless:true,args:['--disable-gpu'],...(browser==='chromium'?{}:{channel:browser})};
module.exports={chromium:loadPlaywright().chromium,launchOptions};
