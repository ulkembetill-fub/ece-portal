import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OdataService } from '../../core/odata';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';

const MONTHS = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];

interface BrandRow {
  brandName: string;
  brandCode: string;
  tenantName: string;
  customerNo: string;
  mallCode: string;
  contractNo: string;
  lotNo: string;
  usesPortal: boolean;
  totalEntries: number;
  portalEntries: number;
  totalAmount: number;
  monthlyData: MonthEntry[];
}

interface MonthEntry {
  month: number;
  total: number;
  portal: number;
}

interface MonthStat {
  month: string;
  total: number;
  portal: number;
  pct: number;
}

@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal.html',
  styleUrl: './portal.css'
})
export class Portal implements OnInit {
  loading = false;
  error = '';
  allData: any[] = [];
  brands: BrandRow[] = [];
  filteredBrands: BrandRow[] = [];
  monthStats: MonthStat[] = [];
  selectedYear = 2026;
  years = [2026, 2025, 2024];
  selectedMall = 'Tümü';
  malls: string[] = [];
  searchText = '';
  activeTab: 'portal' | 'noportal' | 'table' = 'noportal';
  selectedBrand: BrandRow | null = null;
  showMailModal = false;
  mailTo = '';
  mailSubject = '';
  mailBody = '';
  months = MONTHS;
  contractMap = new Map<string, { no: string; lot: string; tenantName: string }>();

  totalBrands = 0;
  portalBrands = 0;
  noPortalBrands = 0;
  portalEntries = 0;
  totalEntries = 0;
  portalPct = 0;

  constructor(private odata: OdataService) {}

  ngOnInit() {}

  loadData() {
    this.loading = true;
    this.error = '';
    forkJoin({
      turnover: this.odata.getPortalKullanim(this.selectedYear),
      contracts: this.odata.getContractList()
    }).subscribe({
      next: (res) => {
        this.allData = res.turnover.value || [];

        this.contractMap = new Map<string, { no: string; lot: string; tenantName: string }>();
        for (const c of (res.contracts.value || [])) {
          const key = (c.Brand_Code || '') + '_' + (c.Mall_Code || '');
          if (!this.contractMap.has(key)) {
            this.contractMap.set(key, {
              no: c.No || '',
              lot: c.Lot_No || '',
              tenantName: c.Tenant_Name || ''
            });
          }
        }

        this.malls = ['Tümü', ...new Set<string>(
          this.allData.map((d: any) => d.Mall_Code).filter(Boolean)
        )].sort();

        this.buildStats();
        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Veri yüklenemedi: ' + err.message;
        this.loading = false;
      }
    });
  }

