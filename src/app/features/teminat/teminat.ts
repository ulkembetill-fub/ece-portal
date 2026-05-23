import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OdataService } from '../../core/odata';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';

const MALL_NAMES: Record<string, string> = {
  'AFI': 'AFYON PARK AVM',
  'CPI': 'ÇEKMEKÖY PARK AVM',
  'FBI': 'FORUM BORNOVA AVM',
  'MCA': 'ANTALYA MİGROS AVM',
  'MCB': 'BEYLİKDÜZÜ MİGROS AVM',
  'MWI': 'METROWAY AVM',
  'PAA': 'PARK AFYON AVM',
  'PAI': 'PALLADIUM AVM',
  'TCA': 'TERRACITY AVM',
};

interface TeminatRow {
  no: string;
  customerName: string;
  cvNo: string;
  mallCode: string;
  contractNo: string;
  brandName: string;
  lotNo: string;
  lotLocationCode: string;
  bankName: string;
  documentType: string;
  amount: number;
  dueDate: Date | null;
  returnDate: Date | null;
  validityType: string;
  daysLeft: number;
  status: 'expired' | 'critical' | 'warning' | 'ok' | 'returned';
  monthlyRent: number;
  monthsCovered: number;
  rentStatus: 'insufficient' | 'sufficient' | 'unknown';
  kiraCurrency: string;
  siblingCount: number;
  siblings: TeminatRow[];
  expanded: boolean;
  isChild: boolean;
  documentNo: string;
  dateReceived: Date | null;
  requestedDeposit: number;
}

@Component({
  selector: 'app-teminat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teminat.html',
  styleUrl: './teminat.css'
})
export class Teminat implements OnInit {
  loading = false;
  error = '';
  allData: TeminatRow[] = [];
  filtered: TeminatRow[] = [];
  malls: string[] = [];
  docTypes: string[] = [];
  selectedMall = 'Tümü';
  selectedDocType = 'Tümü';
  selectedStatus = 'Tümü';
  selectedRentStatus = 'Tümü';
  searchText = '';
  today = new Date();

  totalAmount = 0;
  expiredCount = 0;
  criticalCount = 0;
  warningCount = 0;
  insufficientCount = 0;

  statusOptions = ['Tümü', 'Vadesi Geçmiş', '30 Gün İçinde', '90 Gün İçinde', 'Güvenli'];
  rentStatusOptions = ['Tümü', 'Yetersiz', 'Yeterli', 'Bilinmiyor'];

  constructor(private odata: OdataService) {}

  ngOnInit() {}

