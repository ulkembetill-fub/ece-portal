import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ciro',
  imports: [CommonModule, FormsModule],
  templateUrl: './ciro.html',
  styleUrl: './ciro.css',
})
export class Ciro implements OnInit {

  months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  allData: any[] = [];
  filteredData: any[] = [];

  selectedMall = '';
  selectedMonth = 0;

  malls: string[] = [];

  ngOnInit() {
    this.allData = this.getMockData();
    this.malls = [...new Set(this.allData.map(d => d.mall))];
    this.applyFilters();
  }

  applyFilters() {
    this.filteredData = this.allData.filter(row => {
      if (this.selectedMall && row.mall !== this.selectedMall) return false;
      return true;
    });
  }

  getDisplayAmounts(amounts: number[]) {
    if (this.selectedMonth > 0) {
      return [amounts[this.selectedMonth - 1]];
    }
    return amounts;
  }

  getDisplayMonths() {
    if (this.selectedMonth > 0) {
      return [this.months[this.selectedMonth - 1]];
    }
    return this.months;
  }

  getMockData() {
    return [
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'MİGROS',   branch: 'Grocery', amounts: [101697220,105822921,126442847,118000000,122000000,130000000,115000000,119000000,128000000,133000000,140000000,145000000] },
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'LCW',       branch: 'Fashion', amounts: [24195981,18928851,36646449,20000000,22000000,25000000,19000000,21000000,23000000,27000000,29000000,31000000] },
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'STARBUCKS', branch: 'F&B',     amounts: [3200000,2980000,3750000,2900000,3100000,3500000,2700000,2900000,3200000,3600000,3900000,4200000] },
      { mall: 'AFİ', lotType: 'MAĞAZA', brand: 'ZARA',      branch: 'Fashion', amounts: [18500000,16200000,22000000,17000000,19000000,21500000,16000000,17500000,19500000,22000000,24000000,26000000] },
      { mall: 'AFİ', lotType: 'MAĞAZA', brand: 'H&M',       branch: 'Fashion', amounts: [15200000,13800000,19500000,14500000,16000000,18000000,13500000,14800000,16500000,18500000,20000000,22000000] },
      { mall: 'AFİ', lotType: 'KİOSK',  brand: 'TURKCELL',  branch: 'Misc',    amounts: [820000,750000,920000,700000,780000,870000,660000,720000,800000,900000,980000,1050000] },
    ];
  }

  getTotal(amounts: number[]) {
    return amounts.reduce((a, b) => a + b, 0);
  }

  getTotalCiro() {
    return this.filteredData.reduce((sum, row) => sum + this.getTotal(row.amounts), 0);
  }

  fmt(n: number) {
    if (!n) return '—';
    return n.toLocaleString('tr-TR');
  }

  sectorColor(branch: string): string {
    const colors: Record<string, string> = {
      'Fashion':       '#3b82f6',
      'F&B':           '#f59e0b',
      'Grocery':       '#10b981',
      'Entertainment': '#8b5cf6',
      'Electronics':   '#06b6d4',
      'Misc':          '#6b7280',
      'Sport':         '#f97316',
      'Beauty':        '#e879f9',
    };
    const key = Object.keys(colors).find(k => branch.toLowerCase().includes(k.toLowerCase()));
    return key ? colors[key] : '#4a5568';
  }
}