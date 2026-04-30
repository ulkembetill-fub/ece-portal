import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OdataService } from '../../core/odata';
import * as XLSX from 'xlsx';
import { forkJoin } from 'rxjs';

const MONTHS = ['OCA','SUB','MAR','NIS','MAY','HAZ','TEM','AGU','EYL','EKI','KAS','ARA'];
const MONTHS_DISPLAY = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];

interface ContractRow {
  contractNo: string;
  brandName: string;
  lotNo: string;
  lotLocationCode: string;
  invoiceType: string;
  months: number[];
  total: number;
}

interface CustomerRow {
  customerNo: string;
  customerName: string;
  expanded: boolean;
  contracts: ContractRow[];
  months: number[];
  total: number;
}

interface MallGroup {
  mallCode: string;
  mallName: string;
  expanded: boolean;
  customers: CustomerRow[];
  months: number[];
  total: number;
}

@Component({
  selector: 'app-aging',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aging.html',
  styleUrl: './aging.css'
})
export class Aging implements OnInit {
  loading = false;
  error = '';
  allData: any[] = [];
  mallGroups: MallGroup[] = [];
  filteredMallGroups: MallGroup[] = [];
  mallGroupsNeg: MallGroup[] = [];
  filteredMallGroupsNeg: MallGroup[] = [];
  malls: string[] = [];
  invoiceTypes: string[] = [];
  mallNames: Map<string, string> = new Map();
  selectedMall = 'Tümü';
  selectedInvoiceType = 'Tümü';
  selectedYear = 2026;
  years = [2026, 2025, 2024];
  searchText = '';
  dueDate = '';
  months = MONTHS_DISPLAY;
  grandMonths: number[] = Array(12).fill(0);
  grandTotal = 0;
  grandMonthsNeg: number[] = Array(12).fill(0);
  grandTotalNeg = 0;

  constructor(private odata: OdataService) {}

  ngOnInit() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    this.dueDate = d.toLocaleDateString('tr-TR');

