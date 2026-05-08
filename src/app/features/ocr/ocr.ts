import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OdataService } from '../../core/odata';

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

interface MonthData {
  month: number;
  rent: number;
  cac: number;
  turnover: number;
  toRent: number;
  ocr: number | null;
}

interface ContractOcr {
  contractNo: string;
  mallCode: string;
  mallName: string;
  brandName: string;
  tenantName: string;
  lotNo: string;
  lotType: string;
  areaM2: number;
  sector: string;
  toRate: number;
  period: string;
  rent: number;
  cac: number;
  turnover: number;
  toRent: number;
  ocr: number | null;
  monthData: MonthData[];
  expanded: boolean;
}

@Component({
  selector: 'app-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr.html',
  styleUrl: './ocr.css',
})
export class Ocr implements OnInit {

  months = MONTHS;
  allMalls = ['MCA', 'TCA', 'AFI', 'FBI', 'PAI', 'MCB', 'PAA', 'MWI', 'CPI'];
  selectedMall = '';
  selectedYear = 2026;
  years = [2026, 2025, 2024];

  allResults: ContractOcr[] = [];
  filteredResults: ContractOcr[] = [];
  searchText = '';
  loading = false;
  error = '';

  get totalRent(): number { return this.filteredResults.reduce((s, r) => s + r.rent, 0); }
  get totalCac(): number { return this.filteredResults.reduce((s, r) => s + r.cac, 0); }
  get totalTurnover(): number { return this.filteredResults.reduce((s, r) => s + r.turnover, 0); }
  get totalToRent(): number { return this.filteredResults.reduce((s, r) => s + r.toRent, 0); }
  get portfolioOcr(): number | null {
    return this.totalTurnover > 0
      ? (this.totalRent + this.totalCac + this.totalToRent) / this.totalTurnover
      : null;
  }

  constructor(private odata: OdataService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {}

  loadData() {
    this.loading = true;
    this.error = '';
    this.allResults = [];
    this.filteredResults = [];
    this.cdr.detectChanges();

    forkJoin({
      contracts: this.odata.getOcrContractList(this.selectedMall).pipe(catchError(() => of({ value: [] }))),
      rent:      this.odata.getOcrRentAll(this.selectedMall, this.selectedYear).pipe(catchError(() => of({ value: [] }))),
      cac:       this.odata.getOcrCacAll(this.selectedMall, this.selectedYear).pipe(catchError(() => of({ value: [] }))),
      turnover:  this.odata.getOcrTurnoverAll(this.selectedMall, this.selectedYear).pipe(catchError(() => of({ value: [] }))),
    }).subscribe({
      next: (res: any) => {
        const rentMap = new Map<string, number>();
        const cacMap  = new Map<string, number>();
        const turnMap = new Map<string, number>();

        for (const e of (res.rent.value || [])) {
          const key = `${e.Contract_No}_${e.Invoice_Month}`;
          rentMap.set(key, (rentMap.get(key) || 0) + (e.Original_Amt_LCY ?? 0));
        }
        for (const e of (res.cac.value || [])) {
          const key = `${e.Contract_No}_${e.Invoice_Month}`;
          cacMap.set(key, (cacMap.get(key) || 0) + (e.Original_Amt_LCY ?? 0));
        }
        for (const e of (res.turnover.value || [])) {
          const key = `${e.Contract_No}_${e.Month}`;
          turnMap.set(key, (turnMap.get(key) || 0) + (e.Amount ?? 0));
        }

        this.allResults = (res.contracts.value || [])
          .map((c: any) => {
            const toPct = (c.Rent_Invoice_Ratio || 0) / 100;

            const monthData: MonthData[] = Array.from({ length: 12 }, (_, i) => {
              const m        = i + 1;
              const key      = `${c.No}_${m}`;
              const rent     = (rentMap.get(key) || 0) / 1.20;
              const cac      = (cacMap.get(key) || 0) / 1.20;
              const turnover = turnMap.get(key) || 0;
              // Ciro kirası sabit kiradan yüksekse fark kesilir, yoksa 0
              const toRent   = turnover > 0 ? Math.max(0, turnover * toPct - rent) : 0;
              // OCR = (Sabit Kira + Ciro Kira Farkı + CAC) / Ciro
              const ocr      = turnover > 0 ? (rent + toRent + cac) / turnover : null;
              return { month: m, rent, cac, turnover, toRent, ocr };
            });

            const totalRent     = monthData.reduce((s, m) => s + m.rent, 0);
            const totalCac      = monthData.reduce((s, m) => s + m.cac, 0);
            const totalTurnover = monthData.reduce((s, m) => s + m.turnover, 0);
            const totalToRent   = monthData.reduce((s, m) => s + m.toRent, 0);
            const ocr = totalTurnover > 0
              ? (totalRent + totalToRent + totalCac) / totalTurnover
              : null;

            return {
              contractNo: c.No,
              mallCode:   c.Mall_Code,
              mallName:   c.Mall_Name,
              brandName:  c.Brand_Name,
              tenantName: c.Tenant_Name,
              lotNo:      c.Lot_No,
              lotType:    c.Lot_Location_Code,
              areaM2:     c.Area_m2,
              sector:     c.SectorName,
              toRate:     c.Rent_Invoice_Ratio || 0,
              period:     c.Period_Remark,
              rent: totalRent,
              cac: totalCac,
              turnover: totalTurnover,
              toRent: totalToRent,
              ocr,
              monthData,
              expanded: false
            };
          })
          .filter((r: ContractOcr) => r.turnover > 0 || r.rent > 0);

        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = 'Veri yüklenirken hata: ' + err.message;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleExpand(r: ContractOcr) {
    r.expanded = !r.expanded;
  }

  applyFilter() {
    const q = this.searchText.trim().toLowerCase();
    this.filteredResults = this.allResults.filter(r => {
      if (!q) return true;
      return r.brandName.toLowerCase().includes(q)
        || r.contractNo.toLowerCase().includes(q)
        || r.tenantName.toLowerCase().includes(q)
        || r.lotNo.toLowerCase().includes(q)
        || r.sector.toLowerCase().includes(q);
    });
  }

  fmt(n: number): string {
    if (!n && n !== 0) return '—';
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatOcr(val: number | null): string {
    if (val === null) return '—';
    return '%' + (val * 100).toFixed(1);
  }

  ocrClass(val: number | null): string {
    if (val === null) return '';
    if (val < 0.08) return 'ocr-low';
    if (val < 0.12) return 'ocr-mid';
    return 'ocr-high';
  }
}