import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface OdataEnvironment {
  url: string;
  user: string;
  pass: string;
}

declare const require: any;

@Injectable({
  providedIn: 'root'
})
export class OdataService {

  private config: OdataEnvironment = { url: '', user: '', pass: '' };

  constructor(private http: HttpClient) {
    try {
      const env = require('../../environments/environment');
      this.config = env.environment?.odata || this.config;
    } catch {
      this.config = { url: '', user: '', pass: '' };
    }
  }

  private getHeaders(): HttpHeaders {
    const creds = btoa(this.config.user + ':' + this.config.pass);
    return new HttpHeaders({
      'Authorization': 'Basic ' + creds,
      'Accept': 'application/json',
    });
  }

  getTurnover(year: number) {
    const url = `${this.config.url}?$filter=Year eq ${year}&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }

  getContracts() {
    const baseUrl = this.config.url.replace(/\/ContractTurnoverEntry.*/, '');
    const url = `${baseUrl}/ContractList?$select=No,Lot_No,Area_m2,SectorName&$top=5000`;
    return this.http.get<any>(url, { headers: this.getHeaders() });
  }
}