  loadData() {
    this.loading = true;
    this.error = '';

    forkJoin({
      teminat: this.odata.getTeminat(),
      kira: this.odata.getKiraBilgileri()
    }).subscribe({
      next: (res: any) => {
        const teminatData = res.teminat.value || [];
        const kiraData = res.kira.value || [];

        const kiraMap = new Map<string, { amount: number, currency: string }>();
        for (const k of kiraData) {
          const contractNo = k.Contract_No || '';
          if (!kiraMap.has(contractNo)) {
            kiraMap.set(contractNo, {
              amount: k.Monthly_Rental_Amount || 0,
              currency: k.Currency_Code || ''
            });
          }
        }

        const firmaTeminatMap = new Map<string, number>();
        for (const d of teminatData) {
          if (!d.CV_No) continue;
          const returnDate = d.Return_Date && d.Return_Date !== '0001-01-01' ? new Date(d.Return_Date) : null;
          if (returnDate) continue;
          const key = (d.CV_No || '') + '_' + (d.Mall_Code || '');
          firmaTeminatMap.set(key, (firmaTeminatMap.get(key) || 0) + (d.Amount_LCY || 0));
        }

        const makeRow = (d: any): TeminatRow => {
          const rawDue = d.Last_Extension_Date && d.Last_Extension_Date !== '0001-01-01'
            ? d.Last_Extension_Date : d.Due_Date;
          const dueDate = rawDue && rawDue !== '0001-01-01' ? new Date(rawDue) : null;
          const returnDate = d.Return_Date && d.Return_Date !== '0001-01-01' ? new Date(d.Return_Date) : null;
          const dateReceived = d.Date_Received && d.Date_Received !== '0001-01-01' ? new Date(d.Date_Received) : null;
          const daysLeft = dueDate
            ? Math.floor((dueDate.getTime() - this.today.getTime()) / (1000 * 60 * 60 * 24))
            : 9999;

          let status: TeminatRow['status'] = 'ok';
          if (returnDate) status = 'returned';
          else if (daysLeft < 0) status = 'expired';
          else if (daysLeft <= 30) status = 'critical';
          else if (daysLeft <= 90) status = 'warning';

          const kiraInfo = kiraMap.get(d.Contract_No || '');
          const kiraCurrency = kiraInfo?.currency || '';
          const monthlyRent = (kiraInfo && !kiraCurrency) ? kiraInfo.amount : 0;

          const firmaKey = (d.CV_No || '') + '_' + (d.Mall_Code || '');
          const firmaToplam = firmaTeminatMap.get(firmaKey) || 0;
          const monthsCovered = monthlyRent > 0 ? firmaToplam / monthlyRent : 0;

          let rentStatus: TeminatRow['rentStatus'] = 'unknown';
          if (kiraCurrency) rentStatus = 'unknown';
          else if (monthlyRent > 0) rentStatus = monthsCovered >= 2 ? 'sufficient' : 'insufficient';

          // Missing deposit için talep edilen depozito
          const depositMonthCount = d.Deposit_Month_Count || 3;
          const vatMultiplier = d.Deposit_Including_VAT ? 1.20 : 1;
          const requestedDeposit = monthlyRent * vatMultiplier * depositMonthCount;

          return {
            no: d.No || '',
            customerName: d.CV_Name || '',
            cvNo: d.CV_No || '',
            mallCode: d.Mall_Code || '',
            contractNo: d.Contract_No || '',
            brandName: d.Brand_Name || '',
            lotNo: d.Lot_No || '',
            lotLocationCode: d.Lot_Location_Code || '',
            bankName: d.Bank_Name || '',
            documentType: d.Document_Type || '',
            documentNo: d.Document_No || '',
            amount: d.Amount_LCY || 0,
            dueDate,
            returnDate,
            dateReceived,
            validityType: d.Validity_Type || '',
            daysLeft,
            status,
            monthlyRent,
            monthsCovered,
            rentStatus,
            kiraCurrency,
            requestedDeposit,
            siblingCount: 0,
            siblings: [] as TeminatRow[],
            expanded: false,
            isChild: false
          };
        };

        const rows: TeminatRow[] = teminatData
          .map((d: any) => makeRow(d))
          .filter((r: TeminatRow) => r.status !== 'returned');

        const cvMap = new Map<string, TeminatRow[]>();
        for (const r of rows) {
          const key = (r.cvNo || r.no) + '_' + r.mallCode;
          if (!cvMap.has(key)) cvMap.set(key, []);
          cvMap.get(key)!.push(r);
        }

        this.allData = [];
        for (const [, group] of cvMap) {
          const first: TeminatRow = { ...group[0], siblings: [] as TeminatRow[], siblingCount: 0 };
          if (group.length > 1) {
            first.siblingCount = group.length - 1;
            first.siblings = group.slice(1).map((r: TeminatRow): TeminatRow => ({ ...r, isChild: true }));
          }
          this.allData.push(first);
        }

        this.malls = ['Tümü', ...new Set<string>(this.allData.map(d => d.mallCode).filter(Boolean))].sort();
        this.docTypes = ['Tümü', ...new Set<string>(this.allData.map(d => d.documentType).filter(Boolean))].sort();

        this.buildStats();
        this.applyFilter();
        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Veri yüklenemedi: ' + err.message;
        this.loading = false;
      }
    });
  }

  getMallName(code: string): string {
    return MALL_NAMES[code] || code;
  }

  sendMail(r: TeminatRow) {
    const mallName = this.getMallName(r.mallCode);
    const vadeStr = r.dueDate ? r.dueDate.toLocaleDateString('tr-TR') : '—';
    const mektupTarihStr = r.dateReceived ? r.dateReceived.toLocaleDateString('tr-TR') : '—';
    const requestedStr = r.requestedDeposit > 0
      ? r.requestedDeposit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : r.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const mevcutStr = r.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const konu = encodeURIComponent(
      `${mallName} - ${r.customerName} - ${r.brandName} ${vadeStr} tarihli Teminat Mektubu Hk.`
    );

    const body = `Merhaba,

${mallName} için vermiş olduğunuz aşağıda detayları belirtilen teminat mektubunun vadesi ${vadeStr} tarihinde dolmaktadır.

İmzalamış olduğunuz sözleşmede belirtilen bedele istinaden yeni depozito bedeliniz: ${requestedStr} TL

Mektup metni içindeki sözleşme imza tarihiniz: ${mektupTarihStr}

Mektup hazır olduğunda, aslını iletmeden önce, tarafımıza taslak görüntüsünü iletmeniz teslimden önce bir revizyon gerekmesi durumunda hızlıca müdahale edilmesi açısından çok önemlidir.

İlgili tutar kadar depozitoyu Banka Teminat mektubu olarak vadesinden üç iş günü önce tarafımıza iletmeniz önemle rica olunur.

Teminat mektubunuzun (ekteki formata uygun olarak) aslı tarafımıza ulaşmadığı taktirde, üzülerek belirtmek isterim ki teminat mektubunuz depozito niteliğini kaybetmemesi adına tazmin edilecektir.


Mevcut mektubunuz;

MÜŞTERİ ADI : ${r.customerName}
MARKA : ${r.brandName}
MEKTUP TARİHİ : ${mektupTarihStr}
VADE TARİHİ : ${vadeStr}
MEKTUP NO : ${r.documentNo}
Banka : ${r.bankName}
TUTAR : ${mevcutStr}


İyi çalışmalar dilerim.`;

    window.open('mailto:?subject=' + konu + '&body=' + encodeURIComponent(body));
  }

