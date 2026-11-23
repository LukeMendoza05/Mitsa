import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'ui-refinement.spec.ts',workers:1,retries:0,timeout:120000,reporter:'list',
 use:{baseURL:'http://127.0.0.1:3107',channel:'msedge',viewport:{width:1440,height:900},reducedMotion:'reduce',trace:'off',screenshot:'off'},
 webServer:{command:'node node_modules/vite/bin/vite.js --config tests/visual/vite.config.mjs',url:'http://127.0.0.1:3107/login',reuseExistingServer:true,timeout:60000}});
