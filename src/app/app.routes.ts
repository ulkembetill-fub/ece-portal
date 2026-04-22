import { Routes } from '@angular/router';
import { Ciro } from './features/ciro/ciro';
import { Aging } from './features/aging/aging';
import { Tahsilat } from './features/tahsilat/tahsilat';

export const routes: Routes = [
  { path: 'ciro', component: Ciro },
  { path: 'aging', component: Aging },
  { path: 'tahsilat', component: Tahsilat },
  { path: '', redirectTo: 'ciro', pathMatch: 'full' },
];