  buildStats() {
    let data = this.allData;
    if (this.selectedMall !== 'Tümü') {
      data = data.filter((d: any) => d.Mall_Code === this.selectedMall);
    }

    const brandMap = new Map<string, BrandRow>();

    for (const d of data) {
      const key = (d.Brand_Code || d.Brand_Name) + '_' + (d.Mall_Code || '');
      if (!brandMap.has(key)) {
        const contractKey = (d.Brand_Code || '') + '_' + (d.Mall_Code || '');
        const contract = this.contractMap.get(contractKey);
        brandMap.set(key, {
          brandName: d.Brand_Name || '',
          brandCode: d.Brand_Code || '',
          tenantName: contract?.tenantName || '',
          customerNo: d.Customer_No || '',
          mallCode: d.Mall_Code || '',
          contractNo: contract?.no || '—',
          lotNo: contract?.lot || '—',
          usesPortal: false,
          totalEntries: 0,
          portalEntries: 0,
          totalAmount: 0,
          monthlyData: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, portal: 0 }))
        });
      }

      const b = brandMap.get(key)!;
      b.totalEntries++;
      b.totalAmount += d.Amount || 0;

      if (d.Month >= 1 && d.Month <= 12) {
        b.monthlyData[d.Month - 1].total++;
        if (d.Created_From_Web_Portal) {
          b.monthlyData[d.Month - 1].portal++;
        }
      }

      if (d.Created_From_Web_Portal) {
        b.portalEntries++;
        b.usesPortal = true;
      }
    }

    this.brands = Array.from(brandMap.values())
      .sort((a, b) => a.brandName.localeCompare(b.brandName, 'tr'));

    this.totalBrands = this.brands.length;
    this.portalBrands = this.brands.filter(b => b.usesPortal).length;
    this.noPortalBrands = this.brands.filter(b => !b.usesPortal).length;
    this.totalEntries = data.length;
    this.portalEntries = data.filter((d: any) => d.Created_From_Web_Portal).length;
    this.portalPct = this.totalBrands > 0
      ? Math.round(this.portalBrands / this.totalBrands * 100) : 0;

    this.monthStats = MONTHS.map((m, i) => {
      const monthData = data.filter((d: any) => d.Month === i + 1);
      const total = monthData.length;
      const portal = monthData.filter((d: any) => d.Created_From_Web_Portal).length;
      return { month: m, total, portal, pct: total > 0 ? Math.round(portal / total * 100) : 0 };
    });

    this.applyTabFilter();
  }

  getMonthIcon(entry: MonthEntry): string {
    if (entry.total === 0) return '—';
    if (entry.portal === entry.total) return '✅';
    if (entry.portal > 0) return '⚡';
    return '❌';
  }

  getMonthTitle(entry: MonthEntry): string {
    if (entry.total === 0) return 'Giriş yok';
    return `${entry.portal} portal / ${entry.total} toplam`;
  }

  applyTabFilter() {
    let list: BrandRow[];

    if (this.activeTab === 'table') {
      list = [...this.brands];
    } else if (this.activeTab === 'portal') {
      list = this.brands.filter(b => b.usesPortal);
    } else {
      list = this.brands.filter(b => !b.usesPortal);
    }

    if (this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      list = list.filter(b =>
        b.brandName.toLowerCase().includes(q) ||
        b.tenantName.toLowerCase().includes(q) ||
        b.contractNo.toLowerCase().includes(q) ||
        b.lotNo.toLowerCase().includes(q)
      );
    }

    this.filteredBrands = list;
  }

  setTab(tab: 'portal' | 'noportal' | 'table') {
    this.activeTab = tab;
    this.searchText = '';
    this.applyTabFilter();
  }

  openMailModal(brand: BrandRow) {
    this.selectedBrand = brand;
    this.mailTo = '';
    this.mailSubject = `${brand.mallCode} - ${brand.brandName} Portal Kullanımı Hakkında`;
    this.mailBody = `Sayın ${brand.tenantName || brand.brandName} yetkilileri,\n\nECE Türkiye olarak kiracılarımıza sunduğumuz web portalımız üzerinden ciro girişi yapılmasını teşvik etmekteyiz.\n\nPortalımızı kullanmaya başlamak için lütfen bizimle iletişime geçiniz.\n\nİyi çalışmalar,\nECE Türkiye`;
    this.showMailModal = true;
  }

  closeMailModal() {
    this.showMailModal = false;
    this.selectedBrand = null;
  }

  sendMail() {
    const link = `mailto:${this.mailTo}?subject=${encodeURIComponent(this.mailSubject)}&body=${encodeURIComponent(this.mailBody)}`;
    window.open(link);
    this.closeMailModal();
  }

  mailAllNoPortal() {
    const body = `Sayın Yetkili,\n\nECE Türkiye web portalımız üzerinden ciro girişi yapılmasını teşvik etmekteyiz.\n\nLütfen bizimle iletişime geçiniz.\n\nİyi çalışmalar,\nECE Türkiye`;
    const subject = `Portal Kullanımı Hakkında`;
    const link = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(link);
  }

  exportExcel() {
    const rows = this.brands.map(b => ({
      'Marka': b.brandName,
      'Cari Unvan': b.tenantName,
      'Marka Kodu': b.brandCode,
      'AVM': b.mallCode,
      'Sözleşme No': b.contractNo,
      'Lot No': b.lotNo,
      'Portal Kullanıyor': b.usesPortal ? '✅ Evet' : '❌ Hayır',
      'Toplam Giriş': b.totalEntries,
      'Portal Girişi': b.portalEntries,
      'Oran (%)': b.totalEntries > 0 ? Math.round(b.portalEntries / b.totalEntries * 100) : 0,
      ...Object.fromEntries(MONTHS.map((m, i) => {
        const entry = b.monthlyData[i];
        if (entry.total === 0) return [m, '—'];
        if (entry.portal === entry.total) return [m, '✅'];
        if (entry.portal > 0) return [m, '⚡'];
        return [m, '❌'];
      }))
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Portal Kullanim');
    XLSX.writeFile(wb, `portal-kullanim-${this.selectedYear}.xlsx`);
  }

  getBarWidth(val: number, max: number): number {
    return max > 0 ? (val / max) * 100 : 0;
  }

  maxMonthTotal(): number {
    return Math.max(...this.monthStats.map(m => m.total), 1);
  }
}