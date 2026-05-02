import { Routes } from '@angular/router';
import { Ciro } from './features/ciro/ciro';
import { Aging } from './features/aging/aging';
import { Tahsilat } from './features/tahsilat/tahsilat';
import { Teminat } from './features/teminat/teminat';

export const routes: Routes = [
  { path: 'ciro', component: Ciro },
  { path: 'aging', component: Aging },
  { path: 'tahsilat', component: Tahsilat },
  { path: 'teminat', component: Teminat },
  { path: '', redirectTo: 'ciro', pathMatch: 'full' },
];