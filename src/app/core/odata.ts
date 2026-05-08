import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OdataService {

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const creds = btoa(environment.odata.user + ':' + environment.odata.pass);
    return new HttpHeaders({
      'Authorization': 'Basic ' + creds,
      'Accept': 'application/json',
    });
  }

  getTurnover(year: number) {
    const url = `${environment.odata.url}?$filter=Year eq ${year}&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getContracts() {
    const baseUrl = environment.odata.url.replace(/\/ContractTurnoverEntry.*/, '');
    const url = `${baseUrl}/ContractList?$select=No,SectorName,SubSectorName&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getContractList() {
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'ContractList')
      + `?$select=No,Mall_Code,Brand_Code,Lot_No,Tenant_Name&$filter=Status eq 'Y%C3%BCr%C3%BCrl%C3%BCkte'&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getAging(year: number) {
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'CustomerLedgerEntries')
      + `?$filter=Remaining_Amt_LCY gt 0 and Posting_Date ge ${year}-01-01 and Posting_Date le ${year}-12-31&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getAgingNegative(year: number) {
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'CustomerLedgerEntries')
      + `?$filter=Remaining_Amt_LCY lt 0 and Posting_Date ge ${year}-01-01 and Posting_Date le ${year}-12-31&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getMalls() {
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'MallL%C4%B1st')
      + `?$select=Code,Name&$top=100`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getTeminat() {
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'Guarantees_Letter')
      + `?$filter=Amount gt 0&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getKiraBilgileri() {
    const today = new Date().toISOString().split('T')[0];
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'KiralamaBilgileri')
      + `?$filter=Monthly_Rental_Amount gt 0 and Contract_Starting_Date le ${today} and Contract_Ending_Date ge ${today}&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getPortalKullanim(year: number) {
    const url = `${environment.odata.url}?$filter=Year eq ${year}&$select=Mall_Code,Brand_Name,Brand_Code,Customer_No,Month,Amount,Created_From_Web_Portal,Approved&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // OCR — ContractList
  getOcrContractList(mallCode: string) {
    const mallFilter = mallCode ? ` and Mall_Code eq '${mallCode}'` : '';
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'ContractList')
      + `?$filter=Status eq 'Y%C3%BCr%C3%BCrl%C3%BCkte'${mallFilter}&$select=No,Mall_Code,Mall_Name,Brand_Name,Tenant_Name,Lot_No,Lot_Location_Code,Area_m2,SectorName,Rent_Invoice_Ratio,Period_Remark,Leasing_Method&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // OCR — Rent (Invoice_Month bazında)
  getOcrRentAll(mallCode: string, year: number) {
    const mallFilter = mallCode ? ` and Global_Dimension_1_Code eq '${mallCode}'` : '';
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'CustomerLedgerEntries')
      + `?$filter=Invoice_Type eq 'KIRA' and Document_Type eq 'Fatura' and Reversed eq false and Invoice_Year eq ${year}${mallFilter}&$select=Contract_No,Original_Amt_LCY,Invoice_Month&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // OCR — CAC (Invoice_Month bazında)
  getOcrCacAll(mallCode: string, year: number) {
    const mallFilter = mallCode ? ` and Global_Dimension_1_Code eq '${mallCode}'` : '';
    const url = environment.odata.url
      .replace('ContractTurnoverEntry', 'CustomerLedgerEntries')
      + `?$filter=Invoice_Type eq 'GENEL GIDER' and Document_Type eq 'Fatura' and Reversed eq false and Invoice_Year eq ${year}${mallFilter}&$select=Contract_No,Original_Amt_LCY,Invoice_Month&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  // OCR — Ciro (Month bazında)
  getOcrTurnoverAll(mallCode: string, year: number) {
    const mallFilter = mallCode ? ` and Mall_Code eq '${mallCode}'` : '';
    const url = environment.odata.url
      + `?$filter=Year eq ${year}${mallFilter}&$select=Contract_No,Amount,Month&$top=10000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getOcrRent(mallCode: string, year: number) { return this.getOcrRentAll(mallCode, year); }
  getOcrCac(mallCode: string, year: number) { return this.getOcrCacAll(mallCode, year); }
  getOcrTurnover(mallCode: string, year: number) { return this.getOcrTurnoverAll(mallCode, year); }
}