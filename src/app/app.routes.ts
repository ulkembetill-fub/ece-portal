import { Routes } from '@angular/router';
import { Ciro } from './features/ciro/ciro';
import { Aging } from './features/aging/aging';
import { Tahsilat } from './features/tahsilat/tahsilat';
import { Teminat } from './features/teminat/teminat';
import { Portal } from './features/portal/portal';
import { Ocr } from './features/ocr/ocr';
import { MissingDeposit } from './features/missing-deposit/missing-deposit';
import { CiroAnalitik } from './features/ciro-analitik/ciro-analitik';

export const routes: Routes = [
  { path: 'ciro', component: Ciro },
  { path: 'aging', component: Aging },
  { path: 'tahsilat', component: Tahsilat },
  { path: 'teminat', component: Teminat },
  { path: 'portal', component: Portal },
  { path: 'ocr', component: Ocr },
  { path: 'missing-deposit', component: MissingDeposit },
  { path: 'ciro-analitik', component: CiroAnalitik },
  { path: '', redirectTo: 'ciro', pathMatch: 'full' },
];