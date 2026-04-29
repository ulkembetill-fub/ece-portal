import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OdataService } from '../../core/odata';
import * as XLSX from 'xlsx';

const MONTHS = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];

interface ContractRow {
  contractNo: string;
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
  malls: string[] = [];
  invoiceTypes: string[] = [];
  selectedMall = 'Tümü';
  selectedInvoiceType = 'Tümü';
  months = MONTHS;
  grandMonths: number[] = Array(12).fill(0);
  grandTotal = 0;

  constructor(private odata: OdataService) {}

  ngOnInit() {}

  loadData() {
    this.loading = true;
    this.error = '';
    this.odata.getAging().subscribe({
      next: (res) => {
        this.allData = res.value || [];
        this.malls = ['Tümü', ...new Set<string>(this.allData.map(d => d.MallCode).filter(Boolean))].sort();
        this.invoiceTypes = ['Tümü', ...new Set<string>(this.allData.map(d => d.InvoiceType).filter(Boolean))].sort();
        this.buildTable();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Veri yüklenemedi: ' + err.message;
        this.loading = false;
      }
    });
  }

  buildTable() {
    let data = this.allData;
    if (this.selectedMall !== 'Tümü') data = data.filter(d => d.MallCode === this.selectedMall);
    if (this.selectedInvoiceType !== 'Tümü') data = data.filter(d => d.InvoiceType === this.selectedInvoiceType);

    const mallMap = new Map<string, Map<string, Map<string, ContractRow>>>();
    const customerNames = new Map<string, string>();

    for (const d of data) {
      const mall = d.MallCode || 'Bilinmiyor';
      const custNo = d.CustomerNo || 'Bilinmiyor';
      const custName = d.Name || custNo;
      const contractKey = (d.ContractNo || '-') + '|' + (d.InvoiceType || '');
      const month = new Date(d.PostingDate).getMonth();
      const amount = d.AmountLCY || 0;

      customerNames.set(custNo, custName);

      if (!mallMap.has(mall)) mallMap.set(mall, new Map());
      const custMap = mallMap.get(mall)!;
      if (!custMap.has(custNo)) custMap.set(custNo, new Map());
      const contractMap = custMap.get(custNo)!;
      if (!contractMap.has(contractKey)) contractMap.set(contractKey, {
        contractNo: d.ContractNo || '-',
        invoiceType: d.InvoiceType || '',
        months: Array(12).fill(0),
        total: 0
      });

      const row = contractMap.get(contractKey)!;
      row.months[month] += amount;
      row.total += amount;
    }

    this.mallGroups = [];
    this.grandMonths = Array(12).fill(0);
    this.grandTotal = 0;

    for (const [mall, custMap] of mallMap) {
      const customers: CustomerRow[] = [];
      const mallMonths = Array(12).fill(0);

      for (const [custNo, contractMap] of custMap) {
        const contracts = Array.from(contractMap.values());
        const custMonths = Array(12).fill(0);
        contracts.forEach(c => c.months.forEach((v, i) => custMonths[i] += v));
        customers.push({
          customerNo: custNo,
          customerName: customerNames.get(custNo) || custNo,
          expanded: false,
          contracts,
          months: custMonths,
          total: custMonths.reduce((a, b) => a + b, 0)
        });
        custMonths.forEach((v, i) => mallMonths[i] += v);
      }

      customers.sort((a, b) => b.total - a.total);
      const mallTotal = mallMonths.reduce((a, b) => a + b, 0);
      this.mallGroups.push({ mallCode: mall, expanded: true, customers, months: mallMonths, total: mallTotal });
      mallMonths.forEach((v, i) => this.grandMonths[i] += v);
      this.grandTotal += mallTotal;
    }

    this.mallGroups.sort((a, b) => a.mallCode.localeCompare(b.mallCode));
  }

  toggleMall(g: MallGroup) { g.expanded = !g.expanded; }
  toggleCustomer(c: CustomerRow) { c.expanded = !c.expanded; }

  fmt(n: number) {
    return n === 0 ? '–' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  exportExcel() {
    const rows: any[] = [];
    for (const g of this.mallGroups) {
      const mallRow: any = { 'AVM': g.mallCode, 'Müşteri No': '', 'Müşteri Adı': '', 'Kontrat No': '', 'Fatura Türü': '' };
      g.months.forEach((v, i) => mallRow[MONTHS[i]] = v);
      mallRow['Toplam'] = g.total;
      rows.push(mallRow);
      for (const c of g.customers) {
        const custRow: any = { 'AVM': '', 'Müşteri No': c.customerNo, 'Müşteri Adı': c.customerName, 'Kontrat No': '', 'Fatura Türü': '' };
        c.months.forEach((v, i) => custRow[MONTHS[i]] = v);
        custRow['Toplam'] = c.total;
        rows.push(custRow);
        for (const r of c.contracts) {
          const cRow: any = { 'AVM': '', 'Müşteri No': '', 'Müşteri Adı': '', 'Kontrat No': r.contractNo, 'Fatura Türü': r.invoiceType };
          r.months.forEach((v, i) => cRow[MONTHS[i]] = v);
          cRow['Toplam'] = r.total;
          rows.push(cRow);
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aging');
    XLSX.writeFile(wb, 'aging-2026.xlsx');
  }
}