  buildStats() {
    this.totalAmount = this.allData.reduce((s, d) => s + d.amount, 0);
    this.expiredCount = this.allData.filter(d => d.status === 'expired').length;
    this.criticalCount = this.allData.filter(d => d.status === 'critical').length;
    this.warningCount = this.allData.filter(d => d.status === 'warning').length;
    this.insufficientCount = this.allData.filter(d => d.rentStatus === 'insufficient').length;
  }

  applyFilter() {
    let data = this.allData;
    if (this.selectedMall !== 'Tümü') data = data.filter(d => d.mallCode === this.selectedMall);
    if (this.selectedDocType !== 'Tümü') data = data.filter(d => d.documentType === this.selectedDocType);
    if (this.selectedStatus === 'Vadesi Geçmiş') data = data.filter(d => d.status === 'expired');
    else if (this.selectedStatus === '30 Gün İçinde') data = data.filter(d => d.status === 'critical');
    else if (this.selectedStatus === '90 Gün İçinde') data = data.filter(d => d.status === 'warning');
    else if (this.selectedStatus === 'Güvenli') data = data.filter(d => d.status === 'ok');
    if (this.selectedRentStatus === 'Yetersiz') data = data.filter(d => d.rentStatus === 'insufficient');
    else if (this.selectedRentStatus === 'Yeterli') data = data.filter(d => d.rentStatus === 'sufficient');
    else if (this.selectedRentStatus === 'Bilinmiyor') data = data.filter(d => d.rentStatus === 'unknown');

    if (this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      data = data.filter(d =>
        d.customerName.toLowerCase().includes(q) ||
        d.brandName.toLowerCase().includes(q) ||
        d.contractNo.toLowerCase().includes(q) ||
        d.no.toLowerCase().includes(q)
      );
    }

    this.filtered = data.sort((a, b) => {
      if (a.status === 'expired' && b.status !== 'expired') return -1;
      if (b.status === 'expired' && a.status !== 'expired') return 1;
      if (a.status === 'critical' && b.status !== 'critical') return -1;
      if (b.status === 'critical' && a.status !== 'critical') return 1;
      return (a.daysLeft || 0) - (b.daysLeft || 0);
    });
  }

  toggleSiblings(row: TeminatRow) {
    row.expanded = !row.expanded;
  }

  getStatusLabel(status: string): string {
    const map: any = {
      expired: 'Vadesi Geçmiş', critical: '30 Gün İçinde',
      warning: '90 Gün İçinde', ok: 'Güvenli', returned: 'İade Edilmiş'
    };
    return map[status] || status;
  }

  exportExcel() {
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString('tr-TR');

    const statusLabel = (s: string) => {
      const map: any = {
        expired: 'Vadesi Geçmiş', critical: '30 Gün İçinde',
        warning: '90 Gün İçinde', ok: 'Güvenli'
      };
      return map[s] || s;
    };

    const makeExcelRow = (r: TeminatRow, isChild: boolean) => ({
      'Tur': isChild ? 'Ek Mektup' : 'Ana Mektup',
      'Musteri Adi': r.customerName,
      'Musteri No': r.cvNo,
      'AVM': r.mallCode,
      'Marka': r.brandName,
      'Kontrat No': r.contractNo,
      'Lot': r.lotNo,
      'Mahal': r.lotLocationCode,
      'Banka': r.bankName,
      'Belge Turu': r.documentType,
      'Teminat Tutari (TL)': r.amount,
      'Son Tarih': r.dueDate ? r.dueDate.toLocaleDateString('tr-TR') : '',
      'Kalan Gun': r.daysLeft < 9999 ? (r.daysLeft < 0 ? (r.daysLeft * -1) : r.daysLeft) : '',
      'Vade Durumu': statusLabel(r.status),
      'Aylik Kira (TL)': r.monthlyRent > 0 ? r.monthlyRent : (r.kiraCurrency ? r.kiraCurrency + ' Kira' : ''),
      'Kac Aylik': r.monthlyRent > 0 ? parseFloat(r.monthsCovered.toFixed(1)) : '',
      'Kira Durumu': r.rentStatus === 'sufficient' ? 'Yeterli' : r.rentStatus === 'insufficient' ? 'Yetersiz' : (r.kiraCurrency ? r.kiraCurrency + ' Kira' : '')
    });

    const allRows: any[] = [];
    for (const r of this.filtered) {
      allRows.push(makeExcelRow(r, false));
      for (const s of r.siblings) {
        allRows.push(makeExcelRow(s, true));
      }
    }

    const ws = XLSX.utils.json_to_sheet(allRows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 35 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 12 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 10 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Teminat');
    XLSX.writeFile(wb, 'teminat-' + today.replace(/\./g, '-') + '.xlsx');
  }

  fmt(n: number) {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fmtDate(d: Date | null): string {
    if (!d) return '—';
    return d.toLocaleDateString('tr-TR');
  }
}