import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { OdataService } from '../../core/odata';

@Component({
  selector: 'app-ciro',
  imports: [CommonModule, FormsModule],
  templateUrl: './ciro.html',
  styleUrl: './ciro.css',
})
export class Ciro implements OnInit {

  months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  allData: any[] = [];
  tree: any[] = [];

  selectedMall = '';
  selectedMonth = 0;
  selectedYear: number;
  years: number[] = [];
  malls: string[] = [];

  expandedMalls: Set<string> = new Set();
  expandedLots: Set<string> = new Set();

  loading = false;
  error = '';

  constructor(private odataService: OdataService) {
    const now = new Date().getFullYear();
    this.selectedYear = now;
    this.years = [now - 1, now, now + 1];
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    this.odataService.getTurnover(this.selectedYear).subscribe({
      next: (res) => {
        const raw = res.value || [];
        if (raw.length === 0) {
          this.useMockData();
        } else {
          this.allData = raw;
          this.malls = [...new Set(this.allData.map((d: any) => d.Mall_Code))];
          this.buildTree();
        }
        this.loading = false;
      },
      error: () => {
        this.useMockData();
        this.loading = false;
      }
    });
  }

  useMockData() {
    this.error = 'OData bağlantısı yok — demo veri gösteriliyor.';
    this.allData = this.getMockData();
    this.malls = [...new Set(this.allData.map((d: any) => d.mall))];
    this.buildTree();
  }

  selectYear(year: number) {
    this.selectedYear = year;
    this.loadData();
  }

  buildTree() {
    const filtered = this.allData.filter((row: any) => {
      const mallCode = row.Mall_Code || row.mall;
      if (this.selectedMall && mallCode !== this.selectedMall) return false;
      return true;
    });

    const mallMap: any = {};

    for (const row of filtered) {
      const mall = row.Mall_Code || row.mall || '?';
      const lot = row.Lot_Type || row.lotType || 'MAĞAZA';
      const brand = row.Brand_Name || row.brand || '?';
      const branch = row.Branch || row.branch || 'Diğer';

      if (!mallMap[mall]) mallMap[mall] = { name: mall, lots: {}, months: Array(12).fill(0) };
      if (!mallMap[mall].lots[lot]) mallMap[mall].lots[lot] = { name: lot, brands: {}, months: Array(12).fill(0) };
      if (!mallMap[mall].lots[lot].brands[brand]) {
        mallMap[mall].lots[lot].brands[brand] = { brand, branch, amounts: Array(12).fill(0) };
      }

      if (row.Mall_Code) {
        // OData verisi — her satır bir ay
        const month = (row.Month || 1) - 1;
        const amount = parseFloat(row.Amount || 0);
        mallMap[mall].lots[lot].brands[brand].amounts[month] += amount;
        mallMap[mall].lots[lot].months[month] += amount;
        mallMap[mall].months[month] += amount;
      } else {
        // Mock veri — amounts dizisi var
        row.amounts.forEach((a: number, i: number) => {
          mallMap[mall].lots[lot].brands[brand].amounts[i] += a;
          mallMap[mall].lots[lot].months[i] += a;
          mallMap[mall].months[i] += a;
        });
      }
    }

    this.tree = Object.values(mallMap).map((mall: any) => ({
      ...mall,
      lots: Object.values(mall.lots).map((lot: any) => ({
        ...lot,
        brands: Object.values(lot.brands),
      })),
    }));
  }

  applyFilters() {
    this.buildTree();
  }

  toggleMall(mallName: string) {
    if (this.expandedMalls.has(mallName)) this.expandedMalls.delete(mallName);
    else this.expandedMalls.add(mallName);
  }

  toggleLot(key: string) {
    if (this.expandedLots.has(key)) this.expandedLots.delete(key);
    else this.expandedLots.add(key);
  }

  isMallExpanded(mallName: string) { return this.expandedMalls.has(mallName); }
  isLotExpanded(key: string) { return this.expandedLots.has(key); }

  expandAll() {
    this.tree.forEach(mall => {
      this.expandedMalls.add(mall.name);
      mall.lots.forEach((lot: any) => this.expandedLots.add(mall.name + '|||' + lot.name));
    });
  }

  collapseAll() {
    this.expandedMalls.clear();
    this.expandedLots.clear();
  }

  getDisplayMonths() {
    if (this.selectedMonth > 0) return [this.months[this.selectedMonth - 1]];
    return this.months;
  }

  getDisplayAmounts(amounts: number[]) {
    if (this.selectedMonth > 0) return [amounts[this.selectedMonth - 1]];
    return amounts;
  }

  getGrandMonths(): number[] {
    const result = Array(12).fill(0);
    this.tree.forEach(mall => mall.months.forEach((v: number, i: number) => result[i] += v));
    return result;
  }

  exportExcel() {
    const wb = XLSX.utils.book_new();
    const rows: any[] = [];
    const activeCols = this.selectedMonth > 0
      ? [this.selectedMonth - 1]
      : Array.from({length: 12}, (_, i) => i);

    rows.push(['Mall', 'Lot Tipi', 'Brand', 'Sektör', ...activeCols.map(i => this.months[i]), 'Toplam']);

    for (const mall of this.tree) {
      const mallAmts = activeCols.map(i => mall.months[i]);
      rows.push([mall.name, '', '', '', ...mallAmts, mallAmts.reduce((a:number,b:number)=>a+b,0)]);
      for (const lot of mall.lots) {
        const lotAmts = activeCols.map(i => lot.months[i]);
        rows.push(['', lot.name, '', '', ...lotAmts, lotAmts.reduce((a:number,b:number)=>a+b,0)]);
        for (const brand of lot.brands) {
          const brandAmts = activeCols.map(i => brand.amounts[i]);
          rows.push(['', '', brand.brand, brand.branch, ...brandAmts, brandAmts.reduce((a:number,b:number)=>a+b,0)]);
        }
      }
    }

    const grandAmts = activeCols.map(i => this.getGrandMonths()[i]);
    rows.push(['GENEL TOPLAM', '', '', '', ...grandAmts, grandAmts.reduce((a:number,b:number)=>a+b,0)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Ciro Raporu');
    const mall = this.selectedMall || 'Tum';
    const donem = this.selectedMonth > 0 ? this.months[this.selectedMonth - 1] : 'TumYil';
    XLSX.writeFile(wb, `CiroRaporu_${mall}_${this.selectedYear}_${donem}.xlsx`);
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
    return this.tree.reduce((sum, mall) => sum + this.getTotal(mall.months), 0);
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