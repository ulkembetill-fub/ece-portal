import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OdataService } from '../../core/odata';
import * as XLSX from 'xlsx';

const MONTHS = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];

interface BrandRow {
  brandName: string;
  brandCode: string;
  customerNo: string;
  mallCode: string;
  usesPortal: boolean;
  totalEntries: number;
  portalEntries: number;
  totalAmount: number;
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
  activeTab: 'portal' | 'noportal' = 'noportal';
  selectedBrand: BrandRow | null = null;
  showMailModal = false;
  mailTo = '';
  mailSubject = '';
  mailBody = '';

  // Özet
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
    this.odata.getPortalKullanim(this.selectedYear).subscribe({
      next: (res: any) => {
        this.allData = res.value || [];
        this.malls = ['Tümü', ...new Set<string>(this.allData.map((d: any) => d.Mall_Code).filter(Boolean))].sort();
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
    if (this.selectedMall !== 'Tümü') data = data.filter((d: any) => d.Mall_Code === this.selectedMall);

    // Marka bazında grupla
    const brandMap = new Map<string, BrandRow>();
    for (const d of data) {
      const key = d.Brand_Code || d.Brand_Name;
      if (!brandMap.has(key)) {
        brandMap.set(key, {
          brandName: d.Brand_Name || '',
          brandCode: d.Brand_Code || '',
          customerNo: d.Customer_No || '',
          mallCode: d.Mall_Code || '',
          usesPortal: false,
          totalEntries: 0,
          portalEntries: 0,
          totalAmount: 0
        });
      }
      const b = brandMap.get(key)!;
      b.totalEntries++;
      b.totalAmount += d.Amount || 0;
      if (d.Created_From_Web_Portal) {
        b.portalEntries++;
        b.usesPortal = true;
      }
    }

    this.brands = Array.from(brandMap.values()).sort((a, b) => a.brandName.localeCompare(b.brandName));

    // Özet
    this.totalBrands = this.brands.length;
    this.portalBrands = this.brands.filter(b => b.usesPortal).length;
    this.noPortalBrands = this.brands.filter(b => !b.usesPortal).length;
    this.totalEntries = data.length;
    this.portalEntries = data.filter((d: any) => d.Created_From_Web_Portal).length;
    this.portalPct = this.totalBrands > 0 ? Math.round(this.portalBrands / this.totalBrands * 100) : 0;

    // Aylık istatistik
    this.monthStats = MONTHS.map((m, i) => {
      const monthData = data.filter((d: any) => d.Month === i + 1);
      const total = monthData.length;
      const portal = monthData.filter((d: any) => d.Created_From_Web_Portal).length;
      return { month: m, total, portal, pct: total > 0 ? Math.round(portal / total * 100) : 0 };
    });

    this.applyTabFilter();
  }

  applyTabFilter() {
    let list = this.activeTab === 'portal'
      ? this.brands.filter(b => b.usesPortal)
      : this.brands.filter(b => !b.usesPortal);

    if (this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      list = list.filter(b => b.brandName.toLowerCase().includes(q));
    }

    this.filteredBrands = list;
  }

  setTab(tab: 'portal' | 'noportal') {
    this.activeTab = tab;
    this.searchText = '';
    this.applyTabFilter();
  }

  openMailModal(brand: BrandRow) {
    this.selectedBrand = brand;
    this.mailTo = '';
    this.mailSubject = `${brand.mallCode} - ${brand.brandName} Portal Kullanımı Hakkında`;
    this.mailBody = `Sayın ${brand.brandName} yetkilileri,\n\nECE Türkiye olarak kiracılarımıza sunduğumuz web portalımız üzerinden ciro girişi yapılmasını teşvik etmekteyiz.\n\nPortalımızı kullanmaya başlamak için lütfen bizimle iletişime geçiniz.\n\nİyi çalışmalar,\nECE Türkiye`;
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
    const noPortal = this.brands.filter(b => !b.usesPortal);
    const body = `Sayın Yetkili,\n\nECE Türkiye web portalımız üzerinden ciro girişi yapılmasını teşvik etmekteyiz.\n\nLütfen bizimle iletişime geçiniz.\n\nİyi çalışmalar,\nECE Türkiye`;
    const subject = `Portal Kullanımı Hakkında`;
    const link = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(link);
  }

  exportExcel() {
    const rows = this.brands.map(b => ({
      'Marka': b.brandName,
      'Marka Kodu': b.brandCode,
      'AVM': b.mallCode,
      'Portal Kullanıyor': b.usesPortal ? 'Evet' : 'Hayır',
      'Toplam Giriş': b.totalEntries,
      'Portal Girişi': b.portalEntries,
      'Oran (%)': b.totalEntries > 0 ? Math.round(b.portalEntries / b.totalEntries * 100) : 0
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
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