import { Routes } from '@angular/router';
import { Ciro } from './features/ciro/ciro';
import { Aging } from './features/aging/aging';
import { Tahsilat } from './features/tahsilat/tahsilat';
import { Teminat } from './features/teminat/teminat';
import { Portal } from './features/portal/portal';
import { Ocr } from './features/ocr/ocr';

export const routes: Routes = [
  { path: 'ciro', component: Ciro },
  { path: 'aging', component: Aging },
  { path: 'tahsilat', component: Tahsilat },
  { path: 'teminat', component: Teminat },
  { path: 'portal', component: Portal },
  { path: 'ocr', component: Ocr },
  { path: '', redirectTo: 'ciro', pathMatch: 'full' },
];