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
}