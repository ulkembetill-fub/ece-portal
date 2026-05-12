import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OdataService } from '../../core/odata';
import * as Chart from 'chart.js';

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

const SECTOR_COLORS: Record<string, string> = {
  'Fashion':       '#3b82f6',
  'Gastronomy':    '#f59e0b',
  'Grocery':       '#10b981',
  'Groceries':     '#10b981',
  'Hardware':      '#ef4444',
  'Health':        '#e879f9',
  'Entertainment': '#8b5cf6',
  'Electronics':   '#06b6d4',
  'Services':      '#6366f1',
  'Other':         '#6b7280',
  'Diğer':         '#6b7280',
};

const MALL_COLORS: Record<string, string> = {
  'MCA': '#3b82f6',
  'TCA': '#10b981',
  'AFI': '#f59e0b',
  'FBI': '#ef4444',
  'PAI': '#8b5cf6',
  'MCB': '#06b6d4',
  'PAA': '#e879f9',
  'MWI': '#6366f1',
  'CPI': '#f97316',
};

function getSectorColor(sector: string): string {
  const key = Object.keys(SECTOR_COLORS).find(k =>
    sector?.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SECTOR_COLORS[key] : '#4a5568';
}

@Component({
  selector: 'app-ciro-analitik',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ciro-analitik.html',
  styleUrl: './ciro-analitik.css',
})
export class CiroAnalitik implements OnInit, AfterViewInit {

  @ViewChild('trendChart') trendChartRef!: ElementRef;
  @ViewChild('mallChart') mallChartRef!: ElementRef;
  @ViewChild('sectorDonut') sectorDonutRef!: ElementRef;
  @ViewChild('sectorTrend') sectorTrendRef!: ElementRef;

  months = MONTHS;
  allMalls = ['MCA', 'TCA', 'AFI', 'FBI', 'PAI', 'MCB', 'PAA', 'MWI', 'CPI'];
  selectedMall = '';
  selectedYears: number[] = [2026];
  availableYears = [2024, 2025, 2026];
  selectedMonth = 0;
  showPct = false; // sektör pie yüzde toggle

  loading = false;
  error = '';
  loaded = false;

  rawDataByYear: Map<number, any[]> = new Map();
  contractMap: Map<string, any> = new Map();

  kpiTotal = 0;
  kpiGrowth: number | null = null;
  kpiBestMall = '';
  kpiBestSector = '';

  private trendChartInstance: any = null;
  private mallChartInstance: any = null;
  private sectorDonutInstance: any = null;
  private sectorTrendInstance: any = null;

  constructor(private odata: OdataService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    Chart.Chart.register(...Chart.registerables);
  }

  ngAfterViewInit() {}

  toggleYear(year: number) {
    const idx = this.selectedYears.indexOf(year);
    if (idx >= 0) {
      if (this.selectedYears.length > 1) this.selectedYears.splice(idx, 1);
    } else {
      this.selectedYears.push(year);
      this.selectedYears.sort();
    }
  }

  isYearSelected(year: number): boolean {
    return this.selectedYears.includes(year);
  }

  loadData() {
    this.loading = true;
    this.error = '';
    this.loaded = false;
    this.rawDataByYear.clear();
    this.cdr.detectChanges();

    const yearRequests: Record<string, any> = {
      contracts: this.odata.getContracts().pipe(catchError(() => of({ value: [] }))),
    };

    for (const year of this.selectedYears) {
      yearRequests[`y${year}`] = this.odata.getTurnover(year).pipe(catchError(() => of({ value: [] })));
    }

    const minYear = Math.min(...this.selectedYears);
    if (!this.selectedYears.includes(minYear - 1)) {
      yearRequests[`yprev`] = this.odata.getTurnover(minYear - 1).pipe(catchError(() => of({ value: [] })));
    }

    forkJoin(yearRequests).subscribe({
      next: (res: any) => {
        this.contractMap.clear();
        for (const c of (res.contracts.value || [])) {
          this.contractMap.set(c.No, c);
        }

        for (const year of this.selectedYears) {
          this.rawDataByYear.set(year, res[`y${year}`]?.value || []);
        }

        if (res['yprev']) {
          this.rawDataByYear.set(minYear - 1, res['yprev']?.value || []);
        }

        this.calculateKPIs();
        this.loaded = true;
        this.loading = false;
        this.cdr.detectChanges();

        setTimeout(() => this.buildAllCharts(), 150);
      },
      error: (err: any) => {
        this.error = 'Veri yüklenemedi: ' + err.message;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private filterByMall(data: any[]): any[] {
    if (!this.selectedMall) return data;
    return data.filter(d => d.Mall_Code === this.selectedMall);
  }

  private getActiveMonths(data: any[]): number[] {
    const months = new Set<number>();
    for (const d of data) {
      if (d.Month) months.add(d.Month - 1);
    }
    return [...months].sort((a, b) => a - b);
  }

  private calculateKPIs() {
    const latestYear = Math.max(...this.selectedYears);
    const latestData = this.filterByMall(this.rawDataByYear.get(latestYear) || []);
    const activeMonths = this.getActiveMonths(latestData);

    this.kpiTotal = latestData.reduce((s, d) => s + (d.Amount || 0), 0);

    const prevYear = latestYear - 1;
    const prevData = this.filterByMall(this.rawDataByYear.get(prevYear) || []);

    if (prevData.length > 0 && activeMonths.length > 0) {
      const prevTotal = prevData
        .filter(d => activeMonths.includes((d.Month || 1) - 1))
        .reduce((s, d) => s + (d.Amount || 0), 0);
      this.kpiGrowth = prevTotal > 0 ? ((this.kpiTotal - prevTotal) / prevTotal) * 100 : null;
    } else {
      this.kpiGrowth = null;
    }

    const mallTotals = new Map<string, number>();
    for (const d of latestData) {
      mallTotals.set(d.Mall_Code, (mallTotals.get(d.Mall_Code) || 0) + (d.Amount || 0));
    }
    this.kpiBestMall = [...mallTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const sectorTotals = new Map<string, number>();
    for (const d of latestData) {
      const sector = this.contractMap.get(d.Contract_No)?.SectorName || 'Diğer';
      sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + (d.Amount || 0));
    }
    this.kpiBestSector = [...sectorTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }

  private buildAllCharts() {
    this.buildTrendChart();
    this.buildMallChart();
    this.buildSectorDonut();
    this.buildSectorTrend();
  }

  private destroyChart(instance: any): null {
    if (instance) { try { instance.destroy(); } catch(e) {} }
    return null;
  }

  private buildTrendChart() {
    this.trendChartInstance = this.destroyChart(this.trendChartInstance);
    const ctx = this.trendChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const yearColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    let datasets: any[] = [];

    if (this.selectedMall) {
      datasets = this.selectedYears.map((year, i) => {
        const data = this.filterByMall(this.rawDataByYear.get(year) || []);
        const monthly = Array(12).fill(0);
        for (const d of data) monthly[(d.Month || 1) - 1] += d.Amount || 0;
        return {
          label: String(year),
          data: monthly,
          borderColor: yearColors[i % yearColors.length],
          backgroundColor: yearColors[i % yearColors.length] + '22',
          tension: 0.4,
          fill: false,
          pointRadius: 4,
        };
      });
    } else {
      const latestYear = Math.max(...this.selectedYears);
      const data = this.rawDataByYear.get(latestYear) || [];
      for (const mall of this.allMalls) {
        const mallData = data.filter((d: any) => d.Mall_Code === mall);
        if (mallData.length === 0) continue;
        const monthly = Array(12).fill(0);
        for (const d of mallData) monthly[(d.Month || 1) - 1] += d.Amount || 0;
        datasets.push({
          label: mall,
          data: monthly,
          borderColor: MALL_COLORS[mall] || '#6b7280',
          backgroundColor: (MALL_COLORS[mall] || '#6b7280') + '22',
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          borderWidth: 2,
        });
      }
    }

    this.trendChartInstance = new Chart.Chart(ctx, {
      type: 'line',
      data: { labels: MONTHS, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
          tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${this.fmt(c.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b', callback: (v: any) => this.fmtShort(v) }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  private buildMallChart() {
    this.mallChartInstance = this.destroyChart(this.mallChartInstance);
    const ctx = this.mallChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const yearColors = ['#3b82f6', '#10b981', '#f59e0b'];
    const malls = this.selectedMall ? [this.selectedMall] : this.allMalls;
    const month = Number(this.selectedMonth); // number'a zorla

    const datasets = this.selectedYears.map((year, i) => {
      const data = this.rawDataByYear.get(year) || [];
      const mallTotals = malls.map(mall => {
        const mallData = data.filter((d: any) => d.Mall_Code === mall);
        if (month > 0) {
          return mallData
            .filter((d: any) => Number(d.Month) === month)
            .reduce((s: number, d: any) => s + (d.Amount || 0), 0);
        }
        return mallData.reduce((s: number, d: any) => s + (d.Amount || 0), 0);
      });
      return {
        label: String(year),
        data: mallTotals,
        backgroundColor: yearColors[i % yearColors.length] + 'cc',
        borderColor: yearColors[i % yearColors.length],
        borderWidth: 1,
        borderRadius: 4,
      };
    });

    this.mallChartInstance = new Chart.Chart(ctx, {
      type: 'bar',
      data: { labels: malls, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${this.fmt(c.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#64748b', callback: (v: any) => this.fmtShort(v) }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  private buildSectorDonut() {
    this.sectorDonutInstance = this.destroyChart(this.sectorDonutInstance);
    const ctx = this.sectorDonutRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const latestYear = Math.max(...this.selectedYears);
    const data = this.filterByMall(this.rawDataByYear.get(latestYear) || []);
    const month = Number(this.selectedMonth);
    const filtered = month > 0 ? data.filter((d: any) => Number(d.Month) === month) : data;

    const sectorTotals = new Map<string, number>();
    for (const d of filtered) {
      const sector = this.contractMap.get(d.Contract_No)?.SectorName || 'Diğer';
      sectorTotals.set(sector, (sectorTotals.get(sector) || 0) + (d.Amount || 0));
    }

    const total = [...sectorTotals.values()].reduce((s, v) => s + v, 0);
    const sorted = [...sectorTotals.entries()].sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(s => s[0]);
    const values = sorted.map(s => s[1]);
    const colors = labels.map(l => getSectorColor(l));
    const showPct = this.showPct;

    this.sectorDonutInstance = new Chart.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              boxWidth: 12,
              generateLabels: (chart: any) => {
                const data = chart.data;
                return data.labels.map((label: string, i: number) => {
                  const value = data.datasets[0].data[i];
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return {
                    text: showPct ? `${label} (${pct}%)` : label,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    strokeStyle: data.datasets[0].borderColor[i],
                    lineWidth: 1,
                    index: i,
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (c: any) => {
                const pct = total > 0 ? ((c.raw / total) * 100).toFixed(1) : '0';
                return ` ${c.label}: ${this.fmt(c.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  private buildSectorTrend() {
    this.sectorTrendInstance = this.destroyChart(this.sectorTrendInstance);
    const ctx = this.sectorTrendRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const latestYear = Math.max(...this.selectedYears);
    const data = this.filterByMall(this.rawDataByYear.get(latestYear) || []);

    const sectorMonthly = new Map<string, number[]>();
    for (const d of data) {
      const sector = this.contractMap.get(d.Contract_No)?.SectorName || 'Diğer';
      if (!sectorMonthly.has(sector)) sectorMonthly.set(sector, Array(12).fill(0));
      sectorMonthly.get(sector)![(d.Month || 1) - 1] += d.Amount || 0;
    }

    const top6 = [...sectorMonthly.entries()]
      .sort((a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0))
      .slice(0, 6);

    const datasets = top6.map(([sector, monthly]) => ({
      label: sector,
      data: monthly,
      backgroundColor: getSectorColor(sector) + '99',
      borderColor: getSectorColor(sector),
      borderWidth: 1,
    }));

    this.sectorTrendInstance = new Chart.Chart(ctx, {
      type: 'bar',
      data: { labels: MONTHS, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
          tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${this.fmt(c.raw)}` } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
          y: { stacked: true, ticks: { color: '#64748b', callback: (v: any) => this.fmtShort(v) }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  onFilterChange() {
    if (this.loaded) {
      this.calculateKPIs();
      this.cdr.detectChanges();
      setTimeout(() => this.buildAllCharts(), 50);
    }
  }

  togglePct() {
    this.showPct = !this.showPct;
    if (this.loaded) setTimeout(() => this.buildSectorDonut(), 50);
  }

  fmt(n: number): string {
    if (!n) return '—';
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  fmtShort(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return String(n);
  }

  fmtGrowth(g: number | null): string {
    if (g === null) return '—';
    return (g >= 0 ? '+' : '') + g.toFixed(1) + '%';
  }
}