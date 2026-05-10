import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OdataService } from '../../core/odata';

interface DepositLetter {
  no: string;
  amount: number;
  dateReceived: string;
  lastExtensionDate: string;
  returnDate: string;
  documentNo: string;
  bankName: string;
  isReturned: boolean;
}

interface DepositRow {
  contractNo: string;
  mallCode: string;
  brandName: string;
  tenantName: string;
  lotNo: string;
  lotType: string;
  depositIncludesVat: boolean;
  depositMonthCount: number;
  rentIncreaseDate: string;
  monthlyRent: number;
  requestedDeposit: number;
  currentDeposit: number;
  difference: number;
  letters: DepositLetter[];
  activeLetterCount: number;
  returnedLetterCount: number;
  lastLetterDate: string;
  nearestDueDate: string;
  remainingDays: number | null;
}

@Component({
  selector: 'app-missing-deposit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './missing-deposit.html',
  styleUrl: './missing-deposit.css',
})
export class MissingDeposit implements OnInit {

  allMalls = ['MCA', 'TCA', 'AFI', 'FBI', 'PAI', 'MCB', 'PAA', 'MWI', 'CPI'];
  selectedMall = '';
  filterMode: 'all' | 'missing' | 'ok' = 'all';
  searchText = '';

  allResults: DepositRow[] = [];
  filteredResults: DepositRow[] = [];
  loading = false;
  error = '';

  get totalMissing(): number {
    return this.filteredResults.filter(r => r.difference < 0).length;
  }
  get totalOk(): number {
    return this.filteredResults.filter(r => r.difference >= 0).length;
  }
  get totalMissingAmount(): number {
    return this.filteredResults
      .filter(r => r.difference < 0)
      .reduce((s, r) => s + r.difference, 0);
  }

  constructor(private odata: OdataService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {}

  // Return_Date varsa ve 0001-01-01 değilse mektup iade edilmiştir
  private isReturned(returnDate: string): boolean {
    return !!returnDate && returnDate !== '0001-01-01';
  }

  // Kira artış tarihinin yılını her zaman bu yıl yap
  private normalizeRentIncreaseDate(dateStr: string): string {
    if (!dateStr || dateStr === '0001-01-01') return '';
    const d = new Date(dateStr);
    const thisYear = new Date().getFullYear();
    d.setFullYear(thisYear);
    return d.toISOString().split('T')[0];
  }

  loadData() {
    this.loading = true;
    this.error = '';
    this.allResults = [];
    this.filteredResults = [];
    this.cdr.detectChanges();

    forkJoin({
      contracts: this.odata.getMissingDepositContracts(this.selectedMall).pipe(catchError(() => of({ value: [] }))),
      rents:     this.odata.getMissingDepositRent(this.selectedMall).pipe(catchError(() => of({ value: [] }))),
      letters:   this.odata.getMissingDepositLetters(this.selectedMall).pipe(catchError(() => of({ value: [] }))),
    }).subscribe({
      next: (res: any) => {
        // Kira map
        const rentMap = new Map<string, number>();
        for (const r of (res.rents.value || [])) {
          rentMap.set(r.Contract_No, r.Monthly_Rental_Amount);
        }

        // Mektup map
        const letterMap = new Map<string, DepositLetter[]>();
        for (const l of (res.letters.value || [])) {
          if (!letterMap.has(l.Contract_No)) letterMap.set(l.Contract_No, []);
          letterMap.get(l.Contract_No)!.push({
            no: l.No,
            amount: l.Amount_LCY || l.Amount || 0,
            dateReceived: l.Date_Received,
            lastExtensionDate: l.Last_Extension_Date,
            returnDate: l.Return_Date,
            documentNo: l.Document_No,
            bankName: l.Bank_Name,
            isReturned: this.isReturned(l.Return_Date),
          });
        }

        const today = new Date();

        this.allResults = (res.contracts.value || []).map((c: any) => {
          const monthlyRent = rentMap.get(c.No) || 0;
          const vatMultiplier = c.Deposit_Including_VAT ? 1.20 : 1;
          const requestedDeposit = monthlyRent * vatMultiplier * (c.Deposit_Month_Count || 0);

          const allLetters = letterMap.get(c.No) || [];

          // İade edilmemiş mektuplar toplamı
          const activeLetters = allLetters.filter(l => !l.isReturned);
          const returnedLetters = allLetters.filter(l => l.isReturned);
          const currentDeposit = activeLetters.reduce((s, l) => s + l.amount, 0);
          const difference = currentDeposit - requestedDeposit;

          // En son mektup tarihi (aktif mektuplardan)
          const lastLetterDate = activeLetters.length > 0
            ? activeLetters.sort((a, b) =>
                new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime()
              )[0].dateReceived
            : '';

          // Vade tarihi = Last_Extension_Date (aktif mektuplardan en yakın)
          const futureDues = activeLetters
            .map(l => l.lastExtensionDate)
            .filter(d => d && d !== '0001-01-01')
            .sort();
          const nearestDueDate = futureDues.length > 0 ? futureDues[0] : '';

          // Kalan gün
          let remainingDays: number | null = null;
          if (nearestDueDate && nearestDueDate !== '0001-01-01') {
            const due = new Date(nearestDueDate);
            remainingDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }

          // Kira artış tarihi — yılı bu yıl yap
          const rentIncreaseDate = this.normalizeRentIncreaseDate(c.Rent_Increase_Date);

          return {
            contractNo: c.No,
            mallCode: c.Mall_Code,
            brandName: c.Brand_Name,
            tenantName: c.Tenant_Name,
            lotNo: c.Lot_No,
            lotType: c.Lot_Location_Code,
            depositIncludesVat: c.Deposit_Including_VAT,
            depositMonthCount: c.Deposit_Month_Count || 0,
            rentIncreaseDate,
            monthlyRent,
            requestedDeposit,
            currentDeposit,
            difference,
            letters: allLetters,
            activeLetterCount: activeLetters.length,
            returnedLetterCount: returnedLetters.length,
            lastLetterDate,
            nearestDueDate,
            remainingDays,
          };
        }).filter((r: DepositRow) => r.monthlyRent > 0 || r.currentDeposit > 0);

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

  applyFilter() {
    let results = this.allResults;

    if (this.filterMode === 'missing') {
      results = results.filter(r => r.difference < 0);
    } else if (this.filterMode === 'ok') {
      results = results.filter(r => r.difference >= 0);
    }

    const q = this.searchText.trim().toLowerCase();
    if (q) {
      results = results.filter(r =>
        r.brandName.toLowerCase().includes(q) ||
        r.contractNo.toLowerCase().includes(q) ||
        r.tenantName.toLowerCase().includes(q) ||
        r.lotNo.toLowerCase().includes(q)
      );
    }

    this.filteredResults = results;
  }

  fmt(n: number): string {
    if (!n && n !== 0) return '—';
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  fmtDate(d: string): string {
    if (!d || d === '0001-01-01') return '—';
    return new Date(d).toLocaleDateString('tr-TR');
  }

  diffClass(diff: number): string {
    if (diff < -1) return 'diff-missing';
    if (diff > 1) return 'diff-excess';
    return 'diff-ok';
  }

  remainingClass(days: number | null): string {
    if (days === null) return '';
    if (days < 0) return 'days-overdue';
    if (days <= 30) return 'days-warning';
    return 'days-ok';
  }
}