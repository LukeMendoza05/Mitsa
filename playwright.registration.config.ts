import {defineConfig} from '@playwright/test';
import base from './playwright.ui-refinement.config';
export default defineConfig({...base,testDir:'./tests/visual',testMatch:'registration-availability.spec.ts'});