    this.odata.getMalls().subscribe({
      next: (res: any) => {
        (res.value || []).forEach((m: any) => {
          this.mallNames.set(m.Code, m.Name);
        });
      }
    });
  }

  loadData() {
    this.loading = true;
    this.error = '';
    this.mallGroups = [];
    this.filteredMallGroups = [];
    this.mallGroupsNeg = [];
    this.filteredMallGroupsNeg = [];
    this.grandTotal = 0;
    this.grandTotalNeg = 0;

    forkJoin({
      pos: this.odata.getAging(this.selectedYear),
      neg: this.odata.getAgingNegative(this.selectedYear)
    }).subscribe({
      next: (res: any) => {
        const posData = res.pos.value || [];
        const negData = res.neg.value || [];

        // Tüm veriyi birleştir
        this.allData = [...posData, ...negData];

        this.malls = ['Tümü', ...new Set<string>(this.allData.map((d: any) => d.Mall_Code).filter(Boolean))].sort();
        this.invoiceTypes = ['Tümü', ...new Set<string>(this.allData.map((d: any) => d.Invoice_Type).filter(Boolean))].sort();

        this.buildTables();
        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Veri yüklenemedi: ' + err.message;
        this.loading = false;
      }
    });
  }

  buildTables() {
    let data = this.allData;
    if (this.selectedMall !== 'Tümü') data = data.filter((d: any) => d.Mall_Code === this.selectedMall);
    if (this.selectedInvoiceType !== 'Tümü') data = data.filter((d: any) => d.Invoice_Type === this.selectedInvoiceType);

    // Müşteri bazında net bakiye hesapla
    const customerNetMap = new Map<string, number>();
    for (const d of data) {
      const custNo = d.Customer_No || 'Bilinmiyor';
      customerNetMap.set(custNo, (customerNetMap.get(custNo) || 0) + (d.Remaining_Amt_LCY || 0));
    }

    // Tüm kontrat verilerini grupla
    const mallMap = new Map<string, Map<string, Map<string, ContractRow>>>();
    const customerNames = new Map<string, string>();
    const customerMalls = new Map<string, string>();

    for (const d of data) {
      const custNo = d.Customer_No || 'Bilinmiyor';
      const mall = d.Mall_Code || 'Bilinmiyor';
      const custName = d.Customer_Name || custNo;
      const contractKey = (d.Contract_No || '-') + '|' + (d.Invoice_Type || '');
      const month = new Date(d.Posting_Date).getMonth();
      const amount = d.Remaining_Amt_LCY || 0;

      customerNames.set(custNo, custName);
      customerMalls.set(custNo, mall);

      if (!mallMap.has(mall)) mallMap.set(mall, new Map());
      const custMap = mallMap.get(mall)!;
      if (!custMap.has(custNo)) custMap.set(custNo, new Map());
      const contractMap = custMap.get(custNo)!;
      if (!contractMap.has(contractKey)) contractMap.set(contractKey, {
        contractNo: d.Contract_No || '-',
        brandName: d.Brand_Name || '',
        lotNo: d.Lot_No || '',
        lotLocationCode: d.Lot_Location_Code || '',
        invoiceType: d.Invoice_Type || '',
        months: Array(12).fill(0),
        total: 0
      });

      const row = contractMap.get(contractKey)!;
      row.months[month] += amount;
      row.total += amount;
    }

    // Pozitif ve negatif grupları ayır
    this.mallGroups = [];
    this.mallGroupsNeg = [];
    this.grandMonths = Array(12).fill(0);
    this.grandMonthsNeg = Array(12).fill(0);
    this.grandTotal = 0;
    this.grandTotalNeg = 0;

    const posMap = new Map<string, CustomerRow[]>();
    const negMap = new Map<string, CustomerRow[]>();
    const posMallMonths = new Map<string, number[]>();
    const negMallMonths = new Map<string, number[]>();

    for (const [mall, custMap] of mallMap) {
      for (const [custNo, contractMap] of custMap) {
        const netTotal = customerNetMap.get(custNo) || 0;
        if (netTotal === 0) continue;

        const contracts = Array.from(contractMap.values());
        const custMonths = Array(12).fill(0);
        contracts.forEach(c => c.months.forEach((v, i) => custMonths[i] += v));

        const custRow: CustomerRow = {
          customerNo: custNo,
          customerName: customerNames.get(custNo) || custNo,
          expanded: false,
          contracts,
          months: custMonths,
          total: netTotal
        };

        if (netTotal > 0) {
          if (!posMap.has(mall)) posMap.set(mall, []);
          posMap.get(mall)!.push(custRow);
          if (!posMallMonths.has(mall)) posMallMonths.set(mall, Array(12).fill(0));
          custMonths.forEach((v, i) => posMallMonths.get(mall)![i] += v);
        } else {
          if (!negMap.has(mall)) negMap.set(mall, []);
          negMap.get(mall)!.push(custRow);
          if (!negMallMonths.has(mall)) negMallMonths.set(mall, Array(12).fill(0));
          custMonths.forEach((v, i) => negMallMonths.get(mall)![i] += v);
        }
      }
    }

    // Pozitif MallGroups
    for (const [mall, customers] of posMap) {
      customers.sort((a, b) => b.total - a.total);
      const mallMonths = posMallMonths.get(mall) || Array(12).fill(0);
      const mallTotal = customers.reduce((s, c) => s + c.total, 0);
      this.mallGroups.push({
        mallCode: mall,
        mallName: this.mallNames.get(mall) || mall,
        expanded: true,
        customers,
        months: mallMonths,
        total: mallTotal
      });
      mallMonths.forEach((v, i) => this.grandMonths[i] += v);
      this.grandTotal += mallTotal;
    }

    // Negatif MallGroups
    for (const [mall, customers] of negMap) {
      customers.sort((a, b) => a.total - b.total);
      const mallMonths = negMallMonths.get(mall) || Array(12).fill(0);
      const mallTotal = customers.reduce((s, c) => s + c.total, 0);
      this.mallGroupsNeg.push({
        mallCode: mall,
        mallName: this.mallNames.get(mall) || mall,
        expanded: false,
        customers,
        months: mallMonths,
        total: mallTotal
      });
      mallMonths.forEach((v, i) => this.grandMonthsNeg[i] += v);
      this.grandTotalNeg += mallTotal;
    }

    this.mallGroups.sort((a, b) => a.mallCode.localeCompare(b.mallCode));
    this.mallGroupsNeg.sort((a, b) => a.mallCode.localeCompare(b.mallCode));
    this.applySearch();
  }

  applySearch() {
    const q = this.searchText.trim().toLowerCase();
    if (!q) {
      this.filteredMallGroups = this.mallGroups;
      this.filteredMallGroupsNeg = this.mallGroupsNeg;
      return;
    }
    const filter = (groups: MallGroup[]) => groups
      .map(g => {
        const matchedCustomers = g.customers.filter(c =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerNo.toLowerCase().includes(q) ||
          c.contracts.some(r => r.brandName.toLowerCase().includes(q) || r.contractNo.toLowerCase().includes(q))
        );
        if (matchedCustomers.length === 0) return null;
        return { ...g, customers: matchedCustomers, expanded: true };
      })
      .filter(g => g !== null) as MallGroup[];

    this.filteredMallGroups = filter(this.mallGroups);
    this.filteredMallGroupsNeg = filter(this.mallGroupsNeg);
  }

  sendMail(type: 'normal' | 'ihtar' | 'icra', mallName: string, customer: CustomerRow) {
    const borc = this.fmt(customer.total);
    const konu = encodeURIComponent(mallName + ' - ' + customer.customerName + ' BORC BAKIYENIZ HAKKINDA');
    let body = '';
    if (type === 'normal') {
      body = 'Merhabalar;\n\nHesap ozeti borcunuzu hatirlatir,\n\nGuncel borc bakiyeniz: ' + borc + ' TL\n\nBorcunuzun ' + this.dueDate + ' tarihine kadar kapatilmasi konusunda desteklerinizi rica ederiz.\n\nIyi calismalar.';
    } else if (type === 'ihtar') {
      body = 'Merhabalar;\n\nHesap ozeti borcunuzu hatirlatir,\n\nGuncel borc bakiyeniz: ' + borc + ' TL\n\nBorcunuzun ' + this.dueDate + ' tarihine kadar kapatilmasi konusunda desteklerinizi rica ederiz, aksi takdirde uzulerek belirtmek isteriz ki borclariniz ile ilgili borc ihtarnamesi gonderilecektir.\n\nIyi calismalar.';
    } else {
      body = 'Merhabalar;\n\nHesap ozeti borcunuzu hatirlatir,\n\nGuncel borc bakiyeniz: ' + borc + ' TL\n\nBorcunuzun ' + this.dueDate + ' tarihine kadar kapatilmasi konusunda desteklerinizi rica ederiz, aksi takdirde uzulerek belirtmek isteriz ki borclariniz ile ilgili hukuki takip baslatilacaktir.\n\nIyi calismalar.';
    }
    window.open('mailto:?subject=' + konu + '&body=' + encodeURIComponent(body));
  }

  toggleMall(g: MallGroup) { g.expanded = !g.expanded; }
  toggleCustomer(c: CustomerRow) { c.expanded = !c.expanded; }

  fmt(n: number) {
    return n === 0 ? '-' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exportExcel() {
    const rows: any[] = [];
    for (const g of this.filteredMallGroups) {
      const mallRow: any = {};
      mallRow['AVM'] = g.mallName;
      mallRow['Musteri No'] = '';
      mallRow['Musteri Adi'] = '';
      mallRow['Kontrat No'] = '';
      mallRow['Marka'] = '';
      mallRow['Lot'] = '';
      mallRow['Mahal'] = '';
      mallRow['Fatura Turu'] = '';
      MONTHS.forEach((m, i) => mallRow[m] = g.months[i]);
      mallRow['Toplam'] = g.total;
      rows.push(mallRow);
      for (const c of g.customers) {
        const custRow: any = {};
        custRow['AVM'] = '';
        custRow['Musteri No'] = c.customerNo;
        custRow['Musteri Adi'] = c.customerName;
        custRow['Kontrat No'] = '';
        custRow['Marka'] = '';
        custRow['Lot'] = '';
        custRow['Mahal'] = '';
        custRow['Fatura Turu'] = '';
        MONTHS.forEach((m, i) => custRow[m] = c.months[i]);
        custRow['Toplam'] = c.total;
        rows.push(custRow);
        for (const r of c.contracts) {
          const cRow: any = {};
          cRow['AVM'] = '';
          cRow['Musteri No'] = '';
          cRow['Musteri Adi'] = '';
          cRow['Kontrat No'] = r.contractNo;
          cRow['Marka'] = r.brandName;
          cRow['Lot'] = r.lotNo;
          cRow['Mahal'] = r.lotLocationCode;
          cRow['Fatura Turu'] = r.invoiceType;
          MONTHS.forEach((m, i) => cRow[m] = r.months[i]);
          cRow['Toplam'] = r.total;
          rows.push(cRow);
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aging');
    XLSX.writeFile(wb, 'aging-' + this.selectedYear + '.xlsx');
  }
}