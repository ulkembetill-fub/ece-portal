import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { OdataService } from '../../core/odata';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  contractMap: Map<string, any> = new Map();

  selectedMall = '';
  selectedMonth = 0;
  selectedYear: number;
  years: number[] = [];
  malls: string[] = [];

  expandedMalls: Set<string> = new Set();
  expandedLots: Set<string> = new Set();

  loading = false;
  error = '';

  showYoY = false;
  prevRawData: any[] = [];
  prevMallMap: Map<string, number[]> = new Map();
  prevLotMap: Map<string, number[]> = new Map();
  prevBrandMap: Map<string, number[]> = new Map();
  prevGrandArr: number[] = Array(12).fill(0);

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

    forkJoin({
      turnover: this.odataService.getTurnover(this.selectedYear).pipe(catchError(() => of({ value: [] }))),
      contracts: this.odataService.getContracts().pipe(catchError(() => of({ value: [] }))),
      prevTurnover: this.showYoY
        ? this.odataService.getTurnover(this.selectedYear - 1).pipe(catchError(() => of({ value: [] })))
        : of({ value: [] }),
    }).subscribe({
      next: ({ turnover, contracts, prevTurnover }: any) => {
        this.contractMap = new Map();
        for (const c of (contracts.value || [])) {
          this.contractMap.set(c.No, c);
        }

        const raw = turnover.value || [];
        if (raw.length === 0) {
          this.useMockData();
        } else {
          this.allData = raw;
          this.malls = [...new Set(this.allData.map((d: any) => d.Mall_Code))];
          this.buildTree();
        }

        this.prevRawData = prevTurnover.value || [];
        if (this.showYoY) this.buildPrevMaps();

        this.loading = false;
      },
      error: () => {
        this.useMockData();
        if (this.showYoY) this.buildPrevMaps();
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
      const contractNo = row.Contract_No || '';

      const contractInfo = this.contractMap.get(contractNo);
      const branch = contractInfo?.SectorName || row.Branch || row.branch || 'Diğer';
      const subSector = contractInfo?.SubSectorName || '';

      if (!mallMap[mall]) mallMap[mall] = { name: mall, lots: {}, months: Array(12).fill(0) };
      if (!mallMap[mall].lots[lot]) mallMap[mall].lots[lot] = { name: lot, brands: {}, months: Array(12).fill(0) };
      if (!mallMap[mall].lots[lot].brands[brand]) {
        mallMap[mall].lots[lot].brands[brand] = { brand, branch, subSector, contractNo, amounts: Array(12).fill(0) };
      }

      if (row.Mall_Code) {
        const month = (row.Month || 1) - 1;
        const amount = parseFloat(row.Amount || 0);
        mallMap[mall].lots[lot].brands[brand].amounts[month] += amount;
        mallMap[mall].lots[lot].months[month] += amount;
        mallMap[mall].months[month] += amount;
      } else {
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

  buildPrevMaps() {
    this.prevMallMap.clear();
    this.prevLotMap.clear();
    this.prevBrandMap.clear();
    this.prevGrandArr = Array(12).fill(0);

    const data = this.prevRawData.length ? this.prevRawData : this.getMockData(0.87);
    const filtered = data.filter((row: any) => {
      const mallCode = row.Mall_Code || row.mall;
      if (this.selectedMall && mallCode !== this.selectedMall) return false;
      return true;
    });

    for (const row of filtered) {
      const mall = row.Mall_Code || row.mall || '?';
      const lot = row.Lot_Type || row.lotType || 'MAĞAZA';
      const brand = row.Brand_Name || row.brand || '?';
      const lotKey = `${mall}|||${lot}`;
      const brandKey = `${mall}|||${lot}|||${brand}`;

      if (!this.prevMallMap.has(mall)) this.prevMallMap.set(mall, Array(12).fill(0));
      if (!this.prevLotMap.has(lotKey)) this.prevLotMap.set(lotKey, Array(12).fill(0));
      if (!this.prevBrandMap.has(brandKey)) this.prevBrandMap.set(brandKey, Array(12).fill(0));

      const addAmounts = (amounts: number[]) => {
        amounts.forEach((a, i) => {
          this.prevMallMap.get(mall)![i] += a;
          this.prevLotMap.get(lotKey)![i] += a;
          this.prevBrandMap.get(brandKey)![i] += a;
          this.prevGrandArr[i] += a;
        });
      };

      if (row.Mall_Code) {
        const month = (row.Month || 1) - 1;
        const amount = parseFloat(row.Amount || 0);
        const arr = Array(12).fill(0);
        arr[month] = amount;
        addAmounts(arr);
      } else {
        addAmounts(row.amounts);
      }
    }
  }

  toggleYoY() {
    this.showYoY = !this.showYoY;
    if (this.showYoY) {
      if (this.prevRawData.length) {
        this.buildPrevMaps();
      } else {
        this.loadData();
      }
    } else {
      this.prevMallMap.clear();
      this.prevLotMap.clear();
      this.prevBrandMap.clear();
    }
  }

  prevMallMonth(mallName: string, displayIdx: number): number {
    const arr = this.prevMallMap.get(mallName) || Array(12).fill(0);
    return this.selectedMonth > 0 ? (arr[this.selectedMonth - 1] || 0) : (arr[displayIdx] || 0);
  }

  prevLotMonth(mallName: string, lotName: string, displayIdx: number): number {
    const arr = this.prevLotMap.get(`${mallName}|||${lotName}`) || Array(12).fill(0);
    return this.selectedMonth > 0 ? (arr[this.selectedMonth - 1] || 0) : (arr[displayIdx] || 0);
  }

  prevBrandMonth(mallName: string, lotName: string, brandName: string, displayIdx: number): number {
    const arr = this.prevBrandMap.get(`${mallName}|||${lotName}|||${brandName}`) || Array(12).fill(0);
    return this.selectedMonth > 0 ? (arr[this.selectedMonth - 1] || 0) : (arr[displayIdx] || 0);
  }

  prevGrandMonth(displayIdx: number): number {
    return this.selectedMonth > 0
      ? (this.prevGrandArr[this.selectedMonth - 1] || 0)
      : (this.prevGrandArr[displayIdx] || 0);
  }

  fmtPct(current: number, prev: number): string {
    if (!prev) return '—';
    const pct = ((current - prev) / prev) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }

  pctClass(current: number, prev: number): string {
    if (!prev) return 'yoy-neutral';
    return current >= prev ? 'yoy-up' : 'yoy-down';
  }

  applyFilters() {
    this.buildTree();
    if (this.showYoY) this.buildPrevMaps();
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

    const sumPrev = (arr: number[]) => activeCols.reduce((s, i) => s + (arr[i] || 0), 0);
    const pctStr = (cur: number, prev: number) => prev ? ((cur - prev) / prev * 100).toFixed(1) + '%' : '—';

    const yoyHeaders = this.showYoY ? [`${this.selectedYear - 1} Toplam`, '% Değişim'] : [];
    rows.push(['Mall', 'Lot Tipi', 'Brand', 'Kontrat No', 'Sektör', ...activeCols.map(i => this.months[i]), 'Toplam', ...yoyHeaders]);

    for (const mall of this.tree) {
      const mallAmts = activeCols.map(i => mall.months[i]);
      const mallTotal = mallAmts.reduce((a: number, b: number) => a + b, 0);
      const mallPrev = this.showYoY ? sumPrev(this.prevMallMap.get(mall.name) || Array(12).fill(0)) : null;
      const mallYoy = mallPrev != null ? [mallPrev, pctStr(mallTotal, mallPrev)] : [];
      rows.push([mall.name, '', '', '', '', ...mallAmts, mallTotal, ...mallYoy]);

      for (const lot of mall.lots) {
        const lotAmts = activeCols.map(i => lot.months[i]);
        const lotTotal = lotAmts.reduce((a: number, b: number) => a + b, 0);
        const lotPrev = this.showYoY ? sumPrev(this.prevLotMap.get(`${mall.name}|||${lot.name}`) || Array(12).fill(0)) : null;
        const lotYoy = lotPrev != null ? [lotPrev, pctStr(lotTotal, lotPrev)] : [];
        rows.push(['', lot.name, '', '', '', ...lotAmts, lotTotal, ...lotYoy]);

        for (const brand of lot.brands) {
          const brandAmts = activeCols.map(i => brand.amounts[i]);
          const brandTotal = brandAmts.reduce((a: number, b: number) => a + b, 0);
          const brandPrev = this.showYoY ? sumPrev(this.prevBrandMap.get(`${mall.name}|||${lot.name}|||${brand.brand}`) || Array(12).fill(0)) : null;
          const brandYoy = brandPrev != null ? [brandPrev, pctStr(brandTotal, brandPrev)] : [];
          rows.push(['', '', brand.brand, brand.contractNo || '—', brand.branch, ...brandAmts, brandTotal, ...brandYoy]);
        }
      }
    }

    const grandAmts = activeCols.map(i => this.getGrandMonths()[i]);
    const grandTotal = grandAmts.reduce((a: number, b: number) => a + b, 0);
    const grandPrev = this.showYoY ? sumPrev(this.prevGrandArr) : null;
    const grandYoy = grandPrev != null ? [grandPrev, pctStr(grandTotal, grandPrev)] : [];
    rows.push(['GENEL TOPLAM', '', '', '', '', ...grandAmts, grandTotal, ...grandYoy]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Ciro Raporu');
    const mall = this.selectedMall || 'Tum';
    const donem = this.selectedMonth > 0 ? this.months[this.selectedMonth - 1] : 'TumYil';
    XLSX.writeFile(wb, `CiroRaporu_${mall}_${this.selectedYear}_${donem}.xlsx`);
  }

  getMockData(factor = 1) {
    const f = (v: number) => Math.round(v * factor);
    return [
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'MİGROS',   branch: 'Grocery',    amounts: [101697220,105822921,126442847,118000000,122000000,130000000,115000000,119000000,128000000,133000000,140000000,145000000].map(f) },
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'LCW',       branch: 'Fashion',    amounts: [24195981,18928851,36646449,20000000,22000000,25000000,19000000,21000000,23000000,27000000,29000000,31000000].map(f) },
      { mall: 'MCB', lotType: 'MAĞAZA', brand: 'STARBUCKS', branch: 'Gastronomy', amounts: [3200000,2980000,3750000,2900000,3100000,3500000,2700000,2900000,3200000,3600000,3900000,4200000].map(f) },
      { mall: 'AFİ', lotType: 'MAĞAZA', brand: 'ZARA',      branch: 'Fashion',    amounts: [18500000,16200000,22000000,17000000,19000000,21500000,16000000,17500000,19500000,22000000,24000000,26000000].map(f) },
      { mall: 'AFİ', lotType: 'MAĞAZA', brand: 'H&M',       branch: 'Fashion',    amounts: [15200000,13800000,19500000,14500000,16000000,18000000,13500000,14800000,16500000,18500000,20000000,22000000].map(f) },
      { mall: 'AFİ', lotType: 'KİOSK',  brand: 'TURKCELL',  branch: 'Services',   amounts: [820000,750000,920000,700000,780000,870000,660000,720000,800000,900000,980000,1050000].map(f) },
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
      'fashion':       '#3b82f6',
      'gastronomy':    '#f59e0b',
      'grocery':       '#10b981',
      'groceries':     '#10b981',
      'hardware':      '#ef4444',
      'health':        '#e879f9',
      'entertainment': '#8b5cf6',
      'electronics':   '#06b6d4',
      'services':      '#6366f1',
      'other':         '#6b7280',
    };
    const key = Object.keys(colors).find(k => branch.toLowerCase().includes(k.toLowerCase()));
    return key ? colors[key] : '#4a5568';
  }
}
